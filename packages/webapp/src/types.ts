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

export interface AddressInput {
  addressFull: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Property {
  id: number;
  createdAt: Date;
  updatedAt: Date;

  // Address fields (from Overpass/SCE website)
  addressFull: string;
  streetNumber: string | null;
  streetName: string | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;

  // Scraped data (from extension - Phase 1)
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;

  // Route extraction metadata (from route processing)
  dataExtracted?: boolean;
  extractedAt?: Date | null;
  screenshotUrl?: string | null;

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

// Client-side property type (for creating new properties before server save)
export interface PropertyInput {
  id?: number | string;
  createdAt?: Date;
  updatedAt?: Date;

  // Address fields (from Overpass/SCE website)
  addressFull: string;
  streetNumber?: string | null;
  streetName?: string | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  // Scraped data (from extension - Phase 1)
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;

  // Route extraction metadata (from route processing)
  dataExtracted?: boolean;
  extractedAt?: Date | null;
  screenshotUrl?: string | null;

  // Field data (from mobile - Phase 2)
  customerAge?: number | null;
  fieldNotes?: string | null;

  // Submission tracking
  sceCaseId?: string | null;

  // Status workflow
  status?: PropertyStatus;

  // Relations
  documents?: Document[];
  route?: Route;
  routeId?: number | null;
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
  orderedPropertyIdsJson?: string | null;
  properties?: Property[];
}

export interface MobileRoutePlanRequest {
  name: string;
  propertyIds: number[];
  description?: string;
  startLat?: number;
  startLon?: number;
}

export interface MobileRoutePlanResponse {
  routeId: number;
  orderedPropertyIds: number[];
  orderedPropertyIdsJson: string | null;
  properties: Property[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface QueueStatus {
  pendingScrape: number;
  readyForField: number;
  visited: number;
  readyForSubmission: number;
  complete: number;
  failed: number;
}

export interface ExtractionSession {
  id: number;
  createdAt: string;
  updatedAt: string;
  label: string;
  expiresAt: string;
  isActive: boolean;
}

export interface ExtractionRunItem {
  id: number;
  propertyId: number;
  status: string;
  error: string | null;
}

export interface ExtractionRun {
  id: number;
  createdAt?: string;
  updatedAt?: string;
  status: string;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  sessionId: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorSummary?: string | null;
  items?: ExtractionRunItem[];
}

export interface PropertyFilters {
  status?: PropertyStatus;
  city?: string;
  state?: string;
  search?: string;
  hasRoute?: boolean;
  limit?: number;
  offset?: number;
}
