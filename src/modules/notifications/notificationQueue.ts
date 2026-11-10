/**
 * Notification Queue Engine
 * Handles active message queues, priority dispatching, status transitions, and retry policies.
 */

import {
  NotificationQueueItem,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
  NotificationQueueSummary,
} from './types';
import {
  isValidStatusTransition,
  createStatusTimelineItem,
} from './statusTracker';

const NOTIFICATION_QUEUE_KEY = 'zambia_airways_notification_queue';

/**
 * Loads the active notification queue from local/application storage
 */
export function getNotificationQueue(): NotificationQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error loading notification queue from storage:', err);
    return [];
  }
}

/**
 * Persists the notification queue to local storage
 */
export function saveNotificationQueue(queue: NotificationQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATION_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Error saving notification queue to storage:', err);
  }
}

/**
 * Helper to generate a unique Notification Queue ID
 */
export function generateNotificationQueueId(): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `nq_${timestamp}_${rand}`;
}

/**
 * Creates a new NotificationQueueItem with initialized status tracking
 */
export function createQueueItem(params: {
  recipientId: string;
  recipientName: string;
  recipientRole?: string;
  recipientStaffNumber?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientWhatsApp?: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  priority?: NotificationPriority;
  templateId?: string;
  subject: string;
  message: string;
  htmlMessage?: string;
  variables?: Record<string, string | number>;
  flightNumber?: string;
  flightDate?: string;
  origin?: string;
  destination?: string;
  reportTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  aircraftType?: string;
  aircraftRegistration?: string;
  position?: string;
  dutyCode?: string;
  dutyTime?: string;
  restTime?: string;
  notificationReason?: string;
  previousAssignment?: string;
  newAssignment?: string;
  scheduledAt?: string;
  initiatedBy?: string;
  provider?: string;
  maxRetries?: number;
}): NotificationQueueItem {
  const now = new Date().toISOString();
  const initialStatus: NotificationStatus = params.scheduledAt ? 'PENDING' : 'QUEUED';
  const initialTimeline = [
    createStatusTimelineItem(
      initialStatus,
      params.initiatedBy || 'OCC Operations Control',
      params.scheduledAt
        ? `Scheduled for delivery at ${params.scheduledAt}`
        : 'Enqueued into operational dispatch queue'
    ),
  ];

  return {
    id: generateNotificationQueueId(),
    recipientId: params.recipientId,
    recipientName: params.recipientName,
    recipientRole: params.recipientRole,
    recipientStaffNumber: params.recipientStaffNumber,
    recipientEmail: params.recipientEmail,
    recipientPhone: params.recipientPhone,
    recipientWhatsApp: params.recipientWhatsApp,
    channel: params.channel,
    notificationType: params.notificationType,
    priority: params.priority || 'NORMAL',
    templateId: params.templateId,
    subject: params.subject,
    message: params.message,
    htmlMessage: params.htmlMessage,
    variables: params.variables,
    flightNumber: params.flightNumber,
    flightDate: params.flightDate,
    origin: params.origin,
    destination: params.destination,
    reportTime: params.reportTime,
    departureTime: params.departureTime,
    arrivalTime: params.arrivalTime,
    aircraftType: params.aircraftType,
    aircraftRegistration: params.aircraftRegistration,
    position: params.position,
    dutyCode: params.dutyCode,
    dutyTime: params.dutyTime,
    restTime: params.restTime,
    notificationReason: params.notificationReason,
    previousAssignment: params.previousAssignment,
    newAssignment: params.newAssignment,
    status: initialStatus,
    statusTimeline: initialTimeline,
    createdAt: now,
    scheduledAt: params.scheduledAt,
    provider: params.provider || (params.channel === 'WHATSAPP' ? 'META_CLOUD_API' : 'SMTP_RELAY'),
    retryCount: 0,
    maxRetries: params.maxRetries ?? 3,
    retryHistory: [],
    initiatedBy: params.initiatedBy || 'OCC Crew Control',
  };
}

/**
 * Enqueues a single notification item
 */
export function enqueueNotification(item: NotificationQueueItem): NotificationQueueItem[] {
  const queue = getNotificationQueue();
  const updated = [item, ...queue];
  saveNotificationQueue(updated);
  return updated;
}

/**
 * Enqueues a batch of notifications
 */
export function enqueueBulkNotifications(items: NotificationQueueItem[]): NotificationQueueItem[] {
  const queue = getNotificationQueue();
  const updated = [...items, ...queue];
  saveNotificationQueue(updated);
  return updated;
}

/**
 * Updates a queue item's status, recording timeline history
 */
export function updateQueueItemStatus(
  queueId: string,
  newStatus: NotificationStatus,
  options?: {
    actorOrProvider?: string;
    note?: string;
    providerMessageId?: string;
    errorMessage?: string;
    providerResponse?: { statusCode?: number; statusText?: string; rawResponse?: string };
    details?: Record<string, unknown>;
  }
): NotificationQueueItem | null {
  const queue = getNotificationQueue();
  const index = queue.findIndex((item) => item.id === queueId);
  if (index === -1) return null;

  const item = queue[index];
  if (!isValidStatusTransition(item.status, newStatus)) {
    console.warn(`[NotificationQueue] Invalid status transition from ${item.status} to ${newStatus}`);
  }

  const now = new Date().toISOString();
  const timelineItem = createStatusTimelineItem(
    newStatus,
    options?.actorOrProvider || item.provider || 'System Dispatcher',
    options?.note,
    options?.details
  );

  const updatedItem: NotificationQueueItem = {
    ...item,
    status: newStatus,
    statusTimeline: [...(item.statusTimeline || []), timelineItem],
    sentAt: newStatus === 'SENT' ? now : item.sentAt,
    deliveredAt: newStatus === 'DELIVERED' ? now : item.deliveredAt,
    readAt: newStatus === 'READ' ? now : item.readAt,
    failedAt: newStatus === 'FAILED' ? now : item.failedAt,
    providerMessageId: options?.providerMessageId || item.providerMessageId,
    errorMessage: options?.errorMessage || (newStatus !== 'FAILED' ? undefined : item.errorMessage),
    providerResponse: options?.providerResponse || item.providerResponse,
  };

  queue[index] = updatedItem;
  saveNotificationQueue(queue);
  return updatedItem;
}

/**
 * Retries a failed notification queue item
 */
export function retryQueueItem(queueId: string): NotificationQueueItem | null {
  const queue = getNotificationQueue();
  const index = queue.findIndex((item) => item.id === queueId);
  if (index === -1) return null;

  const item = queue[index];
  const nextAttempt = (item.retryCount || 0) + 1;

  const timelineItem = createStatusTimelineItem(
    'QUEUED',
    'OCC Retry Dispatcher',
    `Manual retry attempt #${nextAttempt} queued`
  );

  const updatedItem: NotificationQueueItem = {
    ...item,
    status: 'QUEUED',
    retryCount: nextAttempt,
    errorMessage: undefined,
    statusTimeline: [...(item.statusTimeline || []), timelineItem],
  };

  queue[index] = updatedItem;
  saveNotificationQueue(queue);
  return updatedItem;
}

/**
 * Cancels a pending/queued notification
 */
export function cancelQueueItem(queueId: string, reason?: string): NotificationQueueItem | null {
  return updateQueueItemStatus(queueId, 'CANCELLED', {
    actorOrProvider: 'OCC Controller',
    note: reason || 'Cancelled by operator before transmission',
  });
}

/**
 * Clears delivered and read notifications from the active queue
 */
export function clearProcessedQueueItems(): NotificationQueueItem[] {
  const queue = getNotificationQueue();
  const filtered = queue.filter((item) => item.status !== 'DELIVERED' && item.status !== 'READ' && item.status !== 'CANCELLED');
  saveNotificationQueue(filtered);
  return filtered;
}

/**
 * Computes queue statistical summary for dashboards and monitoring
 */
export function getQueueSummary(queue: NotificationQueueItem[] = getNotificationQueue()): NotificationQueueSummary {
  return {
    totalInQueue: queue.length,
    pendingCount: queue.filter((q) => q.status === 'PENDING').length,
    queuedCount: queue.filter((q) => q.status === 'QUEUED').length,
    sendingCount: queue.filter((q) => q.status === 'SENDING').length,
    sentCount: queue.filter((q) => q.status === 'SENT').length,
    deliveredCount: queue.filter((q) => q.status === 'DELIVERED').length,
    readCount: queue.filter((q) => q.status === 'READ').length,
    failedCount: queue.filter((q) => q.status === 'FAILED').length,
    cancelledCount: queue.filter((q) => q.status === 'CANCELLED').length,
    whatsappCount: queue.filter((q) => q.channel === 'WHATSAPP').length,
    emailCount: queue.filter((q) => q.channel === 'EMAIL').length,
    inAppCount: queue.filter((q) => q.channel === 'IN_APP').length,
    criticalCount: queue.filter((q) => q.priority === 'CRITICAL').length,
  };
}
