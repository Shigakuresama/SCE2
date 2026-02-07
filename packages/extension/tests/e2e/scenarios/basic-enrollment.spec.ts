/**
 * Basic Enrollment Section E2E Tests
 */

import { test, expect } from '@playwright/test';
import { sectionTest } from '../helpers/section-fixture';

test.describe('Basic Enrollment Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://sce.dsmcentral.com/');
  });

  test('should extract all 2 basic enrollment fields', async ({ page }) => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should fill all basic enrollment fields', async ({ page }) => {
    // TODO: Test form filling
    expect(true).toBe(true);
  });
});
