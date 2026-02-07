import { test, expect } from '../fixtures';

/**
 * Basic extension loading test
 *
 * Verifies that the extension loads correctly in Chrome
 */
test.describe('Extension Loading', () => {
  test('should load extension with valid ID', async ({ extensionId }) => {
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test('should have background script running', async ({ extensionPage }) => {
    const title = await extensionPage.title();
    expect(title).toBeTruthy();
  });

  test('should access popup page', async ({ popupPage }) => {
    await expect(popupPage).toHaveTitle(/SCE2|Extension|Popup/);
  });
});
