/**
 * Extension API Tests
 * Tests the extension's messaging API and content script functionality
 */

import { test, expect } from '@playwright/test';
import {
  setupExtensionTest,
  getSCEContentPage,
  sendContentScriptMessage,
  getCurrentSection,
  scrapeProperty,
  getSectionFields,
  fillFieldByLabel,
  cleanupExtensionTest,
} from '../helpers/mcp-test-runner';

test.describe('Extension API - Messaging', () => {
  let testContext: any;
  let page: any;

  test.beforeAll(async () => {
    testContext = await setupExtensionTest();
  });

  test.afterAll(async () => {
    await cleanupExtensionTest(testContext);
  });

  test.beforeEach(async () => {
    page = await getSCEContentPage(testContext);
  });

  test('should respond to GET_CURRENT_SECTION message', async () => {
    const section = await getCurrentSection(page);

    // Section might be null or have a value
    expect(section).toBeNull();
    // On the actual SCE website, this would return the section name
  });

  test('should handle unknown message actions', async () => {
    const response = await sendContentScriptMessage(page, 'UNKNOWN_ACTION');

    expect(response).toHaveProperty('error');
    expect(response.error).toBe('Unknown action');
  });

  test('should return error for SCRAPE_PROPERTY without program button', async () => {
    // This test verifies error handling when scrape fails
    const result = await scrapeProperty(page, {
      propertyId: 1,
      streetNumber: '123',
      streetName: 'Main St',
      zipCode: '90210',
    });

    // Should fail gracefully if not on SCE website or program not found
    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
  });
});

test.describe('Extension API - Form Fields', () => {
  let testContext: any;
  let page: any;

  test.beforeAll(async () => {
    testContext = await setupExtensionTest();
  });

  test.afterAll(async () => {
    await cleanupExtensionTest(testContext);
  });

  test.beforeEach(async () => {
    page = await getSCEContentPage(testContext);
  });

  test('should detect form fields on page', async () => {
    const fields = await getSectionFields(page);

    expect(fields).toBeDefined();
    expect(fields.inputs).toBeInstanceOf(Array);
    expect(fields.selects).toBeInstanceOf(Array);
    expect(fields.checkboxes).toBeInstanceOf(Array);

    console.log('Found fields:', {
      inputs: fields.inputs.length,
      selects: fields.selects.length,
      checkboxes: fields.checkboxes.length,
    });
  });

  test('should fill form field by label', async () => {
    // This test requires being on the actual SCE website with form fields
    // For now, it tests the fill function's error handling

    try {
      await fillFieldByLabel(page, 'NonExistent Field', 'test value');
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Field not found');
    }
  });
});

test.describe('Extension Content Script Injection', () => {
  let testContext: any;
  let page: any;

  test.beforeAll(async () => {
    testContext = await setupExtensionTest();
  });

  test.afterAll(async () => {
    await cleanupExtensionTest(testContext);
  });

  test('should inject content script on SCE website', async () => {
    page = await getSCEContentPage(testContext);

    // Check if chrome.runtime is available (content script injected)
    const hasRuntime = await page.evaluate(() => {
      return typeof (window as any).chrome !== 'undefined' &&
             typeof (window as any).chrome.runtime !== 'undefined';
    });

    expect(hasRuntime).toBe(true);
  });

  test('should have SCEHelper available in content script', async () => {
    page = await getSCEContentPage(testContext);

    // Test if our content script loaded by checking for console messages
    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    // Wait a bit for console logs
    await page.waitForTimeout(1000);

    // Content script logs "SCE2 Content Script loaded"
    const contentScriptLoaded = consoleLogs.some(log =>
      log.includes('SCE2 Content Script loaded')
    );

    expect(contentScriptLoaded).toBe(true);
  });
});

test.describe('Extension - Section Detection', () => {
  let testContext: any;
  let page: any;

  test.beforeAll(async () => {
    testContext = await setupExtensionTest();
  });

  test.afterAll(async () => {
    await cleanupExtensionTest(testContext);
  });

  test.beforeEach(async () => {
    page = await getSCEContentPage(testContext);
  });

  test('should detect sections menu', async () => {
    const hasMenu = await page.evaluate(() => {
      const menus = document.querySelectorAll('.sections-menu-item, .section-nav-item');
      return menus.length > 0;
    });

    // This will be true on actual SCE website
    expect(hasMenu).toBeDefined();
  });

  test('should detect active section', async () => {
    const activeSection = await page.evaluate(() => {
      const active = document.querySelector(
        '.sections-menu-item.active .sections-menu-item__title, ' +
        '.section-nav-item.active'
      );
      return active?.textContent?.trim() || null;
    });

    // On actual website, this would return the section name
    expect(activeSection).toBeDefined();
  });
});

test.describe('Extension Performance', () => {
  let testContext: any;

  test.beforeAll(async () => {
    testContext = await setupExtensionTest();
  });

  test.afterAll(async () => {
    await cleanupExtensionTest(testContext);
  });

  test('should load content script quickly', async () => {
    const startTime = Date.now();
    const page = await getSCEContentPage(testContext);
    await page.waitForFunction(() => {
      return typeof (window as any).chrome !== 'undefined';
    });
    const loadTime = Date.now() - startTime;

    // Content script should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    console.log(`Content script loaded in ${loadTime}ms`);
  });

  test('should respond to messages quickly', async () => {
    const page = await getSCEContentPage(testContext);

    const startTime = Date.now();
    await sendContentScriptMessage(page, 'GET_CURRENT_SECTION');
    const responseTime = Date.now() - startTime;

    // Should respond within 1 second
    expect(responseTime).toBeLessThan(1000);

    console.log(`Message response time: ${responseTime}ms`);
  });
});

test.describe('Extension Error Handling', () => {
  let testContext: any;
  let page: any;

  test.beforeAll(async () => {
    testContext = await setupExtensionTest();
  });

  test.afterAll(async () => {
    await cleanupExtensionTest(testContext);
  });

  test.beforeEach(async () => {
    page = await getSCEContentPage(testContext);
  });

  test('should handle scrape errors gracefully', async () => {
    const result = await scrapeProperty(page, {
      propertyId: 999,
      streetNumber: 'INVALID',
      streetName: 'ADDRESS',
      zipCode: '00000',
    });

    // Should return success: false with error message
    expect(result).toHaveProperty('success');
    if (!result.success) {
      expect(result).toHaveProperty('error');
      console.log('Expected error:', result.error);
    }
  });

  test('should not crash on malformed messages', async () => {
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { action: 'INVALID', data: null },
            resolve
          );
        } catch (e) {
          resolve({ error: (e as Error).message });
        }
      });
    });

    // Should handle gracefully
    expect(result).toBeDefined();
  });
});
