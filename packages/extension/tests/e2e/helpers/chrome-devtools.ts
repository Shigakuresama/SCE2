import { chromium, BrowserContext } from 'playwright';

/**
 * Background state inspection result
 */
export interface BackgroundState {
  queues?: {
    scrape?: unknown[];
    submit?: unknown[];
  };
  processing?: {
    isProcessing?: boolean;
    currentJob?: unknown;
  };
  config?: {
    apiBaseUrl?: string;
    pollInterval?: number;
  };
}

/**
 * Content script console message
 */
export interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: number;
}

/**
 * Helper for chrome-devtools MCP integration
 * Allows inspecting extension pages and background scripts
 *
 * This class provides methods to inspect the extension's background service worker
 * and content scripts for debugging and testing purposes.
 */
export class ExtensionInspector {
  private context: BrowserContext;
  private consoleMessages: ConsoleMessage[] = [];

  constructor(context: BrowserContext) {
    this.context = context;
  }

  /**
   * Get background service worker, evaluate to log queue/processing state
   *
   * @returns Background state with queue and processing information
   * @throws Error if background service worker is not found
   */
  async inspectBackgroundPage(): Promise<BackgroundState> {
    // Get all service workers (background script in MV3)
    const serviceWorkers = this.context.serviceWorkers();
    const workers = await serviceWorkers.all();
    const background = workers[0];

    if (!background) {
      throw new Error('Background service worker not found');
    }

    // Evaluate background state
    const state = await background.evaluate(() => {
      // Access chrome extension storage and runtime
      return new Promise((resolve) => {
        chrome.storage.local.get(
          ['scrapeQueue', 'submitQueue', 'isProcessing', 'currentJob', 'config'],
          (result) => {
            resolve({
              queues: {
                scrape: result.scrapeQueue || [],
                submit: result.submitQueue || [],
              },
              processing: {
                isProcessing: result.isProcessing || false,
                currentJob: result.currentJob || null,
              },
              config: result.config || {},
            });
          }
        );
      });
    }) as BackgroundState;

    // Log state for debugging
    console.log('[ExtensionInspector] Background state:', state);

    return state;
  }

  /**
   * Navigate to URL, capture console logs from content script
   *
   * @param url - URL to navigate to
   * @returns Array of console messages captured
   */
  async inspectContentScript(url: string): Promise<ConsoleMessage[]> {
    this.consoleMessages = [];

    const page = await this.context.newPage();

    // Capture console messages
    page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
      console.log(`[Content Script - ${msg.type()}]`, msg.text());
    });

    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait a bit for any async content script messages
    await page.waitForTimeout(1000);

    return this.consoleMessages;
  }

  /**
   * Get all console messages captured from content script
   *
   * @returns Array of captured console messages
   */
  getConsoleMessages(): ConsoleMessage[] {
    return this.consoleMessages;
  }

  /**
   * Clear captured console messages
   */
  clearConsoleMessages(): void {
    this.consoleMessages = [];
  }

  /**
   * Inject a content script into a page for inspection
   *
   * @param url - URL to navigate to
   * @param scriptPath - Path to the content script to inject
   */
  async injectContentScript(url: string, scriptPath: string): Promise<void> {
    const page = await this.context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    // Add script to page
    await page.addInitScript({ path: scriptPath });

    // Wait for script to initialize
    await page.waitForTimeout(500);
  }

  /**
   * Get all pages (tabs) in the extension context
   *
   * @returns Array of page URLs
   */
  async getExtensionPages(): Promise<string[]> {
    const pages = this.context.pages();
    return pages.map((page) => page.url());
  }

  /**
   * Close all pages except the background service worker
   */
  async closeAllPages(): Promise<void> {
    const pages = this.context.pages();
    for (const page of pages) {
      await page.close();
    }
  }
}

/**
 * Factory function to create an ExtensionInspector with a new browser context
 *
 * @param extensionPath - Path to the extension directory
 * @returns ExtensionInspector instance
 */
export async function createInspector(
  extensionPath: string
): Promise<ExtensionInspector> {
  const browser = await chromium.launch({
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const context = await browser.newContext();

  return new ExtensionInspector(context);
}
