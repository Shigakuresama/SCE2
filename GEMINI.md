# SCE2 - Cloud-Hybrid Rebate Automation Platform

## Project Overview

SCE2 is a unified cloud-hybrid platform for automating Southern California Edison (SCE) rebate applications. It replaces disjointed v1 tools with a modern, integrated system featuring a centralized database, REST API, mobile support, and automated workflows.

### Architecture

*   **Monorepo Structure:** Managed via npm workspaces.
*   **Backend:** `packages/cloud-server` (Node.js/Express, Prisma ORM).
*   **Database:** SQLite (dev) / PostgreSQL (prod). Source of truth schema in `packages/cloud-server/prisma/schema.prisma`.
*   **Frontend (Desktop):** `packages/webapp` (React, Vite) - For route planning, map selection, and PDF generation.
*   **Frontend (Mobile):** `packages/mobile-web` (React, Vite) - For field data collection and photo capture.
*   **Extension:** `packages/extension` (Chrome MV3) - Handles SCE website scraping, form filling, and queue processing.

## Key Directories

*   `packages/cloud-server`: API server and database management.
*   `packages/extension`: Chrome extension source code.
*   `packages/webapp`: Desktop web application.
*   `packages/mobile-web`: Mobile web application.
*   `docs/`: Comprehensive project documentation.

## Development Workflow

### Building and Running

**Root Level (Parallel Execution):**
```bash
npm install                 # Install dependencies for all workspaces
npm run dev                 # Start all services (Cloud, Web, Mobile)
npm run build               # Build all packages
npm run test                # Run tests across workspaces
```

**Cloud Server (`packages/cloud-server`):**
```bash
npm run dev:cloud           # Start with hot reload
npm run db:generate         # Generate Prisma client
npm run db:push             # Update dev database schema
npm run db:studio           # Open Prisma Studio GUI
```

**Extension (`packages/extension`):**
```bash
npm run build               # Build for Chrome (load 'dist' folder)
npm run dev                 # Watch mode
npm run package             # Create distributable ZIP
```

**Webapp & Mobile (`packages/webapp`, `packages/mobile-web`):**
```bash
npm run dev                 # Start Vite dev server
npm run build               # Build for production
npm run preview             # Preview build
```

### Database Management

*   Schema location: `packages/cloud-server/prisma/schema.prisma`
*   After schema changes:
    1.  `npm run db:push` (Updates SQLite dev DB)
    2.  `npm run db:generate` (Updates TypeScript client)

## Key Features & patterns

*   **Address Selection:** Multi-method support (Map Draw, Range, Import, Pin, Database).
*   **Zillow Scraping:** Server-side proxy (ScraperAPI) + Client-side fallback.
*   **SCE Integration:** Extension automates form filling and customer data extraction via `packages/extension/src/lib/sce1-logic.ts`.
*   **Queue System:** Automated scrape/submit jobs polled by the extension.
*   **PDF Generation:** Server-side generation with QR codes for mobile field access.

## Environment Configuration

*   **Template:** `.env.example`
*   **Key Variables:**
    *   `DATABASE_URL`: `file:./dev.sqlite` (dev) or Postgres connection string (prod).
    *   `BASE_URL`: API base URL (default: `http://localhost:3333`).
    *   `SCRAPER_API_KEY`: Required for Zillow proxy scraping.
    *   `ALLOWED_ORIGINS`: CORS configuration.

## Testing

*   **End-to-End:** See `docs/TEST_REPORT.md`.
*   **Integration:** `packages/extension/tests/integration.test.ts`.
*   **Unit/Component:** Run via `npm test` in respective package directories.
