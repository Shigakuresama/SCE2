# SCE2 Developer Contribution Guide

This guide covers everything developers need to know to contribute to SCE2, including development workflow, available scripts, environment setup, and testing procedures.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Development Workflow](#development-workflow)
3. [Available Scripts](#available-scripts)
4. [Environment Setup](#environment-setup)
5. [Testing Procedures](#testing-procedures)
6. [Code Style](#code-style)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- **Node.js:** >= 20.0.0
- **npm:** >= 10.0.0
- **Git:** Latest stable version
- **Chrome/Chromium:** For extension development

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/Shigakuresama/SCE2.git
cd SCE2

# Install all dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your configuration

# Initialize the database
cd packages/cloud-server
npm run db:push
npm run db:generate

# Return to root
cd ../..

# Start all services in development mode
npm run dev
```

**Services will start on:**
- Cloud Server: http://localhost:3333
- Webapp: http://localhost:5173
- Mobile Web: http://localhost:5174

---

## Development Workflow

### 1. Feature Development

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Start development servers
npm run dev

# Make your changes...
# The workspace uses hot module reloading for faster development
```

### 2. Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build:cloud    # Cloud server only
npm run build:web      # Webapp only
npm run build:mobile   # Mobile web only
```

### 3. Testing

```bash
# Run all tests
npm test

# Run tests for specific package
cd packages/extension
npm test              # Integration tests
npm run test:e2e      # End-to-end tests
```

### 4. Code Quality

```bash
# Lint all code
npm run lint

# Format all code
npm run format
```

### 5. Committing

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/your-feature-name
```

### 6. Creating Pull Requests

1. Push your branch to GitHub
2. Create a pull request targeting `main`
3. Ensure CI/CD checks pass
4. Request review from team members
5. Address review feedback

---

## Available Scripts

### Root Workspace Scripts

Run these from the project root directory.

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Start all dev servers (cloud, web, mobile) | `npm run dev` |
| `npm run dev:cloud` | Start cloud server only | `npm run dev:cloud` |
| `npm run dev:web` | Start webapp only | `npm run dev:web` |
| `npm run dev:mobile` | Start mobile web only | `npm run dev:mobile` |
| `npm run build` | Build all packages | `npm run build` |
| `npm run build:cloud` | Build cloud server only | `npm run build:cloud` |
| `npm run build:web` | Build webapp only | `npm run build:web` |
| `npm run build:mobile` | Build mobile web only | `npm run build:mobile` |
| `npm test` | Run all tests | `npm test` |
| `npm run lint` | Lint all code | `npm run lint` |
| `npm run format` | Format all code with Prettier | `npm run format` |

### Cloud Server Scripts

Run these from `packages/cloud-server/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Start server with hot reload (tsx watch) | `npm run dev` |
| `npm run build` | Compile TypeScript to JavaScript | `npm run build` |
| `npm run build:prod` | Production build with Prisma client generation | `npm run build:prod` |
| `npm run start` | Run compiled server | `npm run start` |
| `npm run db:generate` | Generate Prisma client from schema | `npm run db:generate` |
| `npm run db:push` | Push schema changes to database (dev) | `npm run db:push` |
| `npm run db:migrate` | Create and apply migration (prod) | `npm run db:migrate` |
| `npm run db:studio` | Open Prisma Studio (database GUI) | `npm run db:studio` |
| `npm run db:seed` | Seed database with initial data | `npm run db:seed` |
| `npm test` | Run tests (not yet implemented) | `npm test` |

### Extension Scripts

Run these from `packages/extension/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Watch mode for TypeScript compilation | `npm run dev` |
| `npm run build` | Build extension (copy assets + compile) | `npm run build` |
| `npm run build:copy` | Copy non-TypeScript files to dist/ | `npm run build:copy` |
| `npm run build:compile` | Compile TypeScript to JavaScript | `npm run build:compile` |
| `npm run package` | Build and create ZIP for distribution | `npm run package` |
| `npm run clean` | Remove dist/ directory | `npm run clean` |
| `npm test` | Run integration tests with Vitest | `npm test` |
| `npm run test:e2e` | Run Playwright end-to-end tests | `npm run test:e2e` |
| `npm run test:e2e:ui` | Run E2E tests with UI mode | `npm run test:e2e:ui` |
| `npm run test:e2e:debug` | Run E2E tests in debug mode | `npm run test:e2e:debug` |

### Webapp Scripts

Run these from `packages/webapp/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Start Vite dev server | `npm run dev` |
| `npm run build` | Compile TypeScript and build for production | `npm run build` |
| `npm run preview` | Preview production build locally | `npm run preview` |

### Mobile Web Scripts

Run these from `packages/mobile-web/`.

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Start Vite dev server | `npm run dev` |
| `npm run build` | Compile TypeScript and build for production | `npm run build` |
| `npm run preview` | Preview production build locally | `npm run preview` |

---

## Environment Setup

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Root directory
cp .env.example .env

# Cloud server
cp packages/cloud-server/.env.example packages/cloud-server/.env

# Webapp (if needed)
cp packages/webapp/.env.example packages/webapp/.env

# Mobile web (if needed)
cp packages/mobile-web/.env.example packages/mobile-web/.env
```

### Required Environment Variables

#### Root `.env`

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | 3333 | 3333 |
| `NODE_ENV` | Environment | development | development |
| `DATABASE_URL` | Database connection string | file:./dev.sqlite |postgresql://... |
| `BASE_URL` | Server base URL | http://localhost:3333 | https://sce2.example.com |
| `MAX_FILE_SIZE` | Max upload size (bytes) | 10485760 | 10485760 |
| `UPLOAD_DIR` | Upload directory | ./uploads | ./uploads |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost URLs | http://localhost:5173,... |
| `SCE_BASE_URL` | SCE website URL | https://sce.dsmcentral.com | https://sce.dsmcentral.com |
| `SCRAPE_DELAY_MS` | Delay between scrapes | 2000 | 2000 |
| `MAX_CONCURRENT_SCRAPES` | Max concurrent scrapes | 3 | 3 |

#### Cloud Server `.env`

| Variable | Description | Required? |
|----------|-------------|-----------|
| `SCRAPER_API_KEY` | ScraperAPI key for Zillow scraping | Optional* |
| `ZENROWS_API_KEY` | ZenRows key for Zillow scraping | Optional* |
| `RAPIDAPI_KEY` | RapidAPI key for Zillow scraping | Optional* |

*At least one proxy service is recommended for reliable Zillow scraping.

### Database Setup

#### Local Development (SQLite)

```bash
cd packages/cloud-server

# Push schema to database
npm run db:push

# Generate Prisma client
npm run db:generate
```

#### Production (PostgreSQL)

```bash
# Set DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@host:5432/sce_db?schema=public"

# Create and apply migration
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### Loading the Extension

1. Build the extension:
   ```bash
   cd packages/extension
   npm run build
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked"

5. Select `packages/extension/dist/`

6. Extension is now loaded and ready for testing

---

## Testing Procedures

### Test Structure

```
packages/
├── cloud-server/
│   └── (tests not yet implemented)
├── extension/
│   ├── tests/
│   │   ├── integration.test.ts    # API integration tests
│   │   └── e2e/
│   │       ├── fixtures.ts        # Test fixtures
│   │       └── scenarios/         # E2E test scenarios
│   └── tests/e2e/helpers/         # Test helpers
└── webapp/
    └── tests/                     # Manual test scripts
```

### Running Tests

#### Integration Tests (Extension)

```bash
cd packages/extension

# Ensure cloud server is running first
cd ../cloud-server
npm run dev

# In another terminal
cd ../extension
npm test
```

#### End-to-End Tests (Extension)

```bash
cd packages/extension

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Manual Testing

#### Webapp

1. Start webapp: `npm run dev:web`
2. Navigate to http://localhost:5173
3. Test map drawing, address selection, property management

#### Extension

1. Load extension in Chrome (see above)
2. Navigate to https://sce.dsmcentral.com
3. Test banner functionality, form filling

#### Mobile Web

1. Start mobile web: `npm run dev:mobile`
2. Navigate to http://localhost:5174
3. Test QR scanning, field data entry, photo capture

### Test Coverage

Currently, only the extension has automated tests. Test coverage:

- **Extension:** Integration tests (11 tests passing)
- **Cloud Server:** Not yet implemented
- **Webapp:** Manual test scripts only
- **Mobile Web:** No automated tests

---

## Code Style

### TypeScript Configuration

All packages use TypeScript 5.3.3 with strict mode enabled.

### Prettier Configuration

Prettier is configured at the root level. Format code before committing:

```bash
npm run format
```

### ESLint Configuration

ESLint is configured at the root level. Lint code before committing:

```bash
npm run lint
```

### Conventional Commits

Use conventional commit messages:

- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation changes
- `test:` Test changes
- `chore:` Maintenance tasks
- `style:` Code style changes (formatting, etc.)

Examples:
```bash
git commit -m "feat: add property deletion API endpoint"
git commit -m "fix: correct map drawing event handlers"
git commit -m "refactor: simplify form filling logic"
```

---

## Troubleshooting

### Common Issues

#### "Cannot find module" errors

```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Prisma client not generated

```bash
cd packages/cloud-server
npm run db:generate
```

#### Database locked error

```bash
# Stop all server processes
lsof -i :3333 | awk 'NR>1 {print $2}' | xargs kill

# Delete journal files
rm packages/cloud-server/*.sqlite-journal
```

#### Extension not connecting to server

1. Check server is running: `curl http://localhost:3333/api/health`
2. Check CORS origins in `.env`
3. Check extension background console for errors

#### Port already in use

```bash
# Find process using port 3333
lsof -i :3333

# Kill the process
kill -9 <PID>
```

#### Zillow scraping returning 403

- ScraperAPI automatically retries with proxy
- Check API key is valid: `SCRAPER_API_KEY` in `.env`
- Free tier: 1000 requests/month

#### Map drawing not working

- Use click-move-click pattern, not drag
- First click sets start point
- Second click completes shape
- Check browser console for errors

### Getting Help

- Check existing documentation: `docs/`
- Check GitHub issues: https://github.com/Shigakuresama/SCE2/issues
- Review CLAUDE.md for project-specific guidance

---

## Development Tips

### Hot Module Reloading

- **Cloud Server:** Uses `tsx watch` for automatic reload on changes
- **Webapp/Mobile:** Vite provides instant hot module replacement
- **Extension:** Run `npm run dev` for automatic rebuilds

### Database Schema Changes

1. Edit `packages/cloud-server/prisma/schema.prisma`
2. Run `npm run db:push` (dev) or `npm run db:migrate` (prod)
3. Run `npm run db:generate` to regenerate Prisma client

### Extension Development

- Source files in `src/` compile to `dist/`
- Chrome loads from `dist/`, not `src/`
- Always rebuild after changes: `npm run build`
- Test with `test-banner.html` for quick iteration

### Debugging

- **Cloud Server:** Logs go to console and `logs/combined.log`
- **Extension:**
  - Background: `chrome://extensions/` → "Service worker" link
  - Content script: Right-click SCE website → "Inspect"
- **Webapp:** Browser DevTools (F12)

---

## Additional Resources

- **Project Overview:** `README.md`
- **Architecture Guide:** `CLAUDE.md`
- **Setup Guide:** `docs/SETUP_COMPLETE.md`
- **Test Report:** `docs/TEST_REPORT.md`
- **Deployment Guide:** `docs/RENDER_DEPLOYMENT.md`

---

**Happy coding!** 🚀
