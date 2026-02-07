# Manual Testing Guide for Storage Utilities

## Overview
This guide provides step-by-step instructions for testing the new generic storage utilities in the SCE2 extension.

## Build Extension
```bash
cd packages/extension
npm run build
```

## Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Navigate to and select `/home/sergio/Projects/SCE2/packages/extension/dist/`
5. Verify "SCE2 Extension" appears in the list

## Test 1: Popup Configuration (Load and Save)

### Setup
1. Open Chrome DevTools (F12)
2. Navigate to Application tab → Storage → Synced Storage
3. Keep this panel open to monitor changes

### Test Steps
1. Click the extension icon to open the popup
2. **Verify initial values load correctly:**
   - API URL: `http://localhost:3333`
   - Poll Interval: `5000`
   - Status should show "Inactive"

3. **Test saving configuration:**
   - Change API URL to `http://localhost:3000`
   - Change Poll Interval to `10000`
   - Click "Save" button
   - Verify button text changes to "Saved!" briefly

4. **Verify in DevTools (Synced Storage):**
   - Check that `apiBaseUrl` = `http://localhost:3000`
   - Check that `pollInterval` = `10000`
   - Check that `autoProcess` = `false`

5. **Test persistence (close and reopen):**
   - Close the popup (click outside)
  . Wait 2 seconds
   - Reopen the popup
   - **Verify:** API URL should still be `http://localhost:3000`
   - **Verify:** Poll Interval should still be `10000`

6. **Test toggle processing:**
   - Click "Start Processing" button
   - **Verify in DevTools:** `autoProcess` changes to `true`
   - **Verify in popup:** Status changes to "Processing"
   - **Verify in popup:** Button text changes to "Stop Processing"

7. **Test stop processing:**
   - Click "Stop Processing" button
   - **Verify in DevTools:** `autoProcess` changes to `false`
   - **Verify in popup:** Status changes to "Inactive"

## Test 2: Options Page Configuration (Load and Save)

### Test Steps
1. Right-click extension icon → "Options"
   - OR go to `chrome://extensions/` → "Details" → "Extension options"

2. **Verify initial values load correctly:**
   - API URL: `http://localhost:3000` (from Test 1)
   - Poll Interval: `10000` (from Test 1)
   - Timeout: `30000`
   - Max Concurrent: `3`
   - Auto Start: `false`
   - Debug Mode: `false` (unchecked)

3. **Test saving configuration:**
   - Change API URL to `http://localhost:4000`
   - Change Poll Interval to `2000`
   - Change Timeout to `60000`
   - Change Max Concurrent to `5`
   - Change Auto Start to `true`
   - Check Debug Mode
   - Click "Save" button

4. **Verify in DevTools (Synced Storage):**
   - Check all values are updated correctly
   - **Expected:**
     - `apiBaseUrl`: `http://localhost:4000`
     - `pollInterval`: `2000`
     - `timeout`: `60000`
     - `maxConcurrent`: `5`
     - `autoStart`: `true`
     - `debugMode`: `true`

5. **Test persistence:**
   - Refresh the options page (F5)
   - **Verify:** All values are preserved

6. **Test validation:**
   - Clear API URL field
   - Click "Save"
   - **Verify:** Error message "API Base URL is required" appears
   - **Verify:** No changes in DevTools

   - Set Poll Interval to `500` (below minimum)
   - Click "Save"
   - **Verify:** Error message "Poll interval must be between 1000 and 60000" appears

## Test 3: Background Configuration (Auto-start)

### Test Steps
1. Close all Chrome windows to restart background script
   - Or: Go to `chrome://extensions/` → Click "Reload" on SCE2 Extension

2. **Verify auto-start worked:**
   - Open popup
   - **Verify:** Status shows "Processing" (because `autoStart` = `true` from Test 2)
   - **Note:** Background should have automatically started polling

3. **Check background console:**
   - Go to `chrome://extensions/`
   - Find "SCE2 Extension"
   - Click "Service worker" link (opens DevTools for background)
   - Look for console logs:
     - `[SCE2] Starting polling with 2000ms interval`
     - `[SCE2] SCE2 Extension installed`

## Test 4: Shared Storage State

### Purpose: Verify all contexts see the same data

1. **Open all contexts simultaneously:**
   - Popup (click extension icon)
   - Options page (right-click → Options)
   - Background console (chrome://extensions/ → Service worker)

2. **Change value in popup:**
   - In popup: Change API URL to `http://shared-test.com`
   - Click "Save"

3. **Verify in DevTools (Synced Storage):**
   - `apiBaseUrl` = `http://shared-test.com`

4. **Refresh options page (F5)**
   - **Verify:** API URL field shows `http://shared-test.com`

5. **Reload background service worker:**
   - Go to `chrome://extensions/`
   - Click "Reload" on SCE2 Extension
   - Check background console logs
   - **Verify:** New polling uses `http://shared-test.com`

## Test 5: Default Values (Fresh Install)

### Purpose: Test default values work correctly

1. **Clear all storage:**
   - Open DevTools → Application → Storage → Synced Storage
   - Right-click "Synced Storage" → "Clear"
   - OR run in console: `chrome.storage.sync.clear()`

2. **Reload extension:**
   - Go to `chrome://extensions/`
   - Click "Reload" on SCE2 Extension

3. **Test popup defaults:**
   - Open popup
   - **Verify:**
     - API URL: `http://localhost:3333`
     - Poll Interval: `5000`
     - Status: "Inactive"

4. **Test options defaults:**
   - Open options page
   - **Verify:**
     - API URL: `http://localhost:3333`
     - Poll Interval: `5000`
     - Timeout: `30000`
     - Max Concurrent: `3`
     - Auto Start: `false`
     - Debug Mode: `false`

## Test 6: Partial Updates

### Purpose: Test partial config updates (saveConfig with Partial<T>)

1. **Setup initial state:**
   - Open options page
   - Set all values to specific values
   - Save

2. **Partial update from popup:**
   - Open popup
   - Change ONLY Poll Interval to `7777`
   - Click "Save"

3. **Verify in DevTools:**
   - `pollInterval` = `7777` (updated)
   - `apiBaseUrl` = unchanged
   - `autoProcess` = unchanged

4. **Refresh options page:**
   - **Verify:** Poll Interval shows `7777`
   - **Verify:** Other values unchanged

## Console Logging (Debug Mode)

1. **Enable debug mode:**
   - Open options page
   - Check "Debug Mode"
   - Save

2. **Reload background service worker**

3. **Check background console:**
   - Should see `[SCE2]` prefixed logs for:
     - Extension installed
     - Configuration loading
     - Polling start/stop
     - Job fetching
     - Queue status

## Expected Test Results

✓ All configuration values load correctly from defaults
✓ All configuration values save to chrome.storage.sync
✓ Configuration persists across popup close/reopen
✓ Configuration persists across page reloads
✓ All contexts (popup, options, background) see same data
✓ Partial updates work correctly
✓ Validation prevents invalid values
✓ Auto-start works when configured
✓ Debug mode enables console logging
✓ No data loss during any operation

## Troubleshooting

**Storage not updating:**
- Check DevTools Application tab for errors
- Verify chrome.storage.sync permissions in manifest.json
- Reload extension and retry

**Values not persisting:**
- Check you clicked "Save" button
- Verify no JavaScript errors in console
- Check Synced Storage in DevTools

**Auto-start not working:**
- Verify `autoStart` = `true` in Synced Storage
- Reload extension to trigger auto-start
- Check background console for errors

**Build issues:**
- Run `npm run build` again
- Check for TypeScript errors
- Verify dist/ directory has all files

## Success Criteria

All tests pass with:
- ✓ 10/10 test cases passing (from npm test)
- ✓ All 6 manual test scenarios successful
- ✓ No console errors in any context
- ✓ All storage operations visible in DevTools
- ✓ Configuration persists correctly
- ✓ No data loss during operations
