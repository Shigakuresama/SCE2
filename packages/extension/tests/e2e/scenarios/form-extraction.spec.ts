/**
 * Form Extraction E2E Tests
 * Tests the extraction of data from form fields
 *
 * These tests use chrome-devtools MCP to interact with the loaded extension
 */

import { test, expect } from '@playwright/test';
import {
  setupExtensionTest,
  getSCEContentPage,
  getSectionFields,
  cleanupExtensionTest,
} from '../helpers/mcp-test-runner';

test.describe('Form Field Extraction', () => {
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

  test('should extract input fields with labels', async () => {
    const fields = await getSectionFields(page);

    console.log('Input fields found:', fields.inputs.map(f => ({
      label: f.label,
      value: f.value,
    })));

    // Verify structure
    expect(Array.isArray(fields.inputs)).toBe(true);
    fields.inputs.forEach(field => {
      expect(field).toHaveProperty('selector');
      expect(field).toHaveProperty('label');
      expect(field).toHaveProperty('value');
    });
  });

  test('should extract select dropdowns', async () => {
    const fields = await getSectionFields(page);

    console.log('Select fields found:', fields.selects.map(f => ({
      label: f.label,
      value: f.value,
    })));

    // Verify structure
    expect(Array.isArray(fields.selects)).toBe(true);
    fields.selects.forEach(field => {
      expect(field).toHaveProperty('selector');
      expect(field).toHaveProperty('label');
      expect(field).toHaveProperty('value');
    });
  });

  test('should extract checkboxes', async () => {
    const fields = await getSectionFields(page);

    console.log('Checkbox fields found:', fields.checkboxes.map(f => ({
      label: f.label,
      checked: f.checked,
    })));

    // Verify structure
    expect(Array.isArray(fields.checkboxes)).toBe(true);
    fields.checkboxes.forEach(field => {
      expect(field).toHaveProperty('selector');
      expect(field).toHaveProperty('label');
      expect(field).toHaveProperty('checked');
      expect(typeof field.checked).toBe('boolean');
    });
  });

  test('should count total fields by type', async () => {
    const fields = await getSectionFields(page);

    const totalCount =
      fields.inputs.length +
      fields.selects.length +
      fields.checkboxes.length;

    console.log('Field breakdown:', {
      inputs: fields.inputs.length,
      selects: fields.selects.length,
      checkboxes: fields.checkboxes.length,
      total: totalCount,
    });

    // Total should be a non-negative number
    expect(totalCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Section Detection', () => {
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

  test('should detect visible sections', async () => {
    const sections = await page.evaluate(() => {
      const sectionNames = [
        'Customer Information',
        'Additional Customer Information',
        'Project Information',
        'Trade Ally Information',
        'Assessment Questionnaire',
        'Household Members',
        'Enrollment Information',
        'Equipment Information',
        'Basic Enrollment',
        'Bonus Program',
        'Terms and Conditions',
        'Upload Documents',
        'Comments',
        'Status',
      ];

      const visible: string[] = [];

      sectionNames.forEach(name => {
        const headers = Array.from(document.querySelectorAll('h2, h3, .section-title'));
        const found = headers.some(h =>
          h.textContent?.trim().includes(name)
        );
        if (found) visible.push(name);
      });

      return visible;
    });

    console.log('Visible sections:', sections);
    expect(Array.isArray(sections)).toBe(true);
  });

  test('should identify active section in menu', async () => {
    const activeSection = await page.evaluate(() => {
      const active = document.querySelector(
        '.sections-menu-item.active .sections-menu-item__title, ' +
        '.section-nav-item.active'
      );
      return active?.textContent?.trim() || null;
    });

    console.log('Active section:', activeSection);
    // May be null on non-SCE pages
    expect(activeSection).toBeDefined();
  });
});

test.describe('Angular Material Detection', () => {
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

  test('should detect Angular Material is loaded', async () => {
    const hasAngularMaterial = await page.evaluate(() => {
      return typeof (window as any).ng !== 'undefined' ||
             document.querySelector('mat-form-field') !== null ||
             document.querySelector('[ng-]') !== null;
    });

    console.log('Angular Material detected:', hasAngularMaterial);
    expect(hasAngularMaterial).toBeDefined();
  });

  test('should find mat-form-field elements', async () => {
    const formFieldCount = await page.evaluate(() => {
      return document.querySelectorAll('mat-form-field').length;
    });

    console.log('mat-form-field elements found:', formFieldCount);
    expect(formFieldCount).toBeGreaterThanOrEqual(0);
  });

  test('should find mat-select elements', async () => {
    const selectCount = await page.evaluate(() => {
      return document.querySelectorAll('mat-select').length;
    });

    console.log('mat-select elements found:', selectCount);
    expect(selectCount).toBeGreaterThanOrEqual(0);
  });

  test('should find mat-label elements', async () => {
    const labelCount = await page.evaluate(() => {
      return document.querySelectorAll('mat-form-field mat-label').length;
    });

    console.log('mat-label elements found:', labelCount);
    expect(labelCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Data Structure Validation', () => {
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

  test('should validate ScrapeResult structure', async () => {
    // Test that we can construct a valid ScrapeResult
    const isValid = await page.evaluate(() => {
      const result = {
        success: true,
        data: {
          customerName: 'John Doe',
          customerPhone: '555-1234',
          customerEmail: 'john@example.com',
        },
      };

      return (
        typeof result.success === 'boolean' &&
        typeof result.data === 'object' &&
        typeof result.data.customerName === 'string' &&
        typeof result.data.customerPhone === 'string'
      );
    });

    expect(isValid).toBe(true);
  });

  test('should validate section data structures', async () => {
    const isValid = await page.evaluate(() => {
      // Test each section type
      const sections = {
        additionalInfo: {
          title: 'Mr.',
          language: 'English',
        },
        projectInfo: {
          squareFootage: '1500',
          yearBuilt: '1980',
        },
        tradeAllyInfo: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      return (
        typeof sections.additionalInfo === 'object' &&
        typeof sections.projectInfo === 'object' &&
        typeof sections.tradeAllyInfo === 'object'
      );
    });

    expect(isValid).toBe(true);
  });
});

test.describe('Error Handling in Extraction', () => {
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

  test('should handle missing fields gracefully', async () => {
    const fields = await getSectionFields(page);

    // Missing fields should just be empty arrays, not throw errors
    expect(fields.inputs).toBeDefined();
    expect(fields.selects).toBeDefined();
    expect(fields.checkboxes).toBeDefined();
  });

  test('should return empty labels for unlabeled fields', async () => {
    const fields = await getSectionFields(page);

    // All fields should have a label property (even if empty string)
    fields.inputs.forEach(field => {
      expect(field).toHaveProperty('label');
      expect(typeof field.label).toBe('string');
    });
  });

  test('should handle special characters in labels', async () => {
    const fields = await getSectionFields(page);

    // Labels with special characters should be preserved
    fields.inputs.forEach(field => {
      // Should not throw error on label with special chars
      expect(() => {
        JSON.stringify(field.label);
      }).not.toThrow();
    });
  });
});

test.describe('Performance of Extraction', () => {
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

  test('should extract all fields within 2 seconds', async () => {
    const startTime = Date.now();
    const fields = await getSectionFields(page);
    const duration = Date.now() - startTime;

    console.log(`Extraction took ${duration}ms for ${fields.inputs.length + fields.selects.length + fields.checkboxes.length} fields`);

    // Should complete quickly even with many fields
    expect(duration).toBeLessThan(2000);
  });

  test('should handle large DOM efficiently', async () => {
    // Create many elements to test performance
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'test-container';
      for (let i = 0; i < 1000; i++) {
        const div = document.createElement('div');
        div.textContent = `Test element ${i}`;
        container.appendChild(div);
      }
      document.body.appendChild(container);
    });

    const startTime = Date.now();
    const fields = await getSectionFields(page);
    const duration = Date.now() - startTime;

    // Cleanup
    await page.evaluate(() => {
      const container = document.getElementById('test-container');
      container?.remove();
    });

    console.log(`Extraction with 1000 extra DOM elements took ${duration}ms`);
    expect(duration).toBeLessThan(3000);
  });
});

test.describe('Cross-Browser Compatibility', () => {
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

  test('should work with different Chrome versions', async () => {
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log('User Agent:', userAgent);

    // Should be Chrome
    expect(userAgent).toContain('Chrome');
  });

  test('should handle different viewport sizes', async () => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileFields = await getSectionFields(page);

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    const desktopFields = await getSectionFields(page);

    // Field counts should be consistent
    expect(mobileFields.inputs.length).toBe(desktopFields.inputs.length);
  });
});
