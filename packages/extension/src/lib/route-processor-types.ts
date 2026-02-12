// packages/extension/src/lib/route-processor-types.ts

/**
 * Route Processor Type Definitions
 *
 * Types for the SCE route processing workflow:
 * 1. Select addresses on map
 * 2. Extract customer data from SCE website
 * 3. Generate PDF with real customer data
 */

/**
 * Address format for route processing
 */
export interface RouteAddress {
  number: string;        // Street number: "1909"
  street: string;         // Street name: "W Martha Ln"
  city?: string;          // City: "Santa Ana"
  state: string;          // State: "CA"
  zip: string;           // ZIP: "92706"
  full: string;          // Full: "1909 W Martha Ln, Santa Ana, CA 92706"
}

/**
 * Result of processing a single address through SCE
 */
export interface RouteProcessResult {
  success: boolean;
  address: string;
  customerName?: string;
  customerPhone?: string;
  screenshot?: string;    // base64 data URL
  timestamp: string;
  error?: string;
}

/**
 * Configuration for route processing
 */
export interface RouteConfig {
  sceFormUrl: string;
  tabOpenDelay: number;    // Delay after opening tab (ms)
  captureDelay: number;   // Delay before capturing data (ms)
  screenshotDelay: number; // Delay before screenshot (ms)
  maxConcurrentTabs: number; // Number of tabs to process at once
  maxBatchSize: number;     // Maximum addresses in a batch
  retryAttempts: number;    // Number of retry attempts
  retryDelay: number;       // Delay between retries (ms)
}

/**
 * Progress update during batch processing
 */
export interface BatchProgress {
  type: 'start' | 'progress' | 'complete' | 'error';
  batchId: string;
  current: number;         // Current processed count
  total: number;           // Total addresses to process
  percent: number;         // Progress percentage
  message: string;         // Human-readable status message
  result?: RouteProcessResult;  // Individual address result
}

/**
 * Default configuration values
 */
export const DEFAULT_ROUTE_CONFIG: RouteConfig = {
  // Use customer-search directly so the logged-in browser session lands on the right page.
  sceFormUrl: 'https://sce.dsmcentral.com/onsite/customer-search',
  tabOpenDelay: 2000,      // 2 seconds
  captureDelay: 5000,     // 5 seconds (wait for page load + search + income)
  screenshotDelay: 1000,  // 1 second
  maxConcurrentTabs: 3,    // Process 3 tabs concurrently
  maxBatchSize: 50,        // Maximum 50 addresses per batch
  retryAttempts: 2,        // Retry failed addresses twice
  retryDelay: 3000,        // 3 seconds between retries
};
