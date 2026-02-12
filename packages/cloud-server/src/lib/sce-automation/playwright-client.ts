import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from 'playwright';
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

interface ActiveSession {
  key: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
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

const CUSTOMER_SEARCH_NAV_SELECTORS = [
  'a:has-text("Customer Search")',
  'button:has-text("Customer Search")',
  '[role="menuitem"]:has-text("Customer Search")',
  '[data-testid*="customer-search" i]',
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

const CANONICAL_TRADE_ALLY_LOGIN_URL =
  'https://sce-trade-ally-community.my.site.com/tradeally/s/login/?ec=302&inst=Vt&startURL=%2Ftradeally%2Fsite%2FSiteLogin.apexp';
const TRADE_ALLY_HOSTNAME = 'sce-trade-ally-community.my.site.com';

function normalizeTradeAllyLoginUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return CANONICAL_TRADE_ALLY_LOGIN_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname !== TRADE_ALLY_HOSTNAME) {
      return parsed.toString();
    }

    if (normalizePath(parsed.pathname) !== '/tradeally/s/login') {
      return parsed.toString();
    }

    if (!parsed.searchParams.get('ec')) {
      parsed.searchParams.set('ec', '302');
    }
    if (!parsed.searchParams.get('inst')) {
      parsed.searchParams.set('inst', 'Vt');
    }
    if (!parsed.searchParams.get('startURL')) {
      parsed.searchParams.set('startURL', '/tradeally/site/SiteLogin.apexp');
    }

    return parsed.toString();
  } catch {
    return CANONICAL_TRADE_ALLY_LOGIN_URL;
  }
}

function resolveLoginUrl(): string {
  return normalizeTradeAllyLoginUrl(config.sceLoginUrl);
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

function resolveDsmSsoBridgeUrl(targetUrl: string): string {
  const target = new URL(targetUrl);
  const bridgeUrl = new URL('/traksmart4/public/saml2/saml/login', target.origin);
  bridgeUrl.searchParams.set('sso-redirect-path', '/onsite');
  return bridgeUrl.toString();
}

function isOnTradeAllyHost(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname === TRADE_ALLY_HOSTNAME;
  } catch {
    return false;
  }
}

async function hasTradeAllySession(page: Page): Promise<boolean> {
  const cookies = await page
    .context()
    .cookies([`https://${TRADE_ALLY_HOSTNAME}`])
    .catch(() => []);

  return cookies.some((cookie) => cookie.value?.trim().length > 0);
}

async function waitForTradeAllyLoginFlowCompletion(page: Page): Promise<void> {
  const timeoutMs = Math.min(Math.max(config.sceAutomationTimeoutMs, 10000), 30000);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const currentUrl = page.url().toLowerCase();
    if (!currentUrl.includes('/tradeally/loginflow/')) {
      return;
    }

    await Promise.race([
      page.waitForLoadState('domcontentloaded', { timeout: 1500 }),
      page.waitForTimeout(500),
    ]).catch(() => undefined);
  }
}

async function runDsmSsoBridge(page: Page, targetUrl: string): Promise<boolean> {
  const bridgeUrl = resolveDsmSsoBridgeUrl(targetUrl);

  await waitForTradeAllyLoginFlowCompletion(page);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await page.goto(bridgeUrl, {
        waitUntil: attempt === 1 ? 'domcontentloaded' : 'commit',
      });
      await page.waitForTimeout(1200 + 400 * attempt);

      const currentUrl = page.url().toLowerCase();
      if (currentUrl.includes('/tradeally/loginflow/')) {
        await page.waitForTimeout(1200 * attempt);
        continue;
      }

      return true;
    } catch (error) {
      if (!isRetriableNavigationError(error)) {
        return false;
      }
      await page.waitForTimeout(500 * attempt);
    }
  }

  return false;
}

async function tryRecoverViaTradeAllySso(page: Page, targetUrl: string): Promise<boolean> {
  if (!(await hasTradeAllySession(page))) {
    return false;
  }

  const bridged = await runDsmSsoBridge(page, targetUrl);
  if (!bridged) {
    return false;
  }

  try {
    await navigateToCustomerSearchAfterLogin(page, targetUrl);
    await page.waitForTimeout(1200);
  } catch {
    return false;
  }

  if (await hasLoginPrompt(page)) {
    return false;
  }

  return hasCustomerSearchFields(page);
}

function sessionKey(storageStateJson?: string): string {
  return storageStateJson?.trim() || '__NO_STORAGE_STATE__';
}

function parseStorageState(
  storageStateJson?: string
): BrowserContextOptions['storageState'] {
  if (!storageStateJson) {
    return undefined;
  }

  try {
    return JSON.parse(storageStateJson) as BrowserContextOptions['storageState'];
  } catch {
    throw new Error('Session state JSON is invalid. Recreate the session before running extraction.');
  }
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

async function hasAnySelector(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (count > 0) {
      return true;
    }
  }
  return false;
}

async function hasCustomerSearchFields(page: Page): Promise<boolean> {
  const [hasFullAddress, hasStreetNumber, hasStreetName, hasZip, hasSearchButton] = await Promise.all([
    hasAnySelector(page, ADDRESS_FULL_SELECTORS),
    hasAnySelector(page, STREET_NUMBER_SELECTORS),
    hasAnySelector(page, STREET_NAME_SELECTORS),
    hasAnySelector(page, ZIP_SELECTORS),
    hasAnySelector(page, SEARCH_BUTTON_SELECTORS),
  ]);

  const hasAddress = hasFullAddress || (hasStreetNumber && hasStreetName);
  return hasAddress && hasZip && hasSearchButton;
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

async function tryRecoverCustomerSearchPage(page: Page, targetUrl: string): Promise<void> {
  const target = new URL(targetUrl);
  const recoveryUrls = [
    targetUrl,
    `${target.origin}/onsite/customer-search`,
    `${target.origin}/onsite/#/customer-search`,
  ];

  for (let round = 1; round <= 3; round += 1) {
    for (const url of recoveryUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200 + 300 * round);
      } catch {
        continue;
      }

      if (await hasLoginPrompt(page)) {
        return;
      }
      if (await hasCustomerSearchFields(page)) {
        return;
      }
    }
  }

  const clickedCustomerSearch = await clickFirstMatchingSelector(page, CUSTOMER_SEARCH_NAV_SELECTORS);
  if (clickedCustomerSearch) {
    await page.waitForTimeout(1800);
  }
}

async function assertOnCustomerSearchPage(
  page: Page,
  targetUrl: string
): Promise<void> {
  if (await hasLoginPrompt(page)) {
    if (await tryRecoverViaTradeAllySso(page, targetUrl)) {
      return;
    }

    throw new Error(
      `SCE login required for ${targetUrl}. Refresh session JSON from an authenticated dsmcentral login.`
    );
  }

  if (await hasCustomerSearchFields(page)) {
    return;
  }

  const expectedPath = normalizePath(new URL(targetUrl).pathname);
  const actualPath = normalizePath(new URL(page.url()).pathname);
  if (actualPath === expectedPath) {
    const waitResult = await Promise.race([
      waitForAnySelector(page, [...ADDRESS_FULL_SELECTORS, ...ZIP_SELECTORS], 9000)
        .then(() => 'ready')
        .catch(() => 'timeout'),
      (async () => {
        const start = Date.now();
        while (Date.now() - start < 9000) {
          if (await hasLoginPrompt(page)) {
            return 'login';
          }
          await page.waitForTimeout(300);
        }
        return 'timeout';
      })(),
    ]);

    if (waitResult === 'ready' || (await hasCustomerSearchFields(page))) {
      return;
    }

    if (waitResult === 'login' || (await hasLoginPrompt(page))) {
      if (await tryRecoverViaTradeAllySso(page, targetUrl)) {
        return;
      }

      throw new Error(
        `SCE login required for ${targetUrl}. Refresh session JSON from an authenticated dsmcentral login.`
      );
    }

    throw new Error(
      `SCE reached ${targetUrl} but customer-search form was not available. ` +
        'Session was not fully authenticated in automation context.'
    );
  }

  if (isOnOnsitePath(actualPath)) {
    await tryRecoverCustomerSearchPage(page, targetUrl);

    if (await hasLoginPrompt(page)) {
      if (await tryRecoverViaTradeAllySso(page, targetUrl)) {
        return;
      }

      throw new Error(
        `SCE login required for ${targetUrl}. Refresh session JSON from an authenticated dsmcentral login.`
      );
    }

    if (await hasCustomerSearchFields(page)) {
      return;
    }

    throw new Error(
      `SCE session landed on ${page.url()} instead of ${targetUrl}. ` +
        'Customer-search form was not available in automation context.'
    );
  }

  throw new Error(
    `Unexpected SCE page (${page.url()}). Expected ${targetUrl}. Login or account access may be missing.`
  );
}

async function ensureCustomerSearchReady(page: Page, targetUrl: string): Promise<void> {
  await navigateToCustomerSearchAfterLogin(page, targetUrl);
  await page.waitForTimeout(1200);
  await assertOnCustomerSearchPage(page, targetUrl);
}

async function verifyStorageStateRoundTrip(
  browser: Browser,
  storageState: BrowserContextOptions['storageState'],
  targetUrl: string
): Promise<void> {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  page.setDefaultTimeout(config.sceAutomationTimeoutMs);

  try {
    await ensureCustomerSearchReady(page, targetUrl);
  } finally {
    await context.close().catch(() => undefined);
  }
}

export class PlaywrightSCEAutomationClient implements SCEAutomationClient {
  private activeSession: ActiveSession | null = null;

  async dispose(): Promise<void> {
    const session = this.activeSession;
    this.activeSession = null;

    if (!session) {
      return;
    }

    await session.context.close().catch(() => undefined);
    await session.browser.close().catch(() => undefined);
  }

  private async createFreshSession(storageStateJson?: string): Promise<ActiveSession> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: parseStorageState(storageStateJson),
    });
    const page = await context.newPage();
    page.setDefaultTimeout(config.sceAutomationTimeoutMs);

    return {
      key: sessionKey(storageStateJson),
      browser,
      context,
      page,
    };
  }

  private async getOrCreatePersistentSession(storageStateJson?: string): Promise<ActiveSession> {
    const key = sessionKey(storageStateJson);
    if (this.activeSession && this.activeSession.key === key) {
      return this.activeSession;
    }

    await this.dispose();
    const created = await this.createFreshSession(storageStateJson);
    this.activeSession = created;
    return created;
  }

  async createStorageStateFromCredentials(
    credentials: SCELoginCredentialsInput
  ): Promise<string> {
    await this.dispose();

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

      await waitForTradeAllyLoginFlowCompletion(page);
      await page.waitForTimeout(1200);

      const targetUrl = resolveCustomerSearchUrl();
      if (isOnTradeAllyHost(page.url()) || (await hasTradeAllySession(page))) {
        await runDsmSsoBridge(page, targetUrl);
      }
      await ensureCustomerSearchReady(page, targetUrl);

      const storageState = await context.storageState();
      await verifyStorageStateRoundTrip(browser, storageState, targetUrl);
      return JSON.stringify(storageState);
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async validateSessionAccess(
    options?: { storageStateJson?: string }
  ): Promise<{ currentUrl: string }> {
    const session = await this.createFreshSession(options?.storageStateJson);

    try {
      const targetUrl = resolveCustomerSearchUrl();
      await ensureCustomerSearchReady(session.page, targetUrl);
      return { currentUrl: session.page.url() };
    } finally {
      await session.context.close();
      await session.browser.close();
    }
  }

  async extractCustomerData(
    address: SCEAutomationAddressInput,
    options?: { storageStateJson?: string }
  ): Promise<SCEExtractionResult> {
    const session = await this.getOrCreatePersistentSession(options?.storageStateJson);
    const page = session.page;

    const targetUrl = resolveCustomerSearchUrl();
    await ensureCustomerSearchReady(page, targetUrl);

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
  }
}
