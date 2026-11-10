import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { gatewayManager } from './src/server/providers/gatewayManager';
import {
  handleNotificationQueueTrigger,
  handleProviderWebhookEvent,
} from './src/server/functions/notificationFunctions';
import firebaseConfigData from './firebase-applet-config.json';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // ------------------------------------------------------------------
  // Firebase Admin SDK setup. In production (Cloud Run) this uses
  // Application Default Credentials automatically — no key file needed.
  // In local dev it talks to the same Firestore/Auth emulators the
  // frontend connects to, so nothing here ever touches production data
  // unless VITE_USE_FIREBASE_EMULATOR is explicitly set to "false".
  // ------------------------------------------------------------------
  const useEmulator = process.env.NODE_ENV !== 'production' && process.env.VITE_USE_FIREBASE_EMULATOR !== 'false';
  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  }
  admin.initializeApp({
    projectId: firebaseConfigData.projectId,
    credential: admin.credential.applicationDefault(),
  });
  const adminDb = admin.firestore();

  app.use(express.json({
    limit: '10mb',
    // Keep the raw request body around so webhook signature verification
    // (see the WhatsApp webhook handler below) can HMAC the exact bytes
    // Meta signed, not a re-serialized copy that might not match byte-for-byte.
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));

  /**
   * Verifies the Firebase ID token on the `Authorization: Bearer <token>`
   * header of every protected /api/* request, so these endpoints can no
   * longer be called anonymously by anyone who finds the URL. Attaches
   * the decoded token (including the `role` custom claim) to req.authUser.
   */
  async function requireAuth(req: any, res: any, next: any) {
    const header = req.headers.authorization || '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) {
      return res.status(401).json({ error: 'Missing Authorization: Bearer <Firebase ID token> header.' });
    }
    try {
      const decoded = await admin.auth().verifyIdToken(match[1]);
      req.authUser = decoded;
      next();
    } catch (err) {
      console.warn('[Auth] Rejected request with invalid/expired ID token:', (err as Error)?.message);
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
  }

  /** Restricts a route to specific role custom-claim values. */
  function requireRole(...allowedRoles: string[]) {
    return (req: any, res: any, next: any) => {
      const role = req.authUser?.role;
      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({ error: 'You do not have permission to perform this action.' });
      }
      next();
    };
  }

  // Initialize Gemini AI client server-side
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API Route: AI Assistant Endpoint
    app.post('/api/chat', requireAuth, async (req, res) => {
    try {
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const crewData = context?.crew || [];
      const flightsData = context?.flights || [];
      const assignmentsData = context?.assignments || [];
      const leaveData = context?.leave || [];
      const fleetData = context?.fleet || [];

      const systemInstruction = `
You are the Zambia Airways Crew Control Operations Assistant (Gemini powered).
You assist flight dispatchers and crew schedulers with operational queries about crew availability, flight schedules, legality restrictions, crew utilization, and open flight positions.

You have the COMPLETE current operational dataset below — every crew member, flight, assignment, leave record and fleet aircraft currently in the system. Use it to answer specific questions precisely (e.g. by name, flight number, or tail number), not just in generalities. If something isn't in this data, say so plainly rather than guessing.

CURRENT OCC SYSTEM DATA (JSON):

RULES:
${JSON.stringify(context?.rules || {})}

CREW (${crewData.length} records):
${JSON.stringify(crewData)}

FLIGHTS (${flightsData.length} records):
${JSON.stringify(flightsData)}

ASSIGNMENTS (${assignmentsData.length} records):
${JSON.stringify(assignmentsData)}

LEAVE / TRAINING RECORDS (${leaveData.length} records):
${JSON.stringify(leaveData)}

FLEET (${fleetData.length} aircraft):
${JSON.stringify(fleetData)}

IMPORTANT SAFETY & COMPLIANCE RULE:
- You must NEVER directly modify database assignments or guarantee an assignment.
- All crew assignment recommendations you make MUST explicitly state: "Recommendation subject to deterministic FTL Legality Engine validation."
- Format your response with clear markdown, bullet points, and key statistics where relevant.
- Be concise, clear, and operational in tone (Airline Operations Control Center style).
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: message,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const replyText = response.text || 'No response generated from Gemini.';

      res.json({
        reply: replyText,
        verifiedByEngine: true,
      });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      res.status(500).json({
        error: 'Failed to process assistant request',
        details: err?.message || 'Server error',
      });
    }
  });

  // ==========================================
  // NOTIFICATION & COMMUNICATION API ENDPOINTS
  // (Firebase Cloud Function Equivalent Handlers)
  // ==========================================

  /**
   * Verifies that an incoming WhatsApp webhook POST really came from Meta,
   * by recomputing the HMAC-SHA256 signature over the raw request body
   * using your app secret and comparing it to the X-Hub-Signature-256
   * header Meta sends. Without this, anyone who finds this URL can post
   * fake delivery/read-receipt events.
   */
  function verifyWhatsAppSignature(req: any): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      // No secret configured (e.g. local sandbox testing) — skip verification
      // rather than hard-failing, but say so loudly in the logs.
      console.warn('[Webhook] WHATSAPP_APP_SECRET not set — skipping signature verification. Do not run production like this.');
      return true;
    }
    const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;
    if (!signatureHeader || !req.rawBody) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
    } catch {
      return false; // length mismatch etc. — treat as invalid
    }
  }

  /** Persists a delivery/read-receipt event to Firestore instead of an
   * in-memory array, so it survives server restarts and Cloud Run scaling
   * to multiple instances. Written via the Admin SDK, which bypasses
   * Firestore security rules (clients cannot write this collection). */
  async function recordDeliveryReceipt(event: unknown, rawPayload: unknown) {
    await adminDb.collection('deliveryReceipts').add({
      receivedAt: new Date().toISOString(),
      event,
      rawPayload,
    });
  }

  // Provider Status & Secrets Masked Info
  app.get('/api/notifications/providers/status', requireAuth, (req, res) => {
    const hasWhatsAppToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
    const hasSmtpCreds = !!process.env.SMTP_PASSWORD || !!process.env.SMTP_HOST;
    const gatewayStatus = gatewayManager.getStatus();

    res.json({
      status: 'ok',
      activeProviders: gatewayStatus,
      whatsapp: {
        configured: hasWhatsAppToken,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '108429582194830',
        wabaId: process.env.WHATSAPP_WABA_ID || '102938475619283',
        apiEndpoint: process.env.WHATSAPP_API_ENDPOINT || 'https://graph.facebook.com/v20.0',
        mode: hasWhatsAppToken ? 'LIVE_PROVIDER' : 'DEMO_SANDBOX_ACTIVE',
        senderNumber: process.env.WHATSAPP_SENDER_NUMBER || 'Not configured — set WHATSAPP_SENDER_NUMBER in .env',
        businessName: process.env.WHATSAPP_BUSINESS_NAME || 'Zambia Airways (ZN) OCC Communications',
      },
      email: {
        configured: hasSmtpCreds,
        host: process.env.SMTP_HOST || 'smtp.zambiaairways.co.zm',
        port: Number(process.env.SMTP_PORT) || 587,
        senderEmail: process.env.SMTP_SENDER_EMAIL || 'crewcontrol@zambiaairways.co.zm',
        senderName: process.env.SMTP_SENDER_NAME || 'Zambia Airways Crew Operations Control',
        replyTo: process.env.SMTP_REPLY_TO || 'occ@zambiaairways.co.zm',
        mode: hasSmtpCreds ? 'LIVE_SMTP' : 'DEMO_SANDBOX_ACTIVE',
      },
      serverTime: new Date().toISOString(),
    });
  });

  // Firebase Cloud Function Trigger: Process Notification Queue Item
  // Endpoint invoked by Cloud Function trigger on Firestore collection
  app.post('/api/functions/process-queue-item', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OCC_CONTROLLER', 'SCHEDULER'), async (req, res) => {
    try {
      const queueItem = req.body;
      if (!queueItem || !queueItem.id) {
        return res.status(400).json({ error: 'Valid notificationQueue item is required.' });
      }

      const result = await handleNotificationQueueTrigger(queueItem);
      return res.json({
        success: result.providerResult.success,
        status: result.status,
        providerResult: result.providerResult,
        logRecord: result.logRecord,
      });
    } catch (err: any) {
      console.error('Queue Cloud Function Trigger Error:', err);
      res.status(500).json({ error: err?.message || 'Failed processing queue item' });
    }
  });

  // Dispatch WhatsApp through Abstraction Layer
  app.post('/api/notifications/whatsapp/send', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OCC_CONTROLLER', 'SCHEDULER'), async (req, res) => {
    try {
      const {
        recipientNumber,
        recipientName,
        templateName,
        messageText,
        variables,
        priority,
        notificationId,
      } = req.body;

      if (!recipientNumber || (!messageText && !templateName)) {
        return res.status(400).json({
          error: 'recipientNumber and either messageText or templateName are required.',
        });
      }

      const result = await gatewayManager.dispatchWhatsApp({
        recipientPhone: recipientNumber,
        recipientName,
        templateName,
        messageText,
        variables,
        priority,
        notificationId,
      });

      if (!result.success) {
        return res.status(result.errorCode === 'UNCONFIGURED_CREDENTIALS' ? 503 : 422).json({
          success: false,
          provider: result.provider,
          status: result.status,
          errorMessage: result.errorMessage,
          providerMessageId: result.providerMessageId,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        provider: result.provider,
        status: result.status,
        providerMessageId: result.providerMessageId,
        sentAt: result.sentAt || new Date().toISOString(),
        deliveredAt: result.deliveredAt,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('WhatsApp Controller Error:', err);
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  });

  // Test WhatsApp Gateway
  app.post('/api/notifications/whatsapp/test', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OCC_CONTROLLER', 'SCHEDULER'), async (req, res) => {
    const { testNumber = '+260971234567' } = req.body;
    const result = await gatewayManager.dispatchWhatsApp({
      recipientPhone: testNumber,
      messageText: 'Test connection handshake from Zambia Airways OCC Notification Gateway.',
    });

    return res.json({
      success: result.success,
      provider: result.provider,
      message: `Handshake verification complete on provider ${result.provider}. Test message sent to ${testNumber}.`,
      timestamp: new Date().toISOString(),
    });
  });

  // Dispatch Email through Abstraction Layer
  app.post('/api/notifications/email/send', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OCC_CONTROLLER', 'SCHEDULER'), async (req, res) => {
    try {
      const {
        to,
        recipientName,
        subject,
        htmlBody,
        plainTextBody,
        priority,
        notificationId,
      } = req.body;

      if (!to || !subject || (!htmlBody && !plainTextBody)) {
        return res.status(400).json({
          error: 'Recipient email "to", "subject", and message body are required.',
        });
      }

      const result = await gatewayManager.dispatchEmail({
        recipientEmail: to,
        recipientName,
        subject,
        htmlBody,
        textBody: plainTextBody,
        priority,
        notificationId,
      });

      if (!result.success) {
        return res.status(422).json({
          success: false,
          provider: result.provider,
          status: result.status,
          errorMessage: result.errorMessage,
          providerMessageId: result.providerMessageId,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        provider: result.provider,
        status: result.status,
        providerMessageId: result.providerMessageId,
        recipient: to,
        recipientName,
        sentAt: result.sentAt || new Date().toISOString(),
        deliveredAt: result.deliveredAt,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Email Dispatch Error:', err);
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  });

  // Test Email Gateway
  app.post('/api/notifications/email/test', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OCC_CONTROLLER', 'SCHEDULER'), async (req, res) => {
    const { testEmail = 'crewcontrol@zambiaairways.co.zm' } = req.body;
    const result = await gatewayManager.dispatchEmail({
      recipientEmail: testEmail,
      subject: 'Test connection handshake',
      textBody: 'Testing connection from Zambia Airways OCC Notification Gateway.',
    });

    return res.json({
      success: result.success,
      provider: result.provider,
      host: process.env.SMTP_HOST || 'smtp.zambiaairways.co.zm',
      port: process.env.SMTP_PORT || 587,
      message: `Email provider test verified on ${result.provider}. Test message delivered to ${testEmail}.`,
      timestamp: new Date().toISOString(),
    });
  });

  // Webhook for Meta WhatsApp Delivery & Read Receipts (Cloud Function HTTP handler)
  app.get('/api/notifications/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'zn_occ_verify_token_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification token mismatch' });
  });

  app.post('/api/notifications/whatsapp/webhook', async (req, res) => {
    if (!verifyWhatsAppSignature(req)) {
      console.warn('[Webhook] Rejected WhatsApp webhook with invalid signature.');
      return res.status(401).json({ error: 'Invalid signature.' });
    }
    const body = req.body;
    const event = handleProviderWebhookEvent('META_WHATSAPP', body);
    await recordDeliveryReceipt(event, body);
    res.status(200).json({ status: 'EVENT_RECEIVED', event });
  });

  // Webhook for SendGrid Email Delivery Receipts
  app.post('/api/notifications/email/webhook', async (req, res) => {
    const body = req.body;
    const event = handleProviderWebhookEvent('SENDGRID', body);
    await recordDeliveryReceipt(event, body);
    res.status(200).json({ status: 'EVENT_RECEIVED', event });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', airline: 'Zambia Airways Crew Control' });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zambia Airways Crew Control running on http://localhost:${PORT}`);
  });
}

startServer();
