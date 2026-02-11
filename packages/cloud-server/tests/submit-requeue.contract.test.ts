import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-submit-requeue-'));
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

describe('Submit Requeue Contract', () => {
  it('moves SUBMITTING_IN_PROGRESS back to VISITED', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '700 Requeue St, Santa Ana, CA 92701',
      streetNumber: '700',
      streetName: 'Requeue St',
      zipCode: '92701',
    });

    expect(created.status).toBe(201);
    const propertyId = created.body.data.id;

    await request(app).patch(`/api/properties/${propertyId}`).send({
      status: 'SUBMITTING_IN_PROGRESS',
    });

    const requeued = await request(app)
      .post(`/api/queue/${propertyId}/requeue-submit`)
      .send({ reason: 'Final submit disabled by config' });

    expect(requeued.status).toBe(200);
    expect(requeued.body.success).toBe(true);
    expect(requeued.body.data.status).toBe('VISITED');
  });
});
