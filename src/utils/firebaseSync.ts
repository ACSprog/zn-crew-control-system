import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  orderBy,
  limit,
  documentId,
  where,
  type Query,
  type DocumentData,
  doc,
  setDoc,
  onSnapshot,
  collection,
  writeBatch,
  getDocs,
} from 'firebase/firestore';

import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  LegalityRules,
  AircraftFleet,
  SystemUser,
  AuditLog,
  RosterAcknowledgment,
} from '../types';

import { buildAuditEntry, diffRecords, getAuditActor, newAuditId, type AuditArea } from './auditTrail';
import testFirebaseConfig from '../../firebase-applet-config.json';
import liveFirebaseConfig from '../../firebase-applet-config.live.json';

/**
 * Two separate Firebase projects (docs/ENVIRONMENTS.md):
 *   test - firebase-applet-config.json      (npm run dev / build / deploy)
 *   live - firebase-applet-config.live.json (npm run build:live / go-live)
 * Each has its own database, users and audit log.
 */
export const APP_ENV: 'test' | 'live' = import.meta.env.MODE === 'live' ? 'live' : 'test';
if (APP_ENV === 'live' && !liveFirebaseConfig.projectId) {
  throw new Error('Live build without a live Firebase project: fill in firebase-applet-config.live.json.');
}
const firebaseConfigData = APP_ENV === 'live' ? liveFirebaseConfig : testFirebaseConfig;

export const firebaseWebConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
  measurementId: firebaseConfigData.measurementId || undefined,
};

export const app = initializeApp(firebaseWebConfig);

// Google Analytics for Firebase (free, no billing needed). Only started in
// production builds, and only where the browser supports it (it isn't
// available in some private-browsing modes or non-browser contexts).
export let analytics: Analytics | null = null;
if (!import.meta.env.DEV && firebaseWebConfig.measurementId) {
  isAnalyticsSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(() => {
      analytics = null;
    });
}
// FREE-TIER: always use the project's (default) Firestore database. Only the
// (default) database gets the free daily quota; named databases are billed
// from the first read and require a billing account to create.
const databaseId: string | undefined = undefined;

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      experimentalAutoDetectLongPolling: true,
      // FREE-TIER: keep an on-device (IndexedDB) copy of every collection.
      // When a user reopens the app, Firestore only bills reads for documents
      // that changed since their last visit instead of re-reading the whole
      // roster, which keeps a normal OCC team well inside the free
      // 50,000 reads/day Spark-plan quota.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    },
    databaseId
  );
} catch {
  firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export const db = firestoreInstance;

// In local dev, point at the Firebase Local Emulator Suite instead of the
// live production Firestore/Auth, so testing never touches real data.
// Toggle with VITE_USE_FIREBASE_EMULATOR in .env (defaults to on in dev).
export const isDev = import.meta.env.DEV;
const useEmulatorFlag = import.meta.env.VITE_USE_FIREBASE_EMULATOR;
export const useEmulator = isDev && useEmulatorFlag !== 'false';

let emulatorConnected = false;
if (useEmulator && !emulatorConnected) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8081);
    emulatorConnected = true;
    console.info(
      '[firebaseSync] Connected to local Firestore emulator at localhost:8081. ' +
        'Set VITE_USE_FIREBASE_EMULATOR="false" in .env to use live Firestore instead.'
    );
  } catch (err) {
    console.warn('[firebaseSync] Could not connect to Firestore emulator, falling back to live Firestore.', err);
  }
}

/**
 * Deeply sanitizes data before writing to Firestore: removes `undefined`
 * values (Firestore rejects them) and always strips any `password` field —
 * credentials live in Firebase Auth now, never in Firestore documents.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key === 'password') continue;
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj as unknown as T;
}

export interface RealtimeCallbacks {
  onCrewUpdate?: (crew: CrewMember[]) => void;
  onFlightsUpdate?: (flights: Flight[]) => void;
  onAssignmentsUpdate?: (assignments: Assignment[]) => void;
  onLeaveUpdate?: (leave: LeaveTrainingRecord[]) => void;
  onFleetUpdate?: (fleet: AircraftFleet[]) => void;
  onRulesUpdate?: (rules: LegalityRules) => void;
  onUsersUpdate?: (users: SystemUser[]) => void;
  onAuditLogsUpdate?: (auditLogs: AuditLog[]) => void;
  onAcknowledgmentsUpdate?: (acknowledgments: RosterAcknowledgment[]) => void;
  onSyncStatusChange?: (status: 'connected' | 'connecting' | 'error') => void;
}

/**
 * ---------------------------------------------------------------------------
 * Per-record collection sync engine.
 *
 * Each logical "collection" (crew, flights, assignments, ...) is stored as a
 * real Firestore collection with one document per record (doc id = record's
 * own `id` field), instead of a single document holding the whole array.
 * This avoids the 1 MiB per-document limit and means two people editing
 * different records at the same time no longer silently overwrite each
 * other's changes.
 *
 * The public API below (syncCrewToFirebase(array), subscribeToRealtimeSync)
 * is intentionally unchanged from the previous blob-document version, so
 * storage.ts and App.tsx did not need to change at all.
 * ---------------------------------------------------------------------------
 */

const IMMUTABLE_COLLECTIONS = new Set(['auditLogs']);

const lastSyncedCache = new Map<string, Map<string, string>>();

function getCache(collectionName: string): Map<string, string> {
  let cache = lastSyncedCache.get(collectionName);
  if (!cache) {
    cache = new Map();
    lastSyncedCache.set(collectionName, cache);
  }
  return cache;
}

/** JSON with object keys sorted, so the same record always compares equal. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((o, k) => {
          o[k] = (v as Record<string, unknown>)[k];
          return o;
        }, {})
      : v
  );
}

// ---------------------------------------------------------------------------
// AUDIT TRAIL (docs/AUDIT_TRAIL.md). Each change to these collections is
// written in the same batch as an audit entry with its before/after values,
// and the record carries `_auditId` = that entry's id. firestore.rules refuse
// the change if the entry isn't saved with it. A delete is logged under the
// id `<record's _auditId>-del`, which the rules can check without a field.
// ---------------------------------------------------------------------------

/** Field on audited records pointing at the audit entry of their last change. */
export const AUDIT_ID_FIELD = '_auditId';

interface AuditedCollection {
  area: AuditArea;
  noun: string;
  label: (r: Record<string, unknown>) => string;
  subjects: (r: Record<string, unknown>) => string[];
}

const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

function flightLabel(flightId: string): string {
  const cached = getCache('flights').get(flightId);
  if (!cached) return flightId;
  try {
    const f = JSON.parse(cached) as Record<string, unknown>;
    return [str(f.flightNumber), str(f.date)].filter(Boolean).join(' ') || flightId;
  } catch {
    return flightId;
  }
}

function crewLabel(crewId: string): string {
  const cached = getCache('crew').get(crewId);
  if (!cached) return crewId;
  try {
    const c = JSON.parse(cached) as Record<string, unknown>;
    return [str(c.name), str(c.staffNumber) && `(${str(c.staffNumber)})`].filter(Boolean).join(' ') || crewId;
  } catch {
    return crewId;
  }
}

function assignmentCrewIds(r: Record<string, unknown>): string[] {
  const ids = [str(r.captainId), str(r.firstOfficerId), ...((Array.isArray(r.cabinCrewIds) ? r.cabinCrewIds : []) as unknown[]).map(str)];
  return ids.filter(Boolean);
}

/** Crew and flight ids shown as names in before/after values (auditors can't read ids). */
const CREW_ID_FIELDS = new Set(['captainId', 'firstOfficerId', 'crewId']);
const CREW_ID_LIST_FIELDS = new Set(['cabinCrewIds', 'acknowledgedCrewIds']);

export function readableForAudit(r: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!r) return r;
  const out: Record<string, unknown> = { ...r };
  for (const [k, v] of Object.entries(r)) {
    if (CREW_ID_FIELDS.has(k) && typeof v === 'string' && v) out[k] = crewLabel(v);
    else if (CREW_ID_LIST_FIELDS.has(k) && Array.isArray(v)) out[k] = v.map((id) => crewLabel(str(id))).join(', ');
    else if (k === 'flightId' && typeof v === 'string' && v) out[k] = flightLabel(v);
  }
  return out;
}

export const AUDITED_COLLECTIONS: Record<string, AuditedCollection> = {
  crew: {
    area: 'crew',
    noun: 'crew record',
    label: (r) => [str(r.name), str(r.staffNumber) && `(${str(r.staffNumber)})`].filter(Boolean).join(' '),
    subjects: (r) => [`crew:${str(r.id)}`],
  },
  flights: {
    area: 'flights',
    noun: 'flight',
    label: (r) => [str(r.flightNumber), str(r.date)].filter(Boolean).join(' '),
    subjects: (r) => [`flight:${str(r.id)}`, ...(str(r.registration) ? [`aircraft:${str(r.registration)}`] : [])],
  },
  assignments: {
    area: 'assignments',
    noun: 'crew assignment',
    label: (r) => `Crew for ${flightLabel(str(r.flightId))}`,
    subjects: (r) => [`assignment:${str(r.id)}`, `flight:${str(r.flightId)}`, ...assignmentCrewIds(r).map((id) => `crew:${id}`)],
  },
  leave: {
    area: 'leave',
    noun: 'leave/training record',
    label: (r) => `${str(r.type)} ${str(r.startDate)}–${str(r.endDate)} · ${crewLabel(str(r.crewId))}`,
    subjects: (r) => [`leave:${str(r.id)}`, `crew:${str(r.crewId)}`],
  },
  fleet: {
    area: 'fleet',
    noun: 'aircraft',
    label: (r) => str(r.registration),
    subjects: (r) => [`aircraft:${str(r.registration)}`],
  },
  acknowledgments: {
    area: 'acknowledgments',
    noun: 'roster acknowledgement',
    label: (r) => `${str(r.crewName) || crewLabel(str(r.crewId))} · roster ${str(r.rosterPeriod)}`,
    subjects: (r) => [`crew:${str(r.crewId)}`],
  },
  config: {
    area: 'rules',
    noun: 'setting',
    label: (r) => (str(r.id) === 'legalityRules' ? 'Legality rules (FTL)' : str(r.id)),
    subjects: (r) => [`config:${str(r.id)}`],
  },
};

/** Last known `_auditId` of each record (from the server or our own writes). */
const auditIdCache = new Map<string, Map<string, string>>();

function getAuditIds(collectionName: string): Map<string, string> {
  let m = auditIdCache.get(collectionName);
  if (!m) {
    m = new Map();
    auditIdCache.set(collectionName, m);
  }
  return m;
}

/** Removes `_auditId` (remembering it) so app state and diffs never see it. */
function takeAuditId<T extends Record<string, unknown>>(collectionName: string, id: string, data: T): T {
  if (data && AUDIT_ID_FIELD in data) {
    const auditId = data[AUDIT_ID_FIELD];
    if (typeof auditId === 'string' && auditId) getAuditIds(collectionName).set(id, auditId);
    const rest = { ...data };
    delete rest[AUDIT_ID_FIELD];
    return rest;
  }
  return data;
}

/** The audit id the rules expect for deleting this record. */
export function deleteAuditId(collectionName: string, recordId: string, currentAuditId?: string): string {
  return `${currentAuditId || `legacy-${collectionName}-${recordId}`}-del`;
}

/** Record writes per batch: each needs one rules lookup of its audit entry (20 per batch max). */
const AUDITED_PAIRS_PER_BATCH = 6;

type SyncOp =
  | { type: 'set'; id: string; data: Record<string, unknown> }
  | { type: 'delete'; id: string };

interface PlannedWrite {
  ops: Array<{ type: 'set' | 'delete'; collection: string; id: string; data?: Record<string, unknown> }>;
  /** Applied to the caches once the batch is committed */
  done: () => void;
}

function planAuditedOp(collectionName: string, op: SyncOp, beforeJson: string | undefined): PlannedWrite | null {
  const spec = AUDITED_COLLECTIONS[collectionName];
  const actor = getAuditActor();
  if (!spec || !actor) return null;
  const before = beforeJson ? (JSON.parse(beforeJson) as Record<string, unknown>) : null;
  const after = op.type === 'set' ? op.data : null;
  const record = (after || before || { id: op.id }) as Record<string, unknown>;
  const diff = diffRecords(readableForAudit(before), readableForAudit(after));
  const subjects = [...new Set([...(before ? spec.subjects(before) : []), ...(after ? spec.subjects(after) : [])])];
  const label = spec.label(record) || op.id;
  const action = op.type === 'delete' ? `Deleted ${spec.noun}` : before ? `Updated ${spec.noun}` : `Created ${spec.noun}`;
  const auditId = op.type === 'delete' ? deleteAuditId(collectionName, op.id, getAuditIds(collectionName).get(op.id)) : newAuditId();
  const entry = buildAuditEntry(
    {
      area: spec.area,
      action,
      details:
        op.type === 'delete'
          ? `${label} deleted.`
          : before
            ? `Changed: ${diff.changedFields.join(', ') || '(no visible fields)'}.`
            : `${label} added.`,
      severity: op.type === 'delete' ? 'WARNING' : 'INFO',
      targetId: op.id,
      targetLabel: label,
      subjects,
      changedFields: diff.changedFields,
      before: diff.before,
      after: diff.after,
    },
    actor
  );
  const ops: PlannedWrite['ops'] = [{ type: 'set', collection: 'auditLogs', id: auditId, data: entry }];
  if (op.type === 'set') ops.push({ type: 'set', collection: collectionName, id: op.id, data: { ...op.data, [AUDIT_ID_FIELD]: auditId } });
  else ops.push({ type: 'delete', collection: collectionName, id: op.id });
  return {
    ops,
    done: () => {
      const cache = getCache(collectionName);
      if (op.type === 'set') {
        cache.set(op.id, stableStringify(op.data));
        getAuditIds(collectionName).set(op.id, auditId);
      } else {
        cache.delete(op.id);
        getAuditIds(collectionName).delete(op.id);
      }
    },
  };
}

function logBatchError(collectionName: string, err: unknown) {
  const errorObj = err as { code?: string };
  if (errorObj?.code === 'resource-exhausted') {
    console.warn(`[FirebaseSync] Write stream busy for ${collectionName}, will retry on next change.`);
  } else if (errorObj?.code === 'unavailable') {
    console.warn(`[FirebaseSync] Network unavailable for ${collectionName}, buffered in cache.`);
  } else {
    console.error(`[FirebaseSync] Error syncing ${collectionName}:`, err);
  }
}

async function writeAudited(collectionName: string, ops: SyncOp[]): Promise<void> {
  const beforeCache = getCache(collectionName);
  for (let i = 0; i < ops.length; i += AUDITED_PAIRS_PER_BATCH) {
    const planned = ops
      .slice(i, i + AUDITED_PAIRS_PER_BATCH)
      .map((op) => planAuditedOp(collectionName, op, beforeCache.get(op.id)))
      .filter((p): p is PlannedWrite => p !== null);
    if (planned.length === 0) {
      console.warn(`[FirebaseSync] Not saving ${collectionName}: no signed-in account to record in the audit trail.`);
      return;
    }
    const batch = writeBatch(db);
    for (const p of planned) {
      for (const o of p.ops) {
        const ref = doc(db, o.collection, o.id);
        if (o.type === 'set') batch.set(ref, o.data!, { merge: false });
        else batch.delete(ref);
      }
    }
    try {
      await batch.commit();
    } catch (err) {
      logBatchError(collectionName, err);
      return;
    }
    planned.forEach((p) => p.done());
  }
}

async function diffAndWriteCollection(
  collectionName: string,
  items: Array<Record<string, unknown>>,
  idField: string = 'id'
): Promise<void> {
  const cache = getCache(collectionName);
  const clean = sanitizeForFirestore(items);
  const incomingIds = new Set<string>();

  const toWrite: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const raw of clean) {
    const itemId = raw?.[idField] as string | undefined;
    if (!raw || !itemId) continue;
    const item = takeAuditId(collectionName, itemId, raw);
    incomingIds.add(itemId);
    const serialized = stableStringify(item);
    if (cache.get(itemId) !== serialized) {
      toWrite.push({ id: itemId, data: item });
    }
  }

  const toDelete: string[] = [];
  if (!IMMUTABLE_COLLECTIONS.has(collectionName)) {
    for (const existingId of cache.keys()) {
      if (!incomingIds.has(existingId)) {
        toDelete.push(existingId);
      }
    }
  }

  if (toWrite.length === 0 && toDelete.length === 0) return;

  const ops: SyncOp[] = [
    ...toWrite.map((w) => ({ type: 'set' as const, id: w.id, data: w.data })),
    ...toDelete.map((id) => ({ type: 'delete' as const, id })),
  ];

  if (AUDITED_COLLECTIONS[collectionName]) {
    await writeAudited(collectionName, ops);
    return;
  }

  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, collectionName, op.id);
      if (op.type === 'set') {
        batch.set(ref, op.data, { merge: false });
      } else {
        batch.delete(ref);
      }
    }
    try {
      await batch.commit();
    } catch (err: unknown) {
      logBatchError(collectionName, err);
      return;
    }
  }

  for (const w of toWrite) cache.set(w.id, stableStringify(w.data));
  for (const id of toDelete) cache.delete(id);
}

/** One audited document write (e.g. config/legalityRules), outside the array sync. */
export async function writeAuditedDoc(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  const clean = sanitizeForFirestore({ ...data, id });
  const cache = getCache(collectionName);
  if (cache.get(id) === stableStringify(clean)) return;
  await writeAudited(collectionName, [{ type: 'set', id, data: clean }]);
}

const writeDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingArrays = new Map<string, Array<Record<string, unknown>>>();

/**
 * Never attempt a Firestore write unless a Firebase Auth session actually
 * exists yet. Several code paths (e.g. seeding default users into
 * localStorage on first visit) call the save/sync functions
 * unconditionally at page load, before any login has happened — without
 * this guard those always fail with PERMISSION_DENIED (correctly, since
 * the security rules require a signed-in account) and that failed write
 * is simply lost, since Firestore does not retry permission-denied errors
 * the way it retries network errors.
 */
function isSignedIn(): boolean {
  return getAuth(app).currentUser !== null;
}

function queueCollectionWrite(
  collectionName: string,
  items: Array<Record<string, unknown>>,
  delayMs = 350,
  idField: string = 'id'
): Promise<void> {
  if (!isSignedIn()) {
    // Silently skip — not an error. localStorage still has the data from
    // the caller (e.g. storage.ts's saveX functions write localStorage
    // first, this sync is always a secondary step), and the moment the
    // user signs in, the Firestore subscription will reconcile state
    // from the server as the source of truth anyway.
    return Promise.resolve();
  }
  pendingArrays.set(collectionName, items);
  if (writeDebounceTimers.has(collectionName)) {
    clearTimeout(writeDebounceTimers.get(collectionName)!);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      writeDebounceTimers.delete(collectionName);
      const latest = pendingArrays.get(collectionName);
      pendingArrays.delete(collectionName);
      if (latest) {
        await diffAndWriteCollection(collectionName, latest, idField);
      }
      resolve();
    }, delayMs);
    writeDebounceTimers.set(collectionName, timer);
  });
}

/**
 * FREE-TIER: the audit log only ever grows, so listening to the whole
 * collection would re-read thousands of documents on every app load and
 * eventually exhaust the free daily read quota. The live view is capped to
 * the most recent entries (ids are `log-<epoch ms>-…`, so ordering by
 * document id descending = newest first). Older entries stay in Firestore.
 */
export const AUDIT_LOG_LIVE_LIMIT = 500;

function subscribeCollection<T>(
  collectionName: string,
  onUpdate: ((items: T[]) => void) | undefined,
  onStatus: () => void,
  onError: (name: string, err: unknown) => void,
  idField: string = 'id',
  maxDocs?: number,
  customSource?: Query<DocumentData>
): () => void {
  const source =
    customSource ??
    (maxDocs
      ? query(collection(db, collectionName), orderBy(documentId(), 'desc'), limit(maxDocs))
      : collection(db, collectionName));
  return onSnapshot(
    source,
    (snap) => {
      onStatus();
      const cache = getCache(collectionName);
      const items: T[] = [];
      snap.forEach((docSnap) => {
        const raw = { ...docSnap.data(), [idField]: docSnap.id } as Record<string, unknown>;
        const data = takeAuditId(collectionName, docSnap.id, raw) as T;
        items.push(data);
        cache.set(docSnap.id, stableStringify(sanitizeForFirestore(data)));
      });
      onUpdate?.(items);
    },
    (err) => onError(collectionName, err)
  );
}

export async function syncCrewToFirebase(crew: CrewMember[]) {
  return queueCollectionWrite('crew', crew as unknown as Array<Record<string, unknown>>);
}

export async function syncFlightsToFirebase(flights: Flight[]) {
  return queueCollectionWrite('flights', flights as unknown as Array<Record<string, unknown>>);
}

export async function syncAssignmentsToFirebase(assignments: Assignment[]) {
  return queueCollectionWrite('assignments', assignments as unknown as Array<Record<string, unknown>>);
}

export async function syncLeaveToFirebase(leave: LeaveTrainingRecord[]) {
  return queueCollectionWrite('leave', leave as unknown as Array<Record<string, unknown>>);
}

export async function syncFleetToFirebase(fleet: AircraftFleet[]) {
  // AircraftFleet has no `id` field — its registration is the natural
  // unique key, so it's used as the Firestore document id instead.
  return queueCollectionWrite('fleet', fleet as unknown as Array<Record<string, unknown>>, 350, 'registration');
}

export async function syncRulesToFirebase(rules: LegalityRules) {
  if (!isSignedIn()) return;
  const cleanRules = sanitizeForFirestore(rules);
  try {
    await writeAuditedDoc('config', 'legalityRules', { rules: cleanRules });
  } catch (err) {
    console.error('[FirebaseSync] Error syncing rules:', err);
  }
}

/**
 * User accounts are no longer bulk-synced: every change goes through
 * src/utils/accounts.ts (one targeted write per action), which the security
 * rules check against the admin's role. A bulk "write the whole list" could
 * otherwise overwrite or delete other people's accounts.
 */
export async function syncUsersToFirebase(_users: SystemUser[]): Promise<void> {
  return Promise.resolve();
}

/**
 * Audit entries are written one at a time by auditTrail.ts (logAudit) and with
 * each data change; the old "sync the whole log array" path is gone.
 */
export async function syncAuditLogsToFirebase(_auditLogs: AuditLog[]): Promise<void> {
  return;
}

export async function syncAcknowledgmentsToFirebase(acknowledgments: RosterAcknowledgment[]) {
  return queueCollectionWrite('acknowledgments', acknowledgments as unknown as Array<Record<string, unknown>>);
}

export async function syncNotificationLogsToFirebase(logs: Array<Record<string, unknown>>) {
  return queueCollectionWrite('notificationLogs', logs);
}

export async function syncNotificationQueueToFirebase(queue: Array<Record<string, unknown>>) {
  return queueCollectionWrite('notificationQueue', queue);
}

/**
 * Deletes all operational records. Each deletion is recorded in the audit
 * trail like any other (the audit log itself can never be cleared).
 */
export async function clearAllFirebaseCollections() {
  const collections: Array<[string, string]> = [['crew', 'id'], ['flights', 'id'], ['assignments', 'id'], ['leave', 'id'], ['fleet', 'registration'], ['acknowledgments', 'id']];
  try {
    for (const [name, idField] of collections) {
      const snap = await getDocs(collection(db, name));
      const cache = getCache(name);
      snap.forEach((d) => {
        const data = takeAuditId(name, d.id, { ...d.data(), [idField]: d.id } as Record<string, unknown>);
        cache.set(d.id, stableStringify(sanitizeForFirestore(data)));
      });
      await diffAndWriteCollection(name, [], idField);
    }
  } catch (err) {
    console.warn('[FirebaseSync] Error clearing Firestore collections:', err);
  }
}

export async function pushAllDataToFirebase(data: {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  fleet: AircraftFleet[];
  rules: LegalityRules;
  systemUsers: SystemUser[];
  auditLogs: AuditLog[];
}) {
  await Promise.all([
    syncCrewToFirebase(data.crew),
    syncFlightsToFirebase(data.flights),
    syncAssignmentsToFirebase(data.assignments),
    syncLeaveToFirebase(data.leaveRecords),
    syncFleetToFirebase(data.fleet),
    syncRulesToFirebase(data.rules),
    syncUsersToFirebase(data.systemUsers),
  ]);
}

/**
 * Crew logins (FLIGHT_CREW / PILOT_CABIN) may only read their own crew
 * record, leave and acknowledgements (see firestore.rules). Whole-collection
 * listeners would be rejected, so in crew scope those listeners are narrowed
 * to the crew member's own documents and the audit log isn't loaded.
 */
export interface RealtimeScope {
  /** Crew logins: only their own crew record, leave and acknowledgements */
  crewEmail?: string;
  /** Not a user manager: only their own users/{uid} profile */
  ownUserId?: string;
}

export function subscribeToRealtimeSync(callbacks: RealtimeCallbacks, scope?: RealtimeScope): () => void {
  callbacks.onSyncStatusChange?.('connecting');

  let connectedCount = 0;
  const updateConnectionStatus = () => {
    connectedCount++;
    if (connectedCount >= 1) {
      callbacks.onSyncStatusChange?.('connected');
    }
  };

  const handleSnapshotError = (moduleName: string, err: unknown) => {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj?.code === 'unavailable') {
      callbacks.onSyncStatusChange?.('connecting');
    } else {
      console.warn(`[FirebaseSync] ${moduleName} sync notice:`, err);
    }
  };

  const unsubFlights = subscribeCollection<Flight>('flights', callbacks.onFlightsUpdate, updateConnectionStatus, handleSnapshotError);
  const unsubAssignments = subscribeCollection<Assignment>('assignments', callbacks.onAssignmentsUpdate, updateConnectionStatus, handleSnapshotError);
  const unsubFleet = subscribeCollection<AircraftFleet>('fleet', callbacks.onFleetUpdate, updateConnectionStatus, handleSnapshotError, 'registration');
  // Only Admins / Super Admins may list every account (see firestore.rules);
  // everyone else just sees their own profile.
  const unsubUsers = scope?.ownUserId
    ? onSnapshot(
        doc(db, 'users', scope.ownUserId),
        (snap) => {
          updateConnectionStatus();
          if (snap.exists()) callbacks.onUsersUpdate?.([{ ...(snap.data() as SystemUser), id: snap.id }]);
        },
        (err) => handleSnapshotError('users', err)
      )
    : subscribeCollection<SystemUser>('users', callbacks.onUsersUpdate, updateConnectionStatus, handleSnapshotError);

  let unsubCrew: () => void;
  let unsubLeave: () => void = () => {};
  let unsubAudit: () => void = () => {};
  let unsubAcks: () => void = () => {};

  if (scope?.crewEmail) {
    const email = scope.crewEmail.trim().toLowerCase();
    let currentCrewId = '';
    callbacks.onAuditLogsUpdate?.([]);
    unsubCrew = subscribeCollection<CrewMember>(
      'crew',
      (items) => {
        callbacks.onCrewUpdate?.(items);
        const crewId = items[0]?.id || '';
        if (crewId === currentCrewId) return;
        currentCrewId = crewId;
        unsubLeave();
        unsubAcks();
        if (!crewId) {
          callbacks.onLeaveUpdate?.([]);
          callbacks.onAcknowledgmentsUpdate?.([]);
          unsubLeave = () => {};
          unsubAcks = () => {};
          return;
        }
        unsubLeave = subscribeCollection<LeaveTrainingRecord>('leave', callbacks.onLeaveUpdate, updateConnectionStatus, handleSnapshotError, 'id', undefined,
          query(collection(db, 'leave'), where('crewEmail', '==', email)));
        unsubAcks = subscribeCollection<RosterAcknowledgment>('acknowledgments', callbacks.onAcknowledgmentsUpdate, updateConnectionStatus, handleSnapshotError, 'id', undefined,
          query(collection(db, 'acknowledgments'), where('crewEmail', '==', email)));
      },
      updateConnectionStatus,
      handleSnapshotError,
      'id',
      undefined,
      query(collection(db, 'crew'), where('email', '==', email))
    );
  } else {
    unsubCrew = subscribeCollection<CrewMember>('crew', callbacks.onCrewUpdate, updateConnectionStatus, handleSnapshotError);
    unsubLeave = subscribeCollection<LeaveTrainingRecord>('leave', callbacks.onLeaveUpdate, updateConnectionStatus, handleSnapshotError);
    // The audit log is no longer streamed to every screen: the Audit Log page
    // loads the period it needs (auditTrail.ts), which also saves free-tier reads.
    callbacks.onAuditLogsUpdate?.([]);
    unsubAcks = subscribeCollection<RosterAcknowledgment>('acknowledgments', callbacks.onAcknowledgmentsUpdate, updateConnectionStatus, handleSnapshotError);
  }

  const unsubRules = onSnapshot(
    doc(db, 'config', 'legalityRules'),
    (snap) => {
      updateConnectionStatus();
      if (snap.exists()) {
        const data = takeAuditId('config', snap.id, { ...snap.data(), id: snap.id } as Record<string, unknown>);
        getCache('config').set(snap.id, stableStringify(sanitizeForFirestore(data)));
        if (data.rules) {
          callbacks.onRulesUpdate?.(data.rules as LegalityRules);
        }
      }
    },
    (err) => handleSnapshotError('Rules', err)
  );

  return () => {
    unsubCrew();
    unsubFlights();
    unsubAssignments();
    unsubLeave();
    unsubFleet();
    unsubRules();
    unsubUsers();
    unsubAudit();
    unsubAcks();
  };
}