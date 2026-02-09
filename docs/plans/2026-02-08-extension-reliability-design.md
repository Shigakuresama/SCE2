# Extension Reliability Overhaul — Design Document

**Date:** 2026-02-08
**Goal:** Make the SCE2 extension form-filling robust, borrowing patterns from AgnosticFiller, and driven by the real DOM structure observed on the live SCE site.

---

## Part 1: What's Broken (Root Causes)

### 1.1 Section Navigation Uses Invalid Selectors

`section-navigator.ts` lines 66-68 use `:has-text("...")` — a Playwright pseudo-selector that does NOT work in `document.querySelector`. Every call to `navigateToSection()` silently returns `false`, so the orchestrator skips every section.

**Fix:** Replace with text-content matching:

```ts
// BEFORE (broken):
const selectors = [
  `.sections-menu-item:has-text("${sectionName}")`,
];
for (const selector of selectors) {
  const element = document.querySelector(selector); // always null
}

// AFTER (working):
const titles = document.querySelectorAll('.sections-menu-item__title');
for (const title of titles) {
  if (title.textContent?.trim() === sectionName) {
    const li = title.closest('.sections-menu-item');
    li?.click();
    break;
  }
}
```

### 1.2 Fixed `sleep()` Everywhere Instead of State Verification

The extension uses hardcoded `sleep(150)`, `sleep(300)`, `sleep(500)` after every action, hoping Angular has processed. On slow networks or heavy pages, these fail silently.

**Fix:** Adopt AgnosticFiller's `waitForStabilization` pattern — poll until DOM is stable (no mutations for 250ms), with a max timeout.

### 1.3 Dropdown Selection Has No Retry

`fillSelect()` clicks `mat-select`, waits 500ms, then searches `.cdk-overlay-container mat-option`. If the overlay hasn't opened yet, it fails. No retry.

**Fix:** Wait for overlay to appear via MutationObserver, then search options. Retry up to 3 times with backoff.

### 1.4 Section List Is Outdated

The extension hardcodes 12 sections. The live site has **16 sections** (some unlock progressively):

1. Appointment Contact
2. Appointments
3. Trade Ally Information
4. Customer Information
5. Additional Customer Information
6. Enrollment Information
7. Household Members
8. Project Information
9. Assessment Questionnaire
10. Equipment Information
11. Basic Enrollment Equipment
12. Bonus/Adjustment Measure(s)
13. Review Terms and Conditions
14. File Uploads
15. Review Comments
16. Application Status

**Fix:** Don't hardcode the list. Read visible sections from the DOM at runtime.

### 1.5 Field Identification Relies on Wrong Attributes

The extension uses `input[name="..."]` selectors, but the live site has **no `name` attributes**. Fields are identified by:
- `qaanchor` attribute on `mat-form-field`
- `mat-label` text content inside the form field

**Fix:** Primary lookup by `qaanchor`, fallback to `mat-label` text.

---

## Part 2: The Reliability Architecture (Inspired by AgnosticFiller)

### 2.1 `waitForElement` → `waitForReady`

Replace all fixed `sleep()` calls with a proper readiness check:

```ts
async function waitForReady(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    let lastMutationTime = Date.now();
    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const check = setInterval(() => {
      if (Date.now() - lastMutationTime > 250) {
        clearInterval(check);
        observer.disconnect();
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(check);
      observer.disconnect();
      resolve(); // Resolve anyway after timeout, don't block forever
    }, timeout);
  });
}
```

### 2.2 Retry with Exponential Backoff (from AgnosticFiller `utils.js`)

```ts
async function retry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelay = 500 } = {}
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms:`, (error as Error).message);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}
```

### 2.3 Framework-Safe Value Setter (from AgnosticFiller `content.js`)

Already partially implemented in `sce-helper.ts`, but the retry path falls back to direct `.value =` which bypasses Angular. Fix:

```ts
function setValueSafe(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    'value'
  )?.set;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  // Comprehensive events for Angular detection
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}
```

### 2.4 Field Lookup by `qaanchor` or Label

```ts
function findField(labelOrAnchor: string): HTMLInputElement | HTMLTextAreaElement | null {
  // Priority 1: qaanchor attribute
  const byAnchor = document.querySelector(
    `mat-form-field[qaanchor="${labelOrAnchor}"] input.mat-input-element`
  ) as HTMLInputElement;
  if (byAnchor) return byAnchor;

  // Priority 2: mat-label text content (exact match)
  const labels = document.querySelectorAll('mat-form-field mat-label');
  for (const label of labels) {
    const text = label.textContent?.trim().replace(/^\*\s*/, ''); // strip leading *
    if (text === labelOrAnchor) {
      const formField = label.closest('mat-form-field');
      return formField?.querySelector('input.mat-input-element, textarea') as HTMLInputElement;
    }
  }

  // Priority 3: partial match
  for (const label of labels) {
    if (label.textContent?.toLowerCase().includes(labelOrAnchor.toLowerCase())) {
      const formField = label.closest('mat-form-field');
      return formField?.querySelector('input.mat-input-element, textarea') as HTMLInputElement;
    }
  }

  return null;
}
```

### 2.5 Dropdown Selection with Overlay Wait

```ts
async function selectDropdown(labelOrAnchor: string, optionText: string): Promise<void> {
  await retry(async () => {
    // Find the mat-select
    const formField = findFormFieldByLabel(labelOrAnchor);
    const matSelect = formField?.querySelector('mat-select') as HTMLElement;
    if (!matSelect) throw new Error(`Dropdown not found: ${labelOrAnchor}`);

    // Click to open
    matSelect.click();

    // Wait for overlay to appear
    await waitForElement('.cdk-overlay-container mat-option', 3000);

    // Find matching option (case-insensitive)
    const options = document.querySelectorAll('.cdk-overlay-container mat-option');
    const match = Array.from(options).find(
      o => o.textContent?.trim().toLowerCase() === optionText.toLowerCase()
    );

    if (!match) {
      // Close dropdown before throwing (click backdrop)
      const backdrop = document.querySelector('.cdk-overlay-backdrop') as HTMLElement;
      backdrop?.click();
      await sleep(200);
      throw new Error(`Option "${optionText}" not found in ${labelOrAnchor}`);
    }

    (match as HTMLElement).click();
    await waitForReady(1000);
  }, { maxRetries: 2, baseDelay: 500 });
}
```

### 2.6 Section Navigation (Dynamic, Not Hardcoded)

```ts
function getAvailableSections(): string[] {
  const titles = document.querySelectorAll('.sections-menu-item__title');
  return Array.from(titles).map(t => t.textContent?.trim() || '');
}

function getActiveSection(): string | null {
  const active = document.querySelector('.sections-menu-item.active .sections-menu-item__title');
  return active?.textContent?.trim() || null;
}

async function navigateToSection(sectionName: string): Promise<boolean> {
  const titles = document.querySelectorAll('.sections-menu-item__title');
  for (const title of titles) {
    if (title.textContent?.trim() === sectionName) {
      const li = title.closest('.sections-menu-item') as HTMLElement;
      li.click();
      await waitForReady(3000);
      // Verify navigation succeeded
      const newActive = getActiveSection();
      return newActive === sectionName;
    }
  }
  return false;
}
```

### 2.7 Stop Flag → AbortController (No More Global Window Variable)

Replace `(window as any).sce2StopRequested` with proper `AbortController`:

```ts
let fillAbortController: AbortController | null = null;

function startFilling(): AbortController {
  fillAbortController = new AbortController();
  return fillAbortController;
}

function stopFilling(): void {
  fillAbortController?.abort();
}

// In orchestrator loop:
if (abortController.signal.aborted) {
  throw new Error('Stopped by user');
}
```

---

## Part 3: SCE-Specific Automation Quirks

### 3.1 ZIP+4 → PRISM Code Workflow

**Current behavior in `sce1-logic.ts`:** Extracts last 4 digits from mailing zip (e.g., `90716-1317` → `1317`).

**Full automation needed:**
1. Read `Mailing Zip` field (e.g., `90716-1317`)
2. Extract the last 4 digits (`1317`)
3. In Enrollment Information section, select "PRISM Code" from the income verification dropdown
4. This unlocks a text field
5. Paste the 4-digit code into that field

```ts
async function handlePrismCodeWorkflow(): Promise<void> {
  // Extract ZIP+4
  const plus4 = extractPlus4FromMailingZip() || getPlus4Zip('', currentZip);

  // Select PRISM Code to unlock the field
  await selectDropdown('Income Verification Type', 'PRISM code');
  await waitForReady(2000); // Wait for field to unlock

  // Fill the unlocked field
  const prismField = findField('PRISM Code') || findField('Verification Code');
  if (prismField && plus4) {
    await fillFieldSafe(prismField, plus4, 'PRISM Code');
  }
}
```

### 3.2 Homeowner Auto-Population

When the customer is a homeowner, their info should auto-populate the homeowner fields in "Additional Customer Information":

```ts
async function autoFillHomeownerFromCustomer(): Promise<void> {
  // Read customer name from Customer Information (readonly field)
  const customerName = findField('Customer Name')?.value;
  if (!customerName) return;

  const parts = customerName.split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  // Fill homeowner fields
  await fillFieldByLabel('Homeowner First Name', firstName);
  await fillFieldByLabel('Homeowner Last Name', lastName);

  // Copy address from site address to homeowner address
  const siteAddr = findField('Site Address 1')?.value;
  const siteCity = findField('Site City')?.value;
  const siteZip = findField('Site Zip')?.value;

  if (siteAddr) await fillFieldByLabel('Homeowner Address 1', siteAddr);
  if (siteCity) await fillFieldByLabel('Homeowner City', siteCity);
  if (siteZip) await fillFieldByLabel('Homeowner Zip Code', siteZip);
}
```

### 3.3 Contact Info Auto-Copy

Site Contact fields in "Appointment Contact" should copy from Customer Information when "Site Contact Same As Customer Contact" is set to "Yes":

```ts
async function handleSiteContactSameAsCustomer(): Promise<void> {
  await selectDropdown('Site Contact Same As Customer Contact', 'Yes');
  await waitForReady(2000); // Wait for Angular to auto-populate
  // Fields should auto-fill — verify they did
}
```

### 3.4 Section-Aware Fill Strategy

Not every section needs the same treatment. The orchestrator should know which sections have data to fill vs. which to skip:

```ts
const SECTION_STRATEGIES: Record<string, 'fill' | 'skip' | 'special'> = {
  'Appointment Contact': 'fill',
  'Appointments': 'special',     // Date picker handling
  'Trade Ally Information': 'fill',
  'Customer Information': 'skip', // Read-only, pre-populated from search
  'Additional Customer Information': 'fill',
  'Enrollment Information': 'special', // PRISM code workflow
  'Household Members': 'fill',
  'Project Information': 'fill',
  'Assessment Questionnaire': 'fill',
  'Equipment Information': 'fill',
  'Basic Enrollment Equipment': 'skip', // Populated by system
  'Bonus/Adjustment Measure(s)': 'skip',
  'Review Terms and Conditions': 'special', // Checkbox acceptance
  'File Uploads': 'special',     // File upload workflow
  'Review Comments': 'fill',
  'Application Status': 'special', // Status dropdown
};
```

---

## Part 4: Human-Like Timing (from AgnosticFiller `config.js`)

Add configurable timing to avoid triggering anti-bot detection:

```ts
const TIMING = {
  betweenFields: { min: 100, max: 300 },   // ms between filling fields
  betweenSections: { min: 300, max: 800 },  // ms between section navigation
  afterDropdownOpen: { min: 200, max: 500 }, // ms after opening dropdown
  afterDropdownSelect: { min: 150, max: 400 },
};

function randomDelay(range: { min: number; max: number }): Promise<void> {
  const ms = range.min + Math.random() * (range.max - range.min);
  return sleep(ms);
}
```

---

## Part 5: Implementation Plan

### Step 1: Fix Section Navigation (Critical)
- Rewrite `section-navigator.ts` with text-based matching
- Read available sections from DOM dynamically
- Add navigation verification (check `.active` class after click)
- Add retry on navigation failure

### Step 2: Fix Field Lookup
- Add `qaanchor`-based lookup as primary strategy
- Keep `mat-label` text matching as fallback
- Strip leading `*` from required field labels

### Step 3: Replace All Fixed Sleeps
- Introduce `waitForReady()` (DOM stability check)
- Replace `sleep(N)` calls in `fillField`, `fillSelect`, navigation
- Add `waitForElement` with proper cleanup

### Step 4: Fix Dropdown Handling
- Wait for overlay to appear before searching options
- Add retry with backoff
- Close dropdown on failure (click backdrop)

### Step 5: Add PRISM Code + Homeowner Automation
- Implement `handlePrismCodeWorkflow()`
- Implement `autoFillHomeownerFromCustomer()`
- Wire into orchestrator for Enrollment and Additional sections

### Step 6: Replace Global Stop Flag
- `AbortController` pattern instead of `window.sce2StopRequested`

### Step 7: Update Section List + Orchestrator
- Remove hardcoded section list
- Read from DOM, apply `SECTION_STRATEGIES`
- Add section-specific fill logic for special cases

### Step 8: Add Human-Like Timing
- Configurable random delays between actions
- Exposed in options page

---

## Part 6: PDF Visual Improvements (Lower Priority)

After extension reliability is solid:

1. **Standardize font sizes**: 8-10pt range for all body text (name → 10pt, dropdown → 7pt)
2. **Fix customer name overflow**: Add `splitTextToSize()` with max 2 lines
3. **Fix notes field overlap**: Don't extend under QR code area
4. **Consistent spacing**: 3mm between all elements
5. **Increase checkbox**: 4mm → 5mm
6. **Increase dropdown font**: 5pt → 7pt with "Status:" label

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/section-navigator.ts` | Complete rewrite — text-based nav, dynamic section list |
| `src/lib/sce-helper.ts` | Fix `fillField`, `fillSelect`, add `qaanchor` lookup |
| `src/lib/fill-orchestrator.ts` | AbortController, section strategies, special handlers |
| `src/lib/sce1-logic.ts` | Add PRISM code workflow, homeowner auto-fill |
| `src/lib/error-handler.ts` | Ensure `withRetry` is used consistently |
| `src/content.ts` | Update message handlers, fix `waitForElement` |
| `webapp/src/lib/pdf-generator.ts` | Font sizes, spacing, overflow fixes |
| `webapp/src/lib/acroform-fields.ts` | Checkbox size, dropdown font |
