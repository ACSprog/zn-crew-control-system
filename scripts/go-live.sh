#!/usr/bin/env bash
# Publish the current code to the LIVE project (firebase-applet-config.live.json).
# Day-to-day changes go to the test project (merge / npm run deploy); run this
# once they have been checked there. See docs/ENVIRONMENTS.md.
#     npm run go-live
set -euo pipefail
cd "$(dirname "$0")/.."
LIVE_ID="$(node -p "require('./firebase-applet-config.live.json').projectId")"
[[ -n "$LIVE_ID" ]] || { echo "✘ firebase-applet-config.live.json has no project yet."; exit 1; }
FB="npx --yes firebase-tools@latest"

printf '\n\033[1mGo live: publish to the LIVE project %s (https://%s.web.app)\033[0m\n' "$LIVE_ID" "$LIVE_ID"
echo "  Code: $(git rev-parse --abbrev-ref HEAD 2>/dev/null) @ $(git log -1 --format='%h %s' 2>/dev/null)"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "  ✘ You have uncommitted changes. Only publish code that is committed (and tested on the test site)."
  exit 1
fi
read -r -p "  Type GO LIVE to continue: " answer
[[ "$answer" == "GO LIVE" ]] || { echo "Cancelled."; exit 0; }

npm ci
npm run build:live
$FB deploy --only auth,firestore:rules,hosting --project "$LIVE_ID" --non-interactive
printf '  \033[32m✔\033[0m Live at https://%s.web.app\n' "$LIVE_ID"
