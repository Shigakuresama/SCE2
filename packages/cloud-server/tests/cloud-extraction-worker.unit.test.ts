import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-cloud-worker-'));
const dbPath = path.join(tempDir, 'worker.sqlite');
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousEncryptionKey = process.env.SCE_SESSION_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.SCE_SESSION_ENCRYPTION_KEY = 'test-key-for-cloud-worker';
  execSync('npx prisma db push --schema prisma/schema.prisma --skip-generate', {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: process.env,
  });
});

afterAll(() => {
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }

  if (previousEncryptionKey === undefined) {
    delete process.env.SCE_SESSION_ENCRYPTION_KEY;
  } else {
    process.env.SCE_SESSION_ENCRYPTION_KEY = previousEncryptionKey;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

describe('Cloud Extraction Worker', () => {
  it('moves successful properties to READY_FOR_FIELD and updates counts', async () => {
    const { prisma } = await import('../src/lib/database.js');
    const { encryptJson } = await import('../src/lib/encryption.js');
    const { processExtractionRun } = await import('../src/lib/cloud-extraction-worker.js');

    const property = await prisma.property.create({
      data: {
        addressFull: '123 Worker Pass St, Santa Ana, CA 92701',
        streetNumber: '123',
        streetName: 'Worker Pass St',
        zipCode: '92701',
      },
    });

    const session = await prisma.extractionSession.create({
      data: {
        label: 'Worker Session',
        encryptedStateJson: encryptJson('{"cookies":[]}', process.env.SCE_SESSION_ENCRYPTION_KEY!),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const run = await prisma.extractionRun.create({
      data: {
        sessionId: session.id,
        totalCount: 1,
        items: {
          create: [{ propertyId: property.id }],
        },
      },
    });

    await processExtractionRun(run.id, {
      client: {
        extractCustomerData: async () => ({
          customerName: 'Jane Worker',
          customerPhone: '(555) 101-0101',
          customerEmail: 'jane.worker@example.com',
        }),
      },
    });

    const updatedProperty = await prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    const updatedRun = await prisma.extractionRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { items: true },
    });

    expect(updatedProperty.status).toBe('READY_FOR_FIELD');
    expect(updatedProperty.dataExtracted).toBe(true);
    expect(updatedProperty.customerName).toBe('Jane Worker');
    expect(updatedProperty.customerPhone).toBe('(555) 101-0101');
    expect(updatedProperty.customerEmail).toBe('jane.worker@example.com');
    expect(updatedRun.processedCount).toBe(1);
    expect(updatedRun.successCount).toBe(1);
    expect(updatedRun.failureCount).toBe(0);
    expect(updatedRun.items[0].status).toBe('SUCCEEDED');
  });

  it('keeps property pending and increments failure count on extractor error', async () => {
    const { prisma } = await import('../src/lib/database.js');
    const { encryptJson } = await import('../src/lib/encryption.js');
    const { processExtractionRun } = await import('../src/lib/cloud-extraction-worker.js');

    const property = await prisma.property.create({
      data: {
        addressFull: '456 Worker Fail St, Santa Ana, CA 92701',
        streetNumber: '456',
        streetName: 'Worker Fail St',
        zipCode: '92701',
      },
    });

    const session = await prisma.extractionSession.create({
      data: {
        label: 'Worker Fail Session',
        encryptedStateJson: encryptJson('{"cookies":[]}', process.env.SCE_SESSION_ENCRYPTION_KEY!),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const run = await prisma.extractionRun.create({
      data: {
        sessionId: session.id,
        totalCount: 1,
        items: {
          create: [{ propertyId: property.id }],
        },
      },
    });

    await processExtractionRun(run.id, {
      client: {
        extractCustomerData: async () => {
          throw new Error('Simulated extraction failure');
        },
      },
    });

    const unchangedProperty = await prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    const failedRun = await prisma.extractionRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { items: true },
    });

    expect(unchangedProperty.status).toBe('PENDING_SCRAPE');
    expect(unchangedProperty.dataExtracted).toBe(false);
    expect(failedRun.processedCount).toBe(1);
    expect(failedRun.successCount).toBe(0);
    expect(failedRun.failureCount).toBe(1);
    expect(failedRun.items[0].status).toBe('FAILED');
    expect(failedRun.items[0].error).toContain('Simulated extraction failure');
  });

  it('treats empty extraction payloads as failures', async () => {
    const { prisma } = await import('../src/lib/database.js');
    const { encryptJson } = await import('../src/lib/encryption.js');
    const { processExtractionRun } = await import('../src/lib/cloud-extraction-worker.js');

    const property = await prisma.property.create({
      data: {
        addressFull: '789 Worker Empty St, Santa Ana, CA 92701',
        streetNumber: '789',
        streetName: 'Worker Empty St',
        zipCode: '92701',
      },
    });

    const session = await prisma.extractionSession.create({
      data: {
        label: 'Worker Empty Session',
        encryptedStateJson: encryptJson('{"cookies":[]}', process.env.SCE_SESSION_ENCRYPTION_KEY!),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const run = await prisma.extractionRun.create({
      data: {
        sessionId: session.id,
        totalCount: 1,
        items: {
          create: [{ propertyId: property.id }],
        },
      },
    });

    await processExtractionRun(run.id, {
      client: {
        extractCustomerData: async () => ({
          customerName: undefined,
          customerPhone: undefined,
          customerEmail: undefined,
        }),
      },
    });

    const unchangedProperty = await prisma.property.findUniqueOrThrow({
      where: { id: property.id },
    });
    const failedRun = await prisma.extractionRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { items: true },
    });

    expect(unchangedProperty.status).toBe('PENDING_SCRAPE');
    expect(unchangedProperty.dataExtracted).toBe(false);
    expect(failedRun.processedCount).toBe(1);
    expect(failedRun.successCount).toBe(0);
    expect(failedRun.failureCount).toBe(1);
    expect(failedRun.items[0].status).toBe('FAILED');
    expect(failedRun.items[0].error).toContain('No customer data extracted');
  });

  it('fails fast and marks remaining queued items when session access is invalid', async () => {
    const { prisma } = await import('../src/lib/database.js');
    const { encryptJson } = await import('../src/lib/encryption.js');
    const { processExtractionRun } = await import('../src/lib/cloud-extraction-worker.js');

    const properties = await Promise.all([
      prisma.property.create({
        data: {
          addressFull: '100 Shared Failure St, Santa Ana, CA 92701',
          streetNumber: '100',
          streetName: 'Shared Failure St',
          zipCode: '92701',
        },
      }),
      prisma.property.create({
        data: {
          addressFull: '101 Shared Failure St, Santa Ana, CA 92701',
          streetNumber: '101',
          streetName: 'Shared Failure St',
          zipCode: '92701',
        },
      }),
      prisma.property.create({
        data: {
          addressFull: '102 Shared Failure St, Santa Ana, CA 92701',
          streetNumber: '102',
          streetName: 'Shared Failure St',
          zipCode: '92701',
        },
      }),
    ]);

    const session = await prisma.extractionSession.create({
      data: {
        label: 'Shared Failure Session',
        encryptedStateJson: encryptJson('{"cookies":[]}', process.env.SCE_SESSION_ENCRYPTION_KEY!),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const run = await prisma.extractionRun.create({
      data: {
        sessionId: session.id,
        totalCount: properties.length,
        items: {
          create: properties.map((property) => ({ propertyId: property.id })),
        },
      },
      include: {
        items: {
          orderBy: { id: 'asc' },
        },
      },
    });

    let attempts = 0;
    await processExtractionRun(run.id, {
      client: {
        extractCustomerData: async () => {
          attempts += 1;
          throw new Error(
            'SCE login succeeded but landed on https://sce.dsmcentral.com/onsite/ instead of https://sce.dsmcentral.com/onsite/customer-search. This SCE account/session does not have access to customer-search.'
          );
        },
      },
    });

    const updatedRun = await prisma.extractionRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { items: { orderBy: { id: 'asc' } } },
    });

    expect(attempts).toBe(1);
    expect(updatedRun.processedCount).toBe(3);
    expect(updatedRun.successCount).toBe(0);
    expect(updatedRun.failureCount).toBe(3);
    expect(updatedRun.status).toBe('FAILED');
    expect(updatedRun.errorSummary).toContain('does not have access to customer-search');
    expect(updatedRun.items[0].status).toBe('FAILED');
    expect(updatedRun.items[0].error).toContain('does not have access to customer-search');
    expect(updatedRun.items[1].status).toBe('FAILED');
    expect(updatedRun.items[1].error).toContain('Skipped after shared SCE session failure');
    expect(updatedRun.items[2].status).toBe('FAILED');
    expect(updatedRun.items[2].error).toContain('Skipped after shared SCE session failure');
  });
});
