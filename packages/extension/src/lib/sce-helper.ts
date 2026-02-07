// SCE Helper class for form interactions
// Enhanced with Angular Material patterns from SCE v1

import type { AdditionalCustomerInfo } from './sections/additional-customer.js';
import type { ProjectInfo } from './sections/project.js';
import type { TradeAllyInfo } from './sections/trade-ally.js';
import type { AssessmentInfo } from './sections/assessment.js';
import type { HouseholdInfo } from './sections/household.js';
import type { EnrollmentInfo } from './sections/enrollment.js';
import type { EquipmentInfo } from './sections/equipment.js';
import type { BasicEnrollmentInfo } from './sections/basic-enrollment.js';
import type { BonusInfo } from './sections/bonus.js';
import type { TermsInfo } from './sections/terms.js';
import type { CommentsInfo } from './sections/comments.js';
import type { StatusInfo } from './sections/status.js';
import { SectionNavigator, type SectionName } from './section-navigator.js';
import {
  ElementNotFoundError,
  withErrorHandling,
  withRetry,
  withErrorCollection,
  logOperation,
  logError,
  getSuggestedFix,
} from './error-handler.js';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface CustomerSearchData {
  address: string;
  zipCode: string;
}

export interface CustomerInfoData {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

export interface SelectOption {
  selector: string;
  value: string;
  byLabel?: boolean;
}

export interface DocumentData {
  url: string;
  name: string;
  type: string;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// SCE HELPER CLASS
// ==========================================

export class SCEHelper {
  private sectionNavigator: SectionNavigator;

  constructor() {
    this.sectionNavigator = new SectionNavigator();
  }

  // ==========================================
  // NAVIGATION HELPERS
  // ==========================================
  /**
   * Get the current section navigator instance
   */
  getNavigator(): SectionNavigator {
    return this.sectionNavigator;
  }

  /**
   * Navigate to a specific section
   */
  async goToSection(sectionName: SectionName): Promise<boolean> {
    return logOperation(
      `Navigate to ${sectionName}`,
      () => this.sectionNavigator.goTo(sectionName),
      'SCEHelper'
    );
  }

  /**
   * Navigate to the next section
   */
  async goToNextSection(): Promise<boolean> {
    return logOperation(
      'Navigate to next section',
      () => this.sectionNavigator.next(),
      'SCEHelper'
    );
  }

  /**
   * Navigate to the previous section
   */
  async goToPreviousSection(): Promise<boolean> {
    return logOperation(
      'Navigate to previous section',
      () => this.sectionNavigator.previous(),
      'SCEHelper'
    );
  }

  // ==========================================
  // FIELD FILLING (Angular Material Pattern)
  // ==========================================
  async fillField(selector: string, value: string, fieldName = 'field'): Promise<void> {
    const result = await withErrorHandling(
      `Fill ${fieldName}`,
      async () => {
        const element = document.querySelector(selector) as HTMLInputElement;

        if (!element) {
          throw new ElementNotFoundError(selector, fieldName);
        }

        console.log(`Filling ${fieldName}:`, value);

        // Focus with click (critical for Angular)
        element.focus();
        element.click();
        await sleep(150);

        // Clear existing value
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);

        // Use native setter for Angular to detect
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(element, value);
        } else {
          element.value = value;
        }

        // Trigger comprehensive events
        element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

        // Wait for Angular to process
        await sleep(300);

        // Verify value was set
        if (element.value !== value) {
          console.warn(`Field ${fieldName} not set correctly, retrying...`);
          // Retry with simpler approach
          await sleep(200);
          element.focus();
          element.value = value;
          element.dispatchEvent(new InputEvent('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(200);
        }

        element.blur();

        return value;
      },
      `SCEHelper.fillField`
    );

    if (!result.success) {
      const suggestion = getSuggestedFix(result.error);
      console.error(`Failed to fill ${fieldName}:`, result.error.message);
      if (suggestion) {
        console.info(`Suggested fix: ${suggestion}`);
      }
      throw result.error;
    }
  }

  // ==========================================
  // DROPDOWN SELECTION (Angular Material Pattern)
  // ==========================================
  async fillSelect(selector: string, value: string, byLabel = false): Promise<void> {
    console.log(`Selecting dropdown value:`, value);

    // Find dropdown element
    let trigger: HTMLElement | null = null;

    if (byLabel) {
      // Find by label text
      const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));
      const label = labels.find(l => l.textContent?.trim() === value || l.textContent?.includes(value));
      if (label) {
        const formField = label.closest('mat-form-field');
        trigger = formField?.querySelector('mat-select') as HTMLElement;
      }
    } else {
      trigger = document.querySelector(selector) as HTMLElement;
    }

    if (!trigger) {
      throw new Error(`Select not found: ${selector}`);
    }

    // Click to open dropdown
    trigger.click();
    await sleep(500);

    // Options appear in .cdk-overlay-container (outside form)
    const options = Array.from(document.querySelectorAll('mat-option'));

    // Case-insensitive search
    const option = options.find(o => {
      const text = o.textContent?.trim().toLowerCase() || '';
      return text === value.toLowerCase();
    });

    if (!option) {
      console.error('Available options:', options.map(o => o.textContent?.trim()));
      throw new Error(`Option not found: ${value}`);
    }

    (option as HTMLElement).click();

    // Wait for Angular stability
    await sleep(300);
  }

  // ==========================================
  // UTILITY: Find Input by mat-label
  // ==========================================
  findInputByMatLabel(labelText: string): HTMLInputElement | null {
    const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));

    // Exact match first
    let label = labels.find(l => l.textContent?.trim() === labelText);

    // Fallback to partial match
    if (!label) {
      label = labels.find(l => l.textContent?.includes(labelText));
    }

    if (!label) {
      return null;
    }

    const formField = label.closest('mat-form-field');

    // Try to find input
    let input = formField?.querySelector('input.mat-input-element, input.mat-input');

    // Fallback to any input
    if (!input) {
      input = formField?.querySelector('input');
    }

    return input as HTMLInputElement | null;
  }

  // ==========================================
  // UTILITY: Wait for Element
  // ==========================================
  waitForElement(
    selector: string,
    timeout = 10000,
    parent: Element | Document = document
  ): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = parent.querySelector(selector);

      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = parent.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(parent, {
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
  // CUSTOMER SEARCH
  // ==========================================
  async fillCustomerSearch(data: CustomerSearchData): Promise<void> {
    await this.fillField('input[name="streetNum"]', data.address.split(' ')[0], 'Street Number');
    await this.fillField('input[name="streetName"]', data.address.split(' ').slice(1).join(' '), 'Street Name');
    await this.fillField('input[name="zip"]', data.zipCode, 'ZIP Code');
  }

  // ==========================================
  // CUSTOMER INFO
  // ==========================================
  async fillCustomerInfo(data: CustomerInfoData): Promise<void> {
    await this.fillField('input[name="firstName"]', data.firstName, 'First Name');
    await this.fillField('input[name="lastName"]', data.lastName, 'Last Name');
    await this.fillField('input[name="phone"]', data.phone, 'Phone');

    if (data.email) {
      await this.fillField('input[name="email"]', data.email, 'Email');
    }
  }

  // ==========================================
  // NAVIGATION
  // ==========================================
  async clickNext(): Promise<void> {
    const nextButton = document.querySelector('button[type="submit"], .btn-next');

    if (nextButton) {
      (nextButton as HTMLElement).click();
      await sleep(1000);
    } else {
      throw new Error('Next button not found');
    }
  }

  // ==========================================
  // DOCUMENT UPLOADS (Enhanced)
  // ==========================================
  async uploadDocuments(documents: DocumentData[]): Promise<void> {
    console.log(`Uploading ${documents.length} documents`);

    for (const doc of documents) {
      try {
        // Fetch file as blob
        const response = await fetch(doc.url);

        if (!response.ok) {
          throw new Error(`Failed to fetch ${doc.url}: ${response.status}`);
        }

        const blob = await response.blob();

        // Convert to File
        const file = new File([blob], doc.name, { type: doc.type });

        // Find file input (try multiple selectors)
        let input = document.querySelector('input[type="file"]') as HTMLInputElement;

        if (!input) {
          throw new Error('File input not found');
        }

        // Create DataTransfer
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;

        // Trigger change event
        input.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`Uploaded: ${doc.name}`);

        await sleep(500);
      } catch (error) {
        console.error(`Failed to upload ${doc.name}:`, error);
        throw error;
      }
    }
  }

  // ==========================================
  // ADDITIONAL CUSTOMER INFO
  // ==========================================
  async fillAdditionalCustomerInfo(data: Partial<AdditionalCustomerInfo>): Promise<boolean> {
    const helper = new SCEHelper();

    const results = await Promise.allSettled([
      // Dropdown fields
      data.title ? helper.fillSelect('', data.title, true) : Promise.resolve(),
      data.preferredContactTime ? helper.fillSelect('', data.preferredContactTime, true) : Promise.resolve(),
      data.language ? helper.fillSelect('', data.language, true) : Promise.resolve(),
      data.ethnicity ? helper.fillSelect('', data.ethnicity, true) : Promise.resolve(),
      data.howDidYouHear ? helper.fillSelect('', data.howDidYouHear, true) : Promise.resolve(),
      data.masterMetered ? helper.fillSelect('', data.masterMetered, true) : Promise.resolve(),
      data.buildingType ? helper.fillSelect('', data.buildingType, true) : Promise.resolve(),
      data.homeownerStatus ? helper.fillSelect('', data.homeownerStatus, true) : Promise.resolve(),
      data.gasProvider ? helper.fillSelect('', data.gasProvider, true) : Promise.resolve(),
      data.waterUtility ? helper.fillSelect('', data.waterUtility, true) : Promise.resolve(),
      data.permanentlyDisabled ? helper.fillSelect('', data.permanentlyDisabled, true) : Promise.resolve(),
      data.veteran ? helper.fillSelect('', data.veteran, true) : Promise.resolve(),
      data.nativeAmerican ? helper.fillSelect('', data.nativeAmerican, true) : Promise.resolve(),
      // Text input fields
      data.householdUnits ? helper.fillField('', data.householdUnits, 'Number of Units') : Promise.resolve(),
      data.spaceOrUnit ? helper.fillField('', data.spaceOrUnit, 'Space/Unit') : Promise.resolve(),
      data.gasAccountNumber ? helper.fillField('', data.gasAccountNumber, 'Gas Account Number') : Promise.resolve(),
      data.incomeVerifiedDate ? helper.fillField('', data.incomeVerifiedDate, 'Income Verified Date') : Promise.resolve(),
      data.primaryApplicantAge ? helper.fillField('', data.primaryApplicantAge, 'Primary Applicant Age') : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // PROJECT INFO
  // ==========================================
  async fillProjectInfo(data: Partial<ProjectInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.squareFootage ? this.fillField('', data.squareFootage, 'Square Footage') : Promise.resolve(),
      data.yearBuilt ? this.fillField('', data.yearBuilt, 'Year Built') : Promise.resolve(),
      data.propertyType ? this.fillSelect('', data.propertyType, true) : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // TRADE ALLY INFO
  // ==========================================
  async fillTradeAllyInfo(data: Partial<TradeAllyInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.firstName ? this.fillField('', data.firstName, 'First Name') : Promise.resolve(),
      data.lastName ? this.fillField('', data.lastName, 'Last Name') : Promise.resolve(),
      data.title ? this.fillField('', data.title, 'Title') : Promise.resolve(),
      data.phone ? this.fillField('', data.phone, 'Phone') : Promise.resolve(),
      data.email ? this.fillField('', data.email, 'Email') : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // ASSESSMENT INFO
  // ==========================================
  async fillAssessmentInfo(data: Partial<AssessmentInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.hasAttic ? this.fillSelect('', data.hasAttic, true) : Promise.resolve(),
      data.hasBasement ? this.fillSelect('', data.hasBasement, true) : Promise.resolve(),
      data.hasCrawlspace ? this.fillSelect('', data.hasCrawlspace, true) : Promise.resolve(),
      data.heatingType ? this.fillSelect('', data.heatingType, true) : Promise.resolve(),
      data.coolingType ? this.fillSelect('', data.coolingType, true) : Promise.resolve(),
      data.waterHeaterType ? this.fillSelect('', data.waterHeaterType, true) : Promise.resolve(),
      data.windowType ? this.fillSelect('', data.windowType, true) : Promise.resolve(),
      data.insulationLevel ? this.fillSelect('', data.insulationLevel, true) : Promise.resolve(),
      data.hasSolar ? this.fillSelect('', data.hasSolar, true) : Promise.resolve(),
      data.hasPool ? this.fillSelect('', data.hasPool, true) : Promise.resolve(),
      data.notes ? this.fillField('', data.notes, 'Notes') : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // HOUSEHOLD INFO
  // ==========================================
  async fillHouseholdInfo(data: Partial<HouseholdInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.householdSize ? this.fillField('', data.householdSize, 'Household Size') : Promise.resolve(),
      data.incomeLevel ? this.fillSelect('', data.incomeLevel, true) : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // ENROLLMENT INFO
  // ==========================================
  async fillEnrollmentInfo(data: Partial<EnrollmentInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.enrollmentDate ? this.fillField('', data.enrollmentDate, 'Enrollment Date') : Promise.resolve(),
      data.programSource ? this.fillSelect('', data.programSource, true) : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // EQUIPMENT INFO
  // ==========================================
  async fillEquipmentInfo(data: Partial<EquipmentInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.primaryHeating ? this.fillSelect('', data.primaryHeating, true) : Promise.resolve(),
      data.primaryCooling ? this.fillSelect('', data.primaryCooling, true) : Promise.resolve(),
      data.waterHeater ? this.fillSelect('', data.waterHeater, true) : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // BASIC ENROLLMENT INFO
  // ==========================================
  async fillBasicEnrollmentInfo(data: Partial<BasicEnrollmentInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.utilityAccount ? this.fillField('', data.utilityAccount, 'Utility Account') : Promise.resolve(),
      data.rateSchedule ? this.fillSelect('', data.rateSchedule, true) : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // BONUS INFO
  // ==========================================
  async fillBonusInfo(data: Partial<BonusInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.bonusProgram ? this.fillSelect('', data.bonusProgram, true) : Promise.resolve(),
      data.bonusAmount ? this.fillField('', data.bonusAmount, 'Bonus Amount') : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // TERMS INFO
  // ==========================================
  async fillTermsInfo(data: Partial<TermsInfo>): Promise<boolean> {
    // Terms acceptance is typically a checkbox
    if (data.termsAccepted) {
      const termsCheckbox = document.querySelector('input[type="checkbox"][id*="term"], input[type="checkbox"][id*="agree"]') as HTMLInputElement;
      if (termsCheckbox && !termsCheckbox.checked) {
        termsCheckbox.click();
      }
    }

    if (data.consentDate) {
      await this.fillField('', data.consentDate, 'Consent Date');
    }

    return true;
  }

  // ==========================================
  // COMMENTS INFO
  // ==========================================
  async fillCommentsInfo(data: Partial<CommentsInfo>): Promise<boolean> {
    if (data.comments) {
      const textarea = document.querySelector('textarea[name*="comment"], textarea[id*="comment"]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = data.comments;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        await this.fillField('', data.comments, 'Comments');
      }
    }
    return true;
  }

  // ==========================================
  // STATUS INFO
  // ==========================================
  async fillStatusInfo(data: Partial<StatusInfo>): Promise<boolean> {
    const results = await Promise.allSettled([
      data.applicationStatus ? this.fillSelect('', data.applicationStatus, true) : Promise.resolve(),
      data.lastUpdated ? this.fillField('', data.lastUpdated, 'Last Updated') : Promise.resolve(),
    ]);

    return results.every(r => r.status === 'fulfilled');
  }

  // ==========================================
  // FILL ALL SECTIONS
  // ==========================================
  /**
   * Fill all form sections with provided data
   * @param sections - Object containing all section data
   */
  async fillAllSections(sections: {
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
  }): Promise<{
    successful: string[];
    failed: Array<{ section: string; error: string }>;
  }> {
    console.log('Filling all sections...');

    // Build operations list
    const operations: Array<{ name: string; fn: () => Promise<boolean> }> = [];

    if (sections.additionalInfo) {
      operations.push({ name: 'Additional Customer Info', fn: () => this.fillAdditionalCustomerInfo(sections.additionalInfo!) });
    }
    if (sections.projectInfo) {
      operations.push({ name: 'Project Info', fn: () => this.fillProjectInfo(sections.projectInfo!) });
    }
    if (sections.tradeAllyInfo) {
      operations.push({ name: 'Trade Ally Info', fn: () => this.fillTradeAllyInfo(sections.tradeAllyInfo!) });
    }
    if (sections.assessmentInfo) {
      operations.push({ name: 'Assessment Questionnaire', fn: () => this.fillAssessmentInfo(sections.assessmentInfo!) });
    }
    if (sections.householdInfo) {
      operations.push({ name: 'Household Members', fn: () => this.fillHouseholdInfo(sections.householdInfo!) });
    }
    if (sections.enrollmentInfo) {
      operations.push({ name: 'Enrollment Information', fn: () => this.fillEnrollmentInfo(sections.enrollmentInfo!) });
    }
    if (sections.equipmentInfo) {
      operations.push({ name: 'Equipment Information', fn: () => this.fillEquipmentInfo(sections.equipmentInfo!) });
    }
    if (sections.basicEnrollmentInfo) {
      operations.push({ name: 'Basic Enrollment', fn: () => this.fillBasicEnrollmentInfo(sections.basicEnrollmentInfo!) });
    }
    if (sections.bonusInfo) {
      operations.push({ name: 'Bonus Program', fn: () => this.fillBonusInfo(sections.bonusInfo!) });
    }
    if (sections.termsInfo) {
      operations.push({ name: 'Terms and Conditions', fn: () => this.fillTermsInfo(sections.termsInfo!) });
    }
    if (sections.commentsInfo) {
      operations.push({ name: 'Comments', fn: () => this.fillCommentsInfo(sections.commentsInfo!) });
    }
    if (sections.statusInfo) {
      operations.push({ name: 'Status', fn: () => this.fillStatusInfo(sections.statusInfo!) });
    }

    // Execute all operations with error collection
    const results = await withErrorCollection(operations);

    // Log summary
    console.log(`All sections filling complete:`, {
      successful: results.successful.length,
      failed: results.failed.length,
    });

    if (results.failed.length > 0) {
      console.warn('Failed sections:', results.failed.map(f => `${f.name}: ${f.error.message}`));

      // Log errors for debugging
      for (const failure of results.failed) {
        logError(failure.error, `fillAllSections - ${failure.name}`);
        const suggestion = getSuggestedFix(failure.error);
        if (suggestion) {
          console.info(`Suggested fix for ${failure.name}: ${suggestion}`);
        }
      }
    }

    return {
      successful: results.successful.map(s => s.name),
      failed: results.failed.map(f => ({ section: f.name, error: f.error.message })),
    };
  }
}

// ==========================================
// HELPER FUNCTIONS (Standalone)
// ==========================================

/**
 * Set dropdown field by label text
 * @param labelText - The label text to find the dropdown
 * @param value - The value to select
 */
export async function setDropdown(labelText: string, value?: string): Promise<void> {
  if (!value) return Promise.resolve();

  const helper = new SCEHelper();
  return helper.fillSelect('', value, true);
}

/**
 * Set input field value by label text
 * @param labelText - The label text to find the input
 * @param value - The value to set
 */
export async function setInputValue(labelText: string, value?: string): Promise<void> {
  if (!value) return Promise.resolve();

  const helper = new SCEHelper();
  return helper.fillField('', value, labelText);
}

/**
 * Fill Additional Customer Information section
 * @param data - Additional customer data
 */
export async function fillAdditionalCustomerInfo(
  data: Partial<AdditionalCustomerInfo>
): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillAdditionalCustomerInfo(data);
}

/**
 * Fill Project Information section
 * @param data - Project data
 */
export async function fillProjectInfo(data: Partial<ProjectInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillProjectInfo(data);
}

/**
 * Fill Trade Ally Information section
 * @param data - Trade ally data
 */
export async function fillTradeAllyInfo(data: Partial<TradeAllyInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillTradeAllyInfo(data);
}

/**
 * Fill Assessment Questionnaire section
 * @param data - Assessment data
 */
export async function fillAssessmentInfo(data: Partial<AssessmentInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillAssessmentInfo(data);
}

/**
 * Fill Household Members section
 * @param data - Household data
 */
export async function fillHouseholdInfo(data: Partial<HouseholdInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillHouseholdInfo(data);
}

/**
 * Fill Enrollment Information section
 * @param data - Enrollment data
 */
export async function fillEnrollmentInfo(data: Partial<EnrollmentInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillEnrollmentInfo(data);
}

/**
 * Fill Equipment Information section
 * @param data - Equipment data
 */
export async function fillEquipmentInfo(data: Partial<EquipmentInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillEquipmentInfo(data);
}

/**
 * Fill Basic Enrollment section
 * @param data - Basic enrollment data
 */
export async function fillBasicEnrollmentInfo(data: Partial<BasicEnrollmentInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillBasicEnrollmentInfo(data);
}

/**
 * Fill Bonus Program section
 * @param data - Bonus data
 */
export async function fillBonusInfo(data: Partial<BonusInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillBonusInfo(data);
}

/**
 * Fill Terms and Conditions section
 * @param data - Terms data
 */
export async function fillTermsInfo(data: Partial<TermsInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillTermsInfo(data);
}

/**
 * Fill Comments section
 * @param data - Comments data
 */
export async function fillCommentsInfo(data: Partial<CommentsInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillCommentsInfo(data);
}

/**
 * Fill Status section
 * @param data - Status data
 */
export async function fillStatusInfo(data: Partial<StatusInfo>): Promise<boolean> {
  const helper = new SCEHelper();
  return helper.fillStatusInfo(data);
}

/**
 * Fill all sections at once
 * @param sections - All section data
 * @returns Result with successful and failed sections
 */
export async function fillAllSections(sections: {
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
}): Promise<{
  successful: string[];
  failed: Array<{ section: string; error: string }>;
}> {
  const helper = new SCEHelper();
  return helper.fillAllSections(sections);
}
