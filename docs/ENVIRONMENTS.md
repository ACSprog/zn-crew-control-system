# Test and live environments

The system runs as **two separate Firebase projects**. Each has its own database, user
accounts, security settings and audit log. Nothing done in test can touch live.

| | Test | Live |
|---|---|---|
| Firebase project | `zn-crew-control-system-test` | *to be created by zambiaairwaysltd@gmail.com* |
| Web address | https://zn-crew-control-system-test.web.app | `https://<live project id>.web.app` |
| Config file | `firebase-applet-config.json` | `firebase-applet-config.live.json` |
| Who uses it | You and testers, with test data | Staff and crew, with real data |
| Updated by | Merging into `master` (GitHub), or `npm run deploy` | **Only** `npm run go-live`, or GitHub → Actions → **Go live** |
| GitHub secret | `FIREBASE_SERVICE_ACCOUNT` (a key of the test project) | `FIREBASE_SERVICE_ACCOUNT_LIVE` (a key of the live project) |

The test site shows an amber **TEST ENVIRONMENT** label in the corner of every screen, and
`[TEST]` in the browser tab.

## Making a change (before and after go-live)

1. The change is built and opened as a pull request.
2. **Merge it.** It is published to the **test** site.
3. Check it on the test site with test accounts and test data.
4. **Promote it to live** when you're happy:
   - from your PC: `git pull`, then `npm run go-live` (type `GO LIVE`), or
   - on GitHub: **Actions → Go live → Run workflow**, type `GO LIVE`.

Live only ever receives code that has already been through the test site.

## Commands

| Command | Test (default) | Live |
|---|---|---|
| One-time setup (database, sign-in, rules, website, first Super Admin) | `npm run setup` | `npm run setup:live` |
| Publish | `npm run deploy` | `npm run go-live` |
| Turn on authenticator-app 2FA | `npm run 2fa:enable` | `npm run 2fa:enable -- --live` |
| Remove someone's lost authenticator | `npm run reset-2fa -- --email x` | `npm run reset-2fa -- --email x --live` |
| Let GitHub deploy (service-account permissions) | `npm run deploy:grant` | `npm run deploy:grant -- --live` |
| Run on your PC (`npm run dev`) | uses test | — |

## Setting up the live project (once)

1. Signed in as **zambiaairwaysltd@gmail.com**: Firebase console → **Add project** (e.g.
   `zambia-airways-crew-control`, Analytics off).
2. Add a **web app** (</>) and paste its `firebaseConfig` values into
   `firebase-applet-config.live.json`, or send them to be added.
3. **Project settings → Users and permissions**: add the developer's Google account as
   **Owner**.
4. Turn on 2-Step Verification for the company Google account.
5. From the project folder: `npm run setup:live`. Use a service-account key **of the live
   project** at the last step. It creates the first live Super Admin and, if the GitHub CLI is
   installed, saves the key as `FIREBASE_SERVICE_ACCOUNT_LIVE`.
6. `npm run deploy:grant -- --live`, so the GitHub **Go live** workflow may publish.

Power Automate (email), 2FA and other settings are stored per project. Set them up in each.
