// SCE2 Extension - Content Script
// Runs on sce.dsmcentral.com - handles form scraping and submission

import { SCEHelper } from './lib/sce-helper.js';
import type { AdditionalCustomerInfo } from './lib/sections/additional-customer.js';
import type { ProjectInfo } from './lib/sections/project.js';
import type { TradeAllyInfo } from './lib/sections/trade-ally.js';
import type { AssessmentInfo } from './lib/sections/assessment.js';
import type { HouseholdInfo } from './lib/sections/household.js';
import type { EnrollmentInfo } from './lib/sections/enrollment.js';
import type { EquipmentInfo } from './lib/sections/equipment.js';
import type { BasicEnrollmentInfo } from './lib/sections/basic-enrollment.js';
import type { BonusInfo } from './lib/sections/bonus.js';
import type { TermsInfo } from './lib/sections/terms.js';
import type { CommentsInfo } from './lib/sections/comments.js';
import type { StatusInfo } from './lib/sections/status.js';
import { fetchZillowDataWithCache } from './lib/zillow-client.js';
import {
  extractAssessmentInfo,
  extractHouseholdInfo,
  extractEnrollmentInfo,
  extractEquipmentInfo,
  extractBasicEnrollmentInfo,
  extractBonusInfo,
  extractTermsInfo,
  extractCommentsInfo,
  extractStatusInfo,
} from './lib/sections/sections-extractor.js';
import { BannerController } from './lib/banner.js';
import {
  fillAllSections,
  fillCurrentSection,
  resetStopFlag,
  requestStop,
} from './lib/fill-orchestrator.js';
import type { BannerController as FillBannerController } from './lib/fill-orchestrator.js';
import { SCE1_DEFAULTS } from './lib/sce1-logic.js';
import {
  findField,
  readFieldValue,
  waitForElement as waitForElementUtil,
} from './lib/dom-utils.js';
import { getConfig } from './lib/storage.js';
import { asyncHandler } from './lib/utils.js';
import type {
  ScrapePropertyMessage,
  SubmitApplicationMessage,
  FillRouteAddressMessage,
  Message,
  ScrapeResult,
  SubmitResult,
} from './types/messages.js';

// ==========================================
// TYPE DEFINITIONS
// ==========================================
// Message types imported from ./types/messages.js

// ==========================================
// SECTION MAPPING
// ==========================================
const SECTION_MAP: Record<string, string> = {
  'Customer Information': 'customerInfo',
  'Additional Customer Information': 'additionalInfo',
  'Enrollment Information': 'enrollmentInfo',
  'Household Members': 'household',
  'Project Information': 'project',
  'Trade Ally Information': 'tradeAlly',
  'Assessment Questionnaire': 'assessment',
  'Equipment Information': 'equipment',
  'Basic Enrollment': 'basicEnrollment',
  'Bonus Program': 'bonus',
  'Terms and Conditions': 'terms',
  'Upload Documents': 'uploads',
  'Comments': 'comments',
  'Status': 'status',
};

// ==========================================
// DETECTION
// ==========================================
function getActiveSectionTitle(): string | null {
  const activeElement = document.querySelector(
    '.sections-menu-item.active .sections-menu-item__title'
  );

  if (activeElement) {
    return activeElement.textContent?.trim() || null;
  }

  return null;
}

function waitForElement(
  selector: string,
  timeout = 10000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);

    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

function waitForTextContent(
  selector: string,
  timeout = 10000,
  minLength = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const checkText = () => {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim() || '';
      if (text.length >= minLength) {
        return text;
      }
      return null;
    };

    const initialText = checkText();
    if (initialText) {
      resolve(initialText);
      return;
    }

    const observer = new MutationObserver(() => {
      const text = checkText();
      if (text) {
        observer.disconnect();
        resolve(text);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Text content at ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// ==========================================
// ADDITIONAL CUSTOMER INFO EXTRACTION
// ==========================================
/**
 * Extracts all 18 fields from the Additional Customer Information section.
 * This section is visible after clicking a program button.
 *
 * Returns a Partial<AdditionalCustomerInfo> with any fields that were found.
 */
function extractAdditionalCustomerInfo(): Partial<AdditionalCustomerInfo> {
  const result: Partial<AdditionalCustomerInfo> = {};

  // Helper to find dropdown value by label text
  const getDropdownValue = (labelText: string): string | undefined => {
    const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));
    const label = labels.find(l =>
      l.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())
    );

    if (!label) return undefined;

    const formField = label.closest('mat-form-field');
    const trigger = formField?.querySelector('mat-select') as HTMLElement | null;

    if (!trigger) {
      // Try to find an input instead (for text fields)
      const input = formField?.querySelector('input');
      return input?.value || undefined;
    }

    // For mat-select, the selected value is often in a span inside the trigger
    const selectedText = trigger.querySelector('span.mat-select-value-text')?.textContent?.trim();
    return selectedText || undefined;
  };

  // Helper to find input value by label text
  const getInputValue = (labelText: string): string | undefined => {
    const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));
    const label = labels.find(l =>
      l.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())
    );

    if (!label) return undefined;

    const formField = label.closest('mat-form-field');
    const input = formField?.querySelector('input') as HTMLInputElement | null;

    return input?.value || undefined;
  };

  // Extract all 18 fields
  result.title = getDropdownValue('Title');
  result.preferredContactTime = getDropdownValue('Preferred Contact Time');
  result.language = getDropdownValue('Language');
  result.ethnicity = getDropdownValue('Ethnicity');
  result.householdUnits = getInputValue('Household Units') || getInputValue('Units');
  result.spaceOrUnit = getInputValue('Space/Unit') || getInputValue('Space Or Unit');
  result.howDidYouHear = getDropdownValue('How Did You Hear');
  result.masterMetered = getDropdownValue('Master Metered');
  result.buildingType = getDropdownValue('Building Type');
  result.homeownerStatus = getDropdownValue('Homeowner Status');
  result.gasProvider = getDropdownValue('Gas Provider');
  result.gasAccountNumber = getInputValue('Gas Account');
  result.waterUtility = getDropdownValue('Water Utility');
  result.incomeVerifiedDate = getInputValue('Income Verified');
  result.primaryApplicantAge = getInputValue('Primary Applicant Age');
  result.permanentlyDisabled = getDropdownValue('Permanently Disabled');
  result.veteran = getDropdownValue('Veteran');
  result.nativeAmerican = getDropdownValue('Native American');

  // Log extracted data for debugging
  console.log('Extracted Additional Customer Info:', result);

  return result;
}

// ==========================================
// PROJECT INFO EXTRACTION
// ==========================================
/**
 * Extracts all 3 fields from the Project Information section.
 * This section contains property details like square footage and year built.
 *
 * Returns a Partial<ProjectInfo> with any fields that were found.
 */
async function extractProjectInfo(
  address: string,
  zipCode: string
): Promise<Partial<ProjectInfo>> {
  const result: Partial<ProjectInfo> = {};

  // Helper to find input value by label text
  const getInputValue = (labelText: string): string | undefined => {
    const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));
    const label = labels.find(l =>
      l.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())
    );

    if (!label) return undefined;

    const formField = label.closest('mat-form-field');
    const input = formField?.querySelector('input') as HTMLInputElement | null;

    return input?.value || undefined;
  };

  // Extract all 3 fields
  result.squareFootage = getInputValue('Square Footage') || getInputValue('Sq Ft');
  result.yearBuilt = getInputValue('Year Built');
  result.propertyType = getInputValue('Property Type');

  // Try to enrich with Zillow data if fields are empty
  if (!result.squareFootage || !result.yearBuilt) {
    console.log('[Project] Enriching with Zillow data...');
    const zillowData = await fetchZillowDataWithCache(address, zipCode);

    if (zillowData.sqFt && !result.squareFootage) {
      result.zillowSqFt = zillowData.sqFt;
      console.log(`[Project] Using Zillow sqft: ${zillowData.sqFt}`);
    }

    if (zillowData.yearBuilt && !result.yearBuilt) {
      result.zillowYearBuilt = zillowData.yearBuilt;
      console.log(`[Project] Using Zillow year built: ${zillowData.yearBuilt}`);
    }

    if (zillowData.zestimate) {
      result.zestimate = zillowData.zestimate;
    }
  }

  // Log extracted data for debugging
  console.log('Extracted Project Info:', result);

  return result;
}

// ==========================================
// TRADE ALLY INFO EXTRACTION
// ==========================================
/**
 * Extracts all 5 fields from the Trade Ally Information section.
 * This section contains contractor/trade ally contact details.
 *
 * Returns a Partial<TradeAllyInfo> with any fields that were found.
 */
function extractTradeAllyInfo(): Partial<TradeAllyInfo> {
  const result: Partial<TradeAllyInfo> = {};

  // Helper to find input value by label text
  const getInputValue = (labelText: string): string | undefined => {
    const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));
    const label = labels.find(l =>
      l.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())
    );

    if (!label) return undefined;

    const formField = label.closest('mat-form-field');
    const input = formField?.querySelector('input') as HTMLInputElement | null;

    return input?.value || undefined;
  };

  // Extract all 5 fields
  result.firstName = getInputValue('First Name');
  result.lastName = getInputValue('Last Name');
  result.title = getInputValue('Title');
  result.phone = getInputValue('Phone') || getInputValue('Phone Number');
  result.email = getInputValue('Email');

  // Log extracted data for debugging
  console.log('Extracted Trade Ally Info:', result);

  return result;
}

// ==========================================
// SCRAPE MODE
// ==========================================
async function performScrape(addressData: ScrapePropertyMessage['data']): Promise<ScrapeResult> {
  const helper = new SCEHelper();

  console.log('Starting scrape for:', addressData);

  try {
    // 1. Fill Customer Search
    await helper.fillCustomerSearch({
      address: `${addressData.streetNumber} ${addressData.streetName}`,
      zipCode: addressData.zipCode,
    });

    // 2. Click Search button
    await helper.clickNext();

    // 3. Wait for program buttons using MutationObserver
    console.log('Waiting for program buttons...');
    await waitForElement('.program-selection-button', 15000);

    // 4. Click first program button
    const buttons = document.querySelectorAll('.program-selection-button');
    if (buttons.length === 0) {
      throw new Error('No program buttons found');
    }

    console.log(`Found ${buttons.length} program buttons, clicking first...`);
    (buttons[0] as HTMLElement).click();

    // 5. Smart wait for customer data to populate (no more sleep(3000)!)
    console.log('Waiting for customer data to populate...');

    // Wait for customer name field to have content
    const customerName = await waitForTextContent('.customer-name-label', 10000);

    // Phone is usually already available
    const phoneElement = document.querySelector('.customer-phone-label');
    const customerPhone = phoneElement?.textContent?.trim() || '';

    // 6. Extract Additional Customer Information
    console.log('Extracting additional customer information...');
    const additionalInfo = extractAdditionalCustomerInfo();

    // 7. Extract Project Information (with Zillow enrichment)
    console.log('Extracting project information...');
    const projectInfo = await extractProjectInfo(
      `${addressData.streetNumber} ${addressData.streetName}`,
      addressData.zipCode
    );

    // 8. Extract Trade Ally Information
    console.log('Extracting trade ally information...');
    const tradeAllyInfo = extractTradeAllyInfo();

    // 9. Extract all remaining sections
    console.log('Extracting all remaining sections...');
    const assessmentInfo = extractAssessmentInfo();
    const householdInfo = extractHouseholdInfo();
    const enrollmentInfo = extractEnrollmentInfo();
    const equipmentInfo = extractEquipmentInfo();
    const basicEnrollmentInfo = extractBasicEnrollmentInfo();
    const bonusInfo = extractBonusInfo();
    const termsInfo = extractTermsInfo();
    const commentsInfo = extractCommentsInfo();
    const statusInfo = extractStatusInfo();

    console.log('Scraped data:', {
      customerName,
      customerPhone,
      additionalInfo,
      projectInfo,
      tradeAllyInfo,
      assessmentInfo,
      householdInfo,
      enrollmentInfo,
      equipmentInfo,
      basicEnrollmentInfo,
      bonusInfo,
      termsInfo,
      commentsInfo,
      statusInfo,
    });

    return {
      success: true,
      data: {
        customerName,
        customerPhone,
        additionalInfo,
        projectInfo,
        tradeAllyInfo,
        assessmentInfo,
        householdInfo,
        enrollmentInfo,
        equipmentInfo,
        basicEnrollmentInfo,
        bonusInfo,
        termsInfo,
        commentsInfo,
        statusInfo,
      },
    };
  } catch (error) {
    console.error('Scrape failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==========================================
// SUBMIT MODE
// ==========================================
async function performSubmit(jobData: SubmitApplicationMessage['data']): Promise<SubmitResult> {
  const helper = new SCEHelper();

  console.log('Starting submit for:', jobData);

  try {
    // 1. Fill Customer Search
    await helper.fillCustomerSearch({
      address: `${jobData.streetNumber} ${jobData.streetName}`,
      zipCode: jobData.zipCode,
    });

    await helper.clickNext();

    // 2. Click program button
    await waitForElement('.program-selection-button', 15000);
    const buttons = document.querySelectorAll('.program-selection-button');

    if (buttons.length === 0) {
      throw new Error('No program buttons found');
    }

    (buttons[0] as HTMLElement).click();

    // 3. Wait for sidebar sections to load so section-aware fill can run.
    await waitForElement('.sections-menu-item__title', 10000);
    const config = await getConfig();

    // 4. Build submit payload with persisted defaults.
    const [firstName, ...lastNameParts] = (jobData.customerName || '').split(' ');
    const storage = await chrome.storage.local.get(['propertyData']);
    const storedPropertyData = storage.propertyData || {};
    const propertyData = {
      ...SCE1_DEFAULTS,
      ...storedPropertyData,
      firstName: firstName || storedPropertyData.firstName || SCE1_DEFAULTS.firstName,
      lastName:
        lastNameParts.join(' ') ||
        storedPropertyData.lastName ||
        SCE1_DEFAULTS.lastName,
      phone: jobData.customerPhone || storedPropertyData.phone || SCE1_DEFAULTS.phone,
      primaryApplicantAge:
        jobData.customerAge !== undefined
          ? String(jobData.customerAge)
          : storedPropertyData.primaryApplicantAge,
      comments: jobData.fieldNotes || storedPropertyData.comments,
      zipCode: jobData.zipCode || storedPropertyData.zipCode || SCE1_DEFAULTS.zipCode,
    };

    // 5. Fill form sections with configured automation scope.
    const banner =
      ((window as any).sce2Banner as FillBannerController | undefined) ||
      ({
        setFilling: () => {},
        setSuccess: () => {},
        setError: () => {},
        setStopped: () => {},
        updateProgress: () => {},
        isStopped: () => false,
        resetStopState: () => {},
      } satisfies FillBannerController);

    if (config.submitVisibleSectionOnly) {
      await fillCurrentSection(propertyData, banner);
    } else {
      await fillAllSections(propertyData, banner);
    }

    // 6. Upload documents only when explicitly enabled.
    if (config.enableDocumentUpload) {
      const navigatedToUploads = await helper.getNavigator().goTo('File Uploads');
      if (!navigatedToUploads) {
        throw new Error('Could not navigate to File Uploads section');
      }

      if (jobData.documents && jobData.documents.length > 0) {
        console.log(`Uploading ${jobData.documents.length} documents`);
        await helper.uploadDocuments(jobData.documents);
      }
    } else {
      console.log('[Submit] Document upload disabled by configuration');
    }

    // 7. Final submit remains guarded by configuration.
    if (!config.enableFinalSubmit) {
      const message = 'Final submit disabled by configuration';
      console.log(`[Submit] ${message}`);
      return {
        success: true,
        skippedFinalSubmit: true,
        message,
      };
    }

    // 8. Attempt to submit and read case ID.
    try {
      await helper.clickNext();
    } catch (error) {
      console.warn('[Submit] Unable to click final submit/next:', error);
    }

    const sceCaseId = await extractCaseId();

    console.log('Submit complete:', sceCaseId);

    return {
      success: true,
      sceCaseId,
    };
  } catch (error) {
    console.error('Submit failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==========================================
// ROUTE PROCESSING HANDLERS
// ==========================================

/**
 * Fill route address form on SCE website
 * Used during route data extraction workflow
 *
 * @param address - Address components (streetNumber, streetName, zipCode)
 * @returns Extracted customer data (name, phone)
 */
async function handleFillRouteAddress(address: {
  streetNumber: string;
  streetName: string;
  zipCode: string;
}): Promise<{ customerName?: string; customerPhone?: string }> {
  console.log('[Route] Filling address:', address);

  const helper = new SCEHelper();

  try {
    // 1. Fill Customer Search section with address
    await helper.fillCustomerSearch({
      address: `${address.streetNumber} ${address.streetName}`,
      zipCode: address.zipCode
    });

    // 2. Click Search button
    await helper.clickNext();

    // 3. Wait for results (smart wait)
    // Wait for the accordion headers to appear (indicating search results/sections)
    try {
      await waitForElementUtil('mat-expansion-panel-header', 10000);
    } catch (e) {
      console.warn('[Route] Warning: Timeout waiting for panels, checking if already open');
    }

    // 4. Click Income button to reveal customer info
    // First, try to find and click Income button/expander
    const incomeButtons = Array.from(document.querySelectorAll('button, [role="button"], mat-option'));
    const incomeBtn = incomeButtons.find(btn =>
      btn.textContent?.toLowerCase().includes('income') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('income')
    );

    if (incomeBtn) {
      (incomeBtn as HTMLElement).click();
      // Short wait for panel expansion
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.warn('[Route] Income button not found, checking if already expanded');
    }

    // 5. Extract customer data from the page
    const customerName = extractCustomerNameFromSCE();
    const customerPhone = extractCustomerPhoneFromSCE();

    console.log('[Route] ✓ Extracted:', { customerName, customerPhone });

    return { customerName, customerPhone };

  } catch (error) {
    console.error('[Route] Failed to fill/extract:', error);
    return {
      customerName: undefined,
      customerPhone: undefined
    };
  }
}

/**
 * Extract customer name from various SCE page selectors
 */
function extractCustomerNameFromSCE(): string | undefined {
  // 1. Try reliable dom-utils lookup (qaanchor or mat-label)
  const fromLabel = readFieldValue('Customer Name') || readFieldValue('Name');
  if (fromLabel) return fromLabel;

  // 2. Fallback to selectors
  const selectors = [
    '.customer-name-label',
    '[aria-label*="Customer Name" i]',
    '[data-field-name="customerName"]',
    '[name*="customerName" i]',
    'input[placeholder*="name" i]',
    // SCE specific classes
    '.customer-name',
    '.customer-name-label',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const input = el as HTMLInputElement;
      if (input.value) return input.value.trim();
    }
  }

  return undefined;
}

/**
 * Extract customer phone from various SCE page selectors
 */
function extractCustomerPhoneFromSCE(): string | undefined {
  // 1. Try reliable dom-utils lookup
  const fromLabel = readFieldValue('Phone') || readFieldValue('Phone Number');
  if (fromLabel) return fromLabel;

  // 2. Fallback to selectors
  const selectors = [
    '.customer-phone-label',
    '[aria-label*="Phone" i]',
    '[data-field-name="customerPhone"]',
    '[name*="phone" i]',
    'input[placeholder*="phone" i]',
    'input[type="tel"]',
    // SCE specific
    '.customer-phone',
    '.phone-label',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const input = el as HTMLInputElement;
      if (input.value) return input.value.trim();
    }
  }

  return undefined;
}

/**
 * Capture customer data from current SCE page
 * Called by background script after form filling
 */
function handleCaptureRouteData(): {
  customerName?: string;
  customerPhone?: string;
} {
  return {
    customerName: extractCustomerNameFromSCE(),
    customerPhone: extractCustomerPhoneFromSCE()
  };
}

async function extractCaseId(): Promise<string> {
  // Wait for status page or case ID element
  try {
    await waitForElement('.case-id-label, [data-testid="case-id"]', 15000);
    const caseIdElement = document.querySelector('.case-id-label, [data-testid="case-id"]');
    const caseId = caseIdElement?.textContent?.trim() || '';

    if (!caseId) {
      throw new Error('Case ID element found but empty');
    }

    return caseId;
  } catch (error) {
    console.error('Failed to extract case ID:', error);
    return '';
  }
}

function checkCustomerSearchReadiness(): {
  ready: boolean;
  currentUrl: string;
  reason?: string;
} {
  const currentUrl = window.location.href;
  const lowerUrl = currentUrl.toLowerCase();
  const onCustomerSearch = lowerUrl.includes('/onsite/customer-search');

  const hasStreetNumberField = Boolean(findField('Street Number'));
  const hasStreetNameField = Boolean(findField('Street Name'));
  const hasZipField = Boolean(findField('Zip Code') || findField('Zip'));
  const hasAddressField = hasStreetNumberField || hasStreetNameField;

  if (hasAddressField && hasZipField) {
    return {
      ready: true,
      currentUrl,
    };
  }

  const hasLoginForm = Boolean(
    document.querySelector('input#login, input[name*="login" i], input[type="password"]')
  );

  if (hasLoginForm || lowerUrl.includes('/tradeally/s/login') || lowerUrl.includes('/auth/login')) {
    return {
      ready: false,
      currentUrl,
      reason: 'Login required in this browser session.',
    };
  }

  if (!onCustomerSearch) {
    return {
      ready: false,
      currentUrl,
      reason: 'Not on SCE customer-search page.',
    };
  }

  return {
    ready: false,
    currentUrl,
    reason: 'Customer-search fields are not available yet.',
  };
}

// ==========================================
// MESSAGE HANDLING
// ==========================================
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('Content script received:', message);

  switch (message.action) {
    case 'SCRAPE_PROPERTY':
      performScrape((message as ScrapePropertyMessage).data)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async

    // Route processing - fill address form on SCE
    case 'fillRouteAddress':
      handleFillRouteAddress((message as FillRouteAddressMessage).address)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    // Route processing - capture customer data
    case 'captureRouteData':
      const data = handleCaptureRouteData();
      sendResponse({ success: true, data });
      return false; // Synchronous response, no need to keep channel open

    case 'SUBMIT_APPLICATION':
      performSubmit((message as SubmitApplicationMessage).data)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async

    case 'GET_CURRENT_SECTION':
      const section = getActiveSectionTitle();
      sendResponse({ section });
      return false; // Synchronous response

    case 'CHECK_CUSTOMER_SEARCH_READY':
      sendResponse({
        success: true,
        data: checkCustomerSearchReadiness(),
      });
      return false; // Synchronous response

    // Fill all sections with async handler wrapper
    case 'FILL_ALL_SECTIONS':
      (async () => {
        try {
          await handleFillAllSections();
          sendResponse({ success: true });
        } catch (error) {
          const errorMessage = (error as Error).message;

          // Check if stopped by user
          if (errorMessage === 'Stopped by user') {
            const banner = (window as any).sce2Banner as BannerController;
            if (banner) {
              banner.setStopped();
            }
            sendResponse({ success: false, stopped: true });
          } else {
            const banner = (window as any).sce2Banner as BannerController;
            if (banner) {
              banner.setError('fill-all-btn', errorMessage);
            }
            sendResponse({ success: false, error: errorMessage });
          }
        }
      })();
      return true;

    // Fill current section with async handler wrapper
    case 'FILL_CURRENT_SECTION':
      (async () => {
        try {
          await handleFillCurrentSection();
          sendResponse({ success: true });
        } catch (error) {
          const errorMessage = (error as Error).message;
          const banner = (window as any).sce2Banner as BannerController;
          if (banner) {
            banner.setError('fill-section-btn', errorMessage);
          }
          sendResponse({ success: false, error: errorMessage });
        }
      })();
      return true;

    // Stop filling
    case 'STOP_FILLING':
      requestStop();
      sendResponse({ success: true });
      return false; // Synchronous response

    // Show banner manually
    case 'SHOW_BANNER':
      const banner = (window as any).sce2Banner as BannerController;
      if (banner) {
        banner.show();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Banner not initialized' });
      }
      return false; // Synchronous response

    default:
      sendResponse({ error: 'Unknown action' });
      return false; // Unknown action
  }
});

// ==========================================
// BANNER HANDLERS
// ==========================================

/**
 * Handle fill all sections request
 */
async function handleFillAllSections(): Promise<void> {
  const banner = (window as any).sce2Banner as BannerController;

  if (!banner) {
    throw new Error('Banner not found');
  }

  resetStopFlag();

  // Get property data from storage or use defaults
  const result = await chrome.storage.local.get(['propertyData', 'queuedProperty']);

  // Use queued property data or defaults
  let propertyData = result.propertyData || {};

  // If we have queued property, use its data
  if (result.queuedProperty) {
    propertyData = {
      ...propertyData,
      ...result.queuedProperty,
    };

    // Clear queue after use
    chrome.storage.local.remove(['queuedProperty']);
  }

  // Apply SCE1 defaults for any missing fields
  propertyData = {
    firstName: propertyData.firstName || SCE1_DEFAULTS.firstName,
    lastName: propertyData.lastName || SCE1_DEFAULTS.lastName,
    phone: propertyData.phone || SCE1_DEFAULTS.phone,
    email: propertyData.email || SCE1_DEFAULTS.email,
    ...propertyData,
  };

  await fillAllSections(propertyData, banner);

  banner.setSuccess('All sections filled successfully!');
}

/**
 * Handle fill current section request
 */
async function handleFillCurrentSection(): Promise<void> {
  const banner = (window as any).sce2Banner as BannerController;

  if (!banner) {
    throw new Error('Banner not found');
  }

  resetStopFlag();

  // Get property data from storage
  const result = await chrome.storage.local.get(['propertyData', 'queuedProperty']);

  let propertyData = result.propertyData || {};

  // If we have queued property, use its data
  if (result.queuedProperty) {
    propertyData = {
      ...propertyData,
      ...result.queuedProperty,
    };

    // Clear queue after use
    chrome.storage.local.remove(['queuedProperty']);
  }

  // Apply SCE1 defaults
  propertyData = {
    firstName: propertyData.firstName || SCE1_DEFAULTS.firstName,
    lastName: propertyData.lastName || SCE1_DEFAULTS.lastName,
    phone: propertyData.phone || SCE1_DEFAULTS.phone,
    email: propertyData.email || SCE1_DEFAULTS.email,
    ...propertyData,
  };

  await fillCurrentSection(propertyData, banner);

  banner.showSectionSuccess();
}

// ==========================================
// BANNER INITIALIZATION
// ==========================================

/**
 * Initialize banner on page load
 */
function initBanner(): void {
  const bannerController = new BannerController();
  (window as any).sce2Banner = bannerController;

  // Check for queued data (auto-show if present)
  chrome.storage.local.get(['queuedProperty'], (result) => {
    if (result.queuedProperty) {
      console.log('[Banner] Queued property found, auto-showing banner');
      bannerController.show(true);
    }
  });
}

// Initialize banner when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBanner);
} else {
  initBanner();
}

// Log that content script is loaded
console.log('SCE2 Content Script loaded');
