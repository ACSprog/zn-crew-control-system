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
2. Deploy the rules and site to the `(default)` database: `npm run deploy`.
3. Delete the Cloud Run service `za-crew-api` (Cloud Console → Cloud Run). Delete the named
   Firestore database.
4. **Revoke the Gemini API key that was committed in `.env.example`.** It is still in git
   history. Then switch the project to the **Spark** plan (Firebase console → Usage and billing).

## 4. Build the Power Automate notification flow (about 15 minutes, no premium licence)

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

## 5. AI assistant via Microsoft 365 Copilot Chat

Copilot Chat costs nothing extra for staff signed in with a Microsoft 365 work account, and
gives enterprise data protection: prompts and uploaded files aren't used to train models.
Crew data should therefore go there, **not** to a free consumer AI tier.

How it works:

1. In the app, the user asks a question as before.
2. The app downloads `ZN-crew-ops-snapshot-….md` and copies the question to the clipboard.
3. The user opens <https://m365copilot.com> with their work account (green shield), attaches
   the file and pastes the question.

## 6. Other free options you can add later

| Need | Free option | Notes |
|---|---|---|
| In-app AI again | Cloudflare Workers free plan as a tiny proxy to an AI API; set `VITE_AI_BACKEND_URL` | The endpoint must accept `POST {message, context}` with a Firebase ID token and return `{reply}`. |
| Reports and dashboards | Existing CSV export → **Excel for the web** (M365), or **Power BI Desktop** (free) | Sharing Power BI reports online needs a Pro licence. |
| Scheduled reminders (expiring medicals, licences) | **Power Automate scheduled flow** (Recurrence trigger, standard) that reads an Excel/SharePoint list you export to | Firestore can't be queried from Power Automate without the premium HTTP connector. |
| Crew self-service on phones | The existing **PWA**. Users install it from the browser. | Power Apps needs premium licences to talk to Firestore, so it isn't a free fit. |
| SMS | Not free anywhere at scale | Use Teams mobile push notifications instead. |
