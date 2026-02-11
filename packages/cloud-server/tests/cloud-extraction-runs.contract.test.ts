import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-cloud-extract-'));
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

describe('Cloud Extraction Runs Contract', () => {
  it('creates a queued extraction run', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/cloud-extraction/runs')
      .send({ propertyIds: [1, 2, 3], sessionId: 10 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('QUEUED');
  });
});
