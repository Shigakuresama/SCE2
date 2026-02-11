import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { propertyRoutes } from './properties.js';
import { propertyUpdateRoutes } from './property-update.js';
import { queueRoutes } from './queue.js';
import { uploadRoutes } from './uploads.js';
import { routeRoutes } from './routes.js';
import { zillowRoutes } from './zillow.js';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

export const apiRouter = Router();

function isBase64String(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.length % 4 !== 0) {
    return false;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return false;
  }

  try {
    return Buffer.from(normalized, 'base64').length > 0;
  } catch {
    return false;
  }
}

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
apiRouter.use('/properties', propertyUpdateRoutes);
apiRouter.use('/queue', queueRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/routes', routeRoutes);
apiRouter.use('/zillow', zillowRoutes);

// Mobile base64 document upload route
apiRouter.post(
  '/properties/:propertyId/documents',
  asyncHandler(async (req, res) => {
    const rawPropertyId = req.params.propertyId;
    const propertyId = Number(rawPropertyId);
    const { docType, fileName, base64Data, mimeType } = req.body;
    const extensionByMimeType = new Map<string, string>([
      ['image/jpeg', '.jpg'],
      ['image/jpg', '.jpg'],
      ['image/png', '.png'],
      ['application/pdf', '.pdf'],
    ]);

    if (!/^\d+$/.test(rawPropertyId) || !Number.isInteger(propertyId) || propertyId <= 0) {
      throw new ValidationError('propertyId must be a positive integer');
    }

    if (!docType || !fileName || !base64Data || !mimeType) {
      throw new ValidationError(
        'Missing required fields: docType, fileName, base64Data, mimeType'
      );
    }

    if (!extensionByMimeType.has(mimeType)) {
      throw new ValidationError(`Invalid file type: ${mimeType}`);
    }

    if (typeof base64Data !== 'string' || !isBase64String(base64Data)) {
      throw new ValidationError('base64Data must be a valid base64 string');
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundError('Property', propertyId.toString());
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = extensionByMimeType.get(mimeType) ?? '.bin';
    const uniqueFileName = `${uniqueSuffix}${extension}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    await fs.writeFile(filePath, buffer);

    const document = await prisma.document.create({
      data: {
        propertyId,
        docType,
        fileName: uniqueFileName,
        filePath,
        fileSize: buffer.length,
        mimeType,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: document.id,
        url: `/api/uploads/${document.id}`,
      },
    });
  })
);
