// ============= Type Definitions =============
// Matches Prisma schema from cloud-server

export enum PropertyStatus {
  PENDING_SCRAPE = 'PENDING_SCRAPE',
  READY_FOR_FIELD = 'READY_FOR_FIELD',
  VISITED = 'VISITED',
  READY_FOR_SUBMISSION = 'READY_FOR_SUBMISSION',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

export interface Property {
  id: number;
  createdAt: Date;
  updatedAt: Date;

  // Address fields (from Overpass/SCE website)
  addressFull: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;

  // Scraped data (from extension - Phase 1)
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;

  // Field data (from mobile - Phase 2)
  customerAge: number | null;
  fieldNotes: string | null;

  // Submission tracking
  sceCaseId: string | null;

  // Status workflow
  status: PropertyStatus;

  // Relations
  documents?: Document[];
  route?: Route;
  routeId: number | null;
}

export interface Document {
  id: number;
  createdAt: Date;
  propertyId: number;
  docType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface Route {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  properties?: Property[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface QueueStatus {
  scrapeQueue: number;
  submitQueue: number;
  processing: boolean;
}

export interface PropertyFilters {
  status?: PropertyStatus;
  city?: string;
  state?: string;
  search?: string;
  hasRoute?: boolean;
}
