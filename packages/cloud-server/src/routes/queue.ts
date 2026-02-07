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

// ==========================================
// ATOMIC QUEUE CLAIM ENDPOINTS (Bug Fix #3)
// Prevents race conditions where multiple extension instances claim the same job
// Uses transactions with concurrent update detection
// ==========================================

// GET /api/queue/scrape-and-claim - Atomically claim a scrape job
queueRoutes.get('/scrape-and-claim', asyncHandler(async (req, res) => {
  const now = new Date();

  // Use transaction to atomically find and lock a job
  const property = await prisma.$transaction(async (tx) => {
    // Find a property that needs scraping
    const available = await tx.property.findFirst({
      where: {
        status: 'PENDING_SCRAPE',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!available) {
      return null;
    }

    // Atomically update status to lock it
    // The WHERE clause includes status check, so if another poll
    // already claimed it, this update affects 0 rows and returns null
    return await tx.property.update({
      where: {
        id: available.id,
        status: 'PENDING_SCRAPE', // Ensures status hasn't changed
      },
      data: {
        status: 'SCRAPING_IN_PROGRESS',
        updatedAt: now,
      },
    });
  });

  if (!property) {
    return res.json({
      success: true,
      data: null,
      message: 'No properties pending scrape',
    });
  }

  logger.info(`Property ${property.id} atomically claimed for scraping`);

  res.json({ success: true, data: property });
}));

// GET /api/queue/submit-and-claim - Atomically claim a submit job
queueRoutes.get('/submit-and-claim', asyncHandler(async (req, res) => {
  const now = new Date();

  const property = await prisma.$transaction(async (tx) => {
    const available = await tx.property.findFirst({
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

    if (!available) {
      return null;
    }

    // Atomically update with status check to prevent races
    return await tx.property.update({
      where: {
        id: available.id,
        status: 'VISITED',
      },
      data: {
        status: 'SUBMITTING_IN_PROGRESS',
        updatedAt: now,
      },
      include: {
        documents: true,
      },
    });
  });

  if (!property) {
    return res.json({
      success: true,
      data: null,
      message: 'No properties ready for submission',
    });
  }

  logger.info(`Property ${property.id} atomically claimed for submission`);

  res.json({ success: true, data: property });
}));

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

    // Validate input
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new ValidationError('addresses must be a non-empty array');
    }

    if (addresses.length > 100) {
      throw new ValidationError('Cannot queue more than 100 addresses at once');
    }

    // Define AddressInput type for type safety
    interface AddressInput {
      addressFull: string;
      streetNumber: string;
      streetName: string;
      zipCode: string;
      city?: string | null;
      state?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }

    // Validate each address has required fields
    for (const addr of addresses as AddressInput[]) {
      if (!addr.addressFull || !addr.streetNumber || !addr.streetName || !addr.zipCode) {
        throw new ValidationError(
          'Each address must have addressFull, streetNumber, streetName, zipCode'
        );
      }

      // Validate string lengths to prevent database overflow
      if (addr.addressFull.length > 255) {
        throw new ValidationError('addressFull exceeds 255 characters');
      }
      if (addr.zipCode.length > 10) {
        throw new ValidationError('zipCode exceeds 10 characters');
      }
    }

    // Use transaction for atomicity and duplicate detection
    const result = await prisma.$transaction(async (tx) => {
      // Check for duplicates
      const existing = await tx.property.findMany({
        where: {
          addressFull: { in: (addresses as AddressInput[]).map((a) => a.addressFull) },
        },
        select: { addressFull: true },
      });

      if (existing.length > 0) {
        const duplicates = existing.map((p) => p.addressFull).join(', ');
        throw new ValidationError(`Addresses already exist: ${duplicates}`);
      }

      // Create properties
      await tx.property.createMany({
        data: (addresses as AddressInput[]).map((addr) => ({
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

      // Fetch created properties within same transaction
      return tx.property.findMany({
        where: {
          addressFull: { in: (addresses as AddressInput[]).map((a) => a.addressFull) },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    res.status(201).json({
      success: true,
      data: result,
      count: result.length,
    });
  })
);
