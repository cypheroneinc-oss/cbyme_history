import { Router } from 'express';
import { buildLineReply, buildUnknownNameReply, resolveTypeFromText } from '../services/line-reply.js';
import { LineEvent, LineMessageEvent, LineTextMessage, LineWebhookRequestBody } from '../types/line.js';

const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

export const lineWebhookRouter = Router();

function isLineMessageEvent(event: LineEvent): event is LineMessageEvent {
  return event.type === 'message' && typeof (event as LineMessageEvent).replyToken === 'string';
}

function isTextMessage(message: LineMessageEvent['message']): message is LineTextMessage {
  return !!message && message.type === 'text' && typeof (message as LineTextMessage).text === 'string';
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

lineWebhookRouter.post('/', async (req, res) => {
  const body = req.body as LineWebhookRequestBody | undefined;

  if (!body || !Array.isArray(body.events)) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

  if (!channelAccessToken || !channelSecret || !appBaseUrl) {
    // eslint-disable-next-line no-console
    console.error('Missing LINE configuration variables');
    return res.status(500).json({ error: 'LINE channel is not configured' });
  }

  const replyPromises: Promise<void>[] = [];

  for (const event of body.events) {
    if (!isLineMessageEvent(event)) continue;
    const message = event.message;
    if (!isTextMessage(message)) continue;

    const resolution = resolveTypeFromText(message.text);
    const replyText = resolution ? buildLineReply(resolution, appBaseUrl) : buildUnknownNameReply(message.text);
    replyPromises.push(sendReply(channelAccessToken, event.replyToken, replyText));
  }

  if (replyPromises.length === 0) {
    return res.status(200).json({ status: 'ignored' });
  }

  try {
    await Promise.all(replyPromises);
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to send reply to LINE', error);
    return res.status(500).json({ error: 'Failed to send reply' });
  }
});
