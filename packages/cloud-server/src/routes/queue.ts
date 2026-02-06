import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { ValidationError } from '../types/errors.js';

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

// POST /api/queue/addresses - Queue multiple addresses for scraping
queueRoutes.post(
  '/addresses',
  asyncHandler(async (req, res) => {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new ValidationError('addresses must be a non-empty array');
    }

    // Validate each address has required fields
    for (const addr of addresses) {
      if (!addr.addressFull || !addr.streetNumber || !addr.streetName || !addr.zipCode) {
        throw new ValidationError(
          'Each address must have addressFull, streetNumber, streetName, zipCode'
        );
      }
    }

    // Bulk create properties with PENDING_SCRAPE status
    const properties = await prisma.property.createMany({
      data: addresses.map((addr: any) => ({
        addressFull: addr.addressFull,
        streetNumber: addr.streetNumber,
        streetName: addr.streetName,
        zipCode: addr.zipCode,
        city: addr.city,
        state: addr.state,
        latitude: addr.latitude,
        longitude: addr.longitude,
        status: 'PENDING_SCRAPE',
      })),
    });

    // Fetch created properties to return them
    const createdProperties = await prisma.property.findMany({
      where: {
        addressFull: { in: addresses.map((a: any) => a.addressFull) },
      },
      orderBy: { createdAt: 'desc' },
      take: addresses.length,
    });

    res.status(201).json({
      success: true,
      data: createdProperties,
      count: properties.count,
    });
  })
);
