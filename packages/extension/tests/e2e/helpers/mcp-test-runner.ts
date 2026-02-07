/**
 * MCP Test Runner
 * Integrates Playwright with chrome-devtools MCP for extension testing
 *
 * This file provides utilities to test the loaded extension using
 * chrome-devtools MCP tools for inspection and interaction.
 */

import { chromium, Page, Browser, BrowserContext } from '@playwright/test';

export interface ExtensionTestContext {
  browser: Browser;
  context: BrowserContext;
  extensionPage: Page;
  contentPages: Map<string, Page>;
  extensionId: string;
}

/**
 * Setup extension testing context
 */
export async function setupExtensionTest(): Promise<ExtensionTestContext> {
  const browser = await chromium.launch({
    headless: false, // Required for extension testing
    channel: 'chrome',
    args: [
      `--disable-extensions-except=./dist`,
      `--load-extension=./dist`,
    ],
  });

  // Get extension background page
  const context = browser.contexts()[0];
  const backgroundPages = context.backgroundPages();

  if (backgroundPages.length === 0) {
    // Wait for background page to be ready
    await context.waitForEvent('backgroundpage');
  }

  const extensionPage = backgroundPages[0] || await context.waitForEvent('backgroundpage');

  // Get extension ID from URL
  const extensionId = extensionPage.url().match(/\/extensions\/(.+?)\//)?.[1] || '';

  return {
    browser,
    context,
    extensionPage,
    contentPages: new Map(),
    extensionId,
  };
}

/**
 * Navigate to SCE website and get content page
 */
export async function getSCEContentPage(
  testContext: ExtensionTestContext,
  url: string = 'https://sce.dsmcentral.com/'
): Promise<Page> {
  // Check if we already have a page for this URL
  if (testContext.contentPages.has(url)) {
    return testContext.contentPages.get(url)!;
  }

  const page = await testContext.context.newPage();
  await page.goto(url);

  // Wait for content script to be loaded
  await page.waitForFunction(() => {
    return typeof (window as any).chrome !== 'undefined' &&
           (window as any).chrome.runtime;
  }, { timeout: 10000 });

  testContext.contentPages.set(url, page);
  return page;
}

/**
 * Send message to extension content script
 */
export async function sendContentScriptMessage(
  page: Page,
  action: string,
  data?: any
): Promise<any> {
  return await page.evaluate(async ({ action, data }) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action, data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
  }, { action, data });
}

/**
 * Get current section from content script
 */
export async function getCurrentSection(page: Page): Promise<string | null> {
  const response = await sendContentScriptMessage(page, 'GET_CURRENT_SECTION');
  return response?.section || null;
}

/**
 * Scrape property data
 */
export async function scrapeProperty(
  page: Page,
  addressData: {
    propertyId: number;
    streetNumber: string;
    streetName: string;
    zipCode: string;
  }
): Promise<any> {
  const response = await sendContentScriptMessage(page, 'SCRAPE_PROPERTY', addressData);
  return response;
}

/**
 * Submit application
 */
export async function submitApplication(
  page: Page,
  submitData: {
    id: number;
    streetNumber: string;
    streetName: string;
    zipCode: string;
    customerName: string;
    customerPhone: string;
    customerAge?: number;
    fieldNotes?: string;
    documents: Array<{
      url: string;
      name: string;
      type: string;
    }>;
  }
): Promise<any> {
  const response = await sendContentScriptMessage(page, 'SUBMIT_APPLICATION', submitData);
  return response;
}

/**
 * Get extension logs from background page
 */
export async function getExtensionLogs(extensionPage: Page): Promise<string[]> {
  return await extensionPage.evaluate(() => {
    // Assuming logs are stored in console
    // In production, you'd want a proper logging system
    return (window as any).extensionLogs || [];
  });
}

/**
 * Clear extension state
 */
export async function clearExtensionState(context: BrowserContext): Promise<void> {
  // Clear chrome.storage
  await context.clearPermissions();

  // Reload extension
  // Note: This may require additional setup
}

/**
 * Take screenshot of page with section info overlay
 */
export async function captureSectionSnapshot(
  page: Page,
  outputPath: string
): Promise<void> {
  // Get current section
  const section = await getCurrentSection(page);

  // Add overlay with section info
  await page.evaluate((section) => {
    const overlay = document.createElement('div');
    overlay.id = 'test-section-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      z-index: 999999;
    `;
    overlay.textContent = `Section: ${section || 'Unknown'}`;
    document.body.appendChild(overlay);
  }, section);

  // Take screenshot
  await page.screenshot({ path: outputPath, fullPage: true });

  // Remove overlay
  await page.evaluate(() => {
    const overlay = document.getElementById('test-section-overlay');
    if (overlay) overlay.remove();
  });
}

/**
 * Verify extension is loaded
 */
export async function verifyExtensionLoaded(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    // Check if content script injected its marker
    return document.body.querySelector('[data-sce2-content-script]') !== null;
  });
}

/**
 * Get all form fields in current section
 */
export async function getSectionFields(page: Page): Promise<{
  inputs: Array<{ selector: string; label: string; value: string }>;
  selects: Array<{ selector: string; label: string; value: string }>;
  checkboxes: Array<{ selector: string; label: string; checked: boolean }>;
}> {
  return await page.evaluate(() => {
    const inputs: Array<{ selector: string; label: string; value: string }> = [];
    const selects: Array<{ selector: string; label: string; value: string }> = [];
    const checkboxes: Array<{ selector: string; label: string; checked: boolean }> = [];

    // Find all form fields
    document.querySelectorAll('mat-form-field').forEach((field, i) => {
      const label = field.querySelector('mat-label')?.textContent?.trim() || '';
      const input = field.querySelector('input');
      const select = field.querySelector('mat-select');
      const checkbox = field.querySelector('input[type="checkbox"]');

      const selector = `mat-form-field:nth-of-type(${i + 1})`;

      if (input && input.type !== 'checkbox') {
        inputs.push({ selector, label, value: (input as HTMLInputElement).value });
      } else if (select) {
        const value = select.querySelector('span.mat-select-value-text')?.textContent?.trim() || '';
        selects.push({ selector, label, value });
      } else if (checkbox) {
        checkboxes.push({ selector, label, checked: (checkbox as HTMLInputElement).checked });
      }
    });

    return { inputs, selects, checkboxes };
  });
}

/**
 * Fill form field by label
 */
export async function fillFieldByLabel(
  page: Page,
  labelText: string,
  value: string
): Promise<void> {
  await page.evaluate(async ({ labelText, value }) => {
    const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));
    const label = labels.find(l =>
      l.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())
    );

    if (!label) {
      throw new Error(`Field not found: ${labelText}`);
    }

    const formField = label.closest('mat-form-field');
    const input = formField?.querySelector('input') as HTMLInputElement;
    const select = formField?.querySelector('mat-select') as HTMLElement;

    if (input) {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
    } else if (select) {
      select.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      const options = Array.from(document.querySelectorAll('mat-option'));
      const option = options.find(o =>
        o.textContent?.trim().toLowerCase() === value.toLowerCase()
      );

      if (option) {
        (option as HTMLElement).click();
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      throw new Error(`No input or select found for: ${labelText}`);
    }
  }, { labelText, value });
}

/**
 * Wait for section to be visible
 */
export async function waitForSection(
  page: Page,
  sectionTitle: string,
  timeout = 10000
): Promise<void> {
  await page.waitForFunction((title) => {
    const headers = Array.from(document.querySelectorAll('h2, h3, .section-title'));
    return headers.some(h => h.textContent?.includes(title));
  }, sectionTitle, { timeout });
}

/**
 * Navigate to section by clicking menu item
 */
export async function navigateToSection(
  page: Page,
  sectionTitle: string
): Promise<void> {
  await page.evaluate(async (title) => {
    const menuItems = Array.from(document.querySelectorAll('.sections-menu-item, .section-nav-item'));
    const item = menuItems.find(i => i.textContent?.includes(title));

    if (item) {
      (item as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, sectionTitle);
}

/**
 * Cleanup test context
 */
export async function cleanupExtensionTest(testContext: ExtensionTestContext): Promise<void> {
  await testContext.context.close();
  await testContext.browser.close();
}
