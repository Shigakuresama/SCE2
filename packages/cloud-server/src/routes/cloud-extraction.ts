import { Router } from 'express';

export const cloudExtractionRoutes = Router();

cloudExtractionRoutes.post('/runs', (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      id: 1,
      status: 'QUEUED',
      propertyIds: req.body?.propertyIds ?? [],
      sessionId: req.body?.sessionId ?? null,
    },
  });
});
