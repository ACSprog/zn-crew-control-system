# Go-live readiness

Status of every part of the Crew Control system, checked on 26 November 2026. The checks
were: a code review of all 21 screens; each screen rendered in a browser with sample data as
Super Admin, Scheduler, Auditor and flight crew; and automated tests of saving, the audit trail
and notifications. Going live itself: [GO_LIVE.md](GO_LIVE.md).

## Screens

| Area | Status |
|---|---|
| Sign-in, lock-out after 5 attempts, password change, 15-min auto-lock, 12-h session | Works |
| Two-step sign-in (authenticator app) | Works where Identity Platform is enabled; may need billing on the live project ([GO_LIVE.md §5](GO_LIVE.md)) |
| User Access (create, edit, block, remove, reset, 2FA per user, two-person rule for Super Admins) | Works |
| Dashboard, Crew Hours, Fatigue, Legality conflicts, Recency, Line checks, Documents | Work. Figures are calculated from the crew, flight and roster data; no built-in numbers. |
| Crew database, Flights, Fleet, Leave & training | Work (import by CSV or by hand) |
| Auto-scheduler, Roster calendar, publishing, crew acknowledgements | Work |
| Reports (CSV export, print) | Work |
| Audit Log (ISO 27001 A.8.15–A.8.17) | Works; **live system only**, nothing recorded in test ([AUDIT_TRAIL.md](AUDIT_TRAIL.md)) |
| Notifications: email (Outlook via Power Automate) and in-app | Work once the Power Automate flow URL is entered (Notifications → Gateway). In-app works without it. |
| AI assistant | Hands the question to Microsoft 365 Copilot Chat (free); no built-in AI |
| Mobile app (install to home screen) | Works (PWA) |

## Fixed in this review

**Saving**
- A change the database refuses (no permission, expired session) used to look saved and was
  then quietly lost. Now a message says it wasn't saved, and the screen shows the saved data
  again.
- Read-only roles (Auditor, flight crew) get a clear "read-only" message instead of making
  changes that are lost. Fleet, legality rules and backup restore are for Admins only, matching
  the database rules. **Manage Fleet** is now shown to Admins only.

**Invented and sample data**
- Forms no longer fill in made-up values:
  - a random staff number for new users;
  - a random flight number for new flights;
  - a made-up employee ID and guessed email for crew added by hand;
  - a fixed date (16 Aug 2026 08:00) for flights added by hand.
- Removed **Load Commercial Schedule (Apr–Oct)**. One click loaded a built-in timetable for a
  season that's already over.
- Removed a made-up fallback phone number used when a crew member had none.

**Notifications**
- **Compose broadcast** now actually sends. It used to only queue messages on that computer
  until someone pressed Process Queue there. It also starts blank (it had a pre-filled demo
  advisory) and asks for confirmation.
- **Disruption Alert** rebuilt. It used to send a fixed "AOG" message about the first flight in
  the list to the first three crew in the database. Now you choose the flight, the kind of
  disruption and the reason, and it goes only to the crew assigned to that flight.
- **Resend Roster Notices** covers only published duties from today onward. It used to cover
  every assignment, including drafts and past flights.
- New automatic notifications:
  - **flight change**: a published flight changes date, time, route, aircraft or status → its
    crew are told;
  - **leave update**: leave or training added or cancelled → that crew member is told.
- Send results say how many emails were **not** sent and why. Failed emails don't produce
  duplicate in-app messages.
- Notification switches, email templates and crew channel preferences are shared by all
  computers. They used to be saved on one computer only.

**Go-live preparation** (also in the earlier pull request)
- Removed the TEST label, the demo notification history and the "restore demo data" buttons.
- **Clear all data** is available in the test environment only.

## Not available in the free build

| Feature | Why | What to do instead |
|---|---|---|
| Training-expiry warnings and duty reminders by message | They need a server that runs on a schedule. The free plan has none. | The Documents, Recency and Line-check screens show what is due. A Power Automate scheduled flow could be added later. |
| WhatsApp | The WhatsApp Business API is paid | Email + in-app |
| IP addresses in the audit log | No server | The device is recorded ([AUDIT_TRAIL.md §6](AUDIT_TRAIL.md)) |

## Known limitations

- **Process Queue / Active Queue** lists messages handled on that computer. The shared record of
  every message is the **Notification Logs** tab.
- The Header question is still open: Save Data (not needed: everything saves automatically),
  the auto-lock countdown label, and where the Mobile App button goes.
- The security rules compile and deploy, but some role combinations have only been tested in
  code. Run the role checks below on the test site before go-live.

## Checks to run on the test site before go-live

1. As an **Auditor**, try to add a flight: you should see "read-only" and nothing changes.
2. As a **Scheduler**, edit a flight's departure time on a published roster: the crew on it get
   the change (in-app; also email once the gateway is set).
3. As a **Scheduler**, Settings (legality rules, fleet) should not open: it is for Super Admins.
4. Send a **Disruption Alert** for a flight with crew: only that flight's crew receive it.
5. **Compose** a broadcast to one crew member: it arrives without pressing Process Queue.
6. Enter the Power Automate flow URL, then send yourself a test: the email arrives.
7. As **flight crew**: see own roster, acknowledge it, and confirm you can't see others' records.
