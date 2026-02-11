import express from 'express';
import { apiRouter } from '../../src/routes/index.js';

export async function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}
