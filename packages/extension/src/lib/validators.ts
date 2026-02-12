/**
 * Data Validation Utilities
 * Provides type-safe validation for all form section data
 */

// ==========================================
// VALIDATION TYPES
// ==========================================

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

export interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

export type ValidationCode =
  | 'REQUIRED'
  | 'INVALID_FORMAT'
  | 'OUT_OF_RANGE'
  | 'INVALID_EMAIL'
  | 'INVALID_PHONE'
  | 'INVALID_DATE'
  | 'INVALID_NUMBER'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'PATTERN_MISMATCH';

// ==========================================
// VALIDATORS
// ==========================================

/**
 * Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Phone number validation (US format)
 */
export function isValidPhone(phone: string): boolean {
  // Accept formats: (555) 123-4567, 555-123-4567, 5551234567
  const phoneRegex = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * ZIP code validation (US format)
 */
export function isValidZipCode(zip: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

/**
 * Date validation
 */
export function isValidDate(date: string): boolean {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Number validation
 */
export function isValidNumber(value: string): boolean {
  return !isNaN(parseFloat(value)) && isFinite(Number(value));
}

/**
 * Year validation (reasonable range)
 */
export function isValidYear(year: string | number): boolean {
  const num = typeof year === 'string' ? parseInt(year, 10) : year;
  return num >= 1800 && num <= new Date().getFullYear() + 1;
}

/**
 * Square footage validation
 */
export function isValidSquareFootage(sqft: string | number): boolean {
  const num = typeof sqft === 'string' ? parseInt(sqft, 10) : sqft;
  return num > 0 && num <= 100000; // Max 100k sqft
}

/**
 * Age validation (0-150)
 */
export function isValidAge(age: string | number): boolean {
  const num = typeof age === 'string' ? parseInt(age, 10) : age;
  return num >= 0 && num <= 150;
}

// ==========================================
// FIELD VALIDATION
// ==========================================

export interface FieldValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface FieldValidationOptions {
  label: string;
  rules: FieldValidationRule;
}

/**
 * Validate a single field
 */
export function validateField(
  value: any,
  options: FieldValidationOptions
): ValidationResult {
  const errors: ValidationError[] = [];

  // Required check
  if (options.rules.required && (!value || value.toString().trim().length === 0)) {
    errors.push({
      field: options.label,
      value,
      message: `${options.label} is required`,
      code: 'REQUIRED',
    });
    return { valid: false, errors };
  }

  // Skip remaining checks if value is empty and not required
  if (!value || value.toString().trim().length === 0) {
    return { valid: true };
  }

  const stringValue = value.toString().trim();

  // Min length
  if (options.rules.minLength && stringValue.length < options.rules.minLength) {
    errors.push({
      field: options.label,
      value,
      message: `${options.label} must be at least ${options.rules.minLength} characters`,
      code: 'TOO_SHORT',
    });
  }

  // Max length
  if (options.rules.maxLength && stringValue.length > options.rules.maxLength) {
    errors.push({
      field: options.label,
      value,
      message: `${options.label} must be no more than ${options.rules.maxLength} characters`,
      code: 'TOO_LONG',
    });
  }

  // Pattern match
  if (options.rules.pattern && !options.rules.pattern.test(stringValue)) {
    errors.push({
      field: options.label,
      value,
      message: `${options.label} format is invalid`,
      code: 'PATTERN_MISMATCH',
    });
  }

  // Custom validation
  if (options.rules.custom) {
    const customResult = options.rules.custom(value);
    if (customResult !== true) {
      errors.push({
        field: options.label,
        value,
        message: typeof customResult === 'string' ? customResult : `${options.label} is invalid`,
        code: 'INVALID_FORMAT',
      });
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ==========================================
// SECTION VALIDATION
// ==========================================

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

/**
 * Validate Additional Customer Information
 */
export function validateAdditionalCustomerInfo(
  data: Partial<AdditionalCustomerInfo>
): ValidationResult {
  const errors: ValidationError[] = [];

  // Age validation
  if (data.primaryApplicantAge && !isValidAge(data.primaryApplicantAge)) {
    errors.push({
      field: 'primaryApplicantAge',
      value: data.primaryApplicantAge,
      message: 'Age must be between 0 and 150',
      code: 'OUT_OF_RANGE',
    });
  }

  // Date validation
  if (data.incomeVerifiedDate && !isValidDate(data.incomeVerifiedDate)) {
    errors.push({
      field: 'incomeVerifiedDate',
      value: data.incomeVerifiedDate,
      message: 'Date format is invalid',
      code: 'INVALID_DATE',
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validate Project Information
 */
export function validateProjectInfo(data: Partial<ProjectInfo>): ValidationResult {
  const errors: ValidationError[] = [];

  // Square footage validation
  if (data.squareFootage && !isValidSquareFootage(data.squareFootage)) {
    errors.push({
      field: 'squareFootage',
      value: data.squareFootage,
      message: 'Square footage must be between 1 and 100000',
      code: 'OUT_OF_RANGE',
    });
  }

  // Year validation
  if (data.yearBuilt && !isValidYear(data.yearBuilt)) {
    errors.push({
      field: 'yearBuilt',
      value: data.yearBuilt,
      message: 'Year must be between 1800 and current year',
      code: 'OUT_OF_RANGE',
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validate Trade Ally Information
 */
export function validateTradeAllyInfo(data: Partial<TradeAllyInfo>): ValidationResult {
  const errors: ValidationError[] = [];

  // Email validation
  if (data.email && !isValidEmail(data.email)) {
    errors.push({
      field: 'email',
      value: data.email,
      message: 'Email format is invalid',
      code: 'INVALID_EMAIL',
    });
  }

  // Phone validation
  if (data.phone && !isValidPhone(data.phone)) {
    errors.push({
      field: 'phone',
      value: data.phone,
      message: 'Phone format is invalid',
      code: 'INVALID_PHONE',
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validate Assessment Information
 */
export function validateAssessmentInfo(_data: Partial<AssessmentInfo>): ValidationResult {
  const errors: ValidationError[] = [];

  // No specific validation needed for assessment checkboxes/selects
  // All fields are optional strings or booleans

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validate Household Information
 */
export function validateHouseholdInfo(data: Partial<HouseholdInfo>): ValidationResult {
  const errors: ValidationError[] = [];

  // Household size validation
  if (data.householdSize) {
    const size = parseInt(data.householdSize, 10);
    if (isNaN(size) || size < 1 || size > 50) {
      errors.push({
        field: 'householdSize',
        value: data.householdSize,
        message: 'Household size must be between 1 and 50',
        code: 'OUT_OF_RANGE',
      });
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validate Enrollment Information
 */
export function validateEnrollmentInfo(data: Partial<EnrollmentInfo>): ValidationResult {
  const errors: ValidationError[] = [];

  // Date validation
  if (data.enrollmentDate && !isValidDate(data.enrollmentDate)) {
    errors.push({
      field: 'enrollmentDate',
      value: data.enrollmentDate,
      message: 'Date format is invalid',
      code: 'INVALID_DATE',
    });
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validate all sections
 */
export function validateAllSections(data: {
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
}): {
  valid: boolean;
  errors: Map<string, ValidationError[]>;
} {
  const allErrors = new Map<string, ValidationError[]>();

  if (data.additionalInfo) {
    const result = validateAdditionalCustomerInfo(data.additionalInfo);
    if (!result.valid) allErrors.set('additionalInfo', result.errors);
  }

  if (data.projectInfo) {
    const result = validateProjectInfo(data.projectInfo);
    if (!result.valid) allErrors.set('projectInfo', result.errors);
  }

  if (data.tradeAllyInfo) {
    const result = validateTradeAllyInfo(data.tradeAllyInfo);
    if (!result.valid) allErrors.set('tradeAllyInfo', result.errors);
  }

  if (data.assessmentInfo) {
    const result = validateAssessmentInfo(data.assessmentInfo);
    if (!result.valid) allErrors.set('assessmentInfo', result.errors);
  }

  if (data.householdInfo) {
    const result = validateHouseholdInfo(data.householdInfo);
    if (!result.valid) allErrors.set('householdInfo', result.errors);
  }

  if (data.enrollmentInfo) {
    const result = validateEnrollmentInfo(data.enrollmentInfo);
    if (!result.valid) allErrors.set('enrollmentInfo', result.errors);
  }

  return {
    valid: allErrors.size === 0,
    errors: allErrors,
  };
}

// ==========================================
// SANITIZATION
// ==========================================

/**
 * Sanitize string input (trim and remove extra spaces)
 */
export function sanitizeString(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize phone number (remove non-digit characters)
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Sanitize ZIP code (remove non-alphanumeric characters)
 */
export function sanitizeZipCode(zip: string): string {
  return zip.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Sanitize number (remove non-numeric characters except decimal point)
 */
export function sanitizeNumber(value: string): string {
  return value.replace(/[^0-9.]/g, '');
}

/**
 * Sanitize all fields in an object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };

  for (const key in result) {
    const value = result[key];

    if (typeof value === 'string') {
      // Check if it looks like a phone number
      if (/[\d()-\s]+/.test(value) && value.replace(/\D/g, '').length >= 10) {
        result[key] = sanitizePhone(value) as any;
      }
      // Check if it looks like a ZIP code
      else if (/^\d{5}(-\d{4})?$/.test(value)) {
        result[key] = sanitizeZipCode(value) as any;
      }
      // Regular string
      else {
        result[key] = sanitizeString(value) as any;
      }
    }
  }

  return result;
}
