import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

const originalFetch = global.fetch;
const originalAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const originalSecret = process.env.LINE_CHANNEL_SECRET;
const originalBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

describe('POST /api/line-webhook', () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-access-token';
    process.env.LINE_CHANNEL_SECRET = 'test-channel-secret';
    process.env.NEXT_PUBLIC_APP_BASE_URL = 'https://example.com/app';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
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
    if (originalBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_BASE_URL = originalBaseUrl;
    }
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('replies with a mapped diagnosis paragraph for known aliases', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/line-webhook')
      .send({
        events: [
          {
            type: 'message',
            replyToken: 'reply-token-1',
            message: { type: 'text', text: 'りょうま' },
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    const payload = JSON.parse(String(options.body ?? '{}'));
    expect(payload.replyToken).toBe('reply-token-1');
    expect(payload.messages).toHaveLength(1);
    const text: string = payload.messages[0].text;
    const [paragraph] = text.split(/ https:\/\//);
    const sentences = paragraph
      .split('。')
      .map((sentence: string) => sentence.trim())
      .filter((sentence: string) => sentence.length > 0);
    expect(sentences).toHaveLength(5);
    expect(sentences[0]).toContain('チャレンジ×コネクトタイプ');
    expect(text).toMatch(/https:\/\/example.com\/app\/result\?typeId=challenge-connect$/);
  });

  it('falls back to an explanatory message when no alias matches', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/line-webhook')
      .send({
        events: [
          {
            type: 'message',
            replyToken: 'reply-token-2',
            message: { type: 'text', text: '未知の偉人' },
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body ?? '{}'));
    expect(payload.messages[0].text).toContain('未知の偉人に対応するタイプを見つけられませんでした');
  });

  it('acknowledges webhooks without text messages', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/line-webhook')
      .send({ events: [{ type: 'follow', replyToken: 'unused' }] });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ignored');
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
