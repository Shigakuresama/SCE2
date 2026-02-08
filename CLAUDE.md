# Claude Code Guide for SCE2

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SCE2 is a **cloud-hybrid rebate automation platform** that unifies the fragmented SCE v1 tools into a cohesive system with centralized database, API, and mobile support. It maintains full compatibility with SCE1's form-filling logic while adding modern architecture and mobile support.

### Architecture Components

1. **Cloud Server** (`packages/cloud-server/`) - Express API with Prisma ORM, Zillow scraping with proxy
2. **Extension** (`packages/extension/`) - Chrome MV3 extension with SCE1 compatibility layer
3. **Webapp** (`packages/webapp/`) - React desktop app (map-based address selection, PDF generation)
4. **Mobile Web** (`packages/mobile-web/`) - React mobile app (field data collection, photo capture)

### Key Differences from SCE (v1)

| Aspect | SCE (v1) | SCE2 |
|--------|----------|------|
| **State Management** | Local files, extension storage | Centralized SQLite/PostgreSQL database |
| **API** | Proxy server on :3000 (CORS bypass) | Full REST API on :3333 |
| **Mobile** | None | Mobile web interface with photo capture |
| **Queue System** | Manual | Automated scrape/submit queues |
| **Zillow Scraping** | Extension-based direct scraping | Server-side with ScraperAPI proxy |
| **SCE1 Compatibility** | N/A (original) | Complete compatibility layer with all defaults |
| **Deployment** | Local only | Local-first, one-config cloud migration |
| **PDF** | Client-side jsPDF | Server-side + QR code generation |

### Recent Major Updates (Feb 2025)

✅ **SCE1 Full Compatibility** - All default values, ZIP+4 extraction, email generation
✅ **Proxy-Based Zillow Scraping** - ScraperAPI integration bypasses 403 Forbidden
✅ **Custom Map Drawing Tools** - Rectangle/circle with click-move-click pattern
✅ **Address Search** - Nominatim API with map pinning
✅ **Property Deletion** - Fixed route ordering, added UI controls
✅ **Comprehensive Options Page** - 980 lines, 18 tabs matching SCE1
✅ **Multi-Method Address Selection** - Draw on map, address range, import list, pin mode, database
✅ **Route Processing System** - Extract customer data from SCE via extension
✅ **Form Automation Banner** - Floating UI for filling SCE forms (all sections or current section)
  - Auto-shows when queued data exists
  - Manual trigger via extension icon
  - Progress tracking, stop functionality, toast notifications
  - Section navigation orchestration

## Common Commands

### Root Level

```bash
npm install                 # Install all workspace dependencies
npm run dev                 # Start all services in parallel
npm run build               # Build all packages
npm run test                # Run all tests
```

### Cloud Server

```bash
cd packages/cloud-server
npm run dev                 # Start with hot reload (tsx watch)
npm run build               # Compile TypeScript
npm run start               # Run compiled version
npm run db:generate         # Generate Prisma client
npm run db:push             # Push schema to database
npm run db:migrate          # Create migration
npm run db:studio           # Open Prisma Studio (GUI)
```

### Extension

```bash
cd packages/extension
npm run build               # Compile TypeScript and copy assets
npm run dev                 # Watch mode (TypeScript only)
npm run package             # Build and create ZIP for distribution
```

**Loading Extension in Chrome:**
1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `packages/extension/dist/`

**Testing Zillow Scraping:**
```bash
# From project root
curl "http://localhost:3333/api/zillow/scrape?address=1909%20W%20Martha%20Ln&zipCode=92706"
```

### Webapp / Mobile

```bash
cd packages/webapp          # or mobile-web
npm run dev                 # Start Vite dev server
npm run build               # Production build
npm run preview             # Preview production build
```

## Development Workflow

### 1. Making Database Changes

```bash
# Edit prisma/schema.prisma
cd packages/cloud-server
npm run db:push             # Apply changes to dev database
npm run db:generate         # Regenerate Prisma client
```

**For production (when using PostgreSQL):**
```bash
npm run db:migrate          # Create migration file
# Review migration file
npm run db:migrate          # Apply migration
```

### 2. Adding API Endpoints

1. Create route handler in `packages/cloud-server/src/routes/`
2. Register in `packages/cloud-server/src/routes/index.ts`
3. Add validation with `express-validator` if needed
4. Test with Postman or curl

**Example - Zillow Scrape Endpoint:**
```typescript
// packages/cloud-server/src/routes/zillow.ts
import { scrapeZillowData } from '../lib/zillow.js';

zillowRoutes.get('/scrape', asyncHandler(async (req, res) => {
  const { address, zipCode } = req.query;
  const propertyData = await scrapeZillowData(address as string, zipCode as string);
  res.json({ success: true, data: propertyData });
}));
```

### 3. Extension Development

**SCE1 Compatibility Layer:**
All SCE1 defaults and logic are in `src/lib/sce1-logic.ts`:

```typescript
import {
  SCE1_DEFAULTS,
  generateEmailFromName,
  getPlus4Zip,
  extractPlus4FromMailingZip
} from './lib/sce1-logic.js';

// Get default values
const defaults = SCE1_DEFAULTS;

// Generate email from customer name (80% Gmail, 20% Yahoo)
const email = generateEmailFromName('Sergio', 'Correa');
// Returns: sergio.correa123@gmail.com (or similar)

// Extract ZIP+4 with 4-level fallback
const plus4 = getPlus4Zip('', '92706');
// Returns: '2706' (last 4 digits)
```

**Content Script Flow:**
```typescript
// 1. Extension receives message from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCRAPE_PROPERTY') {
    performScrape(message.data).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

// 2. Interact with SCE website
async function performScrape(data) {
  // Fetch Zillow data via API
  const zillowData = await fetchZillowDataWithCache(data.addressFull, data.zipCode);

  // Fill forms with Zillow data, customer data, and SCE1 defaults
  fillForms({
    ...SCE1_DEFAULTS,
    ...zillowData,
    ...data
  });

  return { success: true, data: extractedData };
}
```

**Background Script Queue Polling:**
```typescript
// Polls every 5 seconds
setInterval(async () => {
  const job = await fetch(`${API_BASE}/api/queue/scrape`);
  if (job) {
    // Open tab, send message to content script
  }
}, 5000);
```

### 4. Map Drawing Tools (Webapp)

**Custom Drag-to-Draw Implementation:**
The webapp uses a custom click-move-click pattern for drawing shapes (replacing leaflet-draw):

```typescript
// Rectangle drawing in MapLayout.tsx
const [rectangleStart, setRectangleStart] = useState<L.LatLng | null>(null);

const handleRectangleClick = (e: L.LeafletMouseEvent) => {
  if (!rectangleStart) {
    // First click - set start point
    setRectangleStart(e.latlng);
    L.circleMarker(e.latlng, { radius: 5 }).addTo(map);
  } else {
    // Second click - complete rectangle
    const bounds = L.latLngBounds(rectangleStart, e.latlng);
    L.rectangle(bounds, { color: '#2196F3' }).addTo(map);
    onDrawComplete(bounds);
    setRectangleStart(null);
  }
};
```

**Address Search:**
```typescript
// Search and pin address on map
const response = await fetch(
  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
);
const data = await response.json();
if (data && data.length > 0) {
  const { lat, lon } = data[0];
  map.setView([lat, lon], 17);
  L.marker([lat, lon]).addTo(map);
}
```

### 5. Address Selection Methods (Webapp)

The webapp provides 5 different ways to select addresses for route processing:

**AddressSelectionManager Component:**
Located at `src/components/AddressSelectionManager.tsx`, provides:

1. **Draw on Map** - Use rectangle/circle drawing tools to select area
2. **Address Range** - Generate sequential addresses (e.g., "100-200 Main St")
3. **Pin Addresses** - Click individual locations on the map
4. **Import List** - Paste addresses or upload CSV/TXT file
5. **From Database** - Select existing properties from database

**AddressRangeInput Component:**
```typescript
// Generates addresses from start to end number
<AddressRangeInput onAddressesExtracted={(addresses) => {
  // addresses: string[] - e.g., ["100 Main St", "101 Main St", ...]
}} />
```

**AddressImport Component:**
```typescript
// Imports addresses from pasted text or file
<AddressImport onAddressesImported={(addresses) => {
  // addresses: string[] - parsed from input
}} />
```

### 6. Route Processing System

The RouteProcessor component extracts customer data from SCE website via the extension:

**RouteProcessor Component:**
```typescript
// Extract customer data for selected properties
<RouteProcessor
  properties={properties}
  selectedProperties={selectedProperties}
  onProcessingComplete={(results) => {
    // results: Array of { success, address, customerName, customerPhone, timestamp }
  }}
  onPropertiesUpdated={() => fetchProperties()}
/>
```

**Flow:**
1. User selects addresses (via any method above)
2. User clicks "Extract Customer Data" button
3. Extension opens SCE website in 3 concurrent tabs
4. For each address: fills form → clicks Search → clicks Income → extracts data
5. Results saved to database with `dataExtracted: true`
6. Properties refresh to show extracted customer names/phones

### 5. Debugging

**Cloud Server:**
- Logs go to `logs/combined.log` and `logs/error.log`
- Use `console.log()` - Winston captures everything
- Database queries logged in development mode

**Extension:**
- Chrome extension background: `chrome://extensions/` → "Service worker" link
- Content script: Right-click SCE website → "Inspect"
- Check `chrome.storage.sync` for config: DevTools → Application → Storage
- Options page: Right-click extension icon → Options

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Extension not loading | Check manifest.json syntax, run `npm run build` |
| Database locked | Stop all server processes, delete `*.sqlite-journal` files |
| CORS errors | Add origin to `ALLOWED_ORIGINS` in `.env` |
| Queue not processing | Check extension background script console for errors |
| Zillow 403 Forbidden | ScraperAPI automatically retries with proxy (configured in .env) |
| Map drawing not working | Use click-move-click pattern, not drag |

## Architecture Patterns

### Prisma Usage

```typescript
// Singleton pattern
import { prisma } from './lib/database.js';

const properties = await prisma.property.findMany({
  where: { status: 'PENDING_SCRAPE' },
  include: { documents: true },
});

// Transactions
await prisma.$transaction([
  prisma.property.update({ ... }),
  prisma.document.create({ ... }),
]);
```

### Error Handling Middleware

```typescript
import { asyncHandler, ValidationError } from './middleware/errorHandler.js';

app.post('/api/properties',
  asyncHandler(async (req, res) => {
    // Automatically catches errors and sends JSON response
    const property = await prisma.property.create({ data: req.body });
    res.json({ success: true, data: property });
  })
);
```

### Zillow Scraping with Proxy

**Server-side (cloud-server):**
```typescript
import { scrapeZillowData } from './lib/zillow.js';

// Automatically uses ScraperAPI proxy if direct scraping fails
const propertyData = await scrapeZillowData(address, zipCode);
// Returns: { sqFt: 1200, yearBuilt: 1970 } (with fallbacks)
```

**Client-side (extension):**
```typescript
import { fetchZillowDataWithCache } from './lib/zillow-client.js';

// Cached for 24 hours
const zillowData = await fetchZillowDataWithCache(address, zipCode);
```

### Extension Message Passing

**Background → Content:**
```typescript
chrome.tabs.sendMessage(tabId, { action: 'SCRAPE_PROPERTY', data });
```

**Content → Background:**
```typescript
chrome.runtime.sendMessage({ action: 'JOB_COMPLETE', data });
```

**Async Response Pattern:**
```typescript
// Background sends message and waits for response
chrome.tabs.sendMessage(tabId, { action: 'SCRAPE', data }, (response) => {
  if (chrome.runtime.lastError) {
    // Handle error
  }
  console.log(response.data);
});

// Content script must return true to keep channel open
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCRAPE') {
    performScrape().then(sendResponse);
    return true; // Required for async response
  }
});
```

### SCE1 Form Filling

**Default Values:**
```typescript
export const SCE1_DEFAULTS = {
  // Customer Information
  firstName: 'Sergio',
  lastName: 'Correa',
  phone: '7143912727',
  email: 'scm.energysavings@gmail.com',

  // Demographics
  primaryApplicantAge: '44',
  ethnicity: 'Hispanic/Latino',
  veteran: 'No',
  nativeAmerican: 'No',
  disabled: 'No',

  // Project Information defaults
  defaultSqFt: '1200',
  defaultYearBuilt: '1970',
  spaceOrUnit: '1',

  // Trade Ally Information (CONTRACTOR fields)
  projectFirstName: 'Sergio',
  projectLastName: 'Correa',
  projectPhone: '7143912727',
  projectEmail: 'scm.energysavings@gmail.com',
  // ... 70+ more fields
};
```

**ZIP+4 Extraction (4-level fallback):**
```typescript
export function getPlus4Zip(configPlus4: string, regularZip: string): string {
  // Priority 1: Config override
  if (configPlus4) return configPlus4;

  // Priority 2: Extracted from mailing zip (stored globally)
  if (window.scePlus4Zip) return window.scePlus4Zip;

  // Priority 3: Extract from mailing zip now
  const extracted = extractPlus4FromMailingZip();
  if (extracted) return extracted;

  // Priority 4: Search readonly fields
  const readonlyPlus4 = findPlus4InReadOnlyFields();
  if (readonlyPlus4) return readonlyPlus4;

  // Priority 5: Last 4 digits of regular zip
  if (regularZip && regularZip.length === 5) {
    return regularZip.slice(-4);
  }

  return '';
}
```

**Email Generation:**
```typescript
export function generateEmailFromName(firstName: string, lastName: string): string {
  const digits = Math.floor(Math.random() * 900) + 100;
  const isGmail = Math.random() < 0.8;

  const patterns = isGmail
    ? [
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}${digits}@gmail.com`,
        `${lastName.toLowerCase()}.${firstName.toLowerCase()}${digits}@gmail.com`,
        `${firstName.toLowerCase()}${lastName.toLowerCase()}${digits}@gmail.com`,
      ]
    : [`${firstName.toLowerCase()}_${lastName.toLowerCase()}${digits}@yahoo.com`];

  return patterns[Math.floor(Math.random() * patterns.length)];
}
```

### File Upload Handling

**Client-side (webapp/extension):**
```typescript
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('docType', 'BILL');
formData.append('propertyId', '123');

await fetch('/api/documents', {
  method: 'POST',
  body: formData,
});
```

**Server-side (cloud-server):**
```typescript
import multer from 'multer';

// Upload middleware configured in src/routes/uploads.ts
// Files stored in UPLOAD_DIR (default: ./uploads)
// Multer handles multipart/form-data parsing
```

## Key Files Reference

### Cloud Server

**Core:**
- `src/index.ts` - Server entry point, middleware setup
- `src/lib/database.ts` - Prisma singleton, connection management
- `src/lib/logger.ts` - Winston logging configuration
- `src/lib/config.ts` - Environment variable config with defaults
- `prisma/schema.prisma` - Database schema (source of truth!)

**Zillow Scraping:**
- `src/lib/zillow.ts` - Main Zillow interface with caching
- `src/lib/zillow-scraper.ts` - Direct Zillow scraping
- `src/lib/proxy-scraper.ts` - ScraperAPI proxy integration
- `src/lib/assessor-scraper.ts` - County assessor scraping (future)
- `src/routes/zillow.ts` - GET /api/zillow/scrape endpoint

**Routes:**
- `src/routes/index.ts` - Route registration and health check
- `src/routes/properties.ts` - Property CRUD operations
- `src/routes/queue.ts` - Scrape/submit queue endpoints
- `src/routes/uploads.ts` - Document upload handling
- `src/routes/routes.ts` - Route management (planning groups)
- `src/middleware/errorHandler.ts` - Global error handling, async wrapper

### Extension

**Core:**
- `src/background.ts` - Service worker, queue polling, orchestration
- `src/content.ts` - SCE website interaction (form filling, data extraction, banner integration)
- `manifest.json` - Extension configuration (not in src/)

**SCE1 Compatibility:**
- `src/lib/sce1-logic.ts` - **Complete SCE1 compatibility layer**
  - All 70+ default values
  - ZIP+4 extraction with 4-level fallback
  - Email generation from customer names
  - All field mappings

**Banner & Form Filling:**
- `src/lib/banner.ts` - **Banner controller** for form automation UI
  - Auto-shows when queued data exists
  - Manual trigger via extension icon popup
  - "Fill All Sections" - Sequentially fills all 18 form sections
  - "Fill: [Current Section]" - Fills only the active section
  - Progress bar, stop functionality, error handling
- `src/lib/toast.ts` - **Toast notification system**
  - Success, error, info, warning toasts
  - Auto-dismiss with configurable duration
  - Action button support
- `src/lib/fill-orchestrator.ts` - **Multi-section fill orchestration**
  - Coordinates navigation and filling
  - Progress tracking and banner updates
  - Stop flag handling
- `src/lib/section-navigator.ts` - SPA navigation between form sections
  - Click section menu items to navigate
  - Wait for section content to load
  - Track visited sections

**Helpers:**
- `src/lib/sce-helper.ts` - Reusable form interaction methods
  - Fill methods for each section (Customer Info, Project Info, etc.)
  - Angular Material pattern (focus, click, input events)
  - Dropdown selection, file upload
- `src/lib/zillow-client.ts` - Fetches Zillow data via server API
- `src/lib/utils.ts` - Utility functions
- `src/lib/storage.ts` - Chrome storage operations
- `src/lib/selectors.ts` - Angular Material selectors
- `src/lib/error-handler.ts` - Extension error handling

**Configuration:**
- `options.html` - **980-line options page** (18 tabs) with all SCE1 defaults
- `popup.html` - Quick action popup with "Show Form Assistant" button
- `src/assets/banner.css` - Banner and toast styles with animations

**Tests:**
- `tests/integration.test.ts` - API integration tests

**Banner Usage:**
```javascript
// Auto-show banner when data queued
chrome.storage.local.set({ queuedProperty: propertyData });

// Manual trigger via extension icon
// User clicks "📋 Show Form Assistant" button in popup

// Message handlers in content.ts:
// - FILL_ALL_SECTIONS: Fill all 18 sections sequentially
// - FILL_CURRENT_SECTION: Fill only active section
// - STOP_FILLING: Stop current fill operation
// - SHOW_BANNER: Show banner manually
```

### Webapp

**Core:**
- `src/App.tsx` - React Router setup, main routes
- `src/contexts/AppContext.tsx` - Global state management
- `src/pages/` - Page components (Dashboard, Properties, Queue, Settings)

**Components:**
- `src/components/MapLayout.tsx` - **Leaflet map with custom drawing tools**
  - Rectangle/circle drawing (click-move-click pattern)
  - Address search with Nominatim API
  - Overpass API address fetching
  - Integrated with AddressSelectionManager and RouteProcessor
- `src/components/AddressSelectionManager.tsx` - **Multi-method address selection**
  - 5 selection methods: draw, range, import, pins, database
  - Manages local property state before API sync
- `src/components/RouteProcessor.tsx` - **SCE customer data extraction**
  - Sends batch processing requests to extension
  - Displays real-time progress bar
  - Refreshes properties when extraction completes
- `src/components/AddressRangeInput.tsx` - Sequential address generation
- `src/components/AddressImport.tsx` - CSV/TXT paste or file upload
- `src/components/PDFGenerator.tsx` - PDF generation with QR codes
- `src/components/PropertyCard.tsx` - Property display with delete button
- `src/components/PropertyList.tsx` - Property list with filtering
- `src/components/QueueStatus.tsx` - Real-time queue monitoring

**Utilities:**
- `src/lib/api.ts` - API client functions
- `src/lib/overpass.ts` - Overpass API integration (fixed bounding box format)
- `vite.config.ts` - Vite bundler configuration

### Mobile Web

- Similar structure to webapp
- Focused on field data entry, photo capture
- No map/PDF components (uses QR codes instead)

## Environment Configuration

**Development (Default):**
```bash
DATABASE_URL="file:./dev.sqlite"
BASE_URL="http://localhost:3333"
PORT=3333
NODE_ENV=development
```

**Zillow Scraping (Proxy):**
```bash
SCRAPER_API_KEY=fc3e6f236d5ccc030835c54fe6beeea1  # ScraperAPI key
```

**Production (Cloud):**
```bash
DATABASE_URL="postgresql://user:pass@host:5432/sce_db"
BASE_URL="https://your-domain.com"
NODE_ENV=production
```

**No code changes required** - just update `.env`!

### Development Ports

| Service | Port | URL |
|---------|------|-----|
| Cloud Server | 3333 | http://localhost:3333 |
| Webapp | 5173 | http://localhost:5173 |
| Mobile Web | 5174 | http://localhost:5174 |

### Extension Permissions

The extension requires these permissions in `manifest.json`:
- `activeTab` - Access current tab for scraping
- `scripting` - Inject content scripts dynamically
- `storage` - Store configuration in chrome.storage
- `tabs` - Open/manage tabs for queue processing
- Host permissions for SCE website and local API

## Property Workflow and Status Transitions

Properties progress through these statuses:

```
PENDING_SCRAPE → READY_FOR_FIELD → VISITED → READY_FOR_SUBMISSION → COMPLETE
                                      ↓
                                   FAILED
```

**Status Descriptions:**
- `PENDING_SCRAPE` - Initial state, awaiting extension scrape
- `READY_FOR_FIELD` - Customer data scraped, ready for field visit
- `VISITED` - Field data collected (age, notes, photos)
- `READY_FOR_SUBMISSION` - All data complete, ready to submit to SCE
- `COMPLETE` - Successfully submitted to SCE
- `FAILED` - Error occurred during workflow

**Queue Processing:**
- Extension polls `GET /api/queue/scrape` for next scrape job
- Extension polls `GET /api/queue/submit` for next submit job
- Jobs automatically filtered by status in API routes

## Complete Route Processing Workflow

The route processing system enables efficient customer data extraction from SCE:

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Address Selection (Webapp)                              │
├─────────────────────────────────────────────────────────────────┤
│ User selects addresses via one of 5 methods:                    │
│ - Draw shapes on map → Overpass API fetches addresses           │
│ - Address Range → Generates sequential addresses                 │
│ - Import List → Parses CSV/TXT                                  │
│ - Pin Mode → Click locations on map (reverse geocoded)         │
│ - From Database → Selects existing properties                   │
│ → Result: selectedProperties array populated                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Route Processing (Extension)                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Extract Customer Data" button                  │
│ 2. RouteProcessor sends PROCESS_ROUTE_BATCH message to extension│
│ 3. Extension opens 3 concurrent SCE tabs                       │
│ 4. Each tab: fills address → clicks Search → clicks Income      │
│ 5. Extracts customerName and customerPhone from page           │
│ 6. Captures screenshot (optional)                              │
│ 7. Closes tab, processes next batch of 3                        │
│ 8. Sends progress updates back to webapp                       │
│ → Result: Database updated with real customer data             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: PDF Generation (Webapp)                                 │
├─────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Generate Route PDF"                            │
│ 2. Properties optimized for route order (nearest neighbor)     │
│ 3. PDF generated with 3x3 grid pages:                           │
│    - Property address                                           │
│    - Real customer name and phone (from extraction)            │
│    - QR code for mobile access                                  │
│    - AGE field (for hand-writing)                              │
│    - NOTES field (for hand-writing)                            │
│ → Result: PDF saved to computer                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Field Work (Mobile App)                                 │
├─────────────────────────────────────────────────────────────────┤
│ 1. User scans QR code with mobile app                           │
│ 2. Property + customer info loads                              │
│ 3. User adds field notes and takes photos                      │
│ 4. Data uploaded to database                                   │
│ → Result: Property status → VISITED                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Submission (Extension)                                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. User opens SCE rebate website on desktop                     │
│ 2. Extension detects the page                                  │
│ 3. Auto-fills ALL sections with collected data                 │
│ 4. User reviews and clicks submit                              │
│ → Result: Property status → COMPLETE                           │
└─────────────────────────────────────────────────────────────────┘
```

**Key Integration Points:**

- **MapLayout ↔ AddressSelectionManager**: Props flow for properties/selectedProperties, setProperties callback for local additions
- **AddressSelectionManager ↔ AddressRangeInput/Import**: Callback handlers convert string addresses to Property objects with unique IDs
- **MapLayout ↔ RouteProcessor**: selectedProperties passed for extraction, onPropertiesUpdated callback triggers refresh after completion
- **Extension ↔ Webapp**: Chrome runtime messages (PROCESS_ROUTE_BATCH, ROUTE_PROGRESS, ROUTE_COMPLETE)

## Testing

### Cloud Server Tests
```bash
cd packages/cloud-server
npm test                       # Run Vitest tests
npm run test:watch             # Watch mode
```

### Extension Tests
```bash
cd packages/extension
npm test                       # Run integration tests
```

**Prerequisites:** Cloud server must be running on `:3333` for extension integration tests.

### Test File Locations
- `packages/extension/tests/integration.test.ts` - API integration tests
- `packages/webapp/tests/test-pdf-generation.ts` - PDF generation test script
- No tests exist yet for cloud-server (placeholder returns exit 0)

### End-to-End Testing

See `docs/TEST_REPORT.md` for comprehensive test results (all 18/18 tests passing).

## Documentation

**Setup & Configuration:**
- `docs/SETUP_COMPLETE.md` - Complete setup guide
- `docs/PROXY_SETUP_QUICK.md` - Quick proxy setup
- `docs/TEST_REPORT.md` - End-to-end test results

**Architectural:**
- `README.md` - Project overview and quick start
- `STACK.md` - Technology stack
- `SCE-v1-WISDOM.md` - Lessons learned from SCE v1

**Archived:**
- `docs/archive/` - Historical documentation (migration plans, etc.)

## Deployment

### Local → Cloud Migration

**Step 1: Set up database**
```bash
# DigitalOcean Managed PostgreSQL
# Get connection string
```

**Step 2: Update environment**
```bash
# .env
DATABASE_URL="postgresql://..."
BASE_URL="https://..."
NODE_ENV=production
SCRAPER_API_KEY="your-api-key"
```

**Step 3: Deploy server**
```bash
npm run build
# Use Railway/Render/DigitalOcean App Platform
```

**Step 4: Update extension**
- Redistribute extension with new `BASE_URL` hardcoded or in config
- Or use extension config to let users set their server URL

## Troubleshooting

### "Module not found" errors
```bash
# From root
npm install
```

### Prisma client not generated
```bash
cd packages/cloud-server
npm run db:generate
```

### Extension not connecting to server
1. Check server is running: `curl http://localhost:3333/api/health`
2. Check CORS origins in `.env`
3. Check extension background console for errors

### Database locked error
```bash
# Stop all processes
lsof -i :3333 | awk 'NR>1 {print $2}' | xargs kill

# Delete journal files
rm packages/cloud-server/*.sqlite-journal
```

### Zillow scraping returning 403
- ScraperAPI automatically retries with proxy
- Check API key is valid: `SCRAPER_API_KEY` in `.env`
- Free tier: 1000 requests/month

### Map drawing not working
- Use click-move-click pattern, not drag
- First click sets start point
- Second click completes shape
- Check browser console for errors

## Important Gotchas

### Prisma Client Generation
After any schema change, you **must** regenerate the Prisma client:
```bash
cd packages/cloud-server
npm run db:generate    # Generates @prisma/client
```
If you don't, TypeScript types will be out of sync with the database.

### Extension Build Process
The build process copies non-TS files **then** compiles TypeScript:
```bash
npm run build:copy     # Copy manifest.json, HTML, icons, lib/*.js
npm run build:compile  # Compile src/*.ts → dist/*.js
```
**Common mistake:** Editing files in `dist/` instead of `src/`. Always edit source files.

### Overpass API Bounding Box Format
When fetching addresses within bounds, the format is:
```typescript
// CORRECT: (south, west, north, east)
const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

// WRONG: (west, south, east, north)
// This causes 400 Bad Request
```

### CORS Configuration
When adding new client origins, update `.env`:
```bash
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174,chrome-extension://*"
```
The wildcard `chrome-extension://*` matches all extension instances.

### Queue Polling Interval
Extension background script polls every 5 seconds by default. This is configured in:
- `packages/extension/src/background.ts` - `pollInterval` in config
- Can be overridden via extension options page

### Status String Validation
SQLite doesn't support enums, so status values are **strings**. Valid values:
```typescript
type PropertyStatus =
  | 'PENDING_SCRAPE'
  | 'READY_FOR_FIELD'
  | 'VISITED'
  | 'READY_FOR_SUBMISSION'
  | 'COMPLETE'
  | 'FAILED';
```
No database-level validation - validate in application code.

### File Upload Limits
- Default max size: 10MB (configurable via `MAX_FILE_SIZE` env var)
- Files stored in `packages/cloud-server/uploads/`
- Multer middleware handles multipart form data
- Document records track metadata (type, filename, size)

### Route Ordering
Specific routes must come before parameterized routes:
```typescript
// CORRECT ORDER:
propertyRoutes.delete('/all', ...);        // Must be first
propertyRoutes.delete('/:id', ...);        // Then parameterized

// WRONG ORDER:
propertyRoutes.delete('/:id', ...);        // Matches "all" as an ID!
propertyRoutes.delete('/all', ...);        // Never reached
```

## Codebase Organization

```
SCE2/
├── docs/                          # Documentation
│   ├── SETUP_COMPLETE.md          # Complete setup guide
│   ├── PROXY_SETUP_QUICK.md       # Proxy setup quick reference
│   ├── TEST_REPORT.md             # End-to-end test results
│   ├── RECOMMENDED-MCP-AND-SKILLS.md
│   └── archive/                   # Historical docs
├── packages/
│   ├── cloud-server/              # Express API
│   │   ├── src/
│   │   │   ├── lib/               # Zillow scraping, database, etc.
│   │   │   ├── routes/            # API endpoints
│   │   │   └── middleware/        # Error handling, etc.
│   │   ├── prisma/                # Database schema
│   │   └── uploads/               # File uploads (gitignored)
│   ├── extension/                 # Chrome extension
│   │   ├── src/                   # TypeScript source
│   │   │   ├── lib/
│   │   │   │   ├── sce1-logic.ts  # SCE1 compatibility
│   │   │   │   ├── zillow-client.ts
│   │   │   │   └── ...
│   │   │   ├── background.ts
│   │   │   └── content.ts
│   │   ├── dist/                  # Build output (gitignored)
│   │   ├── options.html           # 980-line config page
│   │   ├── manifest.json
│   │   └── icons/
│   ├── webapp/                    # React desktop app
│   │   ├── src/
│   │   │   ├── components/        # UI Components
│   │   │   │   ├── MapLayout.tsx              # Leaflet map with drawing
│   │   │   │   ├── AddressSelectionManager.tsx # Multi-method selection
│   │   │   │   ├── RouteProcessor.tsx         # SCE data extraction
│   │   │   │   ├── AddressRangeInput.tsx      # Sequential addresses
│   │   │   │   ├── AddressImport.tsx          # CSV/TXT import
│   │   │   │   ├── PDFGenerator.tsx           # PDF with QR codes
│   │   │   │   ├── PropertyCard.tsx           # Property display
│   │   │   │   ├── PropertyList.tsx           # Property list
│   │   │   │   └── QueueStatus.tsx            # Queue monitoring
│   │   │   ├── pages/             # Dashboard, Properties, etc.
│   │   │   └── lib/               # API client, Overpass, etc.
│   │   └── tests/                 # PDF generation test
│   └── mobile-web/                # React mobile app
├── .gitignore                     # Excludes dist/, *.pdf, etc.
├── CLAUDE.md                      # This file
├── README.md                      # Project overview
└── package.json                   # Root workspace config
```

## File Structure Best Practices

**Source vs Build Artifacts:**
- Source code goes in `src/` directories
- Build output goes in `dist/` (gitignored)
- Source maps (`*.js.map`) only in `dist/`, never in `src/`
- Type declarations (`*.d.ts`) only in `dist/`

**Documentation:**
- Active docs at root: `README.md`, `CLAUDE.md`
- Detailed docs in `docs/`
- Historical docs in `docs/archive/`
- Test outputs excluded by `.gitignore` (`*.pdf`)

**Test Files:**
- Co-located with source code: `__tests__/` or `tests/` directories
- Integration tests in package root: `packages/extension/tests/`
- E2E tests in separate `tests/` directory if complex
