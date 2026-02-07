/**
 * Section Test Fixtures for SCE2 E2E Tests
 *
 * Provides Playwright test fixtures for SCE website form section testing.
 * Includes helpers for navigation and Angular Material form field interaction.
 */

import { test as base, Page, Locator } from '@playwright/test';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

/**
 * SCE page fixture - a page navigated to the SCE website
 */
export interface SCEPageFixture {
  scePage: Page;
}

/**
 * Form field test fixture with field finding helpers
 */
export interface FormFieldFixture extends SCEPageFixture {
  findFieldByLabel: {
    findByLabel: (labelText: string) => Promise<Locator>;
    findByLabelExact: (labelText: string) => Promise<Locator>;
    findInputByLabel: (labelText: string) => Promise<Locator | null>;
    findSelectByLabel: (labelText: string) => Promise<Locator | null>;
  };
}

// ==========================================
// SCE PAGE FIXTURE
// ==========================================

/**
 * Base fixture that navigates to SCE website and waits for page load
 */
export const sectionTest = base.extend<SCEPageFixture>({
  scePage: async ({ page }, use) => {
    // Navigate to SCE website
    await page.goto('https://sce.dsmcentral.com/');

    // Wait for Angular app to fully load
    await page.waitForLoadState('networkidle');

    // Wait for Angular Material components to be ready
    // Check for common SCE form elements
    try {
      await page.waitForSelector('mat-form-field', { timeout: 5000 });
    } catch {
      // Form may not be visible on initial page load (e.g., login screen)
      // This is acceptable, continue anyway
    }

    await use(page);
  },
});

// ==========================================
// FORM FIELD FIXTURE
// ==========================================

/**
 * Extended fixture with helpers to find form fields by mat-label
 *
 * This fixture provides methods to locate Angular Material form fields
 * by their label text, which is the primary way to identify fields in SCE forms.
 */
export const formFieldTest = sectionTest.extend<FormFieldFixture>({
  findFieldByLabel: async ({ scePage }, use) => {
    /**
     * Find any form field by its mat-label text
     * Uses partial matching for flexibility
     *
     * @param labelText - The label text to search for
     * @returns Locator for the form field input
     */
    const findByLabel = async (labelText: string): Promise<Locator> => {
      // First find the mat-label element containing the text
      const labelLocator = scePage.locator(`mat-label`).filter({
        hasText: labelText,
      }).first();

      // Get the closest mat-form-field parent
      const formField = labelLocator.locator('..').locator('xpath=ancestor::mat-form-field[1]');

      // Find the input element within the form field
      // Try multiple selectors for different input types
      const input = formField.locator('input.mat-input-element, input.mat-input, input').first();

      return input;
    };

    /**
     * Find form field by exact mat-label text match
     * Use when labels are similar and partial matching isn't sufficient
     *
     * @param labelText - The exact label text to match
     * @returns Locator for the form field input
     */
    const findByLabelExact = async (labelText: string): Promise<Locator> => {
      const labelLocator = scePage.locator(`mat-label`).filter({
        hasText: new RegExp(`^${labelText}$`),
      }).first();

      const formField = labelLocator.locator('..').locator('xpath=ancestor::mat-form-field[1]');
      const input = formField.locator('input.mat-input-element, input.mat-input, input').first();

      return input;
    };

    /**
     * Find input field by label text
     * Returns null if not found, instead of throwing
     *
     * @param labelText - The label text to search for
     * @returns Locator for the input or null
     */
    const findInputByLabel = async (labelText: string): Promise<Locator | null> => {
      try {
        const labelLocator = scePage.locator(`mat-label`).filter({
          hasText: labelText,
        }).first();

        const formField = labelLocator.locator('..').locator('xpath=ancestor::mat-form-field[1]');
        const input = formField.locator('input.mat-input-element, input.mat-input, input').first();

        // Check if element exists
        const count = await input.count();
        return count > 0 ? input : null;
      } catch {
        return null;
      }
    };

    /**
     * Find select dropdown by label text
     * Returns null if not found
     *
     * @param labelText - The label text to search for
     * @returns Locator for the mat-select or null
     */
    const findSelectByLabel = async (labelText: string): Promise<Locator | null> => {
      try {
        const labelLocator = scePage.locator(`mat-label`).filter({
          hasText: labelText,
        }).first();

        const formField = labelLocator.locator('..').locator('xpath=ancestor::mat-form-field[1]');
        const select = formField.locator('mat-select').first();

        const count = await select.count();
        return count > 0 ? select : null;
      } catch {
        return null;
      }
    };

    await use({
      findByLabel,
      findByLabelExact,
      findInputByLabel,
      findSelectByLabel,
    });
  },
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Wait for Angular Material form field to be ready for interaction
 *
 * @param page - Playwright Page object
 * @param labelText - Label of the field to wait for
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForFieldReady(
  page: Page,
  labelText: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(
    `mat-label:has-text("${labelText}")`,
    { timeout }
  );

  // Additional wait for Angular to finish rendering
  await page.waitForTimeout(200);
}

/**
 * Get all visible field labels on current page
 * Useful for debugging and discovering available fields
 *
 * @param page - Playwright Page object
 * @returns Array of label text strings
 */
export async function getVisibleFieldLabels(page: Page): Promise<string[]> {
  const labels = await page.locator('mat-label').allTextContents();
  return labels.map(l => l.trim()).filter(Boolean);
}

/**
 * Check if a field with given label exists on the page
 *
 * @param page - Playwright Page object
 * @param labelText - Label text to search for
 * @returns True if field exists, false otherwise
 */
export async function fieldExists(page: Page, labelText: string): Promise<boolean> {
  const count = await page.locator(`mat-label:has-text("${labelText}")`).count();
  return count > 0;
}

// ==========================================
// EXPORTS
// ==========================================

export { test as baseTest } from '@playwright/test';
export { expect } from '@playwright/test';
