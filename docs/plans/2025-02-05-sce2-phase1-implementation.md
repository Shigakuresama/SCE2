# SCE2 Phase 1: Cloud Server & Database Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core cloud server with Prisma ORM, SQLite database, and REST API endpoints to replace the fragmented SCE v1 architecture.

**Architecture:** Express.js server on port 3333 with Prisma ORM managing SQLite database. API serves property data, handles file uploads, and provides queue management for scrape/submit workflows. Database models: Property (with scraped/field data), Document (file metadata), Route (address collections).

**Tech Stack:** Node.js 20+, Express 4.18, Prisma 5.9, SQLite 3, Winston 3.11, Multer 1.4, TypeScript 5.3

**Reference Docs:**
- Database design: `/home/sergio/Projects/SCE2/Plan.md` lines 23-50
- API endpoints: `/home/sergio/Projects/SCE2/Plan.md` lines 53-113
- Wisdom from SCE v1: `/home/sergio/Projects/SCE2/SCE-v1-WISDOM.md`

---

## Task 1: Initialize Prisma Schema

**Files:**
- Create: `packages/cloud-server/prisma/schema.prisma`
- Create: `packages/cloud-server/prisma/migrations/README.md`

**Step 1: Create Prisma schema file**

Create `packages/cloud-server/prisma/schema.prisma`:

```prisma
// This is your Prisma schema file
// Learn more: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Property model - tracks each address through the workflow
model Property {
  id            Int       @id @default(autoincrement())
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Address fields (from Overpass/SCE website)
  addressFull   String
  streetNumber  String
  streetName    String
  zipCode       String
  city          String?
  state         String?
  latitude      Float?
  longitude     Float?

  // Scraped data (from extension - Phase 1)
  customerName  String?
  customerPhone String?
  customerEmail String?

  // Field data (from mobile - Phase 2)
  customerAge   Int?
  fieldNotes    String?

  // Submission tracking
  sceCaseId     String?   // SCE's case ID after submission

  // Status workflow
  status        PropertyStatus @default(PENDING_SCRAPE)

  // Relations
  documents     Document[]
  route         Route?    @relation(fields: [routeId], references: [id])
  routeId       Int?

  @@index([status])
  @@index([routeId])
}

model Document {
  id          Int      @id @default(autoincrement())
  createdAt   DateTime @default(now())

  propertyId  Int
  property    Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  docType     DocumentType
  fileName    String
  filePath    String
  fileSize    Int
  mimeType    String

  @@index([propertyId])
}

model Route {
  id          Int       @id @default(autoincrement())
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  name        String    // User-defined route name
  description String?

  properties  Property[]

  @@index([createdAt])
}

enum PropertyStatus {
  PENDING_SCRAPE      // Initial state - queued for scraping
  READY_FOR_FIELD     // Successfully scraped, ready for mobile entry
  VISITED             // Field data collected via mobile
  READY_FOR_SUBMISSION // Ready for extension to submit to SCE
  COMPLETE            // Successfully submitted to SCE
  FAILED              // Scraping or submission failed
}

enum DocumentType {
  BILL         // Utility bill
  UNIT         // Equipment photo
  SIGNATURE    // Customer signature
  W9           // Contractor W9 (if applicable)
  OTHER        // Catch-all
}
```

**Step 2: Create migrations README**

Create `packages/cloud-server/prisma/migrations/README.md`:

```markdown
# Prisma Migrations

This directory contains database migrations.

## Development

To apply schema changes:
```bash
cd packages/cloud-server
npm run db:push  # Skip migration files, update dev database directly
```

## Production

To create migration files:
```bash
npm run db:migrate  # Creates migration file in this folder
npm run db:migrate  # Applies migration
```

## Current Schema

- Property: Tracks addresses through scrape → field → submit workflow
- Document: Stores metadata for uploaded files (photos, signatures, bills)
- Route: Groups properties for batch processing
```

**Step 3: Install Prisma dependencies**

Run:
```bash
cd packages/cloud-server
npm install prisma @prisma/client --save-exact
npm install -D tsx @types/node
```

Expected output: Packages installed, `node_modules/prisma` and `node_modules/@prisma/client` created.

**Step 4: Initialize Prisma**

Run:
```bash
npx prisma init
```

Expected output: Creates `prisma/schema.prisma` (we'll overwrite it) and `.env` file.

**Step 5: Generate Prisma Client**

Run:
```bash
npm run db:generate
```

Expected output:
```
✔ Generated Prisma Client (4.15.0) to node_modules/@prisma/client
```

**Step 6: Push schema to database**

Run:
```bash
npm run db:push
```

Expected output:
```
✔ Loaded env from .env
✔ schema.prisma is up to date
✔ Generated Prisma Client
```

Verify `dev.sqlite` file created in `packages/cloud-server/`.

**Step 7: Commit**

```bash
git add packages/cloud-server/prisma/ packages/cloud-server/package.json
git commit -m "feat(cloud-server): initialize Prisma schema with Property, Document, Route models"
```

---

## Task 2: Database Connection & Logger Setup

**Files:**
- Create: `packages/cloud-server/src/lib/database.ts`
- Create: `packages/cloud-server/src/lib/logger.ts`
- Create: `packages/cloud-server/src/lib/config.ts`

**Step 1: Create config loader**

Create `packages/cloud-server/src/lib/config.ts`:

```typescript
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3333'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.sqlite',

  // API
  baseUrl: process.env.BASE_URL || 'http://localhost:3333',

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:5174',
    'chrome-extension://*',
  ],

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  uploadDir: process.env.UPLOAD_DIR || './uploads',

  // SCE Website
  sceBaseUrl: process.env.SCE_BASE_URL || 'https://sce.dsmcentral.com',

  // Scraping
  scrapeDelayMs: parseInt(process.env.SCRAPE_DELAY_MS || '2000'),
  maxConcurrentScrapes: parseInt(process.env.MAX_CONCURRENT_SCRAPES || '3'),
} as const;

export type Config = typeof config;
```

**Step 2: Create Winston logger**

Create `packages/cloud-server/src/lib/logger.ts`:

```typescript
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (config.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

export default logger;
```

**Step 3: Create Prisma database singleton**

Create `packages/cloud-server/src/lib/database.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// PrismaClient singleton pattern
// Prevents multiple instances in development (hot reload)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log queries in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e: any) => {
    logger.debug('Query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

// Initialize database connection
export async function initDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

export default prisma;
```

**Step 4: Install dependencies**

Run:
```bash
npm install winston dotenv
npm install -D @types/winston
```

**Step 5: Test database connection**

Create test file `packages/cloud-server/test-db.ts`:

```typescript
import { initDatabase, prisma } from './src/lib/database.js';
import { logger } from './src/lib/logger.js';

async function test() {
  try {
    await initDatabase();

    // Test query
    const count = await prisma.property.count();
    logger.info(`Properties in database: ${count}`);

    await prisma.$disconnect();
  } catch (error) {
    logger.error('Test failed', error);
    process.exit(1);
  }
}

test();
```

Run test:
```bash
npx tsx test-db.ts
```

Expected output:
```
12:34:56 [info]: Database connected successfully
12:34:56 [info]: Properties in database: 0
```

**Step 6: Clean up test file**

```bash
rm test-db.ts
```

**Step 7: Commit**

```bash
git add packages/cloud-server/src/lib/ packages/cloud-server/package.json packages/cloud-server/tsconfig.json
git commit -m "feat(cloud-server): add database singleton, Winston logger, and config loader"
```

---

## Task 3: Error Handling Middleware

**Files:**
- Create: `packages/cloud-server/src/middleware/errorHandler.ts`
- Create: `packages/cloud-server/src/types/errors.ts`

**Step 1: Define custom error types**

Create `packages/cloud-server/src/types/errors.ts`:

```typescript
// Base error class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error (400)
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

// Not found error (404)
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(404, message);
  }
}

// Conflict error (409)
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

// Unprocessable entity error (422)
export class UnprocessableEntityError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}
```

**Step 2: Create error handler middleware**

Create `packages/cloud-server/src/middleware/errorHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';
import { AppError } from '../types/errors.js';

// Async handler wrapper - catches errors in async route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error response formatter
function formatError(error: Error) {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        statusCode: error.statusCode,
      },
    };
  }

  // Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return {
      success: false,
      error: {
        message: 'Database operation failed',
        statusCode: 500,
        details: error.message,
      },
    };
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        statusCode: 400,
        details: error.message,
      },
    };
  }

  // Unknown errors
  return {
    success: false,
    error: {
      message: 'Internal server error',
      statusCode: 500,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        stack: error.stack,
      }),
    },
  };
}

// Global error handler middleware
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Format and send response
  const formatted = formatError(error);
  const statusCode = formatted.error.statusCode || 500;

  res.status(statusCode).json(formatted);
}

// 404 handler
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
    },
  });
}
```

**Step 3: Create validation middleware**

Create `packages/cloud-server/src/middleware/validation.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types/errors.js';

// Validate required fields in request body
export function validateRequired(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter((field) => !(field in req.body));

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required fields: ${missing.join(', ')}`
      );
    }

    next();
  };
}

// Validate property status
export function validatePropertyStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { status } = req.body;

  const validStatuses = [
    'PENDING_SCRAPE',
    'READY_FOR_FIELD',
    'VISITED',
    'READY_FOR_SUBMISSION',
    'COMPLETE',
    'FAILED',
  ];

  if (status && !validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status: ${status}`);
  }

  next();
}
```

**Step 4: Commit**

```bash
git add packages/cloud-server/src/middleware/ packages/cloud-server/src/types/
git commit -m "feat(cloud-server): add error handling middleware with custom error types"
```

---

## Task 4: Property API Routes

**Files:**
- Create: `packages/cloud-server/src/routes/properties.ts`
- Create: `packages/cloud-server/src/routes/index.ts`

**Step 1: Create properties routes**

Create `packages/cloud-server/src/routes/properties.ts`:

```typescript
import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

export const propertyRoutes = Router();

// GET /api/properties - List all properties with optional filters
propertyRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, routeId, limit = 50, offset = 0 } = req.query;

    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (routeId) {
      where.routeId = parseInt(routeId as string);
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'asc' },
        include: {
          documents: true,
        },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      success: true,
      data: properties,
      meta: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
    });
  })
);

// GET /api/properties/:id - Get single property by ID
propertyRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { documents: true },
    });

    if (!property) {
      throw new NotFoundError('Property', req.params.id);
    }

    res.json({ success: true, data: property });
  })
);

// POST /api/properties - Create single property
propertyRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      addressFull,
      streetNumber,
      streetName,
      zipCode,
      city,
      state,
      latitude,
      longitude,
      routeId,
    } = req.body;

    if (!addressFull || !streetNumber || !streetName || !zipCode) {
      throw new ValidationError(
        'Missing required fields: addressFull, streetNumber, streetName, zipCode'
      );
    }

    const property = await prisma.property.create({
      data: {
        addressFull,
        streetNumber,
        streetName,
        zipCode,
        city,
        state,
        latitude,
        longitude,
        routeId,
      },
    });

    res.status(201).json({ success: true, data: property });
  })
);

// POST /api/properties/batch - Create multiple properties (batch import)
propertyRoutes.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new ValidationError('addresses must be a non-empty array');
    }

    // Validate each address
    for (const addr of addresses) {
      if (!addr.addressFull || !addr.streetNumber || !addr.streetName || !addr.zipCode) {
        throw new ValidationError(
          'Each address must have addressFull, streetNumber, streetName, zipCode'
        );
      }
    }

    // Bulk create
    const properties = await prisma.property.createMany({
      data: addresses.map((addr: any) => ({
        addressFull: addr.addressFull,
        streetNumber: addr.streetNumber,
        streetName: addr.streetName,
        zipCode: addr.zipCode,
        city: addr.city,
        state: addr.state,
        latitude: addr.latitude,
        longitude: addr.longitude,
        routeId: addr.routeId,
      })),
    });

    // Fetch created properties to return them
    const createdProperties = await prisma.property.findMany({
      where: {
        addressFull: { in: addresses.map((a: any) => a.addressFull) },
      },
      orderBy: { createdAt: 'desc' },
      take: addresses.length,
    });

    res.status(201).json({
      success: true,
      data: createdProperties,
      count: properties.count,
    });
  })
);

// PATCH /api/properties/:id - Update property
propertyRoutes.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: updates,
    });

    res.json({ success: true, data: property });
  })
);

// DELETE /api/properties/:id - Delete property
propertyRoutes.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.property.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ success: true, message: 'Property deleted' });
  })
);
```

**Step 2: Create routes index**

Create `packages/cloud-server/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import { propertyRoutes } from './properties.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SCE2 API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
apiRouter.use('/properties', propertyRoutes);

// TODO: Add more route modules
// apiRouter.use('/routes', routeRoutes);
// apiRouter.use('/queue', queueRoutes);
// apiRouter.use('/documents', documentRoutes);
```

**Step 3: Update server index to use routes**

Modify `packages/cloud-server/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, closeDatabase } from './lib/database.js';
import { logger } from './lib/logger.js';
import { config } from './lib/config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================
// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', apiRouter);

// ============================================
// ERROR HANDLING
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
async function startServer() {
  try {
    await initDatabase();

    app.listen(config.port, () => {
      logger.info(`🚀 SCE2 Cloud Server running on port ${config.port}`);
      logger.info(`📍 Base URL: ${config.baseUrl}`);
      logger.info(`🔧 Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  shutdown();
});

startServer();

export { app };
```

**Step 4: Test the API**

Start server:
```bash
npm run dev
```

Test health endpoint:
```bash
curl http://localhost:3333/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "SCE2 API is running",
  "timestamp": "2025-02-05T..."
}
```

Test creating a property:
```bash
curl -X POST http://localhost:3333/api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "addressFull": "1909 W Martha Ln, Santa Ana, CA 92706",
    "streetNumber": "1909",
    "streetName": "W Martha Ln",
    "zipCode": "92706",
    "city": "Santa Ana",
    "state": "CA"
  }'
```

**Step 5: Commit**

```bash
git add packages/cloud-server/src/routes/ packages/cloud-server/src/index.ts
git commit -m "feat(cloud-server): add property CRUD API routes with validation"
```

---

## Task 5: Queue Management Routes (Scrape & Submit)

**Files:**
- Create: `packages/cloud-server/src/routes/queue.ts`

**Step 1: Create queue routes**

Create `packages/cloud-server/src/routes/queue.ts`:

```typescript
import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const queueRoutes = Router();

// GET /api/queue/scrape - Get next property to scrape
queueRoutes.get(
  '/scrape',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findFirst({
      where: {
        status: 'PENDING_SCRAPE',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!property) {
      return res.json({
        success: true,
        data: null,
        message: 'No properties pending scrape',
      });
    }

    res.json({ success: true, data: property });
  })
);

// POST /api/queue/:id/scraped - Save scraped data
queueRoutes.post(
  '/:id/scraped',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { customerName, customerPhone, customerEmail } = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: {
        customerName,
        customerPhone,
        customerEmail,
        status: 'READY_FOR_FIELD',
      },
    });

    res.json({ success: true, data: property });
  })
);

// GET /api/queue/submit - Get property ready for submission
queueRoutes.get(
  '/submit',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findFirst({
      where: {
        status: 'VISITED',
      },
      include: {
        documents: true,
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    if (!property) {
      return res.json({
        success: true,
        data: null,
        message: 'No properties ready for submission',
      });
    }

    res.json({ success: true, data: property });
  })
);

// POST /api/queue/:id/complete - Mark property as complete
queueRoutes.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { sceCaseId } = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: {
        sceCaseId,
        status: 'COMPLETE',
      },
    });

    res.json({ success: true, data: property });
  })
);

// POST /api/queue/:id/fail - Mark property as failed
queueRoutes.post(
  '/:id/fail',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const property = await prisma.property.update({
      where: { id: parseInt(id) },
      data: {
        status: 'FAILED',
      },
    });

    // Log failure reason
    logger.warn(`Property ${id} marked as failed`, { reason });

    res.json({ success: true, data: property });
  })
);
```

**Step 2: Register queue routes**

Update `packages/cloud-server/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import { propertyRoutes } from './properties.js';
import { queueRoutes } from './queue.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SCE2 API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
apiRouter.use('/properties', propertyRoutes);
apiRouter.use('/queue', queueRoutes);
```

**Step 3: Test queue endpoints**

Create test property:
```bash
curl -X POST http://localhost:3333/api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "addressFull": "1911 W Martha Ln, Santa Ana, CA 92706",
    "streetNumber": "1911",
    "streetName": "W Martha Ln",
    "zipCode": "92706"
  }'
```

Get scrape job:
```bash
curl http://localhost:3333/api/queue/scrape
```

Mark as scraped:
```bash
curl -X POST http://localhost:3333/api/queue/1/scraped \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John Doe",
    "customerPhone": "555-0123"
  }'
```

**Step 4: Commit**

```bash
git add packages/cloud-server/src/routes/queue.ts packages/cloud-server/src/routes/index.ts
git commit -m "feat(cloud-server): add queue management routes for scrape and submit workflows"
```

---

## Task 6: File Upload System (Multer)

**Files:**
- Create: `packages/cloud-server/src/routes/uploads.ts`
- Create: `packages/cloud-server/src/middleware/upload.ts`
- Modify: `packages/cloud-server/src/routes/index.ts`

**Step 1: Install multer dependencies**

```bash
npm install multer @types/multer
```

**Step 2: Create upload middleware**

Create `packages/cloud-server/src/middleware/upload.ts`:

```typescript
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../lib/config.js';

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: propertyId-timestamp-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// File filter - only accept images and PDFs
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and PDF allowed.`));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize,
  },
});

// Upload handlers for different use cases
export const uploadSingle = upload.single('file');
export const uploadMultiple = upload.array('files', 10);
export const uploadFields = upload.fields([
  { name: 'bill', maxCount: 1 },
  { name: 'unit', maxCount: 5 },
  { name: 'signature', maxCount: 1 },
  { name: 'w9', maxCount: 1 },
]);
```

**Step 3: Create upload routes**

Create `packages/cloud-server/src/routes/uploads.ts`:

```typescript
import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadSingle, uploadMultiple } from '../middleware/upload.js';
import { DocumentType } from '@prisma/client';
import { NotFoundError } from '../types/errors.js';
import path from 'path';

export const uploadRoutes = Router();

// POST /api/uploads/property/:id - Upload document for property
uploadRoutes.post(
  '/property/:id',
  uploadSingle,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { docType = 'OTHER' } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: parseInt(id) },
    });

    if (!property) {
      // Clean up uploaded file
      // TODO: Implement file cleanup
      throw new NotFoundError('Property', id);
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        propertyId: parseInt(id),
        docType: docType as DocumentType,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  })
);

// POST /api/uploads/property/:id/multiple - Upload multiple documents
uploadRoutes.post(
  '/property/:id/multiple',
  uploadMultiple,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No files uploaded' },
      });
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: parseInt(id) },
    });

    if (!property) {
      throw new NotFoundError('Property', id);
    }

    // Create document records
    const documents = await prisma.document.createMany({
      data: files.map((file) => ({
        propertyId: parseInt(id),
        docType: 'OTHER' as DocumentType,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
      })),
    });

    res.status(201).json({
      success: true,
      message: `Uploaded ${documents.count} documents`,
      count: documents.count,
    });
  })
);

// GET /api/uploads/:id - Get document by ID
uploadRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { property: true },
    });

    if (!document) {
      throw new NotFoundError('Document', req.params.id);
    }

    res.json({ success: true, data: document });
  })
);

// DELETE /api/uploads/:id - Delete document
uploadRoutes.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: parseInt(id) },
    });

    if (!document) {
      throw new NotFoundError('Document', id);
    }

    // Delete file from filesystem
    // TODO: Implement file deletion

    // Delete database record
    await prisma.document.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'Document deleted',
    });
  })
);
```

**Step 4: Register upload routes**

Update `packages/cloud-server/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import { propertyRoutes } from './properties.js';
import { queueRoutes } from './queue.js';
import { uploadRoutes } from './uploads.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SCE2 API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
apiRouter.use('/properties', propertyRoutes);
apiRouter.use('/queue', queueRoutes);
apiRouter.use('/uploads', uploadRoutes);
```

**Step 5: Test file upload**

```bash
curl -X POST http://localhost:3333/api/uploads/property/1 \
  -F "file=@/path/to/image.jpg" \
  -F "docType=BILL"
```

**Step 6: Commit**

```bash
git add packages/cloud-server/src/routes/uploads.ts packages/cloud-server/src/middleware/upload.ts packages/cloud-server/src/routes/index.ts
git commit -m "feat(cloud-server): add file upload system with Multer"
```

---

## Task 7: Route Management API

**Files:**
- Create: `packages/cloud-server/src/routes/routes.ts`

**Step 1: Create routes API**

Create `packages/cloud-server/src/routes/routes.ts`:

```typescript
import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

export const routeRoutes = Router();

// GET /api/routes - List all routes
routeRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const routes = await prisma.route.findMany({
      include: {
        properties: {
          select: {
            id: true,
            addressFull: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: routes });
  })
);

// GET /api/routes/:id - Get single route with properties
routeRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const route = await prisma.route.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        properties: {
          include: { documents: true },
        },
      },
    });

    if (!route) {
      throw new NotFoundError('Route', req.params.id);
    }

    res.json({ success: true, data: route });
  })
);

// POST /api/routes - Create new route
routeRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, description, propertyIds } = req.body;

    if (!name) {
      throw new ValidationError('Missing required field: name');
    }

    const route = await prisma.route.create({
      data: {
        name,
        description,
        properties: propertyIds
          ? {
              connect: propertyIds.map((id: number) => ({ id })),
            }
          : undefined,
      },
      include: { properties: true },
    });

    res.status(201).json({ success: true, data: route });
  })
);

// POST /api/routes/:id/properties - Add properties to route
routeRoutes.post(
  '/:id/properties',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { propertyIds } = req.body;

    if (!Array.isArray(propertyIds)) {
      throw new ValidationError('propertyIds must be an array');
    }

    const route = await prisma.route.update({
      where: { id: parseInt(id) },
      data: {
        properties: {
          connect: propertyIds.map((pid: number) => ({ id: pid })),
        },
      },
      include: { properties: true },
    });

    res.json({ success: true, data: route });
  })
);

// DELETE /api/routes/:id - Delete route
routeRoutes.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.route.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ success: true, message: 'Route deleted' });
  })
);
```

**Step 2: Register routes**

Update `packages/cloud-server/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import { propertyRoutes } from './properties.js';
import { queueRoutes } from './queue.js';
import { uploadRoutes } from './uploads.js';
import { routeRoutes } from './routes.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SCE2 API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
apiRouter.use('/properties', propertyRoutes);
apiRouter.use('/queue', queueRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/routes', routeRoutes);
```

**Step 3: Commit**

```bash
git add packages/cloud-server/src/routes/routes.ts packages/cloud-server/src/routes/index.ts
git commit -m "feat(cloud-server): add route management API endpoints"
```

---

## Task 8: Package Scripts & Final Setup

**Files:**
- Modify: `packages/cloud-server/package.json`

**Step 1: Update package.json scripts**

Update `packages/cloud-server/package.json`:

```json
{
  "name": "@sce2/cloud-server",
  "version": "1.0.0",
  "description": "SCE2 Cloud Server - Express API with Prisma ORM",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts",
    "test": "echo \"No tests yet\" && exit 0"
  },
  "dependencies": {
    "@prisma/client": "^5.9.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.11.5",
    "prisma": "^5.9.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create TypeScript config**

Create `packages/cloud-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Update .gitignore**

Update `packages/cloud-server/.gitignore`:

```
# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local
.env.*.local

# Database
*.sqlite
*.sqlite-journal
prisma/*.db

# Logs
logs/
*.log

# Uploads
uploads/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
```

**Step 4: Create README**

Create `packages/cloud-server/README.md`:

```markdown
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
```

**Step 5: Final commit**

```bash
git add packages/cloud-server/
git commit -m "feat(cloud-server): complete Phase 1 implementation with all API endpoints"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] Server starts on port 3333 (`npm run dev`)
- [ ] Health endpoint returns 200 (`curl http://localhost:3333/api/health`)
- [ ] Can create property via POST `/api/properties`
- [ ] Can retrieve property via GET `/api/properties/:id`
- [ ] Can batch import via POST `/api/properties/batch`
- [ ] Queue scrape returns job via GET `/api/queue/scrape`
- [ ] Can upload file via POST `/api/uploads/property/:id`
- [ ] Can create route via POST `/api/routes`
- [ ] Database file `dev.sqlite` exists in cloud-server directory
- [ ] Logs directory created with `combined.log` and `error.log`
- [ ] All TypeScript compiles without errors (`npm run build`)
- [ ] `.gitignore` excludes `node_modules`, `*.sqlite`, `logs`, `uploads`

---

## Next Phase

**Phase 2:** Extension Refactor
- Port Tampermonkey logic to Chrome Extension
- Implement background script queue polling
- Apply Angular Material interaction patterns from `SCE-v1-WISDOM.md`

**Phase 3:** Webapp Integration
- Update UI to call Cloud API
- Generate PDF with QR codes
- Display scraped customer data

**Phase 4:** Mobile Web
- Build field data entry interface
- Photo capture and upload
- Signature pad

---

**Plan complete and saved to** `docs/plans/2025-02-05-sce2-phase1-implementation.md`

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
