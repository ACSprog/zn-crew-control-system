#!/usr/bin/env bash
# =============================================================================
# ZN Crew Control — one-time Firebase setup + first deploy (free Spark plan)
#
# Run from the project folder in Git Bash (Windows) or any bash shell:
#     bash scripts/setup-firebase.sh
#
# What it does (each step is skipped if already done, so it's safe to re-run):
#   1. Signs you in to Firebase (opens your browser)
#   2. Creates the Firestore (default) database in africa-south1
#   3. Creates the Firebase Hosting site if it doesn't exist yet
#   4. Builds the app and deploys: Email/Password sign-in, Firestore rules,
#      and the website  ->  https://<project>.web.app
#   5. (Optional) With a service-account key file: creates your SUPER_ADMIN
#      user and stores the key as the GitHub secret for auto-deploys
#
# The only manual step: downloading the service-account key (step 5), from
# Firebase console -> Project settings -> Service accounts -> Generate new
# private key. Keep that file OUTSIDE this folder; never commit it.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

# Which environment: test (default, firebase-applet-config.json) or live
# (firebase-applet-config.live.json). See docs/ENVIRONMENTS.md.
ENV_NAME="${1:-test}"
case "$ENV_NAME" in
  test) CONFIG=firebase-applet-config.json; BUILD="npm run build"; SECRET=FIREBASE_SERVICE_ACCOUNT; LIVE_FLAG="" ;;
  live) CONFIG=firebase-applet-config.live.json; BUILD="npm run build:live"; SECRET=FIREBASE_SERVICE_ACCOUNT_LIVE; LIVE_FLAG="--live" ;;
  *) echo "Usage: bash scripts/setup-firebase.sh [test|live]"; exit 1 ;;
esac
PROJECT_ID="$(node -p "require('./$CONFIG').projectId")"
[[ -n "$PROJECT_ID" ]] || { echo "  ✘ $CONFIG has no projectId yet. Add the live project's firebaseConfig first."; exit 1; }
REGION="${FIRESTORE_REGION:-africa-south1}"
FB="npx --yes firebase-tools@latest"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

bold "ZN Crew Control setup: $(echo "$ENV_NAME" | tr a-z A-Z) environment, Firebase project $PROJECT_ID"
echo "  Firestore region: $REGION (set FIRESTORE_REGION=... to change; cannot be changed later)"
read -r -p "  Continue? [y/N] " go
[[ "$go" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }

# ---------------------------------------------------------------- 1. login
bold "1/5  Signing in to Firebase"
if $FB projects:list --json 2>/dev/null | grep -q "\"$PROJECT_ID\""; then
  ok "Already signed in with access to $PROJECT_ID"
else
  echo "  A browser window will open. Sign in with the Google account that owns the project."
  $FB login
  $FB projects:list --json | grep -q "\"$PROJECT_ID\"" || {
    echo "  ✘ This Google account can't see project $PROJECT_ID. Run: $FB login --reauth"
    exit 1
  }
  ok "Signed in"
fi

# ---------------------------------------------------------------- 1b. Google APIs
# New projects start with the Firestore/Rules/Hosting APIs switched off.
node scripts/enable-apis.mjs --project "$PROJECT_ID"

# ---------------------------------------------------------------- 2. firestore
bold "2/5  Firestore (default) database"
if $FB firestore:databases:list --project "$PROJECT_ID" --json 2>/dev/null | grep -q "databases/(default)"; then
  ok "(default) database already exists"
else
  $FB firestore:databases:create "(default)" --location "$REGION" --project "$PROJECT_ID"
  ok "Created (default) database in $REGION"
fi

# ---------------------------------------------------------------- 3. hosting site
bold "3/5  Hosting site"
if $FB hosting:sites:list --project "$PROJECT_ID" --json 2>/dev/null | grep -q "sites/$PROJECT_ID\""; then
  ok "Hosting site $PROJECT_ID exists"
else
  $FB hosting:sites:create "$PROJECT_ID" --project "$PROJECT_ID" --non-interactive \
    || warn "Could not create the site automatically. Open Firebase console -> Hosting -> Get started, then re-run."
fi

# ---------------------------------------------------------------- 4. build + deploy
bold "4/5  Build and deploy (sign-in provider, security rules, website)"
npm ci
$BUILD
$FB deploy --only auth,firestore:rules,hosting --project "$PROJECT_ID" --non-interactive
ok "$(echo "$ENV_NAME" | tr a-z A-Z) site online at https://$PROJECT_ID.web.app"

# ---------------------------------------------------------------- 5. admin user + GitHub secret
bold "5/5  First SUPER_ADMIN user and GitHub auto-deploy secret (optional)"
echo "  Needs the service-account key JSON (Firebase console -> Project settings ->"
echo "  Service accounts -> Generate new private key)."
read -r -p "  Path to the key file (Enter to skip): " KEY
KEY="${KEY%\"}"; KEY="${KEY#\"}"   # strip quotes from drag-and-drop paths
if [[ -z "$KEY" ]]; then
  warn "Skipped. Re-run this script later to do step 5."
  echo "  Two-step sign-in: run  npm run 2fa:enable  (see docs/LOGIN_AND_2FA.md)"
  exit 0
fi
[[ -f "$KEY" ]] || { echo "  ✘ File not found: $KEY"; exit 1; }
case "$(cd "$(dirname "$KEY")" && pwd)/" in
  "$(pwd)/"*) echo "  ✘ Move the key file outside the project folder first (it must never be committed)."; exit 1 ;;
esac

read -r -p "  Admin email: " ADMIN_EMAIL
read -r -p "  Admin full name: " ADMIN_NAME
read -r -s -p "  Temporary password (min 6 chars, hidden): " ADMIN_PASS; echo
GOOGLE_APPLICATION_CREDENTIALS="$KEY" node scripts/create-user.mjs $LIVE_FLAG \
  --email="$ADMIN_EMAIL" --password="$ADMIN_PASS" --name="$ADMIN_NAME" --role=SUPER_ADMIN
unset ADMIN_PASS

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh secret set "$SECRET" < "$KEY"
  ok "GitHub secret $SECRET set"
else
  warn "GitHub CLI not installed/signed in. Add the secret by hand:"
  echo "     GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret"
  echo "     Name: $SECRET   Value: the whole contents of $KEY"
fi

bold "All done. Sign in at https://$PROJECT_ID.web.app with $ADMIN_EMAIL"
echo "  Next (recommended): turn on two-step sign-in with  npm run 2fa:enable${LIVE_FLAG:+ -- --live}"
echo "  See docs/LOGIN_AND_2FA.md"
