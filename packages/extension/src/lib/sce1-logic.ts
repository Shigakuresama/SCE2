/**
 * SCE1 Logic Compatibility Layer
 *
 * This module replicates the exact form-filling logic from SCE1:
 * - ZIP+4 extraction with fallbacks
 * - Email generation from customer name
 * - Default values matching SCE1
 * - Property data integration
 */

// ==========================================
// CONFIGURATION DEFAULTS (from SCE1)
// ==========================================
export const SCE1_DEFAULTS = {
  // Customer Search
  address: '22216 Seine',
  zipCode: '90716',

  // Customer Information (HOMEOWNER fields)
  firstName: 'Sergio',
  lastName: 'Correa',
  phone: '7143912727',
  email: 'scm.energysavings@gmail.com',

  // Additional Customer Information
  title: 'Outreach',
  preferredContactTime: '1:00PM - 3:30PM',
  language: 'English',
  ethnicity: 'Hispanic/Latino',
  householdUnits: '1',
  spaceOrUnit: '1',
  howDidYouHear: 'Contractor Outreach',
  masterMetered: 'Yes',
  buildingType: 'Residential',
  homeownerStatus: 'Renter/Tenant',
  gasProvider: 'SoCalGas',
  gasAccountNumber: '1',
  waterUtility: 'N/A',
  incomeVerifiedDate: '01/31/2026',

  // Demographics
  primaryApplicantAge: '44',
  permanentlyDisabled: 'No',
  veteran: 'No',
  nativeAmerican: 'No',

  // Enrollment Information
  incomeVerificationType: 'PRISM code',
  plus4Zip: '',

  // Project Information defaults (if Zillow fails)
  defaultSqFt: '1200',
  defaultYearBuilt: '1970',
  projectSpaceOrUnit: '1',

  // Trade Ally Information (CONTRACTOR fields - Sergio's info)
  projectFirstName: 'Sergio',
  projectLastName: 'Correa',
  projectTitle: 'Outreach',
  projectPhone: '7143912727',
  projectEmail: 'scm.energysavings@gmail.com',

  // Appointment Contact
  attempt1Date: '01/30/2026',
  attempt1Time: '2:00PM',

  // Assessment/Equipment
  hvacSystemType: 'Natural Gas',
  hasRoomAC: 'Yes - Room AC',
  hasEvapCooler: 'No',
  refrigeratorCount: '1',
  fridge1Year: '2022',
  hasFreezer: 'No',
  waterHeaterFuel: 'Natural Gas',
  waterHeaterSize: '40 Gal',
  hasDishwasher: 'No',
  hasClothesWasher: 'No',
  hasClothesDryer: 'Electric',
  clothesDryerType: 'Electric',
};

// ==========================================
// EMAIL GENERATION (from SCE1)
// ==========================================

/**
 * Generates a random email based on customer name
 * 80% Gmail, 20% Yahoo
 * Random 3-digit suffix
 * Multiple pattern variations
 */
export function generateEmailFromName(firstName: string, lastName: string): string {
  const digits = Math.floor(Math.random() * 900) + 100; // 100-999
  const isGmail = Math.random() < 0.8; // 80% Gmail

  const patterns = isGmail
    ? [
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}${digits}@gmail.com`,
        `${lastName.toLowerCase()}.${firstName.toLowerCase()}${digits}@gmail.com`,
        `${firstName.toLowerCase()}${lastName.toLowerCase()}${digits}@gmail.com`,
      ]
    : [
        `${firstName.toLowerCase()}_${lastName.toLowerCase()}${digits}@yahoo.com`,
      ];

  return patterns[Math.floor(Math.random() * patterns.length)];
}

// ==========================================
// ZIP+4 EXTRACTION AND FALLBACKS (from SCE1)
// ==========================================

// Global storage for extracted ZIP+4 (like SCE1's window.scePlus4Zip)
declare global {
  interface Window {
    scePlus4Zip?: string;
    sceMailingZip?: string;
    sceCustomerName?: string;
  }
}

/**
 * Extract Plus 4 from Mailing Zip field
 * Format: XXXXX-XXXX
 */
export function extractPlus4FromMailingZip(): string | null {
  const mailingZipInput = findInputByMatLabel('Mailing Zip') ||
                          findInputByMatLabel('Zip Code') ||
                          document.querySelector('input[name*="zip"], input[id*="zip"], input[placeholder*="Zip"]');

  if (mailingZipInput && mailingZipInput.value) {
    const zipValue = (mailingZipInput as HTMLInputElement).value.trim();
    if (zipValue.includes('-')) {
      const parts = zipValue.split('-');
      if (parts.length === 2 && parts[1].length === 4) {
        const plus4 = parts[1];
        window.scePlus4Zip = plus4;
        window.sceMailingZip = zipValue;
        console.log(`[ZIP+4] Extracted from Mailing Zip: ${plus4}`);
        return plus4;
      }
    }
  }

  return null;
}

/**
 * Search all readonly fields for ZIP+4 format
 * Fallback for when mailing zip doesn't have plus4
 */
export function findPlus4InReadOnlyFields(): string | null {
  const allInputs = Array.from(document.querySelectorAll('input, textarea'));

  for (const input of allInputs) {
    const value = (input as HTMLInputElement).value?.trim();
    if (value && value.match(/^\d{5}-\d{4}$/)) {
      const parts = value.split('-');
      if (parts.length === 2 && parts[1].length === 4) {
        const plus4 = parts[1];
        console.log(`[ZIP+4] Found in readonly field: ${plus4}`);
        return plus4;
      }
    }
  }

  return null;
}

/**
 * Get Plus 4 with complete fallback chain:
 * 1. Config override (config.plus4Zip)
 * 2. Extracted from mailing zip
 * 3. Search readonly fields for ZIP+4
 * 4. Last 4 digits of regular 5-digit ZIP
 */
export function getPlus4Zip(configPlus4: string, regularZip: string): string {
  // Priority 1: Config override
  if (configPlus4) {
    console.log(`[ZIP+4] Using config override: ${configPlus4}`);
    return configPlus4;
  }

  // Priority 2: Extracted from mailing zip (stored globally)
  if (window.scePlus4Zip) {
    console.log(`[ZIP+4] Using globally stored: ${window.scePlus4Zip}`);
    return window.scePlus4Zip;
  }

  // Priority 3: Extract from mailing zip now
  const extracted = extractPlus4FromMailingZip();
  if (extracted) {
    return extracted;
  }

  // Priority 4: Search readonly fields
  const readonlyPlus4 = findPlus4InReadOnlyFields();
  if (readonlyPlus4) {
    return readonlyPlus4;
  }

  // Priority 5: Last 4 digits of regular zip (final fallback)
  if (regularZip && regularZip.length === 5) {
    const plus4 = regularZip.slice(-4);
    console.log(`[ZIP+4] Using last 4 of zip as fallback: ${plus4}`);
    return plus4;
  }

  console.warn('[ZIP+4] No Plus 4 available, using empty string');
  return '';
}

// ==========================================
// CUSTOMER NAME EXTRACTION (from SCE1)
// ==========================================

/**
 * Extract customer name from SCE Customer Name field
 * Splits into first/last for later use
 */
export function extractCustomerName(): { firstName: string; lastName: string; fullName: string } | null {
  // Try multiple selectors for customer name
  const nameInput = document.querySelector('input[name*="customer"], input[name*="name"][readonly], input[placeholder*="Customer Name"]') as HTMLInputElement;

  if (!nameInput || !nameInput.value) {
    console.warn('[Customer] Customer Name field not found or empty');
    return null;
  }

  const fullName = nameInput.value.trim();
  window.sceCustomerName = fullName;

  // Split into first/last
  const parts = fullName.split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  console.log(`[Customer] Extracted: ${fullName} (${firstName} / ${lastName})`);

  return { firstName, lastName, fullName };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Find input by mat-label text
 */
function findInputByMatLabel(labelText: string): HTMLInputElement | null {
  const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));

  // Exact match first
  let label = labels.find(l => l.textContent?.trim() === labelText);

  // Fallback to partial match
  if (!label) {
    label = labels.find(l => l.textContent?.toLowerCase().includes(labelText.toLowerCase()));
  }

  if (!label) return null;

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
// PROPERTY DATA FALLBACKS
// ==========================================

/**
 * Get square footage with fallback
 */
export function getSqFt(zillowSqFt?: number): string {
  if (zillowSqFt) {
    return zillowSqFt.toString();
  }
  console.log('[Property] Using default SqFt:', SCE1_DEFAULTS.defaultSqFt);
  return SCE1_DEFAULTS.defaultSqFt;
}

/**
 * Get year built with fallback
 */
export function getYearBuilt(zillowYearBuilt?: number): string {
  if (zillowYearBuilt) {
    return zillowYearBuilt.toString();
  }
  console.log('[Property] Using default Year Built:', SCE1_DEFAULTS.defaultYearBuilt);
  return SCE1_DEFAULTS.defaultYearBuilt;
}
