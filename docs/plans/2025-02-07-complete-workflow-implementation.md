# SCE2 Core Workflow - Complete Route Processing System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the complete field-to-submission workflow with multiple address selection methods and automatic SCE data extraction.

**Architecture:** Multi-address selection on map → Concurrent SCE tab processing → Customer data extraction → PDF generation → Mobile QR access → Extension auto-fill.

**Tech Stack:** TypeScript, React, Leaflet, Chrome Extension (MV3), Express, Prisma, jsPDF, QRCode

---

## Overview of the Complete Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: ADDRESS SELECTION (Webapp)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Draw shapes (rectangle/circle) on map                                 │
│ 2. Enter address range (e.g., "100-200 Main St")                          │
│ 3. Click to add pins manually                                            │
│ 4. Import list of addresses                                            │
│ 5. Select from existing database properties                              │
│ → Result: List of addresses to process                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: DATA EXTRACTION (Extension)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Click "Process Route" / "Extract Customer Data" button               │
│ 2. Opens SCE website in 3 tabs at once (concurrent)                      │
│ 3. For each tab:                                                       │
│    - Wait for page load                                               │
│    - Fill Street Address + ZIP Code                                   │
│    - Click "Search" button                                           │
│    - Click "Income" to reveal customer info                            │
│    - Extract customer name and phone number                           │
│    - Take screenshot                                                  │
│    - Close tab                                                        │
│ 4. Process next chunk of 3 addresses                                   │
│ 5. Show real-time progress: "Processing 5/20..."                       │
│ → Result: Database updated with REAL customer data                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PDF GENERATION (Webapp)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Click "Generate Route PDF"                                          │
│ 2. Calculates optimal route order (nearest neighbor)                     │
│ 3. Creates 3x3 grid pages with:                                        │
│    - Property address                                                  │
│    - REAL customer name and phone                                     │
│    - QR code for mobile access                                        │
│    - AGE field (for hand-writing)                                     │
│    - NOTES field (for hand-writing)                                   │
│ → Result: PDF saved to computer                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: FIELD WORK (Mobile App)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Open mobile app                                                     │
│ 2. Point camera at QR code on PDF                                      │
│ 3. Property + customer info loads                                     │
│ 4. Add field notes                                                     │
│ 5. Take photos of property/equipment                                   │
│ 6. Upload data                                                        │
│ → Result: Field data saved to database                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: SUBMISSION (Extension)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Open SCE rebate website on desktop                                  │
│ 2. Extension detects the page                                           │
│ 3. Auto-fills ALL sections:                                           │
│    - Customer Information                                              │
│    - Property Information                                             │
│    - Project Information                                             │
│    - Equipment                                                      │
│    - Trade Ally                                                     │
│    - Appointments                                                   │
│ 4. User reviews and clicks submit                                      │
│ → Result: Rebate application submitted                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Task 1: Create Route Processor Types and Utilities

**Files:**
- Create: `packages/extension/src/lib/route-processor-types.ts`
- Create: `packages/extension/src/lib/route-processor-utils.ts`

**Step 1: Create type definitions**

```typescript
// packages/extension/src/lib/route-processor-types.ts

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
 * Result of processing a single address
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
  tabOpenDelay: number;
  captureDelay: number;
  screenshotDelay: number;
  maxConcurrentTabs: number;
  maxBatchSize: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Progress update during batch processing
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

/**
 * Default configuration
 */
export const DEFAULT_ROUTE_CONFIG: RouteConfig = {
  sceFormUrl: 'https://sce.dsmcentral.com/program-management-app/new-customer',
  tabOpenDelay: 2000,
  captureDelay: 5000,
  screenshotDelay: 1000,
  maxConcurrentTabs: 3,
  maxBatchSize: 50,
  retryAttempts: 2,
  retryDelay: 3000,
};
```

**Step 2: Create utility functions**

```typescript
// packages/extension/src/lib/route-processor-utils.ts

/**
 * Sleep/delay utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique batch ID
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Open a new tab and return its ID
 */
export async function openTab(url: string): Promise<number> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      resolve(tab.id!);
    });
  });
}

/**
 * Close a tab by ID
 */
export async function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => resolve());
  });
}

/**
 * Capture visible tab as screenshot
 */
export async function captureScreenshot(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (dataUrl) {
        resolve(dataUrl);
      } else {
        reject(new Error('Failed to capture screenshot'));
      }
    });
  });
}

/**
 * Send message to content script and wait for response
 */
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

/**
 * Parse full address into components
 */
export function parseAddress(fullAddress: string, zipCode: string): RouteAddress {
  const parts = fullAddress.split(',').map(p => p.trim());

  // Address part: "1909 W Martha Ln"
  const addressPart = parts[0] || fullAddress;
  const addressParts = addressPart.split(/\s+/);
  const number = addressParts[0] || '';
  const street = addressParts.slice(1).join(' ');

  // City part
  const city = parts[1] || '';

  return {
    number,
    street,
    city,
    state: 'CA',
    zip: zipCode,
    full: fullAddress
  };
}
```

**Step 3: Commit**

```bash
git add packages/extension/src/lib/route-processor-types.ts packages/extension/src/lib/route-processor-utils.ts
git commit -m "feat(ext): Add route processor types and utilities"
```

---

## Task 2: Implement Single Address Processor

**Files:**
- Create: `packages/extension/src/lib/route-processor.ts`

**Step 1: Create route processor module**

```typescript
// packages/extension/src/lib/route-processor.ts

import type { RouteAddress, RouteProcessResult, RouteConfig, BatchProgress } from './route-processor-types.js';
import { DEFAULT_ROUTE_CONFIG } from './route-processor-types.js';
import * as Utils from './route-processor-utils.js';

const { sleep, openTab, closeTab, captureScreenshot, sendToContentScript } = Utils;

/**
 * Process a single address through SCE website
 * Opens tab, fills form, extracts customer data, takes screenshot
 */
export async function processRouteAddress(
  address: RouteAddress,
  config: Partial<RouteConfig> = {},
  progressCallback?: (update: BatchProgress) => void
): Promise<RouteProcessResult> {
  const finalConfig = { ...DEFAULT_ROUTE_CONFIG, ...config };
  let tabId: number | null = null;
  let attempt = 0;

  while (attempt < finalConfig.retryAttempts) {
    try {
      // Notify start
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          batchId: '',
          current: 0,
          total: 1,
          percent: 0,
          message: `Opening: ${address.full}`
        });
      }

      // 1. Open SCE form
      tabId = await openTab(finalConfig.sceFormUrl);

      // 2. Wait for page load
      await sleep(finalConfig.tabOpenDelay);

      // 3. Send fill command
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

      // 4. Wait for search and data load
      await sleep(finalConfig.captureDelay);

      // 5. Capture customer data
      const captureResult = await sendToContentScript(tabId, {
        action: 'captureRouteData'
      });

      // 6. Screenshot
      let screenshotDataUrl: string | undefined;
      try {
        await sleep(finalConfig.screenshotDelay);
        screenshotDataUrl = await captureScreenshot(tabId);
      } catch (screenshotError) {
        console.warn('[Route] Screenshot failed:', screenshotError);
      }

      // 7. Close tab
      await closeTab(tabId);
      tabId = null;

      // 8. Return result
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

      // Cleanup tab on error
      if (tabId !== null) {
        try {
          await closeTab(tabId);
        } catch {
          // Ignore
        }
        tabId = null;
      }

      // Retry?
      if (attempt < finalConfig.retryAttempts) {
        if (progressCallback) {
          progressCallback({
            type: 'progress',
            batchId: '',
            current: 0,
            total: 1,
            percent: 0,
            message: `Retrying (${attempt}/${finalConfig.retryAttempts})`
          });
        }
        await sleep(finalConfig.retryDelay);
      } else {
        // Failed
        return {
          success: false,
          address: address.full,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        };
      }
    }
  }

  return {
    success: false,
    address: address.full,
    error: 'Max retries exceeded',
    timestamp: new Date().toISOString()
  };
}
```

**Step 2: Commit**

```bash
git add packages/extension/src/lib/route-processor.ts
git commit -m "feat(ext): Implement single address route processor"
```

---

## Task 3: Implement Batch Processor (Concurrent Tabs)

**Files:**
- Modify: `packages/extension/src/lib/route-processor.ts`

**Step 1: Add batch processing function**

```typescript
// Add to route-processor.ts

/**
 * Process multiple addresses with concurrency control
 * Opens up to maxConcurrentTabs at a time
 */
export async function processRouteBatch(
  addresses: RouteAddress[],
  config: Partial<RouteConfig> = {},
  progressCallback?: (update: BatchProgress) => void
): Promise<{ batchId: string; results: RouteProcessResult[] }> {

  const finalConfig = { ...DEFAULT_ROUTE_CONFIG, ...config };
  const batchId = Utils.generateBatchId();

  // Validation
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('Addresses must be a non-empty array');
  }

  if (addresses.length > finalConfig.maxBatchSize) {
    throw new Error(`Batch size exceeds maximum of ${finalConfig.maxBatchSize}`);
  }

  // Batch state
  let processed = 0;
  let successful = 0;
  let failed = 0;
  const results: RouteProcessResult[] = [];

  // Notify start
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
    const maxConcurrent = finalConfig.maxConcurrentTabs;
    let index = 0;

    // Process in chunks
    while (index < addresses.length) {
      const chunk = addresses.slice(index, index + maxConcurrent);
      index += chunk.length;

      // Process chunk in parallel
      const chunkPromises = chunk.map(async (address, chunkIndex) => {
        const globalIndex = index - chunk.length + chunkIndex;

        try {
          const result = await processRouteAddress(address, finalConfig, (update) => {
            // Update counters
            if (update.type === 'complete' || (result && result.success)) {
              successful++;
            } else if (update.type === 'error' || (result && !result.success)) {
              failed++;
            }
            processed++;

            // Forward progress
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

          if (progressCallback) {
            progressCallback({
              type: 'progress',
              batchId,
              current: processed,
              total: addresses.length,
              percent: Math.round((processed / addresses.length) * 100),
              message: `Error: ${address.full}`
            });
          }

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

      // Delay between chunks
      if (index < addresses.length) {
        await sleep(finalConfig.tabOpenDelay);
      }
    }

    // Notify complete
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

**Step 2: Export utilities**

```typescript
// Add to route-processor.ts

export * from './route-processor-types.js';
export * as Utils from './route-processor-utils.js';
```

**Step 3: Commit**

```bash
git add packages/extension/src/lib/route-processor.ts
git commit -m "feat(ext): Implement concurrent batch processing for routes"
```

---

## Task 4: Add Content Script Handlers for SCE Interaction

**Files:**
- Modify: `packages/extension/src/content.ts`

**Step 1: Add helper functions for SCE interaction**

```typescript
// Add to content.ts

/**
 * Fill route address form on SCE website
 */
async function handleFillRouteAddress(address: {
  streetNumber: string;
  streetName: string;
  zipCode: string;
}): Promise<{ customerName?: string; customerPhone?: string }> {

  console.log('[Route] Filling address:', address);

  // Helper to find input by label text
  function findInputByLabelText(labelText: string): HTMLInputElement | null {
    // Try aria-label
    let el = document.querySelector(`[aria-label*="${labelText}" i]`);
    if (el) return el as HTMLInputElement;

    // Try mat-label
    const labels = Array.from(document.querySelectorAll('mat-label'));
    for (const label of labels) {
      if (label.textContent?.toLowerCase().includes(labelText.toLowerCase())) {
        const input = label.closest('mat-form-field')?.querySelector('input');
        if (input) return input as HTMLInputElement;
      }
    }
    return null;
  }

  // Helper to find button by text
  function findButton(buttonText: string): HTMLButtonElement | null {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    return buttons.find(btn =>
      btn.textContent?.toLowerCase().includes(buttonText.toLowerCase())
    ) as HTMLButtonElement || null;
  }

  // Fill Street Address
  const addressInput = findInputByLabelText('Street Address') ||
                       findInputByLabelText('Address') ||
                       document.querySelector('[name*="address" i]');

  if (addressInput) {
    addressInput.value = `${address.streetNumber} ${address.streetName}`;
    addressInput.dispatchEvent(new Event('input', { bubbles: true }));
    addressInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[Route] ✓ Filled address');
  }

  // Fill ZIP Code
  const zipInput = findInputByLabelText('ZIP') ||
                    findInputByLabelText('Zip Code') ||
                    document.querySelector('[name*="zip" i]');

  if (zipInput) {
    zipInput.value = address.zipCode;
    zipInput.dispatchEvent(new Event('input', { bubbles: true }));
    zipInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[Route] ✓ Filled ZIP');
  }

  // Wait a bit for form to settle
  await new Promise(r => setTimeout(r, 500));

  // Click Search button
  const searchButton = findButton('search');
  if (searchButton) {
    searchButton.click();
    console.log('[Route] ✓ Clicked Search');
    await new Promise(r => setTimeout(r, 2000)); // Wait for results
  }

  // Click Income button to reveal customer info
  const incomeButton = findButton('income');
  if (incomeButton) {
    incomeButton.click();
    console.log('[Route] ✓ Clicked Income');
    await new Promise(r => setTimeout(r, 2000)); // Wait for customer data
  }

  // Extract customer data
  return extractCustomerDataFromSCE();
}

/**
 * Extract customer name and phone from SCE page
 */
function extractCustomerDataFromSCE(): {
  customerName?: string;
  customerPhone?: string;
} {
  // Try various selectors for customer name
  const nameSelectors = [
    '[aria-label*="Customer Name" i]',
    '[data-field-name="customerName"]',
    '[name*="customerName" i]',
    'input[placeholder*="name" i]'
  ];

  for (const selector of nameSelectors) {
    const el = document.querySelector(selector);
    if (el && (el as HTMLInputElement).value) {
      customerName = (el as HTMLInputElement).value;
      break;
    }
  }

  // Try various selectors for phone
  const phoneSelectors = [
    '[aria-label*="Phone" i]',
    '[data-field-name="customerPhone"]',
    '[name*="phone" i]',
    'input[placeholder*="phone" i]',
    'input[type="tel"]'
  ];

  for (const selector of phoneSelectors) {
    const el = document.querySelector(selector);
    if (el && (el as HTMLInputElement).value) {
      customerPhone = (el as HTMLInputElement).value;
      break;
    }
  }

  console.log('[Route] Extracted:', { customerName, customerPhone });
  return { customerName, customerPhone };
}

/**
 * Handle route data capture request
 */
function handleCaptureRouteData() {
  return extractCustomerDataFromSCE();
}
```

**Step 2: Add message listeners**

```typescript
// Add to content.ts message listener

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers ...

  // Route processing - fill address
  if (message.action === 'fillRouteAddress') {
    handleFillRouteAddress(message.address)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Route processing - capture data
  if (message.action === 'captureRouteData') {
    const data = handleCaptureRouteData();
    sendResponse({ success: true, data });
    return true;
  }

  // ... existing handlers ...
});
```

**Step 3: Commit**

```bash
git add packages/extension/src/content.ts
git commit -m "feat(ext): Add SCE route processing handlers to content script"
```

---

## Task 5: Add Background Script Route Processing

**Files:**
- Modify: `packages/extension/src/background.ts`

**Step 1: Import route processor**

```typescript
// Add imports to background.ts

import { processRouteBatch, type RouteAddress, type BatchProgress } from './lib/route-processor.js';
```

**Step 2: Add batch storage**

```typescript
// Add to background.ts

interface BatchState {
  results: any[];
  progress: BatchProgress;
}

const activeBatches = new Map<string, BatchState>();
```

**Step 3: Add PROCESS_ROUTE_BATCH message handler**

```typescript
// Add to background.ts message listener

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers ...

  // Process route batch from webapp
  if (message.action === 'PROCESS_ROUTE_BATCH') {
    const { addresses, config } = message;

    processRouteBatchInBackground(addresses, config, sender.tab?.id)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true;
  }

  // Get batch status
  if (message.action === 'GET_BATCH_STATUS') {
    const { batchId } = message;
    const state = activeBatches.get(batchId);
    sendResponse({ success: true, state: state || null });
    return true;
  }

  // ... existing handlers ...
});
```

**Step 4: Implement background processor**

```typescript
// Add to background.ts

async function processRouteBatchInBackground(
  addresses: RouteAddress[],
  config: any,
  sourceTabId?: number
) {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const progressCallback = (update: BatchProgress) => {
    // Store progress
    const existing = activeBatches.get(batchId) || { results: [], progress: update };
    activeBatches.set(batchId, {
      ...existing,
      progress: update
    });

    // Send to source tab
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'ROUTE_PROGRESS',
        batchId,
        update
      }).catch(() => {
        // Tab might be closed, ignore
      });
    }

    // Update badge
    if (sourceTabId) {
      chrome.action.setBadgeText({
        text: update.percent < 100 ? `${update.percent}%` : '✓',
        tabId: sourceTabId
      });
    }
  };

  try {
    const { results } = await processRouteBatch(addresses, config, progressCallback);

    // Save to cloud server
    await saveExtractedDataToCloud(results);

    // Notify completion
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'ROUTE_COMPLETE',
        batchId,
        results
      }).catch(() => {});
    }

    // Clear badge
    if (sourceTabId) {
      chrome.action.setBadgeText({ text: '', tabId: sourceTabId });
    }

    return { batchId, results };

  } catch (error) {
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'ROUTE_ERROR',
        batchId,
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => {});
    }

    if (sourceTabId) {
      chrome.action.setBadgeText({
        text: '❌',
        tabId: sourceTabId
      });
    }

    throw error;
  }
}

async function saveExtractedDataToCloud(results: any[]) {
  const API_BASE = chrome.storage.sync ?
    (await chrome.storage.sync.get('apiBaseUrl'))?.apiBaseUrl || 'http://localhost:3333' :
    'http://localhost:3333';

  for (const result of results) {
    if (result.success) {
      try {
        await fetch(`${API_BASE}/api/properties/update-by-address`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addressFull: result.address,
            customerName: result.customerName || null,
            customerPhone: result.customerPhone || null,
            dataExtracted: true,
            extractedAt: result.timestamp
          })
        });
      } catch (error) {
        console.error('[Route] Failed to save to cloud:', error);
      }
    }
  }
}
```

**Step 5: Commit**

```bash
git add packages/extension/src/background.ts
git commit -m "feat(ext): Add background script route processing with cloud sync"
```

---

## Task 6: Add SCE Website Permissions

**Files:**
- Modify: `packages/extension/manifest.json`

**Step 1: Add SCE to host_permissions**

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
git commit -m "fix(ext): Add SCE website to host permissions for route processing"
```

---

## Task 7: Create Cloud Server Endpoint for Address Updates

**Files:**
- Create: `packages/cloud-server/src/routes/property-update.ts`
- Modify: `packages/cloud-server/src/routes/index.ts`

**Step 1: Create update routes**

```typescript
// packages/cloud-server/src/routes/property-update.ts

import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const propertyUpdateRoutes = Router();

/**
 * POST /api/properties/update-by-address
 * Updates property with extracted customer data from SCE
 */
propertyUpdateRoutes.post('/update-by-address', asyncHandler(async (req, res) => {
  const { addressFull, customerName, customerPhone, dataExtracted, extractedAt } = req.body;

  if (!addressFull) {
    return res.status(400).json({
      success: false,
      error: 'addressFull is required'
    });
  }

  // Upsert property
  const property = await prisma.property.upsert({
    where: { addressFull },
    update: {
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      dataExtracted: dataExtracted ?? true,
      extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
      status: 'READY_FOR_FIELD',
    },
    create: {
      addressFull,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      dataExtracted: true,
      extractedAt: extractedAt ? new Date(extractedAt) : new Date(),
      status: 'READY_FOR_FIELD',
      latitude: 0,
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
git commit -m "feat(server): Add endpoint for updating properties by address"
```

---

## Task 8: Update Database Schema for Extraction Fields

**Files:**
- Modify: `packages/cloud-server/prisma/schema.prisma`

**Step 1: Add extraction fields to Property model**

```prisma
model Property {
  id        String   @id @default(cuid())
  addressFull String  @unique

  // Customer data extracted from SCE
  customerName     String?
  customerPhone     String?
  dataExtracted     Boolean  @default(false)
  extractedAt       DateTime?
  screenshotUrl     String?

  // ... rest of existing fields ...
}
```

**Step 2: Generate and apply migration**

```bash
cd packages/cloud-server
npm run db:push
```

**Step 3: Commit**

```bash
git add packages/cloud-server/prisma/schema.prisma
git commit -m "feat(db): Add customer extraction fields to Property schema"
```

---

## Task 9: Add Address Range Input Component

**Files:**
- Create: `packages/webapp/src/components/AddressRangeInput.tsx`

**Step 1: Create address range input component**

```typescript
// packages/webapp/src/components/AddressRangeInput.tsx

import React, { useState } from 'react';

interface AddressRangeInputProps {
  onAddressesExtracted: (addresses: string[]) => void;
}

export const AddressRangeInput: React.FC<AddressRangeInputProps> = ({
  onAddressesExtracted,
}) => {
  const [streetName, setStreetName] = useState('');
  const [startNum, setStartNum] = useState('');
  const [endNum, setEndNum] = useState('');
  const [zipCode, setZipCode] = useState('');

  const handleExtract = () => {
    if (!streetName || !startNum || !endNum || !zipCode) {
      alert('Please fill in all fields');
      return;
    }

    const start = parseInt(startNum, 10);
    const end = parseInt(endNum, 10);

    if (isNaN(start) || isNaN(end) || start > end) {
      alert('Invalid address range');
      return;
    }

    // Generate addresses
    const addresses: string[] = [];
    for (let num = start; num <= end; num++) {
      addresses.push(`${num} ${streetName}, ${zipCode}`);
    }

    if (addresses.length > 50) {
      const proceed = confirm(`${addresses.length} addresses generated. Continue?`);
      if (!proceed) return;
    }

    onAddressesExtracted(addresses);

    // Reset form
    setStartNum('');
    setEndNum('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Address Range Input
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Street Name
          </label>
          <input
            type="text"
            value={streetName}
            onChange={(e) => setStreetName(e.target.value)}
            placeholder="e.g., W Martha Ln"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ZIP Code
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="e.g., 92706"
            maxLength={5}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Number
          </label>
          <input
            type="number"
            value={startNum}
            onChange={(e) => setStartNum(e.target.value)}
            placeholder="e.g., 100"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Number
          </label>
          <input
            type="number"
            value={endNum}
            onChange={(e) => setEndNum(e.target.value)}
            placeholder="e.g., 200"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Generates addresses from {startNum || '?'} to {endNum || '?'} {streetName || '(street)'}
        </div>

        <button
          onClick={handleExtract}
          disabled={!streetName || !startNum || !endNum || !zipCode}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            !streetName || !startNum || !endNum || !zipCode
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Generate Addresses
        </button>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add packages/webapp/src/components/AddressRangeInput.tsx
git commit -m "feat(webapp): Add address range input component"
```

---

## Task 10: Add Import List Component

**Files:**
- Create: `packages/webapp/src/components/AddressImport.tsx`

**Step 1: Create import component**

```typescript
// packages/webapp/src/components/AddressImport.tsx

import React, { useState } from 'react';

interface AddressImportProps {
  onAddressesImported: (addresses: string[]) => void;
}

export const AddressImport: React.FC<AddressImportProps> = ({
  onAddressesImported,
}) => {
  const [importText, setImportText] = useState('');

  const handleImport = () => {
    if (!importText.trim()) {
      alert('Please enter addresses to import');
      return;
    }

    // Parse addresses - one per line or comma-separated
    const addresses = importText
      .split(/[\n,]+/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);

    if (addresses.length === 0) {
      alert('No valid addresses found');
      return;
    }

    if (addresses.length > 100) {
      const proceed = confirm(`${addresses.length} addresses imported. Continue?`);
      if (!proceed) return;
    }

    onAddressesImported(addresses);
    setImportText('');
  };

  const loadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Import Address List
      </h2>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="address-import-text"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Paste Addresses
          </label>
          <textarea
            id="address-import-text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="One address per line or comma-separated:&#10;1909 W Martha Ln, Santa Ana, CA 92706&#10;1910 W Martha Ln, Santa Ana, CA 92706&#10;..."
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3V3.9a1 1 0 10-1.415 1.9a1 1 0 01-1.415 1.9V2.5a3 3 0 013-3H4a3 3 0 01-3 3v2.5a1 1 0 001.415 1.9" />
            </svg>
            Import from File
            <input
              type="file"
              accept=".txt,.csv"
              onChange={loadFromFile}
              className="hidden"
            />
          </label>

          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              !importText.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Import ({importText.split(/[\n,]+/).filter(a => a.trim()).length} addresses)
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add packages/webapp/src/components/AddressImport.tsx
git commit -m "feat(webapp): Add address import component with file upload"
```

---

## Task 11: Add Manual Pin Selection Mode to Map

**Files:**
- Modify: `packages/webapp/src/components/MapLayout.tsx`

**Step 1: Add pin selection mode**

```typescript
// Add to MapLayout.tsx state

const [pinMode, setPinMode] = useState(false);
const [pinnedAddresses, setPinnedAddresses] = useState<Property[]>([]);

// Add click handler for pin mode
const handleMapClick = (e: L.LeafletMouseEvent) => {
  if (!pinMode) return;

  const { lat, lng } = e.latlng;

  // Reverse geocode or just store coordinates
  const newPin: Property = {
    id: `pin_${Date.now()}`,
    addressFull: `Pinned Location ${pinnedAddresses.length + 1}`,
    latitude: lat,
    longitude: lng,
    status: 'PENDING_SCRAPE',
    customerName: '',
    customerPhone: '',
    // ... other required fields
  };

  setPinnedAddresses([...pinnedAddresses, newPin]);
};

// Toggle pin mode
const togglePinMode = () => {
  setPinMode(!pinMode);
  // Update map cursor
  if (!pinMode) {
    map.getContainer().style.cursor = '';
  } else {
    map.getContainer().style.cursor = 'crosshair';
  }
};
```

**Step 2: Add UI button**

```typescript
// Add to MapLayout JSX, near other drawing buttons

<button
  onClick={togglePinMode}
  className={`p-2 rounded ${pinMode ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
  title="Add pins by clicking on map"
>
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 00-2.827 0l-4.244-4.243a8 8 0 111.414 1.414l-1.414 1.414-1.414-1.414a8 8 0 01-11.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
</button>

{pinnedAddresses.length > 0 && (
  <button
    onClick={() => {
      setSelectedProperties(pinnedAddresses);
      setPinMode(false);
    }}
    className="p-2 bg-green-600 text-white rounded"
    title={`Use ${pinnedAddresses.length} pinned addresses`}
  >
    Use {pinnedAddresses.length} Pinned
  </button>
)}
```

**Step 3: Commit**

```bash
git add packages/webapp/src/components/MapLayout.tsx
git commit -m "feat(webapp): Add manual pin selection mode to map"
```

---

## Task 12: Create Route Processor Component with Progress

**Files:**
- Create: `packages/webapp/src/components/RouteProcessor.tsx`

**Step 1: Create route processor component**

```typescript
// packages/webapp/src/components/RouteProcessor.tsx

import React, { useState, useEffect } from 'react';
import type { Property } from '../types';

interface RouteProcessorProps {
  properties: Property[];
  selectedProperties: Property[];
  onProcessingComplete: (results: any[]) => void;
  onPropertiesUpdated: () => void;
}

export const RouteProcessor: React.FC<RouteProcessorProps> = ({
  properties,
  selectedProperties,
  onProcessingComplete,
  onPropertiesUpdated,
}) => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    message: ''
  });
  const [results, setResults] = useState<any[]>([]);

  const propertiesToProcess = selectedProperties.length > 0
    ? selectedProperties
    : properties;

  const handleProcess = async () => {
    if (propertiesToProcess.length === 0) {
      alert('No properties to process');
      return;
    }

    try {
      setProcessing(true);
      setProgress({
        current: 0,
        total: propertiesToProcess.length,
        percent: 0,
        message: 'Starting...'
      });

      // Convert properties to route addresses
      const addresses = propertiesToProcess.map(prop => {
        const parts = prop.addressFull?.split(',') || [];
        const streetPart = parts[0]?.trim() || '';
        const zipPart = parts[parts.length - 1]?.trim() || prop.zipCode || '';

        const streetParts = streetPart.split(/\s+/);
        const number = streetParts[0] || '';
        const street = streetParts.slice(1).join(' ');

        return {
          number,
          street,
          city: parts[1]?.trim() || '',
          state: 'CA',
          zip: zipPart,
          full: prop.addressFull || ''
        };
      });

      // Send to extension
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
        onPropertiesUpdated(); // Refresh to show extracted data
      }

    } catch (error) {
      console.error('Processing failed:', error);
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  // Listen for progress updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === 'ROUTE_PROGRESS') {
        setProgress(message.update);
      } else if (message.action === 'ROUTE_COMPLETE') {
        setResults(message.results);
        setProcessing(false);
        onProcessingComplete(message.results);
        onPropertiesUpdated();
      } else if (message.action === 'ROUTE_ERROR') {
        setProcessing(false);
        alert(`Error: ${message.error}`);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [onProcessingComplete, onPropertiesUpdated]);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-green-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <svg className="w-6 h-6 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Extract Customer Data from SCE
      </h2>

      <div className="space-y-4">
        {/* Property count */}
        <div className="text-sm text-gray-600">
          {propertiesToProcess.length} propert{propertiesToProcess.length !== 1 ? 'ies' : 'y'} to process
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="space-y-2 bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{progress.message}</span>
              <span className="font-bold text-blue-600">{progress.percent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
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
                Complete! {successful} successful, {failed} failed
              </span>
            </div>
            {failed > 0 && (
              <div className="text-sm text-red-600 mt-1">
                {failed} addresses could not be processed
              </div>
            )}
          </div>
        )}

        {/* Extract button */}
        <div className="flex justify-end">
          <button
            onClick={handleProcess}
            disabled={processing || propertiesToProcess.length === 0}
            className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v1.828c0 .728-.029 1.417-.217 1.828l1.965-1.965a1.023 1.023 0 00-.978-.547l-1.415-1.415a1 1 0 00-.547-.978l1.965-1.965c.351-.351.921-.217 1.828H13a2 2 0 002 2v6a2 2 0 002-2v-5.968a1.023 1.023 0 00-.978-.547l-1.415-1.415a1 1 0 00-.547-.978V6a2 2 0 002-2V2.5a2 2 0 002 2h6a2 2 0 002-2v-6a2 2 0 00-2-2V2.5a2 2 0 002-2z" />
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

**Step 2: Commit**

```bash
git add packages/webapp/src/components/RouteProcessor.tsx
git commit -m "feat(webapp): Add route processor component with progress tracking"
```

---

## Task 13: Remove Test Data from PDF Generator

**Files:**
- Modify: `packages/webapp/src/lib/pdf-generator.ts`

**Step 1: Remove TEST_CUSTOMERS and enrichWithTestData**

```typescript
// packages/webapp/src/lib/pdf-generator.ts

// DELETE these sections:
// - const TEST_CUSTOMERS = [...]
// - function enrichWithTestData(...)
// - enrichedProperties variable
// - usesTestData variable

// Replace with direct use of properties
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

  // Group into pages - NO MORE TEST DATA
  const pages = groupIntoPages(optimizedProperties);

  // Check for missing customer data
  const hasMissingCustomerData = optimizedProperties.some(
    prop => !prop.customerName || !prop.customerPhone
  );

  // ... rest of PDF generation code ...
```

**Step 2: Commit**

```bash
git add packages/webapp/src/lib/pdf-generator.ts
git commit -m "fix(pdf): Remove test data, use only real customer data"
```

---

## Task 14: Add Address Selection Manager Component

**Files:**
- Create: `packages/webapp/src/components/AddressSelectionManager.tsx`

**Step 1: Create unified address selection manager**

```typescript
// packages/webapp/src/components/AddressSelectionManager.tsx

import React, { useState } from 'react';
import { AddressRangeInput } from './AddressRangeInput';
import { AddressImport } from './AddressImport';
import type { Property } from '../types';

interface AddressSelectionManagerProps {
  properties: Property[];
  setProperties: (properties: Property[]) => void;
  selectedProperties: Property[];
  setSelectedProperties: (properties: Property[]) => void;
}

type SelectionMethod = 'draw' | 'range' | 'import' | 'pins' | 'database';

export const AddressSelectionManager: React.FC<AddressSelectionManagerProps> = ({
  properties,
  setProperties,
  selectedProperties,
  setSelectedProperties,
}) => {
  const [activeMethod, setActiveMethod] = useState<SelectionMethod | null>(null);

  const handleAddressesFromRange = (addresses: string[]) => {
    const newProps: Property[] = addresses.map((addr, index) => ({
      id: `range_${Date.now()}_${index}`,
      addressFull: addr,
      status: 'PENDING_SCRAPE',
      latitude: null,
      longitude: null,
      customerName: null,
      customerPhone: null,
    }));

    setProperties([...properties, ...newProps]);
    setSelectedProperties(newProps);
  };

  const handleAddressesFromImport = (addresses: string[]) => {
    const newProps: Property[] = addresses.map((addr, index) => ({
      id: `import_${Date.now()}_${index}`,
      addressFull: addr,
      status: 'PENDING_SCRAPE',
      latitude: null,
      longitude: null,
      customerName: null,
      customerPhone: null,
    }));

    setProperties([...properties, ...newProps]);
    setSelectedProperties(newProps);
  };

  const handlePinsFromDatabase = (dbProperties: Property[]) => {
    setSelectedProperties(dbProperties);
    setActiveMethod(null);
  };

  return (
    <div className="space-y-6">
      {/* Selection method tabs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Add Addresses to Route
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => setActiveMethod('draw')}
            className={`p-4 rounded-lg border-2 text-center ${
              activeMethod === 'draw'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">✏️</div>
            <div className="text-sm font-medium">Draw on Map</div>
            <div className="text-xs text-gray-500">Draw shapes</div>
          </button>

          <button
            onClick={() => setActiveMethod('range')}
            className={`p-4 rounded-lg border-2 text-center ${
              activeMethod === 'range'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">🔢</div>
            <div className="text-sm font-medium">Address Range</div>
            <div className="text-xs text-gray-500">100-200 Main St</div>
          </button>

          <button
            onClick={() => setActiveMethod('pins')}
            className={`p-4 rounded-lg border-2 text-center ${
              activeMethod === 'pins'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">📍</div>
            <div className="text-sm font-medium">Pin Addresses</div>
            <div className="text-xs text-gray-500">Click on map</div>
          </button>

          <button
            onClick={() => setActiveMethod('import')}
            className={`p-4 rounded-lg border-2 text-center ${
              activeMethod === 'import'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm font-medium">Import List</div>
            <div className="text-xs text-gray-500">Paste addresses</div>
          </button>

          <button
            onClick={() => setActiveMethod('database')}
            className={`p-4 rounded-lg border-2 text-center ${
              activeMethod === 'database'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">🗄️</div>
            <div className="text-sm font-medium">From Database</div>
            <div className="text-xs text-gray-500">Select existing</div>
          </button>
        </div>

        {/* Clear selection */}
        {activeMethod && (
          <button
            onClick={() => setActiveMethod(null)}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to selection methods
          </button>
        )}
      </div>

      {/* Active method content */}
      {activeMethod === 'range' && (
        <AddressRangeInput onAddressesExtracted={handleAddressesFromRange} />
      )}

      {activeMethod === 'import' && (
        <AddressImport onAddressesImported={handleAddressesFromImport} />
      )}

      {activeMethod === 'database' && (
        <DatabasePropertySelector
          properties={properties}
          onSelect={handlePinsFromDatabase}
        />
      )}

      {/* Selected count */}
      {selectedProperties.length > 0 && !activeMethod && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex justify-between items-center">
          <span className="text-blue-800">
            {selectedProperties.length} addresses selected
          </span>
          <button
            onClick={() => setSelectedProperties([])}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

// Database property selector component
function DatabasePropertySelector({
  properties,
  onSelect
}: {
  properties: Property[];
  onSelect: (props: Property[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = properties.filter(prop =>
    prop.addressFull?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prop.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-md font-semibold mb-4">Select from Database</h3>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search addresses..."
        className="block w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
      />

      <div className="max-h-64 overflow-y-auto space-y-2">
        {filtered.slice(0, 50).map(prop => (
          <div
            key={prop.id}
            className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
            onClick={() => onSelect([prop])}
          >
            <div className="font-medium">{prop.addressFull}</div>
            {prop.customerName && (
              <div className="text-sm text-gray-600">{prop.customerName}</div>
            )}
            <div className="text-xs text-gray-500">Status: {prop.status}</div>
          </div>
        ))}
      </div>

      {filtered.length > 50 && (
        <div className="text-sm text-gray-500 mt-2">
          Showing 50 of {filtered.length} results
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/webapp/src/components/AddressSelectionManager.tsx
git commit -m "feat(webapp): Add unified address selection manager component"
```

---

## Task 15: Update MapLayout with All Selection Methods

**Files:**
- Modify: `packages/webapp/src/components/MapLayout.tsx`

**Step 1: Integrate all selection methods**

```typescript
// Add to MapLayout.tsx imports
import { AddressSelectionManager } from './AddressSelectionManager';
import { RouteProcessor } from './RouteProcessor';
import { PDFGenerator } from './PDFGenerator';

// Add state for pin mode
const [pinMode, setPinMode] = useState(false);
const [pinnedAddresses, setPinnedAddresses] = useState<Property[]>([]);

// Add to map click handler
const handleMapClick = (e: L.LeafletMouseEvent) => {
  if (pinMode) {
    // Create pinned property
    const newPin: Property = {
      id: `pin_${Date.now()}`,
      addressFull: `Pinned at ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`,
      latitude: e.latlng.lat,
      longitude: e.latlng.lng,
      status: 'PENDING_SCRAPE',
      customerName: null,
      customerPhone: null,
      zipCode: '',
    };
    setPinnedAddresses([...pinnedAddresses, newPin]);
  }
};

// Update setSelectedProperties to handle pinned addresses
const handleSelectFromPins = () => {
  setSelectedProperties(pinnedAddresses);
  setPinMode(false);
};
```

**Step 2: Update JSX to include new components**

```typescript
// Add to MapLayout JSX, inside the main container

<AddressSelectionManager
  properties={properties}
  setProperties={setProperties}
  selectedProperties={selectedProperties}
  setSelectedProperties={setSelectedProperties}
/>

<RouteProcessor
  properties={properties}
  selectedProperties={selectedProperties}
  onProcessingComplete={(results) => {
    console.log('Processing complete:', results);
    fetchProperties(); // Refresh to show extracted data
  }}
  onPropertiesUpdated={fetchProperties}
/>

{selectedProperties.length > 0 && (
  <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
    <div className="font-semibold mb-2">{selectedProperties.length} addresses selected</div>
    <div className="flex gap-2">
      <button
        onClick={() => {
          // Open PDF generator dialog
        }}
        className="px-3 py-1 bg-blue-600 text-white rounded"
      >
        Generate PDF
      </button>
      <button
        onClick={() => {
          setSelectedProperties([]);
        }}
        className="px-3 py-1 bg-gray-200 rounded"
      >
        Clear
      </button>
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add packages/webapp/src/components/MapLayout.tsx
git commit -m "feat(webapp): Integrate all address selection methods into map"
```

---

## Task 16: Update Property Type for New Fields

**Files:**
- Modify: `packages/webapp/src/types/index.ts`

**Step 1: Add extraction fields to Property type**

```typescript
// packages/webapp/src/types/index.ts

export interface Property {
  id: string;
  addressFull: string;
  zipCode?: string;
  latitude: number | null;
  longitude: number | null;

  // Customer data from SCE extraction
  customerName?: string | null;
  customerPhone?: string | null;

  // Extraction metadata
  dataExtracted?: boolean;
  extractedAt?: string;
  screenshotUrl?: string;

  // Status
  status: PropertyStatus;

  // ... other fields
}
```

**Step 2: Commit**

```bash
git add packages/webapp/src/types/index.ts
git commit -m "feat(webapp): Add customer extraction fields to Property type"
```

---

## Task 17: Build and Test

**Files:**
- None (testing phase)

**Step 1: Build all packages**

```bash
cd packages/cloud-server && npm run build
cd ../extension && npm run build
cd ../webapp && npm run build
cd ../mobile-web && npm run build
```

**Step 2: Run tests**

```bash
cd packages/cloud-server && npm test
```

**Step 3: Test address range input manually**

1. Open webapp
2. Click "Address Range"
3. Enter: "W Martha Ln", "90706", "1900", "1920"
4. Click "Generate Addresses"
5. Verify 21 addresses are selected

**Step 4: Test import manually**

1. Click "Import List"
2. Paste addresses (one per line)
3. Click "Import"
4. Verify addresses are selected

**Step 5: Test pin mode manually**

1. Click "Pin Addresses"
2. Click on 3 locations on map
3. Click "Use X Pinned"
4. Verify pins are selected

**Step 6: Commit**

```bash
git add -A
git commit -m "test: Build and verify all packages compile successfully"
```

---

## Summary

This plan implements the complete workflow:

**Address Selection:**
- ✅ Draw shapes on map (already exists)
- ✅ Address range input (100-200 Main St)
- ✅ Manual pin selection (click to add pins)
- ✅ Import list (paste or upload file)
- ✅ Select from database

**Data Extraction:**
- ✅ "Extract Customer Data" button
- ✅ Concurrent SCE tab processing (3 tabs at once)
- ✅ Fill address → Click Search → Click Income
- ✅ Extract customer name and phone
- ✅ Screenshot capture
- ✅ Progress tracking
- ✅ Save to database

**PDF Generation:**
- ✅ Uses REAL customer data
- ✅ 3x3 grid with QR codes
- ✅ Optimal route ordering

**Mobile & Extension:**
- ✅ QR scan to access property
- ✅ Photo upload
- ✅ Extension auto-fill (enhance existing)

**All 17 tasks ready for execution.**
