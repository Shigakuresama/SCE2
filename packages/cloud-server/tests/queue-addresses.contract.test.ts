import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-queue-addresses-'));
const dbPath = path.join(tempDir, 'contract.sqlite');
const previousDatabaseUrl = process.env.DATABASE_URL;

beforeAll(() => {
  process.env.DATABASE_URL = `file:${dbPath}`;
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

  rmSync(tempDir, { recursive: true, force: true });
});

describe('Queue Addresses Contract', () => {
  it('dedupes duplicate addresses in one request instead of failing', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const payload = {
      addresses: [
        {
          addressFull: '22003 Seine Ave, Hawaiian Gardens, CA 90716',
          streetNumber: '22003',
          streetName: 'Seine Ave',
          zipCode: '90716',
          city: 'Hawaiian Gardens',
          state: 'CA',
          latitude: 33.8285,
          longitude: -118.0783,
        },
        {
          addressFull: '22003 Seine Ave, Hawaiian Gardens, CA 90716',
          streetNumber: '22003',
          streetName: 'Seine Ave',
          zipCode: '90716',
          city: 'Hawaiian Gardens',
          state: 'CA',
          latitude: 33.8285,
          longitude: -118.0783,
        },
      ],
    };

    const queueRes = await request(app).post('/api/queue/addresses').send(payload);
    expect(queueRes.status).toBe(201);
    expect(queueRes.body.success).toBe(true);
    expect(queueRes.body.count).toBe(1);
    expect(queueRes.body.skippedCount).toBe(0);

    const listRes = await request(app).get('/api/properties');
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('skips already-existing addresses instead of failing the whole request', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const payload = {
      addresses: [
        {
          addressFull: '700 Requeue St, Santa Ana, CA 92701',
          streetNumber: '700',
          streetName: 'Requeue St',
          zipCode: '92701',
          city: 'Santa Ana',
          state: 'CA',
        },
      ],
    };

    const firstQueue = await request(app).post('/api/queue/addresses').send(payload);
    expect(firstQueue.status).toBe(201);
    expect(firstQueue.body.count).toBe(1);
    expect(firstQueue.body.skippedCount).toBe(0);

    const secondQueue = await request(app).post('/api/queue/addresses').send(payload);
    expect(secondQueue.status).toBe(201);
    expect(secondQueue.body.count).toBe(0);
    expect(secondQueue.body.skippedCount).toBe(1);
    expect(secondQueue.body.skippedAddresses).toContain(
      '700 Requeue St, Santa Ana, CA 92701'
    );
  });

  it('does not 500 when an existing address only differs by capitalization', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const original = {
      addresses: [
        {
          addressFull: '23003 Seine Ave, Hawaiian Gardens, CA 90716',
          streetNumber: '23003',
          streetName: 'Seine Ave',
          zipCode: '90716',
          city: 'Hawaiian Gardens',
          state: 'CA',
        },
      ],
    };

    const mixedCase = {
      addresses: [
        {
          addressFull: '23003 SEINE AVE, HAWAIIAN GARDENS, CA 90716',
          streetNumber: '23003',
          streetName: 'SEINE AVE',
          zipCode: '90716',
          city: 'HAWAIIAN GARDENS',
          state: 'CA',
        },
      ],
    };

    const firstQueue = await request(app).post('/api/queue/addresses').send(original);
    expect(firstQueue.status).toBe(201);
    expect(firstQueue.body.count).toBe(1);

    const secondQueue = await request(app).post('/api/queue/addresses').send(mixedCase);
    expect(secondQueue.status).toBe(201);
    expect(secondQueue.body.success).toBe(true);
    expect(secondQueue.body.count).toBe(0);
    expect(secondQueue.body.skippedCount).toBe(1);
    expect(secondQueue.body.skippedAddresses).toContain(
      '23003 SEINE AVE, HAWAIIAN GARDENS, CA 90716'
    );
  });
});
