import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

export const propertyRoutes = Router();

// GET /api/properties - List all properties with optional filters
propertyRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, routeId, limit = 50, offset = 0 } = req.query;

    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (routeId) {
      where.routeId = parseInt(routeId as string);
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
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
      meta: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  })
);

// GET /api/properties/:id - Get single property by ID
propertyRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { documents: true },
    });

    if (!property) {
      throw new NotFoundError('Property', req.params.id);
    }

    res.json({ success: true, data: property });
  })
);

// POST /api/properties - Create single property
propertyRoutes.post(
  '/',
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

    if (!addressFull || !streetNumber || !streetName || !zipCode) {
      throw new ValidationError(
        'Missing required fields: addressFull, streetNumber, streetName, zipCode'
      );
    }

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
  asyncHandler(async (req, res) => {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new ValidationError('addresses must be a non-empty array');
    }

    // Validate each address
    for (const addr of addresses) {
      if (!addr.addressFull || !addr.streetNumber || !addr.streetName || !addr.zipCode) {
        throw new ValidationError(
          'Each address must have addressFull, streetNumber, streetName, zipCode'
        );
      }
    }

    // Bulk create
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
        routeId: addr.routeId,
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

// PATCH /api/properties/:id - Update property
propertyRoutes.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: updates,
    });

    res.json({ success: true, data: property });
  })
);

// DELETE /api/properties/:id - Delete property
propertyRoutes.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.property.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ success: true, message: 'Property deleted' });
  })
);

// GET /api/properties/:id/mobile-data - Get property data for mobile view
propertyRoutes.get(
  '/:id/mobile-data',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { documents: true },
    });

    if (!property) {
      throw new NotFoundError('Property', req.params.id);
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
