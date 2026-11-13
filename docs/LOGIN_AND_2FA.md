# Sign-in, two-step sign-in (2FA) and user accounts

Crew Control uses the same sign-in design as the Zambia Airways QSA Reporting System. Everything
runs on the free Spark plan. There are no Cloud Functions; the browser and the security rules do
the work.

## What changed

| | Before | Now |
|---|---|---|
| **Where a person's role lives** | A token "custom claim" that only `scripts/create-user.mjs` could set | Their profile `users/{uid}` (`role`, `status`), managed from **User Access** and enforced by `firestore.rules` |
| **Creating a user** | Copy a terminal command and run it | **User Access → Add System User** creates the real login with a temporary password |
| **2FA** | None (the "MFA verified" flag was fake) | Authenticator-app codes (Google or Microsoft Authenticator) |
| **Wrong passwords** | Unlimited | 5 wrong passwords lock the account |
| **Session** | Stayed signed in | Ends when the browser closes, after 15 minutes idle, and after 12 hours |

## One-time setup (project owner)

1. **Publish the new security rules** by running `npm run setup` (or merge, and the live deploy does it).
   - Existing accounts keep working. Their `users/{uid}` profile already holds their role.
   - `firebase deploy` checks the rules compile before publishing them.
2. **Turn on authenticator-app 2FA** with `npm run 2fa:enable`.
   - This upgrades the project to *Firebase Authentication with Identity Platform* and switches on
     TOTP codes. The upgrade is free on the Spark plan up to 3,000 daily users.
   - It uses your `firebase login`, so no key file is needed.
3. **Set up 2FA on your own account:** your name (top right) → **Two-Step Sign-In (2FA)**.
   1. Verify your email.
   2. Scan the QR code with your authenticator app.
   3. Enter the code.
   4. Sign in again with the code.
4. **Optional:** User Access → **Require 2FA for Everyone**.
   - This only works from a session that used 2FA, so nobody can require codes that don't work.
   - There is no "off for everyone" button in the app. The emergency switch is `npm run 2fa:relax`.

## Roles that manage accounts

| Role | Can manage |
|---|---|
| **Super Admin / IT** | Everyone. Changes to *another* Super Admin are only requests (see below). |
| **System Admin** | Everyone below Admin: OCC Controller, Scheduler, Chief Pilot, Auditor, Flight Crew |
| Everyone else | Only their own name, department and base |

Nobody can change their own role, status, staff number, email or 2FA setting.

## User Access actions

- **Add System User** creates the login with a random temporary password and the profile.
  - **How they're told:** the welcome email goes out through the Power Automate notification
    gateway if it's configured. Otherwise Firebase emails a "set your password" link.
  - **Backup:** the temporary password is shown once to the admin.
  - **First sign-in:** the user must choose their own password.
- **Edit → Send Password Reset Email** emails a reset link. If the account was **locked** after
  5 wrong passwords, this also unlocks it.
- **Edit → Block / Unblock:** blocking stops access immediately, and the user stays listed.
- **Delete** removes all Crew Control access.
  - The Firebase login itself remains; you can delete it in Firebase console → Authentication.
  - Deleting a login from the browser would need the paid plan.
- **Edit → Start 2FA / Stop 2FA** (Super Admins only) sets the per-person requirement. The person's
  own setting wins over the everyone setting.
  - **Start 2FA:** they must set up an authenticator app, straight away if they're signed in.
  - **Stop 2FA:** they sign in with just their password. Any existing authenticator is asked for
    once more, then removed.
- **2FA status badges in the list:**
  - **2FA ON:** signs in with a code.
  - **2FA SET-UP PENDING:** required but not set up yet.
  - **2FA OFF**
- **Lost phone:** the Edit window shows the exact command for the project owner, e.g.
  `npm run reset-2fa -- --email person@zambiaairways.co.zm`.

## Super Admin two-person rule

A Super Admin can only *request* to remove, block or change the role of another Super Admin.

- The Super Admin concerned sees the request at the top of the app and clicks **Approve** or **Decline**.
- The requester can **Withdraw** it from the Edit window.
- Unblocking a Super Admin needs no approval.

## Sessions

- **Idle limit:** you're signed out after **15 minutes** without activity, with a 60-second
  "Are you still there?" warning first. Activity in any tab counts.
- **Maximum length:** you must sign in again after **12 hours**. The security rules refuse
  sessions older than 12 hours as a backstop.
- **Closing the browser** signs you out. Refreshing the page does not.
- **Changing the limits:** set `VITE_IDLE_MINUTES` and `VITE_MAX_SESSION_HOURS` (max 12) in the
  build environment.

## Emergency commands (project owner, signed in to the Firebase CLI)

| Command | What it does |
|---|---|
| `npm run 2fa:enable` | Turn on authenticator-app 2FA for the project |
| `npm run 2fa:enable -- --require` | Turn it on and require it for everyone now |
| `npm run 2fa:relax` | Stop requiring 2FA for everyone, e.g. if nobody can sign in |
| `npm run reset-2fa -- --email x@y` | Remove one person's authenticator (lost phone) |
| `npm run create-user -- ...` | Create or repair an account with a service-account key, e.g. to recover the first Super Admin |

## Test Mode (letting testers in before go-live)

**Turning it on:** User Access → **Turn Test Mode On** (Super Admins only). Set the allowed email
domain first; leave it empty for any email address.

**While Test Mode is on:**
- The sign-in page shows **Create a test account**.
- Testers enter their name and email, choose a **non-admin** role (OCC Controller, Scheduler,
  Chief Pilot, Auditor or Flight Crew) and a password, and are signed straight in.
- Their accounts carry a **TEST** badge in User Access, and you can manage them like any other
  user (change role, block, remove).
- A Super Admin can still upgrade a tester to System Admin if they need to test user management.

**Before going live:**
1. Click **Turn Test Mode Off**. No new test accounts can be created after that.
2. Click **Remove all test accounts**.
3. Clear out test data (crew, flights, rosters) entered during testing.

**Things to know:**
- The security rules enforce all of this: sign-up only while Test Mode is on, only for the allowed
  domain, never an admin role, and the TEST flag can't be removed.
- `npm run 2fa:relax` and `npm run 2fa:enable -- --require` rewrite the security settings. Running
  either one also switches Test Mode off.
