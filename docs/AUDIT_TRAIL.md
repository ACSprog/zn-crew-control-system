# Audit Trail: ZN Crew Control & Operations

This document is for internal and external auditors. It describes how the Zambia Airways
Crew Control & Operations system keeps its audit log, and how this meets **ISO/IEC 27001:2022
Annex A controls A.8.15 (Logging), A.8.16 (Monitoring activities) and A.8.17 (Clock
synchronisation)**. It also explains how to answer common audit queries, sets out the
monthly review procedure, and lists the limitations the organisation should declare.

| | |
|---|---|
| System | Zambia Airways Crew Control & Operations (`https://zn-crew-contol-system.web.app`) |
| Platform | Google Firebase: Cloud Firestore database, Firebase Authentication, Firebase Hosting (Spark plan) |
| Log location | Firestore collection `auditLogs` (one document per entry) |
| Where to view it | **Audit Log** page in the system |
| Owner of this document | Super Admin / IT |

---

## 0. Start of recording (go-live)

The audit trail is **off while the system is being tested**, so test sign-ins and test data
don't fill the log. The Audit Log page shows an amber "Audit trail is OFF: test environment"
banner during this time.

At go-live, after test accounts and test data have been removed, a **Super Admin** clicks
**Turn on audit trail (go-live)** on the Audit Log page. This:

- saves the switch (`settings/audit`: on, the server time, the Super Admin's email);
- in the same database write, records the first entry, **"Audit trail started"** (CRITICAL);
- is **permanent**. The security rules allow the switch to be created once, and never changed or
  deleted, so nobody can pause the log afterwards. The page then shows "Recording since …".

The log therefore starts at go-live. Activity before that date was test activity and is not part
of the record. The "Audit trail started" entry is the evidence of when recording began.

---

## 1. Control mapping

| Control | Requirement (summary) | How the system meets it |
|---|---|---|
| **A.8.15 Logging** | Logs of activities, exceptions, faults and other relevant events are produced, stored, protected and analysed. | • Every relevant event is recorded (section 2): who, what, when, on which device, and whether it succeeded or failed. Data changes include before and after values.<br>• Entries cannot be edited or deleted by any user, Super Admins included. The database security rules allow entries to be added only (section 3).<br>• For crew, flights, crew assignments, leave/training, aircraft fleet, roster acknowledgements and legality rules, the database refuses a change unless its audit entry is saved in the same transaction. These changes can't skip the log.<br>• The database checks the person, role and time on every entry against the signed-in account. |
| **A.8.16 Monitoring activities** | Networks, systems and applications are monitored for anomalous behaviour, and appropriate actions taken. | • The Audit Log page filters by period, person, area and outcome, and searches every field. Failed sign-ins, wrong authenticator codes, lock-outs, refused sign-ins, user/2FA changes and deletions are easy to isolate.<br>• A documented monthly review (section 5) is recorded in the log itself as evidence ("Record review of this period"). The page warns when a review is overdue.<br>• Accounts lock after 5 wrong passwords. Two-step sign-in (TOTP) can be required for everyone. |
| **A.8.17 Clock synchronisation** | Clocks of information processing systems are synchronised to approved time sources. | • Entry times come from Google's servers (Cloud Firestore server timestamp, UTC), not from the user's device.<br>• The security rules refuse any entry whose time is not the server time of the write (`at == request.time`).<br>• Google keeps its server clocks synchronised across its data centres. Exports show UTC alongside local time, so entries from users in different timezones line up. |

---

## 2. What is recorded

### 2.1 Events

| Area | Events |
|---|---|
| **Sign-in** | Successful sign-in (password only, or password + authenticator code). Wrong email or password (with the count towards lock-out). Account locked after 5 wrong passwords. Attempt on a locked account. Wrong or expired authenticator code. Sign-in refused (account blocked, removed, no valid role, still locked). Sign-out (including automatic sign-out after inactivity or the 12-hour session limit). |
| **Crew records** | Created, updated (each changed field, before and after), deleted. |
| **Flights** | Created, updated, deleted. |
| **Crew assignments** | Created, updated (e.g. captain, first officer and cabin crew changes, shown by name and staff number), deleted. |
| **Leave & training** | Created, updated, deleted. |
| **Aircraft fleet** | Created, updated, deleted. |
| **Roster acknowledgements** | Each acknowledgement by a crew member (or by OCC on their behalf). |
| **Legality rules (FTL)** | Every change, with before and after values. |
| **User accounts** | Account created, profile/role/permission changes (before and after), blocked or unblocked, removed, password reset email sent (and unlock), 2FA started or stopped for a person, the two-person Super Admin requests (requested, withdrawn, approved, declined), own profile changes. |
| **Security settings** | 2FA required for everyone, own password changed, own 2FA set up. |
| **Notifications** | Gateway configuration changes, roster broadcasts, disruption alerts, dispatch/retry/cancel of messages. |
| **Exports & audit packs** | Every Excel export of the log (period, filters, number of entries, file name) and every audit pack produced. |
| **Log reviews** | Each monthly review: the period reviewed, the reviewer, their comment and the number of entries looked at. |

### 2.2 Fields in every entry

| Field | Meaning |
|---|---|
| `at` | **Server time** of the event (Google, UTC). Shown in local time with UTC alongside. |
| `actorName`, `actorEmail`, `actorRole`, `actorUid` | The signed-in person and their role at the time. For failed sign-ins: the email address that was tried. |
| `area`, `action`, `details` | What happened, in plain words. |
| `targetLabel`, `targetId` | The record concerned (e.g. "Jane Banda (ZN1042)", "ZN101 2026-11-14"). |
| `changedFields`, `before`, `after` | For data changes: each field that changed with its old and new value. Crew and flight references are shown as names. Long values are shortened to 500 characters. Passwords and password fingerprints are never recorded. |
| `device` | Browser, operating system and device type (e.g. "Edge 130 on Windows 10/11 (computer)"). |
| `outcome` | Succeeded or Failed. |
| `severity` | INFO, WARNING (e.g. deletions, failed sign-ins, 2FA stopped) or CRITICAL (e.g. lock-outs, 2FA required for everyone). |
| `subjects` | Which record histories the entry belongs to (e.g. a crew assignment appears in the history of the flight and of each crew member on it). |

---

## 3. Protection of the log

1. **Append-only.** The Firestore security rules allow `create` on `auditLogs` and refuse every `update` and `delete`, for every user role including Super Admin. The "Clear history" button of the earlier log has been removed. Clearing the operational database also leaves the log untouched, and each record deleted is itself logged.
2. **Authentic.** A signed-in user's entry is only accepted if its person (`actorUid`, `actorEmail`) is the signed-in account, its role is that person's current role, the person is active (not blocked or locked, 2FA used where required, session under 12 hours), and its time is the server time. Field types and sizes are checked.
3. **Complete for operational data.** Every change to crew, flights, assignments, leave, fleet, acknowledgements and legality rules is written in one database transaction (batched write) together with its audit entry. The changed record carries the id of that entry (`_auditId`). The rules check, inside the same transaction, that the entry exists, is about this record, was made now, and was made by this person. Otherwise the change is refused. A deletion must be logged under the id `<record's _auditId>-del`.
4. **Access.** Super Admins and Auditors can read the whole log. Roster managers (System Admin, OCC Controller, Scheduler, Chief Pilot) can read only the history of operational records. Flight crew cannot read the log.
5. **Retention.** Entries are kept indefinitely. Nothing in the system deletes them. On the free plan the database holds 1 GiB; an entry is typically 1–2 KB, so the log has room for several hundred thousand entries. Export each month (section 5) to keep an offline copy.

---

## 4. Answering audit queries

| The auditor asks for… | You do |
|---|---|
| **Everything about one crew member, flight or aircraft** | Audit Log page → **Record history & audit pack** → choose the type, type the name or number → **Audit pack (PDF)**. You get one document with the record's details and its full history (who changed what, when, before and after, device). For a crew member, Super Admins and Auditors also get their sign-ins and account activity. Click **Save as PDF / Print**. |
| **All activity in a period** | Audit Log → choose **From** and **To** → **Show period** → **Export to Excel**. The file has an **"About this extract"** sheet explaining how the log is kept, the period, the filters and who made the extract. |
| **What one person did** | Audit Log → period → choose the person in **Everyone** → Export to Excel. |
| **Failed or suspicious sign-ins** | Audit Log → area **Sign-in** and **Failed** → Export. |
| **Who changed user access or 2FA** | Audit Log → area **User accounts** (or **Security settings**) → Export. |
| **Changes to the legality (FTL) rules** | Audit Log → area **Legality rules** → Export. |
| **Proof that the log is reviewed** | Audit Log → area **Log reviews** (or the "Last review" line at the top). |
| **Proof the log can't be altered** | This document, section 3, and the security rules file `firestore.rules` (blocks `auditLogs`, `auditedWrite`, `auditedDelete`). |

Every Excel export and every audit pack is recorded in the log too.

**Older entries.** Entries made before this audit trail was introduced are shown when **Include older entries** is ticked, marked "Older entry". They have device time and no before/after values.

---

## 5. Monthly review procedure (A.8.16)

**Who:** a Super Admin or the Auditor. **When:** in the first week of each month, for the previous month.

1. Open **Audit Log**. Set **From/To** to the previous month and click **Show period**.
2. Check, at least:
   - **Sign-in → Failed:** repeated failures, lock-outs and wrong authenticator codes, especially on admin accounts or at unusual hours.
   - **User accounts** and **Security settings:** every new account, role change, block/unblock, removal, and 2FA stopped. Each should match an approved request.
   - **Deletions:** search "Deleted". Deletions of crew, flights or assignments should be explainable.
   - **Legality rules:** every FTL rule change should have an approval.
   - **Exports & audit packs:** who extracted log data.
3. Follow up anything unexplained with the person concerned and the Quality/Safety department. Record the outcome.
4. Click **Record review of this period**. Write what you checked and anything followed up, then click **Save review**. The review is stored as a log entry with your name, the server time and the period.
5. Click **Export to Excel** for the whole month (no filters) and file the workbook in the quality records as the offline copy.

The page shows an amber warning when no review has been recorded in the last 31 days.

---

## 6. Limitations to declare

1. **No IP addresses.** The free plan has no server of its own, so the system cannot see the network address of a request. It records the device (browser, operating system, device type) instead.
2. **User-account changes are logged by the app, not enforced by the database.** Operational data changes can't skip the log (section 3.3). Changes to user accounts (`users`) are recorded every time someone uses the system's screens, but the database does not refuse an account change whose log entry is missing. A user with an admin account who wrote to the database directly, outside the app, could change an account without an entry. The account change itself is still subject to the access rules (e.g. Super Admin changes need a second Super Admin).
3. **Before/after values are supplied by the app.** The database guarantees the person, role, time and record of every entry, and that one exists for each data change. The field values in "before" and "after" are calculated by the app. Someone who bypassed the app with their own valid account could write misleading values for a change they themselves made, but not hide that they made it.
4. **Failed sign-in entries can be written without an account.** Wrong passwords and codes happen before sign-in, so the rules accept these few entry types (failure only, no role, no data) from anyone. The email in such an entry is the one that was typed, not a verified identity, and the entries could in theory be added in bulk by someone abusing the public sign-in path.
5. **The Google Cloud project owner is outside the rules.** Security rules bind every app user. They don't bind the Google account that owns the Firebase project, or server keys (service accounts). Those could delete entries, or the go-live switch, through the Google Cloud console or the Admin SDK. Control: keep project ownership to named IT staff with 2-step verification on their Google accounts, keep service-account keys out of circulation, and review Google Cloud's own audit logs (Cloud Audit Logs → Admin Activity) for the project.
6. **Recording starts at go-live.** Nothing is recorded while the switch is off (testing). The switch can only be turned on, once, so the log can't be paused afterwards.
7. **Free-plan limits.** One extract loads at most 5,000 entries; choose shorter periods for busy months. The log has no automatic archiving: the monthly Excel export is the offline copy. If the free daily database quota runs out, the system pauses until the next day. During that time no changes, and so no entries, can be made.

---

## 7. Testing the controls (first live test)

At go-live (after turning the audit trail on, section 0), and after each deployment of new
security rules, a Super Admin should confirm:

0. The Audit Log shows "Recording since …" and an "Audit trail started" entry.
1. Edit a crew member's base. **Audit Log → Show period**: an "Updated crew record" entry shows base before → after, your name, role, device and a server time.
2. **Record history → Crew member → that person → Audit pack (PDF)**: the change appears. The pack opens ready to save as PDF.
3. Sign out. Sign in with a wrong password, then correctly. Both appear (Failed / OK).
4. **Export to Excel** opens in Excel with the sheets "About this extract" and "Audit log". The export appears in the log.
5. **Record review of this period** with a comment. It appears under Log reviews and in the "Last review" line.
6. Sign in as a Scheduler: the Audit Log page shows **Record history** only.
