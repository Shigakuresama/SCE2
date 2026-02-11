# Mobile Route + PDF From Deployments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let an operator on a deployed phone/browser create an optimized route and generate a fillable QR PDF without requiring the Chrome extension.

**Architecture:** Add a cloud-server mobile route-planning API that returns canonical ordered properties and persists that order on the route. Build a mobile-first webapp page that uses this endpoint, then generates the existing fillable PDF from the ordered list. Keep extension-only behavior (SCE extraction/submission automation) explicitly out of this flow.

**Tech Stack:** Express + Prisma + Vitest (cloud-server), React + Vite + TypeScript (webapp/mobile-web), jsPDF + qrcode (existing webapp PDF path)

---

## Scope and Guardrails

- In scope:
  - Mobile/deployed route planning and PDF generation.
  - Persisted property order for each planned route.
  - Mobile UX entry points.
- Out of scope:
  - SCE extraction (still extension-only).
  - SCE final submission automation (still extension-only).
  - New backend PDF rendering stack (reuse existing client PDF generation).
- Required skills during execution:
  - `@superpowers/test-driven-development`
  - `@superpowers/verification-before-completion`
  - `@superpowers/requesting-code-review`

---

### Task 1: Add Failing Contract Test For Mobile Route Plan API

**Files:**
- Create: `packages/cloud-server/tests/mobile-route-plan.contract.test.ts`
- Test: `packages/cloud-server/tests/mobile-route-plan.contract.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// setup temp sqlite + prisma db push (same pattern as other contract tests)

it('creates a mobile route plan and returns ordered properties', async () => {
  const app = await buildTestApp();
  const p1 = await request(app).post('/api/properties').send({ addressFull: '1 A St, Santa Ana, CA 92701' });
  const p2 = await request(app).post('/api/properties').send({ addressFull: '2 B St, Santa Ana, CA 92701' });

  const res = await request(app).post('/api/routes/mobile-plan').send({
    name: 'Field Route AM',
    propertyIds: [p1.body.data.id, p2.body.data.id],
  });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data.orderedPropertyIds.length).toBe(2);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts`  
Expected: FAIL with `404` on `/api/routes/mobile-plan`

**Step 3: Write minimal implementation**

Modify `packages/cloud-server/src/routes/routes.ts` with a temporary stub:

```ts
routeRoutes.post('/mobile-plan', asyncHandler(async (req, res) => {
  const { name, propertyIds } = req.body;
  if (!name || !Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new ValidationError('name and propertyIds are required');
  }
  res.status(201).json({
    success: true,
    data: { routeId: 0, orderedPropertyIds: propertyIds, properties: [] },
  });
}));
```

**Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts`  
Expected: PASS (temporary behavior)

**Step 5: Commit**

```bash
git add packages/cloud-server/tests/mobile-route-plan.contract.test.ts packages/cloud-server/src/routes/routes.ts
git commit -m "test(cloud-server): add mobile route plan contract scaffold"
```

---

### Task 2: Add Route Planner Utility With Deterministic Tests

**Files:**
- Create: `packages/cloud-server/src/lib/route-planner.ts`
- Create: `packages/cloud-server/tests/route-planner.unit.test.ts`
- Test: `packages/cloud-server/tests/route-planner.unit.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { optimizePropertyOrder } from '../src/lib/route-planner.js';

it('orders by nearest-neighbor from provided start coordinate', () => {
  const ordered = optimizePropertyOrder(
    [
      { id: 10, latitude: 33.75, longitude: -117.86 },
      { id: 11, latitude: 33.76, longitude: -117.85 },
      { id: 12, latitude: 33.73, longitude: -117.88 },
    ],
    { latitude: 33.74, longitude: -117.87 }
  );

  expect(ordered.map((p) => p.id)).toEqual([10, 11, 12]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/cloud-server -- tests/route-planner.unit.test.ts`  
Expected: FAIL with module/function not found

**Step 3: Write minimal implementation**

```ts
export function optimizePropertyOrder(properties, start) {
  // nearest-neighbor implementation
  // must keep input immutable
  return ordered;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/cloud-server -- tests/route-planner.unit.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cloud-server/src/lib/route-planner.ts packages/cloud-server/tests/route-planner.unit.test.ts
git commit -m "feat(cloud-server): add deterministic route planner utility"
```

---

### Task 3: Persist Route Order In Prisma

**Files:**
- Modify: `packages/cloud-server/prisma/schema.prisma`
- Create: `packages/cloud-server/prisma/migrations/<timestamp>_add_route_order_json/migration.sql`
- Modify: `packages/cloud-server/tests/mobile-route-plan.contract.test.ts`
- Test: `packages/cloud-server/tests/mobile-route-plan.contract.test.ts`

**Step 1: Write the failing test update**

Extend the contract test:

```ts
expect(res.body.data.route.orderedPropertyIdsJson).toBeTruthy();
expect(JSON.parse(res.body.data.route.orderedPropertyIdsJson)).toEqual(
  res.body.data.orderedPropertyIds
);
```

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts`  
Expected: FAIL with missing `orderedPropertyIdsJson`

**Step 3: Write minimal implementation**

In `packages/cloud-server/prisma/schema.prisma`:

```prisma
model Route {
  id                   Int      @id @default(autoincrement())
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  name                 String
  description          String?
  orderedPropertyIdsJson String?
  properties           Property[]
}
```

Create migration SQL via Prisma migrate dev.

**Step 4: Run test to verify it passes**

Run:
- `cd packages/cloud-server && npx prisma migrate dev --name add_route_order_json`
- `npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cloud-server/prisma/schema.prisma packages/cloud-server/prisma/migrations packages/cloud-server/tests/mobile-route-plan.contract.test.ts
git commit -m "feat(cloud-server): persist ordered property ids on route"
```

---

### Task 4: Replace Stub With Real `/api/routes/mobile-plan` Endpoint

**Files:**
- Modify: `packages/cloud-server/src/routes/routes.ts`
- Modify: `packages/cloud-server/tests/mobile-route-plan.contract.test.ts`
- Test: `packages/cloud-server/tests/mobile-route-plan.contract.test.ts`

**Step 1: Write failing behavior tests**

Add/expand tests to assert:
- Reject empty `propertyIds` with `400`.
- Returns `orderedPropertyIds` from optimizer (not input order).
- Creates route connected to all provided properties.
- Persists `orderedPropertyIdsJson`.

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts`  
Expected: FAIL on validation and/or ordering assertions

**Step 3: Write minimal implementation**

```ts
routeRoutes.post('/mobile-plan', asyncHandler(async (req, res) => {
  const { name, propertyIds, startLat, startLon, description } = req.body;
  // validate
  // fetch properties
  // optimize with optimizePropertyOrder()
  // create route with connect
  // store orderedPropertyIdsJson
  // return route + ordered list + ordered properties
}));
```

**Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cloud-server/src/routes/routes.ts packages/cloud-server/tests/mobile-route-plan.contract.test.ts
git commit -m "feat(cloud-server): implement mobile route planning endpoint"
```

---

### Task 5: Add Webapp API + Types For Mobile Route Plan

**Files:**
- Modify: `packages/webapp/src/types.ts`
- Modify: `packages/webapp/src/lib/api.ts`
- Create: `packages/webapp/tests/mobile-route-plan.integration.ts`
- Test: `packages/webapp/tests/mobile-route-plan.integration.ts`

**Step 1: Write the failing integration test**

```ts
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const apiSource = readFileSync(path.join(process.cwd(), 'packages/webapp/src/lib/api.ts'), 'utf8');
const typesSource = readFileSync(path.join(process.cwd(), 'packages/webapp/src/types.ts'), 'utf8');

assert.match(typesSource, /export interface MobileRoutePlanRequest/);
assert.match(typesSource, /export interface MobileRoutePlanResponse/);
assert.match(apiSource, /async createMobileRoutePlan\(/);
assert.match(apiSource, /\/routes\/mobile-plan/);
```

**Step 2: Run test to verify it fails**

Run: `npx tsx packages/webapp/tests/mobile-route-plan.integration.ts`  
Expected: FAIL with missing API/type definitions

**Step 3: Write minimal implementation**

Add DTOs in `types.ts` and client method in `api.ts`:

```ts
async createMobileRoutePlan(payload: MobileRoutePlanRequest): Promise<MobileRoutePlanResponse> {
  return this.request<MobileRoutePlanResponse>('/routes/mobile-plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

**Step 4: Run test to verify it passes**

Run:
- `npx tsx packages/webapp/tests/mobile-route-plan.integration.ts`
- `npm run build --workspace=packages/webapp`  
Expected: PASS + successful build

**Step 5: Commit**

```bash
git add packages/webapp/src/types.ts packages/webapp/src/lib/api.ts packages/webapp/tests/mobile-route-plan.integration.ts
git commit -m "feat(webapp): add mobile route plan API client and contracts"
```

---

### Task 6: Build Mobile-First Route + PDF Page In Webapp

**Files:**
- Create: `packages/webapp/src/pages/MobileRoutePack.tsx`
- Modify: `packages/webapp/src/App.tsx`
- Modify: `packages/webapp/src/components/Navigation.tsx`
- Modify: `packages/webapp/src/lib/config.ts`
- Test: `packages/webapp/tests/mobile-route-plan.integration.ts`

**Step 1: Write failing assertions**

Extend `mobile-route-plan.integration.ts`:

```ts
const appSource = readFileSync(path.join(webappRoot, 'src/App.tsx'), 'utf8');
const navSource = readFileSync(path.join(webappRoot, 'src/components/Navigation.tsx'), 'utf8');
const pageSource = readFileSync(path.join(webappRoot, 'src/pages/MobileRoutePack.tsx'), 'utf8');

assert.match(appSource, /path="\/mobile-pack"/);
assert.match(navSource, /path: '\/mobile-pack'/);
assert.match(pageSource, /createMobileRoutePlan/);
assert.match(pageSource, /generateRouteSheet/);
```

**Step 2: Run test to verify it fails**

Run: `npx tsx packages/webapp/tests/mobile-route-plan.integration.ts`  
Expected: FAIL (page/route/nav missing)

**Step 3: Write minimal implementation**

Implement `MobileRoutePack.tsx` with:
- Large touch targets for property selection.
- Optional start coordinate inputs.
- “Plan Route” button calling `api.createMobileRoutePlan`.
- “Generate PDF” button calling `generateRouteSheet(orderedProperties)`.
- Warning banner: “SCE extraction requires extension (desktop).”

Also fix QR fallback in `packages/webapp/src/lib/config.ts`:

```ts
MOBILE_BASE_URL:
  import.meta.env.VITE_MOBILE_BASE_URL ||
  (import.meta.env.MODE === 'production'
    ? 'https://sce2-mobile.onrender.com'
    : 'http://localhost:5174'),
```

**Step 4: Run test to verify it passes**

Run:
- `npx tsx packages/webapp/tests/mobile-route-plan.integration.ts`
- `npm run build --workspace=packages/webapp`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/webapp/src/pages/MobileRoutePack.tsx packages/webapp/src/App.tsx packages/webapp/src/components/Navigation.tsx packages/webapp/src/lib/config.ts packages/webapp/tests/mobile-route-plan.integration.ts
git commit -m "feat(webapp): add mobile-first route pack page and QR-safe config"
```

---

### Task 7: Add Mobile-Web Shortcut To Route Pack Builder

**Files:**
- Modify: `packages/mobile-web/src/lib/config.ts`
- Modify: `packages/mobile-web/src/App.tsx`
- Create: `packages/mobile-web/src/components/__tests__/RoutePackShortcut.test.tsx`
- Test: `packages/mobile-web/src/components/__tests__/RoutePackShortcut.test.tsx`

**Step 1: Write the failing test**

```ts
import { render, screen } from '@testing-library/react';
import App from '../../App';

it('shows route pack shortcut when scanner is visible', () => {
  render(<App />);
  expect(
    screen.getByRole('link', { name: /create route pdf/i })
  ).toHaveAttribute('href');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/mobile-web -- src/components/__tests__/RoutePackShortcut.test.tsx`  
Expected: FAIL (shortcut missing)

**Step 3: Write minimal implementation**

- Add `WEBAPP_BASE_URL` in `mobile-web` config from `VITE_WEBAPP_BASE_URL`.
- In scanner screen, add CTA link:

```tsx
<a href={`${config.WEBAPP_BASE_URL}/mobile-pack`} target="_blank" rel="noreferrer">
  Create Route PDF
</a>
```

**Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/mobile-web -- src/components/__tests__/RoutePackShortcut.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/mobile-web/src/lib/config.ts packages/mobile-web/src/App.tsx packages/mobile-web/src/components/__tests__/RoutePackShortcut.test.tsx
git commit -m "feat(mobile-web): add shortcut to mobile route pack builder"
```

---

### Task 8: Docs + Verification + Deploy Validation

**Files:**
- Modify: `docs/RUNBOOK.md`
- Modify: `README.md`
- Create: `docs/TEST_REPORT_2026-02-11_MOBILE_ROUTE_PACK.md`

**Step 1: Write failing documentation checks (manual checklist)**

Document checklist items that currently fail:
- Route/PDF-from-phone path is not documented.
- Extension-only boundaries are not explicit.
- QR fallback/mobile URL behavior is not documented.

**Step 2: Run verification commands before docs update**

Run:
- `npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts`
- `npm run test --workspace=packages/mobile-web`
- `npm run build --workspace=packages/webapp`  
Expected: All PASS

**Step 3: Write minimal docs implementation**

Update docs with explicit operator flow:
1. Open deployed webapp `/mobile-pack` on phone.
2. Select properties and create route plan.
3. Generate PDF with QR codes.
4. Use deployed mobile-web for field uploads.
5. Use extension later for SCE submission automation (desktop).

**Step 4: Re-run full verification**

Run:
- `npm run test --workspace=packages/cloud-server`
- `npm run test --workspace=packages/mobile-web`
- `npm run build --workspace=packages/webapp`
- `curl -sS https://sce2-cloud-server.onrender.com/api/health`  
Expected: All PASS + health success JSON

**Step 5: Commit**

```bash
git add docs/RUNBOOK.md README.md docs/TEST_REPORT_2026-02-11_MOBILE_ROUTE_PACK.md
git commit -m "docs(workflow): document deployed mobile route and PDF path"
```

---

## Final Verification Gate

Run in order:

```bash
npm run test --workspace=packages/cloud-server -- tests/mobile-route-plan.contract.test.ts tests/submit-requeue.contract.test.ts
npm run test --workspace=packages/mobile-web
npm run build --workspace=packages/webapp
npm run build --workspace=packages/cloud-server
```

Expected:
- All tests pass.
- Both builds pass.
- No TypeScript errors.

---

## Rollback Plan

- If API endpoint is unstable: revert commits from Tasks 3-4 only.
- If webapp mobile page causes regressions: hide `/mobile-pack` route behind feature flag.
- If mobile shortcut confuses operators: remove Task 7 commit without impacting backend API.

---

## Notes For Execution Session

- Execute in dedicated feature worktree.
- Keep each task as one PR-sized commit.
- Do not mix docs-only and code-only commits.
- Request code review after Task 6 and before final merge.

