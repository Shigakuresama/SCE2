# Route Processing Pipeline Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 issues in the route processing pipeline: eliminate redundant captureDelay/captureRouteData round-trip, enable real-time progress from extension to webapp via `externally_connectable`, and remove the duplicate `GEMINI.md` file.

**Architecture:** The route processor opens SCE tabs via background script, fills addresses via content script, and extracts customer data. Currently `fillRouteAddress` already returns the extracted data but the caller ignores it and re-requests it after a 5s sleep. We fix this by using the data from the first response directly. For progress updates, we add `externally_connectable` to `manifest.json` so the webapp at `localhost:5173` can receive `chrome.runtime.onMessage` broadcasts.

**Tech Stack:** Chrome MV3 Extension (TypeScript), React webapp (TypeScript/Vite)

---

### Task 1: Eliminate Redundant captureDelay and captureRouteData Round-Trip

The `route-processor.ts` sends `fillRouteAddress` which already waits smartly (MutationObserver) and returns `{customerName, customerPhone}`. Then it sleeps 5 seconds and sends a second `captureRouteData` message to re-read the same data. We use the first response directly.

**Files:**
- Modify: `packages/extension/src/lib/route-processor.ts:79-101`

**Step 1: Replace the fill-then-capture two-step with single fill that uses its response**

In `packages/extension/src/lib/route-processor.ts`, replace the section from "Send fill command" through "Data captured" (lines 69-101) with code that uses `fillResult.data` directly:

```typescript
      // 3. Send fill command to content script (this fills, waits, and extracts in one step)
      const fillMessage = {
        action: 'fillRouteAddress',
        address: {
          streetNumber: address.number,
          streetName: address.street,
          zipCode: address.zip
        }
      };

      console.log('[Route] Sending fill command...');
      const fillResult = await sendToContentScript(tabId, fillMessage, 30000);

      if (!fillResult || !fillResult.success) {
        throw new Error(fillResult?.error || 'Failed to fill form');
      }

      console.log('[Route] ✓ Data extracted:', fillResult.data);
```

This replaces lines 69-101 (the old fill + sleep(captureDelay) + captureRouteData sequence).

Then update the result construction at lines 120-127 to use `fillResult.data` instead of `captureResult.data`:

```typescript
      const result: RouteProcessResult = {
        success: true,
        address: address.full,
        customerName: fillResult.data?.customerName,
        customerPhone: fillResult.data?.customerPhone,
        screenshot: screenshotDataUrl,
        timestamp: new Date().toISOString()
      };
```

**Step 2: Build extension and verify no TypeScript errors**

Run: `cd packages/extension && npm run build`
Expected: Clean compilation, no errors.

**Step 3: Commit**

```bash
git add packages/extension/src/lib/route-processor.ts
git commit -m "perf(route): use fillRouteAddress response directly, remove redundant captureDelay+captureRouteData

fillRouteAddress already waits smartly (MutationObserver) and extracts customer data.
The 5s captureDelay sleep + second captureRouteData message was redundant."
```

---

### Task 2: Enable Real-Time Progress Updates to Webapp

The webapp at `localhost:5173` uses `chrome.runtime.onMessage.addListener` to listen for `ROUTE_PROGRESS` updates, but this only works for extension contexts (popup, options). For a regular webpage to receive messages, the extension must declare `externally_connectable` in manifest.json AND the webapp must use `chrome.runtime.connect()` or `chrome.runtime.sendMessage(EXTENSION_ID, ...)`.

However, the simpler approach: since the webapp already gets the final result from the initial `sendMessage` response, we just need progress polling. We'll add a polling approach using `GET_ROUTE_STATUS` which already exists in the background handler.

**Files:**
- Modify: `packages/webapp/src/components/RouteProcessor.tsx:32-96` (handleProcess function)
- Modify: `packages/webapp/src/components/RouteProcessor.tsx:98-123` (useEffect)
- Modify: `packages/extension/manifest.json` (add externally_connectable)

**Step 1: Add `externally_connectable` to manifest.json**

Add after the `"action"` block (after line 36 in manifest.json):

```json
  "externally_connectable": {
    "matches": [
      "http://localhost:5173/*",
      "http://localhost:5174/*"
    ]
  },
```

This allows the webapp (5173) and mobile-web (5174) to use `chrome.runtime.sendMessage(extensionId, ...)`.

**Step 2: Update RouteProcessor.tsx to poll for progress**

Replace the `handleProcess` function and `useEffect` with a polling-based approach. The webapp sends `PROCESS_ROUTE_BATCH`, then polls `GET_ROUTE_STATUS` every 2 seconds until complete:

```tsx
  // Store extension ID (detected on first successful message)
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect extension ID from externally_connectable
  useEffect(() => {
    // Try known extension ID patterns or detect via message
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      setExtensionId(chrome.runtime.id);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleProcess = async () => {
    if (propertiesToProcess.length === 0) {
      alert('No properties to process');
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.runtime) {
      alert('Route processing requires the Chrome Extension to be installed.');
      return;
    }

    try {
      setProcessing(true);
      setProgress({
        current: 0,
        total: propertiesToProcess.length,
        percent: 0,
        message: 'Starting...'
      });

      const addresses = propertiesToProcess.map(prop => {
        const parts = prop.addressFull?.split(',') || [];
        const streetPart = parts[0]?.trim() || '';
        const zipPart = parts[parts.length - 1]?.trim() || prop.zipCode || '';
        const streetParts = streetPart.split(/\s+/);
        const number = streetParts[0] || '';
        const street = streetParts.slice(1).join(' ');

        return {
          number,
          street,
          city: parts[1]?.trim() || '',
          state: 'CA',
          zip: zipPart,
          full: prop.addressFull || ''
        };
      });

      // Start batch processing (fire and forget the long-running operation)
      const responsePromise = chrome.runtime.sendMessage({
        action: 'PROCESS_ROUTE_BATCH',
        addresses,
        config: { maxConcurrentTabs: 3 }
      });

      // Poll for progress while batch runs
      pollingRef.current = setInterval(async () => {
        try {
          const status = await chrome.runtime.sendMessage({
            action: 'GET_ROUTE_STATUS'
          });
          if (status?.success && status.data) {
            const { processedCount, totalCount, successfulCount, failedCount, isProcessing } = status.data;
            const percent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;
            setProgress({
              current: processedCount,
              total: totalCount,
              percent,
              message: isProcessing
                ? `Processing ${processedCount}/${totalCount}...`
                : `Complete: ${successfulCount} successful, ${failedCount} failed`
            });

            if (!isProcessing && processedCount > 0) {
              stopPolling();
            }
          }
        } catch {
          // Extension may be busy, skip this poll
        }
      }, 2000);

      // Wait for the final response
      const response = await responsePromise;
      stopPolling();

      if (response && response.success) {
        setResults(response.data.results);
        setProgress({
          current: response.data.results.length,
          total: response.data.results.length,
          percent: 100,
          message: `Complete: ${response.data.results.filter((r: any) => r.success).length} successful`
        });
        onProcessingComplete(response.data.results);
        onPropertiesUpdated();
      } else {
        throw new Error(response?.error || 'Processing failed');
      }

    } catch (error) {
      stopPolling();
      console.error('Processing failed:', error);
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };
```

Also add the necessary imports at the top of the file:

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
```

And remove the old `useEffect` for `chrome.runtime.onMessage` (lines 98-123) since we no longer rely on it — polling handles progress.

**Step 3: Build webapp and verify**

Run: `cd packages/webapp && npm run build`
Expected: Clean compilation.

**Step 4: Build extension and verify**

Run: `cd packages/extension && npm run build`
Expected: Clean compilation.

**Step 5: Commit**

```bash
git add packages/extension/manifest.json packages/webapp/src/components/RouteProcessor.tsx
git commit -m "feat(route): add real-time progress polling to RouteProcessor

Replace chrome.runtime.onMessage listener (which only works in extension contexts)
with polling via GET_ROUTE_STATUS every 2s. Add externally_connectable to manifest
for future direct messaging from webapp."
```

---

### Task 3: Remove Redundant GEMINI.md

`GEMINI.md` at the project root is 86 lines of duplicated project overview. `CLAUDE.md` is the authoritative guide (700+ lines). Remove the duplicate.

**Files:**
- Delete: `GEMINI.md`

**Step 1: Delete the file**

```bash
rm GEMINI.md
```

**Step 2: Commit**

```bash
git add GEMINI.md
git commit -m "chore: remove redundant GEMINI.md (CLAUDE.md is authoritative)"
```

---

### Task 4: Verify End-to-End Pipeline (Manual Test)

This is a manual verification step — not code changes.

**Step 1: Start cloud server**

Run: `cd packages/cloud-server && npm run dev`
Expected: Server starts on `:3333`.

**Step 2: Start webapp**

Run: `cd packages/webapp && npm run dev`
Expected: Vite dev server on `:5173`.

**Step 3: Load extension**

1. Run: `cd packages/extension && npm run build`
2. Open `chrome://extensions/`
3. Reload the unpacked extension from `packages/extension/dist/`

**Step 4: Test route extraction**

1. Open webapp at `http://localhost:5173`
2. Select 2-3 test addresses
3. Click "Extract Customer Data"
4. Verify:
   - Progress bar updates every 2 seconds
   - SCE tabs open, fill, and close automatically
   - Results show extracted customer names/phones
   - Database updated (check Prisma Studio: `cd packages/cloud-server && npm run db:studio`)

**Step 5: Test PDF generation**

1. After extraction, click "Generate Route PDF"
2. Verify PDF contains real customer names and QR codes
