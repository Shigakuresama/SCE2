// SCE2 Extension - Content Script
// Runs on sce.dsmcentral.com - handles form scraping and submission

import { SCEHelper } from './lib/sce-helper.js';

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

// ==========================================
// SCRAPE MODE
// ==========================================
async function performScrape(addressData: any) {
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

    // 3. Wait for program buttons (Financial, etc.)
    await waitForElement('.program-selection-button', 15000);

    // 4. Click first program button
    const buttons = document.querySelectorAll('.program-selection-button');
    if (buttons.length > 0) {
      (buttons[0] as HTMLElement).click();
    }

    // 5. Wait for customer data to populate
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 6. Extract customer data
    const customerName = document.querySelector('.customer-name-label')?.textContent?.trim() || '';
    const customerPhone = document.querySelector('.customer-phone-label')?.textContent?.trim() || '';

    console.log('Scraped data:', { customerName, customerPhone });

    return {
      success: true,
      data: {
        customerName,
        customerPhone,
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
async function performSubmit(jobData: any) {
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
    if (buttons.length > 0) {
      (buttons[0] as HTMLElement).click();
    }

    // 3. Fill customer info
    if (jobData.customerName) {
      const [firstName, ...lastNameParts] = jobData.customerName.split(' ');
      await helper.fillCustomerInfo({
        firstName,
        lastName: lastNameParts.join(' ') || '',
        phone: jobData.customerPhone || '',
      });
    }

    // 4. Navigate through sections
    // (This would be expanded based on the full workflow)

    // 5. Upload documents
    if (jobData.documents && jobData.documents.length > 0) {
      await helper.uploadDocuments(jobData.documents);
    }

    // 6. Submit form
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
  // Wait for status page
  await waitForElement('.case-id-label', 10000);
  const caseIdElement = document.querySelector('.case-id-label');
  return caseIdElement?.textContent?.trim() || '';
}

// ==========================================
// MESSAGE HANDLING
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received:', message);

  switch (message.action) {
    case 'SCRAPE_PROPERTY':
      performScrape(message.data).then(sendResponse);
      return true;

    case 'SUBMIT_APPLICATION':
      performSubmit(message.data).then(sendResponse);
      return true;

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
