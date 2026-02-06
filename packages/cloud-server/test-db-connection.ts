import { initDatabase, prisma } from './src/lib/database.js';
import { logger } from './src/lib/logger.js';

async function test() {
  try {
    await initDatabase();
    const count = await prisma.property.count();
    logger.info(`Properties in database: ${count}`);
    await prisma.$disconnect();
    console.log('✅ Database connection test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
