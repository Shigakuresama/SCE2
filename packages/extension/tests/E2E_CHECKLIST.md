# Extension E2E Test Checklist

## Prerequisites

- [ ] Cloud server running on port 3333
- [ ] Extension loaded in Chrome
- [ ] At least one test property in database with status `PENDING_SCRAPE`

## Manual Test Steps

### 1. Extension Installation

- [ ] Navigate to `chrome://extensions/`
- [ ] Enable "Developer mode"
- [ ] Click "Load unpacked"
- [ ] Select `packages/extension/dist/`
- [ ] Verify extension appears without errors
- [ ] Click extension icon, popup opens
- [ ] Verify popup UI displays correctly:
  - Status indicator (active/inactive)
  - Scrape/Submit queue counts
  - API URL input field
  - Poll interval input
  - Save configuration button
  - Start/Stop processing button

### 2. Configuration

- [ ] Open extension popup
- [ ] Verify API Base URL is correct (http://localhost:3333)
- [ ] Change poll interval to 3000ms
- [ ] Click "Save Configuration"
- [ ] Verify "Saved!" message appears on button
- [ ] Open options page (right-click extension → Options)
- [ ] Verify all settings are displayed correctly:
  - API Base URL
  - Poll Interval
  - Request Timeout
  - Max Concurrent Jobs
  - Auto-start checkbox
  - Debug Mode checkbox
- [ ] Enable "Debug mode"
- [ ] Save configuration
- [ ] Verify success message appears

### 3. Scrape Workflow

**Setup: Create test property in cloud server**

```bash
curl -X POST http://localhost:3333/api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "addressFull": "1909 W Martha Ln, Santa Ana, CA 92706",
    "streetNumber": "1909",
    "streetName": "W Martha Ln",
    "zipCode": "92706"
  }'
```

**Test Steps:**

- [ ] Open extension popup
- [ ] Verify "Scrape Queue: 0" or check database count
- [ ] Click "Start Processing"
- [ ] Status changes to "Processing" (green indicator)
- [ ] New tab opens to SCE website (https://sce.dsmcentral.com/onsite)
- [ ] Wait for page to load completely
- [ ] Customer search form is filled:
  - Address field contains "1909 W Martha Ln"
  - Zip Code field contains "92706"
- [ ] Program button is clicked automatically
- [ ] Customer name is extracted from results
- [ ] Customer phone is extracted from results
- [ ] Tab closes automatically
- [ ] Property status in database is `READY_FOR_FIELD`
- [ ] Property has customerName populated
- [ ] Property has customerPhone populated
- [ ] Scrape count in popup increments

**Debug Verification (with Debug Mode enabled):**

- [ ] Open background console (chrome://extensions/ → Service worker)
- [ ] Verify logs show:
  - "Fetching scrape job from..."
  - "Scrape job found: {...}"
  - "Processing scrape job: {...}"
  - "Opened tab X for scrape job X"
  - "Tab X loaded"
  - "Scrape job X completed successfully"
  - "Scraped data saved: X"

### 4. Submit Workflow

**Setup: Update property to VISITED status with field data**

```bash
# First, get the property ID from scrape step
PROPERTY_ID=1

curl -X PATCH http://localhost:3333/api/properties/$PROPERTY_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "VISITED",
    "customerAge": 45,
    "fieldNotes": "Test field notes from E2E test"
  }'
```

**Test Steps:**

- [ ] Verify property status is `VISITED` in database
- [ ] Ensure "Start Processing" is active in extension popup
- [ ] New tab opens to SCE website
- [ ] Customer info section is filled:
  - First Name
  - Last Name
  - Phone
- [ ] Form sections are navigated correctly:
  - Customer Info ✓
  - Property Info ✓
  - Program Selection ✓
  - Document Upload ✓
- [ ] Documents are uploaded (if any exist)
- [ ] Review & Submit section is reached
- [ ] Submit button is clicked
- [ ] SCE Case ID is extracted from confirmation page
- [ ] Tab closes automatically
- [ ] Property status is `COMPLETE`
- [ ] Property has sceCaseId (format: SCE-XXXXX)
- [ ] Submit count in popup increments

**Debug Verification:**

- [ ] Background console logs show:
  - "Fetching submit job from..."
  - "Submit job found: {...}"
  - "Processing submit job: {...}"
  - "Documents: [{...}]"
  - "Submit job X completed successfully. Case ID: SCE-XXXXX"

### 5. Error Handling

**Test: Cloud Server Unavailable**

- [ ] Stop cloud server (Ctrl+C in terminal)
- [ ] Try to process job (or wait for next poll)
- [ ] Verify error is logged in background console:
  - "Failed to fetch scrape job: TypeError: Failed to fetch"
  - OR "Request timeout after 30000ms"
- [ ] Property status remains unchanged (not marked as FAILED immediately)
- [ ] Restart cloud server: `cd packages/cloud-server && npm run dev`
- [ ] Job should process successfully on next poll

**Test: Invalid Property Data**

- [ ] Create property with invalid zip code: "00000"
- [ ] Start processing
- [ ] Verify error is logged when form filling fails
- [ ] Tab closes
- [ ] Property is handled appropriately (failed or retried)

**Test: Network Timeout**

- [ ] Set very short timeout in options (1000ms)
- [ ] Try to process job
- [ ] Verify "Request timeout" error in logs
- [ ] Reset timeout to reasonable value (30000ms)

### 6. Concurrent Processing

**Setup: Create multiple test properties**

```bash
for i in {1..5}; do
  curl -X POST http://localhost:3333/api/properties \
    -H "Content-Type: application/json" \
    -d "{
      \"addressFull\": \"$i Test St, Test City, CA 90210\",
      \"streetNumber\": \"$i\",
      \"streetName\": \"Test St\",
      \"zipCode\": \"90210\"
    }"
done
```

**Test Steps:**

- [ ] Set max concurrent to 3 in options page
- [ ] Save configuration
- [ ] Click "Start Processing"
- [ ] Verify exactly 3 tabs open simultaneously
- [ ] As tabs complete, new tabs open (never more than 3)
- [ ] All 5 properties are processed
- [ ] No jobs are skipped or duplicated
- [ ] Final scrape count shows 5

**Debug Verification:**

- [ ] Logs show: "Max concurrent jobs reached, skipping poll" when at limit
- [ ] Each tab processes a different property

### 7. Polling Behavior

**Test: Poll Interval**

- [ ] Set poll interval to 3000ms (3 seconds)
- [ ] Enable debug mode
- [ ] Start processing
- [ ] Observe timestamps in background console
- [ ] Verify polls occur approximately every 3 seconds
- [ ] Set poll interval to 10000ms
- [ ] Verify polls slow down to every 10 seconds

**Test: Auto-start**

- [ ] Enable "Auto-start Processing" in options
- [ ] Reload extension (chrome://extensions/ → reload)
- [ ] Verify processing starts automatically
- [ ] Disable auto-start
- [ ] Reload extension
- [ ] Verify processing does NOT start automatically

### 8. Storage Persistence

**Test: Configuration Saved**

- [ ] Change API URL to "http://localhost:4444"
- [ ] Set poll interval to 7000
- [ ] Set max concurrent to 5
- [ ] Enable debug mode
- [ ] Save configuration
- [ ] Reload extension (chrome://extensions/ → reload)
- [ ] Open popup
- [ ] Verify all settings persist:
  - API URL: http://localhost:4444
  - Poll interval: 7000
  - Max concurrent: 5
  - Debug mode: enabled
- [ ] Reset to default values for normal use

### 9. UI Functionality

**Test: Popup Buttons**

- [ ] Click "Save Configuration" without changes
- [ ] Verify button feedback (text change to "Saved!")
- [ ] Click "Start Processing"
- [ ] Button text changes to "Stop Processing"
- [ ] Status indicator changes to active (green)
- [ ] Click "Stop Processing"
- [ ] Button text changes back to "Start Processing"
- [ ] Status indicator changes to inactive (gray)

**Test: Options Page Validation**

- [ ] Set poll interval to 500 (below minimum)
- [ ] Try to save
- [ ] Verify error message: "Poll interval must be between 1000 and 60000"
- [ ] Set poll interval to 70000 (above maximum)
- [ ] Try to save
- [ ] Verify error message appears
- [ ] Set API URL to empty string
- [ ] Try to save
- [ ] Verify error: "API Base URL is required"
- [ ] Fix all values
- [ ] Save succeeds

### 10. Cleanup

**After Testing:**

- [ ] Stop processing (click "Stop Processing" in popup)
- [ ] Close all SCE website tabs
- [ ] Delete test properties from database:
  ```bash
  # Open Prisma Studio
  cd packages/cloud-server
  npm run db:studio

  # Or use API
  curl -X DELETE http://localhost:3333/api/properties
  ```
- [ ] Reset configuration to defaults
- [ ] Disable debug mode
- [ ] Check cloud server logs for errors
- [ ] Check background console for errors
- [ ] Verify extension has no memory leaks (Chrome task manager)

## Common Issues and Solutions

### "Content script error"

**Symptoms:** Background console shows "Content script error" message

**Diagnosis:**
1. Verify content script loaded on SCE website
2. Open SCE website tab
3. Open DevTools (F12)
4. Check Console tab for content script errors
5. Look for red error messages

**Solutions:**
- Check browser console on SCE website tab
- Look for selector changes in SCE website (inspect elements)
- Verify content_scripts in manifest.json have correct matches
- Try reloading the extension
- Clear Chrome cache and reload

### "Element not found"

**Symptoms:** Content script logs "Element not found: [selector]"

**Diagnosis:**
1. Enable debug mode
2. Open SCE website
3. Inspect the element that's "not found"
4. Check if class names or IDs have changed

**Solutions:**
- SCE website structure changed
- Update selectors in `sce-helper.ts`
- Test manually in Chrome DevTools:
  ```javascript
  document.querySelector('[your-selector]')
  ```
- Update waitForElement timeout if element loads slowly

### "Request timeout"

**Symptoms:** Background console shows "Request timeout after 30000ms"

**Diagnosis:**
1. Check if cloud server is running: `curl http://localhost:3333/health`
2. Check network tab in DevTools
3. Look for stalled requests

**Solutions:**
- Increase timeout in options page (try 60000ms)
- Check network connectivity
- Verify cloud server is responsive (not frozen)
- Check server logs for long-running queries
- Restart cloud server if needed

### "Tab doesn't close"

**Symptoms:** Tab stays open after job completes

**Diagnosis:**
1. Check background console for errors after job
2. Look for alerts/modals on SCE website
3. Check if tab is being closed by other extensions

**Solutions:**
- Manually close tab
- Check for alerts/modals blocking close ( SCE website may show confirmation)
- Review background console for errors in closeTab function
- Disable other extensions temporarily
- Check if Chrome is blocking tab closure (some security settings)

### "Property status not updating"

**Symptoms:** Job completes but property status remains unchanged

**Diagnosis:**
1. Check cloud server logs for API errors
2. Verify API endpoint is correct
3. Check database directly (Prisma Studio or sqlite3)

**Solutions:**
- Check cloud server is running
- Verify CORS headers allow extension
- Check API endpoint URLs in background.ts
- Look for 404/500 errors in server logs
- Test API manually with curl

### "Jobs not processing"

**Symptoms:** Extension shows "Processing" but no jobs start

**Diagnosis:**
1. Check background console for "No scrape jobs available"
2. Verify database has properties with correct status
3. Check API endpoint returns jobs

**Solutions:**
- Query database for PENDING_SCRAPE properties
- Check API: `curl http://localhost:3333/api/queue/scrape`
- Verify property status in database
- Check for JavaScript errors in background console
- Reload extension and try again

## Success Criteria

All tests pass, extension successfully:

- [x] Installs in Chrome without errors
- [x] Loads popup and options pages correctly
- [x] Saves and persists configuration
- [x] Polls cloud server for jobs at configured interval
- [x] Opens and closes tabs correctly
- [x] Fills SCE forms without selector errors
- [x] Extracts data from SCE website
- [x] Updates property status in database via API
- [x] Handles network errors gracefully
- [x] Respects max concurrent setting
- [x] Logs useful information in debug mode
- [x] Validates user input in options page
- [x] Provides UI feedback for user actions
- [x] Stops and starts processing on command
- [x] Auto-starts when configured

## Test Environment

- **Chrome Version:** [Record version tested]
- **Extension Version:** 1.0.0
- **Cloud Server:** http://localhost:3333
- **Database:** SQLite (dev) or PostgreSQL (production)
- **Test Date:** [Record date]
- **Tester:** [Record name]

## Notes

Record any observations, issues, or deviations from expected behavior during testing:

-
-
-
-
