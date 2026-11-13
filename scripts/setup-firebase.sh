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
#   3. Creates the TEST Hosting site (e.g. zn-crew-control-system-test) and
#      points the "test" deploy target at it
#   4. Builds the app and deploys: Email/Password sign-in, Firestore rules,
#      and the website to the TEST address only. The main address
#      (https://<project>.web.app) is only changed by  npm run go-live
#   5. (Optional) With a service-account key file: creates your SUPER_ADMIN
#      user and stores the key as the GitHub secret for auto-deploys
#
# The only manual step: downloading the service-account key (step 5), from
# Firebase console -> Project settings -> Service accounts -> Generate new
# private key. Keep that file OUTSIDE this folder; never commit it.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_ID="$(node -p "require('./firebase-applet-config.json').projectId")"
REGION="${FIRESTORE_REGION:-africa-south1}"
FB="npx --yes firebase-tools@latest"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

bold "ZN Crew Control setup for Firebase project: $PROJECT_ID"
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

# ---------------------------------------------------------------- 2. firestore
bold "2/5  Firestore (default) database"
if $FB firestore:databases:list --project "$PROJECT_ID" --json 2>/dev/null | grep -q "databases/(default)"; then
  ok "(default) database already exists"
else
  $FB firestore:databases:create "(default)" --location "$REGION" --project "$PROJECT_ID"
  ok "Created (default) database in $REGION"
fi

# ---------------------------------------------------------------- 3. hosting sites
bold "3/5  Hosting sites (test address + main address)"
SITES_JSON="$($FB hosting:sites:list --project "$PROJECT_ID" --json 2>/dev/null || true)"
has_site() { grep -q "sites/$1\"" <<<"$SITES_JSON"; }

if has_site "$PROJECT_ID"; then
  ok "Main site $PROJECT_ID exists (not changed by this script)"
else
  $FB hosting:sites:create "$PROJECT_ID" --project "$PROJECT_ID" --non-interactive >/dev/null 2>&1 \
    && ok "Created main site $PROJECT_ID" \
    || warn "Main site $PROJECT_ID not created (open Firebase console -> Hosting -> Get started). Only needed for go-live."
fi

# Test site: the one in .firebaserc first, then fallbacks (site names are global)
CURRENT_TEST="$(node -p "((JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).targets||{})['$PROJECT_ID']||{}).hosting?.test?.[0]||''")"
TEST_SITE=""
for candidate in ${TEST_SITE_ID:-} "$CURRENT_TEST" zn-crew-control-system-test "$PROJECT_ID-test" zn-crew-control-test; do
  [[ -z "$candidate" ]] && continue
  if has_site "$candidate"; then TEST_SITE="$candidate"; ok "Test site $candidate exists"; break; fi
  if $FB hosting:sites:create "$candidate" --project "$PROJECT_ID" --non-interactive >/dev/null 2>&1; then
    TEST_SITE="$candidate"; ok "Created test site $candidate"; break
  fi
  warn "Site name $candidate is taken or not allowed, trying the next one"
done
[[ -n "$TEST_SITE" ]] || { echo "  ✘ Could not create a test site. Re-run with TEST_SITE_ID=some-unique-name"; exit 1; }

if [[ "$TEST_SITE" != "$CURRENT_TEST" ]]; then
  $FB target:clear hosting test --project "$PROJECT_ID" >/dev/null 2>&1 || true
  $FB target:apply hosting test "$TEST_SITE" --project "$PROJECT_ID" >/dev/null
  warn ".firebaserc now points the test target at $TEST_SITE. Commit and push it so GitHub deploys there too:"
  echo "     git add .firebaserc && git commit -m \"Use test site $TEST_SITE\" && git push"
fi

# ---------------------------------------------------------------- 4. build + deploy
bold "4/5  Build and deploy to the TEST address (sign-in provider, security rules, website)"
npm ci
npm run build
$FB deploy --only auth,firestore:rules,hosting:test --project "$PROJECT_ID" --non-interactive
ok "Test site online at https://$TEST_SITE.web.app (anyone with the link can open it)"
echo "  The main address https://$PROJECT_ID.web.app was not changed."
echo "  Want it offline until go-live?  npm run live:off      Go live later:  npm run go-live"

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
GOOGLE_APPLICATION_CREDENTIALS="$KEY" node scripts/create-user.mjs \
  --email="$ADMIN_EMAIL" --password="$ADMIN_PASS" --name="$ADMIN_NAME" --role=SUPER_ADMIN
unset ADMIN_PASS

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh secret set FIREBASE_SERVICE_ACCOUNT < "$KEY"
  ok "GitHub secret FIREBASE_SERVICE_ACCOUNT set — future merges to master deploy automatically"
else
  warn "GitHub CLI not installed/signed in. Add the secret by hand:"
  echo "     GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret"
  echo "     Name: FIREBASE_SERVICE_ACCOUNT   Value: the whole contents of $KEY"
fi

bold "All done. Sign in at https://$TEST_SITE.web.app with $ADMIN_EMAIL"
echo "  Next (recommended): turn on two-step sign-in with  npm run 2fa:enable"
echo "  See docs/LOGIN_AND_2FA.md"
