// Zambia Airways Crew Control PWA - Background Sync & Offline Service Worker
const CACHE_VERSION = 'za-crew-cache-v6';
const ROSTER_DATA_CACHE = 'za-roster-data-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/pwa-192.png',
  '/pwa-512.png',
];

// IndexedDB Helper inside Service Worker
const DB_NAME = 'za_crew_offline_store';
const DB_VERSION = 1;
const STORE_ROSTERS = 'critical_rosters';
const STORE_PENDING_ACKS = 'pending_acknowledgments';
const STORE_SYNC_LOGS = 'sync_logs';

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_ROSTERS)) {
        db.createObjectStore(STORE_ROSTERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_ACKS)) {
        db.createObjectStore(STORE_PENDING_ACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_LOGS)) {
        db.createObjectStore(STORE_SYNC_LOGS, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Store critical roster snapshot in IndexedDB
async function saveRosterToDB(rosterSnapshot) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction([STORE_ROSTERS], 'readwrite');
    const store = tx.objectStore(STORE_ROSTERS);
    const record = {
      id: rosterSnapshot.id || 'latest_roster_snapshot',
      period: rosterSnapshot.period || 'current',
      savedAt: new Date().toISOString(),
      data: rosterSnapshot,
    };
    store.put(record);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[SW] Error saving roster to IndexedDB:', err);
  }
}

// Retrieve cached roster snapshot from IndexedDB
async function getRosterFromDB(snapshotId = 'latest_roster_snapshot') {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction([STORE_ROSTERS], 'readonly');
    const store = tx.objectStore(STORE_ROSTERS);
    const request = store.get(snapshotId);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Save pending offline acknowledgment
async function savePendingAckToDB(ack) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction([STORE_PENDING_ACKS], 'readwrite');
    const store = tx.objectStore(STORE_PENDING_ACKS);
    const item = {
      ...ack,
      queuedAt: ack.queuedAt || new Date().toISOString(),
      syncStatus: 'PENDING_SYNC',
    };
    store.put(item);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[SW] Error queueing ack in IndexedDB:', err);
    return null;
  }
}

// Get all pending acknowledgments from IndexedDB
async function getPendingAcksFromDB() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction([STORE_PENDING_ACKS], 'readonly');
    const store = tx.objectStore(STORE_PENDING_ACKS);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Delete pending acknowledgment after successful sync
async function removePendingAckFromDB(id) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction([STORE_PENDING_ACKS], 'readwrite');
    const store = tx.objectStore(STORE_PENDING_ACKS);
    store.delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// Broadcast message to all active client windows
async function broadcastToClients(message) {
  const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of allClients) {
    client.postMessage(message);
  }
}

// Process pending acknowledgments sync
async function flushPendingAcknowledgments() {
  const pendingAcks = await getPendingAcksFromDB();
  if (pendingAcks.length === 0) return { success: true, count: 0 };

  console.log(`[SW Background Sync] Processing ${pendingAcks.length} pending roster acknowledgments...`);
  await broadcastToClients({
    type: 'SYNC_IN_PROGRESS',
    count: pendingAcks.length,
    timestamp: new Date().toISOString(),
  });

  // Notify clients with full payload of synced acks
  await broadcastToClients({
    type: 'OFFLINE_ACKS_READY_FOR_UPSTREAM_SYNC',
    acks: pendingAcks,
    timestamp: new Date().toISOString(),
  });

  return { success: true, count: pendingAcks.length, acks: pendingAcks };
}

// --- Service Worker Lifecycle ---

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION && name !== ROSTER_DATA_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: safely bypass dev assets and APIs to prevent browser freezing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Never intercept Firebase / external API requests
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebaseinstallations.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('google.com')
  ) {
    return;
  }

  // Never intercept Vite dev server scripts, dynamic modules, or websocket connections
  if (
    url.includes('/@vite/') ||
    url.includes('/@fs/') ||
    url.includes('/src/') ||
    url.includes('/node_modules/') ||
    url.includes('__vite_ping') ||
    url.includes('hot-update') ||
    url.includes('.tsx') ||
    url.includes('.ts') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // Handle static images and icons offline
  if (request.destination === 'image' || url.includes('/favicon') || url.includes('/manifest.json')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

// --- Background Sync Event Handler ---
self.addEventListener('sync', (event) => {
  if (
    event.tag === 'sync-roster-acknowledgments' ||
    event.tag === 'za-sync-acks' ||
    event.tag === 'offline-sync'
  ) {
    console.log('[SW] Background Sync event triggered:', event.tag);
    event.waitUntil(flushPendingAcknowledgments());
  }
});

// Periodic Background Sync (when supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-roster-sync') {
    event.waitUntil(flushPendingAcknowledgments());
  }
});

// --- Message Channel for UI & Offline Sync Manager ---
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'CACHE_CRITICAL_ROSTER': {
      await saveRosterToDB(payload);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, timestamp: new Date().toISOString() });
      }
      break;
    }

    case 'GET_CACHED_ROSTER': {
      const roster = await getRosterFromDB(payload?.id || 'latest_roster_snapshot');
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, roster });
      }
      break;
    }

    case 'QUEUE_OFFLINE_ACKNOWLEDGMENT': {
      const savedAck = await savePendingAckToDB(payload);
      try {
        if ('sync' in self.registration) {
          await self.registration.sync.register('sync-roster-acknowledgments');
        }
      } catch {
        // Fallback handled in window
      }

      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, ack: savedAck });
      }

      if (navigator.onLine) {
        flushPendingAcknowledgments();
      }
      break;
    }

    case 'GET_PENDING_ACKNOWLEDGMENTS': {
      const pendingAcks = await getPendingAcksFromDB();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, acks: pendingAcks });
      }
      break;
    }

    case 'REMOVE_SYNCED_ACKNOWLEDGMENT': {
      if (payload?.id) {
        await removePendingAckFromDB(payload.id);
      }
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;
    }

    case 'CLEAR_ALL_SYNCED_ACKS': {
      const ids = payload?.ids || [];
      for (const id of ids) {
        await removePendingAckFromDB(id);
      }
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;
    }

    case 'FLUSH_NOW': {
      const result = await flushPendingAcknowledgments();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage(result);
      }
      break;
    }

    case 'PING': {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ pong: true, version: CACHE_VERSION });
      }
      break;
    }

    default:
      break;
  }
});

