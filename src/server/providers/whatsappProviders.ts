import {
  IWhatsAppProvider,
  WhatsAppSendParams,
  ProviderDispatchResult,
} from './types';

/**
 * Meta Cloud WhatsApp Business API Provider implementation
 */
export class MetaWhatsAppProvider implements IWhatsAppProvider {
  public readonly name = 'META_WHATSAPP_CLOUD_API';

  private get token(): string | undefined {
    return process.env.WHATSAPP_ACCESS_TOKEN;
  }

  private get phoneId(): string {
    return process.env.WHATSAPP_PHONE_NUMBER_ID || '108429582194830';
  }

  private get apiEndpoint(): string {
    return process.env.WHATSAPP_API_ENDPOINT || 'https://graph.facebook.com/v20.0';
  }

  public get isConfigured(): boolean {
    return !!this.token;
  }

  public async sendMessage(params: WhatsAppSendParams): Promise<ProviderDispatchResult> {
    const fallbackId = `wam_meta_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!this.token) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: 'WHATSAPP_ACCESS_TOKEN is not configured on the server.',
        errorCode: 'UNCONFIGURED_CREDENTIALS',
      };
    }

    const cleanPhone = params.recipientPhone.replace(/[\s\+\-\(\)]/g, '');

    const payload = params.templateName
      ? {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: 'en_GB' },
            components: [
              {
                type: 'body',
                parameters: Object.entries(params.variables || {}).map(([key, val]) => ({
                  type: 'text',
                  text: String(val),
                })),
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: params.messageText || '' },
        };

    try {
      const response = await fetch(`${this.apiEndpoint}/${this.phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          providerMessageId: fallbackId,
          status: 'FAILED',
          errorMessage: data?.error?.message || 'WhatsApp Meta Cloud API rejected dispatch',
          errorCode: String(data?.error?.code || response.status),
          rawResponse: data,
        };
      }

      const metaMsgId = data?.messages?.[0]?.id || fallbackId;
      return {
        success: true,
        provider: this.name,
        providerMessageId: metaMsgId,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: err?.message || 'Network transport failure contacting Meta Cloud API',
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  public async testConnection(testPhone = '+260971234567'): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!this.isConfigured) {
      return {
        success: false,
        message: 'WhatsApp Access Token is not set in environment settings.',
      };
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/${this.phoneId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        return {
          success: true,
          message: `Connected to WhatsApp Business Account (${data.display_phone_number || data.id})`,
          details: data,
        };
      }
      return {
        success: false,
        message: data?.error?.message || 'Failed to authenticate with Meta Graph API',
        details: data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error reaching Meta Graph API',
      };
    }
  }
}

/**
 * Twilio WhatsApp Provider implementation (for multi-provider failover)
 */
export class TwilioWhatsAppProvider implements IWhatsAppProvider {
  public readonly name = 'TWILIO_WHATSAPP';

  private get accountSid(): string | undefined {
    return process.env.TWILIO_ACCOUNT_SID;
  }

  private get authToken(): string | undefined {
    return process.env.TWILIO_AUTH_TOKEN;
  }

  private get fromNumber(): string {
    return process.env.TWILIO_WHATSAPP_FROM || '+14155238886';
  }

  public get isConfigured(): boolean {
    return !!(this.accountSid && this.authToken);
  }

  public async sendMessage(params: WhatsAppSendParams): Promise<ProviderDispatchResult> {
    const fallbackId = `wam_tw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!this.isConfigured) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: 'Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) not configured.',
        errorCode: 'UNCONFIGURED_CREDENTIALS',
      };
    }

    const cleanPhone = params.recipientPhone.startsWith('+') ? params.recipientPhone : `+${params.recipientPhone}`;
    const body = params.messageText || (params.templateName ? `[${params.templateName}] Notification for ${params.recipientName || 'Crew'}` : '');

    try {
      const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const formData = new URLSearchParams();
      formData.append('From', `whatsapp:${this.fromNumber}`);
      formData.append('To', `whatsapp:${cleanPhone}`);
      formData.append('Body', body);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          providerMessageId: fallbackId,
          status: 'FAILED',
          errorMessage: data?.message || 'Twilio WhatsApp API Error',
          errorCode: String(data?.code || response.status),
          rawResponse: data,
        };
      }

      return {
        success: true,
        provider: this.name,
        providerMessageId: data.sid || fallbackId,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: err?.message || 'Network transport failure contacting Twilio',
      };
    }
  }

  public async testConnection(testPhone = '+260971234567'): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!this.isConfigured) {
      return { success: false, message: 'Twilio credentials not configured' };
    }
    return {
      success: true,
      message: `Twilio WhatsApp provider ready for Account ${this.accountSid?.substring(0, 8)}...`,
    };
  }
}

/**
 * Sandbox / Simulated WhatsApp Provider for development and instant test delivery
 */
export class SandboxWhatsAppProvider implements IWhatsAppProvider {
  public readonly name = 'WHATSAPP_SANDBOX';
  public readonly isConfigured = true;

  public async sendMessage(params: WhatsAppSendParams): Promise<ProviderDispatchResult> {
    const providerMessageId = `wam_zn_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Simulate intentional failure test case
    const isSimulatedFail = params.recipientPhone.includes('000000') || params.recipientPhone === '+260999999999';

    if (isSimulatedFail) {
      return {
        success: false,
        provider: this.name,
        providerMessageId,
        status: 'FAILED',
        errorMessage: 'Simulated Sandbox Delivery Failure: Recipient opt-in expired or number unreachable.',
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
        recipientNumber: params.recipientPhone,
        recipientName: params.recipientName,
        simulated: true,
      },
    };
  }

  public async testConnection(testPhone = '+260971234567'): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Sandbox gateway operational. Messages dispatched will succeed instantaneously with simulated receipts.`,
    };
  }
}
