#!/usr/bin/env bash
# After merging a pull request on GitHub, run this on your PC:
#     npm run publish-test
# It pulls the latest master and publishes it (website + security rules) to the
# TEST address only. The main address is changed only by  npm run go-live
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_ID="$(node -p "require('./firebase-applet-config.json').projectId")"
TEST_SITE="$(node -p "((JSON.parse(require('fs').readFileSync('.firebaserc','utf8')).targets||{})['$PROJECT_ID']||{}).hosting?.test?.[0]||''")"
FB="npx --yes firebase-tools@latest"

printf '\n\033[1m1/3  Getting the latest code (master)\033[0m\n'
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "  ✘ You have local changes to tracked files. Commit or discard them first:"
  git status --short --untracked-files=no
  exit 1
fi
git checkout -q master
git pull --ff-only

printf '\n\033[1m2/3  Building\033[0m\n'
npm ci
npm run build

printf '\n\033[1m3/3  Publishing to the test address\033[0m\n'
$FB deploy --only auth,firestore:rules,hosting:test --project "$PROJECT_ID" --non-interactive
printf '  \033[32m✔\033[0m Online at https://%s.web.app  (%s)\n' "$TEST_SITE" "$(git log -1 --format='%h %s')"
