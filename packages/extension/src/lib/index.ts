/**
 * SCE2 Extension Library - Main Export Index
 *
 * This file re-exports all utilities, types, and helpers
 * for convenient importing throughout the extension.
 *
 * @example
 * // Import everything from one place
 * import { SCEHelper, validateAllSections, SectionNavigator } from './lib';
 */

// ==========================================
// CORE HELPERS
// ==========================================
export { SCEHelper } from './sce-helper.js';
export {
  setDropdown,
  setInputValue,
  fillAdditionalCustomerInfo,
  fillProjectInfo,
  fillTradeAllyInfo,
  fillAssessmentInfo,
  fillHouseholdInfo,
  fillEnrollmentInfo,
  fillEquipmentInfo,
  fillBasicEnrollmentInfo,
  fillBonusInfo,
  fillTermsInfo,
  fillCommentsInfo,
  fillStatusInfo,
  fillAllSections,
} from './sce-helper.js';

// ==========================================
// SECTION TYPES
// ==========================================
export type { AdditionalCustomerInfo } from './sections/additional-customer.js';
export { ADDITIONAL_CUSTOMER_FIELDS } from './sections/additional-customer.js';

export type { ProjectInfo } from './sections/project.js';
export { PROJECT_FIELDS } from './sections/project.js';

export type { TradeAllyInfo } from './sections/trade-ally.js';
export { TRADE_ALLY_FIELDS } from './sections/trade-ally.js';

export type { AssessmentInfo } from './sections/assessment.js';
export { ASSESSMENT_FIELDS } from './sections/assessment.js';

export type { HouseholdInfo } from './sections/household.js';
export { HOUSEHOLD_FIELDS } from './sections/household.js';

export type { EnrollmentInfo } from './sections/enrollment.js';
export { ENROLLMENT_FIELDS } from './sections/enrollment.js';

export type { EquipmentInfo } from './sections/equipment.js';
export { EQUIPMENT_FIELDS } from './sections/equipment.js';

export type { BasicEnrollmentInfo } from './sections/basic-enrollment.js';
export { BASIC_ENROLLMENT_FIELDS } from './sections/basic-enrollment.js';

export type { BonusInfo } from './sections/bonus.js';
export { BONUS_FIELDS } from './sections/bonus.js';

export type { TermsInfo } from './sections/terms.js';
export { TERMS_FIELDS } from './sections/terms.js';

export type { CommentsInfo } from './sections/comments.js';
export { COMMENTS_FIELDS } from './sections/comments.js';

export type { StatusInfo } from './sections/status.js';
export { STATUS_FIELDS } from './sections/status.js';

// ==========================================
// SECTION EXTRACTORS
// ==========================================
export {
  extractAssessmentInfo,
  extractHouseholdInfo,
  extractEnrollmentInfo,
  extractEquipmentInfo,
  extractBasicEnrollmentInfo,
  extractBonusInfo,
  extractTermsInfo,
  extractCommentsInfo,
  extractStatusInfo,
  extractAllSections,
} from './sections/sections-extractor.js';

// ==========================================
// ZILLOW CLIENT
// ==========================================
export type { ZillowPropertyData } from './zillow-client.js';
export {
  fetchZillowData,
  fetchZillowDataWithCache,
} from './zillow-client.js';

// ==========================================
// SECTION NAVIGATOR
// ==========================================
export {
  SectionNavigator,
  type SectionName,
  getActiveSection,
  getAvailableSections,
  navigateToSection,
  isSectionAvailable,
  waitForSection,
} from './section-navigator.js';

// ==========================================
// DOM UTILITIES
// ==========================================
export {
  waitForReady,
  waitForElement,
  retry,
  setValueSafe,
  findField,
  findFormField,
  findSelect,
  fillFieldByLabel,
  selectDropdownByLabel,
  clickCheckbox,
  fillDateField,
  clickAddButton,
  clickButtonByText,
  readFieldValue,
  sleep as domSleep,
  randomDelay,
  TIMING,
} from './dom-utils.js';

// ==========================================
// ERROR HANDLING
// ==========================================
export {
  ElementNotFoundError,
  TimeoutError,
  SectionNotFoundError,
  FormValidationError,
  NetworkError,
  type Result,
  type AsyncResult,
  withErrorHandling,
  withRetry,
  withErrorCollection,
  withTimeout,
  validateNotEmpty,
  validatePattern,
  validateRange,
  validateSelector,
  safeQuerySelector,
  safeWaitForElement,
  logOperation,
  debounce,
  throttle,
  logError,
  getErrorLogs,
  clearErrorLogs,
  getRecentErrors,
  getSuggestedFix,
} from './error-handler.js';

// ==========================================
// SELECTORS
// ==========================================
export {
  type Selector,
  type SelectorStrategy,
  inputByLabel,
  selectByLabel,
  checkboxByLabel,
  textareaByLabel,
  SECTION_MENU_SELECTORS,
  NAVIGATION_BUTTONS,
  SUBMIT_BUTTON,
  CUSTOMER_INFO,
  ADDITIONAL_CUSTOMER,
  PROJECT_INFO,
  TRADE_ALLY,
  ASSESSMENT,
  HOUSEHOLD,
  ENROLLMENT,
  EQUIPMENT,
  BASIC_ENROLLMENT,
  BONUS,
  TERMS,
  COMMENTS,
  STATUS,
  PROGRAM_BUTTON,
  CUSTOMER_NAME_DISPLAY,
  CUSTOMER_PHONE_DISPLAY,
  CASE_ID_DISPLAY,
  SECTION_HEADERS,
  ACTIVE_SECTION_INDICATOR,
  byTextPartial,
  byTextExact,
  byDataAttr,
  byAria,
  executeSelector,
  executeSelectorWithFallback,
  executeSelectorAll,
  waitForSelector,
} from './selectors.js';

// ==========================================
// VALIDATORS
// ==========================================
export {
  type ValidationResult,
  type ValidationError,
  type ValidationCode,
  type FieldValidationRule,
  type FieldValidationOptions,
  validateField,
  isValidEmail,
  isValidPhone,
  isValidZipCode,
  isValidDate,
  isValidNumber,
  isValidYear,
  isValidSquareFootage,
  isValidAge,
  validateAdditionalCustomerInfo,
  validateProjectInfo,
  validateTradeAllyInfo,
  validateAssessmentInfo,
  validateHouseholdInfo,
  validateEnrollmentInfo,
  validateAllSections,
  sanitizeString,
  sanitizePhone,
  sanitizeZipCode,
  sanitizeNumber,
  sanitizeObject,
} from './validators.js';

// ==========================================
// DATA TRANSFORMER
// ==========================================
export {
  toApiFormat,
  fromApiFormat,
  normalizePhone,
  normalizeDate,
  normalizeName,
  normalizeAddress,
  deepMerge,
  mergeWithDefaults,
  extractFirstName,
  extractLastName,
  extractAreaCode,
  extractDigits,
  deepEqual,
  getDifferences,
  serializeForStorage,
  deserializeFromStorage,
  aggregateSections,
  flattenObject,
  unflattenObject,
  generateTestData,
  generateId,
  generateTimestamp,
  isEmpty,
  hasRequiredFields,
  getMissingFields,
} from './data-transformer.js';

// ==========================================
// UTILITIES
// ==========================================
export { sleep } from './sce-helper.js';

// ==========================================
// TYPE RE-EXPORTS
// ==========================================
export type { CustomerSearchData, CustomerInfoData, DocumentData } from './sce-helper.js';
