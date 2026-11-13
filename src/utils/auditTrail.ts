/**
 * Audit trail (ISO/IEC 27001:2022 A.8.15 Logging, A.8.16 Monitoring,
 * A.8.17 Clock synchronisation). See docs/AUDIT_TRAIL.md.
 *
 * Every entry is a document in `auditLogs` that nobody can edit or delete
 * (firestore.rules). The time is Google's server time (`at`), and the rules
 * check that the person, role and time in the entry are the real ones.
 *
 * Changes to operational records (crew, flights, assignments, leave, fleet,
 * acknowledgements, legality rules) are written by firebaseSync.ts in the SAME
 * database batch as their audit entry; the rules refuse the change otherwise.
 */
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app, db } from './firebaseSync';

export const AUDIT_SCHEMA_VERSION = 3;

export type AuditArea =
  | 'sign-in'
  | 'crew'
  | 'flights'
  | 'assignments'
  | 'leave'
  | 'fleet'
  | 'acknowledgments'
  | 'rules'
  | 'users'
  | 'security'
  | 'notifications'
  | 'exports'
  | 'audit-review'
  | 'system';

/** Areas Managers may see as record history (firestore.rules: ops == true). */
export const OPERATIONAL_AREAS: AuditArea[] = ['crew', 'flights', 'assignments', 'leave', 'fleet', 'acknowledgments', 'rules'];

export const AREA_LABELS: Record<AuditArea, string> = {
  'sign-in': 'Sign-in',
  crew: 'Crew records',
  flights: 'Flights',
  assignments: 'Crew assignments',
  leave: 'Leave & training',
  fleet: 'Aircraft fleet',
  acknowledgments: 'Roster acknowledgements',
  rules: 'Legality rules',
  users: 'User accounts',
  security: 'Security settings',
  notifications: 'Notifications',
  exports: 'Exports & audit packs',
  'audit-review': 'Log reviews',
  system: 'System',
};

/** Sign-in events that may be written before the person is fully signed in. */
export const SIGN_IN_FAILURE_ACTIONS = [
  'Sign-in failed',
  'Account locked',
  'Authenticator code rejected',
  'Sign-in refused',
] as const;

export type FieldValueText = string | number | boolean | null;

/** A v3 audit entry as stored (plus the document id). */
export interface AuditEntry {
  id: string;
  v: 3;
  at: Timestamp | null; // null only while the write is pending on this device
  area: AuditArea;
  action: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  outcome: 'success' | 'failure';
  /** Operational record history (Managers may read these) */
  ops: boolean;
  targetId: string;
  targetLabel: string;
  /** e.g. ['crew:C123', 'flight:F9'] — what record histories this entry belongs to */
  subjects: string[];
  changedFields: string[];
  before: Record<string, FieldValueText>;
  after: Record<string, FieldValueText>;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  device: string;
  clientTime: string;
  /** Log reviews: the period reviewed */
  periodFrom?: string;
  periodTo?: string;
}

/** Legacy (pre-v3) entry shape, still shown read-only. */
export interface LegacyAuditEntry {
  id: string;
  v?: undefined;
  user?: string;
  userRole?: string;
  date?: string;
  time?: string;
  timestamp?: string;
  action?: string;
  details?: string;
  severity?: string;
  [k: string]: unknown;
}

export type AnyAuditEntry = AuditEntry | LegacyAuditEntry;

export function isV3(e: AnyAuditEntry): e is AuditEntry {
  return (e as AuditEntry).v === AUDIT_SCHEMA_VERSION;
}

// ---------------------------------------------------------------------------
// Who is acting (set when a sign-in is accepted; cleared on sign-out)
// ---------------------------------------------------------------------------

export interface AuditActor {
  uid: string;
  email: string;
  name: string;
  role: string;
}

let currentActor: AuditActor | null = null;

export function setAuditActor(actor: AuditActor | null): void {
  currentActor = actor;
}

export function getAuditActor(): AuditActor | null {
  const user = getAuth(app).currentUser;
  if (!currentActor || !user || user.uid !== currentActor.uid) return null;
  // The rules compare with the sign-in token's email, exactly as Firebase holds it
  return { ...currentActor, email: user.email || currentActor.email };
}

// ---------------------------------------------------------------------------
// Device description (the free plan has no server, so no IP address)
// ---------------------------------------------------------------------------

export function describeDevice(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\/(\d+)/.exec(ua)?.[1] ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`
    : /OPR\/(\d+)/.exec(ua) ? `Opera ${/OPR\/(\d+)/.exec(ua)![1]}`
    : /Chrome\/(\d+)/.exec(ua) && !/Chromium/.test(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`
    : /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`
    : /Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}`
    : 'Browser';
  const os = /Windows NT 10/.test(ua) ? 'Windows 10/11'
    : /Windows/.test(ua) ? 'Windows'
    : /Android (\d+)/.exec(ua) ? `Android ${/Android (\d+)/.exec(ua)![1]}`
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS';
  const kind = /Mobi|iPhone|Android.*Mobile/.test(ua) ? 'phone' : /iPad|Tablet|Android/.test(ua) ? 'tablet' : 'computer';
  return `${browser} on ${os} (${kind})`.slice(0, 300);
}

// ---------------------------------------------------------------------------
// Before / after values
// ---------------------------------------------------------------------------

/** Fields never shown in before/after (internal or secret). */
const HIDDEN_FIELDS = new Set(['_auditId', 'password', 'tempPasswordHash', 'immutableSeal', 'previousSeal']);
const MAX_VALUE_CHARS = 500;
const MAX_FIELDS = 60;

function toText(value: unknown): FieldValueText {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.length > MAX_VALUE_CHARS ? `${value.slice(0, MAX_VALUE_CHARS)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const s = JSON.stringify(value);
  return s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS)}…` : s;
}

/**
 * The fields that differ between two versions of a record, with their old and
 * new values. A new record has before = {}; a deleted one has after = {}.
 */
export function diffRecords(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): { changedFields: string[]; before: Record<string, FieldValueText>; after: Record<string, FieldValueText> } {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changedFields: string[] = [];
  const b: Record<string, FieldValueText> = {};
  const a: Record<string, FieldValueText> = {};
  for (const k of [...keys].sort()) {
    if (HIDDEN_FIELDS.has(k)) continue;
    const ov = before ? before[k] : undefined;
    const nv = after ? after[k] : undefined;
    if (JSON.stringify(ov ?? null) === JSON.stringify(nv ?? null)) continue;
    changedFields.push(k);
    if (changedFields.length > MAX_FIELDS) continue;
    if (before) b[k] = toText(ov);
    if (after) a[k] = toText(nv);
  }
  return { changedFields, before: b, after: a };
}

// ---------------------------------------------------------------------------
// Building entries
// ---------------------------------------------------------------------------

export function newAuditId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface AuditInput {
  area: AuditArea;
  action: string;
  details?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  outcome?: 'success' | 'failure';
  targetId?: string;
  targetLabel?: string;
  subjects?: string[];
  changedFields?: string[];
  before?: Record<string, FieldValueText>;
  after?: Record<string, FieldValueText>;
  periodFrom?: string;
  periodTo?: string;
}

/** The stored fields for an entry made by the signed-in person. */
export function buildAuditEntry(input: AuditInput, actor: AuditActor): DocumentData {
  return {
    v: AUDIT_SCHEMA_VERSION,
    at: serverTimestamp(),
    area: input.area,
    action: input.action.slice(0, 120),
    details: (input.details || '').slice(0, 4000),
    severity: input.severity || 'INFO',
    outcome: input.outcome || 'success',
    ops: OPERATIONAL_AREAS.includes(input.area),
    targetId: (input.targetId || '').slice(0, 200),
    targetLabel: (input.targetLabel || '').slice(0, 200),
    subjects: (input.subjects || []).slice(0, 10).map((s) => s.slice(0, 200)),
    changedFields: (input.changedFields || []).slice(0, 100),
    before: input.before || {},
    after: input.after || {},
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorName: (actor.name || '').slice(0, 200),
    actorRole: actor.role,
    device: describeDevice(),
    clientTime: new Date().toISOString(),
    ...(input.periodFrom ? { periodFrom: input.periodFrom } : {}),
    ...(input.periodTo ? { periodTo: input.periodTo } : {}),
  };
}

/**
 * Records an action by the signed-in person. Resolves to the entry id, or null
 * if it could not be saved (not signed in, offline write refused, ...).
 */
export async function logAudit(input: AuditInput): Promise<string | null> {
  const actor = getAuditActor();
  if (!actor) return null;
  const id = newAuditId();
  try {
    await setDoc(doc(db, 'auditLogs', id), buildAuditEntry(input, actor));
    return id;
  } catch (e) {
    console.warn('[audit] Could not record:', input.action, e);
    return null;
  }
}

/**
 * Sign-in problems, recorded before (or instead of) a full sign-in. The rules
 * allow these few actions without an active account, so wrong passwords and
 * wrong authenticator codes are logged too.
 */
export async function logSignInFailure(
  action: (typeof SIGN_IN_FAILURE_ACTIONS)[number],
  email: string,
  details: string
): Promise<void> {
  const user = getAuth(app).currentUser;
  const entry = buildAuditEntry(
    { area: 'sign-in', action, details, severity: action === 'Account locked' ? 'CRITICAL' : 'WARNING', outcome: 'failure' },
    { uid: user?.uid || '', email: email.trim().toLowerCase().slice(0, 320), name: '', role: '' }
  );
  try {
    await setDoc(doc(db, 'auditLogs', newAuditId()), entry);
  } catch (e) {
    console.warn('[audit] Could not record sign-in failure:', e);
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Hard cap on one period's load, to protect the free daily read quota. */
export const MAX_PERIOD_ENTRIES = 5000;

function fromSnap(d: { id: string; data: () => DocumentData }): AnyAuditEntry {
  return { ...(d.data() as object), id: d.id } as AnyAuditEntry;
}

/** All entries (v3 by server time, plus older entries by their id time) in [from, to). */
export async function loadAuditPeriod(from: Date, to: Date, includeLegacy: boolean): Promise<{ entries: AnyAuditEntry[]; capped: boolean }> {
  const v3 = await getDocs(
    query(
      collection(db, 'auditLogs'),
      where('at', '>=', Timestamp.fromDate(from)),
      where('at', '<', Timestamp.fromDate(to)),
      orderBy('at', 'desc'),
      limit(MAX_PERIOD_ENTRIES)
    )
  );
  const entries: AnyAuditEntry[] = v3.docs.map(fromSnap);
  let capped = v3.size >= MAX_PERIOD_ENTRIES;
  if (includeLegacy) {
    const legacy = await getDocs(
      query(
        collection(db, 'auditLogs'),
        orderBy(documentId()),
        where(documentId(), '>=', `log-${from.getTime()}`),
        where(documentId(), '<', `log-${to.getTime()}`),
        limit(MAX_PERIOD_ENTRIES)
      )
    );
    if (legacy.size >= MAX_PERIOD_ENTRIES) capped = true;
    for (const d of legacy.docs) {
      const e = fromSnap(d);
      if (!isV3(e)) entries.push(e);
    }
  }
  entries.sort((x, y) => entryTime(y) - entryTime(x));
  return { entries, capped };
}

/** History of one record (crew member, flight, aircraft...), newest first. */
export async function loadRecordHistory(subject: string): Promise<AuditEntry[]> {
  const snap = await getDocs(
    query(collection(db, 'auditLogs'), where('ops', '==', true), where('subjects', 'array-contains', subject), limit(2000))
  );
  return (snap.docs.map(fromSnap).filter(isV3) as AuditEntry[]).sort((x, y) => entryTime(y) - entryTime(x));
}

/** Sign-in and account events for one person (full-log readers only). */
export async function loadPersonEvents(email: string): Promise<AuditEntry[]> {
  const snap = await getDocs(query(collection(db, 'auditLogs'), where('actorEmail', '==', email), limit(2000)));
  return (snap.docs.map(fromSnap).filter(isV3) as AuditEntry[]).sort((x, y) => entryTime(y) - entryTime(x));
}

/** The most recent log reviews. */
export async function loadReviews(): Promise<AuditEntry[]> {
  const snap = await getDocs(query(collection(db, 'auditLogs'), where('area', '==', 'audit-review'), limit(200)));
  return (snap.docs.map(fromSnap).filter(isV3) as AuditEntry[]).sort((x, y) => entryTime(y) - entryTime(x));
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function entryTime(e: AnyAuditEntry): number {
  if (isV3(e)) return e.at ? e.at.toMillis() : Date.parse(e.clientTime) || 0;
  const t = e.timestamp || (e.date ? `${e.date}T${e.time || '00:00:00'}` : '');
  const ms = Date.parse(t);
  if (!Number.isNaN(ms)) return ms;
  const m = /^log-(\d{10,})/.exec(e.id);
  return m ? Number(m[1]) : 0;
}

/** Normalised row for tables and exports (old entries included). */
export interface AuditRow {
  id: string;
  time: Date;
  serverTime: boolean;
  person: string;
  email: string;
  role: string;
  area: string;
  action: string;
  target: string;
  changes: string;
  details: string;
  device: string;
  outcome: string;
  severity: string;
  legacy: boolean;
}

export function formatChanges(e: AuditEntry): string {
  if (!e.changedFields?.length) return '';
  return e.changedFields
    .slice(0, 60)
    .map((f) => {
      const b = e.before?.[f];
      const a = e.after?.[f];
      if (!(f in (e.before || {}))) return `${f}: ${fmtVal(a)}`;
      if (!(f in (e.after || {}))) return `${f}: ${fmtVal(b)} → (removed)`;
      return `${f}: ${fmtVal(b)} → ${fmtVal(a)}`;
    })
    .join('; ');
}

function fmtVal(v: FieldValueText | undefined): string {
  if (v === null || v === undefined || v === '') return '(empty)';
  return String(v);
}

export function toRow(e: AnyAuditEntry): AuditRow {
  if (isV3(e)) {
    return {
      id: e.id,
      time: new Date(entryTime(e)),
      serverTime: !!e.at,
      person: e.actorName || e.actorEmail || '(not signed in)',
      email: e.actorEmail,
      role: e.actorRole,
      area: AREA_LABELS[e.area] || e.area,
      action: e.action,
      target: e.targetLabel || e.targetId,
      changes: formatChanges(e),
      details: e.details,
      device: e.device,
      outcome: e.outcome === 'failure' ? 'Failed' : 'Succeeded',
      severity: e.severity,
      legacy: false,
    };
  }
  return {
    id: e.id,
    time: new Date(entryTime(e)),
    serverTime: false,
    person: String(e.user || ''),
    email: '',
    role: String(e.userRole || ''),
    area: 'Older entry',
    action: String(e.action || ''),
    target: [e.flightNumber, e.crewName].filter(Boolean).join(' / ') as string,
    changes: [e.previousAssignment, e.newAssignment].filter(Boolean).join(' → ') as string,
    details: String(e.details || ''),
    device: '',
    outcome: '',
    severity: String(e.severity || ''),
    legacy: true,
  };
}

export function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}
