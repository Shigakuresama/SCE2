# SCE2 Cloud Server

Express.js API server with Prisma ORM for SCE2 platform.

## Features

- RESTful API for properties, routes, documents
- Queue management for scrape/submit workflows
- File upload system (photos, PDFs)
- Winston logging
- SQLite (dev) / PostgreSQL (prod) with one-config switch

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/properties` - List properties
- `POST /api/properties/batch` - Batch import properties
- `GET /api/queue/scrape` - Get next scrape job
- `POST /api/queue/:id/scraped` - Save scraped data
- `GET /api/queue/submit` - Get next submit job
- `POST /api/uploads/property/:id` - Upload document
- `GET /api/routes` - List routes

## Database

Open Prisma Studio:
```bash
npm run db:studio
```
