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

import firebaseConfigData from '../../firebase-applet-config.json';

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

async function diffAndWriteCollection(
  collectionName: string,
  items: Array<Record<string, unknown>>,
  idField: string = 'id'
): Promise<void> {
  const cache = getCache(collectionName);
  const clean = sanitizeForFirestore(items);
  const incomingIds = new Set<string>();

  const toWrite: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const item of clean) {
    const itemId = item?.[idField] as string | undefined;
    if (!item || !itemId) continue;
    incomingIds.add(itemId);
    const serialized = JSON.stringify(item);
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

  const ops = [
    ...toWrite.map((w) => ({ type: 'set' as const, id: w.id, data: w.data })),
    ...toDelete.map((id) => ({ type: 'delete' as const, id })),
  ];

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
      const errorObj = err as { code?: string };
      if (errorObj?.code === 'resource-exhausted') {
        console.warn(`[FirebaseSync] Write stream busy for ${collectionName}, will retry on next change.`);
      } else if (errorObj?.code === 'unavailable') {
        console.warn(`[FirebaseSync] Network unavailable for ${collectionName}, buffered in cache.`);
      } else {
        console.error(`[FirebaseSync] Error syncing ${collectionName}:`, err);
      }
      return;
    }
  }

  for (const w of toWrite) cache.set(w.id, JSON.stringify(w.data));
  for (const id of toDelete) cache.delete(id);
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
        const data = { ...docSnap.data(), [idField]: docSnap.id } as T;
        items.push(data);
        cache.set(docSnap.id, JSON.stringify(data));
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
    await setDoc(doc(db, 'config', 'legalityRules'), { rules: cleanRules, updatedAt: new Date().toISOString() });
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

export async function syncAuditLogsToFirebase(auditLogs: AuditLog[]) {
  return queueCollectionWrite('auditLogs', auditLogs as unknown as Array<Record<string, unknown>>, 600);
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

export async function clearAllFirebaseCollections() {
  const collections = ['crew', 'flights', 'assignments', 'leave', 'fleet', 'auditLogs', 'acknowledgments'];
  try {
    for (const name of collections) {
      const snap = await getDocs(collection(db, name));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      lastSyncedCache.delete(name);
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
    syncAuditLogsToFirebase(data.auditLogs),
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
    unsubAudit = subscribeCollection<AuditLog>('auditLogs', callbacks.onAuditLogsUpdate, updateConnectionStatus, handleSnapshotError, 'id', AUDIT_LOG_LIVE_LIMIT);
    unsubAcks = subscribeCollection<RosterAcknowledgment>('acknowledgments', callbacks.onAcknowledgmentsUpdate, updateConnectionStatus, handleSnapshotError);
  }

  const unsubRules = onSnapshot(
    doc(db, 'config', 'legalityRules'),
    (snap) => {
      updateConnectionStatus();
      if (snap.exists()) {
        const data = snap.data();
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