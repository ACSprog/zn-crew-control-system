/**
 * Audit Log → Excel (.xlsx) with an "About this extract" sheet, and the
 * printable audit pack for one record. Every export is itself logged.
 */
import { AREA_LABELS, fmtDateTime, logAudit, toRow, type AnyAuditEntry, type AuditEntry, type AuditRow } from './auditTrail';

export interface ExtractInfo {
  from: Date;
  to: Date; // exclusive
  filters: string[];
  madeBy: string;
  totalLoaded: number;
  capped: boolean;
  includesLegacy: boolean;
}

const SYSTEM_NAME = 'Zambia Airways Crew Control & Operations';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The text of the "About this extract" sheet (also used in docs/tests). */
export function aboutExtractLines(info: ExtractInfo, rowCount: number, generatedAt: Date): Array<[string, string]> {
  const lastDay = new Date(info.to.getTime() - 1);
  return [
    ['System', SYSTEM_NAME],
    ['What this is', 'An extract of the system audit log (ISO/IEC 27001:2022 controls A.8.15 Logging, A.8.16 Monitoring activities, A.8.17 Clock synchronisation).'],
    ['Extract made by', info.madeBy],
    ['Extract made at', `${fmtDateTime(generatedAt)} (${generatedAt.toISOString()})`],
    ['Period', `${isoDay(info.from)} to ${isoDay(lastDay)} inclusive (times shown in the timezone of the computer that made the extract; UTC in its own column)`],
    ['Filters applied', info.filters.length ? info.filters.join('; ') : 'None: every entry in the period'],
    ['Entries in this extract', String(rowCount)],
    ...(info.capped
      ? ([['WARNING', `The period holds more entries than one extract can load (${info.totalLoaded}). Choose a shorter period to get every entry.`]] as Array<[string, string]>)
      : []),
    ['How entries are made', 'Each entry is written by the system when the action happens. Changes to crew, flights, assignments, leave, fleet, roster acknowledgements and legality rules are saved in the same database transaction as their audit entry: the database refuses the change if its entry is missing, so these changes cannot skip the log.'],
    ['What is recorded', 'Who (name, email, role), what (area, action, record, changed fields with before and after values), when, the device (browser and operating system), and whether it succeeded or failed. Sign-ins, wrong passwords, wrong authenticator codes, lock-outs, user and 2FA changes, log reviews and exports are recorded too.'],
    ['Time source (A.8.17)', "Times come from Google's servers (Cloud Firestore server time, UTC), not from the user's device. The database refuses an entry whose time is not the server time of the write."],
    ['Protection (A.8.15)', 'Nobody can edit or delete an entry, including Super Admins: the database security rules allow adding entries only. The person, role and time in each entry are checked by the database against the signed-in account.'],
    ['Who can read the log', 'Super Admins and Auditors: the whole log. Roster managers (System Admin, OCC Controller, Scheduler, Chief Pilot): the history of operational records only.'],
    ['Older entries', info.includesLegacy ? 'Included. Entries marked "Older entry" were made before this audit trail (device time, no before/after values) and are shown for completeness.' : 'Not included (entries made before the current audit trail).'],
    ['Known limitations', 'No IP addresses (the free plan has no server; the device is recorded instead). Changes to user accounts are recorded by the app but are not refused by the database if a log write fails. Before/after values are captured by the app, the person/time/role by the database. See docs/AUDIT_TRAIL.md.'],
    ['Reference', 'docs/AUDIT_TRAIL.md in the system repository: control mapping, review procedure and limitations.'],
  ];
}

export const EXCEL_COLUMNS: Array<{ header: string; key: keyof AuditRow | 'utc' | 'clock'; width: number }> = [
  { header: 'Time', key: 'time', width: 24 },
  { header: 'Time (UTC)', key: 'utc', width: 24 },
  { header: 'Person', key: 'person', width: 24 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Role', key: 'role', width: 16 },
  { header: 'Area', key: 'area', width: 20 },
  { header: 'Action', key: 'action', width: 28 },
  { header: 'Record', key: 'target', width: 30 },
  { header: 'Changes (before → after)', key: 'changes', width: 60 },
  { header: 'Details', key: 'details', width: 50 },
  { header: 'Device', key: 'device', width: 30 },
  { header: 'Outcome', key: 'outcome', width: 11 },
  { header: 'Severity', key: 'severity', width: 10 },
  { header: 'Clock', key: 'clock', width: 12 },
  { header: 'Entry ID', key: 'id', width: 30 },
];

export function excelRowValues(r: AuditRow): Record<string, string> {
  return {
    time: fmtDateTime(r.time),
    utc: r.time.toISOString(),
    person: r.person,
    email: r.email,
    role: r.role,
    area: r.area,
    action: r.action,
    target: r.target,
    changes: r.changes,
    details: r.details,
    device: r.device,
    outcome: r.outcome,
    severity: r.severity,
    clock: r.legacy ? 'Device' : r.serverTime ? 'Server' : 'Pending',
    id: r.id,
  };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Builds and downloads the .xlsx; logs the export. */
export async function exportAuditToExcel(entries: AnyAuditEntry[], info: ExtractInfo): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const generatedAt = new Date();
  const rows = entries.map(toRow);
  const wb = new ExcelJS.Workbook();
  wb.creator = info.madeBy;
  wb.created = generatedAt;

  const about = wb.addWorksheet('About this extract');
  about.columns = [
    { header: 'Item', key: 'k', width: 26 },
    { header: 'Description', key: 'v', width: 110 },
  ];
  for (const [k, v] of aboutExtractLines(info, rows.length, generatedAt)) about.addRow({ k, v });
  about.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  about.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E2C2B' } };
  about.eachRow((row, i) => {
    if (i > 1) {
      row.getCell(1).font = { bold: true };
      row.alignment = { wrapText: true, vertical: 'top' };
    }
  });

  const sheet = wb.addWorksheet('Audit log', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = EXCEL_COLUMNS.map((c) => ({ header: c.header, key: c.key as string, width: c.width }));
  for (const r of rows) sheet.addRow(excelRowValues(r));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF37C1C' } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXCEL_COLUMNS.length } };
  sheet.eachRow((row, i) => {
    if (i > 1) row.alignment = { wrapText: true, vertical: 'top' };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const lastDay = new Date(info.to.getTime() - 1);
  const filename = `ZN-Crew-Control-audit-log_${isoDay(info.from)}_to_${isoDay(lastDay)}.xlsx`;
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);

  await logAudit({
    area: 'exports',
    action: 'Exported audit log to Excel',
    details: `${rows.length} entries, ${isoDay(info.from)} to ${isoDay(lastDay)}${info.filters.length ? `; filters: ${info.filters.join('; ')}` : ''}. File: ${filename}`,
    periodFrom: isoDay(info.from),
    periodTo: isoDay(lastDay),
  });
}

// ---------------------------------------------------------------------------
// Audit pack (printable, "Save as PDF")
// ---------------------------------------------------------------------------

export interface PackSubject {
  /** e.g. 'crew:C001' */
  key: string;
  kind: 'Crew member' | 'Flight' | 'Aircraft';
  title: string;
  facts: Array<[string, string]>;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function changesHtml(e: AuditEntry): string {
  if (!e.changedFields?.length) return '';
  return `<table class="chg"><tr><th>Field</th><th>Before</th><th>After</th></tr>${e.changedFields
    .map(
      (f) =>
        `<tr><td>${esc(f)}</td><td>${f in (e.before || {}) ? esc(e.before[f] ?? '(empty)') : '—'}</td><td>${
          f in (e.after || {}) ? esc(e.after[f] ?? '(empty)') : '(removed)'
        }</td></tr>`
    )
    .join('')}</table>`;
}

function entriesTable(entries: AuditEntry[]): string {
  if (!entries.length) return '<p class="muted">No entries.</p>';
  return `<table class="log"><thead><tr><th>Time</th><th>Person</th><th>Action</th><th>What changed</th><th>Device</th><th>Outcome</th></tr></thead><tbody>${entries
    .map((e) => {
      const r = toRow(e);
      return `<tr><td class="nowrap">${esc(fmtDateTime(r.time))}<div class="muted">${esc(r.time.toISOString())}</div></td><td>${esc(r.person)}<div class="muted">${esc(
        r.role
      )}${r.email && r.email !== r.person ? ` · ${esc(r.email)}` : ''}</div></td><td><b>${esc(r.action)}</b><div class="muted">${esc(AREA_LABELS[e.area] || e.area)}${
        r.target ? ` · ${esc(r.target)}` : ''
      }</div>${e.details ? `<div>${esc(e.details)}</div>` : ''}</td><td>${changesHtml(e)}</td><td>${esc(r.device)}</td><td class="${
        e.outcome === 'failure' ? 'fail' : ''
      }">${esc(r.outcome)}</td></tr>`;
    })
    .join('')}</tbody></table>`;
}

export function auditPackHtml(subject: PackSubject, history: AuditEntry[], accountEvents: AuditEntry[] | null, madeBy: string, at: Date): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit pack – ${esc(subject.title)}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#1e1e1e;margin:28px;font-size:12px}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #F37C1C;padding-bottom:4px}
  .brand{color:#F37C1C;font-weight:700;letter-spacing:.08em;font-size:11px;text-transform:uppercase}
  .facts{border-collapse:collapse;margin-top:8px} .facts td{padding:3px 12px 3px 0;vertical-align:top} .facts td:first-child{color:#666;font-weight:600}
  table.log{border-collapse:collapse;width:100%} table.log th{background:#2E2C2B;color:#fff;text-align:left;padding:6px;font-size:11px}
  table.log td{border-bottom:1px solid #ddd;padding:6px;vertical-align:top}
  table.chg{border-collapse:collapse;font-size:11px} table.chg th,table.chg td{border:1px solid #ddd;padding:2px 5px;text-align:left}
  .muted{color:#777;font-size:10.5px} .nowrap{white-space:nowrap} .fail{color:#b91c1c;font-weight:700}
  .note{background:#FFF7ED;border:1px solid #FDBA74;padding:8px 10px;border-radius:6px;margin-top:14px}
  .bar{position:sticky;top:0;background:#fff;padding:8px 0;border-bottom:1px solid #eee;margin-bottom:12px}
  button{background:#F37C1C;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-weight:700;cursor:pointer}
  @media print{.bar{display:none} body{margin:12mm}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Save as PDF / Print</button></div>
<div class="brand">${esc(SYSTEM_NAME)} · Audit pack</div>
<h1>${esc(subject.kind)}: ${esc(subject.title)}</h1>
<table class="facts">${subject.facts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
<tr><td>Prepared by</td><td>${esc(madeBy)}</td></tr>
<tr><td>Prepared at</td><td>${esc(fmtDateTime(at))} (${esc(at.toISOString())})</td></tr>
<tr><td>History entries</td><td>${history.length}</td></tr></table>
<h2>Full history of this record</h2>
${entriesTable(history)}
${accountEvents ? `<h2>Sign-ins and account activity (${accountEvents.length})</h2>${entriesTable(accountEvents)}` : ''}
<div class="note"><b>About this pack.</b> Entries come from the system audit log (ISO/IEC 27001:2022 A.8.15–A.8.17). Times are Google server times, shown in this computer's timezone with UTC beneath. Entries cannot be edited or deleted by anyone. Changes to this record are saved together with their audit entry, so none can be missing. This pack's creation is itself recorded in the log.</div>
</body></html>`;
}

/**
 * Opens the pack in a new tab (opened straight away so pop-up blockers allow
 * it), fills it once loaded, and logs that it was produced.
 */
export async function openAuditPack(
  subject: PackSubject,
  load: () => Promise<{ history: AuditEntry[]; accountEvents: AuditEntry[] | null }>,
  madeBy: string
): Promise<void> {
  const w = window.open('', '_blank');
  if (w) w.document.write('<p style="font-family:Arial;padding:24px">Preparing the audit pack…</p>');
  try {
    const { history, accountEvents } = await load();
    const html = auditPackHtml(subject, history, accountEvents, madeBy, new Date());
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      download(new Blob([html], { type: 'text/html' }), `Audit-pack_${subject.title.replace(/[^\w.-]+/g, '_')}.html`);
    }
    await logAudit({
      area: 'exports',
      action: 'Produced audit pack',
      details: `${subject.kind} ${subject.title}: ${history.length} history entries${accountEvents ? `, ${accountEvents.length} account entries` : ''}.`,
      targetId: subject.key,
      targetLabel: subject.title,
    });
  } catch (e) {
    if (w) w.document.body.innerHTML = `<p style="font-family:Arial;padding:24px;color:#b91c1c">Could not load the audit history: ${esc((e as Error)?.message || e)}</p>`;
    throw e;
  }
}
