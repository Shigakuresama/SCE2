import { chromium, type Page } from 'playwright';
import { config } from '../config.js';
import { pickFirstNonEmpty } from './selectors.js';
import type {
  SCEAutomationAddressInput,
  SCEAutomationClient,
  SCEExtractionResult,
} from './types.js';

interface SCELoginCredentialsInput {
  username: string;
  password: string;
}

const LOGIN_USERNAME_SELECTORS = [
  'input#login',
  'input[placeholder*="first.last@sce.tac" i]',
  'input[aria-label*="email" i]',
  'input[type="text"]',
];

const LOGIN_PASSWORD_SELECTORS = [
  'input#password',
  'input[placeholder*="password" i]',
  'input[type="password"]',
];

const LOGIN_SUBMIT_SELECTORS = [
  'button:has-text("Login")',
  'button:has-text("Log In")',
  'button:has-text("Sign in")',
  'button[type="submit"]',
  'input[type="submit"]',
];

const ADDRESS_FULL_SELECTORS = [
  'input[aria-label*="address" i]',
  'input[name*="address" i]',
  'input[placeholder*="address" i]',
];

const STREET_NUMBER_SELECTORS = [
  'input[aria-label*="street number" i]',
  'input[name*="streetNumber" i]',
  'input[placeholder*="street number" i]',
];

const STREET_NAME_SELECTORS = [
  'input[aria-label*="street name" i]',
  'input[name*="streetName" i]',
  'input[placeholder*="street name" i]',
];

const ZIP_SELECTORS = [
  'input[aria-label*="zip" i]',
  'input[name*="zip" i]',
  'input[placeholder*="zip" i]',
];

const SEARCH_BUTTON_SELECTORS = [
  'button:has-text("Search")',
  'button[type="submit"]',
  'input[type="submit"]',
];

const NAME_SELECTORS = [
  '[aria-label*="customer name" i]',
  'input[name*="customerName" i]',
  '[data-field-name*="customerName" i]',
  '.customer-name',
  'input[placeholder*="name" i]',
];

const PHONE_SELECTORS = [
  '[aria-label*="phone" i]',
  'input[name*="phone" i]',
  '[data-field-name*="phone" i]',
  '.customer-phone',
  'input[type="tel"]',
];

const EMAIL_SELECTORS = [
  '[aria-label*="email" i]',
  'input[name*="email" i]',
  'input[type="email"]',
];

async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeoutMs: number
): Promise<void> {
  const waiters = selectors.map((selector) =>
    page
      .locator(selector)
      .first()
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => selector)
  );

  try {
    await Promise.any(waiters);
  } catch {
    throw new Error(`No selector matched in ${timeoutMs}ms`);
  }
}

async function waitForLoginForm(page: Page): Promise<void> {
  const timeoutMs = Math.min(Math.max(config.sceAutomationTimeoutMs, 2000), 15000);
  try {
    await Promise.all([
      waitForAnySelector(page, LOGIN_USERNAME_SELECTORS, timeoutMs),
      waitForAnySelector(page, LOGIN_PASSWORD_SELECTORS, timeoutMs),
    ]);
  } catch {
    throw new Error('Could not find SCE login fields on the login page.');
  }
}

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

function resolveCustomerSearchUrl(): string {
  const rawPath = config.sceFormPath.trim();
  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return new URL(normalizedPath, config.sceBaseUrl).toString();
}

function resolveLoginUrl(): string {
  return config.sceLoginUrl;
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '').toLowerCase();
}

function isOnOnsitePath(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  return normalized === '/onsite' || normalized.startsWith('/onsite/');
}

function isRetriableNavigationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('err_aborted') || message.includes('navigation interrupted');
}

async function fillFirstMatchingSelector(
  page: Page,
  selectors: string[],
  value: string
): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }

    try {
      await locator.fill(value);
      return true;
    } catch {
      // try next selector
    }
  }

  return false;
}

async function clickFirstMatchingSelector(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }

    try {
      await locator.click();
      return true;
    } catch {
      // try next selector
    }
  }

  return false;
}

async function hasLoginPrompt(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (url.includes('/auth/login')) {
    return true;
  }

  const [loginCount, passwordCount] = await Promise.all([
    page
      .locator('input#login, input[name*="login" i], input[aria-label*="email" i]')
      .count()
      .catch(() => 0),
    page.locator('input#password, input[type="password"]').count().catch(() => 0),
  ]);

  if (loginCount > 0 && passwordCount > 0) {
    return true;
  }

  const bodyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase();
  return /sign in|log in/.test(bodyText) && /email|password/.test(bodyText);
}

async function navigateToCustomerSearchAfterLogin(page: Page, targetUrl: string): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(targetUrl, {
        waitUntil: attempt === 1 ? 'domcontentloaded' : 'commit',
      });
      return;
    } catch (error) {
      lastError = error;
      if (!isRetriableNavigationError(error)) {
        throw error;
      }
      await page.waitForTimeout(750 * attempt);
    }
  }

  try {
    const currentUrl = new URL(page.url());
    const expectedUrl = new URL(targetUrl);
    if (
      currentUrl.hostname === expectedUrl.hostname &&
      currentUrl.protocol === expectedUrl.protocol &&
      normalizePath(currentUrl.pathname) === normalizePath(expectedUrl.pathname)
    ) {
      return;
    }
  } catch {
    // If URL parsing fails, throw the captured navigation error below.
  }

  throw (
    lastError ??
    new Error(`Unable to navigate to ${targetUrl} after SCE login.`)
  );
}

async function assertOnCustomerSearchPage(
  page: Page,
  targetUrl: string
): Promise<void> {
  if (await hasLoginPrompt(page)) {
    throw new Error(
      `SCE login required for ${targetUrl}. Refresh session JSON from an authenticated dsmcentral login.`
    );
  }

  const expectedPath = normalizePath(new URL(targetUrl).pathname);
  const actualPath = normalizePath(new URL(page.url()).pathname);
  if (actualPath !== expectedPath) {
    if (isOnOnsitePath(actualPath)) {
      throw new Error(
        `SCE login succeeded but landed on ${page.url()} instead of ${targetUrl}. ` +
        'This SCE account/session does not have access to customer-search.'
      );
    }

    throw new Error(
      `Unexpected SCE page (${page.url()}). Expected ${targetUrl}. Login or account access may be missing.`
    );
  }
}

export class PlaywrightSCEAutomationClient implements SCEAutomationClient {
  async createStorageStateFromCredentials(
    credentials: SCELoginCredentialsInput
  ): Promise<string> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      page.setDefaultTimeout(config.sceAutomationTimeoutMs);

      const loginUrl = resolveLoginUrl();
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await waitForLoginForm(page);

      const username = credentials.username.trim();
      const password = credentials.password;
      if (!username) {
        throw new Error('SCE username is required');
      }
      if (!password) {
        throw new Error('SCE password is required');
      }

      const [filledUsername, filledPassword] = await Promise.all([
        fillFirstMatchingSelector(page, LOGIN_USERNAME_SELECTORS, username),
        fillFirstMatchingSelector(page, LOGIN_PASSWORD_SELECTORS, password),
      ]);
      if (!filledUsername || !filledPassword) {
        throw new Error('Could not find SCE login fields on the login page.');
      }

      const clickedLogin = await clickFirstMatchingSelector(page, LOGIN_SUBMIT_SELECTORS);
      if (!clickedLogin) {
        throw new Error('Could not find SCE login submit button.');
      }
      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: 6000 }),
        page.waitForTimeout(2000),
      ]).catch(() => undefined);

      const targetUrl = resolveCustomerSearchUrl();
      await navigateToCustomerSearchAfterLogin(page, targetUrl);
      await page.waitForTimeout(1200);
      await assertOnCustomerSearchPage(page, targetUrl);

      const storageState = await context.storageState();
      return JSON.stringify(storageState);
    } finally {
      await context.close();
      await browser.close();
    }
  }

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
      const targetUrl = resolveCustomerSearchUrl();
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await assertOnCustomerSearchPage(page, targetUrl);

      const fullAddress = `${address.streetNumber} ${address.streetName}`.trim();
      const filledFullAddress = await fillFirstMatchingSelector(page, ADDRESS_FULL_SELECTORS, fullAddress);
      if (!filledFullAddress) {
        const [filledStreetNumber, filledStreetName] = await Promise.all([
          fillFirstMatchingSelector(page, STREET_NUMBER_SELECTORS, address.streetNumber),
          fillFirstMatchingSelector(page, STREET_NAME_SELECTORS, address.streetName),
        ]);

        if (!filledStreetNumber && !filledStreetName) {
          throw new Error('Could not find SCE address fields on customer-search page. Check login and selectors.');
        }
      }

      const filledZip = await fillFirstMatchingSelector(page, ZIP_SELECTORS, address.zipCode);
      if (!filledZip) {
        throw new Error('Could not find SCE zip field on customer-search page.');
      }

      const clickedSearch = await clickFirstMatchingSelector(page, SEARCH_BUTTON_SELECTORS);
      if (!clickedSearch) {
        throw new Error('Could not find SCE search button after filling address.');
      }

      await page.waitForTimeout(1200);

      if (await hasLoginPrompt(page)) {
        throw new Error('SCE session expired during search. Please refresh the session JSON.');
      }

      const [customerName, customerPhone, customerEmail] = await Promise.all([
        firstValueFromSelectors(page, NAME_SELECTORS),
        firstValueFromSelectors(page, PHONE_SELECTORS),
        firstValueFromSelectors(page, EMAIL_SELECTORS),
      ]);

      const hasAnyCustomerData = [customerName, customerPhone, customerEmail].some(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      if (!hasAnyCustomerData) {
        throw new Error(
          'Customer data not found after search. Verify selectors and ensure the address exists in SCE.'
        );
      }

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
