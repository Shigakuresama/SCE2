# SCE2 Extension Banner - Design Document

**Date:** 2025-02-07
**Author:** Claude + User Collaboration
**Status:** ✅ Implementation Complete

## Overview

Implement an improved banner/popup system for the SCE2 Chrome extension that appears on SCE rebate form pages (`sce.dsmcentral.com`). The banner provides two workflow options: fill all 18 form sections sequentially, or fill only the currently visible section.

## Requirements

### Functional Requirements

1. **Hybrid Trigger System**
   - Auto-show banner when webapp has queued property data to fill
   - Manual trigger via extension icon popup (when no data queued)
   - Banner can be dismissed and re-shown via extension icon

2. **Dual Fill Modes**
   - "Fill All Sections" - Orchestrates filling all 18 sections sequentially with progress feedback
   - "Fill: [Current Section]" - Fills only the active section from left menu, stays on page

3. **Section Detection**
   - Detect active section title from SCE's left navigation menu
   - Dynamically update "Fill Section" button text to reflect current section
   - Map section titles to fill functions using existing SECTION_MAP

4. **Stop Functionality**
   - Stop button appears during multi-section fills
   - User can cancel operation at any time
   - Partial data filled so far is preserved
   - Graceful cancellation with visual feedback

5. **Error Handling**
   - Inline errors on failed buttons (red color, error message)
   - Toast notifications for all errors and critical events
   - Validation errors show specific field/issue
   - Navigation timeout handling with retry option

6. **User Feedback**
   - Visual states: Idle, Filling, Success, Error, Stopped
   - Progress bar during multi-section fills
   - Success animations and auto-dismiss
   - Section button text updates as user navigates

### Non-Functional Requirements

1. **Accessibility**
   - ARIA labels on banner and all buttons
   - Keyboard navigation (Tab, Enter, Escape)
   - Focus indicators for screen readers
   - High contrast colors (WCAG AA compliant)

2. **Performance**
   - Banner CSS injected once on page load
   - Minimal DOM manipulation during state changes
   - Efficient MutationObserver for section menu changes

3. **Browser Compatibility**
   - Chrome/Edge (primary - MV3 extension)
   - Firefox (if MV3 supports it)
   - Safari (if applicable)

4. **Responsive Design**
   - Adapts to mobile screens (stacks vertically)
   - Touch-friendly button sizes
   - Maximum width constraints

## Architecture

### Components

```
packages/extension/src/
├── content.ts                    # MODIFIED: Add banner initialization
├── lib/
│   ├── banner.ts                 # NEW: BannerController class
│   ├── banner-styles.ts          # NEW: CSS injection utility
│   └── toast.ts                  # NEW: Toast notification system
├── assets/
│   └── banner.css                # NEW: Banner and toast styles
└── manifest.json                  # MODIFIED: Add web_accessible_resources
```

### Data Flow

#### Auto-show Flow (Data Queued)
```
Webapp → Background Script → Queue (chrome.storage)
    ↓
User navigates to SCE form
    ↓
Content script loads
    ↓
Check chrome.storage for queued data
    ↓
Data exists? → Show banner with "✨ Ready to fill form"
Data missing? → Banner hidden, wait for extension icon click
```

#### Manual Trigger Flow
```
User on SCE form (no queued data)
    ↓
User clicks extension icon
    ↓
Popup shows "Show Form Assistant" button
    ↓
User clicks button
    ↓
Message sent to content script: { action: 'SHOW_BANNER' }
    ↓
Banner appears with "SCE Form Detected"
```

#### Fill All Sections Flow
```
User clicks "Fill All Sections"
    ↓
Send message to background: { action: 'FILL_ALL_SECTIONS' }
    ↓
Background orchestrates:
  For each section in SECTIONS array:
    - Check stop flag
    - Navigate to section
    - Wait for page load
    - Fill section fields
    - Validate
    - Continue to next
    ↓
Complete → Show success state
Auto-dismiss after 3 seconds
```

#### Fill Current Section Flow
```
User clicks "Fill: [Section Name]"
    ↓
Send message: { action: 'FILL_CURRENT_SECTION', section: title }
    ↓
Get active section from menu
    ↓
Navigate to section (if needed)
    ↓
Fill section fields
    ↓
Validate
    ↓
Show inline success on button (2 seconds)
Stay on page (don't navigate)
```

#### Error Handling Flow
```
Error occurs during fill
    ↓
Catch error
    ↓
Determine error type:
    - Validation? → Toast: "Missing: Street Address"
    - Navigation? → Toast: "Section not found"
    - Timeout? → Toast: "Page load timeout"
    ↓
Set error state on failed button
    ↓
Inline error: Button turns red + "❌ Error" message
Toast notification: Shows for 6 seconds
    ↓
Reset button after 3 seconds
```

## Component Design

### 1. BannerController Class

**File:** `packages/extension/src/lib/banner.ts`

**Responsibilities:**
- Create and inject banner HTML into DOM
- Attach event listeners to buttons
- Manage banner states (idle, filling, success, error, stopped)
- Update section button text dynamically
- Handle stop functionality
- Remove banner from DOM

**Key Methods:**
```typescript
class BannerController {
  show(hasData: boolean): void
  remove(): void
  setFilling(section: string): void
  setSuccess(message: string): void
  setError(buttonId: string, message: string): void
  setStopped(): void
  updateSectionButton(): void
  showSectionSuccess(): void
  updateProgress(current: number, total: number): void
  isStopped(): boolean
  resetStopState(): void
}
```

**State Management:**
- `banner: HTMLElement` - Reference to banner DOM element
- `stopButton: HTMLElement` - Reference to stop button
- `isFilling: boolean` - Currently filling sections
- `shouldStop: boolean` - User requested stop

### 2. Toast Notification System

**File:** `packages/extension/src/lib/toast.ts`

**Responsibilities:**
- Create toast container (fixed position)
- Show toast notifications with icons
- Auto-dismiss after configurable duration
- Support action buttons in toasts
- Handle toast close button

**API:**
```typescript
class Toast {
  show(message: string, type: ToastType, options?: ToastOptions): void
  success(message: string, options?: ToastOptions): void
  error(message: string, options?: ToastOptions): void
  info(message: string, options?: ToastOptions): void
  warning(message: string, options?: ToastOptions): void
  clear(): void
}
```

**Toast Types:**
- `success` - Green checkmark, 4s duration
- `error` - Red X, 6s duration (longer visibility)
- `info` - Blue info icon, 4s duration
- `warning` - Orange warning, 4s duration

### 3. CSS Styling

**File:** `packages/extension/src/assets/banner.css`

**Key Improvements over SCE v1:**
- Modern gradient backgrounds
- Smoother CSS transitions (cubic-bezier easing)
- Enhanced box-shadows with color context
- Better hover states (subtle transform)
- Pulse animation on stop button
- Success bounce animation
- Error shake animation
- Responsive mobile layout
- Dark mode support (future-proofing)
- Focus indicators for keyboard navigation

**Banner States:**
- `.sce2-filling` - Light blue gradient, pulsing progress
- `.sce2-success` - Light green gradient, bounce animation
- `.sce2-error` - Light red gradient, shake animation
- `.sce2-stopped` - Light gray gradient

## Integration Points

### 1. content.ts Modifications

**Add to existing chrome.runtime.onMessage listener:**

```typescript
// Handle SHOW_BANNER (manual trigger)
if (message.action === 'SHOW_BANNER') {
  const banner = (window as any).sce2Banner;
  if (banner) banner.show();
  sendResponse({ success: true });
  return true;
}

// Handle FILL_ALL_SECTIONS
if (message.action === 'FILL_ALL_SECTIONS') {
  handleFillAllSections(sendResponse);
  return true;
}

// Handle FILL_CURRENT_SECTION
if (message.action === 'FILL_CURRENT_SECTION') {
  handleFillCurrentSection(message.section, sendResponse);
  return true;
}

// Handle STOP_FILLING
if (message.action === 'STOP_FILLING') {
  stopRequested = true;
  sendResponse({ success: true });
  return true;
}
```

**Add initialization on page load:**

```typescript
// Global stop flag
let stopRequested = false;

// Initialize banner
function initBanner() {
  const bannerController = new BannerController();
  (window as any).sce2Banner = bannerController;

  // Check for queued data
  chrome.storage.local.get(['queuedProperty'], (result) => {
    if (result.queuedProperty) {
      bannerController.show(true); // Auto-show
    }
  });

  // Watch for section menu changes
  observeSectionMenu(() => bannerController.updateSectionButton());
}

// Watch section menu for navigation
function observeSectionMenu(callback: () => void) {
  const menu = document.querySelector('.sections-menu');
  if (!menu) return;

  const observer = new MutationObserver(() => callback());
  observer.observe(menu, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBanner);
} else {
  initBanner();
}
```

**Implement fill orchestrator:**

```typescript
async function handleFillAllSections(sendResponse: (response: any) => void) {
  const banner = (window as any).sce2Banner;
  if (!banner) {
    sendResponse({ success: false, error: 'Banner not found' });
    return;
  }

  stopRequested = false;

  try {
    const sections = [
      'Customer Information',
      'Additional Customer Information',
      'Enrollment Information',
      'Household Members',
      'Project Information',
      'Trade Ally Information',
      'Assessment Questionnaire',
      'Equipment Information',
      'Basic Enrollment',
      'Bonus Program',
      'Terms and Conditions',
      'Upload Documents',
      'Comments',
      'Status'
    ];

    for (const section of sections) {
      // Check for stop
      if (stopRequested || banner.isStopped()) {
        banner.setStopped();
        sendResponse({ success: false, stopped: true });
        return;
      }

      banner.setFilling(section);

      // Navigate to section
      await navigateToSection(section);

      // Fill section
      await fillSection(section);

      // Update progress
      banner.updateProgress(
        sections.indexOf(section) + 1,
        sections.length
      );
    }

    banner.setSuccess('All sections filled!');
    sendResponse({ success: true });

  } catch (error) {
    banner.setError('fill-all-btn', error.message);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleFillCurrentSection(
  sectionTitle: string | null,
  sendResponse: (response: any) => void
) {
  const banner = (window as any).sce2Banner;
  if (!banner) {
    sendResponse({ success: false, error: 'Banner not found' });
    return;
  }

  try {
    const section = sectionTitle || getActiveSectionTitle();
    if (!section) {
      throw new Error('No active section detected');
    }

    banner.setFilling(section);

    // Fill the section
    await fillSection(section);

    // Show inline success
    banner.showSectionSuccess();

    sendResponse({ success: true, section });

  } catch (error) {
    banner.setError('fill-section-btn', error.message);
    sendResponse({ success: false, error: error.message });
  }
}
```

### 2. popup.ts Modifications

**Add "Show Form Assistant" button:**

```typescript
// In popup HTML, add:
// <button id="show-banner-btn">📋 Show Form Assistant</button>

// In popup.ts:
document.getElementById('show-banner-btn')
  ?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (tab.url?.includes('sce.dsmcentral.com')) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'SHOW_BANNER'
      });

      window.close();
    } else {
      alert('Please navigate to an SCE form page first');
    }
  });
```

### 3. manifest.json Modifications

**Add web_accessible_resources:**

```json
{
  "web_accessible_resources": [
    {
      "resources": ["src/assets/banner.css"],
      "matches": ["https://sce.dsmcentral.com/*"]
    }
  ]
}
```

## Fill Orchestration Implementation

### Section Navigation

**File:** `packages/extension/src/lib/navigation.ts`

**New file to handle SCE SPA navigation:**

```typescript
/**
 * Navigate to a specific section in SCE's SPA
 */
export async function navigateToSection(sectionTitle: string): Promise<void> {
  // Find section menu item
  const menuItems = document.querySelectorAll('.sections-menu-item');

  for (const item of menuItems) {
    const title = item.querySelector('.sections-menu-item__title');
    if (title?.textContent?.trim() === sectionTitle) {
      // Click the menu item to navigate
      (item as HTMLElement).click();

      // Wait for section content to load
      await waitForSectionContent();
      return;
    }
  }

  throw new Error(`Section not found: ${sectionTitle}`);
}

/**
 * Wait for section content to be visible
 */
async function waitForSectionContent(timeout = 10000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Check if any form input is visible (section loaded)
    const inputs = document.querySelectorAll(
      'mat-form-field:not(.ng-hide) input, ' +
      'mat-form-field:not(.ng-hide) mat-select, ' +
      'mat-form-field:not(.ng-hide) textarea'
    );

    if (inputs.length > 0) {
      // Give Angular a moment to render
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('Section content failed to load');
}
```

### Section Filling Logic

**File:** `packages/extension/src/lib/section-filler.ts`

```typescript
import { SCEHelper } from './sce-helper.js';

/**
 * Fill a single section with data
 */
export async function fillSection(
  sectionTitle: string,
  propertyData: any
): Promise<void> {
  console.log(`[SectionFiller] Filling section: ${sectionTitle}`);

  // Stop check
  if ((window as any).sce2StopRequested) {
    throw new Error('Stopped by user');
  }

  // Wait for form to be ready
  await waitForSectionContent();

  // Get section data from propertyData or defaults
  const sectionData = getSectionData(sectionTitle, propertyData);

  // Fill the section using SCEHelper
  const helper = new SCEHelper();

  switch (sectionTitle) {
    case 'Customer Information':
      await helper.fillCustomerInfo(sectionData);
      break;

    case 'Additional Customer Information':
      await helper.fillAdditionalCustomerInfo(sectionData);
      break;

    case 'Enrollment Information':
      await helper.fillEnrollmentInfo(sectionData);
      break;

    case 'Household Members':
      await helper.fillHouseholdInfo(sectionData);
      break;

    case 'Project Information':
      await helper.fillProjectInfo(sectionData);
      break;

    case 'Trade Ally Information':
      await helper.fillTradeAllyInfo(sectionData);
      break;

    case 'Assessment Questionnaire':
      await helper.fillAssessmentInfo(sectionData);
      break;

    case 'Equipment Information':
      await helper.fillEquipmentInfo(sectionData);
      break;

    case 'Basic Enrollment':
      await helper.fillBasicEnrollmentInfo(sectionData);
      break;

    case 'Bonus Program':
      await helper.fillBonusInfo(sectionData);
      break;

    case 'Terms and Conditions':
      await helper.fillTermsInfo(sectionData);
      break;

    case 'Status':
      await helper.fillStatusInfo(sectionData);
      break;

    default:
      throw new Error(`Unsupported section: ${sectionTitle}`);
  }

  // Validate filled data
  await validateSection(sectionTitle);

  console.log(`[SectionFiller] Section filled: ${sectionTitle}`);
}

/**
 * Get data for a specific section
 */
function getSectionData(sectionTitle: string, propertyData: any): any {
  // Return data from propertyData or use SCE1 defaults
  // This will be populated from the queue or extension defaults
  return propertyData || {};
}

/**
 * Validate filled section
 */
async function validateSection(sectionTitle: string): Promise<void> {
  // Section-specific validation
  // For now, just check that required fields have values
  const requiredSelectors = {
    'Customer Information': [
      'input[formcontrolname="firstName"]',
      'input[formcontrolname="lastName"]'
    ],
    // ... other sections
  };

  const selectors = requiredSelectors[sectionTitle] || [];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && !(element as HTMLInputElement).value) {
      throw new Error(`Required field empty: ${selector}`);
    }
  }
}
```

### Multi-Section Orchestrator

**File:** `packages/extension/src/lib/fill-orchestrator.ts`

```typescript
import { navigateToSection } from './navigation.js';
import { fillSection } from './section-filler.js';

/**
 * Fill all sections sequentially
 */
export async function fillAllSections(
  propertyData: any,
  banner: any
): Promise<void> {
  const sections = [
    'Customer Information',
    'Additional Customer Information',
    'Enrollment Information',
    'Household Members',
    'Project Information',
    'Trade Ally Information',
    'Assessment Questionnaire',
    'Equipment Information',
    'Basic Enrollment',
    'Bonus Program',
    'Terms and Conditions',
    'Status'
  ];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Check stop flag
    if ((window as any).sce2StopRequested) {
      throw new Error('Stopped by user');
    }

    // Update banner progress
    banner.setFilling(section);
    banner.updateProgress(i + 1, sections.length);

    try {
      // Navigate to section
      await navigateToSection(section);

      // Fill section
      await fillSection(section, propertyData);

      // Small delay between sections
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      if (error.message === 'Stopped by user') {
        throw error; // Re-throw to be caught by orchestrator
      }

      // Log error but continue to next section
      console.error(`[FillOrchestrator] Failed to fill ${section}:`, error);
      Toast.show(`Failed to fill ${section}: ${error.message}`, 'warning');
    }
  }
}

/**
 * Fill current section only
 */
export async function fillCurrentSection(
  propertyData: any,
  banner: any
): Promise<void> {
  const sectionTitle = getActiveSectionTitle();

  if (!sectionTitle) {
    throw new Error('No active section detected');
  }

  banner.setFilling(sectionTitle);

  try {
    await fillSection(sectionTitle, propertyData);
  } catch (error) {
    banner.setError('fill-section-btn', error.message);
    throw error;
  }
}
```

**Updated content.ts integration:**

```typescript
// At top of content.ts
import { fillAllSections, fillCurrentSection } from './lib/fill-orchestrator.js';
import { Toast } from './lib/toast.js';

// Global stop flag
(window as any).sce2StopRequested = false;

// Initialize banner
function initBanner() {
  const bannerController = new BannerController();
  (window as any).sce2Banner = bannerController;

  // Check for queued data
  chrome.storage.local.get(['queuedProperty'], async (result) => {
    if (result.queuedProperty) {
      bannerController.show(true);

      // Clear queue after showing
      chrome.storage.local.remove(['queuedProperty']);
    }
  });

  // Watch for section menu changes
  observeSectionMenu(() => {
    bannerController.updateSectionButton();
  });
}

// Add to message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    // ... existing cases ...

    // NEW: Fill all sections
    case 'FILL_ALL_SECTIONS':
      handleFillAllSections(sendResponse);
      return true;

    // NEW: Fill current section
    case 'FILL_CURRENT_SECTION':
      handleFillCurrentSection(sendResponse);
      return true;

    // NEW: Stop filling
    case 'STOP_FILLING':
      (window as any).sce2StopRequested = true;
      sendResponse({ success: true });
      return true;

    // NEW: Show banner manually
    case 'SHOW_BANNER':
      const banner = (window as any).sce2Banner;
      if (banner) banner.show();
      sendResponse({ success: true });
      return true;
  }
});

// NEW: Handle fill all sections
async function handleFillAllSections(sendResponse: (response: any) => void) {
  const banner = (window as any).sce2Banner;

  if (!banner) {
    sendResponse({ success: false, error: 'Banner not found' });
    return;
  }

  // Reset stop flag
  (window as any).sce2StopRequested = false;

  try {
    // Get property data from storage or defaults
    const result = await chrome.storage.local.get(['propertyData']);
    const propertyData = result.propertyData || {};

    await fillAllSections(propertyData, banner);

    banner.setSuccess('All sections filled!');
    sendResponse({ success: true });

  } catch (error) {
    if (error.message === 'Stopped by user') {
      banner.setStopped();
      sendResponse({ success: false, stopped: true });
    } else {
      banner.setError('fill-all-btn', error.message);
      sendResponse({ success: false, error: error.message });
    }
  }
}

// NEW: Handle fill current section
async function handleFillCurrentSection(sendResponse: (response: any) => void) {
  const banner = (window as any).sce2Banner;

  if (!banner) {
    sendResponse({ success: false, error: 'Banner not found' });
    return;
  }

  // Reset stop flag
  (window as any).sce2StopRequested = false;

  try {
    const result = await chrome.storage.local.get(['propertyData']);
    const propertyData = result.propertyData || {};

    await fillCurrentSection(propertyData, banner);

    banner.showSectionSuccess();
    sendResponse({ success: true });

  } catch (error) {
    banner.setError('fill-section-btn', error.message);
    sendResponse({ success: false, error: error.message });
  }
}
```

## Updated Implementation Tasks

### Task 1: Create Toast Notification System
- [ ] Create `packages/extension/src/lib/toast.ts`
- [ ] Implement `Toast` class with show/success/error/info/warning methods
- [ ] Add toast CSS to `banner.css`
- [ ] Test toast notifications appear correctly

### Task 2: Create Section Navigation Module
- [ ] Create `packages/extension/src/lib/navigation.ts`
- [ ] Implement `navigateToSection(sectionTitle)` function
- [ ] Implement `waitForSectionContent(timeout)` helper
- [ ] Add section menu item selector logic
- [ ] Add timeout handling for page loads
- [ ] Test navigation between sections

### Task 3: Create Section Filling Module
- [ ] Create `packages/extension/src/lib/section-filler.ts`
- [ ] Implement `fillSection(sectionTitle, propertyData)` function
- [ ] Implement `getSectionData(sectionTitle, propertyData)` helper
- [ ] Implement `validateSection(sectionTitle)` function
- [ ] Add switch statement for all section types
- [ ] Connect to existing SCEHelper class methods
- [ ] Add stop flag checking
- [ ] Test filling individual sections

### Task 4: Create Fill Orchestrator
- [ ] Create `packages/extension/src/lib/fill-orchestrator.ts`
- [ ] Implement `fillAllSections(propertyData, banner)` function
- [ ] Implement `fillCurrentSection(propertyData, banner)` function
- [ ] Add sequential section processing
- [ ] Add progress tracking and banner updates
- [ ] Add stop flag handling
- [ ] Add error handling with continuation
- [ ] Test multi-section fill orchestration

### Task 5: Create Banner Controller
- [ ] Create `packages/extension/src/lib/banner.ts`
- [ ] Implement `BannerController` class
- [ ] Add all state management methods
- [ ] Add event listeners for buttons
- [ ] Implement stop functionality
- [ ] Add dynamic section button text updates

### Task 6: Create Banner CSS
- [ ] Create `packages/extension/src/assets/banner.css`
- [ ] Add banner styles with improvements over v1
- [ ] Add toast notification styles
- [ ] Add animations (pulse, bounce, shake, ellipsis)
- [ ] Add responsive breakpoints
- [ ] Add dark mode support

### Task 7: Integrate with content.ts
- [ ] Import fill orchestrator and toast modules
- [ ] Add banner initialization on page load
- [ ] Add section menu observer
- [ ] Implement handleFillAllSections
- [ ] Implement handleFillCurrentSection
- [ ] Add STOP_FILLING message handler
- [ ] Add SHOW_BANNER message handler
- [ ] Add global stop flag initialization

### Task 8: Update popup.ts
- [ ] Add "Show Form Assistant" button to popup HTML
- [ ] Add click handler to send SHOW_BANNER message
- [ ] Add SCE URL validation

### Task 9: Update manifest.json
- [ ] Add web_accessible_resources for banner.css
- [ ] Ensure content script matches SCE domain

### Task 10: Comprehensive Testing
- [ ] Manual testing checklist (all scenarios)
- [ ] Test auto-show with queued data
- [ ] Test manual show via extension icon
- [ ] Test Fill All Sections (18 sections)
- [ ] Test Fill Current Section
- [ ] Test stop functionality
- [ ] Test error handling (validation, navigation, timeout)
- [ ] Test section button updates
- [ ] Test banner dismiss/re-show
- [ ] Test keyboard navigation
- [ ] Test responsive on mobile viewport
- [ ] Test accessibility with screen reader
- [ ] Test edge cases (multiple tabs, rapid clicking, page navigation)

### Task 11: Documentation & Cleanup
- [ ] Update CLAUDE.md with banner feature documentation
- [ ] Add banner usage examples
- [ ] Clean up any debug console.logs
- [ ] Verify code follows project conventions

## Success Criteria

- ✅ Banner appears automatically when queued data exists
- ✅ Banner can be shown manually via extension icon
- ✅ "Fill All Sections" fills all 18 sections sequentially
- ✅ "Fill Section" fills only current section and stays on page
- ✅ Stop button cancels operation and preserves partial data
- ✅ Section button text updates when user navigates menu
- ✅ Errors show inline + toast notifications
- ✅ Banner shows filling/success/error/stopped states
- ✅ All buttons work with keyboard navigation
- ✅ Banner is responsive on mobile screens
- ✅ Toast notifications appear properly positioned
- ✅ Multi-section fill shows progress bar
- ✅ Success state auto-dismisses after 3 seconds

## Dependencies

**Existing Code to Reuse:**
- `getActiveSectionTitle()` - Already in content.ts (line 109)
- `SECTION_MAP` - Already in content.ts (line 89)
- `SCEHelper` class - Has fill methods for individual sections
- `fillRouteAddress()` - Example of filling address field (line 729)

**New Code to Implement:**
- Section navigation logic (navigateToSection)
- Section filling orchestrator (fillSection)
- Multi-section fill handler (handleFillAllSections)
- Single-section fill handler (handleFillCurrentSection)
- Stop/interrupt mechanism

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SCE website structure changes | High | Section detection uses generic selectors, should be resilient |
| Chrome extension MV3 limitations | Medium | MV3 supports all required features (service worker, storage, messaging) |
| Performance with 18 sections | Low | Sequential processing with stop check, minimal overhead |
| Race conditions (rapid clicking) | Low | Disable buttons during fill, ignore duplicate requests |
| Banner injected into wrong page | Low | Check URL pattern in content script match pattern |

## Timeline Estimate

- Toast System: 1 hour
- Banner Controller: 2 hours
- CSS Styling: 1 hour
- content.ts Integration: 2 hours
- popup.ts Updates: 30 minutes
- Testing & Fixes: 2 hours

**Total: ~8.5 hours**

## Future Enhancements

- Configurable button order/styling in extension options
- Recent sections quick-select dropdown
- Bulk fill from clipboard (paste multiple addresses)
- Fill history/undo functionality
- Section-specific error recovery suggestions
- Progress export (send filled sections back to webapp)
- Dark mode auto-detection from SCE website
