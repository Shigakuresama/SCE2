// packages/extension/src/lib/route-processor.ts

/**
 * SCE Route Processor
 *
 * Processes addresses through the SCE rebate website to extract
 * customer names and phone numbers.
 *
 * Workflow for each address:
 * 1. Open SCE form in new tab
 * 2. Fill in Street Address and ZIP Code
 * 3. Click Search button
 * 4. Click Income button (reveals customer info)
 * 5. Extract customer name and phone
 * 6. Take screenshot for documentation
 * 7. Close tab
 */

import type { RouteAddress, RouteProcessResult, RouteConfig, BatchProgress } from './route-processor-types.js';
import { DEFAULT_ROUTE_CONFIG } from './route-processor-types.js';
import * as Utils from './route-processor-utils.js';

const { sleep, openTab, closeTab, captureScreenshot, sendToContentScript } = Utils;

/**
 * Process a single address through SCE website
 *
 * Opens tab → fills form → extracts data → takes screenshot → closes tab
 *
 * @param address - Address to process
 * @param config - Processing configuration options
 * @param progressCallback - Optional progress callback
 * @returns Promise resolving to processing result
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

      // 1. Open SCE form in new tab
      console.log('[Route] Opening SCE form for:', address.full);
      tabId = await openTab(finalConfig.sceFormUrl);

      if (!tabId) {
        throw new Error('Failed to open tab');
      }

      // 2. Wait for page to load
      await sleep(finalConfig.tabOpenDelay);

      // 3. Send fill command to content script
      const fillMessage = {
        action: 'fillRouteAddress',
        address: {
          streetNumber: address.number,
          streetName: address.street,
          zipCode: address.zip
        }
      };

      console.log('[Route] Sending fill command...');
      const fillResult = await sendToContentScript(tabId, fillMessage, 30000);

      if (!fillResult || !fillResult.success) {
        throw new Error(fillResult?.error || 'Failed to fill form');
      }

      console.log('[Route] ✓ Form filled');

      // 4. Wait for search and data load
      await sleep(finalConfig.captureDelay);

      // 5. Capture customer data
      console.log('[Route] Capturing customer data...');
      const captureResult = await sendToContentScript(tabId, {
        action: 'captureRouteData'
      }, 30000);

      if (!captureResult || !captureResult.success) {
        throw new Error(captureResult?.error || 'Failed to capture data');
      }

      console.log('[Route] ✓ Data captured:', captureResult.data);

      // 6. Screenshot (optional, for documentation)
      let screenshotDataUrl: string | undefined;
      try {
        await sleep(finalConfig.screenshotDelay);
        screenshotDataUrl = await captureScreenshot(tabId);
        console.log('[Route] ✓ Screenshot captured');
      } catch (screenshotError) {
        console.warn('[Route] ⚠️ Screenshot failed:', screenshotError);
        // Non-fatal, continue
      }

      // 7. Close tab
      await closeTab(tabId);
      tabId = null;
      console.log('[Route] ✓ Tab closed');

      // 8. Return success result
      const result: RouteProcessResult = {
        success: true,
        address: address.full,
        customerName: captureResult.data?.customerName,
        customerPhone: captureResult.data?.customerPhone,
        screenshot: screenshotDataUrl,
        timestamp: new Date().toISOString()
      };

      if (progressCallback) {
        progressCallback({
          type: 'complete',
          batchId: '',
          current: 1,
          total: 1,
          percent: 100,
          message: `✓ Complete: ${address.full}`,
          result
        });
      }

      return result;

    } catch (error) {
      attempt++;

      console.error(`[Route] Attempt ${attempt} failed:`, error);

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
            message: `Retrying (${attempt}/${finalConfig.retryAttempts}): ${error instanceof Error ? error.message : String(error)}`
          });
        }

        console.log(`[Route] Retrying in ${finalConfig.retryDelay}ms...`);
        await sleep(finalConfig.retryDelay);
      } else {
        // Final attempt failed
        const errorResult: RouteProcessResult = {
          success: false,
          address: address.full,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        };

        if (progressCallback) {
          progressCallback({
            type: 'error',
            batchId: '',
            current: 0,
            total: 1,
            percent: 0,
            message: `❌ Failed: ${address.full} - ${errorResult.error}`
          });
        }

        return errorResult;
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

/**
 * Process multiple addresses with concurrency control
 *
 * Opens up to maxConcurrentTabs at once, processing in chunks.
 * Shows progress updates during processing.
 *
 * @param addresses - Array of RouteAddress objects to process
 * @param config - Processing configuration options
 * @param progressCallback - Optional progress callback
 * @returns Promise resolving to batch ID and results
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
    throw new Error(`Batch size exceeds maximum of ${finalConfig.maxBatchSize} addresses`);
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

  console.log(`[Route] Starting batch ${batchId} with ${addresses.length} addresses`);

  try {
    const maxConcurrent = finalConfig.maxConcurrentTabs;
    let index = 0;

    // Process in chunks (concurrent tabs)
    while (index < addresses.length) {
      const chunk = addresses.slice(index, index + maxConcurrent);
      index += chunk.length;

      console.log(`[Route] Processing chunk: ${index - chunk.length + 1}-${index} (${chunk.length} addresses)`);

      // Process chunk in parallel
      const chunkPromises = chunk.map(async (address, chunkIndex) => {
        const globalIndex = index - chunk.length + chunkIndex;

        try {
          const result = await processRouteAddress(address, finalConfig, (update) => {
            // Update counters based on result
            if (update.type === 'complete' || (update.result && update.result.success)) {
              successful++;
            } else if (update.type === 'error' || (update.result && !update.result.success)) {
              failed++;
            }
            processed++;

            // Forward progress with batch info
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
          console.error(`[Route] Error processing ${address.full}:`, error);
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

      console.log(`[Route] Chunk complete. Processed: ${chunkResults.length}, Successful: ${chunkResults.filter(r => r.success).length}`);

      // Delay between chunks (don't overwhelm SCE)
      if (index < addresses.length) {
        await sleep(finalConfig.tabOpenDelay);
      }
    }

    // Final summary
    console.log(`[Route] Batch ${batchId} complete. Total: ${results.length}, Successful: ${successful}, Failed: ${failed}`);

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
    console.error(`[Route] Batch ${batchId} error:`, error);

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

// Export types and utilities
export * from './route-processor-types.js';
export * as Utils from './route-processor-utils.js';
