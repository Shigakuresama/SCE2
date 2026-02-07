# SCE2 Extension Improvement Backlog

**Date**: 2026-02-06
**Created By**: Subagent Task 3
**Purpose**: Prioritized action items to complete SCE2 extension development

---

## Phase 1: Security & Stability (Priority 0 - CRITICAL)

**Timeline**: Week 1
**Goal**: Address production-blocking issues
**Effort**: 4-6 days

### P0-1: Fix Type Safety Erosion

- **Impact**: Prevents runtime crashes, enables refactoring
- **Effort**: 1 day
- **Source**: SCE2 analysis, lines 132-197
- **Action**: Replace 8 `as any`/unsafe casts with proper type guards
- **Files**: content.ts:154, 281; background.ts:224; sce-helper.ts:89,161,186,280,252
- **Acceptance**: Zero `as any` or unsafe type assertions

### P0-2: Implement Job Failure Reporting

- **Impact**: Queue stalls without error visibility
- **Effort**: 0.5 days
- **Source**: SCE2 analysis, line 353
- **Action**: Create `/api/queue/{id}/failed` endpoint, call from background.ts
- **Files**: background.ts:353 (markJobFailed), cloud-server routes
- **Acceptance**: Failed jobs report status to API

### P0-3: Fix Resource Cleanup

- **Impact**: Memory leaks, tab leaks
- **Effort**: 1 day
- **Source**: SCE2 analysis, lines 317-386; SCE1 analysis memory leaks
- **Action**: Implement cleanup handlers for timers, tabs, observers
- **Files**: background.ts:425-433 (timers), background.ts:355-364 (tabs)
- **Acceptance**: All resources properly cleaned up

### P0-4: Add Schema Validation

- **Impact**: Prevents API integration bugs
- **Effort**: 1 day
- **Source**: SCE2 analysis, lines 424-489
- **Action**: Implement Zod schemas for API requests/responses
- **Files**: background.ts:77, content.ts, cloud-server
- **Acceptance**: All API calls validated with Zod

### P0-5: Replace Hardcoded Localhost URL

- **Impact**: Cannot deploy to cloud
- **Effort**: 0.5 days
- **Source**: SCE2 analysis, line 427; SCE1 analysis, line 306
- **Action**: Load API URL from environment variable or build config
- **Files**: packages/extension/src/config.ts, background.ts:77
- **Acceptance**: API URL configurable via environment

---

**Phase 1 Total**: 5 items, 4-6 days

---

## Phase 2: Feature Parity (Priority 1 - HIGH)

**Timeline**: Weeks 2-3
**Goal**: Match SCE1 functionality (9 missing form sections)
**Effort**: 8-12 days

### P1-1: Implement Additional Customer Information Section

- **Impact**: Critical demographic data missing
- **Effort**: 2 days
- **Source**: SCE2 analysis, lines 198-247; EXTENSION_MIGRATION_PLAN.md
- **Action**: Port fillAdditionalCustomerInfo() from SCE1 content.js:1037-1251
- **Fields**: 13 fields (title, language, ethnicity, household, etc.)
- **Files**: content.ts (scrape + fill), sce-helper.ts
- **Acceptance**: Section scrapes and fills all 13 fields

### P1-2: Implement Project Information Section

- **Impact**: SqFt, year built missing
- **Effort**: 1 day
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 63-64
- **Action**: Port property data fetching from Zillow/proxy
- **Fields**: zillowSqFt, zillowYearBuilt, projectSpaceOrUnit
- **Files**: content.ts, new file lib/zillow.ts
- **Acceptance**: Scrapes SqFt/year built, fills form fields

### P1-3: Implement Trade Ally Information Section

- **Impact**: Contractor data not captured
- **Effort**: 0.5 days
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 66-68 (5 fields)
- **Action**: Port contractor information filling
- **Fields**: projectFirstName, projectLastName, projectTitle, projectPhone, projectEmail
- **Files**: sce-helper.ts, content.ts
- **Acceptance**: Section scrapes and fills all 5 fields

### P1-4: Implement Assessment Questionnaire Section

- **Impact**: Pre-screening questions not answered
- **Effort**: 1 day
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 75-79 (11 fields)
- **Action**: Port pre-assessment answers handling
- **Fields**: hvacSystemType, hasRoomAC, hasEvapCooler, refrigeratorCount, fridge1Year, hasFreezer, waterHeaterFuel, waterHeaterSize, hasDishwasher, hasClothesWasher, hasClothesDryer, clothesDryerType
- **Files**: sce-helper.ts
- **Acceptance**: All 11 assessment questions answered

### P1-5: Implement Household Members Section

- **Impact**: Multi-person households unsupported
- **Effort**: 1 day
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 60-61 (2 fields)
- **Action**: Port household member handling
- **Fields**: householdMembersCount, relationToApplicant
- **Files**: sce-helper.ts, prisma schema (add householdMembers table)
- **Acceptance**: Household members captured

### P1-6: Implement Enrollment Information Section

- **Impact**: Program eligibility not verified
- **Effort**: 0.5 days
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 57-58 (2 fields)
- **Action**: Port enrollment info handling
- **Fields**: incomeVerificationType, plus4Zip
- **Files**: sce-helper.ts
- **Acceptance**: Enrollment information filled

### P1-7: Implement Equipment Information Section

- **Impact**: Appliance details not submitted
- **Effort**: 1 day
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 81-85 (3 fields)
- **Action**: Port equipment details handling
- **Fields**: equipmentToInstall, equipmentBrand, equipmentModel
- **Files**: sce-helper.ts
- **Acceptance**: Equipment information captured

### P1-8: Implement Bonus Program Section

- **Impact**: Additional rebates not claimed
- **Effort**: 0.5 days
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 87-88 (2 fields)
- **Action**: Port bonus measures handling
- **Fields**: bonusMeasureType, adjustmentNotes
- **Files**: sce-helper.ts
- **Acceptance**: Bonus programs claimed

### P1-9: Implement Terms and Conditions Acceptance

- **Impact**: Legal agreement not accepted
- **Effort**: 0.5 days
- **Source**: EXTENSION_MIGRATION_PLAN.md lines 90-91 (2 fields)
- **Action**: Port terms acceptance handling
- **Fields**: electronicAcceptance, priorIncentive
- **Files**: sce-helper.ts
- **Acceptance**: Terms accepted; submission valid

### P1-10: Add Section Navigation Logic

- **Impact**: Cannot navigate between form sections
- **Effort**: 1.5 days
- **Source**: SCE2 analysis, lines 227-229; SCE1 patterns to preserve
- **Action**: Port section detection and navigation from SCE1
- **Files**: sce-helper.ts (navigateToSection method), content.ts (use SECTION_MAP)
- **Dependencies**: P1-1 through P1-9
- **Acceptance**: Can navigate to any of 11 sections

### P1-11: Improve Document Upload with Metadata

- **Impact**: Only uploads files; no document type, description, or validation
- **Effort**: 1 day
- **Source**: SCE2 analysis, lines 762-808
- **Action**: Add document type selection, validation, and metadata
- **Features**: Document type dropdown, file size validation, format validation, description field, progress reporting
- **Files**: sce-helper.ts, prisma schema (add metadata fields)
- **Acceptance**: Document type, description, validation all implemented

---

**Phase 2 Total**: 11 items, 8-12 days

---

## Phase 3: Quality & Performance (Priority 2 - MEDIUM)

**Timeline**: Week 4
**Goal**: Improve code quality and performance
**Effort**: 5-7 days

### P2-1: Add Retry Logic with Exponential Backoff

- **Impact**: Handles transient failures
- **Effort**: 1 day
- **Source**: SCE2 analysis recommendations
- **Action**: Implement retry wrapper for API calls
- **Files**: lib/retry.ts (new), background.ts
- **Acceptance**: All API calls retry 3x with exponential backoff

### P2-2: Implement Structured Logging

- **Impact**: Debugging, monitoring
- **Effort**: 1 day
- **Source**: SCE2 analysis recommendations
- **Action**: Replace console.log with structured logger (winston/pino)
- **Files**: lib/logger.ts, content.ts, background.ts, sce-helper.ts
- **Acceptance**: All logs include timestamp, level, context

### P2-3: Add Unit Tests (70% Coverage Target)

- **Impact**: Prevents regressions
- **Effort**: 3 days
- **Source**: SCE2 analysis, lines 387-422
- **Action**: Write Vitest tests for core logic
- **Files**: tests/content.test.ts, tests/background.test.ts, tests/sce-helper.test.ts
- **Test Cases**: SCEHelper.fillField() (5 cases), waitForElement() (3 cases), processJob() (4 cases), fetchJob() (3 cases), uploadDocuments() (4 cases), Queue polling (2 cases)
- **Dependencies**: P0-1
- **Acceptance**: 70% code coverage, all tests pass

### P2-4: Fix Queue Polling Race Condition

- **Impact**: Multiple polls could process same job simultaneously
- **Effort**: 0.5 days
- **Source**: SCE2 analysis, lines 657-696
- **Action**: Implement atomic job marking in API
- **Files**: cloud-server/routes/queue.ts, background.ts
- **Acceptance**: Only one poll can process a job

### P2-5: Add Performance Monitoring

- **Impact**: Production visibility
- **Effort**: 0.5 days
- **Source**: SCE2 analysis recommendations
- **Action**: Instrument key operations with timing
- **Files**: lib/metrics.ts, background.ts
- **Acceptance**: Key operations timed; metrics reportable

### P2-6: Improve Error Messages

- **Impact**: Better debugging
- **Effort**: 1 day
- **Source**: SCE2 analysis, line 562
- **Action**: Add context, suggestions, and stack traces to errors
- **Files**: lib/errors.ts, content.ts
- **Acceptance**: All errors include field, selector, recovery suggestion

---

**Phase 3 Total**: 6 items, 5-7 days

---

## Phase 4: Documentation & Polish (Priority 3 - LOW)

**Timeline**: Week 5
**Goal**: Improve maintainability and UX
**Effort**: 3-5 days

### P3-1: Write README for Extension

- **Impact**: Onboarding, maintenance
- **Effort**: 0.5 days
- **Action**: Create packages/extension/README.md
- **Content**: Architecture overview, setup instructions, development workflow, testing instructions, troubleshooting guide
- **Files**: packages/extension/README.md
- **Acceptance**: README covers architecture, setup, development, testing

### P3-2: Document All Public APIs

- **Impact**: Developer experience
- **Effort**: 1 day
- **Source**: SCE2 analysis identified <15% documentation coverage
- **Action**: Add JSDoc comments to all public methods
- **Files**: sce-helper.ts, content.ts, background.ts
- **Acceptance**: All public methods have JSDoc with @param, @throws, @example

### P3-3: Add Configuration UI Popup

- **Impact**: User experience
- **Effort**: 1 day
- **Action**: Create popup UI for extension configuration
- **Features**: API URL input, poll interval slider, debug mode toggle
- **Files**: src/popup/App.tsx, src/popup/index.html
- **Acceptance**: Users can configure extension without editing code

### P3-4: Implement Progress Indicators

- **Impact**: User experience
- **Effort**: 0.5 days
- **Action**: Add progress bars and status updates
- **Features**: Show "Scraping..." / "Submitting..." badge, progress bar, success/error notifications
- **Files**: lib/progress.ts, content.ts
- **Acceptance**: Users see real-time progress

### P3-5: Remove Dead Code

- **Impact**: Code cleanliness
- **Effort**: 0.5 days
- **Source**: SCE2 analysis, lines 573-585 (SECTION_MAP never used)
- **Action**: Remove or implement dead code
- **Files**: content.ts:52-67
- **Acceptance**: No unused imports, variables, or functions

---

**Phase 4 Total**: 5 items, 3-5 days

---

## Effort Summary

| Phase | Priority | Items | Total Days | Timeline |
|-------|----------|-------|------------|----------|
| Phase 1 | P0 (Critical) | 5 | 4-6 days | Week 1 |
| Phase 2 | P1 (High) | 11 | 8-12 days | Weeks 2-3 |
| Phase 3 | P2 (Medium) | 6 | 5-7 days | Week 4 |
| Phase 4 | P3 (Low) | 5 | 3-5 days | Week 5 |
| **Total** | **All** | **24** | **20-30 days** | **5 weeks** |

---

## Dependencies

### Critical Path (Must Complete in Order)

1. **P0-1 (Type Safety)** → P2-3 (Testing)
   - Cannot write tests without stable types

2. **P0-4 (Schema Validation)** → P1-1 through P1-9 (Form Sections)
   - All form sections need validation

3. **P1-1 through P1-9 (Individual Sections)** → P1-10 (Section Navigation)
   - Navigation needs all sections to exist

4. **P0-2 (Job Failure API)** → P2-1 (Retry Logic)
   - Retry needs failure endpoint

### Parallel Work Items (Can Do Simultaneously)

- **P0-3, P0-4, P0-5** - Resource cleanup, validation, config
- **P1-1 through P1-9** - Form sections
- **P2-1, P2-2, P2-5, P2-6** - Retry, logging, metrics, errors
- **P3-1, P3-2, P3-5** - README, API docs, dead code removal

---

## Risk Assessment

### High-Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| **P1-1 (Additional Customer Info)** | 13 fields; complex dropdowns | Test each field individually; copy patterns from SCE1 |
| **P1-2 (Project Info - Zillow)** | Zillow API may block | Implement fallback to manual entry; cache data |
| **P1-10 (Section Navigation)** | SCE website structure may change | Use multiple selector strategies; add timeout |
| **P0-1 (Type Safety)** | May break existing code | Add tests first; commit frequently; review changes |

### Medium-Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| **P2-3 (Unit Tests)** | DOM mocking difficult | Use jsdom; mock fetch; focus on pure functions |
| **P1-11 (Document Upload)** | File input handling varies | Test in multiple browsers; add progress reporting |
| **P2-4 (Queue Race)** | Database transaction may deadlock | Keep transactions short; add retry logic |

### Low-Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| **P3-3 (Config UI)** | React in extension is non-standard | Use Vite; keep UI simple |
| **P0-3 (Resource Cleanup)** | Extension lifecycle events inconsistent | Test on suspend/update/uninstall |

---

## SCE1 Patterns to Preserve and Avoid

### Patterns to Preserve

- Angular form interaction patterns (setInputValue, selectDropdown)
- Section detection logic (detectCurrentPage, getActiveSectionTitle)
- Email generation logic (80% Gmail, 20% Yahoo)
- Dropdown selection with mat-label support
- Native property setter usage for Angular change detection
- Comprehensive event triggering (input, change, keydown, keyup)
- Wait for Angular stability (check for spinners, DOM stability)
- Stop button functionality
- Error banner system

### Patterns to Avoid

- Hardcoded setTimeout()/sleep() calls - Use proper async/await with waitForElement()
- Global namespace pollution - Use encapsulated classes
- Memory leaks (event listeners, observers, timers) - Implement cleanup handlers
- Magic numbers (5000, 30000, etc.) - Define named constants
- Monolithic functions (412-line submitProperty()) - Break into small functions
- Zero type safety - Use TypeScript properly (no as any)
- Inconsistent error handling - Use Result type or consistent error responses
- Console-only logging - Use structured logger with timestamps and context

---

**Backlog Created**: 2026-02-06
**Created By**: Subagent Task 3 (Implementer)
**Status**: Ready for execution
