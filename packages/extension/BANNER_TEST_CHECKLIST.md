# SCE2 Extension Banner - Test Checklist

## Prerequisites
1. Build extension: `npm run build`
2. Load in Chrome: `chrome://extensions/` → Enable Developer Mode → Load unpacked → select `dist/`
3. Open test page or navigate to sce.dsmcentral.com

## Test Cases

### 1. Banner Auto-Show (Queued Data)
- [ ] Queue test data using test-banner.html "Queue Test Data" button
- [ ] Navigate to any SCE-like page (or test-banner.html)
- [ ] Banner should appear automatically with "✨ Ready to fill form" title
- [ ] Banner should show success message in header

### 2. Manual Show (Extension Icon)
- [ ] Clear any queued data
- [ ] Navigate to SCE-like page
- [ ] Click extension icon
- [ ] Click "📋 Show Form Assistant" button
- [ ] Banner should appear with "📋 SCE Form Detected" title
- [ ] Popup should close

### 3. Fill Current Section
- [ ] Ensure banner is visible
- [ ] Click "Fill: [Section Name]" button
- [ ] Button should show filling state (spinner/loading)
- [ ] Button should show success state (green checkmark) after filling
- [ ] Toast notification should appear
- [ ] Form fields should be populated with test data

### 4. Fill All Sections
- [ ] Ensure banner is visible
- [ ] Click "Fill All Sections" button
- [ ] Progress bar should appear and show current section
- [ ] Progress percentage should update as each section fills
- [ ] Section text should update (e.g., "Filling: Customer Information")
- [ ] Stop button should appear
- [ ] After completion, banner should show success state
- [ ] Banner should auto-dismiss after 3 seconds

### 5. Stop Functionality
- [ ] Start "Fill All Sections"
- [ ] While filling, click "Stop" button
- [ ] Banner should show stopped state (gray)
- [ ] Toast should appear: "Filling stopped. Data filled so far has been preserved."
- [ ] Buttons should be re-enabled

### 6. Section Button Updates
- [ ] Click different section in left menu
- [ ] "Fill: [Section Name]" button should update to reflect current section
- [ ] Wait 2-3 seconds, navigate to another section
- [ ] Button text should update again

### 7. Banner Close/Dismiss
- [ ] Click X button in banner header
- [ ] Banner should disappear
- [ ] Can re-show via extension icon

### 8. Error Handling
- [ ] Test with missing/invalid queued data
- [ ] Toast error notification should appear
- [ ] Button should show error state (red) temporarily

### 9. Responsive Design
- [ ] Resize browser window to mobile width (<768px)
- [ ] Banner should stack vertically
- [ ] Buttons should be full-width
- [ ] Toast notifications should adapt

### 10. Keyboard Navigation
- [ ] Press Tab to navigate through banner
- [ ] Focus indicators should be visible
- [ ] Press Enter on buttons to trigger actions
- [ ] Press Escape on close button (if implemented)

### 11. Toast Notifications
- [ ] Toast should appear at top-right
- [ ] Success toasts should auto-dismiss after 4s
- [ ] Error toasts should auto-dismiss after 6s
- [ ] Multiple toasts should stack vertically
- [ ] Click X on toast to dismiss manually

## Known Issues to Check

### Potential Issue: ES6 Imports in Content Scripts
Chrome MV3 content scripts with ES6 imports may not load properly. The manifest.json lists:
```json
"js": ["lib/sce-helper.js", "lib/utils.js", ..., "content.js"]
```

If the extension fails to load:
1. Check browser console for import errors
2. May need to bundle with esbuild/webpack
3. Or use dynamic import() instead

### Potential Issue: CSS Injection
Banner CSS is loaded via `chrome.runtime.getURL('assets/banner.css')`
- [ ] Verify CSS loads correctly
- [ ] Check browser console for CSS loading errors

### Potential Issue: Section Detection
`getActiveSectionTitle()` looks for `.sections-menu-item.active .sections-menu-item__title`
- [ ] Verify SCE website uses these selectors
- [ ] May need to update selectors if SCE changed their HTML

## Manual Testing Steps

1. **Load Extension:**
   ```bash
   cd packages/extension
   npm run build
   # In Chrome: chrome://extensions/ → Enable Developer Mode → Load unpacked → select dist/
   ```

2. **Open Test Page:**
   - Open `packages/extension/test-banner.html` in Chrome
   - Or navigate to https://sce.dsmcentral.com (if you have access)

3. **Test Auto-Show:**
   - Click "Queue Test Data" button
   - Refresh the page
   - Banner should appear

4. **Test Manual Show:**
   - Click extension icon
   - Click "📋 Show Form Assistant"
   - Banner should appear

5. **Check Browser Console:**
   - F12 → Console tab
   - Look for red errors
   - Should see: "SCE2 Content Script loaded"

## Debug Commands (Run in Console)

```javascript
// Check if banner is initialized
window.sce2Banner

// Check for queued data
chrome.storage.local.get('queuedProperty', (r) => console.log(r))

// Manually show banner
window.sce2Banner?.show()

// Manually trigger fill all
chrome.runtime.sendMessage({ action: 'FILL_ALL_SECTIONS' })

// Check stop flag
window.sce2StopRequested
```
