import express from 'express';
import { apiRouter } from '../../src/routes/index.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';

export async function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
