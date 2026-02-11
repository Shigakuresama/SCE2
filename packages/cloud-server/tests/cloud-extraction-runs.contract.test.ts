import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-cloud-extract-'));
const dbPath = path.join(tempDir, 'contract.sqlite');
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousEncryptionKey = process.env.SCE_SESSION_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.SCE_SESSION_ENCRYPTION_KEY = 'test-key-for-cloud-extraction-contracts';
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

describe('Cloud Extraction Runs Contract', () => {
  it('creates encrypted extraction session', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/cloud-extraction/sessions')
      .send({
        label: 'SCE Operator Session',
        sessionStateJson: '{"cookies":[]}',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toEqual(expect.any(Number));
    expect(res.body.data.label).toBe('SCE Operator Session');
    expect(res.body.data.encryptedStateJson).toBeUndefined();
  });

  it('rejects expired session payloads', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/cloud-extraction/sessions')
      .send({
        label: 'Expired Session',
        sessionStateJson: '{"cookies":[]}',
        expiresAt: '2020-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('expiresAt');
  });

  it('creates a queued extraction run', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const session = await request(app).post('/api/cloud-extraction/sessions').send({
      label: 'Run Session',
      sessionStateJson: '{"cookies":[]}',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    expect(session.status).toBe(201);
    const sessionId = session.body.data.id;

    const res = await request(app)
      .post('/api/cloud-extraction/runs')
      .send({ propertyIds: [1, 2, 3], sessionId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toEqual(expect.any(Number));
    expect(res.body.data.status).toBe('QUEUED');
    expect(res.body.data.totalCount).toBe(3);
    expect(res.body.data.processedCount).toBe(0);
    expect(res.body.data.successCount).toBe(0);
    expect(res.body.data.failureCount).toBe(0);
  });
});
