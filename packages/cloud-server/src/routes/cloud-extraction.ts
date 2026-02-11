import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

export const cloudExtractionRoutes = Router();

function parseSessionId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError('sessionId must be a positive integer');
  }
  return value;
}

function parsePropertyIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('propertyIds must be a non-empty array');
  }
  if (value.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id <= 0)) {
    throw new ValidationError('propertyIds must contain only positive integers');
  }

  return value as number[];
}

cloudExtractionRoutes.post(
  '/runs',
  asyncHandler(async (req, res) => {
    const sessionId = parseSessionId(req.body?.sessionId);
    const propertyIds = parsePropertyIds(req.body?.propertyIds);

    const session = await prisma.extractionSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundError('ExtractionSession', sessionId);
    }

    const run = await prisma.extractionRun.create({
      data: {
        sessionId,
        status: 'QUEUED',
        totalCount: propertyIds.length,
        items: {
          create: propertyIds.map((propertyId) => ({
            propertyId,
            status: 'QUEUED',
          })),
        },
      },
      select: {
        id: true,
        status: true,
        totalCount: true,
        processedCount: true,
        successCount: true,
        failureCount: true,
        sessionId: true,
      },
    });

    res.status(201).json({ success: true, data: run });
  })
);
