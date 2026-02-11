import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { ConflictError, NotFoundError, ValidationError } from '../types/errors.js';

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

// POST /api/queue/:id/requeue-submit - Return claimed submit job back to VISITED
queueRoutes.post(
  '/:id/requeue-submit',
  asyncHandler(async (req, res) => {
    const rawId = req.params.id;
    const propertyId = Number(rawId);
    const { reason } = req.body ?? {};

    if (!/^\d+$/.test(rawId) || !Number.isInteger(propertyId) || propertyId <= 0) {
      throw new ValidationError('id must be a positive integer');
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundError('Property', rawId);
    }

    if (property.status === 'VISITED') {
      logger.warn(`Property ${rawId} already VISITED during requeue`, { reason });
      return res.json({
        success: true,
        data: property,
        message: 'Property already available for submission',
      });
    }

    if (property.status !== 'SUBMITTING_IN_PROGRESS') {
      throw new ConflictError(
        `Requeue submit only allowed from SUBMITTING_IN_PROGRESS. Current status: ${property.status}`
      );
    }

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: { status: 'VISITED' },
    });

    logger.warn(`Property ${rawId} requeued to VISITED`, { reason });

    res.json({ success: true, data: updated });
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

    const normalizedInput = (addresses as AddressInput[]).map((addr) => ({
      addressFull: String(addr.addressFull ?? '').trim(),
      streetNumber: String(addr.streetNumber ?? '').trim(),
      streetName: String(addr.streetName ?? '').trim(),
      zipCode: String(addr.zipCode ?? '').trim(),
      city: addr.city ? String(addr.city).trim() : null,
      state: addr.state ? String(addr.state).trim() : null,
      latitude: addr.latitude ?? null,
      longitude: addr.longitude ?? null,
    }));

    // Validate each address has required fields
    for (const addr of normalizedInput) {
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

    // Dedupe incoming payload by normalized addressFull to prevent unique collisions.
    const dedupedByAddress = new Map<string, typeof normalizedInput[number]>();
    for (const addr of normalizedInput) {
      const key = addr.addressFull.toLowerCase();
      if (!dedupedByAddress.has(key)) {
        dedupedByAddress.set(key, addr);
      }
    }
    const dedupedAddresses = Array.from(dedupedByAddress.values());

    // Use transaction for atomicity and duplicate-safe insertion
    const result = await prisma.$transaction(async (tx) => {
      // Check for already-existing addresses in DB
      const existing = await tx.property.findMany({
        where: {
          addressFull: { in: dedupedAddresses.map((a) => a.addressFull) },
        },
        select: { addressFull: true },
      });

      const existingSet = new Set(existing.map((p) => p.addressFull.toLowerCase()));
      const toCreate = dedupedAddresses.filter(
        (addr) => !existingSet.has(addr.addressFull.toLowerCase())
      );

      if (toCreate.length > 0) {
        // Create only addresses not yet present.
        await tx.property.createMany({
          data: toCreate.map((addr) => ({
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
      }

      const created = toCreate.length === 0
        ? []
        : await tx.property.findMany({
        where: {
            addressFull: { in: toCreate.map((a) => a.addressFull) },
        },
        orderBy: { createdAt: 'desc' },
      });

      const skippedAddresses = dedupedAddresses
        .filter((addr) => existingSet.has(addr.addressFull.toLowerCase()))
        .map((addr) => addr.addressFull);

      return { created, skippedAddresses };
    });

    res.status(201).json({
      success: true,
      data: result.created,
      count: result.created.length,
      skippedCount: result.skippedAddresses.length,
      skippedAddresses: result.skippedAddresses,
    });
  })
);
