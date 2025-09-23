import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Router } from 'express';
import { LOG_SIGNATURE_HEADER, createLogSignature } from './log.js';
import { LineEvent, LineMessageEvent, LineTextMessage, LineWebhookRequestBody } from '../types/line.js';

const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function getRawBody(req: RawBodyRequest): Buffer | null {
  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  return null;
}

function isMessageEvent(event: LineEvent): event is LineMessageEvent {
  return event.type === 'message' && typeof (event as LineMessageEvent).replyToken === 'string';
}

function isTextMessage(message: LineMessageEvent['message']): message is LineTextMessage {
  return !!message && message.type === 'text' && typeof (message as LineTextMessage).text === 'string';
}

function resolveBaseUrl(req: Request): string | null {
  const host = req.get('host');
  if (!host) return null;
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0]?.trim() : req.protocol;
  if (!protocol) return null;
  return `${protocol}://${host}`;
}

async function sendReply(channelAccessToken: string, replyToken: string, text: string): Promise<void> {
  const response = await fetch(LINE_REPLY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LINE reply failed with ${response.status}: ${errorBody}`);
  }
}

async function postEventLog(logEndpoint: string, secret: string, event: LineEvent): Promise<void> {
  const payload = {
    eventType: event.type,
    userId: typeof event.source?.userId === 'string' ? event.source.userId : null,
    payload: event,
  };

  const body = JSON.stringify(payload);
  const response = await fetch(logEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [LOG_SIGNATURE_HEADER]: createLogSignature(secret, body),
    },
    body,
  });

  if (!response.ok) {
    const errorPayload = await response.text().catch(() => '');
    throw new Error(`Log endpoint rejected event: ${response.status} ${errorPayload}`);
  }
}

function verifyLineSignature(rawBody: Buffer, signature: string, channelSecret: string): boolean {
  const expectedSignature = createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export const lineWebhookRouter = Router();

lineWebhookRouter.post('/', async (req, res) => {
  const rawBody = getRawBody(req as RawBodyRequest);
  if (!rawBody) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const logSecret = process.env.HMAC_USER_SECRET;

  if (!channelSecret || !channelAccessToken || !logSecret) {
    // eslint-disable-next-line no-console
    console.error('Missing LINE webhook configuration');
    return res.status(500).json({ error: 'LINE webhook is not configured' });
  }

  const signature = req.header('x-line-signature');
  if (!signature || !verifyLineSignature(rawBody, signature, channelSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = req.body as LineWebhookRequestBody | undefined;
  if (!body || !Array.isArray(body.events)) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const baseUrl = resolveBaseUrl(req);
  if (!baseUrl) {
    // eslint-disable-next-line no-console
    console.error('Unable to resolve base URL for logging endpoint');
    return res.status(500).json({ error: 'LINE webhook misconfiguration' });
  }

  const logEndpoint = new URL('/api/log', baseUrl).toString();

  const replyPromises: Promise<void>[] = [];
  const logPromises: Promise<void>[] = [];

  for (const event of body.events) {
    logPromises.push(
      postEventLog(logEndpoint, logSecret, event).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to persist LINE event log', error);
      }),
    );

    if (!isMessageEvent(event)) {
      continue;
    }

    const message = event.message;
    if (!isTextMessage(message)) {
      continue;
    }

    const replyText = `[echo] ${message.text}`;
    replyPromises.push(
      sendReply(channelAccessToken, event.replyToken, replyText).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to reply to LINE message', error);
      }),
    );
  }

  await Promise.allSettled([...logPromises, ...replyPromises]);

  return res.status(200).json({ status: 'ok' });
});

lineWebhookRouter.all('*', (req, res) => {
  res.setHeader('Allow', 'POST');
  return res.status(405).end();
});
