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
  (prisma as any).$on('query', (e: any) => {
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
