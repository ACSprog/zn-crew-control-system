export type NotificationChannel = 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'SMS';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFORMATION';

export type NotificationStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED';

export type {
  NotificationQueueItem,
  NotificationLogDocument,
  NotificationStatusHistoryItem,
  NotificationQueueSummary,
  NotificationLogFilter,
} from '../modules/notifications/types';

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

export interface NotificationRetryAttempt {
  attempt: number;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  channel: NotificationChannel;
  provider?: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string; // Crew member ID or User ID
  recipientName: string;
  recipientRole?: string;
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
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  status: NotificationStatus;
  providerMessageId?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  retryHistory: NotificationRetryAttempt[];
  fallbackAttempted?: boolean;
  fallbackChannel?: NotificationChannel;
  fallbackMessageId?: string;
  initiatedBy: string; // e.g., "OCC Crew Control", "Auto Scheduler", "System Admin"
  provider: string; // e.g., "META_CLOUD_API", "SMTP_RELAY", "IN_APP_DISPATCH"
}

export interface WhatsAppTemplate {
  id: string;
  name: string; // internal identifier e.g. "roster_published_v1"
  displayName: string; // friendly title e.g. "Roster Published (STD-01:00)"
  category: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  language: string; // e.g. "en_GB", "en"
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DRAFT';
  header?: string;
  body: string;
  footer?: string;
  buttons?: { type: 'URL' | 'QUICK_REPLY'; text: string; value?: string }[];
  requiredVariables: string[];
  description: string;
  sampleMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  displayName: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  category: 'ROSTER' | 'OPERATIONS' | 'TRAINING' | 'LEAVE' | 'ANNOUNCEMENTS';
  active: boolean;
  requiredVariables: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrewNotificationPreferences {
  crewId: string;
  companyEmail?: string;
  personalEmail?: string;
  mobileNumber?: string;
  whatsAppNumber?: string;
  preferredChannel: 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'ALL';
  whatsAppOptIn: boolean;
  whatsAppConsentDate?: string;
  emailNotificationStatus: 'ACTIVE' | 'BOUNCED' | 'UNSUBSCRIBED' | 'OPTED_OUT';
  channels: {
    whatsApp: {
      operationalAlerts: boolean;
      rosterChanges: boolean;
      flightChanges: boolean;
      disruptions: boolean;
      rosterPublication: boolean;
      dutyReminders: boolean;
    };
    email: {
      operationalAlerts: boolean;
      rosterChanges: boolean;
      flightChanges: boolean;
      training: boolean;
      generalCommunications: boolean;
      rosterPublication: boolean;
      leaveUpdates: boolean;
      dutyReminders: boolean;
    };
    inApp: {
      allNotifications: boolean;
      criticalOnly: boolean;
    };
  };
}

export interface WhatsAppProviderConfig {
  providerId: 'META_CLOUD_API' | 'INFOBIP' | 'TWILIO' | 'MESSAGEBIRD' | 'CUSTOM_WEBHOOK';
  providerName: string;
  wabaId: string; // WhatsApp Business Account ID
  phoneNumberId: string;
  accessTokenMasked: string;
  apiEndpoint: string;
  webhookVerifyToken?: string;
  defaultLanguage: string;
  status: 'ACTIVE' | 'TEST_MODE' | 'INACTIVE' | 'DISABLED';
  lastTestedAt?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | 'DISABLED';
  lastTestResponse?: string;
  rateLimitPerMinute: number;
}

export interface EmailProviderConfig {
  providerType: 'SMTP' | 'SENDGRID' | 'RESEND' | 'AWS_SES' | 'MAILGUN' | 'SERVER_TRANSACTIONAL';
  host: string;
  port: number;
  secure: boolean;
  senderEmail: string;
  senderName: string;
  replyTo: string;
  apiKeyMasked?: string;
  status: 'ACTIVE' | 'TEST_MODE' | 'INACTIVE';
  lastTestedAt?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED';
  lastTestResponse?: string;
}

export interface NotificationSystemSettings {
  autoTriggers: {
    onRosterPublished: boolean;
    onRosterChange: boolean;
    onFlightChange: boolean;
    onCrewReassignment: boolean;
    onDisruption: boolean;
    onTrainingExpiryWarning: boolean;
    onLeaveUpdate: boolean;
    onDutyReminder: boolean;
  };
  dutyReminderTiming: {
    firstReminderHoursBeforeReport: number; // default 12 hours
    secondReminderHoursBeforeReport: number; // default 3 hours
  };
  retrySettings: {
    maxRetryAttempts: number; // default 3
    retryIntervalMinutes: number; // default 5 min
    enableFallbackChannel: boolean; // default true
  };
  priorityMatrix: {
    CRITICAL: NotificationChannel[];
    HIGH: NotificationChannel[];
    NORMAL: NotificationChannel[];
    INFORMATION: NotificationChannel[];
  };
  rateLimiting: {
    maxMessagesPerMinute: number;
  };
}

export interface BulkNotificationRequest {
  targetType:
    | 'ALL_CREW'
    | 'FLIGHT_CREW'
    | 'CABIN_CREW'
    | 'Q400_CREW'
    | 'B737_CREW'
    | 'CAPTAINS'
    | 'FIRST_OFFICERS'
    | 'BASE_LUN'
    | 'BASE_NLA'
    | 'BASE_LVI'
    | 'SELECTED_CREW';
  selectedCrewIds?: string[];
  channels: NotificationChannel[];
  priority: NotificationPriority;
  notificationType: NotificationType;
  subject: string;
  message: string;
  templateId?: string;
  scheduledAt?: string; // ISO String if scheduled in future
}

export interface NotificationFilterState {
  searchQuery: string;
  dateRange: 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH';
  customStartDate?: string;
  customEndDate?: string;
  notificationType: string; // 'ALL' or NotificationType
  channel: string; // 'ALL' or NotificationChannel
  status: string; // 'ALL' or NotificationStatus
  priority: string; // 'ALL' or NotificationPriority
  crewId: string; // 'ALL' or specific crew id
  flightNumber: string; // 'ALL' or specific flight number
}
