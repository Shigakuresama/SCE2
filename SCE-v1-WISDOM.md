# SCE v1 → SCE2: Extracted Wisdom & Patterns

**Source Code Analysis:** `/home/sergio/Projects/SCE/sce-extension/`
**Date:** 2026-02-05
**Purpose:** Preserve hard-won knowledge before building SCE2

---

## 🔥 Critical Angular Material Form Interaction Patterns

### The "Angular Doesn't Detect Changes" Problem

**Discovery:** Angular Material components require specific event sequences to register changes.

**Working Pattern for Text Inputs:**
```javascript
// Step 1: Focus with click (critical for Angular)
input.focus();
input.click();
await sleep(150);

// Step 2: Clear existing value
input.value = '';
input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(50);

// Step 3: Use native setter for Angular to detect
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  'value'
).set;
nativeInputValueSetter.call(input, value);

// Step 4: Trigger comprehensive events
input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

// Step 5: Wait for Angular to process
await sleep(300);
```

**Key Insight:** Simply setting `input.value = value` doesn't work. Must use native setter + multiple events.

---

### Dropdown Selection Pattern (mat-select)

**Selectors:**
```javascript
const fieldSelectors = {
  textInput: 'mat-form-field input.mat-input-element, mat-form-field input.mat-input',
  select: 'mat-form-field mat-select',
  option: 'mat-option',
  label: 'mat-form-field mat-label',
  formField: 'mat-form-field'
};
```

**Selection Process:**
```javascript
// 1. Find dropdown by label
function findInputByMatLabel(labelText) {
  const labels = Array.from(document.querySelectorAll(fieldSelectors.label));
  let label = labels.find(l => l.textContent.trim() === labelText);
  if (!label) {
    label = labels.find(l => l.textContent.includes(labelText));
  }
  const formField = label.closest('mat-form-field');
  return formField.querySelector('mat-select');
}

// 2. Click to open
matSelect.click();
await sleep(500);

// 3. Wait for options, then find and click
const options = Array.from(document.querySelectorAll('mat-option'));
const match = options.find(o => o.textContent?.trim() === optionText);
match.click();

// 4. Wait for Angular stability
await sleep(300);
```

**Critical:** Options appear in `.cdk-overlay-container` outside the form field.

---

## 🎯 Section Detection & Navigation

### Sidebar Section Detection

**Active Section Selector:**
```javascript
const active = document.querySelector('.sections-menu-item.active .sections-menu-item__title');
const sectionTitle = active?.textContent?.trim() || '';
```

**All Sidebar Sections:**
- Customer Search
- Customer Information
- Additional Customer Information
- Enrollment Information
- Household Members
- Project Information
- Trade Ally Information
- Assessment Questionnaire
- Equipment Information
- Basic Enrollment
- Bonus Program
- Terms and Conditions
- Upload Documents
- Comments
- Status

**Key Insight:** Some pages have sidebar (14 sections), others use Next button (4 pages).

---

### SCE Website Workflow Structure

**Two Navigation Types:**

**Type A: Sidebar Sections** (Detect via `.sections-menu-item.active`)
```
Customer Information → Additional Info → Enrollment → Household → ...
```

**Type B: Next Button Pages** (No sidebar active)
```
Customer Search → Appointment Contact → Appointments → Measure Info → Summary
```

---

## 📸 Customer Data Extraction Pattern

### Scraping Customer Name/Phone

**Location:** Application Status page

**Selectors:**
```javascript
const nameInput = findInputByMatLabel('Customer Name');
const customerName = nameInput?.value || '';

// Store globally for later use
if (customerName) {
  window.sceCustomerName = customerName;
}
```

**Email Generation from Name:**
```javascript
function generateEmail(customerName) {
  // Convert "John Doe" → "john.doe@example.com"
  const parts = customerName.trim().toLowerCase().split(/\s+/);
  const base = parts.length > 1
    ? `${parts[0]}.${parts.slice(1).join('')}`
    : parts[0];
  return `${base}@example.com`;
}
```

---

## 🔄 Program Button Pattern

### After Customer Search

**Sequence:**
```javascript
// 1. Fill Customer Search
await fillField('input[name="streetNum"]', streetNumber);
await fillField('input[name="streetName"]', streetName);
await fillField('input[name="zip"]', zipCode);

// 2. Click Search
document.querySelector('button.search-btn').click();

// 3. Wait for program buttons (CRITICAL: not just sleep!)
await sleep(3000); // Or use MutationObserver

// 4. Click first program button
const programBtn = document.querySelector(
  'app-assessment-programs button, app-assessment-item button'
);
if (programBtn) {
  programBtn.click();
}

// 5. Wait for customer data to populate
await sleep(3000);
```

**Key Insight:** The "Financial" or program button triggers customer data load.

---

## ⏱️ Timing & Stability Patterns

### Sleep Durations That Work

```javascript
await sleep(100);   // Quick field-to-field
await sleep(150);   // Focus/click operations
await sleep(300);   // Angular processing after input
await sleep(500);   // Dropdown opening/closing
await sleep(1000);  // Page navigation
await sleep(3000);  // Program button wait
```

---

## 🚨 Error Handling & Edge Cases

### Field Already Filled Check

```javascript
function isFieldAlreadyFilled(input, expectedValue, skipIfFilled) {
  if (!skipIfFilled) return false;

  const currentValue = input.value?.trim() || '';
  const expected = expectedValue?.trim() || '';

  // Case-insensitive comparison for strings
  return currentValue.toLowerCase() === expected.toLowerCase();
}
```

### Retry Logic for Failed Inputs

```javascript
// First attempt
await setInputValue(input, value, fieldName);

if (input.value !== value) {
  // Retry with simpler approach
  await sleep(200);
  input.focus();
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(200);
}
```

---

## 🔧 Chrome Extension Patterns

### Config Loading (Async, No Race Conditions)

```javascript
let configLoadPromise = null;

function loadConfig() {
  if (!configLoadPromise) {
    configLoadPromise = new Promise((resolve) => {
      chrome.storage.sync.get('sceConfig', (result) => {
        if (result.sceConfig) {
          config = { ...config, ...result.sceConfig };
        }
        resolve(config);
      });
    });
  }
  return configLoadPromise;
}
```

**Key Insight:** Cache promise to prevent multiple concurrent loads.

### Stop Button Pattern

```javascript
let isStopped = false;

function stopFormFilling() {
  isStopped = true;
  // Disable buttons, show status
}

function checkStopped() {
  if (isStopped) {
    throw new Error('Process was stopped by user');
  }
}
```

**Usage:** Call `checkStopped()` between each major operation.

---

## 📦 Route Planner Wisdom

### Address Range Generation

```javascript
function generateAddressRange(startAddr, endAddr, options) {
  const { city, state, zip, side = 'both', skip = [] } = options;

  // Parse address numbers
  const startNum = parseInt(startAddr.match(/\d+/)[0]);
  const endNum = parseInt(endAddr.match(/\d+/)[0]);
  const streetName = startAddr.replace(/^\d+/, '').trim();

  const addresses = [];
  for (let num = startNum; num <= endNum; num++) {
    // Filter by side (odd/even)
    if (side === 'odd' && num % 2 === 0) continue;
    if (side === 'even' && num % 2 !== 0) continue;

    // Skip specific addresses
    if (skip.includes(num)) continue;

    addresses.push({
      number: num.toString(),
      street: streetName,
      full: `${num} ${streetName}, ${city}, ${state} ${zip}`
    });
  }

  return addresses;
}
```

---

## 🔐 Common Gotchas & Solutions

### Gotcha #1: mat-select Value Display

**Problem:** Can't get current value from `mat-select`.

**Solution:**
```javascript
const currentValueDiv = matSelect.querySelector('.mat-select-value-text');
const currentValue = currentValueDiv?.textContent?.trim() || '';
```

---

### Gotcha #2: Options in Overlay Container

**Problem:** Clicking `mat-select` opens options in `.cdk-overlay-container` (outside form).

**Solution:**
```javascript
const options = Array.from(document.querySelectorAll('mat-option'));
// Options are now in overlay, query globally
```

---

### Gotcha #3: Email Auto-Generation

**Problem:** SCE website auto-generates email from customer name.

**Solution:** Don't fill email field. Let SCE generate it, then extract if needed.

---

### Gotcha #4: Case Insensitivity

**Problem:** Dropdown options might be "Yes" but config has "yes".

**Solution:**
```javascript
const match = options.find(o => {
  const text = o.textContent?.trim().toLowerCase() || '';
  return text === optionText.toLowerCase();
});
```

---

## 🚀 Performance Patterns

### Batch Processing (3 at a Time)

```javascript
async function processBatch(addresses) {
  const batchSize = 3;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);

    // Open tabs
    const tabs = batch.map(addr =>
      chrome.tabs.create({ url: 'https://sce.dsmcentral.com/onsite' })
    );

    // Wait for load
    await Promise.all(tabs.map(tab => waitForLoad(tab.id)));

    // Fill forms
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: 'FILL_FORM' });
    }

    // Close tabs
    tabs.forEach(tab => chrome.tabs.remove(tab.id));
  }
}
```

**Key Insight:** Don't open more than 3 tabs at once (browser limits).

---

## 📝 Checklist for SCE2

### Must Implement:

1. ✅ Angular Material Event Sequence (input + change + keyboard)
2. ✅ Native Setter for Values (Object.getOwnPropertyDescriptor trick)
3. ✅ Sidebar Detection (`.sections-menu-item.active`)
4. ✅ mat-select Dropdown Handling (overlay container)
5. ✅ Customer Data Extraction (Application Status page)
6. ✅ Program Button Wait (3 seconds, not MutationObserver)
7. ✅ Retry Logic (failed inputs)
8. ✅ Stop Button (user cancellation)
9. ✅ Config Loading (cached promise, no race conditions)
10. ✅ Section Mapping (title → key)

### Should Improve:

1. ⚡ Replace sleep() with MutationObserver (more reliable timing)
2. ⚡ Add better error logging (stack traces, screenshots)
3. ⚡ Queue-based processing (background script polling)
4. ⚡ Database persistence (don't rely on extension storage)
5. ⚡ TypeScript types (eliminate `any` types)

---

## 🎓 Key Lessons Learned

### Lesson #1: Angular is Picky
**Observation:** Simple `input.value = x` doesn't work 90% of the time.
**Solution:** Native setter + comprehensive event dispatching.

### Lesson #2: Timing is Everything
**Observation:** Too fast = Angular doesn't catch it. Too slow = poor UX.
**Solution:** Carefully tuned sleep durations (100ms, 300ms, 1000ms, 3000ms).

### Lesson #3: Selectors Change
**Observation:** SCE website updates break selectors.
**Solution:** Multiple fallback selectors (`mat-select`, `select`, `input`).

### Lesson #4: Section Detection is Tricky
**Observation:** Sidebar vs. Next button pages require different logic.
**Solution:** Priority-based detection (sidebar first, then Next button).

### Lesson #5: Customer Data is Gold
**Observation:** Extracted name/phone makes field work much easier.
**Solution:** Always scrape and store customer data during route planning.

---

## 🔗 Code References

**SCE v1 Files:**
- `/home/sergio/Projects/SCE/sce-extension/content.js` (2600+ lines)
- `/home/sergio/Projects/SCE/sce-extension/utils.js` (SECTION_MAP, time math)
- `/home/sergio/Projects/SCE/sce-extension/modules/route-planner.js` (Batch processing)
- `/home/sergio/Projects/SCE/sce-extension/background.js` (Extension lifecycle)

**Apply These Patterns to SCE2:**
- `packages/extension/src/content.ts`
- `packages/extension/src/lib/sce-helper.ts`
- `packages/extension/src/background.ts`

---

**Generated:** 2026-02-05
**Method:** Direct code analysis (SCE v1 codebase)
**Status:** Ready for SCE2 implementation 🚀
