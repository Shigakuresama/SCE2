// packages/cloud-server/src/routes/property-update.ts

import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ConflictError, NotFoundError, ValidationError } from '../types/errors.js';

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

/**
 * POST /api/properties/:id/complete-visit
 * Marks a property as VISITED after required field documents are uploaded.
 */
propertyUpdateRoutes.post('/:id/complete-visit', asyncHandler(async (req, res) => {
  const rawPropertyId = req.params.id;
  const propertyId = Number(rawPropertyId);

  if (!/^\d+$/.test(rawPropertyId) || !Number.isInteger(propertyId) || propertyId <= 0) {
    throw new ValidationError('id must be a positive integer');
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new NotFoundError('Property', rawPropertyId);
  }

  if (property.status !== 'READY_FOR_FIELD') {
    throw new ConflictError(
      `Visit completion only allowed from READY_FOR_FIELD. Current status: ${property.status}`
    );
  }

  const requiredDocTypes = ['BILL', 'SIGNATURE'];
  const documents = await prisma.document.findMany({
    where: { propertyId },
    select: { docType: true },
  });
  const availableTypes = new Set(documents.map((document) => document.docType));
  const missingDocTypes = requiredDocTypes.filter((docType) => !availableTypes.has(docType));

  if (missingDocTypes.length > 0) {
    throw new ConflictError(
      `Visit completion requires BILL and SIGNATURE documents. Missing: ${missingDocTypes.join(', ')}`
    );
  }

  const updatedProperty = await prisma.property.update({
    where: { id: propertyId },
    data: { status: 'VISITED' },
  });

  res.json({ success: true, data: updatedProperty });
}));
