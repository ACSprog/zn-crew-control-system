# Running ZN Crew Control on free tiers

This branch runs the whole system with **no Google Cloud billing account**. It uses the
Firebase **Spark** (free) plan plus services that come with the airline's existing
**Microsoft 365** licences.

## 1. What changed

| Area | Before (needed billing) | Now (free) |
|---|---|---|
| Hosting | Firebase Hosting + `/api/**` rewrite to **Cloud Run** `za-crew-api` | Firebase Hosting only (static site) |
| Database | Rules deployed to a **named** Firestore DB (`ai-studio-…`), which gets no free quota | **(default)** Firestore DB with 50k reads / 20k writes / 1 GiB free per day |
| Read usage | Every app load re-read every collection, including the ever-growing audit log | On-device IndexedDB cache (only changed docs are re-read). The live audit-log view is capped at the newest 500 entries |
| Email alerts | Cloud Run → Mailgun / SendGrid SMTP | **Power Automate** → Outlook "Send an email (V2)" |
| WhatsApp alerts | Meta WhatsApp Cloud API (billed per conversation) | **Removed.** Replaced by an optional **Teams chat** to the crew member through the same flow |
| AI assistant | Cloud Run → Gemini API | **Microsoft 365 Copilot Chat handoff**: the app downloads a data snapshot and the user asks Copilot |
| User creation / roles | `scripts/create-user.mjs` (Admin SDK, run locally) | Unchanged. It is free and runs from an admin's PC |

## 2. Features cut or reduced

1. **Automatic WhatsApp messages.** Gone. The Meta Business API has no free tier for
   business-initiated messages. Use Teams chat, or a controller can still message crew
   manually from their phone.
2. **Delivery and read receipts** (the Meta and SendGrid webhooks, plus the `deliveryReceipts`
   collection). A static site can't receive webhooks. Each Power Automate flow run
   shows its own success or failure in the flow's run history.
3. **In-app Gemini chat.** The assistant no longer answers inside the app. It prepares
   the question and data so the user can answer it in Copilot Chat (2 extra clicks).
   To bring the in-app chat back, host any endpoint and set `VITE_AI_BACKEND_URL`
   (see section 6).
4. **Server-side Cloud Functions notification engine** (`functions/`). It was never deployed.
   It needs the Blaze plan, so it stays unused.
5. **Full audit history in the live view.** The view shows only the newest 500 entries.
   Older entries are still stored in Firestore.
6. **Free-tier limits to watch:**
   - 50,000 document reads/day
   - 20,000 writes/day
   - 1 GiB stored
   - Hosting: 10 GB stored and 360 MB/day transfer

   A normal OCC team stays well inside these. Bulk re-imports of the full seasonal
   schedule are the main risk.

The paid code (`server.ts`, `src/server/**`, `functions/`, `Dockerfile`) is kept, not deleted,
so you can switch back. It is no longer part of `npm run dev`, `build` or `deploy`. To run it,
use `npm run paid:dev-server`.

## 3. One-time migration (do this before downgrading)

1. In the Firebase console → Firestore, check whether the named database
   `ai-studio-zambiaairwayscre-…` exists and holds data. The app's client code was already
   reading the `(default)` database. Only the security rules were going to the named one.
   If the named DB does hold data you need, copy it into `(default)` first, while billing
   is still on. A few cents of reads.
2. Deploy the rules and the test site: `npm run deploy`.
3. Delete the Cloud Run service `za-crew-api` (Cloud Console → Cloud Run). Delete the named
   Firestore database.
4. **Revoke the Gemini API key that was committed in `.env.example`.** It is still in git
   history. Then switch the project to the **Spark** plan (Firebase console → Usage and billing).

## 4. Email notifications: pick one gateway

Both options plug into the same setting (**Notifications → Gateway settings**). You can
switch later by pasting a different URL.

| | Option A: Power Automate (recommended for production) | Option B: Gmail via Apps Script (testing / interim) |
|---|---|---|
| Needs | A Zambia Airways Microsoft 365 work account | Any Google account |
| Sends from | An official airline mailbox, e.g. `crewcontrol@zambiaairways.co.zm` | The Gmail account that deployed the script |
| Teams chat | Yes | No |
| Daily volume | Outlook connector limits (high) | About 100 recipients a day on a personal Gmail |
| Delivery confirmed in app | Usually not (check the flow run history) | Yes |

### Option B: Gmail via Google Apps Script (about 5 minutes)

1. Go to <https://script.google.com> → **New project**. Replace the code with
   [`integrations/google-apps-script/Code.gs`](../integrations/google-apps-script/Code.gs).
2. Go to **Project Settings → Script properties** and add:
   - `SHARED_SECRET`: a long random string. You'll paste the same value into the app.
   - `ALLOWED_DOMAINS`: `zambiaairways.co.zm,gmail.com`. Recipients outside these
     domains are refused. Remove `gmail.com` once testing is over.
   - `SENDER_NAME`: `Zambia Airways Crew Control`
   - `REPLY_TO` (optional): `occ@zambiaairways.co.zm`
3. Go to **Deploy → New deployment → Web app**. Set *Execute as*: **Me** and *Who has
   access*: **Anyone**. Approve the Gmail permission prompt.
4. Copy the **Web app URL** (it ends in `/exec`).
5. In Crew Control, open **Notifications → Gateway settings**:
   - Paste the URL and the shared secret.
   - Click **Save**, then **Send test message**.

If you edit the script later, use **Deploy → Manage deployments → Edit → New version**.
This keeps the same URL.

### Option A: Power Automate flow (about 15 minutes, no premium licence)

Sign in to <https://make.powerautomate.com> with the **shared OCC mailbox account** if you
have one, so emails come from `crewcontrol@…` rather than a person.

1. **Create → Instant cloud flow → "When a Teams webhook request is received".**
   Set *Who can trigger the flow* to **Anyone**. The app authenticates with the shared
   secret below, and the flow URL itself carries a signature.
2. Add **Data Operations → Parse JSON**.
   - Content: `triggerBody()`
   - Schema:
   ```json
   {"type":"object","properties":{
     "kind":{"type":"string"},"channel":{"type":"string"},"to":{"type":"string"},
     "recipientName":{"type":"string"},"subject":{"type":"string"},
     "htmlBody":{"type":"string"},"textBody":{"type":"string"},
     "priority":{"type":"string"},"notificationId":{"type":"string"},
     "secret":{"type":"string"}}}
   ```
3. Add a **Condition** with **all** of these true:
   - `secret` *is equal to* `<a long random string you choose>`
   - `to` *ends with* `@zambiaairways.co.zm`. This means a leaked URL can never email
     outsiders.
4. **If yes:**
   - **Office 365 Outlook → Send an email (V2):**
     - To: `to`
     - Subject: `subject`
     - Body: `htmlBody`, or `textBody` if empty
     - Importance: `if(equals(body('Parse_JSON')?['priority'],'CRITICAL'),'High','Normal')`
   - Add a nested **Condition**: if `channel` *is equal to* `EMAIL_AND_TEAMS`, then run
     **Microsoft Teams → Post message in a chat or channel**:
     - Post as *Flow bot*
     - Post in *Chat with Flow bot*
     - Recipient: `to`
     - Message: `textBody`
5. **Save.** Open the trigger again and copy the **HTTP URL**.
6. In Crew Control, sign in as SUPER_ADMIN or ADMIN and go to **Notifications → Gateway
   settings**:
   - Paste the URL and the same shared secret.
   - Tick "Also send as Teams chat" if you want it.
   - Click **Save**, then **Send test message**.

   The URL is stored in Firestore `integrations/powerAutomate`. Only admins and schedulers
   can read it. Crew accounts never can.

All connectors used here (Teams webhook trigger, Parse JSON, Outlook, Teams) are
*standard* connectors included with Microsoft 365. **Do not** use the "When an HTTP request
is received" trigger. That one is **premium**.

The Office 365 Outlook connector has a daily send cap per mailbox. Check the cap for your
licence before doing very large bulk roster publications.

## 5. Hosting online before going live (staging)

There are two addresses in the same Firebase project (both free on Spark):

| Address | What it is | How it gets updated |
|---|---|---|
| **Test site**: `https://zn-crew-control-system-test.web.app` | Where you develop and test. Anyone with the link can open it. | After merging a PR: `npm run publish-test` on your PC (pulls `master`, builds, publishes). Also automatic on merge once the GitHub secret is set (`npm run github:deploy`) |
| **Main address**: `https://zn-crew-contol-system.web.app` | The real system after go-live | **Only** `npm run go-live`, or GitHub → Actions → **Go live** → type `GO LIVE` |

If the test name was taken, `npm run setup` picks another and stores it in `.firebaserc`
(targets → hosting → test).

- **Every pull request** also gets a temporary preview link (`…-test--staging-xxxx.web.app`),
  posted as a PR comment. It expires after 30 days.
- **Keep the main address offline until launch** with `npm run live:off`. `npm run go-live`
  brings it back.
- Both addresses share **one** Firestore database, **one** set of users and one set of
  security rules. Test data will still be there at go-live, so clear it first (and turn
  Test Mode off).

### One-time setup

1. In the **Firebase console** for `zn-crew-contol-system`:
   - **Build → Authentication → Get started**, then enable **Email/Password**.
   - **Build → Firestore Database → Create database**:
     - Database ID `(default)`
     - Region: e.g. `africa-south1` (Johannesburg) or `europe-west1`. **This can't be
       changed later.**
     - Start in **production mode**. Our rules replace the defaults on the first deploy.
   - **Build → Hosting → Get started**. Click through; no CLI is needed.
2. Connect GitHub to Firebase with one command, run on your PC from the project folder:
   ```
   npm run github:deploy
   ```
   You need to be signed in to the Firebase CLI (`npx firebase-tools login`) and the GitHub
   CLI (`gh auth login`; install it with `winget install --id GitHub.cli` on Windows).
   The script:
   - creates a deploy-only account, `github-deploy@<project>.iam.gserviceaccount.com`, with
     Hosting and security-rules permissions only;
   - makes a key and saves it straight into the repo secret `FIREBASE_SERVICE_ACCOUNT`. The
     key is never written to disk or shown on screen.
   Run it again any time to rotate the key; it deletes the old ones.
3. *(Manual alternative)* **Project settings → Service accounts → Generate new private key**,
   then in GitHub go to **Settings → Secrets and variables → Actions → New repository
   secret**, name it `FIREBASE_SERVICE_ACCOUNT` and paste the whole JSON file. Delete the
   file afterwards.
4. Open the pull request → **Actions** tab → **Deploy preview (staging)** → **Re-run**. You
   can also just push any commit. The staging URL appears as a PR comment.
5. Brand-new project only: create the first admin user with a downloaded JSON key (step 3):
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run create-user -- \
     --email=you@example.com --password=TempPass123! --name="Your Name" --role=SUPER_ADMIN
   ```
   Then sign in on the staging URL.

## 6. Crew logins (pilots and cabin crew)

A crew member signs in with a `FLIGHT_CREW` or `PILOT_CABIN` account. They then see only
their own crew record, leave records, acknowledgements and roster.

- **The link is the email address.** The **email on the crew record** must be the same address
  they sign in with. Emails are stored in lower case automatically.
- **Unlinked logins:** if no crew record has that email, the Crew Portal says the login isn't
  linked yet. It does not show someone else's roster.
- **In-app notifications** (the 🔔) are stored in Firestore, so they reach the crew member's
  own device. Messages to a crew member with no email on file fail and are reported as failed.

## 6b. AI assistant via Microsoft 365 Copilot Chat

Copilot Chat costs nothing extra for staff signed in with a Microsoft 365 work account, and
gives enterprise data protection: prompts and uploaded files aren't used to train models.
Crew data should therefore go there, **not** to a free consumer AI tier.

How it works:

1. In the app, the user asks a question as before.
2. The app downloads `ZN-crew-ops-snapshot-….md` and copies the question to the clipboard.
3. The user opens <https://m365copilot.com> with their work account (green shield), attaches
   the file and pastes the question.

## 7. Other free options you can add later

| Need | Free option | Notes |
|---|---|---|
| In-app AI again | Cloudflare Workers free plan as a tiny proxy to an AI API; set `VITE_AI_BACKEND_URL` | The endpoint must accept `POST {message, context}` with a Firebase ID token and return `{reply}`. |
| Reports and dashboards | Existing CSV export → **Excel for the web** (M365), or **Power BI Desktop** (free) | Sharing Power BI reports online needs a Pro licence. |
| Scheduled reminders (expiring medicals, licences) | **Power Automate scheduled flow** (Recurrence trigger, standard) that reads an Excel/SharePoint list you export to | Firestore can't be queried from Power Automate without the premium HTTP connector. |
| Crew self-service on phones | The existing **PWA**. Users install it from the browser. | Power Apps needs premium licences to talk to Firestore, so it isn't a free fit. |
| SMS | Not free anywhere at scale | Use Teams mobile push notifications instead. |
