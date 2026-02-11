import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { orderPropertiesByNearestNeighbor } from '../lib/route-planner.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

export const routeRoutes = Router();

function validateRouteName(name: unknown): string {
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

  return trimmedName;
}

function validateDescription(description: unknown): string | null {
  if (description === undefined || description === null) {
    return null;
  }

  if (typeof description !== 'string') {
    throw new ValidationError('description must be a string');
  }

  const trimmedDescription = description.trim();
  if (trimmedDescription.length > 1000) {
    throw new ValidationError('description must be 1000 characters or less');
  }

  return trimmedDescription.length > 0 ? trimmedDescription : null;
}

function validatePropertyIds(
  propertyIds: unknown,
  options: { required: boolean; allowEmpty: boolean }
): number[] {
  const { required, allowEmpty } = options;

  if (propertyIds === undefined || propertyIds === null) {
    if (required) {
      throw new ValidationError('propertyIds is required and must be a non-empty array');
    }
    return [];
  }

  if (!Array.isArray(propertyIds)) {
    throw new ValidationError(
      required
        ? 'propertyIds is required and must be a non-empty array'
        : 'propertyIds must be an array'
    );
  }

  if (!allowEmpty && propertyIds.length === 0) {
    throw new ValidationError('propertyIds is required and must be a non-empty array');
  }

  if (propertyIds.length > 1000) {
    throw new ValidationError('Cannot add more than 1000 properties to a route');
  }

  if (propertyIds.some(id => typeof id !== 'number' || !Number.isInteger(id) || id <= 0)) {
    throw new ValidationError('propertyIds must contain valid positive integers');
  }

  const normalizedIds = propertyIds as number[];
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw new ValidationError('propertyIds must not contain duplicate values');
  }

  return normalizedIds;
}

async function verifyPropertiesExist(propertyIds: number[]): Promise<void> {
  if (propertyIds.length === 0) {
    return;
  }

  const existingProperties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true },
  });

  const existingIds = new Set(existingProperties.map((property) => property.id));
  const missingIds = propertyIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    throw new ValidationError(`Properties not found: ${missingIds.join(', ')}`);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateStartCoordinate(
  startLat: unknown,
  startLon: unknown
): { latitude: number; longitude: number } | null {
  const hasStartLat = startLat !== undefined && startLat !== null;
  const hasStartLon = startLon !== undefined && startLon !== null;

  if (!hasStartLat && !hasStartLon) {
    return null;
  }

  if (!isFiniteNumber(startLat) || !isFiniteNumber(startLon)) {
    throw new ValidationError('startLat and startLon must both be finite numbers when provided');
  }

  return {
    latitude: startLat,
    longitude: startLon,
  };
}

function hasValidPropertyCoordinate(property: {
  latitude: number | null;
  longitude: number | null;
}): property is {
  latitude: number;
  longitude: number;
} {
  return isFiniteNumber(property.latitude) && isFiniteNumber(property.longitude);
}

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
    const trimmedName = validateRouteName(name);
    const normalizedDescription = validateDescription(description);
    const normalizedPropertyIds = validatePropertyIds(propertyIds, {
      required: false,
      allowEmpty: true,
    });
    await verifyPropertiesExist(normalizedPropertyIds);

    const route = await prisma.route.create({
      data: {
        name: trimmedName,
        description: normalizedDescription,
        properties: normalizedPropertyIds.length > 0
          ? { connect: normalizedPropertyIds.map((id: number) => ({ id })) }
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
    const { name, propertyIds, description, startLat, startLon } = req.body;
    const trimmedName = validateRouteName(name);
    const normalizedDescription = validateDescription(description);
    const normalizedPropertyIds = validatePropertyIds(propertyIds, {
      required: true,
      allowEmpty: false,
    });
    await verifyPropertiesExist(normalizedPropertyIds);

    const requestedStartCoordinate = validateStartCoordinate(startLat, startLon);
    const propertiesForPlanning = await prisma.property.findMany({
      where: { id: { in: normalizedPropertyIds } },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    const propertiesById = new Map(propertiesForPlanning.map((property) => [property.id, property]));
    const propertiesInInputOrder = normalizedPropertyIds
      .map((id) => propertiesById.get(id))
      .filter(
        (property): property is (typeof propertiesForPlanning)[number] => property !== undefined
      );

    if (propertiesInInputOrder.length !== normalizedPropertyIds.length) {
      throw new ValidationError('Failed to load all properties for route optimization');
    }

    const fallbackStartProperty = propertiesInInputOrder.find(hasValidPropertyCoordinate);
    const startCoordinate = requestedStartCoordinate
      ?? (fallbackStartProperty
        ? { latitude: fallbackStartProperty.latitude, longitude: fallbackStartProperty.longitude }
        : null);

    const orderedPropertyIds = startCoordinate
      ? orderPropertiesByNearestNeighbor(propertiesInInputOrder, startCoordinate).map(
        (property) => property.id
      )
      : [...normalizedPropertyIds];

    const orderedPropertyIdsJson = JSON.stringify(orderedPropertyIds);
    const route = await prisma.route.create({
      data: {
        name: trimmedName,
        description: normalizedDescription,
        orderedPropertyIdsJson,
        properties: {
          connect: normalizedPropertyIds.map((id: number) => ({ id })),
        },
      },
      include: {
        properties: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        routeId: route.id,
        orderedPropertyIds,
        orderedPropertyIdsJson: route.orderedPropertyIdsJson,
        properties: route.properties,
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

    const normalizedPropertyIds = validatePropertyIds(propertyIds, {
      required: true,
      allowEmpty: false,
    });
    await verifyPropertiesExist(normalizedPropertyIds);

    const route = await prisma.route.update({
      where: { id: routeId },
      data: {
        properties: {
          connect: normalizedPropertyIds.map((pid: number) => ({ id: pid })),
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
