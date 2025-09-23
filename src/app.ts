import express, { Request } from 'express';
import { diagnoseRouter } from './api/diagnose.js';
import { lineWebhookRouter } from './api/line-webhook.js';
import { logRouter } from './api/log.js';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function rawBodySaver(req: RawBodyRequest, _res: unknown, buffer: Buffer, _encoding: string) {
  void _encoding;
  if (buffer?.length) {
    req.rawBody = Buffer.from(buffer);
  } else {
    req.rawBody = Buffer.alloc(0);
  }
}

export function createApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, res, buf, encoding) => rawBodySaver(req as RawBodyRequest, res, buf, encoding),
    }),
  );
  app.use('/api/diagnose', diagnoseRouter);
  app.use('/api/log', logRouter);
  app.use('/api/line/webhook', lineWebhookRouter);
  return app;
}
