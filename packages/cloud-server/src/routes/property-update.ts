// packages/cloud-server/src/routes/property-update.ts

import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const propertyUpdateRoutes = Router();

/**
 * POST /api/properties/update-by-address
 * Updates property with extracted customer data from SCE route processing
 *
 * Used by extension to save customer names/phones extracted from SCE website
 */
propertyUpdateRoutes.post('/update-by-address', asyncHandler(async (req, res) => {
  const { addressFull, customerName, customerPhone, dataExtracted, extractedAt } = req.body;

  if (!addressFull) {
    return res.status(400).json({
      success: false,
      error: 'addressFull is required'
    });
  }

  // Upsert property - create if doesn't exist, update if it does
  const property = await prisma.property.upsert({
    where: { addressFull },
    update: {
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      dataExtracted: dataExtracted ?? true,
      extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
      // Move to next status after successful data extraction
      status: 'READY_FOR_FIELD',
    },
    create: {
      addressFull,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      dataExtracted: true,
      extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
      status: 'READY_FOR_FIELD',
      // Default coordinates (will be updated by geocoding)
      latitude: 0,
      longitude: 0,
    },
  });

  res.json({ success: true, data: property });
}));

/**
 * POST /api/properties/batch-update
 * Batch update multiple properties with extracted data
 */
propertyUpdateRoutes.post('/batch-update', asyncHandler(async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      error: 'updates must be an array'
    });
  }

  const results = await Promise.allSettled(
    updates.map(({ addressFull, customerName, customerPhone, dataExtracted, extractedAt }) =>
      prisma.property.upsert({
        where: { addressFull },
        update: {
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          dataExtracted: dataExtracted ?? true,
          extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
          status: 'READY_FOR_FIELD',
        },
        create: {
          addressFull,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          dataExtracted: true,
          extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
          status: 'READY_FOR_FIELD',
          latitude: 0,
          longitude: 0,
        },
      })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  res.json({
    success: true,
    data: {
      total: updates.length,
      successful,
      failed,
      results: results.map((r, i) => ({
        addressFull: updates[i].addressFull,
        success: r.status === 'fulfilled',
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason?.message : null,
      }))
    }
  });
}));
