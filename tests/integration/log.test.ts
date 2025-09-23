import { createHmac } from 'crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

const originalFetch = global.fetch;
const originalSecret = process.env.HMAC_USER_SECRET;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('POST /api/log', () => {
  beforeEach(() => {
    process.env.HMAC_USER_SECRET = 'test-user-secret';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.HMAC_USER_SECRET;
    } else {
      process.env.HMAC_USER_SECRET = originalSecret;
    }

    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
    }

    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('persists events to Supabase when provided with a valid signature', async () => {
    const app = createApp();
    const payload = JSON.stringify({
      eventType: 'message',
      userId: 'U123',
      payload: { hello: 'world' },
    });
    const signature = createHmac('sha256', 'test-user-secret').update(payload).digest('base64');

    global.fetch = vi.fn(async (url: string | URL) => {
      const href = typeof url === 'string' ? url : url.toString();
      expect(href).toBe('https://example.supabase.co/rest/v1/app_logs');
      return {
        ok: true,
        text: async () => '',
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const response = await request(app)
      .post('/api/log')
      .set('Content-Type', 'application/json')
      .set('X-Hmac-Signature', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('logged');

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      apikey: 'test-service-role-key',
      Authorization: 'Bearer test-service-role-key',
    });
    const supabasePayload = JSON.parse(String(options.body ?? '{}'));
    expect(supabasePayload.event_type).toBe('message');
    expect(supabasePayload.user_id).toBe('U123');
    expect(supabasePayload.payload.hello).toBe('world');
  });

  it('rejects requests without a valid signature', async () => {
    const app = createApp();
    global.fetch = vi.fn() as unknown as typeof fetch;

    const response = await request(app)
      .post('/api/log')
      .set('Content-Type', 'application/json')
      .set('X-Hmac-Signature', 'invalid')
      .send(JSON.stringify({ eventType: 'message', payload: {} }));

    expect(response.status).toBe(401);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when Supabase rejects the insert', async () => {
    const app = createApp();
    const payload = JSON.stringify({ eventType: 'message', userId: null, payload: {} });
    const signature = createHmac('sha256', 'test-user-secret').update(payload).digest('base64');

    global.fetch = vi.fn(async () => ({
      ok: false,
      text: async () => 'bad request',
    })) as unknown as typeof fetch;

    const response = await request(app)
      .post('/api/log')
      .set('Content-Type', 'application/json')
      .set('X-Hmac-Signature', signature)
      .send(payload);

    expect(response.status).toBe(500);
    expect(response.body.error).toBeDefined();
  });
});
