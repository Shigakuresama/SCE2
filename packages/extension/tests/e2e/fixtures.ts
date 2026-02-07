import { test as base, Page, chromium, BrowserContext } from '@playwright/test';

/**
 * Extension test fixtures
 *
 * Provides custom fixtures for Chrome Extension testing:
 * - extensionId: The ID of the loaded extension
 * - extensionPage: The extension's background/service worker page
 * - popupPage: The extension's popup page
 */
export interface ExtensionTestFixtures {
  extensionId: string;
  extensionPage: Page;
  popupPage: Page;
}

/**
 * Extended test object with extension fixtures
 */
export const test = base.extend<ExtensionTestFixtures>({
  extensionId: async ({ context }, use) => {
    // Wait for extension to be loaded
    await context.waitForEvent('service_worker', { predicate: (worker) => worker.url().startsWith('chrome-extension://') });

    // Get all extension pages
    const pages = context.pages();
    const extensionPage = pages[0];

    // Extract extension ID from URL
    const url = extensionPage.url();
    const match = url.match(/chrome-extension:\/\/([a-z]+)/);
    const id = match ? match[1] : '';

    await use(id);
  },

  extensionPage: async ({ context }, use) => {
    // Get or wait for the service worker (background script)
    const [background] = context.serviceWorkers();
    if (background) {
      const page = await context.newPage();
      // Navigate to the service worker's page for debugging
      await page.goto(background.url());
      await use(page);
      await page.close();
    } else {
      throw new Error('Extension background script not found');
    }
  },

  popupPage: async ({ extensionId, context }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(page);
    await page.close();
  },
});

/**
 * Helper to get extension page by name
 */
export async function getExtensionPage(context: BrowserContext, pageName: string): Promise<Page> {
  const pages = context.pages();
  return pages.find((p) => p.url().includes(pageName)) || (await context.newPage());
}

/**
 * Helper to wait for extension to be ready
 */
export async function waitForExtensionReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // You can add more specific checks here, like waiting for specific elements
}

/**
 * Helper to extract extension ID from context
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  const pages = context.pages();
  const url = pages[0]?.url() || '';
  const match = url.match(/chrome-extension:\/\/([a-z]+)/);
  return match ? match[1] : '';
}

export { expect } from '@playwright/test';
