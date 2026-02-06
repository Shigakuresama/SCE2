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
