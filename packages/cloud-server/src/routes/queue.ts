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

// GET /api/queue/status - Get queue status counts
queueRoutes.get(
  '/status',
  asyncHandler(async (req, res) => {
    const [pendingScrape, readyForField, visited, readyForSubmission, complete, failed] =
      await Promise.all([
        prisma.property.count({ where: { status: 'PENDING_SCRAPE' } }),
        prisma.property.count({ where: { status: 'READY_FOR_FIELD' } }),
        prisma.property.count({ where: { status: 'VISITED' } }),
        prisma.property.count({ where: { status: 'READY_FOR_SUBMISSION' } }),
        prisma.property.count({ where: { status: 'COMPLETE' } }),
        prisma.property.count({ where: { status: 'FAILED' } }),
      ]);

    res.json({
      success: true,
      data: {
        pendingScrape,
        readyForField,
        visited,
        readyForSubmission,
        complete,
        failed,
      },
    });
  })
);
