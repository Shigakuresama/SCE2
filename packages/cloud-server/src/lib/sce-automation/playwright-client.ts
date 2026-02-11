import { chromium, type Page } from 'playwright';
import { config } from '../config.js';
import { pickFirstNonEmpty } from './selectors.js';
import type {
  SCEAutomationAddressInput,
  SCEAutomationClient,
  SCEExtractionResult,
} from './types.js';

const NAME_SELECTORS = [
  '[aria-label*="customer name" i]',
  'input[name*="customerName" i]',
  'input[placeholder*="name" i]',
];

const PHONE_SELECTORS = [
  '[aria-label*="phone" i]',
  'input[name*="phone" i]',
  'input[type="tel"]',
];

const EMAIL_SELECTORS = [
  '[aria-label*="email" i]',
  'input[name*="email" i]',
  'input[type="email"]',
];

async function firstValueFromSelectors(
  page: Page,
  selectors: string[]
): Promise<string | undefined> {
  const values = await Promise.all(
    selectors.map(async (selector) => {
      const inputValue = await page.locator(selector).first().inputValue().catch(() => '');
      if (inputValue) {
        return inputValue;
      }
      return page.locator(selector).first().textContent().catch(() => '');
    })
  );

  return pickFirstNonEmpty(values);
}

export class PlaywrightSCEAutomationClient implements SCEAutomationClient {
  async extractCustomerData(
    address: SCEAutomationAddressInput,
    options?: { storageStateJson?: string }
  ): Promise<SCEExtractionResult> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: options?.storageStateJson ? JSON.parse(options.storageStateJson) : undefined,
    });
    const page = await context.newPage();

    try {
      page.setDefaultTimeout(config.sceAutomationTimeoutMs);
      await page.goto(`${config.sceBaseUrl}/onsite`, { waitUntil: 'domcontentloaded' });

      await page
        .locator('input[aria-label*="address" i], input[name*="address" i], input[placeholder*="address" i]')
        .first()
        .fill(`${address.streetNumber} ${address.streetName}`)
        .catch(() => {});
      await page
        .locator('input[aria-label*="zip" i], input[name*="zip" i], input[placeholder*="zip" i]')
        .first()
        .fill(address.zipCode)
        .catch(() => {});
      await page
        .locator('button:has-text("Search"), button[type="submit"]')
        .first()
        .click()
        .catch(() => {});

      const [customerName, customerPhone, customerEmail] = await Promise.all([
        firstValueFromSelectors(page, NAME_SELECTORS),
        firstValueFromSelectors(page, PHONE_SELECTORS),
        firstValueFromSelectors(page, EMAIL_SELECTORS),
      ]);

      return {
        customerName,
        customerPhone,
        customerEmail,
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }
}
