# SCE2 - Cloud-Hybrid Rebate Automation Platform

**SCE2** is a complete rewrite of the SCE Rebate Automation System, transforming fragmented tools into a unified cloud-hybrid platform.

## 🎯 What's New in SCE2

### From Fragmented → Unified
- **Before**: 5 separate tools (extension, proxy, MCP, Playwright, webapp) with no shared state
- **After**: 1 integrated platform with centralized database, API, and cloud sync

### Key Improvements
1. **Centralized Database** - All properties, documents, and routes in one place
2. **Cloud-Ready Architecture** - Start local, migrate to cloud with one config change
3. **Mobile Field Support** - In-field data collection with photo capture
4. **Queue-Based Processing** - Automated scrape/submit workflows
5. **Modern Tech Stack** - TypeScript, Prisma, React, Vite

## 📦 Project Structure

```
SCE2/
├── packages/
│   ├── cloud-server/      # Express API + Prisma + SQLite/PostgreSQL
│   ├── extension/         # Chrome MV3 extension (scraper + submitter)
│   ├── webapp/            # Desktop React app (route planning, PDF)
│   └── mobile-web/        # Mobile React app (field data collection)
├── .env.example           # Environment template
├── package.json           # Root workspace config
└── README.md              # This file
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Initialize Database
```bash
cd packages/cloud-server
npm run db:push      # Create SQLite database
npm run db:studio    # (Optional) Open Prisma Studio
```

### 4. Start Development Servers
```bash
# From root - starts all services
npm run dev

# Or individually:
npm run dev:cloud    # Cloud server on :3333
npm run dev:web      # Webapp on :5173
npm run dev:mobile   # Mobile on :5174
```

### 5. Load Extension
```bash
# Build extension
cd packages/extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select packages/extension/dist
```

## 🏗️ Architecture

### System Diagram
```
┌──────────────────────────────────────────────────┐
│                   CLIENTS                        │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │Extension │  │ Webapp   │  │ Mobile   │     │
│  │(Desktop) │  │(Desktop) │  │(Field)   │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
└───────┼────────────┼─────────────┼─────────────┘
        │            │             │
        └────────────┴─────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │   Cloud Server (:3333)  │
        │   - Express API         │
        │   - Prisma ORM          │
        │   - SQLite/Postgres     │
        └────────────────────────┘
```

### Data Flow

**Scrape Workflow:**
```
1. Webapp: Generate address range → POST /api/properties/batch
2. Extension: Poll GET /api/queue/scrape → Get property
3. Extension: Open SCE form, scrape customer data
4. Extension: POST /api/queue/:id/scraped → Save data
5. Cloud: Update property status → READY_FOR_FIELD
```

**Field Workflow:**
```
1. Webapp: Generate PDF with QR codes → Print
2. Mobile: Scan QR → GET /mobile/:id → View property
3. Mobile: Enter age, notes, photos → POST /api/properties/:id/field-data
4. Cloud: Update property status → VISITED
```

**Submit Workflow:**
```
1. Extension: Poll GET /api/queue/submit → Get visited property
2. Extension: Open SCE form, fill all data, upload docs
3. Extension: POST /api/queue/:id/complete → Mark complete
4. Cloud: Update property status → COMPLETE
```

## 🔧 Configuration

### Environment Variables

**Core Settings:**
```bash
PORT=3333                    # Cloud server port
NODE_ENV=development         # development | production
DATABASE_URL="file:./dev.sqlite"  # SQLite (local) or PostgreSQL (cloud)
BASE_URL="http://localhost:3333"  # API base URL (for QR codes)
```

**Cloud Migration:**
```bash
# Change ONE variable to go from local → cloud:
DATABASE_URL="postgresql://user:pass@host:5432/sce_db"
BASE_URL="https://your-domain.com"
```

## 📚 API Documentation

### Properties
- `GET /api/properties` - List properties (filter by status, zip)
- `GET /api/properties/:id` - Get single property
- `POST /api/properties` - Create property
- `POST /api/properties/batch` - Create multiple properties
- `PATCH /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### Routes
- `GET /api/routes` - List routes
- `GET /api/routes/:id` - Get single route
- `POST /api/routes` - Create route
- `PATCH /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route

### Documents
- `GET /api/documents/:id` - Get document info
- `POST /api/documents` - Upload document
- `POST /api/documents/batch` - Upload multiple documents
- `DELETE /api/documents/:id` - Delete document

### Queue
- `GET /api/queue/scrape` - Get next scrape job
- `POST /api/queue/:id/scraped` - Save scraped data
- `GET /api/queue/submit` - Get next submit job
- `POST /api/queue/:id/complete` - Mark job complete

## 🧪 Testing

```bash
# All tests
npm test

# Specific package
npm test --workspace=packages/cloud-server
```

## 🚢 Deployment

### Cloud Migration Checklist

1. **Set up cloud database** (DigitalOcean Managed PostgreSQL)
2. **Update `.env`:**
   ```bash
   DATABASE_URL="postgresql://..."
   BASE_URL="https://your-domain.com"
   NODE_ENV=production
   ```
3. **Run migrations:** `npm run db:migrate`
4. **Build:** `npm run build`
5. **Deploy:** Use your preferred hosting (Railway, Render, DigitalOcean App Platform)

## 🤝 Contributing

See `CONTRIBUTING.md` for guidelines.

## 📄 License

MIT

## 🔗 Related Projects

- **SCE (v1)** - Original fragmented system at `/home/sergio/Projects/SCE`
