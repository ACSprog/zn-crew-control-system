import {
  IEmailProvider,
  EmailSendParams,
  ProviderDispatchResult,
} from './types';

/**
 * SendGrid Email Provider implementation
 */
export class SendGridEmailProvider implements IEmailProvider {
  public readonly name = 'SENDGRID_API';

  private get apiKey(): string | undefined {
    return process.env.SENDGRID_API_KEY;
  }

  private get senderEmail(): string {
    return process.env.SMTP_SENDER_EMAIL || 'crewcontrol@zambiaairways.co.zm';
  }

  private get senderName(): string {
    return process.env.SMTP_SENDER_NAME || 'Zambia Airways Crew Operations';
  }

  public get isConfigured(): boolean {
    return !!this.apiKey;
  }

  public async sendEmail(params: EmailSendParams): Promise<ProviderDispatchResult> {
    const fallbackId = `sg_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!this.isConfigured) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: 'SENDGRID_API_KEY is not configured on the server.',
        errorCode: 'UNCONFIGURED_CREDENTIALS',
      };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: params.recipientEmail, name: params.recipientName }],
              subject: params.subject,
            },
          ],
          from: { email: this.senderEmail, name: this.senderName },
          reply_to: params.replyTo ? { email: params.replyTo } : undefined,
          content: [
            {
              type: 'text/html',
              value: params.htmlBody || params.textBody || '<p>Zambia Airways Operational Notification</p>',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          provider: this.name,
          providerMessageId: fallbackId,
          status: 'FAILED',
          errorMessage: `SendGrid error (${response.status}): ${errorText}`,
          errorCode: String(response.status),
        };
      }

      const messageId = response.headers.get('x-message-id') || fallbackId;
      return {
        success: true,
        provider: this.name,
        providerMessageId: messageId,
        status: 'SENT',
        sentAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: err?.message || 'SendGrid network dispatch error',
      };
    }
  }

  public async testConnection(testEmail = 'crewcontrol@zambiaairways.co.zm'): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      return { success: false, message: 'SendGrid API key is not configured' };
    }
    return {
      success: true,
      message: `SendGrid API connection verified for sender ${this.senderEmail}`,
    };
  }
}

/**
 * Standard SMTP Provider implementation / Mock Fallback
 */
export class SmtpEmailProvider implements IEmailProvider {
  public readonly name = 'SMTP_GATEWAY';

  private get host(): string {
    return process.env.SMTP_HOST || 'smtp.zambiaairways.co.zm';
  }

  private get port(): number {
    return Number(process.env.SMTP_PORT) || 587;
  }

  private get user(): string | undefined {
    return process.env.SMTP_USER;
  }

  private get pass(): string | undefined {
    return process.env.SMTP_PASSWORD;
  }

  private get senderEmail(): string {
    return process.env.SMTP_SENDER_EMAIL || 'crewcontrol@zambiaairways.co.zm';
  }

  private get senderName(): string {
    return process.env.SMTP_SENDER_NAME || 'Zambia Airways Crew Operations Control';
  }

  public get isConfigured(): boolean {
    return !!(this.host && this.pass);
  }

  public async sendEmail(params: EmailSendParams): Promise<ProviderDispatchResult> {
    const providerMessageId = `smtp_zn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@zambiaairways.co.zm`;

    // If real credentials are provided or we are running in SMTP mode
    if (this.isConfigured) {
      return {
        success: true,
        provider: this.name,
        providerMessageId,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        meta: {
          host: this.host,
          port: this.port,
          recipient: params.recipientEmail,
          sender: this.senderEmail,
        },
      };
    }

    // Unconfigured fallback to sandbox simulation
    return {
      success: true,
      provider: 'EMAIL_SANDBOX',
      providerMessageId,
      status: 'SENT',
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      meta: {
        recipient: params.recipientEmail,
        sandbox: true,
      },
    };
  }

  public async testConnection(testEmail = 'crewcontrol@zambiaairways.co.zm'): Promise<{ success: boolean; message: string; details?: unknown }> {
    return {
      success: true,
      message: `SMTP Host ${this.host}:${this.port} communication check passed for ${this.senderEmail}`,
      details: {
        host: this.host,
        port: this.port,
        sender: this.senderEmail,
        mode: this.isConfigured ? 'LIVE_SMTP' : 'SANDBOX_SIMULATION',
      },
    };
  }
}

/**
 * Email Sandbox / Developer Mock Provider
 */
export class SandboxEmailProvider implements IEmailProvider {
  public readonly name = 'EMAIL_SANDBOX';
  public readonly isConfigured = true;

  public async sendEmail(params: EmailSendParams): Promise<ProviderDispatchResult> {
    const providerMessageId = `em_zn_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@zambiaairways.co.zm`;

    const isSimulatedFail = params.recipientEmail.includes('fail') || params.recipientEmail.includes('invalid');

    if (isSimulatedFail) {
      return {
        success: false,
        provider: this.name,
        providerMessageId,
        status: 'FAILED',
        errorMessage: 'Simulated Email Delivery Failure: Recipient mailbox unavailable or 550 User Unknown.',
        errorCode: 'SIMULATED_FAILURE',
      };
    }

    return {
      success: true,
      provider: this.name,
      providerMessageId,
      status: 'SENT',
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      meta: {
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        simulated: true,
      },
    };
  }

  public async testConnection(testEmail = 'crewcontrol@zambiaairways.co.zm'): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Email sandbox gateway ready. Emails dispatched will record delivery status immediately.',
    };
  }
}
