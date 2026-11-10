/**
 * Notification Provider Abstraction Layer & Interfaces
 * Enables provider-agnostic WhatsApp and Email dispatches (Meta Cloud, Twilio, SendGrid, SMTP, Mock/Sandbox).
 */

export type ProviderType = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP';

export interface ProviderDispatchResult {
  success: boolean;
  provider: string;
  providerMessageId: string;
  status: 'SENT' | 'DELIVERED' | 'QUEUED' | 'FAILED';
  errorMessage?: string;
  errorCode?: string;
  deliveredAt?: string;
  sentAt?: string;
  rawResponse?: unknown;
  meta?: Record<string, unknown>;
}

export interface WhatsAppSendParams {
  recipientPhone: string;
  recipientName?: string;
  templateName?: string;
  messageText?: string;
  variables?: Record<string, string | number>;
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFORMATION';
  notificationId?: string;
}

export interface EmailSendParams {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  variables?: Record<string, string | number>;
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFORMATION';
  notificationId?: string;
  replyTo?: string;
}

export interface IWhatsAppProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendMessage(params: WhatsAppSendParams): Promise<ProviderDispatchResult>;
  testConnection(testPhone?: string): Promise<{ success: boolean; message: string; details?: unknown }>;
}

export interface IEmailProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendEmail(params: EmailSendParams): Promise<ProviderDispatchResult>;
  testConnection(testEmail?: string): Promise<{ success: boolean; message: string; details?: unknown }>;
}
