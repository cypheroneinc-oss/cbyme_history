import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Router } from 'express';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

interface LogRequestBody {
  eventType: string;
  userId?: string | null;
  payload: unknown;
}

export const LOG_SIGNATURE_HEADER = 'x-hmac-signature';

function getRawBody(req: RawBodyRequest): Buffer | null {
  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  return null;
}

export function createLogSignature(secret: string, rawBody: Buffer | string): string {
  const payload = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
  return createHmac('sha256', secret).update(payload).digest('base64');
}

export const logRouter = Router();

logRouter.post('/', async (req, res) => {
  const secret = process.env.HMAC_USER_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !supabaseUrl || !supabaseServiceRoleKey) {
    // eslint-disable-next-line no-console
    console.error('Missing logging configuration');
    return res.status(500).json({ error: 'Logging service is not configured' });
  }

  const rawBody = getRawBody(req as RawBodyRequest);
  if (!rawBody) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const providedSignature = req.header(LOG_SIGNATURE_HEADER);
  if (!providedSignature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const expectedSignature = createLogSignature(secret, rawBody);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureMatches =
    providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);

  if (!signatureMatches) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = req.body as LogRequestBody | undefined;
  if (!body || typeof body.eventType !== 'string' || body.eventType.length === 0) {
    return res.status(400).json({ error: 'Invalid eventType' });
  }

  if (body.userId != null && typeof body.userId !== 'string') {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const payload = body.payload ?? null;

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/app_logs`, {
      method: 'POST',
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event_type: body.eventType,
        user_id: body.userId ?? null,
        payload,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => '');
      throw new Error(`Supabase insert failed: ${response.status} ${errorPayload}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist log event', error);
    return res.status(500).json({ error: 'Failed to persist log event' });
  }

  return res.status(200).json({ status: 'logged' });
});

logRouter.all('*', (req, res) => {
  res.setHeader('Allow', 'POST');
  return res.status(405).end();
});
