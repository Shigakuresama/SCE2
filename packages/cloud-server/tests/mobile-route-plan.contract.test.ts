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

    const firstProperty = await request(app).post('/api/properties').send({
      addressFull: '101 North Loop Ave, Santa Ana, CA 92701',
      streetNumber: '101',
      streetName: 'North Loop Ave',
      zipCode: '92701',
    });
    const secondProperty = await request(app).post('/api/properties').send({
      addressFull: '102 North Loop Ave, Santa Ana, CA 92701',
      streetNumber: '102',
      streetName: 'North Loop Ave',
      zipCode: '92701',
    });
    const thirdProperty = await request(app).post('/api/properties').send({
      addressFull: '103 North Loop Ave, Santa Ana, CA 92701',
      streetNumber: '103',
      streetName: 'North Loop Ave',
      zipCode: '92701',
    });

    const propertyIds = [
      firstProperty.body.data.id,
      secondProperty.body.data.id,
      thirdProperty.body.data.id,
    ];
    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'North Loop',
      propertyIds,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.routeId).toBeTypeOf('number');
    expect(res.body.data.routeId).toBeGreaterThan(0);
    expect(res.body.data.orderedPropertyIds).toEqual(propertyIds);
    expect(res.body.data.orderedPropertyIdsJson).toBe(JSON.stringify(propertyIds));
    expect(res.body.data.properties).toHaveLength(propertyIds.length);
    expect(
      res.body.data.properties.map((property: { id: number }) => property.id).sort((a: number, b: number) => a - b)
    ).toEqual([...propertyIds].sort((a, b) => a - b));

    const persistedRoute = await request(app).get(`/api/routes/${res.body.data.routeId}`);
    expect(persistedRoute.status).toBe(200);
    expect(persistedRoute.body.data.orderedPropertyIdsJson).toBe(JSON.stringify(propertyIds));
  });

  it('rejects requests when one or more propertyIds do not exist', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const existing = await request(app).post('/api/properties').send({
      addressFull: '500 Missing Check Ave, Santa Ana, CA 92701',
      streetNumber: '500',
      streetName: 'Missing Check Ave',
      zipCode: '92701',
    });

    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'Missing IDs',
      propertyIds: [existing.body.data.id, 999999],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Properties not found');
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

  it('rejects requests with duplicate propertyIds', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const existing = await request(app).post('/api/properties').send({
      addressFull: '400 Duplicate Way, Santa Ana, CA 92701',
      streetNumber: '400',
      streetName: 'Duplicate Way',
      zipCode: '92701',
    });

    const duplicatedId = existing.body.data.id;
    const res = await request(app).post('/api/routes/mobile-plan').send({
      name: 'Duplicates',
      propertyIds: [duplicatedId, duplicatedId],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('duplicate');
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
