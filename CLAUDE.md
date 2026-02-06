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

## Key Files Reference

### Cloud Server

- `src/index.ts` - Server entry point, middleware setup
- `src/lib/database.ts` - Prisma singleton, connection management
- `src/lib/logger.ts` - Winston logging configuration
- `prisma/schema.prisma` - Database schema (source of truth!)
- `src/routes/` - API route handlers

### Extension

- `src/background.ts` - Service worker, queue polling, orchestration
- `src/content.ts` - SCE website interaction (form filling, data extraction)
- `src/lib/sce-helper.ts` - Reusable form interaction methods
- `manifest.json` - Extension configuration (not in src/)

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

## Testing

```bash
# Unit tests (Vitest)
npm test --workspace=packages/cloud-server

# Integration tests (Playwright)
cd packages/cloud-server
npm run test:e2e
```

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
