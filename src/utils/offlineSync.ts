import {
  Flight,
  CrewMember,
  Assignment,
  LeaveTrainingRecord,
  AircraftFleet,
  LegalityRules,
  RosterAcknowledgment,
} from '../types';
import {
  loadAcknowledgments,
  saveAcknowledgments,
  recordCrewAcknowledgment,
} from './storage';
import { syncAcknowledgmentsToFirebase } from './firebaseSync';

export interface CriticalRosterSnapshot {
  id: string;
  period: string; // e.g. "2026-08"
  timestamp: string;
  flights: Flight[];
  crew: CrewMember[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  fleet: AircraftFleet[];
  rules: LegalityRules;
  publishedCount: number;
}

export interface OfflineSyncStatus {
  isOnline: boolean;
  serviceWorkerActive: boolean;
  backgroundSyncSupported: boolean;
  pendingCount: number;
  lastCachedAt: string | null;
  lastSyncedAt: string | null;
  syncInProgress: boolean;
}

const LOCAL_PENDING_ACKS_KEY = 'za_pending_offline_acknowledgments';
const LAST_CACHED_ROSTER_KEY = 'za_last_cached_roster_snapshot';
const LAST_SYNCED_TIMESTAMP_KEY = 'za_last_synced_timestamp';

// In-memory subscribers
type SyncListener = (status: OfflineSyncStatus) => void;
const listeners: Set<SyncListener> = new Set();

let swRegistration: ServiceWorkerRegistration | null = null;
let syncInProgressState = false;

/**
 * Initializes Service Worker registration and offline event listeners
 */
export async function initOfflineSyncService(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Listen to network transitions
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Network connection restored. Triggering background sync flush...');
    notifyListeners();
    flushPendingAcknowledgments();
  });

  window.addEventListener('offline', () => {
    console.warn('[OfflineSync] Device went offline. Remote airport cached roster mode active.');
    notifyListeners();
  });

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      swRegistration = reg;

      // Listen for messages from Service Worker
      navigator.serviceWorker.addEventListener('message', async (event) => {
        const { type, acks } = event.data || {};
        if (type === 'OFFLINE_ACKS_READY_FOR_UPSTREAM_SYNC' && Array.isArray(acks)) {
          await handleUpstreamSync(acks);
        } else if (type === 'SYNC_IN_PROGRESS') {
          syncInProgressState = true;
          notifyListeners();
        }
      });

      console.log('[OfflineSync] Service Worker registered with scope:', reg.scope);
    } catch (err) {
      console.warn('[OfflineSync] SW registration notice:', err);
    }
  }

  // Attempt initial sync if online
  if (navigator.onLine) {
    setTimeout(() => {
      flushPendingAcknowledgments();
    }, 1500);
  }
}

let cacheDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Caches complete critical roster data in Service Worker & local offline storage (debounced)
 */
export async function cacheCriticalRoster(snapshot: CriticalRosterSnapshot): Promise<boolean> {
  if (cacheDebounceTimer) {
    clearTimeout(cacheDebounceTimer);
  }

  return new Promise((resolve) => {
    cacheDebounceTimer = setTimeout(() => {
      try {
        localStorage.setItem(LAST_CACHED_ROSTER_KEY, JSON.stringify(snapshot));
        localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, new Date().toISOString());

        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_CRITICAL_ROSTER',
            payload: snapshot,
          });
        }
        notifyListeners();
        resolve(true);
      } catch (err) {
        console.warn('[OfflineSync] Error caching critical roster data:', err);
        resolve(false);
      }
    }, 1200);
  });
}

/**
 * Loads the latest cached critical roster data if offline or unavailable
 */
export function getCachedCriticalRoster(): CriticalRosterSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_CACHED_ROSTER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Queues an acknowledgment when device is offline or remote
 */
export async function queueOfflineAcknowledgment(
  crewId: string,
  staffNumber: string,
  crewName: string,
  rosterPeriod: string = '2026-08'
): Promise<RosterAcknowledgment> {
  // First, record locally in application storage
  const ack = recordCrewAcknowledgment(crewId, staffNumber, crewName, rosterPeriod);

  const pendingItem: RosterAcknowledgment & { queuedAt: string; syncStatus: string } = {
    ...ack,
    queuedAt: new Date().toISOString(),
    syncStatus: navigator.onLine ? 'SYNCING' : 'QUEUED_OFFLINE',
  };

  // Add to local pending list
  const currentPending = getLocalPendingAcks();
  const filtered = currentPending.filter((item) => !(item.crewId === crewId && item.rosterPeriod === rosterPeriod));
  const updatedPending = [...filtered, pendingItem];
  localStorage.setItem(LOCAL_PENDING_ACKS_KEY, JSON.stringify(updatedPending));

  // Post to Service Worker
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'QUEUE_OFFLINE_ACKNOWLEDGMENT',
      payload: pendingItem,
    });
  }

  // Register for Background Sync if supported
  try {
    if (swRegistration && 'sync' in swRegistration) {
      // @ts-expect-error Background sync API types
      await swRegistration.sync.register('sync-roster-acknowledgments');
      console.log('[OfflineSync] Background Sync registered tag: sync-roster-acknowledgments');
    }
  } catch (syncErr) {
    console.log('[OfflineSync] Background sync registration deferred to online event:', syncErr);
  }

  notifyListeners();

  // If online, flush immediately
  if (navigator.onLine) {
    flushPendingAcknowledgments();
  }

  return ack;
}

/**
 * Flushes all pending acknowledgments upstream to Firebase & OCC
 */
export async function flushPendingAcknowledgments(): Promise<{ success: boolean; syncedCount: number }> {
  if (!navigator.onLine) {
    return { success: false, syncedCount: 0 };
  }

  const pendingList = getLocalPendingAcks();
  if (pendingList.length === 0) {
    syncInProgressState = false;
    notifyListeners();
    return { success: true, syncedCount: 0 };
  }

  syncInProgressState = true;
  notifyListeners();

  try {
    const existingAcks = loadAcknowledgments();
    const map = new Map<string, RosterAcknowledgment>();
    existingAcks.forEach((a) => map.set(`${a.crewId}-${a.rosterPeriod}`, a));
    pendingList.forEach((a) => map.set(`${a.crewId}-${a.rosterPeriod}`, a));

    const combinedAcks = Array.from(map.values());
    saveAcknowledgments(combinedAcks);

    // Push to Firestore
    await syncAcknowledgmentsToFirebase(combinedAcks);

    // Clear local pending queue
    localStorage.removeItem(LOCAL_PENDING_ACKS_KEY);
    localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, new Date().toISOString());

    // Inform Service Worker to clear pending queue
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_ALL_SYNCED_ACKS',
        payload: { ids: pendingList.map((p) => p.id) },
      });
    }

    syncInProgressState = false;
    notifyListeners();
    return { success: true, syncedCount: pendingList.length };
  } catch (err) {
    console.error('[OfflineSync] Error flushing pending acknowledgments:', err);
    syncInProgressState = false;
    notifyListeners();
    return { success: false, syncedCount: 0 };
  }
}

/**
 * Handles upstream sync triggered by Service Worker
 */
async function handleUpstreamSync(acks: RosterAcknowledgment[]) {
  if (acks.length === 0) return;
  const existingAcks = loadAcknowledgments();
  const map = new Map<string, RosterAcknowledgment>();
  existingAcks.forEach((a) => map.set(`${a.crewId}-${a.rosterPeriod}`, a));
  acks.forEach((a) => map.set(`${a.crewId}-${a.rosterPeriod}`, a));

  const combined = Array.from(map.values());
  saveAcknowledgments(combined);
  await syncAcknowledgmentsToFirebase(combined);

  localStorage.removeItem(LOCAL_PENDING_ACKS_KEY);
  localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, new Date().toISOString());
  notifyListeners();
}

/**
 * Helper to get locally queued pending acknowledgments
 */
export function getLocalPendingAcks(): RosterAcknowledgment[] {
  try {
    const raw = localStorage.getItem(LOCAL_PENDING_ACKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Gets the current offline & background sync status
 */
export function getOfflineSyncStatus(): OfflineSyncStatus {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const pendingCount = getLocalPendingAcks().length;
  const lastCachedAt = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_SYNCED_TIMESTAMP_KEY) : null;
  const lastSyncedAt = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_SYNCED_TIMESTAMP_KEY) : null;
  const serviceWorkerActive = Boolean(navigator.serviceWorker?.controller);
  const backgroundSyncSupported = typeof window !== 'undefined' && 'SyncManager' in window;

  return {
    isOnline,
    serviceWorkerActive,
    backgroundSyncSupported,
    pendingCount,
    lastCachedAt,
    lastSyncedAt,
    syncInProgress: syncInProgressState,
  };
}

/**
 * Subscribes a React component to real-time sync & network status changes
 */
export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(getOfflineSyncStatus());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  const status = getOfflineSyncStatus();
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch (err) {
      console.warn('[OfflineSync] Listener error:', err);
    }
  });
}
