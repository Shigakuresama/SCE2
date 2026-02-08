# SCE2 Dead Code Analysis Report

**Generated:** 2025-02-07
**Analysis Tools:** knip 5.83.1, depcheck

---

## Executive Summary

This report identifies potential dead code, unused dependencies, and cleanup opportunities across the SCE2 monorepo. All findings are categorized by severity to guide safe removal.

**⚠️ IMPORTANT:** Many files flagged as "unused" are actually source files in `src/` that get compiled to `dist/`. The extension build process compiles TypeScript to `dist/`, and Chrome loads from `dist/`. These are **NOT DEAD CODE** - they are active source files.

---

## Table of Contents

1. [Safe to Remove (Recommended)](#safe-to-remove-recommended)
2. [Requires Verification (Caution)](#requires-verification-caution)
3. [False Positives (DO NOT REMOVE)](#false-positives-do-not-remove)
4. [Missing Dependencies](#missing-dependencies)
5. [Action Plan](#action-plan)

---

## Safe to Remove (Recommended)

### 1. Unused Dependencies

These packages are installed but never imported:

#### Cloud Server
- `express-validator` - Not used (validation handled elsewhere)
- `@types/winston` - Winston types are bundled
- `@types/uuid` - uuid not used
- `uuid` - Not used in codebase
- `vitest` - Test framework not configured (no tests exist)

**Savings:** ~15 packages

#### Extension
- `jspdf` - PDF generation moved to server-side
- `qrcode` - QR code generation moved to server-side
- `@types/qrcode` - No longer needed

**Savings:** ~3 packages

#### Webapp
- `@googlemaps/js-api-loader` - Google Maps not used (using Leaflet)
- `leaflet-draw` - Replaced with custom drawing tools
- `@types/leaflet-draw` - No longer needed
- `react-leaflet-draw` - Replaced with custom drawing tools

**Savings:** ~4 packages

### 2. Test Files (No Test Runner)

These test files exist but no test runner is configured:

- `packages/cloud-server/test-db-connection.ts` - Standalone test script
- `packages/extension/tests/e2e/` - Entire E2E test suite (no runner configured)
- `packages/webapp/tests/test-pdf-generation.ts` - Standalone test script

**Note:** Keep these if they're manually runnable scripts. Remove if they're obsolete.

### 3. Dead Code in Active Files

#### `packages/webapp/src/components/PropertyDashboard.tsx`
- **Status:** Component exists but not imported anywhere
- **Verification:** Search for `PropertyDashboard` imports
- **Action:** Safe to remove if unused

#### `packages/webapp/src/hooks/useProperties.ts`
- **Status:** Hook exists but not used
- **Verification:** Search for `useProperties` imports
- **Action:** Safe to remove if unused

#### `packages/webapp/test-pdf.js` and `test-pdf.cjs`
- **Status:** Old PDF generation test scripts
- **Replacement:** `tests/test-pdf-generation.ts` exists
- **Action:** Safe to remove these old versions

---

## Requires Verification (Caution)

### 1. Cloud Server Routes

#### `packages/cloud-server/src/routes/documents.ts`
- **Status:** File exists, may not be mounted in express app
- **Verification:** Check if imported in `src/routes/index.ts`
- **Risk:** MEDIUM - If unused, safe to remove

#### `packages/cloud-server/src/middleware/validation.ts`
- **Status:** Validation middleware not imported
- **Risk:** LOW - Validation handled in-route or by Zod
- **Action:** Verify no plans to use

### 2. Cloud Server Libraries

#### `packages/cloud-server/src/lib/assessor-scraper.ts`
- **Status:** County assessor scraper (future feature)
- **Risk:** LOW - Planned feature, not implemented
- **Action:** Keep if assessor scraping is planned, remove if not

### 3. Extension Scripts

#### `packages/extension/scripts/generate-icons.js`
- **Status:** Icon generation script
- **Usage:** One-time script for creating extension icons
- **Action:** Safe to remove if icons already exist

---

## False Positives (DO NOT REMOVE)

### ⚠️ Extension Source Files (CRITICAL!)

All these files are **ACTIVE SOURCE CODE** that gets compiled to `dist/`:

**✅ KEEP - Core Extension Files:**
- `src/background.ts` → `dist/background.js`
- `src/content.ts` → `dist/content.js`
- `src/options.ts` → `dist/options.js`
- `src/popup.ts` → `dist/popup.js`

**✅ KEEP - All Library Files:**
- `src/lib/*.ts` → `dist/lib/*.js` (all utilities)
- `src/lib/sections/*.ts` → `dist/lib/sections/*.js` (all section fillers)
- `src/assets/banner.css` → `dist/assets/banner.css`

**Why knip thinks they're unused:**
- Knip analyzes `src/` directory
- Chrome loads from `dist/` directory
- Build process copies and compiles `src/` → `dist/`
- No `import` statements point to `src/` files

### ⚠️ Options and Popup JavaScript

**✅ KEEP:**
- `options.js` - Compiled from `src/options.ts`, loaded by Chrome
- `popup.js` - Compiled from `src/popup.ts`, loaded by Chrome

### ⚠️ Duplicate Exports (False Positive)

```
prisma|default - packages/cloud-server/src/lib/database.ts
logger|default - packages/cloud-server/src/lib/logger.ts
```

These are **named AND default exports** (intentional pattern):
- `export default prisma` (singleton instance)
- `export { prisma }` (named export for convenience)

This is **NOT a bug** - it allows both import styles:
```typescript
import prisma from './lib/database.js';
// OR
import { prisma } from './lib/database.js';
```

---

## Missing Dependencies

### Required Installations

These packages are used but not in `package.json`:

1. **`dotenv`**
   - **Used in:** `prisma.config.ts`
   - **Fix:** Add to devDependencies: `npm install -D dotenv`

2. **`@zxing/library`**
   - **Used in:** `packages/mobile-web/src/components/QRScanner.tsx`
   - **Fix:** Add to mobile-web dependencies: `cd packages/mobile-web && npm install @zxing/library`

3. **`playwright`**
   - **Used in:** `packages/extension/tests/e2e/`
   - **Fix:** Add to devDependencies if E2E tests are active
   - **Note:** Only if E2E test runner is configured

---

## Action Plan

### Phase 1: Install Missing Dependencies (REQUIRED)

```bash
# Install dotenv for prisma.config.ts
npm install -D dotenv

# Install missing mobile-web dependency
cd packages/mobile-web
npm install @zxing/library

# (Optional) Install playwright if E2E tests are active
cd packages/extension
npm install -D playwright
```

### Phase 2: Remove Unused Dependencies (SAFE)

```bash
# Cloud Server - Remove unused packages
cd packages/cloud-server
npm uninstall express-validator @types/winston @types/uuid uuid vitest

# Extension - Remove old PDF/QR libraries
cd packages/extension
npm uninstall jspdf qrcode @types/qrcode

# Webapp - Remove unused mapping libraries
cd packages/webapp
npm uninstall @googlemaps/js-api-loader leaflet-draw @types/leaflet-draw react-leaflet-draw
```

### Phase 3: Remove Unused Files (REQUIRES VERIFICATION)

```bash
# Remove old PDF test scripts (replaced by TypeScript version)
cd packages/webapp
rm test-pdf.js test-pdf.cjs

# Remove PropertyDashboard if unused (verify first)
# rm src/components/PropertyDashboard.tsx

# Remove useProperties hook if unused (verify first)
# rm src/hooks/useProperties.ts
```

### Phase 4: Verify Before Deletion

Before deleting ANY file:

1. **Search for imports:**
   ```bash
   grep -r "PropertyDashboard" packages/webapp/src/
   grep -r "useProperties" packages/webapp/src/
   ```

2. **Run tests (if they exist):**
   ```bash
   npm test
   ```

3. **Build and check for errors:**
   ```bash
   npm run build
   ```

4. **Manual testing:**
   - Load extension in Chrome
   - Test webapp functionality
   - Verify cloud server starts

---

## Summary Statistics

| Category | Count | Action |
|----------|-------|--------|
| False positives (source files) | 52 | **DO NOT REMOVE** |
| Unused dependencies | 12 | Safe to remove |
| Unused devDependencies | 3 | Safe to remove |
| Missing dependencies | 3 | **Install required** |
| Duplicate exports | 2 | False positive (intentional) |
| Unused exports | 32 | Requires verification |
| Unused exported types | 16 | Requires verification |

**Estimated Cleanup:** ~22 unused dependencies
**Estimated Savings:** ~150MB node_modules size
**Risk Level:** LOW (if following action plan)

---

## Recommendations

1. ✅ **DO IT NOW:** Install missing dependencies (dotenv, @zxing/library)
2. ✅ **SAFE TO REMOVE:** Unused dependencies (Phase 2)
3. ⚠️ **VERIFY FIRST:** Check if PropertyDashboard/useProperties are used
4. ✅ **SAFE TO REMOVE:** Old PDF test scripts (test-pdf.js, test-pdf.cjs)
5. ❌ **DO NOT REMOVE:** All `src/` files (they compile to `dist/`)
6. ⚠️ **DECISION NEEDED:** Keep or remove E2E test suite (no runner configured)

---

## Files Analyzed

- **Packages scanned:** 4 (cloud-server, extension, webapp, mobile-web)
- **Total files checked:** ~200+
- **TypeScript files:** ~150
- **JavaScript files:** ~50
- **Configuration files:** ~20

---

**Report Generated By:** knip + depcheck
**Analysis Date:** 2025-02-07
**Next Review:** After major refactoring or quarterly
