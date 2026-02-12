// packages/cloud-server/src/types/api.ts
import { Property } from '@prisma/client';

// Standard API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
}

// Paginated response
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Specific response types
export interface PropertyResponse extends ApiResponse<Property> {}
export interface PropertiesResponse extends PaginatedResponse<Property> {}
export interface HealthResponse extends ApiResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptime: number;
}

// Request types
export interface CreatePropertyRequest {
  address: string;
  addressFull: string;
  zipCode: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  status?: Property['status'];
  routeId?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  sqFt?: number;
  yearBuilt?: number;
}

export interface UpdatePropertyRequest extends Partial<CreatePropertyRequest> {
  dataExtracted?: boolean;
  notes?: string;
}
