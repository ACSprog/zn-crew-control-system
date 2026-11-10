import {
  IWhatsAppProvider,
  IEmailProvider,
  WhatsAppSendParams,
  EmailSendParams,
  ProviderDispatchResult,
} from './types';
import {
  MetaWhatsAppProvider,
  TwilioWhatsAppProvider,
  SandboxWhatsAppProvider,
} from './whatsappProviders';
import {
  SendGridEmailProvider,
  SmtpEmailProvider,
  SandboxEmailProvider,
} from './emailProviders';

/**
 * Provider Registry and Routing Gateway
 * Implements fallback and provider-agnostic dispatching
 */
export class NotificationGatewayManager {
  private whatsAppProviders: IWhatsAppProvider[] = [];
  private emailProviders: IEmailProvider[] = [];

  constructor() {
    this.initProviders();
  }

  public initProviders(): void {
    // WhatsApp providers in priority order
    this.whatsAppProviders = [
      new MetaWhatsAppProvider(),
      new TwilioWhatsAppProvider(),
      new SandboxWhatsAppProvider(),
    ];

    // Email providers in priority order
    this.emailProviders = [
      new SendGridEmailProvider(),
      new SmtpEmailProvider(),
      new SandboxEmailProvider(),
    ];
  }

  /**
   * Dispatches WhatsApp message through first available configured provider
   * with automatic fallback
   */
  public async dispatchWhatsApp(params: WhatsAppSendParams): Promise<ProviderDispatchResult> {
    let lastError: ProviderDispatchResult | null = null;

    for (const provider of this.whatsAppProviders) {
      // If provider is configured or is the ultimate sandbox fallback
      if (provider.isConfigured || provider.name === 'WHATSAPP_SANDBOX') {
        const result = await provider.sendMessage(params);
        if (result.success) {
          return result;
        }
        lastError = result;
        console.warn(`[Gateway] Provider ${provider.name} failed: ${result.errorMessage}. Attempting fallback...`);
      }
    }

    return (
      lastError || {
        success: false,
        provider: 'NONE',
        providerMessageId: `fail_${Date.now()}`,
        status: 'FAILED',
        errorMessage: 'All WhatsApp providers failed or are unconfigured.',
      }
    );
  }

  /**
   * Dispatches Email message through first available configured provider
   * with automatic fallback
   */
  public async dispatchEmail(params: EmailSendParams): Promise<ProviderDispatchResult> {
    let lastError: ProviderDispatchResult | null = null;

    for (const provider of this.emailProviders) {
      if (provider.isConfigured || provider.name === 'EMAIL_SANDBOX') {
        const result = await provider.sendEmail(params);
        if (result.success) {
          return result;
        }
        lastError = result;
        console.warn(`[Gateway] Email Provider ${provider.name} failed: ${result.errorMessage}. Attempting fallback...`);
      }
    }

    return (
      lastError || {
        success: false,
        provider: 'NONE',
        providerMessageId: `fail_${Date.now()}`,
        status: 'FAILED',
        errorMessage: 'All Email providers failed or are unconfigured.',
      }
    );
  }

  /**
   * Get health status across all configured providers
   */
  public getStatus() {
    const metaProvider = this.whatsAppProviders.find((p) => p.name === 'META_WHATSAPP_CLOUD_API');
    const twilioProvider = this.whatsAppProviders.find((p) => p.name === 'TWILIO_WHATSAPP');
    const sendGridProvider = this.emailProviders.find((p) => p.name === 'SENDGRID_API');
    const smtpProvider = this.emailProviders.find((p) => p.name === 'SMTP_GATEWAY');

    return {
      whatsapp: {
        activeProvider: metaProvider?.isConfigured
          ? 'META_WHATSAPP_CLOUD_API'
          : twilioProvider?.isConfigured
          ? 'TWILIO_WHATSAPP'
          : 'WHATSAPP_SANDBOX',
        providers: {
          meta: { configured: metaProvider?.isConfigured || false },
          twilio: { configured: twilioProvider?.isConfigured || false },
          sandbox: { configured: true },
        },
      },
      email: {
        activeProvider: sendGridProvider?.isConfigured
          ? 'SENDGRID_API'
          : smtpProvider?.isConfigured
          ? 'SMTP_GATEWAY'
          : 'EMAIL_SANDBOX',
        providers: {
          sendgrid: { configured: sendGridProvider?.isConfigured || false },
          smtp: { configured: smtpProvider?.isConfigured || false },
          sandbox: { configured: true },
        },
      },
    };
  }
}

// Global singleton instance for server
export const gatewayManager = new NotificationGatewayManager();
