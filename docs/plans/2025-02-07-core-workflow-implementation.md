# SCE2 Core Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the complete field-to-submission workflow: Map selection → SCE data extraction → PDF generation → Field collection → Extension auto-fill

**Architecture:**
1. Map → Draw shape/Select range → Click "Process Route" button
2. Opens SCE website in multiple tabs (concurrent)
3. Extracts REAL customer names/phone numbers from SCE
4. Generates PDF with real customer data + QR codes
5. Field worker scans QR, uploads photos/notes
6. Extension auto-fills complete rebate application

**Tech Stack:** TypeScript, Chrome Extension (Manifest V3), React, Express, Prisma, jsPDF, QRCode

---

## THE COMPLETE WORKFLOW (How It Should Work)

### Phase 1: Planning (Webapp)
1. User opens webapp, sees map
2. Draws rectangle/circle or clicks "Optimal Route" button
3. System calculates optimal route order
4. Shows list of addresses to process

### Phase 2: Data Collection (Extension + Background Script)
1. User clicks "Process Route" / "Extract Customer Data" button
2. For each address (up to 3 at a time):
   - Opens SCE rebate website in new tab
   - Fills in Street Address + ZIP Code
   - Clicks "Search" button
   - Clicks "Income" to reveal customer info
   - Extracts Customer Name + Phone Number
   - Takes screenshot (proof)
   - Closes tab
3. Shows progress bar: "Processing 5/20 addresses..."

### Phase 3: PDF Generation
1. All customer data collected and stored
2. User clicks "Generate Route PDF"
3. PDF includes:
   - 3x3 grid of properties (optimal route order)
   - REAL customer names and phone numbers
   - QR codes for mobile access
   - AGE and NOTES fields for hand-writing

### Phase 4: Field Work (Mobile)
1. Field worker opens mobile app
2. Scans QR code from PDF
3. Sees property info + customer info
4. Takes photos, adds notes
5. Uploads via mobile app

### Phase 5: Submission (Extension)
1. User opens SCE rebate website on desktop
2. Extension detects the page
3. Auto-fills ALL sections using collected data
4. User reviews and submits

---

## Task 1: Create Route Processor Module (Extension)

**Files:**
- Create: `packages/extension/src/lib/route-processor.ts`
- Create: `packages/extension/src/lib/route-processor-utils.ts`

**Step 1: Create route processor types and configuration**

```typescript
// packages/extension/src/lib/route-processor.ts

export interface RouteAddress {
  number: string;        // "1909"
  street: string;         // "W Martha Ln"
  city?: string;          // "Santa Ana"
  state: string;          // "CA"
  zip: string;           // "92706"
  full: string;          // "1909 W Martha Ln, Santa Ana, CA 92706"
}

export interface RouteProcessResult {
  success: boolean;
  address: string;
  customerName?: string;
  customerPhone?: string;
  screenshot?: string;    // base64 data URL
  timestamp: string;
  error?: string;
}

export const ROUTE_CONFIG = {
  sceFormUrl: 'https://sce.dsmcentral.com/program-management-app/new-customer',
  captureDelay: 5000,      // Wait for page load + data capture
  tabOpenDelay: 2000,      // Between opening tabs
  screenshotDelay: 1000,   // Before screenshot
  maxConcurrentTabs: 3,    // Process 3 addresses at once
  maxBatchSize: 50,        // Max addresses per batch
  retryAttempts: 2,        // Retry failed addresses
  retryDelay: 3000,        // Delay before retry (ms)
};

export interface BatchProgress {
  type: 'start' | 'progress' | 'complete' | 'error';
  batchId: string;
  current: number;
  total: number;
  percent: number;
  message: string;
  result?: RouteProcessResult;
}
```

**Step 2: Create utility functions**

```typescript
// packages/extension/src/lib/route-processor-utils.ts

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function openTab(url: string): Promise<number> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url }, (tab) => {
      resolve(tab.id!);
    });
  });
}

export async function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => resolve());
  });
}

export async function captureScreenshot(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(tabId, { format: 'png' }, (dataUrl) => {
      if (dataUrl) {
        resolve(dataUrl);
      } else {
        reject(new Error('Failed to capture screenshot'));
      }
    });
  });
}

export async function sendToContentScript<T>(
  tabId: number,
  message: any,
  timeout = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Content script response timeout'));
    }, timeout);

    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}
```

**Step 3: Implement single address processor**

```typescript
// Add to route-processor.ts

export async function processRouteAddress(
  address: RouteAddress,
  config = typeof ROUTE_CONFIG,
  progressCallback?: (update: any) => void
): Promise<RouteProcessResult> {
  const finalConfig = { ...ROUTE_CONFIG, ...config };
  let tabId: number | null = null;
  let attempt = 0;

  while (attempt < finalConfig.retryAttempts) {
    try {
      if (progressCallback) {
        progressCallback({
          type: 'start',
          address: address.full,
          message: `Opening: ${address.full}`
        });
      }

      // 1. Open SCE form in new tab
      tabId = await openTab(finalConfig.sceFormUrl);

      if (progressCallback) {
        progressCallback({
          type: 'progress',
          address: address.full,
          message: `Tab ${tabId} opened`
        });
      }

      // 2. Wait for page to load
      await sleep(finalConfig.tabOpenDelay);

      // 3. Send fill form command to content script
      const fillMessage = {
        action: 'fillRouteAddress',
        address: {
          streetNumber: address.number,
          streetName: address.street,
          zipCode: address.zip
        }
      };

      const fillResult = await sendToContentScript(tabId, fillMessage);

      if (!fillResult || !fillResult.success) {
        throw new Error(fillResult?.error || 'Failed to fill form');
      }

      if (progressCallback) {
        progressCallback({
          type: 'progress',
          address: address.full,
          message: 'Form filled, searching...'
        });
      }

      // 4. Wait for search results and data capture
      await sleep(finalConfig.captureDelay);

      // 5. Request data capture from content script
      const captureResult = await sendToContentScript(tabId, {
        action: 'captureRouteData'
      });

      // 6. Capture screenshot
      let screenshotDataUrl: string | undefined;
      try {
        await sleep(finalConfig.screenshotDelay);
        screenshotDataUrl = await captureScreenshot(tabId);
      } catch (screenshotError) {
        console.warn('Screenshot failed:', screenshotError);
      }

      // 7. Close tab
      await closeTab(tabId!);
      tabId = null;

      return {
        success: true,
        address: address.full,
        customerName: captureResult?.data?.customerName,
        customerPhone: captureResult?.data?.customerPhone,
        screenshot: screenshotDataUrl,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      attempt++;

      // Clean up tab on error
      if (tabId !== null) {
        try {
          await closeTab(tabId);
        } catch (closeError) {
          console.warn('Failed to close tab after error:', closeError);
        }
        tabId = null;
      }

      if (attempt < finalConfig.retryAttempts) {
        if (progressCallback) {
          progressCallback({
            type: 'retry',
            address: address.full,
            attempt: attempt,
            message: `Retrying (${attempt}/${finalConfig.retryAttempts})`
          });
        }
        await sleep(finalConfig.retryDelay);
      } else {
        // Final attempt failed
        return {
          success: false,
          address: address.full,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        };
      }
    }
  }

  // Should not reach here
  return {
    success: false,
    address: address.full,
    error: 'Max retry attempts exceeded',
    timestamp: new Date().toISOString()
  };
}
```

**Step 4: Implement batch processor (concurrent tabs)**

```typescript
// Add to route-processor.ts

export async function processRouteBatch(
  addresses: RouteAddress[],
  config = typeof ROUTE_CONFIG,
  progressCallback?: (update: BatchProgress) => void
): Promise<{ batchId: string; results: RouteProcessResult[] }> {

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('Addresses must be a non-empty array');
  }

  if (addresses.length > ROUTE_CONFIG.maxBatchSize) {
    throw new Error(`Batch size exceeds maximum of ${ROUTE_CONFIG.maxBatchSize} addresses`);
  }

  const finalConfig = { ...ROUTE_CONFIG, ...config };
  const batchId = generateBatchId();

  // Batch state
  let processed = 0;
  let successful = 0;
  let failed = 0;
  const results: RouteProcessResult[] = [];

  if (progressCallback) {
    progressCallback({
      type: 'start',
      batchId,
      current: 0,
      total: addresses.length,
      percent: 0,
      message: `Starting batch: ${addresses.length} addresses`
    });
  }

  try {
    // Process in chunks (concurrent tabs)
    const maxConcurrent = finalConfig.maxConcurrentTabs;
    let index = 0;

    while (index < addresses.length) {
      const chunk = addresses.slice(index, index + maxConcurrent);
      index += chunk.length;

      // Process chunk in parallel
      const chunkPromises = chunk.map(async (address) => {
        try {
          const result = await processRouteAddress(address, finalConfig, (update) => {
            // Update counters
            if (update.type === 'complete') {
              successful++;
            } else if (update.type === 'error') {
              failed++;
            }
            processed++;

            // Forward to progress callback
            if (progressCallback) {
              progressCallback({
                ...update,
                batchId,
                current: processed,
                total: addresses.length,
                percent: Math.round((processed / addresses.length) * 100)
              });
            }
          });
          return result;
        } catch (error) {
          failed++;
          processed++;
          return {
            success: false,
            address: address.full,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          };
        }
      });

      // Wait for chunk to complete
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Delay between chunks (don't overwhelm SCE)
      if (index < addresses.length) {
        await sleep(finalConfig.tabOpenDelay);
      }
    }

    if (progressCallback) {
      progressCallback({
        type: 'complete',
        batchId,
        current: addresses.length,
        total: addresses.length,
        percent: 100,
        message: `Batch complete: ${successful}/${addresses.length} successful`
      });
    }

    return { batchId, results };

  } catch (error) {
    if (progressCallback) {
      progressCallback({
        type: 'error',
        batchId,
        current: processed,
        total: addresses.length,
        percent: Math.round((processed / addresses.length) * 100),
        message: `Batch error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
    throw error;
  }
}
```

**Step 5: Commit**

```bash
git add packages/extension/src/lib/route-processor.ts packages/extension/src/lib/route-processor-utils.ts
git commit -m "feat(ext): Add route processor module for SCE data extraction

- Implements concurrent tab processing (up to 3 tabs)
- Fill route address + extract customer name/phone
- Screenshot capture for each address
- Progress tracking and error handling"
```

---

## Task 2: Add Content Script Handlers for Route Processing

**Files:**
- Modify: `packages/extension/src/content.ts`

**Step 1: Add fillRouteAddress handler**

```typescript
// Add to content.ts - inside the message listener

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers ...

  // NEW: Route processing - fill address form
  if (message.action === 'fillRouteAddress') {
    handleFillRouteAddress(message.address)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  // NEW: Route processing - capture customer data
  if (message.action === 'captureRouteData') {
    const data = handleCaptureRouteData();
    sendResponse({ success: true, data });
    return true;
  }

  // ... existing handlers ...
});
```

**Step 2: Implement handleFillRouteAddress function**

```typescript
// Add to content.ts

async function handleFillRouteAddress(address: {
  streetNumber: string;
  streetName: string;
  zipCode: string;
}): Promise<{ customerName?: string; customerPhone?: string }> {

  console.log('[Route] Filling address:', address);

  // Fill Street Address
  const streetAddressInput = document.querySelector('[aria-label*="Street Address" i], [aria-label*="address" i] input, mat-label:has-text("Street Address") ~ input');
  if (streetAddressInput) {
    (streetAddressInput as HTMLInputElement).value = `${address.streetNumber} ${address.streetName}`;
    streetAddressInput.dispatchEvent(new Event('input', { bubbles: true }));
    streetAddressInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Fill ZIP Code
  const zipInput = document.querySelector('[aria-label*="ZIP" i], [aria-label*="Zip Code" i], mat-label:has-text("ZIP") ~ input');
  if (zipInput) {
    (zipInput as HTMLInputElement).value = address.zipCode;
    zipInput.dispatchEvent(new Event('input', { bubbles: true }));
    zipInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Click Search button
  const searchButton = Array.from(document.querySelectorAll('button, mat-option')).find(btn =>
    btn.textContent.toLowerCase().includes('search') ||
    btn.getAttribute('aria-label')?.toLowerCase().includes('search')
  );
  if (searchButton) {
    searchButton.click();
    await sleep(2000); // Wait for search results
  }

  // Click Income to reveal customer info
  const incomeButton = Array.from(document.querySelectorAll('button, mat-option')).find(btn =>
    btn.textContent.toLowerCase().includes('income') ||
    btn.getAttribute('aria-label')?.toLowerCase().includes('income')
  );
  if (incomeButton) {
    incomeButton.click();
    await sleep(2000); // Wait for customer info to load
  }

  // Try to extract customer data immediately
  return extractCustomerData();
}

function extractCustomerData(): { customerName?: string; customerPhone?: string } {
  // SCE displays customer info in various places - try multiple selectors
  const customerName = getInputValue('Customer Name') ||
    getTextValue('[aria-label*="Customer Name" i]') ||
    getTextValue('[data-field-name="customerName"]');

  const customerPhone = getInputValue('Phone') ||
    getInputValue('Customer Phone') ||
    getTextValue('[aria-label*="Phone" i]') ||
    getTextValue('[data-field-name="customerPhone"]');

  console.log('[Route] Extracted:', { customerName, customerPhone });

  return { customerName, customerPhone };
}

function handleCaptureRouteData() {
  return extractCustomerData();
}

function getTextValue(selector: string): string {
  const el = document.querySelector(selector);
  return el?.textContent?.trim() || '';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Step 3: Commit**

```bash
git add packages/extension/src/content.ts
git commit -m "feat(ext): Add content script handlers for route processing

- fillRouteAddress: Fills address form and clicks Search/Income
- captureRouteData: Extracts customer name and phone from SCE
- Supports multiple selector patterns for robustness"
```

---

## Task 3: Add Background Script Route Processing

**Files:**
- Modify: `packages/extension/src/background.ts`

**Step 1: Add route processing message handler**

```typescript
// Add to background.ts

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers ...

  // NEW: Process route batch
  if (message.action === 'PROCESS_ROUTE_BATCH') {
    const { addresses, config } = message;
    processRouteBatchInBackground(addresses, config, sender.tab?.id)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // NEW: Get batch status
  if (message.action === 'GET_BATCH_STATUS') {
    const { batchId } = message;
    const status = getBatchStatus(batchId);
    sendResponse({ success: true, status });
    return true;
  }

  // ... existing handlers ...
});
```

**Step 2: Import route processor functions**

```typescript
// Add imports to background.ts
import { processRouteBatch, getBatchStatus } from './lib/route-processor.js';
import type { RouteAddress, BatchProgress } from './lib/route-processor.js';
```

**Step 3: Implement background processor with progress updates**

```typescript
// Add to background.ts

const activeBatches = new Map<string, {
  results: any[];
  progress: BatchProgress;
}>();

async function processRouteBatchInBackground(
  addresses: RouteAddress[],
  config: any,
  sourceTabId?: number
) {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const progressCallback = (update: BatchProgress) => {
    // Store progress
    activeBatches.set(batchId, {
      results: activeBatches.get(batchId)?.results || [],
      progress: update
    });

    // Send progress to source tab
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'ROUTE_PROGRESS',
        batchId,
        update
      });
    }

    // Also update badge
    if (update.percent !== undefined) {
      chrome.action.setBadgeText({ text: `${update.percent}%`, tabId: sourceTabId });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: sourceTabId });
    }
  };

  try {
    const { results } = await processRouteBatch(addresses, config, progressCallback);

    // Send final results to cloud server
    await saveExtractedDataToCloud(results);

    // Notify completion
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'ROUTE_COMPLETE',
        batchId,
        results
      });
    }

    chrome.action.setBadgeText({ text: '', tabId: sourceTabId });

    return { batchId, results };

  } catch (error) {
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'ROUTE_ERROR',
        batchId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    throw error;
  }
}

async function saveExtractedDataToCloud(results: any[]) {
  // Save extracted customer data to cloud server
  for (const result of results) {
    if (result.success && result.customerName) {
      await fetch(`${API_BASE}/api/properties/update-by-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressFull: result.address,
          customerName: result.customerName,
          customerPhone: result.customerPhone,
          dataExtracted: true,
          extractedAt: result.timestamp
        })
      });
    }
  }
}
```

**Step 4: Commit**

```bash
git add packages/extension/src/background.ts
git commit -m "feat(ext): Add background route processing with progress updates

- PROCESS_ROUTE_BATCH message handler
- Progress tracking with badge updates
- Saves extracted customer data to cloud server
- Error handling and notifications"
```

---

## Task 4: Add "Process Route" Button to Webapp

**Files:**
- Modify: `packages/webapp/src/components/MapLayout.tsx`
- Create: `packages/webapp/src/components/RouteProcessor.tsx`

**Step 1: Create RouteProcessor component**

```typescript
// packages/webapp/src/components/RouteProcessor.tsx

import React, { useState } from 'react';
import type { Property } from '../types';

interface RouteProcessorProps {
  properties: Property[];
  selectedProperties: Property[];
  onProcessingComplete: (results: any[]) => void;
}

export const RouteProcessor: React.FC<RouteProcessorProps> = ({
  properties,
  selectedProperties,
  onProcessingComplete,
}) => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0, message: '' });
  const [results, setResults] = useState<any[]>([]);

  const propertiesToProcess = selectedProperties.length > 0 ? selectedProperties : properties;

  const handleProcess = async () => {
    if (propertiesToProcess.length === 0) {
      alert('No properties to process');
      return;
    }

    try {
      setProcessing(true);
      setProgress({ current: 0, total: propertiesToProcess.length, percent: 0, message: 'Starting...' });

      // Convert properties to route addresses
      const addresses = propertiesToProcess.map(prop => {
        const parts = prop.addressFull?.split(',') || [];
        const streetPart = parts[0]?.trim() || '';
        const zipPart = parts[parts.length - 1]?.trim() || '';

        // Parse street number and name
        const streetParts = streetPart.split(/\s+/);
        const number = streetParts[0] || '';
        const street = streetParts.slice(1).join(' ');

        return {
          number,
          street,
          city: parts[1]?.trim() || '',
          state: 'CA',
          zip: zipPart,
          full: prop.addressFull
        };
      });

      // Send message to extension background script
      const response = await chrome.runtime.sendMessage({
        action: 'PROCESS_ROUTE_BATCH',
        addresses: addresses,
        config: {
          maxConcurrentTabs: 3
        }
      });

      if (response.success) {
        setResults(response.results);
        onProcessingComplete(response.results);
      }

    } catch (error) {
      console.error('Processing failed:', error);
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  // Listen for progress updates from extension
  React.useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === 'ROUTE_PROGRESS') {
        setProgress(message.update);
      } else if (message.action === 'ROUTE_COMPLETE') {
        setResults(message.results);
        setProcessing(false);
        onProcessingComplete(message.results);
      } else if (message.action === 'ROUTE_ERROR') {
        setProcessing(false);
        alert(`Error: ${message.error}`);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [onProcessingComplete]);

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Process Route - Extract Customer Data
      </h2>

      <div className="space-y-4">
        {/* Property count */}
        <div className="text-sm text-gray-600">
          {propertiesToProcess.length} propert{propertiesToProcess.length !== 1 ? 'ies' : 'y'} to process
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progress.message}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {progress.current} / {progress.total} processed
            </div>
          </div>
        )}

        {/* Results summary */}
        {results.length > 0 && !processing && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 font-medium">
                Processing complete! {results.filter(r => r.success).length} / {results.length} successful
              </span>
            </div>
          </div>
        )}

        {/* Process button */}
        <div className="flex justify-end">
          <button
            onClick={handleProcess}
            disabled={processing || propertiesToProcess.length === 0}
            className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              processing || propertiesToProcess.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {processing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Extract Customer Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Add RouteProcessor to MapLayout**

```typescript
// packages/webapp/src/components/MapLayout.tsx

import { RouteProcessor } from './RouteProcessor';

// Add to component props and state
const [extractedData, setExtractedData] = useState<any[]>([]);

// Add RouteProcessor component in the JSX, below PDFGenerator
<RouteProcessor
  properties={properties}
  selectedProperties={selectedProperties}
  onProcessingComplete={(results) => {
    setExtractedData(results);
    // Refresh properties to get newly extracted customer data
    fetchProperties();
  }}
/>
```

**Step 3: Commit**

```bash
git add packages/webapp/src/components/RouteProcessor.tsx packages/webapp/src/components/MapLayout.tsx
git commit -m "feat(webapp): Add route processor component

- 'Extract Customer Data' button with progress tracking
- Integrates with extension background script
- Shows real-time progress during SCE data extraction
- Displays results summary after completion"
```

---

## Task 5: Update PDF Generator to Use Real Customer Data

**Files:**
- Modify: `packages/webapp/src/lib/pdf-generator.ts`

**Step 1: Remove test data fallback**

```typescript
// packages/webapp/src/lib/pdf-generator.ts

// REMOVE the TEST_CUSTOMERS array and enrichWithTestData function
// Instead, use real customer data from properties

export async function generateRouteSheet(
  properties: Property[],
  options: PDFGenerationOptions = {}
): Promise<void> {
  const {
    includeQR = true,
    includeCustomerData = true,
    startLat,
    startLon,
  } = options;

  // Optimize route order
  const optimizedProperties = optimizeRoute(properties, startLat, startLon);

  // NO MORE TEST DATA - use real customer data
  // If customer data is missing, show empty fields to be filled by hand

  // Group into pages of 9 (3x3 grid)
  const pages = groupIntoPages(optimizedProperties);

  // ... rest of function remains the same ...
```

**Step 2: Update PDF to show warning when customer data missing**

```typescript
// Add warning on first page if missing customer data
let hasMissingCustomerData = false;
for (const prop of optimizedProperties) {
  if (!prop.customerName || !prop.customerPhone) {
    hasMissingCustomerData = true;
    break;
  }
}

if (hasMissingCustomerData && pageIndex === 0) {
  doc.setTextColor(200, 100, 100);
  doc.setFontSize(8);
  doc.text('⚠️ SOME PROPERTIES MISSING CUSTOMER DATA - Run "Extract Customer Data" first',
    pageWidth - margin - 80, 20);
  doc.setTextColor(0);
}
```

**Step 3: Commit**

```bash
git add packages/webapp/src/lib/pdf-generator.ts
git commit -m "fix(pdf): Remove test data, use real customer data from SCE

- Properties now use real customer names/phones extracted from SCE
- Shows warning when customer data is missing
- PDF displays empty fields for manual entry if data not extracted"
```

---

## Task 6: Add Cloud Server Endpoint for Property Updates

**Files:**
- Create: `packages/cloud-server/src/routes/properties-update.ts`

**Step 1: Create update endpoint**

```typescript
// packages/cloud-server/src/routes/property-update.ts

import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const propertyUpdateRoutes = Router();

/**
 * POST /api/properties/update-by-address
 * Update property by address (for route processor)
 */
propertyUpdateRoutes.post('/update-by-address', asyncHandler(async (req, res) => {
  const { addressFull, customerName, customerPhone, dataExtracted, extractedAt } = req.body;

  if (!addressFull) {
    return res.status(400).json({ success: false, error: 'addressFull is required' });
  }

  // Update property
  const property = await prisma.property.upsert({
    where: { addressFull },
    update: {
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      dataExtracted: dataExtracted || true,
      extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
      status: 'READY_FOR_FIELD', // Now ready for field visit
    },
    create: {
      addressFull,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      dataExtracted: dataExtracted || true,
      extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
      status: 'READY_FOR_FIELD',
      latitude: 0, // Will be geocoded later
      longitude: 0,
    },
  });

  res.json({ success: true, data: property });
}));
```

**Step 2: Register routes**

```typescript
// packages/cloud-server/src/routes/index.ts

import { propertyUpdateRoutes } from './property-update.js';

app.use('/api/properties', propertyUpdateRoutes);
```

**Step 3: Commit**

```bash
git add packages/cloud-server/src/routes/property-update.ts packages/cloud-server/src/routes/index.ts
git commit -m "feat(server): Add endpoint for updating properties by address

- POST /api/properties/update-by-address
- Upserts properties with extracted customer data
- Sets status to READY_FOR_FIELD after extraction"
```

---

## Task 7: Add Extension Host Permission for SCE Website

**Files:**
- Modify: `packages/extension/manifest.json`

**Step 1: Add SCE website to host permissions**

```json
{
  "host_permissions": [
    "https://sce.dsmcentral.com/*",
    "https://*.sce.com/*",
    "http://localhost:3333/*"
  ]
}
```

**Step 2: Commit**

```bash
git add packages/extension/manifest.json
git commit -m "fix(ext): Add SCE website to host permissions

- Required for route processing to interact with SCE forms
- Allows content script injection on SCE rebate website"
```

---

## Task 8: Update Property Type to Include Extraction Fields

**Files:**
- Modify: `packages/cloud-server/prisma/schema.prisma`

**Step 1: Add extraction fields to Property model**

```prisma
model Property {
  id        String   @id @default(cuid())

  // ... existing fields ...

  // NEW: Route extraction fields
  customerName     String?
  customerPhone     String?
  dataExtracted     Boolean  @default(false)
  extractedAt       DateTime?
  screenshotUrl     String?   // URL to screenshot of SCE page

  // ... existing fields ...
}
```

**Step 2: Generate and push migration**

```bash
cd packages/cloud-server
npm run db:generate
npm run db:push
```

**Step 3: Commit**

```bash
git add packages/cloud-server/prisma/schema.prisma
git add packages/cloud-server/prisma/migrations/*
git commit -m "feat(db): Add customer data extraction fields to Property

- customerName, customerPhone from SCE
- dataExtracted flag, extractedAt timestamp
- screenshotUrl for proof of extraction"
```

---

## Task 9: End-to-End Testing

**Files:**
- Create: `docs/ROUTE_WORKFLOW_TEST.md`

**Step 1: Create testing checklist**

```markdown
# Route Workflow Testing Checklist

## Test 1: Map Selection and Route Processing
1. Open webapp
2. Draw rectangle on map
3. Click "Extract Customer Data" button
4. Verify extension opens SCE tabs (3 at a time)
5. Verify progress bar updates
6. Verify customer names/phones are extracted

## Test 2: PDF Generation with Real Data
1. After extraction, click "Generate PDF"
2. Verify PDF shows REAL customer names
3. Verify PDF shows REAL phone numbers
4. Verify QR codes are present

## Test 3: Mobile QR Scan
1. Open mobile app
2. Scan QR code from PDF
3. Verify property loads with customer info
4. Add photo/note
5. Verify upload works

## Test 4: Extension Auto-Fill
1. Open SCE rebate website
2. Navigate to customer section
3. Verify name and phone are pre-filled
4. Complete form submission
```

**Step 2: Commit**

```bash
git add docs/ROUTE_WORKFLOW_TEST.md
git commit -m "docs: Add route workflow testing checklist"
```

---

## Summary

This plan implements THE COMPLETE WORKFLOW:

1. ✅ Map → Select addresses (exists)
2. ✅ "Extract Customer Data" button (NEW)
3. ✅ Opens SCE tabs concurrently (NEW)
4. ✅ Fills address + clicks Search/Income (NEW)
5. ✅ Extracts REAL customer names/phones (NEW)
6. ✅ Generates PDF with real data (FIXED)
7. ✅ QR codes for mobile (exists)
8. ✅ Mobile photo upload (exists)
9. ✅ Extension auto-fill (exists, can be enhanced)

**All commits should be pushed individually for easy rollback.**
