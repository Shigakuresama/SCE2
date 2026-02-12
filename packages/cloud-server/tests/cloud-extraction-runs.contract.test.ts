import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-cloud-extract-'));
const dbPath = path.join(tempDir, 'contract.sqlite');
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousEncryptionKey = process.env.SCE_SESSION_ENCRYPTION_KEY;
const previousAutomationEnabled = process.env.SCE_AUTOMATION_ENABLED;

beforeAll(() => {
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.SCE_SESSION_ENCRYPTION_KEY = 'test-key-for-cloud-extraction-contracts';
  process.env.SCE_AUTOMATION_ENABLED = 'true';
  execSync('npx prisma db push --schema prisma/schema.prisma --skip-generate', {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: process.env,
  });
});

beforeEach(async () => {
  const {
    setCloudExtractionEnabledForTests,
    setCloudExtractionRunLauncherForTests,
    setCloudExtractionSessionStateFactoryForTests,
    setCloudExtractionSessionValidatorForTests,
  } = await import(
    '../src/routes/cloud-extraction.js'
  );
  setCloudExtractionEnabledForTests(true);
  setCloudExtractionRunLauncherForTests(async () => {});
  setCloudExtractionSessionStateFactoryForTests(async () => '{"cookies":[],"origins":[]}');
  setCloudExtractionSessionValidatorForTests(async () => ({
    currentUrl: 'https://sce.dsmcentral.com/onsite/customer-search',
  }));
});

afterEach(async () => {
  const {
    setCloudExtractionEnabledForTests,
    setCloudExtractionRunLauncherForTests,
    setCloudExtractionSessionStateFactoryForTests,
    setCloudExtractionSessionValidatorForTests,
  } = await import(
    '../src/routes/cloud-extraction.js'
  );
  setCloudExtractionEnabledForTests(null);
  setCloudExtractionRunLauncherForTests(async () => {});
  setCloudExtractionSessionStateFactoryForTests(null);
  setCloudExtractionSessionValidatorForTests(null);
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

  if (previousAutomationEnabled === undefined) {
    delete process.env.SCE_AUTOMATION_ENABLED;
  } else {
    process.env.SCE_AUTOMATION_ENABLED = previousAutomationEnabled;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

describe('Cloud Extraction Runs Contract', () => {
  it('returns 503 when cloud extraction feature flag is disabled', async () => {
    const { setCloudExtractionEnabledForTests } = await import(
      '../src/routes/cloud-extraction.js'
    );
    setCloudExtractionEnabledForTests(false);

    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/cloud-extraction/sessions')
      .send({
        label: 'Disabled Session',
        sessionStateJson: '{"cookies":[]}',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Cloud extraction disabled');
  });

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

  it('creates encrypted extraction session via login bridge', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/cloud-extraction/sessions/login-bridge')
      .send({
        label: 'SCE Login Bridge Session',
        username: 'first.last@sce.tac',
        password: 'super-secret-password',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toEqual(expect.any(Number));
    expect(res.body.data.label).toBe('SCE Login Bridge Session');
  });

  it('rejects login bridge requests with missing credentials', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/cloud-extraction/sessions/login-bridge')
      .send({
        label: 'Invalid Login Bridge Session',
        username: '',
        password: '',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('username');
  });

  it('returns actionable error when login bridge automation fails', async () => {
    const { setCloudExtractionSessionStateFactoryForTests } = await import(
      '../src/routes/cloud-extraction.js'
    );
    setCloudExtractionSessionStateFactoryForTests(async () => {
      throw new Error('Could not find SCE login fields on the login page.');
    });

    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/cloud-extraction/sessions/login-bridge')
      .send({
        label: 'Failed Login Bridge Session',
        username: 'first.last@sce.tac',
        password: 'super-secret-password',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Unable to create session from SCE login');
    expect(res.body.error.message).toContain('Could not find SCE login fields');
  });

  it('does not save login bridge session when customer-search validation fails', async () => {
    const { setCloudExtractionSessionValidatorForTests } = await import(
      '../src/routes/cloud-extraction.js'
    );
    setCloudExtractionSessionValidatorForTests(async () => {
      throw new Error(
        'SCE login required for https://sce.dsmcentral.com/onsite/customer-search. Refresh session JSON from an authenticated dsmcentral login.'
      );
    });

    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const before = await request(app).get('/api/cloud-extraction/sessions');
    const beforeCount = Array.isArray(before.body?.data) ? before.body.data.length : 0;

    const res = await request(app)
      .post('/api/cloud-extraction/sessions/login-bridge')
      .send({
        label: 'Invalid Bridge Session',
        username: 'first.last@sce.tac',
        password: 'super-secret-password',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Unable to create session from SCE login');
    expect(res.body.error.message).toContain('SCE login required for');

    const after = await request(app).get('/api/cloud-extraction/sessions');
    const afterCount = Array.isArray(after.body?.data) ? after.body.data.length : 0;
    expect(afterCount).toBe(beforeCount);
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

  it('validates an active session against customer-search', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const session = await request(app).post('/api/cloud-extraction/sessions').send({
      label: 'Session To Validate',
      sessionStateJson: '{"cookies":[]}',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app).post(
      "/api/cloud-extraction/sessions/" + session.body.data.id + "/validate"
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.currentUrl).toContain('/onsite/customer-search');
    expect(res.body.data.message).toContain('can access SCE customer-search');
  });

  it('returns valid=false when session validation fails', async () => {
    const { setCloudExtractionSessionValidatorForTests } = await import(
      '../src/routes/cloud-extraction.js'
    );
    setCloudExtractionSessionValidatorForTests(async () => {
      throw new Error(
        'SCE login succeeded but landed on https://sce.dsmcentral.com/onsite/ instead of https://sce.dsmcentral.com/onsite/customer-search. This SCE account/session does not have access to customer-search.'
      );
    });

    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const session = await request(app).post('/api/cloud-extraction/sessions').send({
      label: 'Session Validation Failure',
      sessionStateJson: '{"cookies":[]}',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const res = await request(app).post(
      "/api/cloud-extraction/sessions/" + session.body.data.id + "/validate"
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.message).toContain('does not have access to customer-search');
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

  it('returns run details with queued items', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const session = await request(app).post('/api/cloud-extraction/sessions').send({
      label: 'Run Detail Session',
      sessionStateJson: '{"cookies":[]}',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const createdRun = await request(app).post('/api/cloud-extraction/runs').send({
      propertyIds: [101, 102],
      sessionId: session.body.data.id,
    });
    const runId = createdRun.body.data.id;

    const runDetail = await request(app).get(`/api/cloud-extraction/runs/${runId}`);

    expect(runDetail.status).toBe(200);
    expect(runDetail.body.success).toBe(true);
    expect(runDetail.body.data.id).toBe(runId);
    expect(runDetail.body.data.items).toHaveLength(2);
    expect(runDetail.body.data.items[0].status).toBe('QUEUED');
  });

  it('prevents starting a run more than once', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const session = await request(app).post('/api/cloud-extraction/sessions').send({
      label: 'Start Once Session',
      sessionStateJson: '{"cookies":[]}',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const run = await request(app).post('/api/cloud-extraction/runs').send({
      propertyIds: [201],
      sessionId: session.body.data.id,
    });
    const runId = run.body.data.id;

    const firstStart = await request(app).post(`/api/cloud-extraction/runs/${runId}/start`);
    expect(firstStart.status).toBe(202);

    const secondStart = await request(app).post(`/api/cloud-extraction/runs/${runId}/start`);
    expect(secondStart.status).toBe(409);
    expect(secondStart.body.success).toBe(false);
    expect(secondStart.body.error.message).toContain('cannot be started');
  });
});
