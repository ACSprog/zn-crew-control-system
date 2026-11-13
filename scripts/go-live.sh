#!/usr/bin/env bash
# Publish the current code to the MAIN address (https://<project>.web.app).
# Day-to-day deploys go to the test site (npm run deploy / merging into master).
#     npm run go-live
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_ID="$(node -p "require('./firebase-applet-config.json').projectId")"
FB="npx --yes firebase-tools@latest"

printf '\n\033[1mGo live: publish to https://%s.web.app\033[0m\n' "$PROJECT_ID"
echo "  Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')  Commit: $(git log -1 --format='%h %s' 2>/dev/null || echo '?')"
echo "  Before going live: Test Mode OFF and test accounts removed (User Access), test data cleared."
read -r -p "  Type GO LIVE to continue: " answer
[[ "$answer" == "GO LIVE" ]] || { echo "Cancelled."; exit 0; }

npm ci
npm run build
# Re-enables the main site if it was taken offline with  npm run live:off
$FB deploy --only auth,firestore:rules,hosting:live --project "$PROJECT_ID" --non-interactive
printf '  \033[32m✔\033[0m Live at https://%s.web.app\n' "$PROJECT_ID"
