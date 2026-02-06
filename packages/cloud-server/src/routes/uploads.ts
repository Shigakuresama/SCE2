import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadSingle, uploadMultiple } from '../middleware/upload.js';
import { NotFoundError } from '../types/errors.js';
import path from 'path';

export const uploadRoutes = Router();

// POST /api/uploads/property/:id - Upload document for property
uploadRoutes.post(
  '/property/:id',
  uploadSingle,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { docType = 'OTHER' } = req.body;
    const file = req.file as Express.Multer.File;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: parseInt(id) },
    });

    if (!property) {
      throw new NotFoundError('Property', id);
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        propertyId: parseInt(id),
        docType: docType as string,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  })
);

// POST /api/uploads/property/:id/multiple - Upload multiple documents
uploadRoutes.post(
  '/property/:id/multiple',
  uploadMultiple,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No files uploaded' },
      });
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: parseInt(id) },
    });

    if (!property) {
      throw new NotFoundError('Property', id);
    }

    // Create document records
    const documents = await prisma.document.createMany({
      data: files.map((file) => ({
        propertyId: parseInt(id),
        docType: 'OTHER' as string,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
      })),
    });

    res.status(201).json({
      success: true,
      message: `Uploaded ${documents.count} documents`,
      count: documents.count,
    });
  })
);

// GET /api/uploads/:id - Get document by ID
uploadRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { property: true },
    });

    if (!document) {
      throw new NotFoundError('Document', req.params.id);
    }

    res.json({ success: true, data: document });
  })
);

// DELETE /api/uploads/:id - Delete document
uploadRoutes.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: parseInt(id) },
    });

    if (!document) {
      throw new NotFoundError('Document', id);
    }

    // Delete file from filesystem
    // TODO: Implement file deletion

    // Delete database record
    await prisma.document.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'Document deleted',
    });
  })
);
