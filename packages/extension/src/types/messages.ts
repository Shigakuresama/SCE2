// packages/extension/src/types/messages.ts

/**
 * Message Type Definitions for Extension Communication
 *
 * This file defines all message types used for communication between:
 * - Background script ↔ Content script
 * - Popup/Options ↔ Background
 * - Webapp ↔ Extension (via external messaging)
 */

// ==========================================
// PROPERTY TYPES
// ==========================================

/**
 * Property type matching Prisma schema
 */
export interface Property {
  id: number;
  addressFull: string;
  streetNumber?: string;
  streetName?: string;
  zipCode: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  dataExtracted: boolean;
  status: 'PENDING_SCRAPE' | 'READY_FOR_FIELD' | 'VISITED' | 'READY_FOR_SUBMISSION' | 'COMPLETE' | 'FAILED';
  routeId?: number;
}

/**
 * Zillow property data
 */
export interface ZillowData {
  sqFt?: number;
  yearBuilt?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  zestimate?: number;
}

// ==========================================
// QUEUE TYPES
// ==========================================

/**
 * Scrape job from queue
 */
export interface ScrapeJob {
  id: number;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  addressFull: string;
}

/**
 * Submit job from queue
 */
export interface SubmitJob {
  id: number;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  addressFull: string;
  customerName?: string;
  customerPhone?: string;
  customerAge?: number;
  fieldNotes?: string;
  documents: Array<{
    id: number;
    fileName: string;
    filePath: string;
    url: string;
    docType: string;
  }>;
}

/**
 * Queue state tracking
 */
export interface QueueState {
  items: unknown[];
  currentJob: unknown;
  isProcessing: boolean;
  processedCount: number;
}

// ==========================================
// MESSAGE ACTION TYPES
// ==========================================

/**
 * All possible message actions
 */
export type MessageAction =
  // Configuration
  | 'GET_CONFIG'
  | 'GET_STATUS'
  // Queue control
  | 'START_PROCESSING'
  | 'STOP_PROCESSING'
  | 'POLL_NOW'
  // SCE session
  | 'CHECK_SCE_SESSION_READY'
  // Scrape workflow
  | 'SCRAPE_PROPERTY'
  | 'SUBMIT_APPLICATION'
  // Route processing
  | 'PROCESS_ROUTE_BATCH'
  | 'PROCESS_SINGLE_ROUTE'
  | 'GET_ROUTE_STATUS'
  | 'CANCEL_ROUTE_PROCESSING'
  | 'fillRouteAddress'
  | 'captureRouteData'
  // Form filling
  | 'FILL_ALL_SECTIONS'
  | 'FILL_CURRENT_SECTION'
  | 'STOP_FILLING'
  | 'SHOW_BANNER'
  | 'GET_CURRENT_SECTION'
  // Session check
  | 'CHECK_CUSTOMER_SEARCH_READY';

// ==========================================
// BASE MESSAGE INTERFACE
// ==========================================

/**
 * Base message interface
 */
export interface BaseMessage {
  action: MessageAction;
}

// ==========================================
// SPECIFIC MESSAGE TYPES
// ==========================================

/**
 * Scrape property message
 */
export interface ScrapePropertyMessage extends BaseMessage {
  action: 'SCRAPE_PROPERTY';
  data: {
    propertyId?: number;
    streetNumber: string;
    streetName: string;
    zipCode: string;
  };
}

/**
 * Submit application message
 */
export interface SubmitApplicationMessage extends BaseMessage {
  action: 'SUBMIT_APPLICATION';
  data: SubmitJob & {
    documents: Array<{
      url: string;
      name: string;
      type: string;
    }>;
  };
}

/**
 * Fill all sections message
 */
export interface FillAllSectionsMessage extends BaseMessage {
  action: 'FILL_ALL_SECTIONS';
  property?: Property;
  zillowData?: ZillowData;
}

/**
 * Fill current section message
 */
export interface FillCurrentSectionMessage extends BaseMessage {
  action: 'FILL_CURRENT_SECTION';
  property?: Property;
  zillowData?: ZillowData;
}

/**
 * Process route batch message
 */
export interface ProcessRouteBatchMessage extends BaseMessage {
  action: 'PROCESS_ROUTE_BATCH';
  addresses: Array<{
    number: string;
    street: string;
    city?: string;
    state: string;
    zip: string;
    full: string;
  }>;
  config?: {
    sceFormUrl?: string;
    tabOpenDelay?: number;
    captureDelay?: number;
    screenshotDelay?: number;
    maxConcurrentTabs?: number;
    maxBatchSize?: number;
    retryAttempts?: number;
    retryDelay?: number;
  };
}

/**
 * Fill route address message
 */
export interface FillRouteAddressMessage extends BaseMessage {
  action: 'fillRouteAddress';
  address: {
    streetNumber: string;
    streetName: string;
    zipCode: string;
  };
}

/**
 * Capture route data message
 */
export interface CaptureRouteDataMessage extends BaseMessage {
  action: 'captureRouteData';
}

/**
 * Process single route message
 */
export interface ProcessSingleRouteMessage extends BaseMessage {
  action: 'PROCESS_SINGLE_ROUTE';
  address: RouteAddress;
  config?: Partial<RouteConfig>;
}

/**
 * Route address type (re-exported from route-processor-types for convenience)
 */
export interface RouteAddress {
  number: string;
  street: string;
  city?: string;
  state: string;
  zip: string;
  full: string;
}

/**
 * Route config type (re-exported for convenience)
 */
export interface RouteConfig {
  sceFormUrl: string;
  tabOpenDelay: number;
  captureDelay: number;
  screenshotDelay: number;
  maxConcurrentTabs: number;
  maxBatchSize: number;
  retryAttempts: number;
  retryDelay: number;
}

// ==========================================
// RESPONSE TYPES
// ==========================================

/**
 * Generic success response
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Generic error response
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
  stopped?: boolean;
}

/**
 * Union type for all responses
 */
export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Scrape result from content script
 */
export interface ScrapeResult {
  success: boolean;
  data?: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    // Extended section data (optional)
    additionalInfo?: Record<string, unknown>;
    projectInfo?: Record<string, unknown>;
    tradeAllyInfo?: Record<string, unknown>;
    assessmentInfo?: Record<string, unknown>;
    householdInfo?: Record<string, unknown>;
    enrollmentInfo?: Record<string, unknown>;
    equipmentInfo?: Record<string, unknown>;
    basicEnrollmentInfo?: Record<string, unknown>;
    bonusInfo?: Record<string, unknown>;
    termsInfo?: Record<string, unknown>;
    commentsInfo?: Record<string, unknown>;
    statusInfo?: Record<string, unknown>;
  };
  error?: string;
}

/**
 * Submit result from content script
 */
export interface SubmitResult {
  success: boolean;
  sceCaseId?: string;
  skippedFinalSubmit?: boolean;
  message?: string;
  error?: string;
}

/**
 * Customer search readiness check result
 */
export interface CustomerSearchReadyResponse {
  success: boolean;
  data?: {
    ready: boolean;
    currentUrl: string;
    reason?: string;
  };
  error?: string;
}

/**
 * Route processing result
 */
export interface RouteProcessResult {
  success: boolean;
  address: string;
  customerName?: string;
  customerPhone?: string;
  screenshot?: string;
  timestamp: string;
  error?: string;
}

/**
 * Batch progress update
 */
export interface BatchProgress {
  type: 'start' | 'progress' | 'complete' | 'error';
  batchId: string;
  current: number;
  total: number;
  percent: number;
  message: string;
  result?: RouteProcessResult;
}

// ==========================================
// CONFIG TYPES
// ==========================================

/**
 * Extension configuration
 */
export interface Config {
  apiBaseUrl: string;
  autoProcess: boolean;
  autoStart: boolean;
  pollInterval: number;
  timeout: number;
  maxConcurrent: number;
  debugMode: boolean;
  submitVisibleSectionOnly: boolean;
  enableDocumentUpload: boolean;
  enableFinalSubmit: boolean;
}

// ==========================================
// UNION TYPES
// ==========================================

/**
 * Union of all message types
 */
export type Message =
  | BaseMessage
  | ScrapePropertyMessage
  | SubmitApplicationMessage
  | FillAllSectionsMessage
  | FillCurrentSectionMessage
  | ProcessRouteBatchMessage
  | ProcessSingleRouteMessage
  | FillRouteAddressMessage
  | CaptureRouteDataMessage;

// ==========================================
// UTILITY TYPES
// ==========================================

/**
 * Extract data type from message type
 */
export type MessageData<T extends MessageAction> = Extract<Message, { action: T }> extends { data: infer D }
  ? D
  : never;

/**
 * Extract response type from message type
 */
export type MessageResponse<T extends MessageAction> = T extends 'SCRAPE_PROPERTY'
  ? ScrapeResult
  : T extends 'SUBMIT_APPLICATION'
  ? SubmitResult
  : T extends 'CHECK_CUSTOMER_SEARCH_READY'
  ? CustomerSearchReadyResponse
  : T extends 'PROCESS_ROUTE_BATCH'
  ? SuccessResponse<{ batchId: string; results: RouteProcessResult[] }>
  : Response;
