import express from 'express';
import { diagnoseRouter } from './api/diagnose.js';
import { lineWebhookRouter } from './api/line-webhook.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/diagnose', diagnoseRouter);
  app.use('/api/line-webhook', lineWebhookRouter);
  return app;
}
