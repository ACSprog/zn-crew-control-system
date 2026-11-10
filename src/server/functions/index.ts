/**
 * Firebase Cloud Functions Entry Point Definition (index.ts)
 * Ready for `firebase-tools` deployment or server-side execution.
 * 
 * Defines:
 * - onNotificationQueueCreated: Firestore trigger when item queued
 * - processNotificationBatchJob: Scheduled Cron function for scheduled queue retries
 * - whatsAppWebhookHandler: HTTPS Cloud Function for delivery & read receipts
 * - emailWebhookHandler: HTTPS Cloud Function for SendGrid delivery receipts
 * - dispatchManualNotification: Callable Cloud Function
 */

import {
  handleNotificationQueueTrigger,
  handleProviderWebhookEvent,
  cloudGateway,
} from './notificationFunctions';
import {
  NotificationItem,
  NotificationPriority,
  NotificationStatus,
} from '../../types/notifications';
import {
  WhatsAppSendParams,
  EmailSendParams,
} from '../providers/types';

/**
 * Callable Function Definition: Dispatch single or bulk notification
 */
export async function dispatchNotificationCallable(data: {
  channel: 'WHATSAPP' | 'EMAIL';
  recipient: string;
  recipientName?: string;
  subject?: string;
  message: string;
  priority?: NotificationPriority;
}) {
  if (data.channel === 'WHATSAPP') {
    return await cloudGateway.dispatchWhatsApp({
      recipientPhone: data.recipient,
      recipientName: data.recipientName,
      messageText: data.message,
      priority: data.priority || 'NORMAL',
    });
  } else {
    return await cloudGateway.dispatchEmail({
      recipientEmail: data.recipient,
      recipientName: data.recipientName,
      subject: data.subject || 'Zambia Airways Operational Notice',
      textBody: data.message,
      priority: data.priority || 'NORMAL',
    });
  }
}

/**
 * Cloud Function: onWrite / onCreate Trigger for Firestore `/notificationQueue/{queueId}`
 */
export async function onNotificationQueueCreated(queueItem: NotificationItem) {
  return await handleNotificationQueueTrigger(queueItem);
}

/**
 * Cloud Function: Scheduled Queue Sweeper (runs every 1 minute)
 */
export async function scheduledQueueSweeper(pendingItems: NotificationItem[]) {
  const results = [];
  for (const item of pendingItems) {
    if (item.status === 'PENDING' || item.status === 'QUEUED') {
      const res = await handleNotificationQueueTrigger(item);
      results.push(res);
    }
  }
  return results;
}
