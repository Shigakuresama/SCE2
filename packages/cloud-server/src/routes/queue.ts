import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

export const queueRoutes = Router();

// GET /api/queue/scrape - Get next property to scrape
queueRoutes.get('/scrape', asyncHandler(async (req, res) => {
  const property = await prisma.property.findFirst({
    where: {
      status: 'PENDING_SCRAPE',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!property) {
    return res.json({
      success: true,
      data: null,
      message: 'No properties pending scrape',
    });
  }

  res.json({ success: true, data: property });
}));

// POST /api/queue/:id/scraped - Save scraped data
queueRoutes.post(
  '/:id/scraped',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { customerName, customerPhone, customerEmail } = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: {
        customerName,
        customerPhone,
        customerEmail,
        status: 'READY_FOR_FIELD',
      },
    });

    res.json({ success: true, data: property });
  })
);

// GET /api/queue/submit - Get property ready for submission
queueRoutes.get(
  '/submit',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findFirst({
      where: {
        status: 'VISITED',
      },
      include: {
        documents: true,
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    if (!property) {
      return res.json({
        success: true,
        data: null,
        message: 'No properties ready for submission',
      });
    }

    res.json({ success: true, data: property });
  })
);

// POST /api/queue/:id/complete - Mark property as complete
queueRoutes.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { sceCaseId } = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: {
        sceCaseId,
        status: 'COMPLETE',
      },
    });

    res.json({ success: true, data: property });
  })
);

// POST /api/queue/:id/fail - Mark property as failed
queueRoutes.post(
  '/:id/fail',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: {
        status: 'FAILED',
      },
    });

    // Log failure reason
    logger.warn(`Property ${id} marked as failed`, { reason });

    res.json({ success: true, data: property });
  })
);
