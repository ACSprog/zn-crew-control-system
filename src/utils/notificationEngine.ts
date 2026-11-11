import { sendViaPowerAutomate } from './powerAutomateGateway';
import { sendInAppNotification } from './inAppNotifications';
import {
  NotificationItem,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
  WhatsAppTemplate,
  EmailTemplate,
  CrewNotificationPreferences,
  WhatsAppProviderConfig,
  EmailProviderConfig,
  NotificationSystemSettings,
  BulkNotificationRequest,
} from '../types/notifications';
import { CrewMember, Flight, Assignment, LeaveTrainingRecord } from '../types';
import { validateAndFormatPhoneNumber } from './phoneValidator';

// Storage Keys
const NOTIFICATION_STORAGE_KEYS = {
  QUEUE: 'zambia_airways_notification_queue',
  LOGS: 'zambia_airways_notification_logs',
  WHATSAPP_TEMPLATES: 'zambia_airways_whatsapp_templates',
  EMAIL_TEMPLATES: 'zambia_airways_email_templates',
  PREFERENCES: 'zambia_airways_notification_preferences',
  WHATSAPP_CONFIG: 'zambia_airways_whatsapp_config',
  EMAIL_CONFIG: 'zambia_airways_email_config',
  SETTINGS: 'zambia_airways_notification_settings',
};

// ==========================================
// DEFAULT CONFIGURATIONS & TEMPLATES
// ==========================================

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppProviderConfig = {
  providerId: 'META_CLOUD_API',
  providerName: 'Meta WhatsApp Cloud API (Official)',
  wabaId: '102938475619283',
  phoneNumberId: '108429582194830',
  accessTokenMasked: 'EAAO••••••••••••••••••••••••••••••••••••••••ZM',
  apiEndpoint: 'https://graph.facebook.com/v20.0',
  defaultLanguage: 'en_GB',
  status: 'DISABLED',
  rateLimitPerMinute: 80,
  lastTestedAt: new Date().toISOString(),
  lastTestStatus: 'DISABLED',
  lastTestResponse: 'WhatsApp notifications paused / disabled by administrator.',
};

export const DEFAULT_EMAIL_CONFIG: EmailProviderConfig = {
  providerType: 'SMTP',
  host: 'smtp.zambiaairways.co.zm',
  port: 587,
  secure: true,
  senderEmail: 'crewcontrol@zambiaairways.co.zm',
  senderName: 'Zambia Airways Crew Operations Control',
  replyTo: 'occ@zambiaairways.co.zm',
  apiKeyMasked: 'smtp_zn_••••••••••••••••••••••••',
  status: 'ACTIVE',
  lastTestedAt: new Date().toISOString(),
  lastTestStatus: 'SUCCESS',
  lastTestResponse: 'SMTP TLS handshake successful (250 OK)',
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSystemSettings = {
  autoTriggers: {
    onRosterPublished: true,
    onRosterChange: true,
    onFlightChange: true,
    onCrewReassignment: true,
    onDisruption: true,
    onTrainingExpiryWarning: true,
    onLeaveUpdate: true,
    onDutyReminder: true,
  },
  dutyReminderTiming: {
    firstReminderHoursBeforeReport: 12,
    secondReminderHoursBeforeReport: 3,
  },
  retrySettings: {
    maxRetryAttempts: 3,
    retryIntervalMinutes: 5,
    enableFallbackChannel: true,
  },
  priorityMatrix: {
    CRITICAL: ['EMAIL', 'IN_APP'],
    HIGH: ['EMAIL', 'IN_APP'],
    NORMAL: ['EMAIL', 'IN_APP'],
    INFORMATION: ['IN_APP', 'EMAIL'],
  },
  rateLimiting: {
    maxMessagesPerMinute: 60,
  },
};

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'wa_tpl_roster_pub',
    name: 'roster_published_v1',
    displayName: 'Roster Published (STD-01:00)',
    category: 'UTILITY',
    language: 'en_GB',
    status: 'APPROVED',
    header: '✈️ ZAMBIA AIRWAYS CREW ROSTER',
    body: 'Hello {{crew_name}},\n\nYour roster for {{flight_date}} has been officially published.\n\n• Flight: {{flight_number}}\n• Route: {{origin}} - {{destination}}\n• Report Time: {{report_time}} (STD-01:00)\n• Aircraft: {{aircraft_type}} ({{aircraft_registration}})\n• Position: {{position}}\n\nPlease log into the Zambia Airways Crew Control system for your complete roster and FTL compliance acknowledgment.',
    footer: 'Zambia Airways OCC • Safety First',
    buttons: [
      { type: 'URL', text: 'View Full Roster', value: 'https://crew.zambiaairways.co.zm/portal' },
      { type: 'QUICK_REPLY', text: 'Acknowledge Roster' },
    ],
    requiredVariables: ['crew_name', 'flight_date', 'flight_number', 'origin', 'destination', 'report_time', 'aircraft_type', 'aircraft_registration', 'position'],
    description: 'Triggered when monthly or operational flight roster is published.',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'wa_tpl_roster_change',
    name: 'roster_amended_v1',
    displayName: 'Roster Change Notification (Urgent)',
    category: 'UTILITY',
    language: 'en_GB',
    status: 'APPROVED',
    header: '⚠️ OPERATIONAL ROSTER AMENDMENT',
    body: 'Hello {{crew_name}},\n\nPlease be advised that your duty assignment has been revised:\n\n• Flight: {{flight_number}} ({{flight_date}})\n• Previous Duty: {{previous_assignment}}\n• New Assignment: {{new_assignment}}\n• Report Time: {{report_time}}\n• Aircraft: {{aircraft_type}} ({{aircraft_registration}})\n• Reason: {{notification_reason}}\n\nAll changes comply with ZCAA FTL rest requirements. Please confirm receipt in the Crew Portal.',
    footer: 'Zambia Airways Flight Dispatch',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm Change' },
    ],
    requiredVariables: ['crew_name', 'flight_number', 'flight_date', 'previous_assignment', 'new_assignment', 'report_time', 'aircraft_type', 'aircraft_registration', 'notification_reason'],
    description: 'Triggered when duty, sector, or aircraft assignment changes.',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'wa_tpl_flight_change',
    name: 'flight_schedule_change_v1',
    displayName: 'Flight Schedule Change (STD/STA/Delay)',
    category: 'UTILITY',
    language: 'en_GB',
    status: 'APPROVED',
    header: '🕒 FLIGHT SCHEDULE REVISION',
    body: 'Attn: {{crew_name}},\n\nFlight {{flight_number}} on {{flight_date}} has an updated schedule:\n\n• Route: {{origin}} - {{destination}}\n• New STD: {{departure_time}}\n• New STA: {{arrival_time}}\n• Revised Report Time: {{report_time}}\n• Operational Reason: {{notification_reason}}\n\nPlease report in accordance with the revised time.',
    footer: 'OCC Crew Scheduling',
    requiredVariables: ['crew_name', 'flight_number', 'flight_date', 'origin', 'destination', 'departure_time', 'arrival_time', 'report_time', 'notification_reason'],
    description: 'Sent when STD/STA timing or flight status is delayed/advanced.',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'wa_tpl_disruption',
    name: 'disruption_alert_v1',
    displayName: 'Operational Disruption / AOG / Cancellation',
    category: 'UTILITY',
    language: 'en_GB',
    status: 'APPROVED',
    header: '🚨 CRITICAL DISRUPTION ALERT',
    body: 'CRITICAL ALERT for {{crew_name}}:\n\nFlight {{flight_number}} on {{flight_date}} ({{origin}}-{{destination}}) has encountered an operational disruption:\n\n• Condition: {{notification_reason}}\n• Action Required: Please contact OCC Dispatch immediately at +260 211 840 500.\n• Standby Status: Awaiting revised duty pairing.',
    footer: 'Zambia Airways Operations Control Center',
    requiredVariables: ['crew_name', 'flight_number', 'flight_date', 'origin', 'destination', 'notification_reason'],
    description: 'Emergency/critical alerts for AOG, cancellations, or severe weather.',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'wa_tpl_duty_reminder',
    name: 'duty_report_reminder_v1',
    displayName: 'Duty Report Reminder (STD-01:00)',
    category: 'UTILITY',
    language: 'en_GB',
    status: 'APPROVED',
    header: '⏰ DUTY REPORT REMINDER',
    body: 'Good day {{crew_name}},\n\nThis is a reminder for your upcoming duty:\n\n• Flight: {{flight_number}} ({{origin}} ➔ {{destination}})\n• Date: {{flight_date}}\n• Report Time: {{report_time}} (1 hour prior to STD {{departure_time}})\n• Aircraft: {{aircraft_registration}} ({{aircraft_type}})\n• Duty Position: {{position}}\n\nHave a safe and pleasant flight with Zambia Airways.',
    footer: 'Zambia Airways OCC',
    requiredVariables: ['crew_name', 'flight_number', 'origin', 'destination', 'flight_date', 'report_time', 'departure_time', 'aircraft_registration', 'aircraft_type', 'position'],
    description: 'Automated check-in reminder sent 12h or 3h prior to STD.',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'wa_tpl_training_expiry',
    name: 'qualification_expiry_warning_v1',
    displayName: 'Qualification / Document Expiry Alert',
    category: 'UTILITY',
    language: 'en_GB',
    status: 'APPROVED',
    header: '📋 COMPLIANCE EXPIRY WARNING',
    body: 'Dear {{crew_name}},\n\nOur records indicate your {{notification_reason}} is due to expire on {{flight_date}} ({{duty_time}} days remaining).\n\nPlease contact Training & Compliance (training@zambiaairways.co.zm) to complete your renewal to avoid roster restrictions.',
    footer: 'Flight Operations Compliance Department',
    requiredVariables: ['crew_name', 'notification_reason', 'flight_date', 'duty_time'],
    description: 'Sent for upcoming license, medical, or simulator expiries.',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
];

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'eml_tpl_roster_pub',
    name: 'email_roster_published',
    displayName: 'Zambia Airways Official Roster Publication',
    subject: 'Zambia Airways Official Roster Published - {{flight_date}} (Flight {{flight_number}})',
    category: 'ROSTER',
    active: true,
    requiredVariables: ['crew_name', 'flight_date', 'flight_number', 'origin', 'destination', 'report_time', 'aircraft_registration', 'position'],
    description: 'Comprehensive HTML notification sent when monthly/weekly roster is published.',
    plainTextBody: `Dear {{crew_name}},

Your flight roster for {{flight_date}} has been officially published by Zambia Airways Crew Planning.

OPERATIONAL FLIGHT DETAILS:
• Flight Number: {{flight_number}}
• Sector: {{origin}} to {{destination}}
• Scheduled Departure (STD): {{departure_time}}
• Reporting Time: {{report_time}} (STD-01:00)
• Aircraft: {{aircraft_type}} (Registration: {{aircraft_registration}})
• Position: {{position}}

Please log in to the Zambia Airways Crew Control & Scheduling System to view your complete pairings and submit mandatory FTL acknowledgment.

Regards,
Zambia Airways Flight Operations Control
Kenneth Kaunda International Airport, Lusaka`,
    htmlBody: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
  <div style="background: #1B2A4A; padding: 24px; text-align: center; border-bottom: 4px solid #F37C1C;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">ZAMBIA AIRWAYS</h1>
    <p style="color: #F37C1C; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">Flight Operations & Crew Scheduling</p>
  </div>
  <div style="padding: 28px;">
    <h2 style="color: #1B2A4A; font-size: 18px; margin-top: 0;">Official Roster Publication</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">Dear <strong>{{crew_name}}</strong>,</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">Your operational duty assignment for <strong>{{flight_date}}</strong> has been confirmed and published in accordance with ZCAA Flight Time Limitations.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 18px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #64748B; width: 40%;">Flight Number:</td><td style="padding: 6px 0; font-weight: 700; color: #0F172A;">{{flight_number}}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Sector:</td><td style="padding: 6px 0; font-weight: 700; color: #0F172A;">{{origin}} ➔ {{destination}}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Reporting Time:</td><td style="padding: 6px 0; font-weight: 700; color: #F37C1C;">{{report_time}} (STD-01:00)</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Aircraft:</td><td style="padding: 6px 0; font-weight: 600; color: #0F172A;">{{aircraft_type}} ({{aircraft_registration}})</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Duty Position:</td><td style="padding: 6px 0; font-weight: 600; color: #0F172A;">{{position}}</td></tr>
      </table>
    </div>

    <p style="color: #64748B; font-size: 13px; line-height: 1.5;">Please ensure full rest compliance before reporting for duty. Contact OCC at +260 211 840 500 for any inquiries.</p>
  </div>
  <div style="background: #F1F5F9; padding: 16px; text-align: center; color: #94A3B8; font-size: 11px;">
    Zambia Airways Crew Control System • Confidential & Proprietary
  </div>
</div>`,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'eml_tpl_roster_change',
    name: 'email_roster_amended',
    displayName: 'Roster Amendment Notification',
    subject: 'URGENT: Roster Revision - {{flight_number}} ({{flight_date}})',
    category: 'ROSTER',
    active: true,
    requiredVariables: ['crew_name', 'flight_number', 'flight_date', 'previous_assignment', 'new_assignment', 'report_time', 'notification_reason'],
    description: 'Detailed revision email detailing changed duty timings and operational cause.',
    plainTextBody: `Dear {{crew_name}},

Please be advised of an operational amendment to your roster for {{flight_date}}:

• Flight: {{flight_number}}
• Previous Duty: {{previous_assignment}}
• Revised Assignment: {{new_assignment}}
• Reporting Time: {{report_time}}
• Operational Reason: {{notification_reason}}

Please log in to the Crew Portal to confirm receipt.

Zambia Airways Crew Scheduling`,
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="background: #DC2626; padding: 20px; text-align: center; color: white;">
    <h2 style="margin: 0; font-size: 18px;">⚠️ Operational Roster Revision</h2>
  </div>
  <div style="padding: 24px; font-size: 14px; color: #334155;">
    <p>Dear <strong>{{crew_name}}</strong>,</p>
    <p>Your assignment for flight <strong>{{flight_number}}</strong> on <strong>{{flight_date}}</strong> has been updated due to: <em>{{notification_reason}}</em>.</p>
    <table style="width: 100%; margin: 16px 0; border: 1px solid #cbd5e1; border-collapse: collapse;">
      <tr style="background: #f8fafc;"><th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Previous Assignment</th><td style="padding: 8px; border: 1px solid #cbd5e1;">{{previous_assignment}}</td></tr>
      <tr style="background: #ffffff;"><th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">New Assignment</th><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #F37C1C;">{{new_assignment}}</td></tr>
      <tr style="background: #f8fafc;"><th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Report Time</th><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">{{report_time}}</td></tr>
    </table>
    <p style="color: #64748b; font-size: 12px;">This change has been validated against all mandatory FTL legality rules.</p>
  </div>
</div>`,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'eml_tpl_disruption',
    name: 'email_flight_disruption',
    displayName: 'Operational Disruption Notice',
    subject: 'CRITICAL ALERT: Disruption Notice - {{flight_number}} ({{notification_reason}})',
    category: 'OPERATIONS',
    active: true,
    requiredVariables: ['crew_name', 'flight_number', 'flight_date', 'origin', 'destination', 'notification_reason'],
    description: 'Urgent notice for flight delays, cancellations, or AOG situations.',
    plainTextBody: `CRITICAL ALERT - ZAMBIA AIRWAYS OCC

Dear {{crew_name}},

Flight {{flight_number}} on {{flight_date}} ({{origin}} to {{destination}}) has encountered an operational disruption:

Reason: {{notification_reason}}

Please contact OCC Dispatch immediately at +260 211 840 500 for revised pairing instructions.`,
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #EF4444; border-radius: 8px; overflow: hidden;">
  <div style="background: #EF4444; color: white; padding: 18px; text-align: center;">
    <h2 style="margin: 0; font-size: 18px;">🚨 CRITICAL OPERATIONAL DISRUPTION</h2>
  </div>
  <div style="padding: 24px; color: #1E293B;">
    <p>Dear <strong>{{crew_name}}</strong>,</p>
    <p>Please note that flight <strong>{{flight_number}}</strong> ({{origin}} ➔ {{destination}}) scheduled for {{flight_date}} has encountered an operational disruption:</p>
    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 12px; margin: 16px 0; font-weight: bold; color: #991B1B;">
      {{notification_reason}}
    </div>
    <p><strong>Required Action:</strong> Please contact the Operations Control Center (OCC) immediately at <strong>+260 211 840 500</strong>.</p>
  </div>
</div>`,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-14T08:00:00Z',
  },
];

// ==========================================
// NOTIFICATION STORAGE & REPOSITORIES
// ==========================================

export function loadNotificationQueue(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEYS.QUEUE);
    if (!raw) return [];
    const parsed: NotificationItem[] = JSON.parse(raw);
    if (parsed.some(n => n.recipientId?.startsWith('c-') || n.recipientName?.includes('John Banda') || n.recipientName?.includes('Patrick Phiri'))) {
      localStorage.setItem(NOTIFICATION_STORAGE_KEYS.QUEUE, JSON.stringify([]));
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveNotificationQueue(queue: NotificationItem[]): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.QUEUE, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to persist notification queue:', err);
  }
}

export function loadNotificationLogs(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEYS.LOGS);
    if (!raw) {
      const initialLogs = generateInitialNotificationLogs();
      localStorage.setItem(NOTIFICATION_STORAGE_KEYS.LOGS, JSON.stringify(initialLogs));
      return initialLogs;
    }
    const parsed: NotificationItem[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : generateInitialNotificationLogs();
  } catch {
    return generateInitialNotificationLogs();
  }
}

export function saveNotificationLogs(logs: NotificationItem[]): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to persist notification logs:', err);
  }
}

export function loadWhatsAppTemplates(): WhatsAppTemplate[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEYS.WHATSAPP_TEMPLATES);
    if (!raw) return DEFAULT_WHATSAPP_TEMPLATES;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_WHATSAPP_TEMPLATES;
  }
}

export function saveWhatsAppTemplates(templates: WhatsAppTemplate[]): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.WHATSAPP_TEMPLATES, JSON.stringify(templates));
  } catch (err) {
    console.error('Failed to persist WhatsApp templates:', err);
  }
}

export function loadEmailTemplates(): EmailTemplate[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEYS.EMAIL_TEMPLATES);
    if (!raw) return DEFAULT_EMAIL_TEMPLATES;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_EMAIL_TEMPLATES;
  }
}

export function saveEmailTemplates(templates: EmailTemplate[]): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.EMAIL_TEMPLATES, JSON.stringify(templates));
  } catch (err) {
    console.error('Failed to persist Email templates:', err);
  }
}

export function loadWhatsAppConfig(): WhatsAppProviderConfig {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEYS.WHATSAPP_CONFIG);
    if (!raw) return DEFAULT_WHATSAPP_CONFIG;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_WHATSAPP_CONFIG;
  }
}

export function saveWhatsAppConfig(config: WhatsAppProviderConfig): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.WHATSAPP_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to persist WhatsApp config:', err);
  }
}

export function loadEmailConfig(): EmailProviderConfig {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEYS.EMAIL_CONFIG);
    if (!raw) return DEFAULT_EMAIL_CONFIG;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_EMAIL_CONFIG;
  }
}

export function saveEmailConfig(config: EmailProviderConfig): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.EMAIL_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to persist Email config:', err);
  }
}

export function loadNotificationSettings(): NotificationSystemSettings {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSystemSettings): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to persist Notification settings:', err);
  }
}

export function loadCrewPreferences(crewId: string, crewMember?: CrewMember): CrewNotificationPreferences {
  try {
    const raw = localStorage.getItem(`${NOTIFICATION_STORAGE_KEYS.PREFERENCES}_${crewId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }

  return {
    crewId,
    companyEmail: crewMember?.companyEmail || crewMember?.email || `${crewMember?.name.toLowerCase().replace(/\s+/g, '.')}@zambiaairways.co.zm`,
    personalEmail: crewMember?.personalEmail || `${crewMember?.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
    mobileNumber: crewMember?.mobileNumber || crewMember?.phone || '+260971234567',
    whatsAppNumber: crewMember?.whatsAppNumber || crewMember?.phone || '+260971234567',
    preferredChannel: crewMember?.preferredChannel || 'WHATSAPP',
    whatsAppOptIn: crewMember?.whatsAppOptIn ?? true,
    whatsAppConsentDate: '2026-08-01 08:00',
    emailNotificationStatus: crewMember?.emailNotificationStatus || 'ACTIVE',
    channels: {
      whatsApp: {
        operationalAlerts: true,
        rosterChanges: true,
        flightChanges: true,
        disruptions: true,
        rosterPublication: true,
        dutyReminders: true,
      },
      email: {
        operationalAlerts: true,
        rosterChanges: true,
        flightChanges: true,
        training: true,
        generalCommunications: true,
        rosterPublication: true,
        leaveUpdates: true,
        dutyReminders: true,
      },
      inApp: {
        allNotifications: true,
        criticalOnly: false,
      },
    },
  };
}

export function saveCrewPreferences(prefs: CrewNotificationPreferences): void {
  try {
    localStorage.setItem(`${NOTIFICATION_STORAGE_KEYS.PREFERENCES}_${prefs.crewId}`, JSON.stringify(prefs));
  } catch (err) {
    console.error('Failed to persist crew preferences:', err);
  }
}

// ==========================================
// TEMPLATE INTERPOLATION & VALIDATION
// ==========================================

export function interpolateTemplate(
  templateString: string,
  variables: Record<string, string | number | undefined>
): { result: string; missingVariables: string[] } {
  const missingVariables: string[] = [];
  
  const result = templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, varName) => {
    const val = variables[varName];
    if (val === undefined || val === null || val === '') {
      missingVariables.push(varName);
      return `[${varName}]`;
    }
    return String(val);
  });

  return { result, missingVariables };
}

// ==========================================
// PROVIDER ABSTRACTION & DISPATCH ENGINE
// ==========================================

export interface ProviderDispatchResult {
  success: boolean;
  channel: NotificationChannel;
  provider: string;
  providerMessageId?: string;
  status: NotificationStatus;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
}

export async function dispatchNotificationToProvider(
  item: NotificationItem
): Promise<ProviderDispatchResult> {
  const now = new Date().toISOString();

  // 1. WhatsApp Provider Dispatch (Temporarily paused / disabled)
  if (item.channel === 'WHATSAPP') {
    return {
      success: false,
      channel: 'WHATSAPP',
      provider: 'META_CLOUD_API',
      providerMessageId: `wa_disabled_${Date.now()}`,
      status: 'FAILED',
      errorMessage: 'WhatsApp Business API is a paid service and is switched off in the free-tier build. Use Email (sent via Outlook + Teams through Power Automate) or In-App instead.',
    };
  }

  // 2. Email Provider Dispatch — FREE-TIER: via Microsoft Power Automate
  // (Outlook + optional Teams chat), no paid SMTP/SendGrid/Cloud Run needed.
  if (item.channel === 'EMAIL') {
    if (!item.recipientEmail) {
      return {
        success: false,
        channel: 'EMAIL',
        provider: 'POWER_AUTOMATE',
        status: 'FAILED',
        errorMessage: 'Crew member has no email address on file.',
      };
    }
    const result = await sendViaPowerAutomate({
      kind: 'NOTIFICATION',
      channel: 'EMAIL',
      to: item.recipientEmail,
      recipientName: item.recipientName,
      subject: item.subject || 'Zambia Airways Crew Control notification',
      htmlBody: item.htmlMessage,
      textBody: item.message,
      priority: item.priority,
      notificationId: item.id,
    });
    if (result.success) {
      return {
        success: true,
        channel: 'EMAIL',
        provider: 'POWER_AUTOMATE',
        providerMessageId: `pa_${Date.now()}`,
        status: 'SENT',
        sentAt: now,
        // Delivery is only known for sure when the flow's reply was readable.
        ...(result.confirmed ? { deliveredAt: now } : {}),
      };
    }
    return {
      success: false,
      channel: 'EMAIL',
      provider: 'POWER_AUTOMATE',
      status: 'FAILED',
      errorMessage: result.message,
    };
  }

  // 3. In-App: stored in Firestore so it appears on the crew member's own
  // device (bell icon). "SENT" = stored; the recipient's read status is
  // tracked on the notification itself.
  if (!item.recipientEmail) {
    return {
      success: false,
      channel: 'IN_APP',
      provider: 'IN_APP_DISPATCH',
      status: 'FAILED',
      errorMessage: 'Crew member has no email address on file, so they cannot sign in to see in-app messages.',
    };
  }
  try {
    const id = await sendInAppNotification({
      targetEmail: item.recipientEmail,
      targetCrewId: item.recipientId,
      type: 'ROSTER_AMENDED',
      title: item.subject || 'Crew Control notification',
      message: item.message,
    });
    return {
      success: true,
      channel: 'IN_APP',
      provider: 'IN_APP_DISPATCH',
      providerMessageId: id,
      status: 'SENT',
      sentAt: now,
    };
  } catch (err) {
    return {
      success: false,
      channel: 'IN_APP',
      provider: 'IN_APP_DISPATCH',
      status: 'FAILED',
      errorMessage: `Could not store in-app notification: ${(err as Error)?.message || 'unknown error'}`,
    };
  }
}

// ==========================================
// RETRY & FALLBACK LOGIC ENGINE
// ==========================================

export async function processNotificationWithRetryAndFallback(
  item: NotificationItem,
  settings: NotificationSystemSettings = loadNotificationSettings()
): Promise<NotificationItem> {
  const updatedItem: NotificationItem = { ...item, status: 'SENDING' };
  const maxRetries = settings.retrySettings.maxRetryAttempts || 3;

  // First Attempt
  const result = await dispatchNotificationToProvider(updatedItem);

  updatedItem.retryHistory = [
    ...(updatedItem.retryHistory || []),
    {
      attempt: 1,
      timestamp: new Date().toISOString(),
      status: result.success ? 'SUCCESS' : 'FAILED',
      error: result.errorMessage,
      channel: updatedItem.channel,
      provider: result.provider,
    },
  ];

  if (result.success) {
    updatedItem.status = result.status;
    updatedItem.sentAt = result.sentAt;
    updatedItem.deliveredAt = result.deliveredAt;
    updatedItem.providerMessageId = result.providerMessageId;
    updatedItem.provider = result.provider;
    return updatedItem;
  }

  // Failed First Attempt - Execute Retries
  let currentAttempt = 1;
  let lastError = result.errorMessage;

  while (currentAttempt < maxRetries) {
    currentAttempt++;
    updatedItem.retryCount = currentAttempt;

    // Retry dispatch
    const retryResult = await dispatchNotificationToProvider(updatedItem);

    updatedItem.retryHistory.push({
      attempt: currentAttempt,
      timestamp: new Date().toISOString(),
      status: retryResult.success ? 'SUCCESS' : 'FAILED',
      error: retryResult.errorMessage,
      channel: updatedItem.channel,
      provider: retryResult.provider,
    });

    if (retryResult.success) {
      updatedItem.status = retryResult.status;
      updatedItem.sentAt = retryResult.sentAt;
      updatedItem.deliveredAt = retryResult.deliveredAt;
      updatedItem.providerMessageId = retryResult.providerMessageId;
      updatedItem.errorMessage = undefined;
      return updatedItem;
    }

    lastError = retryResult.errorMessage;
  }

  // All primary retries exhausted -> Check Fallback Channel
  if (settings.retrySettings.enableFallbackChannel) {
    if (updatedItem.channel === 'WHATSAPP' && updatedItem.recipientEmail) {
      // Fallback: WhatsApp -> Email
      updatedItem.fallbackAttempted = true;
      updatedItem.fallbackChannel = 'EMAIL';

      const fallbackResult = await dispatchNotificationToProvider({
        ...updatedItem,
        channel: 'EMAIL',
      });

      updatedItem.retryHistory.push({
        attempt: currentAttempt + 1,
        timestamp: new Date().toISOString(),
        status: fallbackResult.success ? 'SUCCESS' : 'FAILED',
        error: fallbackResult.errorMessage ? `Fallback to Email: ${fallbackResult.errorMessage}` : undefined,
        channel: 'EMAIL',
        provider: fallbackResult.provider,
      });

      if (fallbackResult.success) {
        updatedItem.status = 'SENT';
        updatedItem.providerMessageId = fallbackResult.providerMessageId;
        updatedItem.deliveredAt = fallbackResult.deliveredAt;
        updatedItem.errorMessage = `Delivered via fallback channel (Email). Primary WhatsApp failed: ${lastError}`;
        return updatedItem;
      }
    } else if (updatedItem.channel === 'EMAIL') {
      // Fallback: Email -> In-App (actually sent now, not just labelled)
      updatedItem.fallbackAttempted = true;
      updatedItem.fallbackChannel = 'IN_APP';
      const inApp = await dispatchNotificationToProvider({ ...updatedItem, channel: 'IN_APP' });
      if (inApp.success) {
        updatedItem.status = 'SENT';
        updatedItem.providerMessageId = inApp.providerMessageId;
        updatedItem.errorMessage = `Sent as an in-app alert instead. Email failed: ${lastError}`;
        return updatedItem;
      }
      lastError = `${lastError}; in-app fallback also failed: ${inApp.errorMessage}`;
    }
  }

  // Final Failure State
  updatedItem.status = 'FAILED';
  updatedItem.errorMessage = `Final Delivery Failure after ${maxRetries} attempts: ${lastError}`;
  return updatedItem;
}

// ==========================================
// OPERATIONAL EVENT BUILDERS
// ==========================================

export function buildNotificationItemsForRosterPublish(
  assignments: Assignment[],
  crewList: CrewMember[],
  flightList: Flight[],
  initiatedBy: string
): NotificationItem[] {
  const items: NotificationItem[] = [];
  const templates = loadWhatsAppTemplates();
  const emailTemplates = loadEmailTemplates();
  const settings = loadNotificationSettings();

  const waTpl = templates.find((t) => t.name === 'roster_published_v1') || templates[0];
  const emlTpl = emailTemplates.find((t) => t.name === 'email_roster_published') || emailTemplates[0];

  const now = new Date().toISOString();

  // Deduplicate crew assigned to confirmed flights
  const uniqueCrewIds = new Set<string>();
  assignments.forEach((a) => {
    if (a.captainId) uniqueCrewIds.add(a.captainId);
    if (a.firstOfficerId) uniqueCrewIds.add(a.firstOfficerId);
    if (a.cabinCrewIds) a.cabinCrewIds.forEach((id) => uniqueCrewIds.add(id));
  });

  uniqueCrewIds.forEach((crewId) => {
    const member = crewList.find((c) => c.id === crewId);
    if (!member) return;

    // Find first upcoming assignment
    const crewAssignment = assignments.find(
      (a) => a.captainId === crewId || a.firstOfficerId === crewId || (a.cabinCrewIds && a.cabinCrewIds.includes(crewId))
    );
    const flight = crewAssignment ? flightList.find((f) => f.id === crewAssignment.flightId) : flightList[0];

    const prefs = loadCrewPreferences(crewId, member);

    // Context variables
    const variables: Record<string, string | number> = {
      crew_name: member.name,
      employee_id: member.staffNumber,
      flight_number: flight?.flightNumber || 'TBC',
      flight_date: flight?.date || 'TBC',
      origin: flight?.departure || 'TBC',
      destination: flight?.arrival || 'TBC',
      report_time: crewAssignment?.reportTime || 'TBC',
      departure_time: flight?.std || 'TBC',
      arrival_time: flight?.sta || 'TBC',
      aircraft_type: flight?.aircraft || member.aircraft || 'TBC',
      aircraft_registration: flight?.registration || 'TBC',
      position: member.role,
      duty_code: crewAssignment?.dutyCode || 'FLT',
    };

    const waMsg = interpolateTemplate(waTpl.body, variables).result;
    const emlMsg = interpolateTemplate(emlTpl.plainTextBody, variables).result;
    const emlHtml = interpolateTemplate(emlTpl.htmlBody, variables).result;
    const subject = interpolateTemplate(emlTpl.subject, variables).result;

    const channelsToSend: NotificationChannel[] = (settings.priorityMatrix.NORMAL || ['EMAIL', 'IN_APP']).filter(
      (c) => c !== 'WHATSAPP'
    );

    channelsToSend.forEach((ch) => {
      items.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recipientId: member.id,
        recipientName: member.name,
        recipientRole: member.role,
        recipientStaffNumber: member.staffNumber,
        recipientEmail: prefs.companyEmail || member.email,
        recipientPhone: member.phone,
        recipientWhatsApp: member.whatsAppNumber || member.phone || '+260971234567',
        channel: ch,
        notificationType: 'ROSTER_PUBLISHED',
        priority: 'NORMAL',
        templateId: emlTpl.name,
        subject,
        message: emlMsg,
        htmlMessage: ch === 'EMAIL' ? emlHtml : undefined,
        variables,
        flightNumber: flight?.flightNumber,
        flightDate: flight?.date,
        origin: flight?.departure,
        destination: flight?.arrival,
        reportTime: crewAssignment?.reportTime,
        aircraftType: flight?.aircraft,
        aircraftRegistration: flight?.registration,
        position: member.role,
        createdAt: now,
        status: 'QUEUED',
        retryCount: 0,
        maxRetries: 3,
        retryHistory: [],
        initiatedBy,
        provider: ch === 'EMAIL' ? 'SMTP_TRANSACTIONAL' : 'IN_APP_DISPATCH',
      });
    });
  });

  return items;
}

export function buildNotificationForRosterChange(
  previousAssignmentStr: string,
  newAssignmentStr: string,
  flight: Flight,
  crewMember: CrewMember,
  reportTime: string,
  reason: string,
  initiatedBy: string
): NotificationItem[] {
  const items: NotificationItem[] = [];
  const templates = loadWhatsAppTemplates();
  const emailTemplates = loadEmailTemplates();
  const settings = loadNotificationSettings();
  const prefs = loadCrewPreferences(crewMember.id, crewMember);

  const waTpl = templates.find((t) => t.name === 'roster_amended_v1') || templates[1];
  const emlTpl = emailTemplates.find((t) => t.name === 'email_roster_amended') || emailTemplates[1];

  const now = new Date().toISOString();

  const variables: Record<string, string | number> = {
    crew_name: crewMember.name,
    employee_id: crewMember.staffNumber,
    flight_number: flight.flightNumber,
    flight_date: flight.date,
    origin: flight.departure,
    destination: flight.arrival,
    previous_assignment: previousAssignmentStr,
    new_assignment: newAssignmentStr,
    report_time: reportTime,
    departure_time: flight.std,
    arrival_time: flight.sta,
    aircraft_type: flight.aircraft,
    aircraft_registration: flight.registration,
    position: crewMember.role,
    notification_reason: reason || 'Operational re-pairing and FTL rest optimization',
  };

  const waMsg = interpolateTemplate(waTpl.body, variables).result;
  const emlMsg = interpolateTemplate(emlTpl.plainTextBody, variables).result;
  const emlHtml = interpolateTemplate(emlTpl.htmlBody, variables).result;
  const subject = interpolateTemplate(emlTpl.subject, variables).result;

  const channelsToSend: NotificationChannel[] = (settings.priorityMatrix.HIGH || ['EMAIL', 'IN_APP']).filter(
    (c) => c !== 'WHATSAPP'
  );

  channelsToSend.forEach((ch) => {
    items.push({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientId: crewMember.id,
      recipientName: crewMember.name,
      recipientRole: crewMember.role,
      recipientStaffNumber: crewMember.staffNumber,
      recipientEmail: prefs.companyEmail || crewMember.email,
      recipientPhone: crewMember.phone,
      recipientWhatsApp: crewMember.whatsAppNumber || crewMember.phone || '+260971234567',
      channel: ch,
      notificationType: 'ROSTER_CHANGE',
      priority: 'HIGH',
      templateId: emlTpl.name,
      subject,
      message: emlMsg,
      htmlMessage: ch === 'EMAIL' ? emlHtml : undefined,
      variables,
      flightNumber: flight.flightNumber,
      flightDate: flight.date,
      origin: flight.departure,
      destination: flight.arrival,
      reportTime,
      aircraftType: flight.aircraft,
      aircraftRegistration: flight.registration,
      position: crewMember.role,
      notificationReason: reason,
      previousAssignment: previousAssignmentStr,
      newAssignment: newAssignmentStr,
      createdAt: now,
      status: 'QUEUED',
      retryCount: 0,
      maxRetries: 3,
      retryHistory: [],
      initiatedBy,
      provider: ch === 'EMAIL' ? 'SMTP_TRANSACTIONAL' : 'IN_APP_DISPATCH',
    });
  });

  return items;
}

export function buildNotificationForDisruption(
  disruptionType: string,
  flight: Flight,
  crewMembers: CrewMember[],
  reason: string,
  initiatedBy: string
): NotificationItem[] {
  const items: NotificationItem[] = [];
  const templates = loadWhatsAppTemplates();
  const emailTemplates = loadEmailTemplates();
  const settings = loadNotificationSettings();

  const waTpl = templates.find((t) => t.name === 'disruption_alert_v1') || templates[3];
  const emlTpl = emailTemplates.find((t) => t.name === 'email_flight_disruption') || emailTemplates[2];

  const now = new Date().toISOString();

  crewMembers.forEach((member) => {
    const prefs = loadCrewPreferences(member.id, member);
    const variables: Record<string, string | number> = {
      crew_name: member.name,
      employee_id: member.staffNumber,
      flight_number: flight.flightNumber,
      flight_date: flight.date,
      origin: flight.departure,
      destination: flight.arrival,
      aircraft_type: flight.aircraft,
      aircraft_registration: flight.registration,
      notification_reason: `${disruptionType}: ${reason}`,
    };

    const waMsg = interpolateTemplate(waTpl.body, variables).result;
    const emlMsg = interpolateTemplate(emlTpl.plainTextBody, variables).result;
    const emlHtml = interpolateTemplate(emlTpl.htmlBody, variables).result;
    const subject = interpolateTemplate(emlTpl.subject, variables).result;

    const channelsToSend: NotificationChannel[] = (settings.priorityMatrix.CRITICAL || ['EMAIL', 'IN_APP']).filter(
      (c) => c !== 'WHATSAPP'
    );

    channelsToSend.forEach((ch) => {
      items.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recipientId: member.id,
        recipientName: member.name,
        recipientRole: member.role,
        recipientStaffNumber: member.staffNumber,
        recipientEmail: prefs.companyEmail || member.email,
        recipientPhone: member.phone,
        recipientWhatsApp: member.whatsAppNumber || member.phone || '+260971234567',
        channel: ch,
        notificationType: 'DISRUPTION',
        priority: 'CRITICAL',
        templateId: emlTpl.name,
        subject,
        message: emlMsg,
        htmlMessage: ch === 'EMAIL' ? emlHtml : undefined,
        variables,
        flightNumber: flight.flightNumber,
        flightDate: flight.date,
        origin: flight.departure,
        destination: flight.arrival,
        aircraftType: flight.aircraft,
        aircraftRegistration: flight.registration,
        position: member.role,
        notificationReason: reason,
        createdAt: now,
        status: 'QUEUED',
        retryCount: 0,
        maxRetries: 3,
        retryHistory: [],
        initiatedBy,
        provider: ch === 'EMAIL' ? 'SMTP_TRANSACTIONAL' : 'IN_APP_DISPATCH',
      });
    });
  });

  return items;
}

// Initial Sample Notification Log Data
function generateInitialNotificationLogs(): NotificationItem[] {
  return [
    {
      id: 'notif_init_001',
      recipientId: 'c-q4-c1',
      recipientName: 'Capt. John Banda',
      recipientRole: 'Captain',
      recipientStaffNumber: 'ZA-1001',
      recipientEmail: 'j.banda@zambiaairways.co.zm',
      recipientPhone: '+260977112233',
      recipientWhatsApp: '+260977112233',
      channel: 'WHATSAPP',
      notificationType: 'ROSTER_PUBLISHED',
      priority: 'NORMAL',
      templateId: 'roster_published_v1',
      subject: 'Zambia Airways Official Roster Published - 2026-08-15',
      message: 'Hello Capt. John Banda,\n\nYour roster for 2026-08-15 has been officially published.\n\nFlight: ZN504\nRoute: LUN - NLA\nReport Time: 06:00\nAircraft: Q400 (9J-ZAW)\nPosition: Captain',
      flightNumber: 'ZN504',
      flightDate: '2026-08-15',
      origin: 'LUN',
      destination: 'NLA',
      reportTime: '06:00',
      aircraftType: 'Q400',
      aircraftRegistration: '9J-ZAW',
      position: 'Captain',
      createdAt: '2026-08-14T06:00:00Z',
      sentAt: '2026-08-14T06:00:02Z',
      deliveredAt: '2026-08-14T06:00:05Z',
      readAt: '2026-08-14T06:12:30Z',
      status: 'READ',
      providerMessageId: 'wam_zn_9281749281',
      retryCount: 0,
      maxRetries: 3,
      retryHistory: [{ attempt: 1, timestamp: '2026-08-14T06:00:02Z', status: 'SUCCESS', channel: 'WHATSAPP', provider: 'META_CLOUD_API' }],
      initiatedBy: 'Auto Scheduler',
      provider: 'META_CLOUD_API',
    },
    {
      id: 'notif_init_002',
      recipientId: 'c-q4-fo1',
      recipientName: 'FO Mwape Chileshe',
      recipientRole: 'First Officer',
      recipientStaffNumber: 'ZA-1005',
      recipientEmail: 'm.chileshe@zambiaairways.co.zm',
      recipientPhone: '+260966445566',
      recipientWhatsApp: '+260966445566',
      channel: 'EMAIL',
      notificationType: 'ROSTER_PUBLISHED',
      priority: 'NORMAL',
      templateId: 'email_roster_published',
      subject: 'Zambia Airways Official Roster Published - 2026-08-15 (Flight ZN504)',
      message: 'Dear FO Mwape Chileshe,\n\nYour flight roster for 2026-08-15 has been officially published by Zambia Airways Crew Planning.\n\nFlight Number: ZN504\nSector: LUN to NLA\nReporting Time: 06:00 (STD-01:00)',
      flightNumber: 'ZN504',
      flightDate: '2026-08-15',
      origin: 'LUN',
      destination: 'NLA',
      reportTime: '06:00',
      aircraftType: 'Q400',
      aircraftRegistration: '9J-ZAW',
      position: 'First Officer',
      createdAt: '2026-08-14T06:00:00Z',
      sentAt: '2026-08-14T06:00:03Z',
      deliveredAt: '2026-08-14T06:00:04Z',
      status: 'DELIVERED',
      providerMessageId: 'eml_zn_8471928471',
      retryCount: 0,
      maxRetries: 3,
      retryHistory: [{ attempt: 1, timestamp: '2026-08-14T06:00:03Z', status: 'SUCCESS', channel: 'EMAIL', provider: 'SMTP_TRANSACTIONAL' }],
      initiatedBy: 'Auto Scheduler',
      provider: 'SMTP_TRANSACTIONAL',
    },
    {
      id: 'notif_init_003',
      recipientId: 'c-73-c1',
      recipientName: 'Capt. Patrick Phiri',
      recipientRole: 'Captain',
      recipientStaffNumber: 'ZA-1002',
      recipientEmail: 'p.phiri@zambiaairways.co.zm',
      recipientPhone: '+260955778899',
      recipientWhatsApp: '+260955778899',
      channel: 'WHATSAPP',
      notificationType: 'ROSTER_CHANGE',
      priority: 'HIGH',
      templateId: 'roster_amended_v1',
      subject: 'URGENT: Roster Revision - ZN101 (2026-08-15)',
      message: 'Hello Capt. Patrick Phiri,\n\nPlease be advised that your duty assignment has been revised:\n\nFlight: ZN101 (2026-08-15)\nPrevious Duty: Standby Reserve (LUN)\nNew Assignment: ZN101 LUN-JNB\nReport Time: 05:30\nAircraft: B737 (9J-ZAE)\nReason: Crew replacement for sick call',
      flightNumber: 'ZN101',
      flightDate: '2026-08-15',
      origin: 'LUN',
      destination: 'JNB',
      reportTime: '05:30',
      aircraftType: 'B737',
      aircraftRegistration: '9J-ZAE',
      position: 'Captain',
      notificationReason: 'Crew replacement for sick call',
      previousAssignment: 'Standby Reserve (LUN)',
      newAssignment: 'ZN101 LUN-JNB',
      createdAt: '2026-08-14T07:15:00Z',
      sentAt: '2026-08-14T07:15:02Z',
      deliveredAt: '2026-08-14T07:15:04Z',
      status: 'DELIVERED',
      providerMessageId: 'wam_zn_4829104928',
      retryCount: 0,
      maxRetries: 3,
      retryHistory: [{ attempt: 1, timestamp: '2026-08-14T07:15:02Z', status: 'SUCCESS', channel: 'WHATSAPP', provider: 'META_CLOUD_API' }],
      initiatedBy: 'Mutale Kasonde (Scheduler)',
      provider: 'META_CLOUD_API',
    },
    {
      id: 'notif_init_004',
      recipientId: 'c-cc-1',
      recipientName: 'SCC Natasha Mulenga',
      recipientRole: 'Senior Cabin Crew',
      recipientStaffNumber: 'ZA-2001',
      recipientEmail: 'n.mulenga@zambiaairways.co.zm',
      recipientPhone: '+260971000000',
      recipientWhatsApp: '+260971000000',
      channel: 'WHATSAPP',
      notificationType: 'DISRUPTION',
      priority: 'CRITICAL',
      templateId: 'disruption_alert_v1',
      subject: 'CRITICAL ALERT: Flight ZN202 Disruption',
      message: 'CRITICAL ALERT for SCC Natasha Mulenga:\n\nFlight ZN202 on 2026-08-15 (LUN-LVI) has encountered an operational disruption:\n\nCondition: Aircraft AOG - Scheduled hydraulic inspection.\nAction: Contact OCC Dispatch at +260 211 840 500.',
      flightNumber: 'ZN202',
      flightDate: '2026-08-15',
      origin: 'LUN',
      destination: 'LVI',
      aircraftType: 'Q400',
      aircraftRegistration: '9J-ZAW',
      position: 'Senior Cabin Crew',
      notificationReason: 'Aircraft AOG - Scheduled hydraulic inspection',
      createdAt: '2026-08-14T08:30:00Z',
      status: 'DELIVERED',
      sentAt: '2026-08-14T08:30:05Z',
      deliveredAt: '2026-08-14T08:30:10Z',
      providerMessageId: 'eml_fb_9381928472',
      retryCount: 2,
      maxRetries: 3,
      retryHistory: [
        { attempt: 1, timestamp: '2026-08-14T08:30:01Z', status: 'FAILED', error: 'WhatsApp opt-in delivery timeout', channel: 'WHATSAPP', provider: 'META_CLOUD_API' },
        { attempt: 2, timestamp: '2026-08-14T08:30:05Z', status: 'SUCCESS', channel: 'EMAIL', provider: 'SMTP_TRANSACTIONAL' },
      ],
      fallbackAttempted: true,
      fallbackChannel: 'EMAIL',
      errorMessage: 'Delivered via fallback channel (Email). Primary WhatsApp failed: WhatsApp opt-in delivery timeout',
      initiatedBy: 'OCC Crew Control',
      provider: 'SMTP_TRANSACTIONAL',
    },
  ];
}
