/**
 * DOM Utilities for reliable form interaction
 * Inspired by AgnosticFiller patterns: waitForReady, retry, framework-safe setters
 */

// ==========================================
// TIMING CONFIGURATION
// ==========================================

export const TIMING = {
  betweenFields: { min: 100, max: 300 },
  betweenSections: { min: 300, max: 800 },
  afterDropdownOpen: { min: 200, max: 500 },
  afterDropdownSelect: { min: 150, max: 400 },
};

// ==========================================
// SLEEP / RANDOM DELAY
// ==========================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomDelay(range: { min: number; max: number }): Promise<void> {
  const ms = range.min + Math.random() * (range.max - range.min);
  return sleep(ms);
}

// ==========================================
// WAIT FOR DOM STABILITY (replaces fixed sleep)
// ==========================================

/**
 * Wait until the DOM stops mutating for `quietMs` milliseconds.
 * Resolves after stability or after `timeout` (whichever comes first).
 */
export function waitForReady(timeout = 5000, quietMs = 250): Promise<void> {
  return new Promise(resolve => {
    let lastMutationTime = Date.now();
    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const check = setInterval(() => {
      if (Date.now() - lastMutationTime > quietMs) {
        clearInterval(check);
        observer.disconnect();
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(check);
      observer.disconnect();
      resolve(); // Don't block forever
    }, timeout);
  });
}

// ==========================================
// WAIT FOR ELEMENT (MutationObserver-based)
// ==========================================

/**
 * Wait for an element matching `selector` to appear in the DOM.
 */
export function waitForElement(
  selector: string,
  timeout = 10000,
  parent: Element | Document = document
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = parent.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = parent.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    observer.observe(parent instanceof Document ? document.body : parent, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`waitForElement: "${selector}" not found within ${timeout}ms`));
    }, timeout);
  });
}

// ==========================================
// RETRY WITH EXPONENTIAL BACKOFF
// ==========================================

export async function retry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelay?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 500, signal } = opts;

  for (let i = 0; i < maxRetries; i++) {
    if (signal?.aborted) throw new Error('Aborted');
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`[retry] ${i + 1}/${maxRetries} after ${delay}ms:`, (error as Error).message);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

// ==========================================
// FRAMEWORK-SAFE VALUE SETTER
// ==========================================

/**
 * Set a value on an input/textarea in a way that Angular detects.
 * Uses the native prototype setter so the framework's change detection fires.
 */
export function setValueSafe(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;

  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

// ==========================================
// FIELD LOOKUP (qaanchor → mat-label → partial)
// ==========================================

/**
 * Find the nearest mat-form-field by qaanchor attribute or label text.
 */
export function findFormField(labelOrAnchor: string): Element | null {
  // Priority 1: qaanchor attribute
  const byAnchor = document.querySelector(
    `mat-form-field[qaanchor="${labelOrAnchor}"]`
  );
  if (byAnchor) return byAnchor;

  // Priority 2: mat-label exact match (strip leading * for required fields)
  const labels = Array.from(document.querySelectorAll('mat-form-field mat-label'));
  for (const label of labels) {
    const text = label.textContent?.trim().replace(/^\*\s*/, '');
    if (text === labelOrAnchor) {
      return label.closest('mat-form-field');
    }
  }

  // Priority 3: case-insensitive partial match
  for (const label of labels) {
    if (label.textContent?.toLowerCase().includes(labelOrAnchor.toLowerCase())) {
      return label.closest('mat-form-field');
    }
  }

  return null;
}

/**
 * Find an input or textarea inside a form field identified by label/qaanchor.
 */
export function findField(labelOrAnchor: string): HTMLInputElement | HTMLTextAreaElement | null {
  const formField = findFormField(labelOrAnchor);
  if (!formField) return null;

  return formField.querySelector(
    'input.mat-input-element, input.mat-mdc-input-element, input[matinput], textarea'
  ) as HTMLInputElement | HTMLTextAreaElement | null;
}

/**
 * Find a mat-select inside a form field identified by label/qaanchor.
 */
export function findSelect(labelOrAnchor: string): HTMLElement | null {
  const formField = findFormField(labelOrAnchor);
  if (!formField) return null;

  return formField.querySelector('mat-select') as HTMLElement | null;
}

// ==========================================
// RELIABLE FIELD FILLING
// ==========================================

/**
 * Fill an input/textarea field identified by label or qaanchor.
 * Uses framework-safe setter, waits for stability, verifies the value took.
 */
export async function fillFieldByLabel(
  labelOrAnchor: string,
  value: string,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new Error('Aborted');

  await retry(async () => {
    const element = findField(labelOrAnchor);
    if (!element) {
      throw new Error(`Field not found: "${labelOrAnchor}"`);
    }

    // Focus (critical for Angular)
    element.focus();
    element.click();
    await sleep(80);

    // Clear
    setValueSafe(element, '');
    await sleep(50);

    // Set value
    setValueSafe(element, value);
    await sleep(100);

    // Verify
    if (element.value !== value) {
      throw new Error(`Field "${labelOrAnchor}" value mismatch: expected "${value}", got "${element.value}"`);
    }

    element.blur();
    console.log(`[fill] ${labelOrAnchor} = "${value}"`);
  }, { maxRetries: 3, baseDelay: 300, signal });

  await randomDelay(TIMING.betweenFields);
}

// ==========================================
// RELIABLE DROPDOWN SELECTION
// ==========================================

/**
 * Select a dropdown option by label/qaanchor and option text.
 * Waits for overlay to appear, retries on failure.
 */
export async function selectDropdownByLabel(
  labelOrAnchor: string,
  optionText: string,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new Error('Aborted');

  await retry(async () => {
    const matSelect = findSelect(labelOrAnchor);
    if (!matSelect) {
      throw new Error(`Dropdown not found: "${labelOrAnchor}"`);
    }

    // Click to open
    matSelect.click();
    await randomDelay(TIMING.afterDropdownOpen);

    // Wait for overlay options
    try {
      await waitForElement('.cdk-overlay-container mat-option', 3000);
    } catch {
      throw new Error(`Dropdown overlay did not open for: "${labelOrAnchor}"`);
    }

    // Find matching option (case-insensitive, trimmed)
    const options = document.querySelectorAll('.cdk-overlay-container mat-option');
    const match = Array.from(options).find(
      o => o.textContent?.trim().toLowerCase() === optionText.toLowerCase()
    );

    if (!match) {
      // Close dropdown before failing
      const backdrop = document.querySelector('.cdk-overlay-backdrop') as HTMLElement;
      backdrop?.click();
      await sleep(200);

      const available = Array.from(options).map(o => o.textContent?.trim()).join(', ');
      throw new Error(`Option "${optionText}" not found in "${labelOrAnchor}". Available: ${available}`);
    }

    (match as HTMLElement).click();
    console.log(`[select] ${labelOrAnchor} = "${optionText}"`);

    await randomDelay(TIMING.afterDropdownSelect);
    await waitForReady(2000);
  }, { maxRetries: 2, baseDelay: 500, signal });
}

// ==========================================
// CHECKBOX HANDLING
// ==========================================

/**
 * Click a mat-checkbox identified by nearby text or qaanchor.
 */
export async function clickCheckbox(
  labelOrAnchor: string,
  checked = true,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new Error('Aborted');

  const formField = findFormField(labelOrAnchor);
  let checkbox: HTMLElement | null = null;

  if (formField) {
    checkbox = formField.querySelector('mat-checkbox') as HTMLElement;
  }

  if (!checkbox) {
    // Search by text content on mat-checkbox labels
    const allCheckboxes = Array.from(document.querySelectorAll('mat-checkbox'));
    for (const cb of allCheckboxes) {
      if (cb.textContent?.toLowerCase().includes(labelOrAnchor.toLowerCase())) {
        checkbox = cb as HTMLElement;
        break;
      }
    }
  }

  if (!checkbox) {
    throw new Error(`Checkbox not found: "${labelOrAnchor}"`);
  }

  const isChecked = checkbox.classList.contains('mat-checkbox-checked') ||
                    checkbox.classList.contains('mat-mdc-checkbox-checked');

  if ((checked && !isChecked) || (!checked && isChecked)) {
    const input = checkbox.querySelector('input[type="checkbox"]') as HTMLElement;
    (input || checkbox).click();
    await waitForReady(1000);
    console.log(`[checkbox] ${labelOrAnchor} = ${checked}`);
  }
}

// ==========================================
// DATE PICKER HANDLING
// ==========================================

/**
 * Fill a mat-datepicker field by typing the date string directly.
 */
export async function fillDateField(
  labelOrAnchor: string,
  dateStr: string,
  signal?: AbortSignal
): Promise<void> {
  // Date fields are typically regular inputs, just fill them
  await fillFieldByLabel(labelOrAnchor, dateStr, signal);
}

// ==========================================
// BUTTON CLICKING
// ==========================================

/**
 * Find and click a button by text content.
 */
export async function clickButtonByText(
  buttonText: string,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new Error('Aborted');

  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  for (const btn of buttons) {
    if (btn.textContent?.trim().toLowerCase().includes(buttonText.toLowerCase())) {
      (btn as HTMLElement).click();
      await waitForReady(2000);
      console.log(`[click] Button: "${buttonText}"`);
      return;
    }
  }

  throw new Error(`Button not found: "${buttonText}"`);
}

/**
 * Click a plus/add button (e.g., for Household Members).
 * Searches for mat-icon-button with 'add' icon.
 */
export async function clickAddButton(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error('Aborted');

  // Try multiple patterns for the add/plus button
  const selectors = [
    'button.plus.main-btn.mat-icon-button',
    'button.mat-icon-button mat-icon',
    'button[aria-label*="add" i]',
    'button[aria-label*="Add" i]',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel) as HTMLElement;
    if (el) {
      const btn = el.closest('button') || el;
      (btn as HTMLElement).click();
      await waitForReady(2000);
      console.log('[click] Add/plus button');
      return;
    }
  }

  // Fallback: look for mat-icon with "add" text
  const icons = Array.from(document.querySelectorAll('mat-icon'));
  for (const icon of icons) {
    if (icon.textContent?.trim() === 'add') {
      const btn = icon.closest('button');
      if (btn) {
        btn.click();
        await waitForReady(2000);
        console.log('[click] Add button (via mat-icon)');
        return;
      }
    }
  }

  throw new Error('Add/plus button not found');
}

// ==========================================
// READ FIELD VALUE
// ==========================================

/**
 * Read the current value of a field identified by label/qaanchor.
 */
export function readFieldValue(labelOrAnchor: string): string | null {
  const element = findField(labelOrAnchor);
  if (element) return element.value || null;

  // Also check mat-select for selected value
  const select = findSelect(labelOrAnchor);
  if (select) {
    const valueText = select.querySelector('.mat-select-value-text, .mat-mdc-select-value-text');
    return valueText?.textContent?.trim() || null;
  }

  return null;
}
