# Fix Critical SCE2 Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical and major issues discovered during comprehensive testing to make SCE2 production-ready.

**Architecture:** Backend API fixes + Frontend data loading fixes + Security updates. Each fix is independent and can be committed separately.

**Tech Stack:** TypeScript, Express, React, Prisma, npm audit

---

## Task 1: Add `/api/queue/status` endpoint

**Files:**
- Modify: `packages/cloud-server/src/routes/queue.ts` (add endpoint at end of file, before line 118)
- Test: Manual testing with curl

**Context:** The webapp polls this endpoint every 5 seconds from `AppContext.tsx:42`. It currently returns 404, flooding the console with errors. The endpoint should return counts of properties in each status.

**Step 1: Write the endpoint**

```typescript
// Add to packages/cloud-server/src/routes/queue.ts after line 117

// GET /api/queue/status - Get queue status counts
queueRoutes.get(
  '/status',
  asyncHandler(async (req, res) => {
    const [pendingScrape, readyForField, visited, readyForSubmission, complete, failed] =
      await Promise.all([
        prisma.property.count({ where: { status: 'PENDING_SCRAPE' } }),
        prisma.property.count({ where: { status: 'READY_FOR_FIELD' } }),
        prisma.property.count({ where: { status: 'VISITED' } }),
        prisma.property.count({ where: { status: 'READY_FOR_SUBMISSION' } }),
        prisma.property.count({ where: { status: 'COMPLETE' } }),
        prisma.property.count({ where: { status: 'FAILED' } }),
      ]);

    res.json({
      success: true,
      data: {
        pendingScrape,
        readyForField,
        visited,
        readyForSubmission,
        complete,
        failed,
      },
    });
  })
);
```

**Step 2: Test the endpoint**

Run: `curl http://localhost:3333/api/queue/status | jq .`
Expected: JSON with status counts
```json
{
  "success": true,
  "data": {
    "pendingScrape": 1,
    "readyForField": 1,
    "visited": 0,
    "readyForSubmission": 0,
    "complete": 1,
    "failed": 1
  }
}
```

**Step 3: Verify webapp console is clean**

Open webapp at http://localhost:5173/
Open browser console (F12)
Expected: No 404 errors for `/api/queue/status`

**Step 4: Commit**

```bash
git add packages/cloud-server/src/routes/queue.ts
git commit -m "feat: add /api/queue/status endpoint

Returns counts of properties in each workflow status.
Fixes 404 errors from webapp queue status polling."
```

---

## Task 2: Add `/api/queue/addresses` endpoint for batch queuing

**Files:**
- Modify: `packages/cloud-server/src/routes/queue.ts` (add endpoint after Task 1 addition)
- Test: Manual testing with curl

**Context:** The webapp expects this endpoint at `api.ts:150` to queue multiple addresses for batch scraping. Currently returns 404.

**Step 1: Write the endpoint**

```typescript
// Add to packages/cloud-server/src/routes/queue.ts after Task 1 addition

// POST /api/queue/addresses - Queue multiple addresses for scraping
queueRoutes.post(
  '/addresses',
  asyncHandler(async (req, res) => {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new ValidationError('addresses must be a non-empty array');
    }

    // Validate each address has required fields
    for (const addr of addresses) {
      if (!addr.addressFull || !addr.streetNumber || !addr.streetName || !addr.zipCode) {
        throw new ValidationError(
          'Each address must have addressFull, streetNumber, streetName, zipCode'
        );
      }
    }

    // Bulk create properties with PENDING_SCRAPE status
    const properties = await prisma.property.createMany({
      data: addresses.map((addr: any) => ({
        addressFull: addr.addressFull,
        streetNumber: addr.streetNumber,
        streetName: addr.streetName,
        zipCode: addr.zipCode,
        city: addr.city,
        state: addr.state,
        latitude: addr.latitude,
        longitude: addr.longitude,
        status: 'PENDING_SCRAPE',
      })),
    });

    // Fetch created properties to return them
    const createdProperties = await prisma.property.findMany({
      where: {
        addressFull: { in: addresses.map((a: any) => a.addressFull) },
      },
      orderBy: { createdAt: 'desc' },
      take: addresses.length,
    });

    res.status(201).json({
      success: true,
      data: createdProperties,
      count: properties.count,
    });
  })
);
```

**Step 2: Test the endpoint**

Run: `curl -X POST http://localhost:3333/api/queue/addresses \
  -H "Content-Type: application/json" \
  -d '{"addresses":[{"addressFull":"789 Test St, Irvine, CA 92614","streetNumber":"789","streetName":"Test St","zipCode":"92614","city":"Irvine","state":"CA"}]}' | jq .`

Expected: Created property with status PENDING_SCRAPE
```json
{
  "success": true,
  "data": [{
    "id": 6,
    "status": "PENDING_SCRAPE",
    ...
  }],
  "count": 1
}
```

**Step 3: Commit**

```bash
git add packages/cloud-server/src/routes/queue.ts
git commit -m "feat: add /api/queue/addresses endpoint for batch queuing

Allows queuing multiple addresses at once for scraping.
All addresses get PENDING_SCRAPE status."
```

---

## Task 3: Fix Properties page auto-load

**Files:**
- Modify: `packages/webapp/src/pages/Properties.tsx` (add useEffect after line 7)
- Test: Manual testing in browser

**Context:** Properties page never calls `fetchProperties()` on mount, always shows "No properties" until user manually clicks Refresh. Need to add useEffect to auto-load.

**Step 1: Add useEffect to auto-load properties**

```tsx
// Modify packages/webapp/src/pages/Properties.tsx
// Add import at top with other imports
import React, { useState, useEffect } from 'react';

// Add useEffect after const declarations (after line 7-8)
export const Properties: React.FC = () => {
  const { properties, loading, error, fetchProperties, clearError } = useApp();
  const [filter, setFilter] = useState<PropertyStatus | 'ALL'>('ALL');

  // Add this useEffect
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const filteredProperties = properties.filter((property) => {
    // rest of component unchanged
```

**Step 2: Test the fix**

1. Start cloud-server: `cd packages/cloud-server && npm run dev`
2. Start webapp: `cd packages/webapp && npm run dev`
3. Open http://localhost:5173/properties
4. Open browser console (F12)

Expected:
- Properties load automatically on page load
- No "No properties" message on first visit
- Properties display immediately

**Step 3: Commit**

```bash
git add packages/webapp/src/pages/Properties.tsx
git commit -m "fix: auto-load properties on page mount

Properties page now fetches data on component mount.
Fixes issue where page showed 'No properties' until manual refresh."
```

---

## Task 4: Fix root Prisma schema provider mismatch

**Files:**
- Modify: `prisma/schema.prisma` (line 13)
- Test: `npx prisma db push` from project root

**Context:** Root-level schema has `provider = "postgresql"` hardcoded but `.env` uses `DATABASE_URL="file:./dev.sqlite"`. This prevents running prisma commands from project root.

**Step 1: Update provider to sqlite**

```prisma
// File: prisma/schema.prisma
// Line 13, change from:
datasource db {
  provider = "postgresql"
}

// To:
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Step 2: Test prisma commands from root**

Run: `cd /home/sergio/Projects/SCE2 && npx prisma db push`
Expected: Success (not error about protocol)

**Step 3: Verify schema is correct**

Run: `cat prisma/schema.prisma | grep -A2 "datasource db"`
Expected:
```
datasource db {
  provider = "sqlite"
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "fix: change root schema provider from postgresql to sqlite

Root schema was hardcoded to postgresql but .env uses SQLite.
This prevented running prisma commands from project root.
Note: cloud-server has its own correct schema in packages/cloud-server/prisma/"
```

---

## Task 5: Fix npm security vulnerabilities

**Files:**
- None (dependency updates)
- Test: `npm audit`

**Context:** npm audit found 14 vulnerabilities (1 critical, 13 moderate). Need to run audit fix.

**Step 1: Run npm audit fix**

Run: `npm audit fix`
Expected: Some vulnerabilities automatically fixed

**Step 2: Check remaining vulnerabilities**

Run: `npm audit`
Expected: Fewer vulnerabilities (note any remaining)

**Step 3: If critical remains, review manually**

Run: `npm audit --json | jq '.vulnerabilities | to_entries[] | select(.value.severity == "critical")'`
Expected: Identify which package has critical vulnerability

**Step 4: Update package-lock.json**

Run: `git add package-lock.json`
If any packages were updated: `git add package.json` (at root level)

**Step 5: Commit**

```bash
git commit -m "fix: run npm audit fix to address security vulnerabilities

Addressed vulnerabilities found by npm audit.
Remaining vulnerabilities may require manual review or package updates."
```

---

## Task 6: Add QueueStatus type to types.ts

**Files:**
- Modify: `packages/webapp/src/types.ts` (add QueueStatus interface)
- Test: Type checking with TypeScript

**Context:** The QueueStatus type is used in `AppContext.tsx` and `api.ts` but may not be defined in `types.ts`. Need to ensure it exists.

**Step 1: Add QueueStatus interface if missing**

```typescript
// Add to packages/webapp/src/types.ts

export interface QueueStatus {
  pendingScrape: number;
  readyForField: number;
  visited: number;
  readyForSubmission: number;
  complete: number;
  failed: number;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/webapp && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add packages/webapp/src/types.ts
git commit -m "feat: add QueueStatus type definition

Defines the shape of queue status data returned by /api/queue/status"
```

---

## Task 7: Fix accessibility issues - Add labels to form fields

**Files:**
- Modify: `packages/webapp/src/components/AddressInput.tsx`
- Modify: `packages/webapp/src/components/PDFGenerator.tsx`
- Test: Browser accessibility audit

**Context:** Accessibility audit found 7 form fields without labels and 9 without id/name attributes. Need to add proper labeling.

**Step 1: Fix AddressInput component**

```tsx
// Modify packages/webapp/src/components/AddressInput.tsx
// Add htmlFor and id to all label/input pairs

{addresses.map((address, index) => (
  <div key={index} className="border p-4 rounded">
    <h3>Address {index + 1}</h3>

    <label htmlFor={`fullAddress-${index}`} className="block text-sm font-medium">
      Full Address *
    </label>
    <input
      id={`fullAddress-${index}`}
      name={`fullAddress-${index}`}
      type="text"
      value={address.addressFull}
      onChange={(e) => handleAddressChange(index, 'addressFull', e.target.value)}
      className="mt-1 block w-full rounded border p-2"
      required
    />

    <label htmlFor={`streetNumber-${index}`} className="block text-sm font-medium">
      Street Number *
    </label>
    <input
      id={`streetNumber-${index}`}
      name={`streetNumber-${index}`}
      type="text"
      value={address.streetNumber}
      onChange={(e) => handleAddressChange(index, 'streetNumber', e.target.value)}
      className="mt-1 block w-full rounded border p-2"
      required
    />

    // Repeat pattern for all other fields
```

**Step 2: Fix PDFGenerator component**

```tsx
// Modify packages/webapp/src/components/PDFGenerator.tsx
// Add htmlFor and id to notes textarea

<label htmlFor="routeNotes" className="block text-sm font-medium">
  Notes (optional)
</label>
<textarea
  id="routeNotes"
  name="routeNotes"
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  className="mt-1 block w-full rounded border p-2"
  rows={3}
/>
```

**Step 3: Run accessibility audit**

1. Open webapp in Chrome
2. Open DevTools (F12)
3. Go to Lighthouse tab
4. Run accessibility audit

Expected: Fewer "Forms do not have associated labels" issues

**Step 4: Commit**

```bash
git add packages/webapp/src/components/AddressInput.tsx packages/webapp/src/components/PDFGenerator.tsx
git commit -m "fix: add proper labels and ids to form fields

Improves accessibility by adding htmlFor to labels and id/name to inputs.
Addresses browser accessibility audit findings."
```

---

## Verification Steps

After all tasks complete:

1. **Start all services:**
   ```bash
   cd packages/cloud-server && npm run dev &
   cd packages/webapp && npm run dev &
   cd packages/mobile-web && npm run dev &
   ```

2. **Test API endpoints:**
   ```bash
   curl http://localhost:3333/api/health | jq .
   curl http://localhost:3333/api/queue/status | jq .
   curl -X POST http://localhost:3333/api/queue/addresses -H "Content-Type: application/json" -d '{"addresses":[{"addressFull":"999 Fix St, Irvine, CA 92614","streetNumber":"999","streetName":"Fix St","zipCode":"92614"}]}' | jq .
   ```

3. **Test webapp in browser:**
   - Open http://localhost:5173/
   - Open http://localhost:5173/properties (should auto-load)
   - Check console for NO 404 errors

4. **Run security audit:**
   ```bash
   npm audit
   ```

5. **Run accessibility audit:**
   - Chrome DevTools > Lighthouse > Accessibility

**Success Criteria:**
- ✅ All API endpoints return 200
- ✅ Properties page auto-loads data
- ✅ Console has NO 404 errors
- ✅ npm audit shows 0 critical vulnerabilities
- ✅ Accessibility score improves
- ✅ All TypeScript compiles without errors

---

**Estimated Time:** 2-3 hours for all tasks
**Branch:** feature/comprehensive-testing (already created)
**Merge Target:** main
