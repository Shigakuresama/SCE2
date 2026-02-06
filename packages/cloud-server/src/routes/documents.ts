import { Router } from 'express';
import { param, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError, NotFoundError } from '../types/errors.js';

export const documentRoutes = Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, PDF, DOC, DOCX allowed.'));
    }
  },
});

// GET /api/documents/:id - Get document info
documentRoutes.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new ValidationError(errors.array()[0].msg);

    const documentId = parseInt(req.params.id);
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        property: true,
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: { message: 'Document not found' },
      });
    }

    res.json({ success: true, data: document });
  })
);

// POST /api/documents - Upload document
documentRoutes.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    const { propertyId, docType } = req.body;

    if (!propertyId || !docType) {
      return res.status(400).json({
        success: false,
        error: { message: 'propertyId and docType are required' },
      });
    }

    const document = await prisma.document.create({
      data: {
        propertyId,
        docType,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });

    res.status(201).json({ success: true, data: document });
  })
);

// POST /api/documents/batch - Upload multiple documents
documentRoutes.post(
  '/batch',
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const { propertyId, docType } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No files uploaded' },
      });
    }

    const documents = await prisma.document.createMany({
      data: files.map((file) => ({
        propertyId,
        docType,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
      })),
    });

    res.status(201).json({
      success: true,
      message: `${documents.count} documents uploaded`,
      count: documents.count,
    });
  })
);

// DELETE /api/documents/:id - Delete document
documentRoutes.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new ValidationError(errors.array()[0].msg);

    const documentId = parseInt(req.params.id);
    await prisma.document.delete({
      where: { id: documentId },
    });

    res.json({ success: true, message: 'Document deleted' });
  })
);

// POST /api/properties/:propertyId/documents - Upload document as base64 (for mobile)
documentRoutes.post(
  '/properties/:propertyId/documents',
  asyncHandler(async (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    const { docType, fileName, base64Data, mimeType } = req.body;

    // Validate required fields
    if (!docType || !fileName || !base64Data || !mimeType) {
      throw new ValidationError(
        'Missing required fields: docType, fileName, base64Data, mimeType'
      );
    }

    // Validate property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundError('Property', propertyId.toString());
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Create uploads directory if it doesn't exist
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(fileName) || '.jpg';
    const uniqueFileName = `${uniqueSuffix}${extension}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    // Write file to disk
    await fs.writeFile(filePath, buffer);

    // Create document record
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
        url: `/api/documents/${document.id}`,
      },
    });
  })
);
