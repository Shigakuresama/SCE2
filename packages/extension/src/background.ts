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
import {
  tryAcquireLock,
  releaseLock,
  isProcessing as checkIsProcessing,
  getCurrentBatchId,
} from './lib/route-state.js';
import type {
  ScrapeJob,
  SubmitJob,
  QueueState,
  ScrapeResult,
  SubmitResult,
  CustomerSearchReadyResponse,
  RouteProcessResult,
  Message,
} from './types/messages.js';

// ==========================================
// GLOBAL ERROR HANDLERS
// ==========================================
// Global error handlers for debugging
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Background] Unhandled promise rejection:', event.reason);
  // Could send to error tracking service here
});

self.addEventListener('error', (event) => {
  console.error('[Background] Uncaught error:', event.error);
});

// ==========================================
// TYPE DEFINITIONS (Imported from types/messages.ts)
// ==========================================
// All types imported from ./types/messages.js at top of file

const SCE_CUSTOMER_SEARCH_URL = 'https://sce.dsmcentral.com/onsite/customer-search';

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
// POLLING MANAGER
// ==========================================
const pollingManager = new PollingManager(poll);

function log(...args: unknown[]): void {
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
    const tab = await openSceCustomerSearchTab();

    log(`Opened tab ${tab.id} for scrape job ${job.id}`);

    // Send scrape command to content script (with retries while script initializes)
    const result = await sendTabMessageWithRetry<ScrapeResult>(
      tab.id!,
      {
        action: 'SCRAPE_PROPERTY',
        data: {
          propertyId: job.id,
          streetNumber: job.streetNumber,
          streetName: job.streetName,
          zipCode: job.zipCode,
        },
      },
      4
    );

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
    const tab = await openSceCustomerSearchTab();

    log(`Opened tab ${tab.id} for submit job ${job.id}`);

    // Prepare documents with URLs
    const config = await getConfig();
    const documents = job.documents.map(doc => ({
      url: `${config.apiBaseUrl}/uploads/${doc.fileName}`,
      name: doc.fileName,
      type: 'image/jpeg', // Determine from actual file type
    }));

    // Send submit command to content script
    const result = await sendTabMessageWithRetry<SubmitResult>(
      tab.id!,
      {
        action: 'SUBMIT_APPLICATION',
        data: {
          ...job,
          documents,
        },
      },
      4
    );

    if (result.success && result.sceCaseId) {
      // Mark as complete
      await markJobComplete(job.id, result.sceCaseId);
      SUBMIT_QUEUE.processedCount++;
    } else if (result.success && result.skippedFinalSubmit) {
      await releaseSubmitJob(
        job.id,
        result.message || 'Final submit disabled by configuration'
      );
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

async function releaseSubmitJob(propertyId: number, reason: string) {
  const config = await getConfig();

  try {
    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}/api/queue/${propertyId}/requeue-submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      },
      config.timeout
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    log('Submit job requeued to VISITED:', propertyId);
    return;
  } catch (error) {
    log('Requeue endpoint failed, using fallback PATCH:', error);
  }

  try {
    const fallbackResponse = await fetchWithTimeout(
      `${config.apiBaseUrl}/api/properties/${propertyId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VISITED' }),
      },
      config.timeout
    );

    if (!fallbackResponse.ok) {
      throw new Error(`HTTP ${fallbackResponse.status}`);
    }

    log('Submit job restored to VISITED via fallback:', propertyId);
  } catch (fallbackError) {
    log('Failed to restore submit job status:', fallbackError);
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

function isRetryableContentScriptError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('receiving end does not exist') ||
    normalized.includes('could not establish connection')
  );
}

async function sendTabMessageWithRetry<T>(
  tabId: number,
  message: Record<string, unknown>,
  attempts = 4
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await new Promise<T>((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response as T);
        });
      });
    } catch (error) {
      const asError =
        error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
      lastError = asError;

      if (attempt >= attempts || !isRetryableContentScriptError(asError.message)) {
        throw asError;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError ?? new Error('Failed to send message to tab');
}

async function openSceCustomerSearchTab(): Promise<chrome.tabs.Tab> {
  const tab = await chrome.tabs.create({
    url: SCE_CUSTOMER_SEARCH_URL,
  });

  if (!tab.id) {
    throw new Error('Failed to open SCE customer-search tab');
  }

  await waitForTabLoad(tab.id);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  let loadedTab = await chrome.tabs.get(tab.id);
  let currentUrl = (loadedTab.url ?? '').toLowerCase();

  // Some SCE sessions land on /onsite first; retry customer-search once.
  if (!currentUrl.includes('/onsite/customer-search')) {
    await chrome.tabs.update(tab.id, { url: SCE_CUSTOMER_SEARCH_URL });
    await waitForTabLoad(tab.id);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    loadedTab = await chrome.tabs.get(tab.id);
    currentUrl = (loadedTab.url ?? '').toLowerCase();
  }

  if (!currentUrl.includes('/onsite/customer-search')) {
    throw new Error(
      'SCE customer-search is not accessible in this browser session. Open customer-search manually and log in, then retry.'
    );
  }

  return loadedTab;
}

async function checkSceSessionReadiness(): Promise<{
  ready: boolean;
  currentUrl: string;
  reason?: string;
}> {
  let tabId: number | null = null;
  let currentUrl = SCE_CUSTOMER_SEARCH_URL;

  try {
    const tab = await chrome.tabs.create({
      url: SCE_CUSTOMER_SEARCH_URL,
      active: false,
    });

    if (!tab.id) {
      throw new Error('Failed to open SCE customer-search tab for session check.');
    }

    tabId = tab.id;
    await waitForTabLoad(tabId);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const loadedTab = await chrome.tabs.get(tabId);
    currentUrl = loadedTab.url ?? currentUrl;

    const response = await sendTabMessageWithRetry<CustomerSearchReadyResponse>(
      tabId,
      { action: 'CHECK_CUSTOMER_SEARCH_READY' },
      4
    );

    if (!response.success || !response.data) {
      return {
        ready: false,
        currentUrl,
        reason: response.error || 'Session check did not return a valid readiness payload.',
      };
    }

    return response.data;
  } catch (error) {
    return {
      ready: false,
      currentUrl,
      reason: error instanceof Error ? error.message : 'Unknown session check error.',
    };
  } finally {
    if (tabId !== null) {
      await closeTab(tabId);
    }
  }
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
  try {
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
  } catch (error) {
    console.error('[Background] Error during polling:', error);
  }
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
): Promise<{ batchId: string; results: RouteProcessResult[] }> {
  // Progress callback for real-time updates
  const progressCallback = (update: BatchProgress) => {
    // Broadcast progress to popup/options
    broadcastRouteProgress(update);
    log('[Route] Progress:', update.message);
  };

  try {
    const result = await processRouteBatch(addresses, config, progressCallback);

    log('[Route] Batch complete:', {
      batchId: result.batchId,
      total: result.results.length,
      successful: result.results.filter(r => r.success).length,
      failed: result.results.filter(r => !r.success).length
    });

    // Save extracted data to cloud server
    await saveExtractedDataToCloud(result.results);

    return result;
  } catch (error) {
    log('[Route] Batch error:', error);
    throw error;
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
): Promise<RouteProcessResult> {
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
async function getRouteStatus(): Promise<{ isProcessing: boolean; batchId: string | null }> {
  const processing = await checkIsProcessing();
  const batchId = await getCurrentBatchId();
  return { isProcessing: processing, batchId };
}

/**
 * Cancel current route processing
 */
async function cancelRouteProcessing(): Promise<void> {
  const processing = await checkIsProcessing();
  const batchId = await getCurrentBatchId();

  if (processing) {
    log('[Route] Cancelling batch:', batchId);
    await releaseLock();
    // Note: Active tabs will continue processing, but no new addresses will be started
    broadcastRouteProgress({
      type: 'error',
      batchId: batchId || '',
      current: 0,
      total: 0,
      percent: 0,
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
async function saveExtractedDataToCloud(results: RouteProcessResult[]): Promise<void> {
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
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
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
      getConfig().then(_config => {
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

    case 'CHECK_SCE_SESSION_READY':
      checkSceSessionReadiness()
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown session check error',
          })
        );
      return true;

    // ==========================================
    // ROUTE PROCESSING ACTIONS
    // ==========================================
    case 'PROCESS_ROUTE_BATCH': {
      const { addresses, config } = message as Extract<Message, { action: 'PROCESS_ROUTE_BATCH' }>;

      // Generate batch ID first
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Atomic lock acquisition
      tryAcquireLock(batchId).then(async (acquired) => {
        if (!acquired) {
          const currentBatch = await getCurrentBatchId();
          sendResponse({
            success: false,
            error: 'Route processing already in progress',
            currentBatchId: currentBatch,
          });
          return;
        }

        try {
          const result = await processRouteAddresses(addresses, config);
          sendResponse({ success: true, data: result });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        } finally {
          await releaseLock();
        }
      });
      return true;
    }

    case 'PROCESS_SINGLE_ROUTE': {
      const msg = message as Extract<Message, { action: 'PROCESS_SINGLE_ROUTE' }>;
      processSingleRouteAddress(msg.address, msg.config)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      return true;
    }

    case 'GET_ROUTE_STATUS':
      getRouteStatus()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      return true;

    case 'CANCEL_ROUTE_PROCESSING':
      cancelRouteProcessing()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return false;
});

// Log installation
chrome.runtime.onInstalled.addListener(() => {
  log('SCE2 Extension installed');
});
