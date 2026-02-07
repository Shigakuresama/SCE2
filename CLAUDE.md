# Claude Code Guide for SCE2

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SCE2 is a **cloud-hybrid rebate automation platform** that unifies the fragmented SCE v1 tools into a cohesive system with centralized database, API, and mobile support.

### Architecture Components

1. **Cloud Server** (`packages/cloud-server/`) - Express API with Prisma ORM
2. **Extension** (`packages/extension/`) - Chrome MV3 extension (scraper + submitter)
3. **Webapp** (`packages/webapp/`) - React desktop app (route planning, PDF generation)
4. **Mobile Web** (`packages/mobile-web/`) - React mobile app (field data collection)

### Key Differences from SCE (v1)

| Aspect | SCE (v1) | SCE2 |
|--------|----------|------|
| **State Management** | Local files, extension storage | Centralized SQLite/PostgreSQL database |
| **API** | Proxy server on :3000 (CORS bypass) | Full REST API on :3333 |
| **Mobile** | None | Mobile web interface with photo capture |
| **Queue System** | Manual | Automated scrape/submit queues |
| **Deployment** | Local only | Local-first, one-config cloud migration |
| **PDF** | Client-side jsPDF | Server-side + QR code generation |

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

### 3. Extension Development

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
  // Fill forms, extract data
  return { success: true, data: { customerName, customerPhone } };
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

### 4. Debugging

**Cloud Server:**
- Logs go to `logs/combined.log` and `logs/error.log`
- Use `console.log()` - Winston captures everything
- Database queries logged in development mode

**Extension:**
- Chrome extension background: `chrome://extensions/` → "Service worker" link
- Content script: Right-click SCE website → "Inspect"
- Check `chrome.storage.sync` for config: DevTools → Application → Storage

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Extension not loading | Check manifest.json syntax, run `npm run build` |
| Database locked | Stop all server processes, delete `*.sqlite-journal` files |
| CORS errors | Add origin to `ALLOWED_ORIGINS` in `.env` |
| Queue not processing | Check extension background script console for errors |

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

- `src/index.ts` - Server entry point, middleware setup
- `src/lib/database.ts` - Prisma singleton, connection management
- `src/lib/logger.ts` - Winston logging configuration
- `src/lib/config.ts` - Environment variable config with defaults
- `prisma/schema.prisma` - Database schema (source of truth!)
- `src/routes/` - API route handlers
  - `index.ts` - Route registration and health check
  - `properties.ts` - Property CRUD operations
  - `queue.ts` - Scrape/submit queue endpoints
  - `uploads.ts` - Document upload handling
  - `routes.ts` - Route management (planning groups)
- `src/middleware/errorHandler.ts` - Global error handling, async wrapper

### Extension

- `src/background.ts` - Service worker, queue polling, orchestration
- `src/content.ts` - SCE website interaction (form filling, data extraction)
- `src/lib/sce-helper.ts` - Reusable form interaction methods
- `src/lib/utils.ts` - Utility functions
- `manifest.json` - Extension configuration (not in src/)
- `tests/integration.test.ts` - API integration tests

### Webapp

- `src/App.tsx` - React Router setup, main routes
- `src/contexts/AppContext.tsx` - Global state management
- `src/pages/` - Page components (Dashboard, Properties, Queue, Settings)
- `src/components/` - Reusable components
  - `MapLayout.tsx` - Leaflet map for address selection
  - `PDFGenerator.tsx` - PDF generation with QR codes
  - `QueueStatus.tsx` - Real-time queue monitoring
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
```

**Production (Cloud):**
```bash
DATABASE_URL="postgresql://user:pass@host:5432/sce_db"
BASE_URL="https://your-domain.com"
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
- No tests exist yet for cloud-server (placeholder returns exit 0)

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
1. Check server is running: `curl http://localhost:3333/health`
2. Check CORS origins in `.env`
3. Check extension background console for errors

### Database locked error
```bash
# Stop all processes
lsof -i :3333 | awk 'NR>1 {print $2}' | xargs kill

# Delete journal files
rm packages/cloud-server/*.sqlite-journal
```

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
