import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError } from '../types/errors.js';
import { validateBody, validateQuery, validateParams, IdParamSchema } from '../lib/validation.js';
import {
  CreatePropertySchema,
  BatchCreatePropertySchema,
  PatchPropertySchema,
  PropertyQuerySchema,
  BatchAddressSchema,
} from '../schemas/property.schema.js';
import z from 'zod';

export const propertyRoutes = Router();

// Type inference from schemas
type PropertyQuery = z.infer<typeof PropertyQuerySchema>;
type BatchCreateBody = z.infer<typeof BatchCreatePropertySchema>;
type PatchBody = z.infer<typeof PatchPropertySchema>;
type IdParams = z.infer<typeof IdParamSchema>;

// GET /api/properties - List all properties with optional filters
propertyRoutes.get(
  '/',
  validateQuery(PropertyQuerySchema),
  asyncHandler(async (req, res) => {
    const { status, routeId, limit, offset } = req.query as unknown as PropertyQuery;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (routeId) {
      where.routeId = parseInt(routeId, 10);
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
        orderBy: { createdAt: 'asc' },
        include: {
          documents: true,
        },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      success: true,
      data: properties,
      meta: { total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) },
    });
  })
);

// GET /api/properties/:id - Get single property by ID
propertyRoutes.get(
  '/:id',
  validateParams(IdParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as IdParams;

    const property = await prisma.property.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!property) {
      throw new NotFoundError('Property', String(id));
    }

    res.json({ success: true, data: property });
  })
);

// POST /api/properties - Create single property
propertyRoutes.post(
  '/',
  validateBody(CreatePropertySchema),
  asyncHandler(async (req, res) => {
    const {
      addressFull,
      streetNumber,
      streetName,
      zipCode,
      city,
      state,
      latitude,
      longitude,
      routeId,
    } = req.body;

    const property = await prisma.property.create({
      data: {
        addressFull,
        streetNumber,
        streetName,
        zipCode,
        city,
        state,
        latitude,
        longitude,
        routeId,
      },
    });

    res.status(201).json({ success: true, data: property });
  })
);

// POST /api/properties/batch - Create multiple properties (batch import)
propertyRoutes.post(
  '/batch',
  validateBody(BatchCreatePropertySchema),
  asyncHandler(async (req, res) => {
    const { addresses } = req.body as BatchCreateBody;

    // Bulk create
    const properties = await prisma.property.createMany({
      data: addresses.map((addr: z.infer<typeof BatchAddressSchema>) => ({
        addressFull: addr.addressFull,
        streetNumber: addr.streetNumber,
        streetName: addr.streetName,
        zipCode: addr.zipCode,
        city: addr.city,
        state: addr.state,
        latitude: addr.latitude,
        longitude: addr.longitude,
        routeId: addr.routeId,
      })),
    });

    // Fetch created properties to return them
    const createdProperties = await prisma.property.findMany({
      where: {
        addressFull: { in: addresses.map((a: z.infer<typeof BatchAddressSchema>) => a.addressFull) },
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

// PATCH /api/properties/:id - Update property
propertyRoutes.patch(
  '/:id',
  validateParams(IdParamSchema),
  validateBody(PatchPropertySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as IdParams;
    const updates = req.body as PatchBody;

    const property = await prisma.property.update({
      where: { id },
      data: updates,
    });

    res.json({ success: true, data: property });
  })
);

// DELETE /api/properties/all - Delete all properties (with optional status filter)
// MUST come before /:id route to avoid "all" being treated as an ID
propertyRoutes.delete(
  '/all',
  asyncHandler(async (req, res) => {
    const { status } = req.query;

    const where: any = {};
    if (status) {
      where.status = status as string;
    }

    const result = await prisma.property.deleteMany({
      where,
    });

    res.json({
      success: true,
      message: `Deleted ${result.count} properties`,
      deletedCount: result.count,
    });
  })
);

// DELETE /api/properties/:id - Delete property
propertyRoutes.delete(
  '/:id',
  validateParams(IdParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as IdParams;

    // Check if property exists first
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundError('Property', String(id));
    }

    await prisma.property.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Property deleted' });
  })
);

// GET /api/properties/:id/mobile-data - Get property data for mobile view
propertyRoutes.get(
  '/:id/mobile-data',
  validateParams(IdParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as IdParams;

    const property = await prisma.property.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!property) {
      throw new NotFoundError('Property', String(id));
    }

    // Return mobile-optimized data
    res.json({
      success: true,
      data: {
        id: property.id,
        addressFull: property.addressFull,
        streetNumber: property.streetNumber,
        streetName: property.streetName,
        zipCode: property.zipCode,
        city: property.city,
        state: property.state,
        latitude: property.latitude,
        longitude: property.longitude,
        customerName: property.customerName,
        customerPhone: property.customerPhone,
        customerEmail: property.customerEmail,
        customerAge: property.customerAge,
        fieldNotes: property.fieldNotes,
        status: property.status,
        documents: property.documents,
      },
    });
  })
);
