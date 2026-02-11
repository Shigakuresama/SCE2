import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-mobile-route-plan-'));
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

describe('Mobile Route Plan Contract', () => {
  it('creates mobile route plan response with ordered property ids', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const propertyIds = [5, 3, 9];
    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'North Loop',
      propertyIds,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        routeId: 0,
        orderedPropertyIds: propertyIds,
        properties: [],
      },
    });
  });

  it('rejects requests without a name', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app).post('/api/routes/mobile-plan').send({
      propertyIds: [1],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('name');
  });

  it('rejects requests with an empty propertyIds array', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'North Loop',
      propertyIds: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('propertyIds');
  });

  it('rejects requests with a whitespace-only name', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: '   ',
      propertyIds: [1],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('name');
  });

  it('rejects requests when propertyIds is not an array', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'North Loop',
      propertyIds: '1,2,3',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('propertyIds');
  });

  it('rejects requests with invalid propertyIds elements', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'North Loop',
      propertyIds: [1, 0, 2.5, -3, NaN],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('propertyIds');
  });

  it('rejects requests with more than 1000 propertyIds', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'North Loop',
      propertyIds: Array.from({ length: 1001 }, (_, i) => i + 1),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('1000');
  });
});
