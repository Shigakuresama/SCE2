import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

export const routeRoutes = Router();

// GET /api/routes - List all routes
routeRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const routes = await prisma.route.findMany({
      include: {
        properties: {
          select: {
            id: true,
            addressFull: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: routes });
  })
);

// GET /api/routes/:id - Get single route with properties
routeRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const routeId = parseInt(req.params.id);

    if (isNaN(routeId) || routeId <= 0) {
      throw new ValidationError('Invalid route ID: must be a positive integer');
    }

    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        properties: {
          include: { documents: true },
        },
      },
    });

    if (!route) {
      throw new NotFoundError('Route', req.params.id);
    }

    res.json({ success: true, data: route });
  })
);

// POST /api/routes - Create new route
routeRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, description, propertyIds } = req.body;

    // Validate name
    if (!name || typeof name !== 'string') {
      throw new ValidationError('name is required and must be a string');
    }
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new ValidationError('name cannot be empty');
    }
    if (trimmedName.length > 200) {
      throw new ValidationError('name must be 200 characters or less');
    }

    // Validate description
    if (description !== undefined && typeof description !== 'string') {
      throw new ValidationError('description must be a string');
    }
    const trimmedDescription = description?.trim();
    if (trimmedDescription && trimmedDescription.length > 1000) {
      throw new ValidationError('description must be 1000 characters or less');
    }

    // Validate propertyIds
    if (propertyIds !== undefined) {
      if (!Array.isArray(propertyIds)) {
        throw new ValidationError('propertyIds must be an array');
      }
      if (propertyIds.length > 1000) {
        throw new ValidationError('Cannot add more than 1000 properties to a route');
      }
      if (propertyIds.some(id => typeof id !== 'number' || isNaN(id) || id <= 0)) {
        throw new ValidationError('propertyIds must contain valid positive integers');
      }
    }

    // Verify properties exist
    if (propertyIds && propertyIds.length > 0) {
      const existingProperties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true },
      });

      const existingIds = existingProperties.map(p => p.id);
      const missingIds = propertyIds.filter((id: number) => !existingIds.includes(id));

      if (missingIds.length > 0) {
        throw new ValidationError(`Properties not found: ${missingIds.join(', ')}`);
      }
    }

    const route = await prisma.route.create({
      data: {
        name: trimmedName,
        description: trimmedDescription || null,
        properties: propertyIds && propertyIds.length > 0
          ? { connect: propertyIds.map((id: number) => ({ id })) }
          : undefined,
      },
      include: { properties: true },
    });

    res.status(201).json({ success: true, data: route });
  })
);

// POST /api/routes/mobile-plan - Create mobile route plan scaffold
routeRoutes.post(
  '/mobile-plan',
  asyncHandler(async (req, res) => {
    const { name, propertyIds } = req.body;

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('name is required and must be a non-empty string');
    }

    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      throw new ValidationError('propertyIds is required and must be a non-empty array');
    }

    if (propertyIds.length > 1000) {
      throw new ValidationError('Cannot add more than 1000 properties to a route');
    }

    if (propertyIds.some(id => !Number.isInteger(id) || id <= 0)) {
      throw new ValidationError('propertyIds must contain valid positive integers');
    }

    res.status(201).json({
      success: true,
      data: {
        routeId: 0,
        orderedPropertyIds: propertyIds,
        properties: [],
      },
    });
  })
);

// POST /api/routes/:id/properties - Add properties to route
routeRoutes.post(
  '/:id/properties',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { propertyIds } = req.body;

    // Validate route ID
    const routeId = parseInt(id);
    if (isNaN(routeId) || routeId <= 0) {
      throw new ValidationError('Invalid route ID: must be a positive integer');
    }

    // Validate propertyIds
    if (!Array.isArray(propertyIds)) {
      throw new ValidationError('propertyIds must be an array');
    }
    if (propertyIds.length === 0) {
      throw new ValidationError('propertyIds cannot be empty');
    }
    if (propertyIds.length > 1000) {
      throw new ValidationError('Cannot add more than 1000 properties to a route');
    }
    if (propertyIds.some(pid => typeof pid !== 'number' || isNaN(pid) || pid <= 0)) {
      throw new ValidationError('propertyIds must contain valid positive integers');
    }

    // Verify properties exist
    const existingProperties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true },
    });

    const existingIds = existingProperties.map(p => p.id);
    const missingIds = propertyIds.filter((pid: number) => !existingIds.includes(pid));

    if (missingIds.length > 0) {
      throw new ValidationError(`Properties not found: ${missingIds.join(', ')}`);
    }

    const route = await prisma.route.update({
      where: { id: routeId },
      data: {
        properties: {
          connect: propertyIds.map((pid: number) => ({ id: pid })),
        },
      },
      include: { properties: true },
    });

    res.json({ success: true, data: route });
  })
);

// DELETE /api/routes/:id - Delete route
routeRoutes.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const routeId = parseInt(req.params.id);

    if (isNaN(routeId) || routeId <= 0) {
      throw new ValidationError('Invalid route ID: must be a positive integer');
    }

    // Check if route exists before deleting
    const existingRoute = await prisma.route.findUnique({
      where: { id: routeId },
      select: { id: true },
    });

    if (!existingRoute) {
      throw new NotFoundError('Route', req.params.id);
    }

    await prisma.route.delete({
      where: { id: routeId },
    });

    res.json({ success: true, message: 'Route deleted' });
  })
);
