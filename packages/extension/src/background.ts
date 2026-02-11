// SCE2 Extension - Background Service Worker
// Manages scrape queue, polling, and extension state

// ==========================================
// IMPORTS
// ==========================================
import { configManager, getConfig } from './lib/storage.js';
import { PollingManager } from './lib/polling.js';
import {
  processRouteBatch,
  processRouteAddress,
  RouteAddress,
  RouteConfig,
  BatchProgress
} from './lib/route-processor.js';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

interface Config {
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

interface ScrapeJob {
  id: number;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  addressFull: string;
}

interface SubmitJob {
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

interface QueueState {
  items: any[];
  currentJob: any;
  isProcessing: boolean;
  processedCount: number;
}

interface ScrapeResponse {
  success: boolean;
  data?: { customerName: string; customerPhone: string };
  error?: string;
}

interface SubmitResponse {
  success: boolean;
  sceCaseId?: string;
  skippedFinalSubmit?: boolean;
  message?: string;
  error?: string;
}

// ==========================================
// QUEUE MANAGEMENT
// ==========================================
const SCRAPE_QUEUE: QueueState = {
  items: [],
  currentJob: null,
  isProcessing: false,
  processedCount: 0,
};

const SUBMIT_QUEUE: QueueState = {
  items: [],
  currentJob: null,
  isProcessing: false,
  processedCount: 0,
};

// ==========================================
// ROUTE PROCESSING STATE
// ==========================================

interface RouteBatchState {
  batchId: string | null;
  isProcessing: boolean;
  processedCount: number;
  totalCount: number;
  successfulCount: number;
  failedCount: number;
  results: any[];
  progressCallback: ((update: BatchProgress) => void) | null;
}

const ROUTE_STATE: RouteBatchState = {
  batchId: null,
  isProcessing: false,
  processedCount: 0,
  totalCount: 0,
  successfulCount: 0,
  failedCount: 0,
  results: [],
  progressCallback: null,
};

// ==========================================
// POLLING MANAGER
// ==========================================
const pollingManager = new PollingManager(poll);

function log(...args: any[]): void {
  getConfig().then(config => {
    if (config.debugMode) {
      console.log('[SCE2]', ...args);
    }
  });
}

// ==========================================
// QUEUE MANAGEMENT
// ==========================================
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

async function fetchScrapeJob(): Promise<ScrapeJob | null> {
  const config = await getConfig();

  try {
    log('Fetching scrape job from', `${config.apiBaseUrl}/api/queue/scrape-and-claim`);

    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}/api/queue/scrape-and-claim`,
      { method: 'GET' },
      config.timeout
    );

    if (!response.ok) {
      log(`Scrape job fetch failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.success && data.data) {
      log('Scrape job found:', data.data);
      return data.data;
    }

    log('No scrape jobs available');
    return null;
  } catch (error) {
    log('Failed to fetch scrape job:', error);
    return null;
  }
}

async function fetchSubmitJob(): Promise<SubmitJob | null> {
  const config = await getConfig();

  try {
    log('Fetching submit job from', `${config.apiBaseUrl}/api/queue/submit-and-claim`);

    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}/api/queue/submit-and-claim`,
      { method: 'GET' },
      config.timeout
    );

    if (!response.ok) {
      log(`Submit job fetch failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.success && data.data) {
      log('Submit job found:', data.data);
      return data.data;
    }

    log('No submit jobs available');
    return null;
  } catch (error) {
    log('Failed to fetch submit job:', error);
    return null;
  }
}

// ==========================================
// SCRAPE WORKFLOW
// ==========================================
async function processScrapeJob(job: ScrapeJob): Promise<void> {
  log('Processing scrape job:', job);

  SCRAPE_QUEUE.currentJob = job;

  try {
    // Open SCE form in new tab
    const tab = await chrome.tabs.create({
      url: 'https://sce.dsmcentral.com/onsite',
    });

    log(`Opened tab ${tab.id} for scrape job ${job.id}`);

    // Wait for tab to load
    await waitForTabLoad(tab.id!);
    log(`Tab ${tab.id} loaded`);

    // Small delay for Angular to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send scrape command to content script
    const response = await chrome.tabs.sendMessage(
      tab.id!,
      {
        action: 'SCRAPE_PROPERTY',
        data: {
          propertyId: job.id,
          streetNumber: job.streetNumber,
          streetName: job.streetName,
          zipCode: job.zipCode,
        },
      }
    ) as ScrapeResponse;

    if (chrome.runtime.lastError) {
      throw new Error(`Content script error: ${chrome.runtime.lastError.message}`);
    }

    const result = response;

    if (result.success && result.data) {
      // Send scraped data to cloud
      await saveScrapedData(job.id, result.data);
      SCRAPE_QUEUE.processedCount++;
    } else {
      throw new Error(result.error || 'Scrape failed');
    }

    // Close tab
    await closeTab(tab.id!);

    log(`Scrape job ${job.id} completed successfully`);
  } catch (error) {
    log(`Scrape job ${job.id} failed:`, error);
    await markJobFailed(job.id, 'SCRAPE', error instanceof Error ? error.message : 'Unknown error');
  } finally {
    SCRAPE_QUEUE.currentJob = null;
  }
}

async function saveScrapedData(propertyId: number, data: { customerName: string; customerPhone: string }) {
  const config = await getConfig();

  try {
    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}/api/queue/${propertyId}/scraped`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: data.customerName,
          customerPhone: data.customerPhone,
        }),
      },
      config.timeout
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    log('Scraped data saved:', propertyId);
  } catch (error) {
    log('Failed to save scraped data:', error);
    await markJobFailed(propertyId, 'SCRAPE', error instanceof Error ? error.message : 'Unknown error');
  }
}

// ==========================================
// SUBMIT WORKFLOW
// ==========================================
async function processSubmitJob(job: SubmitJob): Promise<void> {
  log('Processing submit job:', job);

  SUBMIT_QUEUE.currentJob = job;

  try {
    // Open SCE form in new tab
    const tab = await chrome.tabs.create({
      url: 'https://sce.dsmcentral.com/onsite',
    });

    log(`Opened tab ${tab.id} for submit job ${job.id}`);

    // Wait for tab to load
    await waitForTabLoad(tab.id!);
    log(`Tab ${tab.id} loaded`);

    // Small delay for Angular to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Prepare documents with URLs
    const config = await getConfig();
    const documents = job.documents.map(doc => ({
      url: `${config.apiBaseUrl}/uploads/${doc.fileName}`,
      name: doc.fileName,
      type: 'image/jpeg', // Determine from actual file type
    }));

    // Send submit command to content script
    const response = await chrome.tabs.sendMessage(
      tab.id!,
      {
        action: 'SUBMIT_APPLICATION',
        data: {
          ...job,
          documents,
        },
      }
    ) as SubmitResponse;

    if (chrome.runtime.lastError) {
      throw new Error(`Content script error: ${chrome.runtime.lastError.message}`);
    }

    const result = response;

    if (result.success && result.sceCaseId) {
      // Mark as complete
      await markJobComplete(job.id, result.sceCaseId);
      SUBMIT_QUEUE.processedCount++;
    } else if (result.success && result.skippedFinalSubmit) {
      log(
        `Submit job ${job.id} paused: ${result.message || 'Final submit disabled by configuration'}`
      );
      await closeTab(tab.id!);
      return;
    } else {
      throw new Error(result.error || 'Submit failed');
    }

    // Close tab
    await closeTab(tab.id!);

    log(`Submit job ${job.id} completed successfully. Case ID: ${result.sceCaseId}`);
  } catch (error) {
    log(`Submit job ${job.id} failed:`, error);
    await markJobFailed(job.id, 'SUBMIT', error instanceof Error ? error.message : 'Unknown error');
  } finally {
    SUBMIT_QUEUE.currentJob = null;
  }
}

async function markJobComplete(propertyId: number, sceCaseId: string) {
  const config = await getConfig();

  try {
    await fetchWithTimeout(
      `${config.apiBaseUrl}/api/queue/${propertyId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceCaseId }),
      },
      config.timeout
    );

    log('Job marked complete:', propertyId);
  } catch (error) {
    log('Failed to mark job complete:', error);
  }
}

async function markJobFailed(propertyId: number, type: string, reason: string) {
  log(`Job failed: ${propertyId} (${type}) - ${reason}`);
  const config = await getConfig();

  try {
    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}/api/queue/${propertyId}/fail`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, reason }),
      },
      config.timeout
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    log('Job marked failed:', propertyId);
  } catch (error) {
    log('Failed to mark job failed:', error);
  }
}

async function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let isResolved = false;

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve();
        }
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // Timeout after 30 seconds to prevent hanging
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      if (!isResolved) {
        isResolved = true;
        reject(new Error('Tab load timeout'));
      }
    }, 30000);
  });
}

async function closeTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch (error) {
    log('Failed to close tab:', error);
  }
}

// ==========================================
// POLLING LOOP
// ==========================================
async function poll(): Promise<void> {
  const config = await getConfig();

  if (!config.autoProcess) {
    log('Auto-processing disabled, skipping poll');
    return;
  }

  // Don't poll if already processing max concurrent jobs
  const activeJobs = (SCRAPE_QUEUE.isProcessing ? 1 : 0) + (SUBMIT_QUEUE.isProcessing ? 1 : 0);
  if (activeJobs >= config.maxConcurrent) {
    log('Max concurrent jobs reached, skipping poll');
    return;
  }

  // Process scrape queue
  if (!SCRAPE_QUEUE.isProcessing) {
    const job = await fetchScrapeJob();

    if (job) {
      SCRAPE_QUEUE.isProcessing = true;
      await processScrapeJob(job);
      SCRAPE_QUEUE.isProcessing = false;
    }
  }

  // Process submit queue
  if (!config.enableFinalSubmit) {
    log('Final submit automation disabled, skipping submit queue polling');
  } else if (!SUBMIT_QUEUE.isProcessing) {
    const job = await fetchSubmitJob();

    if (job) {
      SUBMIT_QUEUE.isProcessing = true;
      await processSubmitJob(job);
      SUBMIT_QUEUE.isProcessing = false;
    }
  }

  log('Poll complete. Processed:', {
    scrape: SCRAPE_QUEUE.processedCount,
    submit: SUBMIT_QUEUE.processedCount,
  });
}

// Start polling with adaptive interval
async function startPolling(): Promise<void> {
  const config = await getConfig();

  log(`Starting polling with ${config.pollInterval}ms interval`);
  pollingManager.start(config.pollInterval);
}

function stopPolling(): void {
  pollingManager.stop();
}

// Subscribe to config changes to update polling interval
configManager.subscribe((config) => {
  pollingManager.updateInterval(config.pollInterval);
});

// ==========================================
// ROUTE PROCESSING FUNCTIONS
// ==========================================

/**
 * Process a batch of route addresses
 * @param addresses - Array of address objects to process
 * @param config - Optional processing configuration
 * @returns Promise with batch results
 */
async function processRouteAddresses(
  addresses: RouteAddress[],
  config?: Partial<RouteConfig>
): Promise<{ batchId: string; results: any[] }> {
  if (ROUTE_STATE.isProcessing) {
    throw new Error('Route processing already in progress');
  }

  ROUTE_STATE.isProcessing = true;
  ROUTE_STATE.processedCount = 0;
  ROUTE_STATE.successfulCount = 0;
  ROUTE_STATE.failedCount = 0;
  ROUTE_STATE.results = [];

  // Progress callback for real-time updates
  const progressCallback = (update: BatchProgress) => {
    ROUTE_STATE.batchId = update.batchId;
    ROUTE_STATE.processedCount = update.current;
    ROUTE_STATE.totalCount = update.total;

    if (update.result) {
      ROUTE_STATE.results.push(update.result);
      if (update.result.success) {
        ROUTE_STATE.successfulCount++;
      } else {
        ROUTE_STATE.failedCount++;
      }
    }

    // Broadcast progress to popup/options
    broadcastRouteProgress(update);

    log('[Route] Progress:', update.message);
  };

  try {
    const result = await processRouteBatch(addresses, config, progressCallback);

    ROUTE_STATE.batchId = result.batchId;
    ROUTE_STATE.results = result.results;
    ROUTE_STATE.successfulCount = result.results.filter(r => r.success).length;
    ROUTE_STATE.failedCount = result.results.filter(r => !r.success).length;

    log('[Route] Batch complete:', {
      batchId: result.batchId,
      total: result.results.length,
      successful: ROUTE_STATE.successfulCount,
      failed: ROUTE_STATE.failedCount
    });

    // Save extracted data to cloud server
    await saveExtractedDataToCloud(result.results);

    return result;
  } catch (error) {
    log('[Route] Batch error:', error);
    throw error;
  } finally {
    ROUTE_STATE.isProcessing = false;
  }
}

/**
 * Process a single route address
 * @param address - Address object to process
 * @param config - Optional processing configuration
 * @returns Promise with processing result
 */
async function processSingleRouteAddress(
  address: RouteAddress,
  config?: Partial<RouteConfig>
): Promise<any> {
  log('[Route] Processing single address:', address.full);

  const result = await processRouteAddress(address, config);

  if (result.success) {
    log('[Route] ✓ Address processed successfully');
  } else {
    log('[Route] ✗ Address processing failed:', result.error);
  }

  return result;
}

/**
 * Get current route processing status
 */
function getRouteStatus(): RouteBatchState {
  return { ...ROUTE_STATE };
}

/**
 * Cancel current route processing
 */
function cancelRouteProcessing(): void {
  if (ROUTE_STATE.isProcessing) {
    log('[Route] Cancelling batch:', ROUTE_STATE.batchId);
    ROUTE_STATE.isProcessing = false;
    // Note: Active tabs will continue processing, but no new addresses will be started
    broadcastRouteProgress({
      type: 'error',
      batchId: ROUTE_STATE.batchId || '',
      current: ROUTE_STATE.processedCount,
      total: ROUTE_STATE.totalCount,
      percent: ROUTE_STATE.totalCount > 0
        ? Math.round((ROUTE_STATE.processedCount / ROUTE_STATE.totalCount) * 100)
        : 0,
      message: 'Processing cancelled'
    });
  }
}

/**
 * Broadcast route progress to all extension contexts
 */
function broadcastRouteProgress(update: BatchProgress): void {
  // Send to popup if open
  chrome.runtime.sendMessage({
    action: 'ROUTE_PROGRESS',
    data: update
  }).catch(() => {
    // Popup may not be open, ignore error
  });
}

/**
 * Save extracted customer data to cloud server
 * @param results - Array of route processing results
 */
async function saveExtractedDataToCloud(results: any[]): Promise<void> {
  const config = await getConfig();

  // Prepare batch update payload
  const updates = results
    .filter(r => r.success)
    .map(r => ({
      addressFull: r.address,
      customerName: r.customerName || null,
      customerPhone: r.customerPhone || null,
      dataExtracted: true,
      extractedAt: r.timestamp
    }));

  if (updates.length === 0) {
    log('[Route] No successful results to save');
    return;
  }

  try {
    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}/api/properties/batch-update`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      },
      config.timeout
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    log('[Route] ✓ Saved to cloud:', data.data?.successful || 0, 'properties');
  } catch (error) {
    log('[Route] Failed to save to cloud:', error);
  }
}

// Auto-start if configured
getConfig().then(config => {
  if (config.autoStart) {
    startPolling();
  }
});

// ==========================================
// MESSAGE HANDLING
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Background received message:', message);

  switch (message.action) {
    case 'GET_CONFIG':
      getConfig().then(sendResponse);
      return true;

    case 'GET_STATUS':
      sendResponse({
        scrapeCount: SCRAPE_QUEUE.processedCount,
        submitCount: SUBMIT_QUEUE.processedCount,
        isProcessing: SCRAPE_QUEUE.isProcessing || SUBMIT_QUEUE.isProcessing,
      });
      break;

    case 'START_PROCESSING':
      getConfig().then(config => {
        chrome.storage.sync.set({ autoProcess: true });
        startPolling();
        sendResponse({ success: true });
      });
      return true;

    case 'STOP_PROCESSING':
      chrome.storage.sync.set({ autoProcess: false });
      stopPolling();
      sendResponse({ success: true });
      break;

    case 'POLL_NOW':
      poll().then(() => sendResponse({ success: true }));
      return true;

    // ==========================================
    // ROUTE PROCESSING ACTIONS
    // ==========================================
    case 'PROCESS_ROUTE_BATCH':
      processRouteAddresses(message.addresses, message.config)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      return true;

    case 'PROCESS_SINGLE_ROUTE':
      processSingleRouteAddress(message.address, message.config)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      return true;

    case 'GET_ROUTE_STATUS':
      sendResponse({ success: true, data: getRouteStatus() });
      break;

    case 'CANCEL_ROUTE_PROCESSING':
      cancelRouteProcessing();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return false;
});

// Log installation
chrome.runtime.onInstalled.addListener(() => {
  log('SCE2 Extension installed');
});
