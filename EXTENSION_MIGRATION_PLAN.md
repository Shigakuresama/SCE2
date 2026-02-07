# SCE1 → SCE2 Extension Migration Plan

## Executive Summary

Migrate the comprehensive SCE1 extension (2780 lines, 11 form sections) to SCE2's API-based architecture. SCE1 uses file-based storage with chrome.storage.sync; SCE2 uses a centralized cloud database with REST API.

## Current State Comparison

### SCE1 Extension (Source: `/home/sergio/Projects/SCE/sce-extension/`)

**Files:**
- `content.js` (2780 lines) - All form scraping and filling logic
- `background.js` (269 lines) - Route processing, batch handling, context menu
- `modules/route-processor.js` - Route planning and batch processing
- `modules/pdf-generator.js` - PDF generation with jsPDF
- `modules/map-view.js` - Leaflet map interface
- `sections/application-status.js` - Status tracking

**Architecture:**
- File-based storage (`chrome.storage.sync`)
- Local state management
- Direct Zillow API calls via proxy server
- No persistent queue system
- Single-machine operation

**Form Sections Handled (11 total):**
1. **Customer Search** - Address search, program selection
2. **Customer Information** - Extract homeowner info, generate email
3. **Additional Customer Information** - Demographics, language, household
4. **Project Information** - SqFt, year built (from Zillow/proxy)
5. **Trade Ally Information** - Contractor contact details
6. **Appointment Contact** - Scheduling fields
7. **Assessment Questionnaire** - Pre-assessment answers
8. **Household Members** - Household size and members
9. **Enrollment Information** - PRIZM codes, plus-4 ZIP
10. **Summary Info** - Review and confirmation
11. **Custom Fields** - User-defined field mappings

**Configuration Object (122 fields):**
```javascript
{
  // Customer Search
  address, zipCode,

  // Customer Information (no longer used, comes from SCE)
  firstName, lastName, phone, email,

  // Additional Customer Information (13 fields)
  title, preferredContactTime, language, ethnicity,
  householdUnits, spaceOrUnit, howDidYouHear,
  masterMetered, buildingType, homeownerStatus,
  gasProvider, gasAccountNumber, waterUtility, incomeVerifiedDate,

  // Demographics (5 fields)
  primaryApplicantAge, permanentlyDisabled, veteran, nativeAmerican,

  // Enrollment Information (2 fields)
  incomeVerificationType, plus4Zip,

  // Household Members (2 fields)
  householdMembersCount, relationToApplicant,

  // Project Information (3 fields)
  zillowSqFt, zillowYearBuilt, projectSpaceOrUnit,

  // Trade Ally (5 fields)
  projectFirstName, projectLastName, projectTitle,
  projectPhone, projectEmail,

  // Appointment Contact (6 fields)
  attempt1Date, attempt1Time, contractorName,
  appointmentDate, appointmentStatus, appointmentType,
  appointmentStartTime, appointmentEndTime,

  // Assessment/Equipment (11 fields)
  hvacSystemType, hasRoomAC, hasEvapCooler,
  refrigeratorCount, fridge1Year, hasFreezer,
  waterHeaterFuel, waterHeaterSize, hasDishwasher,
  hasClothesWasher, hasClothesDryer, clothesDryerType,

  // Equipment Information (3 fields)
  equipmentToInstall, equipmentBrand, equipmentModel,

  // Basic Enrollment (2 fields)
  measureType, equipmentQuantity,

  // Bonus Measures (2 fields)
  bonusMeasureType, adjustmentNotes,

  // Terms (2 fields)
  electronicAcceptance, priorIncentive,

  // Uploads (1 field)
  autoUploadDocs,

  // Comments (1 field)
  reviewComment,

  // Status (2 fields)
  autoAcceptLead, finalStatus,

  // Behavior (2 fields)
  autoFillPrompt, customFieldMap
}
```

### SCE2 Extension (Current State: `/home/sergio/Projects/SCE2/packages/extension/`)

**Files:**
- `src/content.ts` (304 lines) - Basic scrape/submit skeleton
- `src/background.ts` (499 lines) - Queue polling, job processing
- `src/lib/sce-helper.ts` (304 lines) - Angular form filling utilities
- `manifest.json` - MV3 with API permissions

**Architecture:**
- API-based (`http://localhost:3333/api/*`)
- Centralized database (SQLite/PostgreSQL)
- Queue-based job processing (scrape queue, submit queue)
- Cloud-ready (can deploy to Railway/Render)
- Multi-device capable

**Current Functionality:**
- ✅ Queue polling (scrape, submit)
- ✅ Basic customer search filling
- ✅ Basic customer info extraction (name, phone only)
- ✅ Document upload
- ✅ Case ID extraction
- ❌ Missing: 9 of 11 form sections
- ❌ Missing: Property data fetching (Zillow)
- ❌ Missing: Email generation
- ❌ Missing: Route processing
- ❌ Missing: PDF generation
- ❌ Missing: Map view
- ❌ Missing: Custom field mapping

## Migration Strategy

### Phase 1: Core Form Scraping Enhancement
**Goal:** Make SCE2 scrape ALL fields that SCE1 scrapes

**Tasks:**
1. ✅ Copy `config` object structure to TypeScript interfaces
2. ⬜ Port `fillCustomerSearch()` - Already done in SCE2
3. ⬜ Enhance `performScrape()` to extract all 11 sections
4. ⬜ Port `extractCustomerAddress()` - Capture actual address from form
5. ⬜ Port property data fetching (Zillow/proxy integration)
6. ⬜ Port email generation logic
7. ⬜ Add all field extractions:
   - Additional Customer Info (demographics, household)
   - Project Information (SqFt, year built)
   - Trade Ally Information
   - Assessment Questionnaire
   - Household Members
   - Enrollment Information
   - Equipment details
   - Bonus measures

### Phase 2: Core Form Submission Enhancement
**Goal:** Make SCE2 submit ALL fields that SCE1 fills

**Tasks:**
1. ⬜ Port section navigation logic from SCE1
2. ⬜ Implement section-by-section filling:
   - `fillAdditionalCustomerInfo()`
   - `fillProjectInformation()`
   - `fillTradeAllyInformation()`
   - `fillAppointmentContact()`
   - `fillAssessmentQuestionnaire()`
   - `fillHouseholdMembers()`
   - `fillEnrollmentInformation()`
   - Fill equipment sections
   - Fill bonus measures
   - Handle terms acceptance
3. ⬜ Port dropdown selection logic (`selectDropdown()`)
4. ⬜ Implement stop button functionality
5. ⬜ Add error banner system

### Phase 3: API Integration
**Goal:** Replace file storage with API calls

**Tasks:**
1. ⬜ Create API types for all form fields
2. ⬜ Update `performScrape()` to save all fields to `/api/queue/{id}/scraped`
3. ⬜ Update `performSubmit()` to read all fields from API job data
4. ⬜ Add property data API endpoint (`/api/property`)
5. ⬜ Implement document URL generation
6. ⬜ Add status update callbacks

### Phase 4: Utility Modules Migration
**Goal:** Port utility modules from SCE1

**Tasks:**
1. ⬜ Port `modules/route-processor.js`
   - Batch processing with progress updates
   - Address validation
   - Route optimization
2. ⬜ Port `modules/pdf-generator.js`
   - jsPDF integration
   - Route sheet generation
   - QR code support (already in SCE2)
3. ⬜ Port `modules/map-view.js`
   - Leaflet integration
   - Route visualization
   - Address plotting
4. ⬜ Port `sections/application-status.js`
   - Status tracking
   - Lead acceptance workflow

### Phase 5: Enhanced Features
**Goal:** Add SCE2-specific improvements

**Tasks:**
1. ⬜ Apartment detection and special handling
2. ⬜ Fuzzy address search integration
3. ⬜ Mobile web field data collection
4. ⬜ Photo upload support
5. ⬜ Real-time queue status updates
6. ⬜ Multi-user support with database

## Field Mapping: SCE1 → SCE2 Database

### Already Mapped ✅
- `propertyId` → `Property.id`
- `streetNumber`, `streetName`, `zipCode` → `Property.streetNumber`, `Property.streetName`, `Property.zipCode`
- `customerName`, `customerPhone` → `Property.customerName`, `Property.customerPhone`
- `documents` → `Property.documents[]` (via relation)

### Need to Map ⬜

**SCE1 Config Field** → **SCE2 Database Property**
- `address` → `addressFull` (computed)
- `primaryApplicantAge` → `customerAge`
- `zillowSqFt` → `sqFt`
- `zillowYearBuilt` → `yearBuilt`
- `projectFirstName`, `projectLastName` → `contractorName`
- `projectTitle` → N/A (new field?)
- `projectPhone` → `contractorPhone`
- `projectEmail` → `contractorEmail`
- `householdUnits` → `numUnits`
- `spaceOrUnit` → N/A (new field?)
- `masterMetered` → N/A (new field?)
- `buildingType` → N/A (new field?)
- `homeownerStatus` → N/A (new field?)
- `gasAccountNumber` → N/A (new field?)
- `waterUtility` → N/A (new field?)
- `incomeVerifiedDate` → N/A (new field?)
- `plus4Zip` → N/A (new field?)
- `incomeVerificationType` → N/A (new field?)
- `howDidYouHear` → N/A (new field?)
- `preferredContactTime` → N/A (new field?)
- `language` → N/A (new field?)
- `ethnicity` → N/A (new field?)
- `permanentlyDisabled` → N/A (new field?)
- `veteran` → N/A (new field?)
- `nativeAmerican` → N/A (new field?)
- `householdMembersCount` → N/A (new field?)
- `relationToApplicant` → N/A (new field?)
- `hvacSystemType` → N/A (new field?)
- `hasRoomAC` → N/A (new field?)
- `hasEvapCooler` → N/A (new field?)
- `refrigeratorCount` → N/A (new field?)
- `fridge1Year` → N/A (new field?)
- `hasFreezer` → N/A (new field?)
- `waterHeaterFuel` → N/A (new field?)
- `waterHeaterSize` → N/A (new field?)
- `hasDishwasher` → N/A (new field?)
- `hasClothesWasher` → N/A (new field?)
- `hasClothesDryer` → N/A (new field?)
- `clothesDryerType` → N/A (new field?)
- `equipmentToInstall` → N/A (new field?)
- `equipmentBrand` → N/A (new field?)
- `equipmentModel` → N/A (new field?)
- `measureType` → N/A (new field?)
- `equipmentQuantity` → N/A (new field?)
- `bonusMeasureType` → N/A (new field?)
- `adjustmentNotes` → `fieldNotes`?
- `electronicAcceptance` → N/A (new field?)
- `priorIncentive` → N/A (new field?)
- `autoUploadDocs` → N/A (config only?)
- `reviewComment` → `fieldNotes`?
- `autoAcceptLead` → N/A (config only?)
- `finalStatus` → `status`?

### Missing Database Fields
The SCE2 `Property` model needs approximately **40+ additional fields** to match SCE1's functionality.

## Implementation Priority

### High Priority (Core Functionality)
1. Scrape all customer info fields
2. Scrape all additional customer info (demographics)
3. Scrape project information (property data)
4. Fill all form sections during submission
5. Navigate through all form sections

### Medium Priority (Enhanced Features)
6. Property data fetching (Zillow/proxy)
7. Email generation
8. Trade Ally information handling
9. Assessment questionnaire handling
10. Household members handling

### Low Priority (Nice-to-Have)
11. Custom field mapping
12. Stop button functionality
13. Error banner system
14. Route processing
15. PDF generation
16. Map view

## Key Code Patterns to Preserve

### Angular Material Form Filling
```javascript
// From SCE1 - KEEP THIS PATTERN
async function setInputValue(input, value, fieldName, skipIfFilled = true) {
  // Focus with click for Angular to register
  input.focus();
  input.click();
  await sleep(150);

  // Use native setter for Angular to detect
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  }

  // Trigger comprehensive events
  element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  await sleep(300); // Wait for Angular to process
}
```

### Dropdown Selection
```javascript
// From SCE1 - PORT THIS
async function selectDropdown(labelText, value) {
  // Find dropdown by mat-label
  const labels = Array.from(document.querySelectorAll('mat-label'));
  const label = labels.find(l => l.textContent.includes(labelText));
  if (!label) return false;

  const formField = label.closest('mat-form-field');
  const select = formField?.querySelector('mat-select');
  if (!select) return false;

  // Click to open dropdown
  select.click();
  await sleep(500);

  // Find and click option
  const options = Array.from(document.querySelectorAll('mat-option'));
  const option = options.find(o => o.textContent?.trim().toLowerCase() === value.toLowerCase());
  if (option) {
    option.click();
    await sleep(300);
    return true;
  }
  return false;
}
```

### Section Detection
```javascript
// From SCE1 - PORT THIS
function detectCurrentPage() {
  const activeTitle = getActiveSectionTitle();
  if (activeTitle) {
    return globalThis.SCEAutoFillUtils?.sectionTitleToKey(activeTitle);
  }
  // ... URL pattern matching fallback
}
```

### Angular Stability Waiting
```javascript
// From SCE1 - PORT THIS
async function waitForAngularStability(timeoutMs = 5000) {
  // Wait for no spinners and DOM stability
  // Check for mat-progress-spinner
  // Check for no DOM changes for 500ms
}
```

## Testing Strategy

1. **Unit Tests**: Port SCE1's test files (`*.test.js`)
2. **Integration Tests**: Test each form section independently
3. **End-to-End Tests**: Full scrape → submit → verify workflow
4. **Manual Testing**: Use Chrome DevTools to verify each field

## Migration Checklist

- [ ] Read and document all SCE1 form sections
- [ ] Create TypeScript interfaces for all form data
- [ ] Add missing fields to Prisma schema
- [ ] Create API endpoints for all data
- [ ] Port customer search handling
- [ ] Port customer info extraction
- [ ] Port additional customer info extraction
- [ ] Port project information extraction
- [ ] Port trade ally information extraction
- [ ] Port assessment questionnaire extraction
- [ ] Port household members extraction
- [ ] Port enrollment information extraction
- [ ] Port equipment details extraction
- [ ] Implement dropdown selection
- [ ] Implement section navigation
- [ ] Implement stop button
- [ ] Port error banner system
- [ ] Port property data fetching
- [ ] Port email generation
- [ ] Port route processing
- [ ] Port PDF generation
- [ ] Port map view
- [ ] Test all 11 form sections
- [ ] Full end-to-end test
- [ ] Documentation update

## Estimated Effort

- **Phase 1** (Core Scraping): 8-12 hours
- **Phase 2** (Core Submission): 10-15 hours
- **Phase 3** (API Integration): 4-6 hours
- **Phase 4** (Utility Modules): 12-20 hours
- **Phase 5** (Enhanced Features): 8-12 hours

**Total**: 42-65 hours of development work

## Next Steps

1. Start with Phase 1: Port all scraping logic from SCE1
2. Add missing fields to Prisma schema
3. Create comprehensive TypeScript interfaces
4. Implement section-by-section migration
5. Test thoroughly at each phase

## Notes

- Preserve SCE1's battle-tested Angular form interaction patterns
- Keep email generation logic (80% Gmail, 20% Yahoo)
- Maintain stop button functionality for user control
- Keep error banner system for user feedback
- Port route processing for batch operations
- Consider adding apartment detection improvements
- Add photo upload support for mobile web integration
