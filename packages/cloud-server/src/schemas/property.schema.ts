// packages/cloud-server/src/schemas/property.schema.ts
import { z } from 'zod';
import { PropertyStatusSchema } from '../lib/validation.js';

// Base address schema for property creation
export const CreatePropertySchema = z.object({
  addressFull: z.string().min(1, 'Full address is required'),
  streetNumber: z.string().min(1, 'Street number is required'),
  streetName: z.string().min(1, 'Street name is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  city: z.string().optional(),
  state: z.string().length(2, 'State must be 2-letter code').optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  routeId: z.number().int().positive().optional().nullable(),
  customerEmail: z.union([
    z.string().email('Invalid email format'),
    z.literal('')
  ]).optional(),
});

// Schema for batch address import
export const BatchAddressSchema = z.object({
  addressFull: z.string().min(1, 'Full address is required'),
  streetNumber: z.string().min(1, 'Street number is required'),
  streetName: z.string().min(1, 'Street name is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  city: z.string().optional(),
  state: z.string().length(2, 'State must be 2-letter code').optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  routeId: z.number().int().positive().optional().nullable(),
});

// Schema for batch create request
export const BatchCreatePropertySchema = z.object({
  addresses: z.array(BatchAddressSchema).min(1, 'At least one address is required').max(100, 'Maximum 100 addresses per batch'),
});

// Schema for updating property (PATCH - partial updates allowed)
export const PatchPropertySchema = z.object({
  addressFull: z.string().min(1).optional(),
  streetNumber: z.string().min(1).optional(),
  streetName: z.string().min(1).optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  routeId: z.number().int().positive().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.union([
    z.string().email('Invalid email format'),
    z.literal('')
  ]).optional(),
  customerAge: z.number().int().min(0).max(150).optional().nullable(),
  fieldNotes: z.string().optional(),
  dataExtracted: z.boolean().optional(),
  status: PropertyStatusSchema.optional(),
  sceCaseId: z.string().optional(),
});

// Schema for query parameters on list endpoint
export const PropertyQuerySchema = z.object({
  status: PropertyStatusSchema.optional(),
  routeId: z.string().regex(/^\d+$/, 'Route ID must be a number').optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').default('50'),
  offset: z.string().regex(/^\d+$/, 'Offset must be a number').default('0'),
});

// Schema for DELETE /all endpoint query parameters
export const DeleteAllQuerySchema = z.object({
  status: PropertyStatusSchema.optional(),
});
