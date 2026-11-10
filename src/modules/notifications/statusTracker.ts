/**
 * Notification Status State Machine & SLA Diagnostics
 * Validates allowed state transitions and computes delivery performance.
 */

import {
  NotificationStatus,
  NotificationStatusHistoryItem,
  NotificationQueueItem,
  NotificationLogDocument,
} from './types';

// State transition graph defining permitted flows
const ALLOWED_TRANSITIONS: Record<NotificationStatus, NotificationStatus[]> = {
  PENDING: ['QUEUED', 'SENDING', 'CANCELLED'],
  QUEUED: ['SENDING', 'CANCELLED', 'FAILED'],
  SENDING: ['SENT', 'FAILED', 'CANCELLED'],
  SENT: ['DELIVERED', 'READ', 'FAILED'],
  DELIVERED: ['READ'],
  READ: [], // Terminal read state
  FAILED: ['QUEUED', 'SENDING', 'CANCELLED'], // Retriable
  CANCELLED: [], // Terminal cancelled state
};

/**
 * Checks whether a requested status transition is legally allowed by the state machine
 */
export function isValidStatusTransition(
  currentStatus: NotificationStatus,
  nextStatus: NotificationStatus
): boolean {
  if (currentStatus === nextStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

/**
 * Creates a structured timeline history item for tracking state changes
 */
export function createStatusTimelineItem(
  status: NotificationStatus,
  actorOrProvider: string,
  note?: string,
  details?: Record<string, unknown>
): NotificationStatusHistoryItem {
  return {
    status,
    timestamp: new Date().toISOString(),
    actorOrProvider,
    note,
    details,
  };
}

/**
 * Computes delivery duration in milliseconds between creation and delivery/read
 */
export function computeDeliveryDuration(item: {
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
}): number | undefined {
  if (!item.deliveredAt && !item.readAt) return undefined;
  const start = new Date(item.createdAt).getTime();
  const end = new Date(item.deliveredAt || item.readAt!).getTime();
  const diff = end - start;
  return diff >= 0 ? diff : undefined;
}

/**
 * Calculates delivery statistics from an array of queue items or logs
 */
export function calculateDeliveryMetrics(items: (NotificationQueueItem | NotificationLogDocument)[]) {
  const total = items.length;
  if (total === 0) {
    return {
      total: 0,
      deliveredRate: 0,
      readRate: 0,
      failureRate: 0,
      avgDeliveryTimeSeconds: 0,
    };
  }

  let deliveredCount = 0;
  let readCount = 0;
  let failedCount = 0;
  let totalDeliveryDurationMs = 0;
  let itemsWithDuration = 0;

  for (const item of items) {
    if (item.status === 'DELIVERED' || item.status === 'READ') {
      deliveredCount++;
    }
    if (item.status === 'READ') {
      readCount++;
    }
    if (item.status === 'FAILED') {
      failedCount++;
    }

    const duration = computeDeliveryDuration(item);
    if (duration !== undefined) {
      totalDeliveryDurationMs += duration;
      itemsWithDuration++;
    }
  }

  const deliveredRate = Math.round((deliveredCount / total) * 100);
  const readRate = Math.round((readCount / total) * 100);
  const failureRate = Math.round((failedCount / total) * 100);
  const avgDeliveryTimeSeconds =
    itemsWithDuration > 0
      ? Math.round((totalDeliveryDurationMs / itemsWithDuration) / 1000)
      : 0;

  return {
    total,
    deliveredRate,
    readRate,
    failureRate,
    avgDeliveryTimeSeconds,
  };
}
