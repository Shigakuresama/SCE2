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

// ==========================================
// TYPE DEFINITIONS
// ==========================================

interface ScrapeMessageData {
  propertyId: number;
  streetNumber: string;
  streetName: string;
  zipCode: string;
}

interface SubmitMessageData {
  id: number;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  customerName: string;
  customerPhone: string;
  customerAge?: number;
  fieldNotes?: string;
  documents: Array<{
    url: string;
    name: string;
    type: string;
  }>;
}

interface ScrapeResult {
  success: boolean;
  data?: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    // All form sections
    additionalInfo?: Partial<AdditionalCustomerInfo>;
    projectInfo?: Partial<ProjectInfo>;
    tradeAllyInfo?: Partial<TradeAllyInfo>;
    assessmentInfo?: Partial<AssessmentInfo>;
    householdInfo?: Partial<HouseholdInfo>;
    enrollmentInfo?: Partial<EnrollmentInfo>;
    equipmentInfo?: Partial<EquipmentInfo>;
    basicEnrollmentInfo?: Partial<BasicEnrollmentInfo>;
    bonusInfo?: Partial<BonusInfo>;
    termsInfo?: Partial<TermsInfo>;
    commentsInfo?: Partial<CommentsInfo>;
    statusInfo?: Partial<StatusInfo>;
  };
  error?: string;
}

interface SubmitResult {
  success: boolean;
  sceCaseId?: string;
  error?: string;
}

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
async function performScrape(addressData: ScrapeMessageData): Promise<ScrapeResult> {
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
async function performSubmit(jobData: SubmitMessageData): Promise<SubmitResult> {
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

    // 3. Wait for customer info section
    await waitForElement('input[name="firstName"]', 10000);

    // 4. Fill customer info
    if (jobData.customerName) {
      const [firstName, ...lastNameParts] = jobData.customerName.split(' ');
      await helper.fillCustomerInfo({
        firstName,
        lastName: lastNameParts.join(' ') || '',
        phone: jobData.customerPhone || '',
      });
    }

    // 5. Click next to proceed
    await helper.clickNext();

    // 6. Navigate to upload section
    // This is simplified - full implementation would navigate all sections
    console.log('Navigating to upload section...');

    // 7. Upload documents
    if (jobData.documents && jobData.documents.length > 0) {
      console.log(`Uploading ${jobData.documents.length} documents`);
      await helper.uploadDocuments(jobData.documents);
    }

    // 8. Submit form
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

// ==========================================
// MESSAGE HANDLING
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received:', message);

  switch (message.action) {
    case 'SCRAPE_PROPERTY':
      performScrape(message.data as ScrapeMessageData)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async

    case 'SUBMIT_APPLICATION':
      performSubmit(message.data as SubmitMessageData)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async

    case 'GET_CURRENT_SECTION':
      const section = getActiveSectionTitle();
      sendResponse({ section });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Log that content script is loaded
console.log('SCE2 Content Script loaded');
