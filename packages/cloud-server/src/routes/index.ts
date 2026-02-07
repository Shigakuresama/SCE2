import { Router } from 'express';
import { propertyRoutes } from './properties.js';
import { queueRoutes } from './queue.js';
import { uploadRoutes } from './uploads.js';
import { routeRoutes } from './routes.js';
import { zillowRoutes } from './zillow.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SCE2 API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
apiRouter.use('/properties', propertyRoutes);
apiRouter.use('/queue', queueRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/routes', routeRoutes);
apiRouter.use('/zillow', zillowRoutes);
