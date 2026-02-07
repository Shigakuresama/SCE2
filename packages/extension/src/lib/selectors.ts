/**
 * DOM Selectors for SCE Website
 * Provides robust selector strategies for Angular Material forms
 */

// ==========================================
// SELECTOR STRATEGIES
// ==========================================

export type SelectorStrategy = 'css' | 'xpath' | 'text' | 'label';

export interface Selector {
  strategy: SelectorStrategy;
  value: string;
  fallback?: Selector;
}

// ==========================================
// FORM FIELD SELECTORS
// ==========================================

/**
 * Find input field by mat-label text
 */
export function inputByLabel(labelText: string): Selector {
  return {
    strategy: 'css',
    value: `mat-form-field:has(mat-label:text-is("${labelText}")) input`,
    fallback: {
      strategy: 'xpath',
      value: `//mat-form-field[.//mat-label[contains(text(), "${labelText}")]]//input`,
    },
  };
}

/**
 * Find mat-select by mat-label text
 */
export function selectByLabel(labelText: string): Selector {
  return {
    strategy: 'css',
    value: `mat-form-field:has(mat-label:text-is("${labelText}")) mat-select`,
    fallback: {
      strategy: 'xpath',
      value: `//mat-form-field[.//mat-label[contains(text(), "${labelText}")]]//mat-select`,
    },
  };
}

/**
 * Find checkbox by label text
 */
export function checkboxByLabel(labelText: string): Selector {
  return {
    strategy: 'css',
    value: `mat-checkbox:has(label:text-is("${labelText}")) input[type="checkbox"]`,
    fallback: {
      strategy: 'xpath',
      value: `//mat-checkbox[.//label[contains(text(), "${labelText}")]]//input[@type="checkbox"]`,
    },
  };
}

/**
 * Find textarea by label text
 */
export function textareaByLabel(labelText: string): Selector {
  return {
    strategy: 'css',
    value: `mat-form-field:has(mat-label:text-is("${labelText}")) textarea`,
    fallback: {
      strategy: 'xpath',
      value: `//mat-form-field[.//mat-label[contains(text(), "${labelText}")]]//textarea`,
    },
  };
}

// ==========================================
// NAVIGATION SELECTORS
// ==========================================

/**
 * Section menu items
 */
export const SECTION_MENU_SELECTORS = [
  '.sections-menu-item',
  '.section-nav-item',
  'mat-tab-label',
  '[data-section]',
] as const;

/**
 * Next/Previous buttons
 */
export const NAVIGATION_BUTTONS = {
  next: [
    'button[type="submit"]',
    '.btn-next',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    '[data-action="next"]',
  ],
  previous: [
    '.btn-prev',
    'button:has-text("Previous")',
    'button:has-text("Back")',
    '[data-action="prev"]',
  ],
} as const;

/**
 * Submit button
 */
export const SUBMIT_BUTTON = [
  'button[type="submit"]',
  'button:has-text("Submit")',
  'button:has-text("Complete")',
  '[data-action="submit"]',
] as const;

// ==========================================
// SECTION SPECIFIC SELECTORS
// ==========================================

/**
 * Customer Information section
 */
export const CUSTOMER_INFO = {
  firstName: inputByLabel('First Name'),
  lastName: inputByLabel('Last Name'),
  phone: inputByLabel('Phone'),
  email: inputByLabel('Email'),
  searchButton: 'button[type="submit"]',
} as const;

/**
 * Additional Customer Information section
 */
export const ADDITIONAL_CUSTOMER = {
  title: selectByLabel('Title'),
  preferredContactTime: selectByLabel('Preferred Contact Time'),
  language: selectByLabel('Language'),
  ethnicity: selectByLabel('Ethnicity'),
  householdUnits: inputByLabel('Household Units'),
  spaceOrUnit: inputByLabel('Space/Unit'),
  howDidYouHear: selectByLabel('How Did You Hear'),
  masterMetered: selectByLabel('Master Metered'),
  buildingType: selectByLabel('Building Type'),
  homeownerStatus: selectByLabel('Homeowner Status'),
  gasProvider: selectByLabel('Gas Provider'),
  gasAccountNumber: inputByLabel('Gas Account'),
  waterUtility: selectByLabel('Water Utility'),
  incomeVerifiedDate: inputByLabel('Income Verified'),
  primaryApplicantAge: inputByLabel('Primary Applicant Age'),
  permanentlyDisabled: selectByLabel('Permanently Disabled'),
  veteran: selectByLabel('Veteran'),
  nativeAmerican: selectByLabel('Native American'),
} as const;

/**
 * Project Information section
 */
export const PROJECT_INFO = {
  squareFootage: inputByLabel('Square Footage'),
  yearBuilt: inputByLabel('Year Built'),
  propertyType: selectByLabel('Property Type'),
} as const;

/**
 * Trade Ally Information section
 */
export const TRADE_ALLY = {
  firstName: inputByLabel('First Name'),
  lastName: inputByLabel('Last Name'),
  title: inputByLabel('Title'),
  phone: inputByLabel('Phone'),
  email: inputByLabel('Email'),
} as const;

/**
 * Assessment Questionnaire section
 */
export const ASSESSMENT = {
  hasAttic: checkboxByLabel('Attic'),
  hasBasement: checkboxByLabel('Basement'),
  hasCrawlspace: checkboxByLabel('Crawlspace'),
  heatingType: selectByLabel('Heating Type'),
  coolingType: selectByLabel('Cooling Type'),
  waterHeaterType: selectByLabel('Water Heater Type'),
  windowType: selectByLabel('Window Type'),
  insulationLevel: selectByLabel('Insulation Level'),
  hasSolar: checkboxByLabel('Solar'),
  hasPool: checkboxByLabel('Pool'),
  notes: textareaByLabel('Notes'),
} as const;

/**
 * Household Members section
 */
export const HOUSEHOLD = {
  householdSize: inputByLabel('Household Size'),
  incomeLevel: selectByLabel('Income Level'),
} as const;

/**
 * Enrollment Information section
 */
export const ENROLLMENT = {
  enrollmentDate: inputByLabel('Enrollment Date'),
  programSource: selectByLabel('Program Source'),
} as const;

/**
 * Equipment Information section
 */
export const EQUIPMENT = {
  primaryHeating: selectByLabel('Primary Heating'),
  primaryCooling: selectByLabel('Primary Cooling'),
  waterHeater: selectByLabel('Water Heater'),
} as const;

/**
 * Basic Enrollment section
 */
export const BASIC_ENROLLMENT = {
  utilityAccount: inputByLabel('Utility Account'),
  rateSchedule: selectByLabel('Rate Schedule'),
} as const;

/**
 * Bonus Program section
 */
export const BONUS = {
  bonusProgram: selectByLabel('Bonus Program'),
  bonusAmount: inputByLabel('Bonus Amount'),
} as const;

/**
 * Terms and Conditions section
 */
export const TERMS = {
  termsCheckbox: 'input[type="checkbox"][id*="term"], input[type="checkbox"][id*="agree"]',
  consentDate: inputByLabel('Consent Date'),
} as const;

/**
 * Comments section
 */
export const COMMENTS = {
  comments: textareaByLabel('Comments'),
} as const;

/**
 * Status section
 */
export const STATUS = {
  applicationStatus: selectByLabel('Application Status'),
  lastUpdated: inputByLabel('Last Updated'),
} as const;

// ==========================================
// UTILITY SELECTORS
// ==========================================

/**
 * Program selection buttons
 */
export const PROGRAM_BUTTON = '.program-selection-button';

/**
 * Customer name display
 */
export const CUSTOMER_NAME_DISPLAY = '.customer-name-label';

/**
 * Customer phone display
 */
export const CUSTOMER_PHONE_DISPLAY = '.customer-phone-label';

/**
 * Case ID display
 */
export const CASE_ID_DISPLAY = '.case-id-label, [data-testid="case-id"]';

/**
 * Section headers
 */
export const SECTION_HEADERS = 'h2, h3, .section-title, mat-panel-title';

/**
 * Section title active indicator
 */
export const ACTIVE_SECTION_INDICATOR = [
  '.sections-menu-item.active',
  '.section-nav-item.active',
  'mat-tab-label[aria-selected="true"]',
] as const;

// ==========================================
// DYNAMIC SELECTORS
// ==========================================

/**
 * Build a selector for finding an element by partial text match
 */
export function byTextPartial(tagName: string, text: string): string {
  return `${tagName}:has-text("${text}")`;
}

/**
 * Build a selector for finding an element by exact text match
 */
export function byTextExact(tagName: string, text: string): string {
  return `${tagName}:text-is("${text}")`;
}

/**
 * Build a selector for finding element with data attribute
 */
export function byDataAttr(attribute: string, value: string): string {
  return `[data-${attribute}="${value}"]`;
}

/**
 * Build a selector for finding element by aria attribute
 */
export function byAria(attribute: string, value: string): string {
  return `[aria-${attribute}="${value}"]`;
}

// ==========================================
// SELECTOR EXECUTION
// ==========================================

/**
 * Execute a selector strategy in the DOM
 */
export function executeSelector(selector: Selector): Element | null {
  if (selector.strategy === 'css') {
    return document.querySelector(selector.value);
  } else if (selector.strategy === 'xpath') {
    const result = document.evaluate(
      selector.value,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } else if (selector.strategy === 'text') {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements.find(el => el.textContent?.trim() === selector.value) || null;
  }

  return null;
}

/**
 * Execute selector with fallback
 */
export function executeSelectorWithFallback(selector: Selector): Element | null {
  let result = executeSelector(selector);

  if (!result && selector.fallback) {
    result = executeSelector(selector.fallback);
  }

  return result;
}

/**
 * Execute selector and return all matching elements
 */
export function executeSelectorAll(selector: Selector): Element[] {
  if (selector.strategy === 'css') {
    return Array.from(document.querySelectorAll(selector.value));
  } else if (selector.strategy === 'xpath') {
    const result = document.evaluate(
      selector.value,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    const elements: Element[] = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i);
      if (node) elements.push(node as Element);
    }
    return elements;
  }

  return [];
}

/**
 * Wait for selector to match an element
 */
export function waitForSelector(
  selector: Selector,
  timeout = 10000,
  parent: Element | Document = document
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = executeSelector.bind(parent)(selector);

    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = executeSelector.bind(parent)(selector);
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
      reject(new Error(`Selector not found within ${timeout}ms`));
    }, timeout);
  });
}
