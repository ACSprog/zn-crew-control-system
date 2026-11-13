import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  History,
  Loader2,
  Lock,
  Power,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { AircraftFleet, CrewMember, Flight } from '../types';
import {
  AREA_LABELS,
  fmtDateTime,
  isV3,
  loadAuditPeriod,
  loadPersonEvents,
  loadRecordHistory,
  loadReviews,
  logAudit,
  startAuditTrail,
  subscribeAuditSwitch,
  toRow,
  type AuditSwitch,
  MAX_PERIOD_ENTRIES,
  type AnyAuditEntry,
  type AuditArea,
  type AuditEntry,
} from '../utils/auditTrail';
import { exportAuditToExcel, openAuditPack, type PackSubject } from '../utils/auditExport';

interface AuditLogViewProps {
  currentUser: { name: string; email?: string; role: string };
  crew: CrewMember[];
  flights: Flight[];
  fleet: AircraftFleet[];
}

/** Matches firestore.rules: who sees the whole log, who sees record history. */
export function auditAccess(role: string): 'full' | 'history' | 'none' {
  if (role === 'SUPER_ADMIN' || role === 'AUDITOR') return 'full';
  if (['ADMIN', 'OCC_CONTROLLER', 'SCHEDULER', 'CHIEF_PILOT'].includes(role)) return 'history';
  return 'none';
}

const dayInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const REVIEW_INTERVAL_DAYS = 31;

function Outcome({ e }: { e: AnyAuditEntry }) {
  if (!isV3(e)) return <span className="text-[10px] text-slate-400 font-mono">older entry</span>;
  return e.outcome === 'failure' ? (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-red-100 text-red-800">Failed</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-emerald-100 text-emerald-800">OK</span>
  );
}

function ChangesTable({ e }: { e: AuditEntry }) {
  if (!e.changedFields?.length) return <p className="text-slate-400 text-[11px]">No field values recorded for this action.</p>;
  return (
    <table className="text-[11px] border-collapse">
      <thead>
        <tr className="text-slate-500">
          <th className="text-left pr-4 pb-1">Field</th>
          <th className="text-left pr-4 pb-1">Before</th>
          <th className="text-left pb-1">After</th>
        </tr>
      </thead>
      <tbody>
        {e.changedFields.map((f) => (
          <tr key={f} className="align-top">
            <td className="pr-4 font-mono font-bold text-slate-700">{f}</td>
            <td className="pr-4 text-red-700 break-all max-w-xs">{f in (e.before || {}) ? String(e.before[f] ?? '(empty)') : '—'}</td>
            <td className="text-emerald-700 break-all max-w-xs">{f in (e.after || {}) ? String(e.after[f] ?? '(empty)') : '(removed)'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EntryRows({ entries, emptyText }: { entries: AnyAuditEntry[]; emptyText: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200 font-mono text-[10px]">
          <tr>
            <th className="p-3 w-6" />
            <th className="p-3">Time</th>
            <th className="p-3">Person</th>
            <th className="p-3">Action</th>
            <th className="p-3">Record</th>
            <th className="p-3">Device</th>
            <th className="p-3">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-400 font-mono text-xs">
                {emptyText}
              </td>
            </tr>
          ) : (
            entries.map((e) => {
              const r = toRow(e);
              const isOpen = open === e.id;
              return (
                <React.Fragment key={e.id}>
                  <tr className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setOpen(isOpen ? null : e.id)}>
                    <td className="p-3 text-slate-400">{isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap" title={r.time.toISOString()}>
                      {fmtDateTime(r.time)}
                      {!r.legacy && !r.serverTime && <span className="ml-1 text-amber-600">(saving)</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{r.person}</div>
                      {r.role && <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-100 px-1.5 py-0.5 rounded">{r.role}</span>}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-[#2E2C2B]">{r.action}</div>
                      <div className="text-[10px] text-slate-500">{r.area}</div>
                    </td>
                    <td className="p-3 text-slate-600 max-w-xs">{r.target}</td>
                    <td className="p-3 text-slate-500 text-[11px] max-w-[14rem]">{r.device}</td>
                    <td className="p-3 whitespace-nowrap">
                      <Outcome e={e} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/60">
                      <td />
                      <td colSpan={6} className="p-3 space-y-2">
                        {r.details && <p className="text-[11px] text-slate-700">{r.details}</p>}
                        {isV3(e) ? <ChangesTable e={e} /> : r.changes && <p className="text-[11px]">{r.changes}</p>}
                        <p className="text-[10px] text-slate-400 font-mono">
                          Entry {e.id}
                          {r.email && ` · ${r.email}`} · UTC {r.time.toISOString()} · clock: {r.legacy ? 'device (older entry)' : 'Google server'}
                        </p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUser, crew, flights, fleet }) => {
  const access = auditAccess(currentUser.role);
  const [auditSwitch, setAuditSwitch] = useState<AuditSwitch>({ loaded: false, enabled: false, enabledAt: null, enabledBy: '' });
  useEffect(() => subscribeAuditSwitch(setAuditSwitch), []);
  const [starting, setStarting] = useState(false);
  const madeBy = `${currentUser.name}${currentUser.email ? ` <${currentUser.email}>` : ''} (${currentUser.role})`;

  // ---- Period log (full readers) ----
  const [fromDay, setFromDay] = useState(dayInput(startOfMonth()));
  const [toDay, setToDay] = useState(dayInput(new Date()));
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [entries, setEntries] = useState<AnyAuditEntry[]>([]);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadedPeriod, setLoadedPeriod] = useState<{ from: Date; to: Date } | null>(null);

  const [person, setPerson] = useState('ALL');
  const [area, setArea] = useState<'ALL' | AuditArea | 'legacy'>('ALL');
  const [outcome, setOutcome] = useState<'ALL' | 'success' | 'failure'>('ALL');
  const [search, setSearch] = useState('');

  const [reviews, setReviews] = useState<AuditEntry[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  const periodRange = () => {
    const from = new Date(`${fromDay}T00:00:00`);
    const to = new Date(`${toDay}T00:00:00`);
    to.setDate(to.getDate() + 1);
    return { from, to };
  };

  const loadPeriod = async () => {
    const { from, to } = periodRange();
    if (!(from < to)) {
      setError('The "to" date must be on or after the "from" date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loadAuditPeriod(from, to, includeLegacy);
      setEntries(res.entries);
      setCapped(res.capped);
      setLoadedPeriod({ from, to });
    } catch (e) {
      setError(`Could not load the log: ${(e as Error)?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshReviews = () => loadReviews().then(setReviews).catch(() => setReviews([]));

  useEffect(() => {
    if (access !== 'full') return;
    loadPeriod();
    refreshReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  const people = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries) {
      const r = toRow(e);
      const key = r.email || r.person;
      if (key) m.set(key, r.email ? `${r.person} <${r.email}>` : r.person);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const r = toRow(e);
      if (person !== 'ALL' && (r.email || r.person) !== person) return false;
      if (area === 'legacy' ? !r.legacy : area !== 'ALL' && (!isV3(e) || e.area !== area)) return false;
      if (outcome !== 'ALL' && (!isV3(e) || e.outcome !== outcome)) return false;
      if (!q) return true;
      return Object.values(r)
        .concat(isV3(e) ? [JSON.stringify(e.before), JSON.stringify(e.after)] : [])
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [entries, person, area, outcome, search]);

  const activeFilters = () =>
    [
      person !== 'ALL' && `person = ${people.find(([k]) => k === person)?.[1] || person}`,
      area !== 'ALL' && `area = ${area === 'legacy' ? 'Older entries' : AREA_LABELS[area]}`,
      outcome !== 'ALL' && `outcome = ${outcome === 'failure' ? 'Failed' : 'Succeeded'}`,
      search.trim() && `search = "${search.trim()}"`,
    ].filter(Boolean) as string[];

  const doExport = async () => {
    if (!loadedPeriod) return;
    setBusy('export');
    setNotice('');
    try {
      await exportAuditToExcel(filtered, {
        ...loadedPeriod,
        filters: activeFilters(),
        madeBy,
        totalLoaded: entries.length,
        capped,
        includesLegacy: includeLegacy,
      });
      setNotice(`Exported ${filtered.length} entries to Excel. The export is recorded in the log.`);
    } catch (e) {
      setError(`Export failed: ${(e as Error)?.message || e}`);
    } finally {
      setBusy('');
    }
  };

  const saveReview = async () => {
    if (!loadedPeriod) return;
    const lastDay = new Date(loadedPeriod.to.getTime() - 1);
    setBusy('review');
    const id = await logAudit({
      area: 'audit-review',
      action: 'Reviewed audit log',
      details: `${reviewComment.trim() || 'No comment.'} (${filtered.length} entries looked at${activeFilters().length ? `; filters: ${activeFilters().join('; ')}` : ''})`,
      periodFrom: dayInput(loadedPeriod.from),
      periodTo: dayInput(lastDay),
    });
    setBusy('');
    if (!id) {
      setError('The review could not be recorded. Check your connection and that you are still signed in.');
      return;
    }
    setReviewOpen(false);
    setReviewComment('');
    setNotice('Review recorded in the audit log.');
    refreshReviews();
  };

  const lastReview = reviews[0];
  const lastReviewMs = lastReview?.at?.toMillis() || 0;
  const reviewOverdue = !lastReview || Date.now() - lastReviewMs > REVIEW_INTERVAL_DAYS * 86400000;

  // ---- Record history & audit pack (full readers + roster managers) ----
  const [kind, setKind] = useState<'crew' | 'flight' | 'aircraft'>('crew');
  const [recordText, setRecordText] = useState('');
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [historyFor, setHistoryFor] = useState<PackSubject | null>(null);

  const options = useMemo(() => {
    if (kind === 'crew')
      return crew.map((c) => ({
        label: `${c.name} (${c.staffNumber})`,
        subject: {
          key: `crew:${c.id}`,
          kind: 'Crew member' as const,
          title: `${c.name} (${c.staffNumber})`,
          facts: [
            ['Staff number', c.staffNumber],
            ['Email', c.email || ''],
            ['Role / base', [String(c.role || ''), c.base].filter(Boolean).join(' · ')],
            ['Status', String(c.status || '')],
            ['Record ID', c.id],
          ].filter(([, v]) => v) as Array<[string, string]>,
          email: c.email || '',
        },
      }));
    if (kind === 'flight')
      return flights.map((f) => ({
        label: `${f.flightNumber} ${f.date} ${f.departure}–${f.arrival}`,
        subject: {
          key: `flight:${f.id}`,
          kind: 'Flight' as const,
          title: `${f.flightNumber} ${f.date}`,
          facts: [
            ['Route', `${f.departure}–${f.arrival}`],
            ['Aircraft', f.registration],
            ['Status', String(f.status || '')],
            ['Record ID', f.id],
          ] as Array<[string, string]>,
          email: '',
        },
      }));
    return fleet.map((a) => ({
      label: `${a.registration} ${String(a.aircraft || '')}`.trim(),
      subject: {
        key: `aircraft:${a.registration}`,
        kind: 'Aircraft' as const,
        title: a.registration,
        facts: [
          ['Type', String(a.aircraft || '')],
          ['Status', String(a.status || '')],
        ].filter(([, v]) => v) as Array<[string, string]>,
        email: '',
      },
    }));
  }, [kind, crew, flights, fleet]);

  const chosen = options.find((o) => o.label === recordText);

  const showHistory = async () => {
    if (!chosen) return;
    setBusy('history');
    setError('');
    try {
      setHistory(await loadRecordHistory(chosen.subject.key));
      setHistoryFor(chosen.subject);
    } catch (e) {
      setError(`Could not load the history: ${(e as Error)?.message || e}`);
    } finally {
      setBusy('');
    }
  };

  const makePack = async () => {
    if (!chosen) return;
    const { email, ...subject } = chosen.subject;
    setBusy('pack');
    setError('');
    try {
      await openAuditPack(
        subject,
        async () => ({
          history: await loadRecordHistory(subject.key),
          accountEvents: access === 'full' && email ? await loadPersonEvents(email) : null,
        }),
        madeBy
      );
      setNotice(`Audit pack for ${subject.title} opened in a new tab. Use "Save as PDF". It is recorded in the log.`);
    } catch (e) {
      setError(`Could not make the audit pack: ${(e as Error)?.message || e}`);
    } finally {
      setBusy('');
    }
  };

  const turnOn = async () => {
    const ok = window.confirm(
      'Turn on the audit trail for go-live?\n\nFrom now on every sign-in, change, user change and export is recorded permanently.\nIt can NOT be turned off again.\n\nDo this when testing is finished (test accounts and test data removed).'
    );
    if (!ok) return;
    setStarting(true);
    setError('');
    try {
      await startAuditTrail();
      setNotice('The audit trail is on. Every action is now recorded.');
      setTimeout(() => {
        setToDay(dayInput(new Date()));
        loadPeriod();
      }, 1500);
    } catch (e) {
      setError(`Could not turn on the audit trail: ${(e as Error)?.message || e}`);
    } finally {
      setStarting(false);
    }
  };

  if (access === 'none') {
    return (
      <div className="p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
          The audit log is available to Super Admins, Auditors and roster managers.
        </div>
      </div>
    );
  }

  const btn = 'px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed';
  const input = 'px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#F37C1C]';

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">ISO/IEC 27001:2022 · A.8.15 – A.8.17</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-mono">Audit Log</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Every sign-in, data change, user change and export, with the person, their role, Google server time, before and after values, the device and
            the outcome. Entries can't be edited or deleted by anyone{access === 'history' ? '. You can see the history of crew, flight and aircraft records' : ''}.
          </p>
        </div>
        {access === 'full' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setReviewOpen(true)}
              disabled={!loadedPeriod || loading}
              className={`${btn} bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30`}
            >
              <CalendarCheck className="w-4 h-4" /> Record review of this period
            </button>
            <button onClick={doExport} disabled={!loadedPeriod || loading || busy === 'export'} className={`${btn} bg-[#F37C1C] hover:bg-[#D96B12] text-white`}>
              {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export to Excel
            </button>
          </div>
        )}
      </div>

      {auditSwitch.loaded && !auditSwitch.enabled && (
        <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-xs space-y-1">
            <p className="font-extrabold text-sm flex items-center gap-2">
              <Power className="w-4 h-4" /> Audit trail is OFF: test environment
            </p>
            <p>
              Nothing is being recorded, so testing doesn't fill the audit log. At go-live, after test accounts and test data are removed,
              {currentUser.role === 'SUPER_ADMIN' ? ' turn it on here.' : ' a Super Admin turns it on here.'} Once on, it can't be turned off.
            </p>
          </div>
          {currentUser.role === 'SUPER_ADMIN' && (
            <button onClick={turnOn} disabled={starting} className={`${btn} bg-amber-600 hover:bg-amber-700 text-white shrink-0`}>
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />} Turn on audit trail (go-live)
            </button>
          )}
        </div>
      )}

      {auditSwitch.enabled && (
        <p className="text-[11px] text-emerald-700 flex items-center gap-1.5 -mt-3">
          <Lock className="w-3 h-3" /> Recording since {auditSwitch.enabledAt ? fmtDateTime(auditSwitch.enabledAt) : 'go-live'}
          {auditSwitch.enabledBy && ` (turned on by ${auditSwitch.enabledBy})`}. It can't be turned off.
        </p>
      )}

      {error && (
        <div className="p-3 rounded-xl border bg-red-50 border-red-300 text-red-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-300 text-emerald-900 text-xs">{notice}</div>}

      {access === 'full' && (
        <>
          {/* Review status */}
          {auditSwitch.enabled && <div
            className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              reviewOverdue ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 shrink-0" />
              {lastReview ? (
                <span>
                  Last review: <b>{lastReview.at ? fmtDateTime(lastReview.at.toDate()) : 'saving…'}</b> by <b>{lastReview.actorName || lastReview.actorEmail}</b>
                  {lastReview.periodFrom && ` (period ${lastReview.periodFrom} to ${lastReview.periodTo})`}
                  {reviewOverdue && ' — a monthly review is due.'}
                </span>
              ) : (
                <span>No review of the log has been recorded yet. Review it monthly and click "Record review of this period".</span>
              )}
            </div>
            {reviews.length > 1 && <span className="text-slate-500">{reviews.length} reviews recorded</span>}
          </div>}

          {reviewOpen && (
            <div className="bg-white p-4 rounded-xl border border-emerald-300 shadow-xs space-y-3">
              <p className="text-xs text-slate-700">
                Recording a review of <b>{loadedPeriod && `${dayInput(loadedPeriod.from)} to ${dayInput(new Date(loadedPeriod.to.getTime() - 1))}`}</b> (
                {filtered.length} entries shown). Note what you checked and anything you followed up.
              </p>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                maxLength={3000}
                placeholder="e.g. Checked failed sign-ins, user and 2FA changes, and deletions. Nothing unusual."
                className={`${input} w-full`}
              />
              <div className="flex gap-2">
                <button onClick={saveReview} disabled={busy === 'review'} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
                  {busy === 'review' && <Loader2 className="w-4 h-4 animate-spin" />} Save review
                </button>
                <button onClick={() => setReviewOpen(false)} className={`${btn} bg-slate-100 hover:bg-slate-200 text-slate-700`}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Period + filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[11px] font-bold text-slate-500 space-y-1">
                <span className="block">From</span>
                <input type="date" value={fromDay} onChange={(e) => setFromDay(e.target.value)} className={input} />
              </label>
              <label className="text-[11px] font-bold text-slate-500 space-y-1">
                <span className="block">To</span>
                <input type="date" value={toDay} onChange={(e) => setToDay(e.target.value)} className={input} />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 pb-2">
                <input type="checkbox" checked={includeLegacy} onChange={(e) => setIncludeLegacy(e.target.checked)} />
                Include older entries
              </label>
              <button onClick={loadPeriod} disabled={loading} className={`${btn} bg-[#2E2C2B] hover:bg-black text-white`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />} Show period
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search every field (e.g. identity, 2FA, ZN101)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${input} w-full pl-9`}
                />
              </div>
              <select value={person} onChange={(e) => setPerson(e.target.value)} className={`${input} font-semibold text-slate-700`}>
                <option value="ALL">Everyone</option>
                {people.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={area} onChange={(e) => setArea(e.target.value as typeof area)} className={`${input} font-semibold text-slate-700`}>
                <option value="ALL">All areas</option>
                {(Object.keys(AREA_LABELS) as AuditArea[]).map((a) => (
                  <option key={a} value={a}>
                    {AREA_LABELS[a]}
                  </option>
                ))}
                {includeLegacy && <option value="legacy">Older entries</option>}
              </select>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} className={`${input} font-semibold text-slate-700`}>
                <option value="ALL">Succeeded and failed</option>
                <option value="success">Succeeded</option>
                <option value="failure">Failed</option>
              </select>
              <span className="text-xs text-slate-500 font-mono font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" /> {filtered.length} of {entries.length} entries
              </span>
            </div>
            {capped && (
              <p className="text-[11px] text-amber-700">
                This period has more than {MAX_PERIOD_ENTRIES} entries; only the newest are shown. Choose a shorter period to see them all.
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading the log…
              </div>
            ) : (
              <EntryRows entries={filtered} emptyText="No entries in this period match the filters." />
            )}
          </div>
        </>
      )}

      {/* Record history + audit pack */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#F37C1C]" />
          <h2 className="text-sm font-extrabold text-[#2E2C2B]">Record history & audit pack</h2>
        </div>
        <p className="text-[11px] text-slate-500">
          Everything that ever happened to one crew member, flight or aircraft: who changed what, when, with before and after values. The audit pack is
          one document ready to save as PDF{access === 'full' ? ' (for a crew member it also lists their sign-ins and account activity)' : ''}.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setRecordText('');
            }}
            className={`${input} font-semibold text-slate-700`}
          >
            <option value="crew">Crew member</option>
            <option value="flight">Flight</option>
            <option value="aircraft">Aircraft</option>
          </select>
          <input
            list="audit-record-options"
            value={recordText}
            onChange={(e) => setRecordText(e.target.value)}
            placeholder={kind === 'crew' ? 'Type a name or staff number' : kind === 'flight' ? 'Type a flight number or date' : 'Type a registration'}
            className={`${input} w-full md:w-80`}
          />
          <datalist id="audit-record-options">
            {options.map((o) => (
              <option key={o.subject.key} value={o.label} />
            ))}
          </datalist>
          <button onClick={showHistory} disabled={!chosen || busy === 'history'} className={`${btn} bg-[#2E2C2B] hover:bg-black text-white`}>
            {busy === 'history' ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />} Show history
          </button>
          <button onClick={makePack} disabled={!chosen || busy === 'pack'} className={`${btn} bg-[#F37C1C] hover:bg-[#D96B12] text-white`}>
            {busy === 'pack' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Audit pack (PDF)
          </button>
        </div>
        {history && historyFor && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700">
              {historyFor.kind}: {historyFor.title} — {history.length} entr{history.length === 1 ? 'y' : 'ies'}
            </div>
            <EntryRows entries={history} emptyText="No recorded changes to this record yet." />
          </div>
        )}
      </div>
    </div>
  );
};
