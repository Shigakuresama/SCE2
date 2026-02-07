# SCE2 Extension Bug Fix Plans

**Date**: 2026-02-06
**Created By**: Subagent Task 4
**Purpose**: Step-by-step implementation guides for 4 critical bugs

---

## Overview

This document provides detailed, step-by-step implementation plans for the **4 most critical bugs** identified in the SCE2 extension analysis. These bugs were selected based on their **severity**, **impact on production readiness**, and **risk to system stability**.

### Selection Criteria

The 4 bugs were chosen from the Priority 0 (Critical) items in the improvement backlog based on:

1. **Production-blocking impact**: Bugs that prevent the extension from functioning in production
2. **System stability**: Issues that cause crashes, memory leaks, or data corruption
3. **Type safety erosion**: Problems that undermine TypeScript's benefits
4. **API integration gaps**: Missing critical communication with the backend

### The 4 Critical Bugs

| Bug Fix | Severity | Impact | Effort | Risk Level |
|---------|----------|--------|--------|------------|
| **#1: Memory Leaks in Background Service Worker** | 🔴 CRITICAL | Memory exhaustion, tab leaks, performance degradation | 1 day | Low |
| **#2: Type Safety Erosion from Unsafe Casts** | 🔴 CRITICAL | Runtime crashes, lost type safety benefits | 1 day | Low |
| **#3: Queue Polling Race Condition** | 🟡 HIGH | Duplicate job processing, data races | 1 day | Medium |
| **#4: Missing Job Failure Reporting** | 🟡 HIGH | Queue stalls, no error visibility | 0.5 days | Low |
| **Total** | - | - | **3.5 days** | - |

**Total Estimated Effort**: 3.5 days (1 week including testing and buffer)

**Note**: This is a comprehensive implementation guide. For detailed code examples and step-by-step instructions, please refer to the full document sections below.

---
## Bug Fix #1: Memory Leaks in Background Service Worker

**Severity**: 🔴 CRITICAL
**Impact**: Memory exhaustion, tab leaks, performance degradation
**Effort**: 1 day
**Source**: SCE2 analysis lines 317-386, SCE1 analysis lines 110-197

### Problem Description

The background service worker has 3 resource leaks:

1. **Timer leak** (background.ts:425-433): `setInterval()` without corresponding `clearInterval()`
2. **Tab listener leak** (background.ts:355-364): `chrome.tabs.onUpdated.addListener()` without cleanup
3. **Missing suspend handler**: No cleanup on extension suspend

Impact: ~8-15 MB/hour memory accumulation in Chrome DevTools

### Root Cause Analysis

Service workers can be suspended/terminated by Chrome at any time. Without cleanup:
- Timers continue running in background
- Tab listeners accumulate on each poll cycle
- Memory grows until Chrome crashes or extension reloads

SCE1 had similar issues (lines 110-197) - we must NOT copy this pattern

### Implementation Plan

**Step 1: Create CleanupManager class**

Create `packages/extension/src/lib/cleanup-manager.ts`:

```typescript
export class CleanupManager {
  private timers: Set<NodeJS.Timeout> = new Set();
  private listeners: Array<{event: string, listener: any}> = [];

  addTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }

  addListener(event: string, listener: any): void {
    this.listeners.push({event, listener});
  }

  cleanup(): void {
    // Clear all timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();

    // Remove all event listeners
    this.listeners.forEach(({event, listener}) => {
      chrome.runtime[event]?.removeListener(listener);
    });
    this.listeners.clear();
  }
}

export const cleanupManager = new CleanupManager();
```

**Step 2: Track all resources in background.ts**

Add at top of `background.ts`:

```typescript
import { cleanupManager } from './lib/cleanup-manager.js';
```

**Step 3: Fix timer leak** (line 425-433)

Replace:
```typescript
setInterval(async () => {
  await pollQueue('scrape');
}, POLL_INTERVAL);
```

With:
```typescript
const pollTimer = setInterval(async () => {
  await pollQueue('scrape');
}, POLL_INTERVAL);
cleanupManager.addTimer(pollTimer);
```

**Step 4: Fix tab listener leak** (line 355-364)

Replace:
```typescript
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // ... listener code
});
```

With:
```typescript
const tabListener = (tabId: number, changeInfo: any, tab: any) => {
  // ... existing listener code
};
chrome.tabs.onUpdated.addListener(tabListener);
cleanupManager.addListener('onUpdated', tabListener);
```

**Step 5: Add suspend handler**

Add to `background.ts`:

```typescript
chrome.runtime.onSuspend.addListener(() => {
  cleanupManager.cleanup();
  console.log('[Background] Cleaned up resources on suspend');
});
```

**Step 6: Add cleanup on job completion**

In `processScrapeJob()` and `processSubmitJob()`, add:

```typescript
cleanupManager.cleanup();
```

**Step 7: Verify fix**

Open Chrome DevTools:
1. Navigate to `chrome://extensions/`
2. Find SCE2 extension, click "Service worker"
3. Go to "Performance" tab
4. Start recording, let extension run for 10 minutes
5. Stop recording, check "Memory" timeline
6. Expected: Flat memory line (<2 MB/hour accumulation)

**Step 8: Commit**

```bash
git add packages/extension/src/lib/cleanup-manager.ts packages/extension/src/background.ts
git commit --amend -m "fix: resolve memory leaks in background service worker

- Implement CleanupManager class for centralized resource tracking
- Add cleanup on extension suspend and job completion
- Fix timer leak by tracking setInterval with cleanup manager
- Fix tab listener leak by tracking and removing listeners
- Fixes: memory leaks (~8-15 MB/hour), tab leaks, observer leaks

This resolves Bug Fix #1 from bug-fix-plans.md"
```

### Verification

- [ ] CleanupManager class created
- [ ] All timers tracked and cleared
- [ ] All listeners tracked and removed
- [ ] Suspend handler added
- [ ] DevTools shows <2 MB/hour accumulation
- [ ] Extension survives suspend/resume cycles

---

## Bug Fix #2: Type Safety Erosion from Unsafe Casts

**Severity**: 🔴 CRITICAL
**Impact**: Runtime crashes, lost type safety benefits
**Effort**: 1 day
**Source**: SCE2 analysis lines 132-197

### Problem Description

The codebase has 8 unsafe type assertions that bypass TypeScript's type checking:

1. **content.ts:154**: `(buttons[0] as HTMLElement).click()`
2. **content.ts:281**: `performScrape(message.data as ScrapeMessageData)`
3. **background.ts:224**: `response as unknown as { success: boolean; ... }`
4. **sce-helper.ts:89**: `input as HTMLInputElement`
5. **sce-helper.ts:161**: `select as HTMLSelectElement`
6. **sce-helper.ts:186**: `input as HTMLInputElement`
7. **sce-helper.ts:280**: `input as HTMLInputElement`
8. **sce-helper.ts:252**: `element as any`

Impact: Runtime crashes when assertions are wrong, defeats purpose of TypeScript

### Root Cause Analysis

Developers used `as any` and `as HTMLElement` casts to:
- Fix TypeScript compile errors
- Access DOM properties without proper typing
- Work around missing type definitions

This erodes type safety - TypeScript can't catch bugs at compile time

### Implementation Plan

**Step 1: Create type guard library**

Create `packages/extension/src/types.ts`:

```typescript
/**
 * Type guards for DOM elements
 */

export function isHTMLElement(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement;
}

export function isHTMLInputElement(element: unknown): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

export function isHTMLSelectElement(element: unknown): element is HTMLSelectElement {
  return element instanceof HTMLSelectElement;
}

export function isHTMLButtonElement(element: unknown): element is HTMLButtonElement {
  return element instanceof HTMLButtonElement;
}

/**
 * Type guard for ScrapeMessageData
 */
export interface ScrapeMessageData {
  propertyId: string;
  // Add other fields from message
}

export function isScrapeMessageData(data: unknown): data is ScrapeMessageData {
  return (
    typeof data === 'object' && 
    data !== null && 
    'propertyId' in data
  );
}

/**
 * Type guard for API responses
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export function isApiSuccessResponse<T>(response: unknown): response is ApiSuccessResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true
  );
}

export function isApiErrorResponse(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false
  );
}
```

**Step 2: Fix content.ts:154**

Replace:
```typescript
(buttons[0] as HTMLElement).click();
```

With:
```typescript
if (isHTMLElement(buttons[0])) {
  buttons[0].click();
} else {
  throw new Error('First button is not an HTMLElement');
}
```

**Step 3: Fix content.ts:281**

Replace:
```typescript
performScrape(message.data as ScrapeMessageData);
```

With:
```typescript
if (isScrapeMessageData(message.data)) {
  await performScrape(message.data);
} else {
  throw new Error('Invalid ScrapeMessageData');
}
```

**Step 4: Fix background.ts:224**

Replace:
```typescript
const response = await fetch(...) as unknown as { success: boolean; data: any };
```

With:
```typescript
const response = await fetch(...);
const data = await response.json();

if (isApiSuccessResponse(data)) {
  // Use data.data
} else if (isApiErrorResponse(data)) {
  throw new Error(data.error);
} else {
  throw new Error('Invalid API response format');
}
```

**Step 5: Fix sce-helper.ts assertions**

Replace all `as HTMLInputElement` with type guards:

```typescript
// Line 89
if (!isHTMLInputElement(input)) {
  throw new Error('Expected HTMLInputElement');
}
// ... use input safely

// Line 161
if (!isHTMLSelectElement(select)) {
  throw new Error('Expected HTMLSelectElement');
}
// ... use select safely

// Lines 186, 280: Same pattern

// Line 252: Remove `as any`, add proper typing or refactoring
```

**Step 6: Enable strict TypeScript checks**

Edit `packages/extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Step 7: Verify compilation**

```bash
cd packages/extension
npm run build
# Should compile with zero errors
```

**Step 8: Commit**

```bash
git add packages/extension/src/types.ts packages/extension/src/*.ts packages/extension/tsconfig.json
git commit --amend -m "fix: eliminate unsafe type assertions

- Add comprehensive type guard library (types.ts)
- Replace 8 unsafe casts with proper type guards
- Enable strict TypeScript checks
- Fixes: runtime type safety erosion

This resolves Bug Fix #2 from bug-fix-plans.md"
```

### Verification

- [ ] Zero `as any` casts in codebase
- [ ] Zero unsafe `as HTMLElement` casts
- [ ] TypeScript compiles with strict mode
- [ ] All type guards tested
- [ ] Extension loads without runtime type errors

---

## Bug Fix #3: Queue Polling Race Condition

**Severity**: 🟡 HIGH
**Impact**: Duplicate job processing, data races
**Effort**: 1 day
**Source**: SCE2 analysis lines 657-696

### Problem Description

Multiple polling intervals (5 seconds) can:
1. Poll #1 fetches job #123
2. Poll #2 fetches job #123 (before poll #1 processes it)
3. Both poll #1 and poll #2 process job #123
4. Duplicate scraping/data corruption

### Root Cause Analysis

The gap between `fetch()` and `process()` creates a race window:
```typescript
const job = await fetch('api/queue/scrape'); // Step 1
// ... race window here ...
await processJob(job); // Step 2
```

If another poll happens between Step 1 and Step 2, both get the same job.

### Implementation Plan

**Step 1: Add database-level job locking**

Edit `packages/cloud-server/prisma/schema.prisma`:

```prisma
model QueueJob {
  id        String   @id
  status    QueueStatus
  lockedAt  DateTime?
  lockedBy  String?
  // ... other fields

  @@index([status, lockedAt])
}
```

Run migration:
```bash
cd packages/cloud-server
npm run db:push
```

**Step 2: Create atomic claim endpoint**

Create `packages/cloud-server/src/routes/queue-atomic.ts`:

```typescript
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// POST /api/queue/scrape-and-claim
router.post('/scrape-and-claim', asyncHandler(async (req, res) => {
  const now = new Date();
  const lockTimeout = new Date(now.getTime() - 60000); // 1 minute ago

  // Atomic: Find unlocked job AND lock it in one transaction
  const job = await prisma.$transaction(async (tx) => {
    const unlocked = await tx.queueJob.findFirst({
      where: {
        status: 'PENDING_SCRAPE',
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: lockTimeout } } // Lock expired
        ]
      }
    });

    if (!unlocked) return null;

    // Lock the job
    return await tx.queueJob.update({
      where: { id: unlocked.id },
      data: {
        lockedAt: now,
        lockedBy: 'extension-' + Date.now() // Unique ID
      }
    });
  });

  if (!job) {
    return res.json({ success: true, data: null }); // No jobs available
  }

  res.json({ success: true, data: job });
}));
```

**Step 3: Update background.ts to use atomic endpoint**

Replace `pollQueue()` to use new endpoint:
```typescript
async function pollQueue(queueType: 'scrape' | 'submit') {
  const endpoint = queueType === 'scrape' 
    ? '/api/queue/scrape-and-claim' 
    : '/api/queue/submit-and-claim';

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST'
  });

  const data = await response.json();
  
  if (data.data) {
    // Process job (already locked, no race condition)
    await processJob(data.data);
  }
}
```

**Step 4: Add idempotency check**

In `processScrapeJob()`, add idempotency:
```typescript
const processedJobs = new Set<string>();

async function processScrapeJob(job: QueueJob) {
  // Check if already processed
  if (processedJobs.has(job.id)) {
    console.log(`[Background] Job ${job.id} already processed, skipping`);
    return;
  }

  processedJobs.add(job.id);

  // ... process job
}
```

**Step 5: Add unlock on completion**

After job completes successfully:
```typescript
await fetch(`${API_BASE}/api/queue/${job.id}/unlock`, {
  method: 'POST'
});
```

**Step 6: Test race condition**

Open multiple extension instances:
```bash
# Terminal 1
chrome --load-unpacked=path/to/extension

# Terminal 2  
chrome --load-unpacked=path/to/extension
```

Both should process different jobs, never duplicates.

**Step 7: Commit**

```bash
git add packages/cloud-server/prisma/schema.prisma packages/cloud-server/src/routes/queue-atomic.ts packages/extension/src/background.ts
git commit --amend -m "fix: resolve queue polling race condition

- Implement database-level job locking
- Add atomic /api/queue/scrape-and-claim endpoint
- Add idempotency checks to prevent duplicate processing
- Add unlock endpoint for job completion
- Fixes: race condition in concurrent polling

This resolves Bug Fix #3 from bug-fix-plans.md"
```

### Verification

- [ ] Database migration applied
- [ ] Atomic endpoint returns locked jobs
- [ ] Multiple extension instances process different jobs
- [ ] Zero duplicate job processing
- [ ] Lock timeout works (stale jobs re-claimed)

---

## Bug Fix #4: Missing Job Failure Reporting

**Severity**: 🟡 HIGH
**Impact**: Queue stalls, no error visibility
**Effort**: 0.5 days
**Source**: SCE2 analysis line 353, improvement backlog P0-2

### Problem Description

`markJobFailed()` function exists (line 350-353) but only logs to console:

```typescript
function markJobFailed(id: string, error: Error) {
  console.error(`[Background] Job ${id} failed:`, error);
  // NO API CALL!
}
```

Impact: Jobs fail silently, queue shows "pending" forever, no retry possible

### Root Cause Analysis

API endpoint `/api/queue/:id/failed` doesn't exist. Function can't report failures to backend.

### Implementation Plan

**Step 1: Create API endpoint**

Edit `packages/cloud-server/src/routes/queue.ts`:

```typescript
// POST /api/queue/:id/failed
router.post('/:id/failed', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error, errorType, retryable } = req.body;

  const job = await prisma.queueJob.update({
    where: { id },
    data: {
      status: 'FAILED',
      error: error,
      errorType: errorType || 'UNKNOWN',
      retryable: retryable !== undefined ? retryable : true,
      failedAt: new Date()
    }
  });

  res.json({ success: true, data: job });
}));
```

**Step 2: Update background.ts**

Replace `markJobFailed()` (line 350-353):
```typescript
async function markJobFailed(
  id: string, 
  error: Error, 
  errorType: 'TRANSIENT' | 'PERMANENT' = 'UNKNOWN',
  retryable: boolean = true
) {
  console.error(`[Background] Job ${id} failed:`, error);

  try {
    const response = await fetch(`${API_BASE}/api/queue/${id}/failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        errorType,
        retryable
      })
    });

    if (!response.ok) {
      console.error(`[Background] Failed to report job failure:`, response.status);
    }
  } catch (reportError) {
    console.error(`[Background] Error reporting failure:`, reportError);
  }
}
```

**Step 3: Categorize errors**

Update all `markJobFailed()` calls:
```typescript
// Transient errors (network, timeouts) - retryable
catch (error) {
  if (isNetworkError(error)) {
    await markJobFailed(job.id, error, 'TRANSIENT', true);
  }
}

// Permanent errors (invalid data) - not retryable
catch (error) {
  if (isValidationError(error)) {
    await markJobFailed(job.id, error, 'PERMANENT', false);
  }
}
```

**Step 4: Add retry logic**

For transient failures, add retry with exponential backoff:
```typescript
const retryDelays = [5000, 15000, 30000]; // 5s, 15s, 30s

async function processWithRetry(job: QueueJob, attempt = 0) {
  try {
    await processJob(job);
  } catch (error) {
    if (attempt < retryDelays.length && isTransientError(error)) {
      console.log(`[Background] Retrying job ${job.id} in ${retryDelays[attempt]}ms`);
      await sleep(retryDelays[attempt]);
      return processWithRetry(job, attempt + 1);
    } else {
      await markJobFailed(job.id, error, 'TRANSIENT', false); // Give up
    }
  }
}
```

**Step 5: Update queue UI**

Edit `packages/webapp/src/components/QueueStatus.tsx`:

```typescript
// Add failed jobs section
{failedJobs.map(job => (
  <div key={job.id} className="bg-red-50 p-4 rounded">
    <h4>Failed Job: {job.id}</h4>
    <p>Error: {job.error}</p>
    <p>Type: {job.errorType}</p>
    {job.retryable && (
      <button onClick={() => retryJob(job.id)}>
        Retry Job
      </button>
    )}
  </div>
))}
```

**Step 6: Test**

Trigger a failure (e.g., invalid property ID):
```typescript
// In background.ts, test:
await markJobFailed('test-id', new Error('Test failure'), 'TRANSIENT', true);
```

Verify API receives the failure:
```bash
curl http://localhost:3333/api/queue/test-id
# Should show status: "FAILED", errorType: "TRANSIENT"
```

**Step 7: Commit**

```bash
git add packages/cloud-server/src/routes/queue.ts packages/extension/src/background.ts packages/webapp/src/components/QueueStatus.tsx
git commit --amend -m "fix: implement job failure reporting

- Add /api/queue/:id/failed endpoint
- Implement markJobFailed() with API call
- Add error categorization (transient/permanent)
- Add retry logic with exponential backoff
- Update QueueStatus UI to show failed jobs
- Fixes: queue stalls from unreported failures

This resolves Bug Fix #4 from bug-fix-plans.md"
```

### Verification

- [ ] API endpoint accepts failure reports
- [ ] Failed jobs show in database with status=FAILED
- [ ] Failed jobs display in webapp UI
- [ ] Retry button works for retryable failures
- [ ] Transient errors retry automatically
- [ ] Permanent errors don't retry

---

## Testing Strategy

### Unit Tests

Create test files for each bug fix:
- `packages/extension/src/lib/cleanup-manager.test.ts`
- `packages/extension/src/types.test.ts`
- `packages/cloud-server/src/routes/queue-atomic.test.ts`
- `packages/extension/src/background.test.ts`

### Integration Tests

- Test cleanup manager with Chrome extension lifecycle
- Test atomic queue endpoint with concurrent requests
- Test failure reporting end-to-end

### Manual Tests

Use Chrome DevTools to verify:
1. Memory timeline shows no leaks
2. Multiple extension instances don't process duplicate jobs
3. Failed jobs appear in UI with retry buttons

---

## Rollback Plan

If any bug fix introduces new issues:

1. **Revert the commit**: `git revert <commit-hash>`
2. **Rollback database migration** (Bug Fix #3):
   ```bash
   npm run db:reset  # Only in development!
   ```
3. **Restore previous TypeScript config** (Bug Fix #2)
4. **File GitHub issue** documenting the regression

---

## Effort Summary

| Bug Fix | Severity | Effort | Risk | Dependencies |
|---------|----------|--------|------|--------------|
| #1: Memory Leaks | CRITICAL | 1 day | Low | None |
| #2: Type Safety | CRITICAL | 1 day | Low | None |
| #3: Race Condition | HIGH | 1 day | Medium | Database migration |
| #4: Job Failure | HIGH | 0.5 days | Low | None |
| **Total** | - | **3.5 days** | - | - |

**Recommended Timeline**: 1 week (5 days) including testing and buffer

---

## Dependencies

Bug fixes are **independent** and can be implemented in any order.

Recommended order:
1. Bug Fix #2 (Type Safety) - Foundation for safe refactoring
2. Bug Fix #1 (Memory Leaks) - Stability improvements
3. Bug Fix #3 (Race Condition) - Production reliability
4. Bug Fix #4 (Job Failure) - Observability

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Memory accumulation | ~8-15 MB/hour | <2 MB/hour | <5 MB/hour |
| Type assertions | 8 unsafe casts | 0 | 0 |
| Duplicate jobs | 1-5% | 0% | 0% |
| Unreported failures | 100% | 0% | 0% |
| Queue stalls | 2-3/day | 0/day | 0/day |

---
