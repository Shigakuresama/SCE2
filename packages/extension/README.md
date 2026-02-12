# SCE2 Chrome Extension

Automated scraping and submission for SCE rebate applications with cloud integration.

## Features

- **Automated Scraping**: Polls cloud server for properties and extracts customer data from SCE website
- **Automated Submission**: Fills and submits rebate applications with field data and document uploads
- **Queue Management**: Processes scrape and submit jobs with configurable concurrency
- **Cloud Integration**: Communicates with SCE2 cloud API for job queue and status updates
- **Smart Form Filling**: Uses Angular Material-aware patterns for reliable form interaction
- **Configurable**: Full control over API endpoints, polling intervals, timeouts, and concurrency

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

This creates a `dist/` directory with all extension files.

### Watch Mode

```bash
npm run dev
```

Automatically recompiles TypeScript files on changes.

### Package for Distribution

```bash
npm run package
```

Creates `sce2-extension.zip` ready for distribution or loading into Chrome.

## Loading in Chrome

### Development Build (Unpacked)

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select `packages/extension/dist/`

### Production Build (Packaged)

1. Run `npm run package`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Extract and select `sce2-extension.zip`

Or distribute the ZIP file for installation via "Load unpacked".

## Configuration

### Required Settings

Access via **Options page** (right-click extension icon → Options) or **Popup**:

- **API Base URL**: Your SCE2 cloud server URL
  - Local: `http://localhost:3333`
  - Production: `https://your-server.com`

### Optional Settings

- **Poll Interval**: How often to check for new jobs (default: 5000ms = 5 seconds)
- **Request Timeout**: Maximum time to wait for server responses (default: 30000ms = 30 seconds)
- **Max Concurrent Jobs**: Maximum number of tabs to process simultaneously (default: 3)
- **Debug Mode**: Enable verbose logging in console (default: false)
- **Auto-start**: Automatically start processing when extension loads (default: false)

## Usage

### Starting Processing

1. Click extension icon in browser toolbar
2. Click **Open SCE Customer Search** in the popup
3. Make sure your SCE account is already logged in on that tab (`/onsite/customer-search`)
4. Configure API Base URL if not already set
5. Click "Start Processing" button
6. Extension will begin polling for jobs and scraping each queued customer automatically

### Monitoring Status

- **Popup**: Shows real-time status, processed counts
- **Background Console**: `chrome://extensions/` → Find SCE2 → "Service worker" link
- **Content Script Console**: On SCE website tabs (F12 → Console)

### Stopping Processing

1. Click extension icon
2. Click "Stop Processing" button

## How It Works

### Scrape Mode

1. Extension polls cloud server for properties with status `PENDING_SCRAPE`
2. Opens `https://sce.dsmcentral.com/onsite/customer-search` in a new tab
3. Fills customer search form with address/zip code
4. Extracts customer name and phone from results
5. Sends extracted data to cloud server
6. Updates property status to `READY_FOR_FIELD`
7. Closes tab

### Submit Mode

1. Extension polls for properties with status `VISITED`
2. Opens `https://sce.dsmcentral.com/onsite/customer-search` in a new tab
3. Fills all form sections with customer data and field notes
4. Uploads photos and documents
5. Submits application
6. Extracts SCE Case ID from confirmation
7. Sends Case ID to cloud server
8. Updates property status to `COMPLETE`
9. Closes tab

## Architecture

### Components

- **background.ts**: Service worker managing queue polling and job orchestration
- **content.ts**: Content script running on SCE website, handles form interaction
- **lib/sce-helper.ts**: Helper class with Angular Material-aware form filling methods
- **lib/utils.ts**: Utility functions for DOM manipulation and waiting
- **popup.ts/html**: Extension popup UI for status and quick controls
- **options.ts/html**: Full-featured options page for configuration

### Message Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ Background  │────────>│ Content Script│────────>│  SCE Form   │
│  Worker     │<────────│  (SCE site)   │<────────│   Fields    │
└─────────────┘         └──────────────┘         └─────────────┘
       │
       v
┌─────────────┐
│ Cloud API   │
│   :3333     │
└─────────────┘
```

## Troubleshooting

### Extension not loading

**Symptoms**: Error in `chrome://extensions/`

**Solutions**:
- Check for errors in the extensions page
- Verify TypeScript compilation: `npm run build`
- Ensure all files in `dist/` are present
- Check manifest.json syntax

### Jobs not processing

**Symptoms**: Extension shows "Inactive" status despite having "Start Processing" enabled

**Solutions**:
1. Check API Base URL in extension options
2. Verify cloud server is running: `curl http://localhost:3333/health`
3. Check background console for errors
4. Ensure CORS origins include extension URL in server config
5. Enable Debug Mode and check logs

### Queue scrape fails due to login/session

**Symptoms**: Jobs fail with login-related errors or customer-search access errors

**Solutions**:
1. In the extension popup, click **Open SCE Customer Search**
2. Confirm you can manually access and use `/onsite/customer-search`
3. Keep that browser profile/session logged in
4. Start processing again from the popup

### Form filling fails

**Symptoms**: Jobs fail with "Element not found" or "Timeout" errors

**Solutions**:
1. Enable Debug Mode in options
2. Open SCE website tab and check content script console (F12)
3. Verify SCE website hasn't changed (inspect elements)
4. Check for Angular-specific issues (mat-form-field, mat-select)
5. Review logs for specific selector failures

### Database locked error

**Symptoms**: Server logs show "database is locked"

**Solutions**:
```bash
# Stop all server processes
lsof -i :3333 | awk 'NR>1 {print $2}' | xargs kill

# Delete journal files
cd packages/cloud-server
rm *.sqlite-journal
```

### Files not uploading

**Symptoms**: Submit jobs fail with document upload errors

**Solutions**:
1. Check document URLs in cloud server (should be accessible)
2. Verify CORS headers on file endpoints
3. Ensure file size doesn't exceed limits
4. Check that file paths in database match actual uploads

## Development Workflow

### Making Changes

1. Edit source files in `src/`
2. Run `npm run build` to compile
3. Go to `chrome://extensions/`
4. Click refresh icon on SCE2 extension card
5. Test changes

### Debugging

**Background Script:**
- Go to `chrome://extensions/`
- Find "SCE2 Rebate Automation"
- Click "Service worker" link
- DevTools opens with background console

**Content Script:**
- Navigate to `https://sce.dsmcentral.com/onsite`
- Open DevTools (F12)
- Console shows content script logs

**Storage:**
- DevTools → Application → Storage → chrome.storage.sync
- View current configuration

### Adding Features

1. Update TypeScript interfaces in relevant files
2. Implement feature in `src/`
3. Update `manifest.json` if adding permissions
4. Build and test
5. Update this README if user-facing

## File Structure

```
packages/extension/
├── src/
│   ├── background.ts       # Service worker
│   ├── content.ts          # Content script
│   ├── popup.ts            # Popup logic
│   ├── options.ts          # Options page logic
│   └── lib/
│       ├── sce-helper.ts   # Form filling helper
│       └── utils.ts        # Utilities
├── dist/                   # Compiled output (generated)
├── icons/                  # Extension icons
├── manifest.json           # Extension manifest
├── popup.html              # Popup UI
├── options.html            # Options page UI
├── package.json            # NPM configuration
├── tsconfig.json           # TypeScript config
└── vitest.config.ts        # Test configuration
```

## Testing

```bash
npm test
```

Run unit tests (currently minimal - add more as needed).

## API Integration

The extension expects the following API endpoints on the configured server:

- `GET /api/queue/scrape` - Fetch next scrape job
- `GET /api/queue/submit` - Fetch next submit job
- `POST /api/queue/:id/scraped` - Save scraped data
- `POST /api/queue/:id/complete` - Mark job complete with Case ID
- `GET /uploads/:filename` - Retrieve document for upload

See cloud-server documentation for API specifications.

## License

[Your License Here]

## Support

For issues or questions:
- Check troubleshooting section above
- Review cloud server logs
- Enable Debug Mode for detailed logging
- Check browser console for errors
