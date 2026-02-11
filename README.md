# SCE2 - Cloud-Hybrid Rebate Automation Platform

<div align="center">

![SCE2 Logo](docs/assets/sce2-logo.png)

**A complete rewrite of the SCE Rebate Automation System**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-20.x-green)](https://nodejs.org/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [User Guide](#user-guide)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

**SCE2** transforms the fragmented SCE v1 tools into a unified cloud-hybrid platform for automating Southern California Edison (SCE) rebate applications. The system streamlines the entire workflow from property selection to rebate submission.

### What's New in SCE2

| Aspect | SCE (v1) | SCE2 |
|--------|----------|------|
| **State Management** | Local files, extension storage | Centralized SQLite/PostgreSQL database |
| **API** | Proxy server on :3000 (CORS bypass) | Full REST API on :3333 |
| **Mobile** | None | Mobile web interface with photo capture |
| **Queue System** | Manual | Automated scrape/submit queues |
| **Zillow Scraping** | Extension-based direct scraping | Server-side with ScraperAPI proxy |
| **Address Selection** | Manual entry only | 5 selection methods (draw, range, import, pins, database) |
| **Data Extraction** | Manual copy-paste | Automated SCE website scraping |
| **PDF Generation** | Client-side only | Server-side with QR codes |
| **Deployment** | Local only | Local-first, one-config cloud migration |

### Key Benefits

- **Unified Database** - All properties, documents, and routes in one place
- **Cloud-Ready** - Start local, migrate to cloud with one config change
- **Mobile Support** - In-field data collection with photo capture
- **Queue-Based Processing** - Automated scrape/submit workflows
- **Modern Tech Stack** - TypeScript, Prisma, React, Vite, Chrome MV3

---

## Features

### 1. Multi-Method Address Selection

<div align="center">

```
┌────────────────────────────────────────────────────────────────┐
│                    ADDRESS SELECTION METHODS                    │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   ✏️ DRAW    │  │  🔢 RANGE    │  │  📍 PIN      │       │
│  │              │  │              │  │              │       │
│  │ Draw shapes  │  │ 100-200      │  │ Click map    │       │
│  │ on map to    │  │ Main St      │  │ to add       │       │
│  │ select area  │  │ Generates    │  │ individual   │       │
│  │              │  │ sequential   │  │ locations    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │   📋 IMPORT  │  │  🗄️ DATABASE  │                          │
│  │              │  │              │                          │
│  │ Paste or     │  │ Select from  │                          │
│  │ upload CSV/  │  │ existing     │                          │
│  │ TXT file     │  │ properties   │                          │
│  └──────────────┘  └──────────────┘                          │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

</div>

### 2. Automated Customer Data Extraction

<div align="center">

```
┌────────────────────────────────────────────────────────────────┐
│              ROUTE PROCESSING WORKFLOW                          │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Select addresses (any method above)                          │
│         ↓                                                         │
│  2. Click "Extract Customer Data"                               │
│         ↓                                                         │
│  3. Extension opens SCE website in 3 concurrent tabs           │
│         ↓                                                         │
│  4. For each address:                                            │
│     - Fill Street Address + ZIP Code                           │
│     - Click "Search" button                                    │
│     - Click "Income" to reveal customer info                    │
│     - Extract customer name and phone                          │
│     - Capture screenshot                                       │
│     - Close tab and process next                               │
│         ↓                                                         │
│  5. Database updated with REAL customer data                   │
│         ↓                                                         │
│  6. Properties refresh showing extracted info                   │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

</div>

### 3. PDF Route Sheets with QR Codes

<div align="center">

```
┌────────────────────────────────────────────────────────────────┐
│                     PDF GENERATION                              │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  3x3 GRID PAGE - 9 Properties per Page                 │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │ [Address]        [Address]        [Address]           │    │
│  │ Customer: Name   Customer: Name   Customer: Name       │    │
│  │ Phone: 555-1234  Phone: 555-5678  Phone: 555-9012    │    │
│  │ [QR Code]        [QR Code]        [QR Code]            │    │
│  │ AGE: ___        AGE: ___        AGE: ___              │    │
│  │ NOTES:          NOTES:          NOTES:                │    │
│  │                                                          │    │
│  │ [Address]        [Address]        [Address]           │    │
│  │ ...                      ...           ...               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Features:                                                       │
│  • Optimal route ordering (nearest neighbor)                     │
│  • QR codes for mobile access                                    │
│  • Real customer data from extraction                            │
│  • AGE and NOTES fields for hand-writing                         │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

</div>

### 4. Mobile Field Data Collection

- Scan QR code from PDF to load property
- View customer info and property details
- Add field notes (age, observations)
- Capture and upload photos
- Submit data to database

### 5. Chrome Extension Integration

- **Queue Polling** - Automatically processes scrape/submit jobs
- **SCE1 Compatibility** - Complete default values library
- **Auto-Fill** - Fills all SCE form sections automatically
- **Progress Tracking** - Real-time status updates in webapp

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Extension      │  │     Webapp       │  │  Mobile Web      │  │
│  │   Chrome MV3     │  │  React Desktop   │  │  React Field     │  │
│  │                  │  │                  │  │                  │  │
│  │ • Queue Polling  │  │ • Map Selection  │  │ • QR Scan        │  │
│  │ • SCE Scraping   │  │ • PDF Generation │  │ • Photo Upload   │  │
│  │ • Auto-Fill      │  │ • Route Planner  │  │ • Field Notes    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼────────────────────┼─────────────────────┼──────────────┘
            │                    │                     │
            │     REST API       │                     │
            └────────────────────┴─────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloud Server (:3333)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌─────────┐  │
│  │   Express  │   │   Prisma   │   │  SQLite/   │   │  Winston │  │
│  │     API    │   │     ORM    │   │ PostgreSQL │   │  Logger  │  │
│  └────────────┘   └────────────┘   └────────────┘   └─────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
SCE2/
├── packages/
│   ├── cloud-server/          # Express API + Prisma ORM
│   │   ├── src/
│   │   │   ├── routes/        # API endpoints
│   │   │   ├── lib/           # Zillow scraper, database, etc.
│   │   │   └── middleware/     # Error handling, auth
│   │   ├── prisma/            # Database schema
│   │   └── uploads/           # File uploads (gitignored)
│   │
│   ├── extension/             # Chrome MV3 Extension
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── sce1-logic.ts    # SCE1 compatibility
│   │   │   │   ├── zillow-client.ts # Zillow API client
│   │   │   │   └── route-processor.ts # Batch processing
│   │   │   ├── background.ts   # Service worker
│   │   │   └── content.ts      # SCE website interaction
│   │   └── manifest.json       # Extension config
│   │
│   ├── webapp/                # Desktop React App
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── MapLayout.tsx            # Leaflet map
│   │   │   │   ├── AddressSelectionManager.tsx
│   │   │   │   ├── RouteProcessor.tsx
│   │   │   │   ├── AddressRangeInput.tsx
│   │   │   │   ├── AddressImport.tsx
│   │   │   │   └── PDFGenerator.tsx
│   │   │   ├── pages/         # Dashboard, Properties, etc.
│   │   │   └── lib/           # API client, Overpass, etc.
│   │
│   └── mobile-web/            # Mobile React App
│       ├── src/
│       │   ├── components/    # Mobile-optimized UI
│       │   └── pages/         # Field data entry
│
├── docs/                      # Documentation
├── .env.example               # Environment template
├── package.json               # Root workspace config
├── CLAUDE.md                  # Claude Code guide
└── README.md                  # This file
```

---

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Chrome/Edge browser (for extension)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/SCE2.git
cd SCE2

# Install all dependencies
npm install
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env (minimum required):
PORT=3333
DATABASE_URL="file:./dev.sqlite"
BASE_URL="http://localhost:3333"
NODE_ENV=development
```

### Database Initialization

```bash
cd packages/cloud-server

# Generate Prisma client
npm run db:generate

# Create/update database schema
npm run db:push

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

### Start All Services

```bash
# From project root - starts all services in parallel
npm run dev

# Or start individually:
npm run dev:cloud    # Cloud server on http://localhost:3333
npm run dev:web      # Webapp on http://localhost:5173
npm run dev:mobile   # Mobile on http://localhost:5174
```

### Load Chrome Extension

```bash
# Build the extension
cd packages/extension
npm run build

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode" (toggle in top right)
# 3. Click "Load unpacked"
# 4. Navigate to and select packages/extension/dist
```

### Verify Installation

1. **Cloud Server**: Visit http://localhost:3333/api/health
2. **Webapp**: Visit http://localhost:5173
3. **Extension**: Click extension icon, should see popup
4. **Database**: Run `npm run db:studio` in cloud-server directory

---

## User Guide

### 1. Address Selection

The webapp provides 5 different methods to select addresses for route processing:

#### Method 1: Draw on Map

1. Navigate to the **Map** page
2. Click **⬜ Rectangle** or **⭕ Circle** button
3. Click once to set the start point/center
4. Move mouse to define the area
5. Click again to complete the shape
6. Addresses are automatically fetched via Overpass API

```
Example: Draw a rectangle around a neighborhood to get all addresses
```

#### Method 2: Address Range

1. Click **🔢 Address Range** button
2. Fill in the form:
   - **Street Name**: e.g., "W Martha Ln"
   - **ZIP Code**: e.g., "92706"
   - **Start Number**: e.g., "1900"
   - **End Number**: e.g., "2000"
3. Click **Generate Addresses**
4. All sequential addresses are created

```
Example: Generates 1900, 1901, 1902...2000 W Martha Ln, 92706
```

#### Method 3: Pin Addresses

1. Click **📍 Pin Addresses** button
2. Click anywhere on the map to drop a pin
3. The address is reverse-geocoded automatically
4. Continue clicking to add more pins
5. Click **Clear Pins** to remove all pins

```
Example: Useful for irregular property distributions
```

#### Method 4: Import List

1. Click **📋 Import List** button
2. Either paste addresses directly OR upload a file
3. Format: One address per line or comma-separated
4. Click **Import** to process

```
Example:
1909 W Martha Ln, Santa Ana, CA 92706
1910 W Martha Ln, Santa Ana, CA 92706
1911 W Martha Ln, Santa Ana, CA 92706
```

#### Method 5: From Database

1. Click **🗄️ From Database** button
2. Search by address or customer name
3. Click on a property to select it
4. Selected properties appear in the selection list

### 2. Extract Customer Data from SCE

Once addresses are selected:

1. The **Route Processor** panel appears below the map
2. Click the green **Extract Customer Data** button
3. The extension will:
   - Open SCE website in 3 tabs at once
   - Fill in address and ZIP for each
   - Click Search, then click Income
   - Extract customer name and phone number
   - Close tabs and process next batch
4. Progress bar shows real-time status
5. When complete, properties are updated with customer data

```
Processing 15/25 addresses...
┌─────────────────────────────────────┐
│ Extracting: 123 Main St             │
████████████████░░░░░░░░░░  60%      │
└─────────────────────────────────────┘
```

### 3. Plan Route + Generate PDF (Desktop or Phone)

You now have two valid paths:

#### Path A: Deployed route planning from phone/browser (no extension required)

1. Open the deployed webapp at `/mobile-pack` (example: `https://sce2-webap.onrender.com/mobile-pack`)
2. Select the houses for today’s run
3. Enter optional start latitude/longitude
4. Tap **Plan Route** to persist optimized property order
5. Tap **Generate PDF** to download the fillable QR route sheet

#### Path B: Desktop route workflow with extension extraction first

1. Use the Route Processor to run extraction on selected properties
2. Generate PDF from the selected properties

PDF output includes:
- 3x3 grid layout (9 properties per page)
- QR codes for mobile access
- Customer name and phone (when available)
- Fillable AGE field
- Fillable NOTES field
- Fillable checkbox/phone correction fields

Extension-only boundary:
- SCE extraction automation and SCE final submission automation are still desktop extension features.

### 4. Field Work (Mobile)

1. Open mobile app on phone
2. Scan QR code from printed PDF
3. Property loads with customer info
4. Add field data:
   - Customer age (from door conversation)
   - Notes (property condition, interest level)
   - Utility bill photo upload (BILL)
   - Customer signature upload (SIGNATURE)
5. Tap **Complete Visit** (enabled only after BILL + SIGNATURE are uploaded)

### 5. Submit Rebate Application

1. Back at the office, open the webapp **Field Ops** page (`/field-ops`)
2. Filter for missing artifacts (Bill, Signature, Age, Notes) and resolve gaps
3. Navigate to SCE rebate website
4. Extension detects the page
5. Click extension icon or use auto-fill
6. All sections are populated with section-aware rules:
   - Customer Information
   - Property Information
   - Project Information
   - Equipment Details
   - Trade Ally Information
   - Appointments
   - Homeowner auto-fill and special-case field logic
7. Review and click Submit

---

## API Reference

### Base URL
```
http://localhost:3333/api
```

### Properties

#### List Properties
```http
GET /api/properties?status=PENDING_SCRAPE&zipCode=92706
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "addressFull": "1909 W Martha Ln, Santa Ana, CA 92706",
      "customerName": "John Smith",
      "customerPhone": "555-1234",
      "status": "PENDING_SCRAPE",
      "latitude": 33.8361,
      "longitude": -117.8897
    }
  ]
}
```

#### Create Property
```http
POST /api/properties
Content-Type: application/json

{
  "addressFull": "1909 W Martha Ln, Santa Ana, CA 92706",
  "streetNumber": "1909",
  "streetName": "W Martha Ln",
  "zipCode": "92706",
  "city": "Santa Ana",
  "state": "CA"
}
```

#### Update Property
```http
PATCH /api/properties/:id
Content-Type: application/json

{
  "customerName": "John Smith",
  "customerPhone": "555-1234",
  "status": "READY_FOR_FIELD"
}
```

#### Delete Property
```http
DELETE /api/properties/:id
```

#### Batch Create
```http
POST /api/properties/batch
Content-Type: application/json

{
  "properties": [
    {"addressFull": "1909 W Martha Ln...", ...},
    {"addressFull": "1910 W Martha Ln...", ...}
  ]
}
```

### Queue

#### Get Next Scrape Job
```http
GET /api/queue/scrape
```

#### Submit Scraped Data
```http
POST /api/queue/:id/scraped
Content-Type: application/json

{
  "customerName": "John Smith",
  "customerPhone": "555-1234",
  "sceCaseId": "CASE12345"
}
```

#### Get Next Submit Job
```http
GET /api/queue/submit
```

#### Mark Complete
```http
POST /api/queue/:id/complete
```

### Documents

#### Upload Document
```http
POST /api/documents
Content-Type: multipart/form-data

file: <binary>
docType: BILL
propertyId: 123
```

#### Get Document
```http
GET /api/documents/:id
```

#### Delete Document
```http
DELETE /api/documents/:id
```

---

## Configuration

### Environment Variables

#### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Cloud server port | `3333` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Database connection | `file:./dev.sqlite` |
| `BASE_URL` | API base URL | `http://localhost:3333` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:5173,http://localhost:5174,chrome-extension://*` |

#### Zillow Scraping

| Variable | Description | Required |
|----------|-------------|----------|
| `SCRAPER_API_KEY` | ScraperAPI key for proxy scraping | Yes |
| `ZILLOWS_WEB_SERVICE_ID` | Zillow API key (optional) | No |

#### File Upload

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10MB) |
| `UPLOAD_DIR` | Upload directory | `./uploads` |

### Cloud Migration

To migrate from local to cloud:

```bash
# 1. Set up cloud database (e.g., DigitalOcean Managed PostgreSQL)
# Get connection string

# 2. Update .env
DATABASE_URL="postgresql://user:pass@host:5432/sce_db"
BASE_URL="https://your-domain.com"
NODE_ENV=production

# 3. Run migrations
cd packages/cloud-server
npm run db:migrate

# 4. Build and deploy
npm run build
# Deploy to your hosting platform
```

---

## Development

### Project Scripts

```bash
# Root level
npm install           # Install all dependencies
npm run dev           # Start all services
npm run build         # Build all packages
npm run test          # Run all tests

# Cloud Server
npm run dev:cloud     # Start with hot reload
npm run build         # Compile TypeScript
npm run start         # Run compiled version
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:migrate    # Create migration
npm run db:studio     # Open Prisma Studio

# Extension
npm run build         # Compile and copy assets
npm run dev           # Watch mode (TypeScript only)
npm run package       # Build and create ZIP

# Webapp/Mobile
npm run dev           # Start Vite dev server
npm run build         # Production build
npm run preview       # Preview production build
```

### Architecture Patterns

#### Property Status Workflow

```
PENDING_SCRAPE → READY_FOR_FIELD → VISITED → READY_FOR_SUBMISSION → COMPLETE
                                      ↓
                                   FAILED
```

#### State Management

- **Webapp**: React Context API + hooks
- **Extension**: Chrome storage + runtime messages
- **Database**: Prisma ORM with SQLite/PostgreSQL

#### Message Passing (Extension)

```typescript
// Background → Content
chrome.tabs.sendMessage(tabId, { action: 'SCRAPE', data });

// Content → Background
chrome.runtime.sendMessage({ action: 'JOB_COMPLETE', data });

// Async response pattern
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  performScrape().then(sendResponse);
  return true; // Keep channel open
});
```

### Testing

```bash
# Run all tests
npm test

# Specific package
npm test --workspace=packages/cloud-server
npm test --workspace=packages/extension

# Watch mode
npm run test:watch
```

---

## Deployment

### Build for Production

```bash
# Build all packages
npm run build

# Individual packages
cd packages/cloud-server && npm run build
cd packages/extension && npm run build
cd packages/webapp && npm run build
cd packages/mobile-web && npm run build
```

### Hosting Options

#### Cloud Server

Recommended platforms:
- **Railway** - Simple deployment with database
- **Render** - Free tier available
- **DigitalOcean App Platform** - Full control

#### Webapp/Mobile

Can be deployed to:
- **Vercel** - Zero-config React deployment
- **Netlify** - Free hosting with CI/CD
- **GitHub Pages** - Static hosting

#### Extension

Distribute via:
- Chrome Web Store (requires publisher account)
- Sideloading (load unpacked for development)

---

## Contributing

Contributions are welcome! Please see `CONTRIBUTING.md` for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Add comments for complex logic
- Update documentation for user-facing changes

---

## License

MIT License - see LICENSE file for details

---

## Support

For issues, questions, or contributions:

- **GitHub Issues**: https://github.com/yourusername/SCE2/issues
- **Discussions**: https://github.com/yourusername/SCE2/discussions
- **Email**: scm.energysavings@gmail.com

---

## Acknowledgments

- **SCE (v1)** - Original system that inspired this rewrite
- **Southern California Edison** - Rebate program provider
- **OpenStreetMap/Nominatim** - Geocoding services
- **ScraperAPI** - Proxy scraping services
