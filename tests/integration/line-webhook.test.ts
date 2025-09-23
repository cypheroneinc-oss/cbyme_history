import { createHmac } from 'crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

const originalFetch = global.fetch;
const originalAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const originalSecret = process.env.LINE_CHANNEL_SECRET;
const originalLogSecret = process.env.HMAC_USER_SECRET;

function signPayload(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('base64');
}

describe('POST /api/line/webhook', () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-access-token';
    process.env.LINE_CHANNEL_SECRET = 'test-channel-secret';
    process.env.HMAC_USER_SECRET = 'test-user-secret';
    global.fetch = vi.fn(async (url: string | URL) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (href.includes('/api/log')) {
        return {
          ok: true,
          text: async () => '',
        } as unknown as Response;
      }
      if (href === 'https://api.line.me/v2/bot/message/reply') {
        return {
          ok: true,
          text: async () => '',
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch call to ${href}`);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalAccessToken === undefined) {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    } else {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = originalAccessToken;
    }
    if (originalSecret === undefined) {
      delete process.env.LINE_CHANNEL_SECRET;
    } else {
      process.env.LINE_CHANNEL_SECRET = originalSecret;
    }
    if (originalLogSecret === undefined) {
      delete process.env.HMAC_USER_SECRET;
    } else {
      process.env.HMAC_USER_SECRET = originalLogSecret;
    }
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('echoes text messages and forwards events to the log endpoint', async () => {
    const app = createApp();
    const payload = JSON.stringify({
      events: [
        {
          type: 'message',
          replyToken: 'reply-token-1',
          message: { type: 'text', text: 'hello world' },
          source: { type: 'user', userId: 'U123' },
        },
      ],
    });
    const signature = signPayload('test-channel-secret', payload);

    const response = await request(app)
      .post('/api/line/webhook')
      .set('X-Line-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const logCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/log'));
    expect(logCall).toBeDefined();
    const [, logOptions] = logCall as [string | URL, RequestInit];
    expect(logOptions.method).toBe('POST');
    expect(logOptions.headers).toMatchObject({ 'Content-Type': 'application/json' });
    const logBody = String(logOptions.body ?? '');
    const logPayload = JSON.parse(logBody);
    expect(logPayload.eventType).toBe('message');
    expect(logPayload.userId).toBe('U123');
    expect(logPayload.payload.message.text).toBe('hello world');
    const logHeaders = logOptions.headers as Record<string, string>;
    expect(logHeaders['x-hmac-signature']).toBe(signPayload('test-user-secret', logBody));

    const replyCall = fetchMock.mock.calls.find(([url]) =>
      String(url).startsWith('https://api.line.me/v2/bot/message/reply'),
    );
    expect(replyCall).toBeDefined();
    const [, replyOptions] = replyCall as [string | URL, RequestInit];
    const replyPayload = JSON.parse(String(replyOptions.body ?? '{}'));
    expect(replyPayload.replyToken).toBe('reply-token-1');
    expect(replyPayload.messages[0].text).toBe('[echo] hello world');
  });

  it('logs follow events without sending replies', async () => {
    const app = createApp();
    const payload = JSON.stringify({
      events: [
        {
          type: 'follow',
          source: { type: 'user', userId: 'U999' },
        },
      ],
    });
    const signature = signPayload('test-channel-secret', payload);

    const response = await request(app)
      .post('/api/line/webhook')
      .set('X-Line-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const logCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/log'));
    expect(logCalls).toHaveLength(1);
    const replyCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('https://api.line.me/v2/bot/message/reply'),
    );
    expect(replyCalls).toHaveLength(0);
  });

  it('rejects requests with invalid signatures', async () => {
    const app = createApp();
    const payload = JSON.stringify({ events: [] });

    const response = await request(app)
      .post('/api/line/webhook')
      .set('X-Line-Signature', 'invalid')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(401);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
