/**
 * SCE Helper — reliable form-filling for the SCE rebate website.
 *
 * Uses dom-utils for:
 *  - qaanchor / mat-label field lookup (not input[name] which doesn't exist)
 *  - Framework-safe value setter (native prototype setter + events)
 *  - waitForReady instead of fixed sleep()
 *  - Overlay-aware dropdown selection with retry
 */

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
  fillFieldByLabel,
  selectDropdownByLabel,
  clickCheckbox,
  fillDateField,
  clickAddButton,
  findField,
  waitForReady,
  waitForElement,
} from './dom-utils.js';
import {
  withErrorCollection,
  logOperation,
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

export interface DocumentData {
  url: string;
  name: string;
  type: string;
}

// Re-export sleep for backward compat
export { sleep } from './dom-utils.js';

// ==========================================
// SCE HELPER CLASS
// ==========================================

export class SCEHelper {
  private sectionNavigator: SectionNavigator;
  private signal?: AbortSignal;

  constructor(signal?: AbortSignal) {
    this.sectionNavigator = new SectionNavigator();
    this.signal = signal;
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  getNavigator(): SectionNavigator {
    return this.sectionNavigator;
  }

  async goToSection(sectionName: SectionName): Promise<boolean> {
    return logOperation(
      `Navigate to ${sectionName}`,
      () => this.sectionNavigator.goTo(sectionName),
      'SCEHelper'
    );
  }

  // ==========================================
  // FIELD FILLING (label-based, framework-safe)
  // ==========================================

  async fillField(labelOrAnchor: string, value: string, _fieldName?: string): Promise<void> {
    await fillFieldByLabel(labelOrAnchor, value, this.signal);
  }

  async fillSelect(labelOrAnchor: string, value: string, _byLabel?: boolean): Promise<void> {
    await selectDropdownByLabel(labelOrAnchor, value, this.signal);
  }

  /**
   * Find input by mat-label text (backward compat wrapper around dom-utils.findField)
   */
  findInputByMatLabel(labelText: string): HTMLInputElement | null {
    return findField(labelText) as HTMLInputElement | null;
  }

  /**
   * Wait for element (backward compat wrapper)
   */
  waitForElement(
    selector: string,
    timeout = 10000,
    parent: Element | Document = document
  ): Promise<Element> {
    return waitForElement(selector, timeout, parent);
  }

  // ==========================================
  // CUSTOMER SEARCH
  // ==========================================

  async fillCustomerSearch(data: CustomerSearchData): Promise<void> {
    const parts = data.address.split(' ');
    const streetNum = parts[0];
    const streetName = parts.slice(1).join(' ');

    // The customer search form uses qaanchor or specific labels
    await fillFieldByLabel('Street Number', streetNum, this.signal);
    await fillFieldByLabel('Street Name', streetName, this.signal);
    await fillFieldByLabel('Zip Code', data.zipCode, this.signal);
  }

  // ==========================================
  // CUSTOMER INFO
  // ==========================================

  async fillCustomerInfo(data: CustomerInfoData): Promise<void> {
    await fillFieldByLabel('First Name', data.firstName, this.signal);
    await fillFieldByLabel('Last Name', data.lastName, this.signal);
    await fillFieldByLabel('Phone', data.phone, this.signal);
    if (data.email) {
      await fillFieldByLabel('Email', data.email, this.signal);
    }
  }

  // ==========================================
  // CLICK NEXT / NAVIGATION BUTTONS
  // ==========================================

  async clickNext(): Promise<void> {
    const selectors = [
      'button[type="submit"]',
      '.btn-next',
      'button.mat-raised-button[color="primary"]',
    ];

    for (const sel of selectors) {
      const btn = document.querySelector(sel) as HTMLButtonElement;
      if (btn && !btn.disabled) {
        btn.click();
        await waitForReady(3000);
        return;
      }
    }

    throw new Error('Next/Submit button not found');
  }

  // ==========================================
  // DOCUMENT UPLOADS
  // ==========================================

  async uploadDocuments(documents: DocumentData[]): Promise<void> {
    for (const doc of documents) {
      const response = await fetch(doc.url);
      if (!response.ok) throw new Error(`Failed to fetch ${doc.url}: ${response.status}`);

      const blob = await response.blob();
      const file = new File([blob], doc.name, { type: doc.type });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (!input) throw new Error('File input not found');

      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await waitForReady(2000);
    }
  }

  // ==========================================
  // ADDITIONAL CUSTOMER INFO
  // ==========================================

  async fillAdditionalCustomerInfo(data: Partial<AdditionalCustomerInfo>): Promise<boolean> {
    const ops: Array<{ name: string; fn: () => Promise<boolean> }> = [];

    // Dropdowns
    const dropdowns: Array<[keyof AdditionalCustomerInfo, string]> = [
      ['title', 'Title'],
      ['preferredContactTime', 'Preferred Contact Time'],
      ['language', 'Language'],
      ['ethnicity', 'Ethnicity'],
      ['howDidYouHear', 'How Did You Hear'],
      ['masterMetered', 'Master Metered'],
      ['buildingType', 'Building Type'],
      ['homeownerStatus', 'Homeowner Status'],
      ['gasProvider', 'Gas Provider'],
      ['waterUtility', 'Water Utility'],
      ['permanentlyDisabled', 'Permanently Disabled'],
      ['veteran', 'Veteran'],
      ['nativeAmerican', 'Native American'],
    ];

    for (const [key, label] of dropdowns) {
      const val = data[key];
      if (val) {
        ops.push({
          name: label,
          fn: async () => { await selectDropdownByLabel(label, val, this.signal); return true; },
        });
      }
    }

    // Text inputs
    const textFields: Array<[keyof AdditionalCustomerInfo, string]> = [
      ['householdUnits', 'Household Units'],
      ['spaceOrUnit', 'Space/Unit'],
      ['gasAccountNumber', 'Gas Account Number'],
      ['incomeVerifiedDate', 'Income Verified Date'],
      ['primaryApplicantAge', 'Primary Applicant Age'],
    ];

    for (const [key, label] of textFields) {
      const val = data[key];
      if (val) {
        ops.push({
          name: label,
          fn: async () => { await fillFieldByLabel(label, val, this.signal); return true; },
        });
      }
    }

    // Fill sequentially (dropdowns must close before next opens)
    for (const op of ops) {
      try {
        await op.fn();
      } catch (e) {
        console.warn(`[AdditionalCustomerInfo] Failed: ${op.name}:`, (e as Error).message);
      }
    }

    return true;
  }

  // ==========================================
  // PROJECT INFO
  // ==========================================

  async fillProjectInfo(data: Partial<ProjectInfo>): Promise<boolean> {
    if (data.squareFootage) await fillFieldByLabel('Square Footage', data.squareFootage, this.signal).catch(e => console.warn('[ProjectInfo]', e));
    if (data.yearBuilt) await fillFieldByLabel('Year Built', data.yearBuilt, this.signal).catch(e => console.warn('[ProjectInfo]', e));
    if (data.propertyType) await selectDropdownByLabel('Property Type', data.propertyType, this.signal).catch(e => console.warn('[ProjectInfo]', e));
    return true;
  }

  // ==========================================
  // TRADE ALLY INFO
  // ==========================================

  async fillTradeAllyInfo(data: Partial<TradeAllyInfo>): Promise<boolean> {
    if (data.firstName) await fillFieldByLabel('First Name', data.firstName, this.signal).catch(e => console.warn('[TradeAlly]', e));
    if (data.lastName) await fillFieldByLabel('Last Name', data.lastName, this.signal).catch(e => console.warn('[TradeAlly]', e));
    if (data.title) await fillFieldByLabel('Title', data.title, this.signal).catch(e => console.warn('[TradeAlly]', e));
    if (data.phone) await fillFieldByLabel('Phone', data.phone, this.signal).catch(e => console.warn('[TradeAlly]', e));
    if (data.email) await fillFieldByLabel('Email', data.email, this.signal).catch(e => console.warn('[TradeAlly]', e));
    return true;
  }

  // ==========================================
  // ASSESSMENT INFO
  // ==========================================

  async fillAssessmentInfo(data: Partial<AssessmentInfo>): Promise<boolean> {
    const dropdowns: Array<[keyof AssessmentInfo, string]> = [
      ['hasAttic', 'Attic Access'],
      ['hasBasement', 'Basement'],
      ['hasCrawlspace', 'Crawlspace'],
      ['heatingType', 'Heating Type'],
      ['coolingType', 'Cooling Type'],
      ['waterHeaterType', 'Water Heater Type'],
      ['windowType', 'Window Type'],
      ['insulationLevel', 'Insulation Level'],
      ['hasSolar', 'Solar Panels'],
      ['hasPool', 'Swimming Pool'],
    ];

    for (const [key, label] of dropdowns) {
      const val = data[key];
      if (val) {
        await selectDropdownByLabel(label, val, this.signal).catch(e => console.warn('[Assessment]', e));
      }
    }

    if (data.notes) await fillFieldByLabel('Notes', data.notes, this.signal).catch(e => console.warn('[Assessment]', e));
    return true;
  }

  // ==========================================
  // HOUSEHOLD INFO
  // ==========================================

  async fillHouseholdInfo(data: Partial<HouseholdInfo>): Promise<boolean> {
    // Household Members section may require clicking an Add button first
    try {
      await clickAddButton(this.signal);
    } catch {
      // Add button might not exist or already clicked
    }

    if (data.householdSize) await fillFieldByLabel('Household Size', data.householdSize, this.signal).catch(e => console.warn('[Household]', e));
    if (data.incomeLevel) await selectDropdownByLabel('Income Level', data.incomeLevel, this.signal).catch(e => console.warn('[Household]', e));
    return true;
  }

  // ==========================================
  // ENROLLMENT INFO
  // ==========================================

  async fillEnrollmentInfo(data: Partial<EnrollmentInfo>): Promise<boolean> {
    if (data.enrollmentDate) await fillDateField('Enrollment Date', data.enrollmentDate, this.signal).catch(e => console.warn('[Enrollment]', e));
    if (data.programSource) await selectDropdownByLabel('Program Source', data.programSource, this.signal).catch(e => console.warn('[Enrollment]', e));
    return true;
  }

  // ==========================================
  // EQUIPMENT INFO
  // ==========================================

  async fillEquipmentInfo(data: Partial<EquipmentInfo>): Promise<boolean> {
    if (data.primaryHeating) await selectDropdownByLabel('Primary Heating', data.primaryHeating, this.signal).catch(e => console.warn('[Equipment]', e));
    if (data.primaryCooling) await selectDropdownByLabel('Primary Cooling', data.primaryCooling, this.signal).catch(e => console.warn('[Equipment]', e));
    if (data.waterHeater) await selectDropdownByLabel('Water Heater', data.waterHeater, this.signal).catch(e => console.warn('[Equipment]', e));
    return true;
  }

  // ==========================================
  // BASIC ENROLLMENT INFO
  // ==========================================

  async fillBasicEnrollmentInfo(data: Partial<BasicEnrollmentInfo>): Promise<boolean> {
    if (data.utilityAccount) await fillFieldByLabel('Utility Account', data.utilityAccount, this.signal).catch(e => console.warn('[BasicEnrollment]', e));
    if (data.rateSchedule) await selectDropdownByLabel('Rate Schedule', data.rateSchedule, this.signal).catch(e => console.warn('[BasicEnrollment]', e));
    return true;
  }

  // ==========================================
  // BONUS INFO
  // ==========================================

  async fillBonusInfo(data: Partial<BonusInfo>): Promise<boolean> {
    if (data.bonusProgram) await selectDropdownByLabel('Bonus Program', data.bonusProgram, this.signal).catch(e => console.warn('[Bonus]', e));
    if (data.bonusAmount) await fillFieldByLabel('Bonus Amount', data.bonusAmount, this.signal).catch(e => console.warn('[Bonus]', e));
    return true;
  }

  // ==========================================
  // TERMS INFO
  // ==========================================

  async fillTermsInfo(data: Partial<TermsInfo>): Promise<boolean> {
    if (data.termsAccepted) {
      await clickCheckbox('terms', true, this.signal).catch(e => console.warn('[Terms]', e));
    }
    if (data.consentDate) {
      await fillDateField('Consent Date', data.consentDate, this.signal).catch(e => console.warn('[Terms]', e));
    }
    return true;
  }

  // ==========================================
  // COMMENTS INFO
  // ==========================================

  async fillCommentsInfo(data: Partial<CommentsInfo>): Promise<boolean> {
    if (data.comments) {
      await fillFieldByLabel('Comments', data.comments, this.signal).catch(e => console.warn('[Comments]', e));
    }
    return true;
  }

  // ==========================================
  // STATUS INFO
  // ==========================================

  async fillStatusInfo(data: Partial<StatusInfo>): Promise<boolean> {
    if (data.applicationStatus) await selectDropdownByLabel('Application Status', data.applicationStatus, this.signal).catch(e => console.warn('[Status]', e));
    if (data.lastUpdated) await fillFieldByLabel('Last Updated', data.lastUpdated, this.signal).catch(e => console.warn('[Status]', e));
    return true;
  }

  // ==========================================
  // FILL ALL SECTIONS
  // ==========================================

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
    const operations: Array<{ name: string; fn: () => Promise<boolean> }> = [];

    if (sections.additionalInfo) operations.push({ name: 'Additional Customer Info', fn: () => this.fillAdditionalCustomerInfo(sections.additionalInfo!) });
    if (sections.projectInfo) operations.push({ name: 'Project Info', fn: () => this.fillProjectInfo(sections.projectInfo!) });
    if (sections.tradeAllyInfo) operations.push({ name: 'Trade Ally Info', fn: () => this.fillTradeAllyInfo(sections.tradeAllyInfo!) });
    if (sections.assessmentInfo) operations.push({ name: 'Assessment Questionnaire', fn: () => this.fillAssessmentInfo(sections.assessmentInfo!) });
    if (sections.householdInfo) operations.push({ name: 'Household Members', fn: () => this.fillHouseholdInfo(sections.householdInfo!) });
    if (sections.enrollmentInfo) operations.push({ name: 'Enrollment Information', fn: () => this.fillEnrollmentInfo(sections.enrollmentInfo!) });
    if (sections.equipmentInfo) operations.push({ name: 'Equipment Information', fn: () => this.fillEquipmentInfo(sections.equipmentInfo!) });
    if (sections.basicEnrollmentInfo) operations.push({ name: 'Basic Enrollment', fn: () => this.fillBasicEnrollmentInfo(sections.basicEnrollmentInfo!) });
    if (sections.bonusInfo) operations.push({ name: 'Bonus Program', fn: () => this.fillBonusInfo(sections.bonusInfo!) });
    if (sections.termsInfo) operations.push({ name: 'Terms and Conditions', fn: () => this.fillTermsInfo(sections.termsInfo!) });
    if (sections.commentsInfo) operations.push({ name: 'Comments', fn: () => this.fillCommentsInfo(sections.commentsInfo!) });
    if (sections.statusInfo) operations.push({ name: 'Status', fn: () => this.fillStatusInfo(sections.statusInfo!) });

    const results = await withErrorCollection(operations);

    return {
      successful: results.successful.map(s => s.name),
      failed: results.failed.map(f => ({ section: f.name, error: f.error.message })),
    };
  }
}

// ==========================================
// STANDALONE EXPORTS (backward compat)
// ==========================================

export async function setDropdown(labelText: string, value?: string): Promise<void> {
  if (!value) return;
  await selectDropdownByLabel(labelText, value);
}

export async function setInputValue(labelText: string, value?: string): Promise<void> {
  if (!value) return;
  await fillFieldByLabel(labelText, value);
}

export async function fillAdditionalCustomerInfo(data: Partial<AdditionalCustomerInfo>): Promise<boolean> {
  return new SCEHelper().fillAdditionalCustomerInfo(data);
}

export async function fillProjectInfo(data: Partial<ProjectInfo>): Promise<boolean> {
  return new SCEHelper().fillProjectInfo(data);
}

export async function fillTradeAllyInfo(data: Partial<TradeAllyInfo>): Promise<boolean> {
  return new SCEHelper().fillTradeAllyInfo(data);
}

export async function fillAssessmentInfo(data: Partial<AssessmentInfo>): Promise<boolean> {
  return new SCEHelper().fillAssessmentInfo(data);
}

export async function fillHouseholdInfo(data: Partial<HouseholdInfo>): Promise<boolean> {
  return new SCEHelper().fillHouseholdInfo(data);
}

export async function fillEnrollmentInfo(data: Partial<EnrollmentInfo>): Promise<boolean> {
  return new SCEHelper().fillEnrollmentInfo(data);
}

export async function fillEquipmentInfo(data: Partial<EquipmentInfo>): Promise<boolean> {
  return new SCEHelper().fillEquipmentInfo(data);
}

export async function fillBasicEnrollmentInfo(data: Partial<BasicEnrollmentInfo>): Promise<boolean> {
  return new SCEHelper().fillBasicEnrollmentInfo(data);
}

export async function fillBonusInfo(data: Partial<BonusInfo>): Promise<boolean> {
  return new SCEHelper().fillBonusInfo(data);
}

export async function fillTermsInfo(data: Partial<TermsInfo>): Promise<boolean> {
  return new SCEHelper().fillTermsInfo(data);
}

export async function fillCommentsInfo(data: Partial<CommentsInfo>): Promise<boolean> {
  return new SCEHelper().fillCommentsInfo(data);
}

export async function fillStatusInfo(data: Partial<StatusInfo>): Promise<boolean> {
  return new SCEHelper().fillStatusInfo(data);
}

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
  return new SCEHelper().fillAllSections(sections);
}
