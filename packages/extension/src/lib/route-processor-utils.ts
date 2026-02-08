// packages/extension/src/lib/route-processor-utils.ts

/**
 * Route Processor Utilities
 *
 * Helper functions for route processing:
 * - Tab management (open, close)
 * - Screenshot capture
 * - Chrome extension messaging
 * - Address parsing
 */

import type { RouteAddress } from './route-processor-types.js';

/**
 * Sleep/delay utility
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique batch ID
 * @returns Unique batch identifier
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Open a new tab and return its ID
 * @param url - URL to open
 * @returns Promise resolving to tab ID
 */
export async function openTab(url: string): Promise<number> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (tab && tab.id) {
        resolve(tab.id);
      } else {
        resolve(0); // Return 0 if failed
      }
    });
  });
}

/**
 * Close a tab by ID
 * @param tabId - Tab ID to close
 * @returns Promise resolving when closed
 */
export async function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => resolve());
  });
}

/**
 * Capture visible tab as screenshot
 * @param tabId - Tab ID to capture
 * @returns Promise resolving to base64 data URL
 */
export async function captureScreenshot(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: 'png' }, (dataUrl) => {
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
 * @param tabId - Tab ID to send message to
 * @param message - Message object to send
 * @param timeout - Timeout in ms (default 30000)
 * @returns Promise resolving to response
 */
export async function sendToContentScript<T = any>(
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
 * Parse full address into RouteAddress components
 * @param fullAddress - Full address string (e.g., "1909 W Martha Ln, Santa Ana, CA 92706")
 * @param zipCode - ZIP code (fallback if not in address)
 * @returns Parsed RouteAddress object
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

/**
 * Format RouteAddress back to full address string
 * @param address - RouteAddress object
 * @returns Full address string
 */
export function formatAddress(address: RouteAddress): string {
  const parts = [`${address.number} ${address.street}`];
  if (address.city) parts.push(address.city);
  parts.push(address.state);
  parts.push(address.zip);
  return parts.join(', ');
}
