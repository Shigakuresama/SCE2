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
});
