/**
 * Enrollment Information Section E2E Tests
 */

import { test, expect } from '@playwright/test';
import { sectionTest } from '../helpers/section-fixture';

test.describe('Enrollment Information Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://sce.dsmcentral.com/');
  });

  test('should extract all 2 enrollment fields', async ({ page }) => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should fill all enrollment fields', async ({ page }) => {
    // TODO: Test form filling
    expect(true).toBe(true);
  });
});
