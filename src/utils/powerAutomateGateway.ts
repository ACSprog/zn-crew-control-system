/**
 * FREE-TIER notification gateway: Microsoft Power Automate.
 *
 * Replaces the paid Cloud Run server + Mailgun/SendGrid/Meta WhatsApp stack.
 * The browser POSTs a small JSON payload to a Power Automate flow that starts
 * with the "When a Teams webhook request is received" trigger (a standard,
 * non-premium trigger included with Microsoft 365 licences). The flow then
 * sends the message with the standard "Office 365 Outlook – Send an email (V2)"
 * and/or "Microsoft Teams – Post message in a chat or channel" actions.
 *
 * The flow URL is NOT baked into the JS bundle. It is stored in Firestore at
 * `integrations/powerAutomate`, which security rules only let OCC
 * schedulers/admins read, so crew accounts can never see or abuse it.
 *
 * See docs/FREE_TIER.md for the step-by-step flow build.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseSync';

export interface PowerAutomateConfig {
  /** HTTP POST URL copied from the flow trigger (contains a &sig= signature). */
  flowUrl: string;
  /** Shared secret the flow compares against before sending anything. */
  sharedSecret: string;
  /** Also post the message to the crew member as a Teams chat. */
  alsoSendTeamsChat: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PowerAutomatePayload {
  kind: 'NOTIFICATION' | 'TEST';
  channel: 'EMAIL' | 'TEAMS' | 'EMAIL_AND_TEAMS';
  to: string;
  recipientName?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  priority?: string;
  notificationId?: string;
}

export interface PowerAutomateResult {
  success: boolean;
  /** true when the flow's response could be read (CORS allowed). */
  confirmed: boolean;
  message: string;
}

const CONFIG_DOC = () => doc(db, 'integrations', 'powerAutomate');
let cached: PowerAutomateConfig | null = null;

export async function loadPowerAutomateConfig(force = false): Promise<PowerAutomateConfig | null> {
  if (cached && !force) return cached;
  try {
    const snap = await getDoc(CONFIG_DOC());
    cached = snap.exists() ? (snap.data() as PowerAutomateConfig) : null;
  } catch (err) {
    console.warn('[PowerAutomate] Could not load gateway config (no permission or offline):', err);
    cached = null;
  }
  return cached;
}

export async function savePowerAutomateConfig(config: PowerAutomateConfig, updatedBy: string): Promise<void> {
  const clean: PowerAutomateConfig = {
    flowUrl: config.flowUrl.trim(),
    sharedSecret: config.sharedSecret.trim(),
    alsoSendTeamsChat: !!config.alsoSendTeamsChat,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  if (clean.flowUrl && !/^https:\/\/[^\s]+$/i.test(clean.flowUrl)) {
    throw new Error('The flow URL must start with https://');
  }
  await setDoc(CONFIG_DOC(), clean);
  cached = clean;
}

export function isPowerAutomateConfigured(config: PowerAutomateConfig | null): config is PowerAutomateConfig {
  return !!config && !!config.flowUrl;
}

/**
 * Sends one message through the flow. Tries a normal CORS request first so
 * the flow's reply can be read; if the browser blocks that (some Power
 * Platform endpoints don't answer CORS preflights), it falls back to a
 * fire-and-forget `no-cors` text/plain POST, which still reaches the flow
 * (the flow's "Parse JSON" step accepts the body as a string) but whose
 * outcome can't be confirmed from the browser.
 */
export async function sendViaPowerAutomate(payload: PowerAutomatePayload): Promise<PowerAutomateResult> {
  const config = await loadPowerAutomateConfig();
  if (!isPowerAutomateConfigured(config)) {
    return {
      success: false,
      confirmed: true,
      message:
        'Power Automate gateway is not configured. An administrator must paste the flow URL in Notifications → Gateway settings.',
    };
  }

  const channel: PowerAutomatePayload['channel'] =
    payload.channel === 'EMAIL' && config.alsoSendTeamsChat ? 'EMAIL_AND_TEAMS' : payload.channel;
  const body = JSON.stringify({ ...payload, channel, secret: config.sharedSecret, sentAt: new Date().toISOString() });

  // Option B: Gmail via Google Apps Script web app. A text/plain POST is a
  // CORS "simple request" (no preflight, which Apps Script can't answer) and
  // its JSON reply {success, message} is readable after the redirect.
  if (/^https:\/\/script\.google\.com\//i.test(config.flowUrl)) {
    try {
      const resp = await fetch(config.flowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow',
      });
      const data = (await resp.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (data && typeof data.success === 'boolean') {
        return { success: data.success, confirmed: true, message: data.message || (data.success ? 'Sent via Gmail.' : 'Gmail gateway rejected the message.') };
      }
      return { success: false, confirmed: true, message: `Unexpected reply from Apps Script (HTTP ${resp.status}). Check the deployment is "Anyone" access.` };
    } catch (err) {
      return { success: false, confirmed: true, message: `Could not reach the Gmail gateway: ${(err as Error)?.message || 'network error'}` };
    }
  }

  try {
    const resp = await fetch(config.flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (resp.ok || resp.status === 202) {
      return { success: true, confirmed: true, message: `Accepted by Power Automate (HTTP ${resp.status}).` };
    }
    const text = await resp.text().catch(() => '');
    return {
      success: false,
      confirmed: true,
      message: `Power Automate rejected the request (HTTP ${resp.status}). ${text.slice(0, 200)}`,
    };
  } catch {
    // Most likely a CORS block — retry without reading the response.
    try {
      await fetch(config.flowUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body,
      });
      return {
        success: true,
        confirmed: false,
        message: 'Handed to Power Automate (delivery not confirmable from the browser — check the flow run history).',
      };
    } catch (err) {
      return {
        success: false,
        confirmed: true,
        message: `Could not reach Power Automate: ${(err as Error)?.message || 'network error'}`,
      };
    }
  }
}
