/**
 * Notification Logs Module & Firestore Database Handler
 * Manages `/notificationLogs/{logId}` collection records, real-time sync, and audit trails.
 */

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../utils/firebaseSync';
import {
  NotificationLogDocument,
  NotificationQueueItem,
  NotificationStatus,
  NotificationLogFilter,
} from './types';
import {
  createStatusTimelineItem,
  computeDeliveryDuration,
} from './statusTracker';

const LOCAL_NOTIFICATION_LOGS_KEY = 'zambia_airways_notification_logs';

export enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
  path: string | null;
  timestamp: string;
}

/**
 * Standardized Firestore error handler following required platform specifications
 */
export function handleFirestoreError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString(),
  };
  console.error('[NotificationLogs Firestore Error]:', JSON.stringify(errInfo));
}

/**
 * Loads notification logs from local offline storage
 */
export function getLocalNotificationLogs(): NotificationLogDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATION_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error loading local notification logs:', err);
    return [];
  }
}

/**
 * Persists notification logs to local offline storage
 */
export function saveLocalNotificationLogs(logs: NotificationLogDocument[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_NOTIFICATION_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Error saving local notification logs:', err);
  }
}

/**
 * Generates a unique log ID
 */
export function generateNotificationLogId(queueId?: string): string {
  if (queueId) return `log_${queueId.replace(/^nq_/, '')}`;
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Creates or updates a NotificationLogDocument in Firestore and local storage
 */
export async function createNotificationLog(
  item: NotificationQueueItem,
  extra?: Partial<NotificationLogDocument>
): Promise<NotificationLogDocument> {
  const logId = generateNotificationLogId(item.id);
  const now = new Date().toISOString();

  const logDoc: NotificationLogDocument = {
    id: logId,
    queueId: item.id,
    recipientId: item.recipientId,
    recipientName: item.recipientName,
    recipientStaffNumber: item.recipientStaffNumber,
    recipientContact:
      item.recipientWhatsApp || item.recipientPhone || item.recipientEmail || 'N/A',
    channel: item.channel,
    notificationType: item.notificationType,
    priority: item.priority,
    subject: item.subject,
    message: item.message,
    status: item.status,
    statusTimeline: item.statusTimeline || [
      createStatusTimelineItem(item.status, item.initiatedBy || 'OCC Crew Control', 'Log record created'),
    ],
    flightNumber: item.flightNumber,
    flightDate: item.flightDate,
    origin: item.origin,
    destination: item.destination,
    dutyCode: item.dutyCode,
    aircraftType: item.aircraftType,
    aircraftRegistration: item.aircraftRegistration,
    provider: item.provider,
    providerMessageId: item.providerMessageId,
    providerStatusCode: item.providerResponse?.statusCode,
    providerStatusMessage: item.providerResponse?.statusText,
    deliveryDurationMs: computeDeliveryDuration(item),
    retryCount: item.retryCount || 0,
    errorMessage: item.errorMessage,
    createdAt: item.createdAt || now,
    sentAt: item.sentAt,
    deliveredAt: item.deliveredAt,
    readAt: item.readAt,
    failedAt: item.failedAt,
    initiatedBy: item.initiatedBy,
    ...extra,
  };

  // 1. Save to local storage cache immediately
  const localLogs = getLocalNotificationLogs();
  const existingIdx = localLogs.findIndex((l) => l.id === logId || l.queueId === item.id);
  if (existingIdx >= 0) {
    localLogs[existingIdx] = logDoc;
  } else {
    localLogs.unshift(logDoc);
  }
  saveLocalNotificationLogs(localLogs);

  // 2. Persist to Firestore collection `/notificationLogs/{logId}`
  const logPath = `notificationLogs/${logId}`;
  try {
    const docRef = doc(db, 'notificationLogs', logId);
    await setDoc(docRef, logDoc, { merge: true });
  } catch (err) {
    handleFirestoreError(err, FirestoreOperationType.WRITE, logPath);
  }

  return logDoc;
}

/**
 * Updates status of a log entry in Firestore and local storage
 */
export async function updateNotificationLogStatus(
  logId: string,
  newStatus: NotificationStatus,
  options?: {
    actorOrProvider?: string;
    note?: string;
    providerMessageId?: string;
    errorMessage?: string;
    providerStatusCode?: number;
    providerStatusMessage?: string;
    acknowledgedByCrew?: boolean;
    acknowledgedAt?: string;
  }
): Promise<NotificationLogDocument | null> {
  const localLogs = getLocalNotificationLogs();
  const index = localLogs.findIndex((l) => l.id === logId);
  if (index === -1) return null;

  const current = localLogs[index];
  const now = new Date().toISOString();

  const timelineItem = createStatusTimelineItem(
    newStatus,
    options?.actorOrProvider || current.provider || 'System Provider',
    options?.note
  );

  const updated: NotificationLogDocument = {
    ...current,
    status: newStatus,
    statusTimeline: [...(current.statusTimeline || []), timelineItem],
    sentAt: newStatus === 'SENT' ? (current.sentAt || now) : current.sentAt,
    deliveredAt: newStatus === 'DELIVERED' ? (current.deliveredAt || now) : current.deliveredAt,
    readAt: newStatus === 'READ' ? (current.readAt || now) : current.readAt,
    failedAt: newStatus === 'FAILED' ? (current.failedAt || now) : current.failedAt,
    providerMessageId: options?.providerMessageId || current.providerMessageId,
    errorMessage: options?.errorMessage || current.errorMessage,
    providerStatusCode: options?.providerStatusCode ?? current.providerStatusCode,
    providerStatusMessage: options?.providerStatusMessage || current.providerStatusMessage,
    acknowledgedByCrew: options?.acknowledgedByCrew ?? current.acknowledgedByCrew,
    acknowledgedAt: options?.acknowledgedAt || current.acknowledgedAt,
    deliveryDurationMs: computeDeliveryDuration({
      createdAt: current.createdAt,
      deliveredAt: newStatus === 'DELIVERED' ? now : current.deliveredAt,
      readAt: newStatus === 'READ' ? now : current.readAt,
    }),
  };

  localLogs[index] = updated;
  saveLocalNotificationLogs(localLogs);

  // Sync to Firestore
  const logPath = `notificationLogs/${logId}`;
  try {
    const docRef = doc(db, 'notificationLogs', logId);
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    handleFirestoreError(err, FirestoreOperationType.UPDATE, logPath);
  }

  return updated;
}

/**
 * Subscribes to real-time updates from Firestore `/notificationLogs` collection
 */
export function subscribeToNotificationLogs(
  onUpdate: (logs: NotificationLogDocument[]) => void,
  maxRecords: number = 150
): () => void {
  const collectionPath = 'notificationLogs';
  try {
    const logsQuery = query(
      collection(db, collectionPath),
      orderBy('createdAt', 'desc'),
      limit(maxRecords)
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const firestoreLogs: NotificationLogDocument[] = [];
        snapshot.forEach((docSnap) => {
          firestoreLogs.push(docSnap.data() as NotificationLogDocument);
        });

        if (firestoreLogs.length > 0) {
          // Merge with local logs
          const localMap = new Map<string, NotificationLogDocument>();
          getLocalNotificationLogs().forEach((l) => localMap.set(l.id, l));
          firestoreLogs.forEach((l) => localMap.set(l.id, l));

          const merged = Array.from(localMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveLocalNotificationLogs(merged);
          onUpdate(merged);
        } else {
          onUpdate(getLocalNotificationLogs());
        }
      },
      (error) => {
        handleFirestoreError(error, FirestoreOperationType.GET, collectionPath);
        onUpdate(getLocalNotificationLogs());
      }
    );

    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, FirestoreOperationType.GET, collectionPath);
    onUpdate(getLocalNotificationLogs());
    return () => {};
  }
}

/**
 * Filters notification logs based on criteria
 */
export function filterNotificationLogs(
  logs: NotificationLogDocument[],
  filter: NotificationLogFilter
): NotificationLogDocument[] {
  return logs.filter((log) => {
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const match =
        log.recipientName?.toLowerCase().includes(q) ||
        log.recipientStaffNumber?.toLowerCase().includes(q) ||
        log.recipientContact?.toLowerCase().includes(q) ||
        log.flightNumber?.toLowerCase().includes(q) ||
        log.subject?.toLowerCase().includes(q) ||
        log.message?.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filter.channel && filter.channel !== 'ALL' && log.channel !== filter.channel) {
      return false;
    }

    if (filter.status && filter.status !== 'ALL' && log.status !== filter.status) {
      return false;
    }

    if (filter.priority && filter.priority !== 'ALL' && log.priority !== filter.priority) {
      return false;
    }

    if (filter.notificationType && filter.notificationType !== 'ALL' && log.notificationType !== filter.notificationType) {
      return false;
    }

    if (filter.recipientId && log.recipientId !== filter.recipientId) {
      return false;
    }

    if (filter.flightNumber && log.flightNumber !== filter.flightNumber) {
      return false;
    }

    if (filter.startDate) {
      if (new Date(log.createdAt) < new Date(filter.startDate)) return false;
    }

    if (filter.endDate) {
      if (new Date(log.createdAt) > new Date(filter.endDate)) return false;
    }

    return true;
  });
}
