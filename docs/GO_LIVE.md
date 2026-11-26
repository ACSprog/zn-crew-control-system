# Go-live checklist

How the Crew Control system moves from testing into live use. The test environment
(`zn-crew-control-system-test`) stays permanently for testing future changes. See
[ENVIRONMENTS.md](ENVIRONMENTS.md).

## What is different in the live system

| | Test | Live |
|---|---|---|
| Data | Test data, which can be cleared with **Clear all data** (Settings) | Starts **empty**. Clear all data is not available; records are deleted one by one. |
| Audit trail | **Not recorded** | **Recorded** from the first Super Admin sign-in, permanently ([AUDIT_TRAIL.md](AUDIT_TRAIL.md)) |
| Users | Testers | Real staff, created in User Access |

The app contains no sample data: no demo crew, flights, fleet or notification history. The CSV
import templates contain one example row each, to show the format.

## 1. Create the live Firebase project (company account)

Signed in as **zambiaairwaysltd@gmail.com**:

1. https://console.firebase.google.com → **Add project**. Use a clear ID, e.g.
   `zambia-airways-crew-control`. The ID becomes the web address and can't be changed. Turn
   Analytics off.
2. **Project settings → Users and permissions → Add member**: the developer's Google account,
   role **Owner**.
3. Add a **web app** (</>) and send its `firebaseConfig`. It goes into
   `firebase-applet-config.live.json`.
4. Turn on **2-Step Verification** for the company Google account.
5. Decide on two-step sign-in (2FA) for live (section 5).

## 2. Set it up (developer's PC, once)

1. `git pull`
2. Firebase console → live project → **Project settings → Service accounts → Generate new
   private key**. Keep the file outside the project folder.
3. `npm run setup:live`. This creates the database (africa-south1), sign-in, security rules and
   the website. At the last step, give the live key file and create the **first Super Admin**.
4. Delete the key file, or store it in the GitHub secret `FIREBASE_SERVICE_ACCOUNT_LIVE` so the
   **Go live** workflow can publish (`npm run deploy:grant -- --live`).

## 3. First sign-in (starts the audit trail)

1. Open the live address and sign in as the Super Admin. Change the temporary password.
2. **Audit Log** shows "Recording since …" and an **Audit trail started** entry. If it shows
   "The audit trail hasn't started yet", click **Start the audit trail**.
3. Run the checks in [AUDIT_TRAIL.md §7](AUDIT_TRAIL.md).

## 4. Load the real data

1. **Settings → Legality rules**: confirm the FTL limits.
2. **Fleet**: add the aircraft, or import the fleet CSV.
3. **Crew database**: import the crew CSV, or add crew one by one.
4. **User Access**: create accounts for OCC, schedulers, chief pilots, auditors and crew.
5. **Notifications**: enter the Power Automate settings (stored per project).
6. Import or build the first roster and publish it.

Every import and change from here on is in the audit trail.

## 5. Two-step sign-in (2FA) on live

New Firebase projects may refuse the Identity Platform upgrade without billing ("requires billing
to be enabled"). Try **Authentication → Settings → Upgrade** in the live project first. If it
asks for billing, choose one of:

- **Blaze plan with a budget alert**. Authenticator-app 2FA stays free for up to 50,000 monthly
  users, and SMS isn't used. Set a $1 budget alert.
- **Go live without 2FA**: passwords with lock-out after 5 attempts. Declare this as a
  limitation to auditors.

Then `npm run 2fa:enable -- --live`.

## 6. After go-live

Every change: merge → check on the test site → `npm run go-live` (or GitHub → Actions → **Go
live**, type `GO LIVE`). Review the audit log monthly ([AUDIT_TRAIL.md §5](AUDIT_TRAIL.md)).
