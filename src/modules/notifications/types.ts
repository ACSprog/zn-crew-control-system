/**
 * Zambia Airways OCC - Notifications Module Types & Database Schema
 * Defines the operational notification queue, status tracking lifecycle, and Firestore log entities.
 */

export type NotificationChannel = 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFORMATION';

/**
 * Standard Notification Status Lifecycle:
 * PENDING -> QUEUED -> SENDING -> SENT -> DELIVERED -> READ
 *                                 |
 *                                 v
 *                               FAILED -> (Retry) -> QUEUED
 *                                 |
 *                                 v
 *                              CANCELLED
 */
export type NotificationStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED';

export type NotificationType =
  | 'ROSTER_PUBLISHED'
  | 'ROSTER_CHANGE'
  | 'FLIGHT_CHANGE'
  | 'CREW_REASSIGNMENT'
  | 'DISRUPTION'
  | 'TRAINING_REMINDER'
  | 'EXPIRY_WARNING'
  | 'LEAVE_APPROVAL'
  | 'LEAVE_REJECTION'
  | 'LEAVE_MODIFICATION'
  | 'DUTY_REMINDER'
  | 'GENERAL_BROADCAST'
  | 'SYSTEM_ALERT';

export interface NotificationStatusHistoryItem {
  status: NotificationStatus;
  timestamp: string; // ISO 8601
  actorOrProvider: string; // e.g. "OCC Crew Controller", "META_CLOUD_API", "SMTP_RELAY"
  note?: string;
  details?: Record<string, unknown>;
}

export interface NotificationRetryAttempt {
  attempt: number;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  channel: NotificationChannel;
  provider?: string;
}

/**
 * Operational Notification Queue Item
 * Represents an active message in the delivery pipeline.
 */
export interface NotificationQueueItem {
  id: string; // Unique Queue ID (e.g. nq_1723680000000_abc123)
  recipientId: string; // Crew member ID or System user ID
  recipientName: string;
  recipientRole?: string; // e.g. "Captain", "First Officer", "Cabin Crew", "OCC Controller"
  recipientStaffNumber?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientWhatsApp?: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  priority: NotificationPriority;
  templateId?: string;
  subject: string;
  message: string;
  htmlMessage?: string;
  variables?: Record<string, string | number>;

  // Operational Flight / Duty Context
  flightNumber?: string;
  flightDate?: string; // YYYY-MM-DD
  origin?: string; // e.g. "LUN"
  destination?: string; // e.g. "NLA"
  reportTime?: string; // HH:mm
  departureTime?: string; // HH:mm
  arrivalTime?: string; // HH:mm
  aircraftType?: string; // e.g. "DHC-8-Q400", "B737-800"
  aircraftRegistration?: string; // e.g. "9J-ZAM"
  position?: string; // e.g. "Captain", "First Officer"
  dutyCode?: string; // e.g. "FLT", "SBY", "OFF", "TRG"
  dutyTime?: string;
  restTime?: string;
  notificationReason?: string;
  previousAssignment?: string;
  newAssignment?: string;

  // Status & Lifecycle Tracking
  status: NotificationStatus;
  statusTimeline: NotificationStatusHistoryItem[];

  // Timestamps
  createdAt: string; // ISO String
  scheduledAt?: string; // ISO String for scheduled deliveries
  sentAt?: string; // ISO String when dispatched to provider
  deliveredAt?: string; // ISO String when provider confirmed delivery
  readAt?: string; // ISO String when recipient read the message
  failedAt?: string; // ISO String if delivery failed

  // Provider & Diagnostics
  provider: string; // e.g. "META_CLOUD_API", "SMTP_RELAY", "IN_APP_DISPATCH"
  providerMessageId?: string;
  providerResponse?: {
    statusCode?: number;
    statusText?: string;
    rawResponse?: string;
  };
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  retryHistory: NotificationRetryAttempt[];

  // Fallback Channel Handling
  fallbackAttempted?: boolean;
  fallbackChannel?: NotificationChannel;
  fallbackMessageId?: string;

  // Audit Origin
  initiatedBy: string; // e.g. "OCC Crew Control", "Auto Scheduler Engine", "Admin"
}

/**
 * Firestore Database Schema for `notificationLogs` Collection
 * Location: `/notificationLogs/{logId}`
 */
export interface NotificationLogDocument {
  id: string; // Primary Log Document ID
  queueId: string; // Reference to original queue item
  recipientId: string;
  recipientName: string;
  recipientStaffNumber?: string;
  recipientContact: string; // Formatted Phone Number or Email
  channel: NotificationChannel;
  notificationType: NotificationType;
  priority: NotificationPriority;
  subject: string;
  message: string;
  
  // Status Tracking in Firestore
  status: NotificationStatus;
  statusTimeline: NotificationStatusHistoryItem[];

  // Operational Context
  flightNumber?: string;
  flightDate?: string;
  origin?: string;
  destination?: string;
  dutyCode?: string;
  aircraftType?: string;
  aircraftRegistration?: string;
  
  // Provider Metrics
  provider: string;
  providerMessageId?: string;
  providerStatusCode?: number;
  providerStatusMessage?: string;
  deliveryDurationMs?: number; // Time elapsed from creation to delivery

  // Retry & Error Records
  retryCount: number;
  errorMessage?: string;

  // Lifecycle Timestamps
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;

  // Audit & Acknowledgment
  initiatedBy: string;
  acknowledgedByCrew?: boolean;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationQueueSummary {
  totalInQueue: number;
  pendingCount: number;
  queuedCount: number;
  sendingCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  cancelledCount: number;
  whatsappCount: number;
  emailCount: number;
  inAppCount: number;
  criticalCount: number;
}

export interface NotificationLogFilter {
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  channel?: NotificationChannel | 'ALL';
  status?: NotificationStatus | 'ALL';
  priority?: NotificationPriority | 'ALL';
  notificationType?: NotificationType | 'ALL';
  recipientId?: string;
  flightNumber?: string;
}
