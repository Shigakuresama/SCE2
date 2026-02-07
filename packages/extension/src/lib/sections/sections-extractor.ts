/**
 * Unified Section Extractor
 * Extracts all form sections from the SCE website
 */

import type { AssessmentInfo } from './assessment.js';
import type { HouseholdInfo } from './household.js';
import type { EnrollmentInfo } from './enrollment.js';
import type { EquipmentInfo } from './equipment.js';
import type { BasicEnrollmentInfo } from './basic-enrollment.js';
import type { BonusInfo } from './bonus.js';
import type { TermsInfo } from './terms.js';
import type { CommentsInfo } from './comments.js';
import type { StatusInfo } from './status.js';

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
    const input = formField?.querySelector('input');
    return input?.value || undefined;
  }

  const selectedText = trigger.querySelector('span.mat-select-value-text')?.textContent?.trim();
  return selectedText || undefined;
};

// Helper to find checkbox state by label text
const getCheckboxState = (labelText: string): string | undefined => {
  const labels = Array.from(document.querySelectorAll('mat-label, label'));
  const label = labels.find(l =>
    l.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())
  );

  if (!label) return undefined;

  const formField = label.closest('mat-form-field, .mat-checkbox, .checkbox-container');
  const checkbox = formField?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

  return checkbox?.checked ? 'Yes' : 'No';
};

// ==========================================
// SECTION EXTRACTION FUNCTIONS
// ==========================================

/**
 * Extract Assessment Questionnaire section (11 fields)
 */
export function extractAssessmentInfo(): Partial<AssessmentInfo> {
  const result: Partial<AssessmentInfo> = {};

  result.hasAttic = getCheckboxState('Attic') || getDropdownValue('Attic Access');
  result.hasBasement = getCheckboxState('Basement') || getDropdownValue('Basement');
  result.hasCrawlspace = getCheckboxState('Crawlspace') || getDropdownValue('Crawlspace');
  result.heatingType = getDropdownValue('Heating Type') || getDropdownValue('Heating');
  result.coolingType = getDropdownValue('Cooling Type') || getDropdownValue('Cooling');
  result.waterHeaterType = getDropdownValue('Water Heater Type') || getDropdownValue('Water Heater');
  result.windowType = getDropdownValue('Window Type') || getDropdownValue('Windows');
  result.insulationLevel = getDropdownValue('Insulation Level') || getDropdownValue('Insulation');
  result.hasSolar = getCheckboxState('Solar') || getDropdownValue('Solar Panels');
  result.hasPool = getCheckboxState('Pool') || getDropdownValue('Swimming Pool');
  result.notes = getInputValue('Notes') || getInputValue('Comments');

  console.log('Extracted Assessment Info:', result);
  return result;
}

/**
 * Extract Household Members section (2 fields)
 */
export function extractHouseholdInfo(): Partial<HouseholdInfo> {
  const result: Partial<HouseholdInfo> = {};

  result.householdSize = getInputValue('Household Size') || getInputValue('Number of Residents');
  result.incomeLevel = getDropdownValue('Income Level') || getDropdownValue('Annual Income');

  console.log('Extracted Household Info:', result);
  return result;
}

/**
 * Extract Enrollment Information section (2 fields)
 */
export function extractEnrollmentInfo(): Partial<EnrollmentInfo> {
  const result: Partial<EnrollmentInfo> = {};

  result.enrollmentDate = getInputValue('Enrollment Date') || getInputValue('Date');
  result.programSource = getDropdownValue('Program Source') || getDropdownValue('How did you hear');

  console.log('Extracted Enrollment Info:', result);
  return result;
}

/**
 * Extract Equipment Information section (3 fields)
 */
export function extractEquipmentInfo(): Partial<EquipmentInfo> {
  const result: Partial<EquipmentInfo> = {};

  result.primaryHeating = getDropdownValue('Primary Heating') || getDropdownValue('Heating System');
  result.primaryCooling = getDropdownValue('Primary Cooling') || getDropdownValue('Cooling System');
  result.waterHeater = getDropdownValue('Water Heater') || getDropdownValue('Water Heater Type');

  console.log('Extracted Equipment Info:', result);
  return result;
}

/**
 * Extract Basic Enrollment section (2 fields)
 */
export function extractBasicEnrollmentInfo(): Partial<BasicEnrollmentInfo> {
  const result: Partial<BasicEnrollmentInfo> = {};

  result.utilityAccount = getInputValue('Utility Account') || getInputValue('Account Number');
  result.rateSchedule = getDropdownValue('Rate Schedule') || getDropdownValue('Rate');

  console.log('Extracted Basic Enrollment Info:', result);
  return result;
}

/**
 * Extract Bonus Program section (2 fields)
 */
export function extractBonusInfo(): Partial<BonusInfo> {
  const result: Partial<BonusInfo> = {};

  result.bonusProgram = getDropdownValue('Bonus Program') || getDropdownValue('Bonus');
  result.bonusAmount = getInputValue('Bonus Amount') || getInputValue('Amount');

  console.log('Extracted Bonus Info:', result);
  return result;
}

/**
 * Extract Terms and Conditions section (2 fields)
 */
export function extractTermsInfo(): Partial<TermsInfo> {
  const result: Partial<TermsInfo> = {};

  const termsCheckbox = document.querySelector('input[type="checkbox"][id*="term"], input[type="checkbox"][id*="agree"]') as HTMLInputElement | null;
  result.termsAccepted = termsCheckbox?.checked || false;

  result.consentDate = getInputValue('Consent Date') || getInputValue('Date');

  console.log('Extracted Terms Info:', result);
  return result;
}

/**
 * Extract Comments section (1 field)
 */
export function extractCommentsInfo(): Partial<CommentsInfo> {
  const result: Partial<CommentsInfo> = {};

  result.comments = getInputValue('Comments') || getInputValue('Notes') ||
    (document.querySelector('textarea[name*="comment"], textarea[id*="comment"]') as HTMLTextAreaElement | null)?.value;

  console.log('Extracted Comments Info:', result);
  return result;
}

/**
 * Extract Status section (2 fields)
 */
export function extractStatusInfo(): Partial<StatusInfo> {
  const result: Partial<StatusInfo> = {};

  result.applicationStatus = getDropdownValue('Application Status') ||
    document.querySelector('[data-testid="status"], .status-label')?.textContent?.trim() || undefined;

  result.lastUpdated = getInputValue('Last Updated') || getInputValue('Updated Date');

  console.log('Extracted Status Info:', result);
  return result;
}

/**
 * Extract all sections at once
 * Returns an object with all section data
 */
export function extractAllSections() {
  return {
    assessment: extractAssessmentInfo(),
    household: extractHouseholdInfo(),
    enrollment: extractEnrollmentInfo(),
    equipment: extractEquipmentInfo(),
    basicEnrollment: extractBasicEnrollmentInfo(),
    bonus: extractBonusInfo(),
    terms: extractTermsInfo(),
    comments: extractCommentsInfo(),
    status: extractStatusInfo(),
  };
}
