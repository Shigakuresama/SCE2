import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-mobile-upload-'));
const dbPath = path.join(tempDir, 'contract.sqlite');
const uploadDir = path.join(tempDir, 'uploads');
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousUploadDir = process.env.UPLOAD_DIR;

beforeAll(() => {
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.UPLOAD_DIR = uploadDir;
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

  if (previousUploadDir === undefined) {
    delete process.env.UPLOAD_DIR;
  } else {
    process.env.UPLOAD_DIR = previousUploadDir;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

describe('Mobile Document Upload Contract', () => {
  it('accepts base64 upload at /api/properties/:id/documents', async () => {
    const { buildTestApp } = await import('./helpers/test-app');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '100 Test Ave, Santa Ana, CA 92706',
      streetNumber: '100',
      streetName: 'Test Ave',
      zipCode: '92706',
    });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);

    const propertyId = created.body.data.id;

    const res = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'BILL',
        fileName: 'bill.jpg',
        base64Data: Buffer.from('fake-image').toString('base64'),
        mimeType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.url).toBe(`/api/uploads/${res.body.data.id}`);

    const uploaded = await request(app).get(res.body.data.url);
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.success).toBe(true);
    expect(uploaded.body.data.id).toBe(res.body.data.id);
  });

  it('rejects invalid property id with validation error', async () => {
    const { buildTestApp } = await import('./helpers/test-app');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/properties/not-a-number/documents')
      .send({
        docType: 'BILL',
        fileName: 'bill.jpg',
        base64Data: Buffer.from('fake-image').toString('base64'),
        mimeType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('propertyId');
  });

  it('rejects partial numeric property id strings', async () => {
    const { buildTestApp } = await import('./helpers/test-app');
    const app = await buildTestApp();

    const res = await request(app)
      .post('/api/properties/1abc/documents')
      .send({
        docType: 'BILL',
        fileName: 'bill.jpg',
        base64Data: Buffer.from('fake-image').toString('base64'),
        mimeType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('propertyId');
  });

  it('rejects unsupported mime type', async () => {
    const { buildTestApp } = await import('./helpers/test-app');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '300 Invalid Type Rd, Irvine, CA 92614',
      streetNumber: '300',
      streetName: 'Invalid Type Rd',
      zipCode: '92614',
    });

    const propertyId = created.body.data.id;
    const res = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'BILL',
        fileName: 'bill.gif',
        base64Data: Buffer.from('fake-image').toString('base64'),
        mimeType: 'image/gif',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid file type');
  });

  it('rejects malformed base64 data', async () => {
    const { buildTestApp } = await import('./helpers/test-app');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '400 Corrupt Data Dr, Orange, CA 92866',
      streetNumber: '400',
      streetName: 'Corrupt Data Dr',
      zipCode: '92866',
    });

    const propertyId = created.body.data.id;
    const res = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'BILL',
        fileName: 'bill.jpg',
        base64Data: 'not-base64',
        mimeType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('base64Data');
  });

  it('derives safe extension from mimeType instead of trusting fileName extension', async () => {
    const { buildTestApp } = await import('./helpers/test-app');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '500 Mime Guard Blvd, Tustin, CA 92780',
      streetNumber: '500',
      streetName: 'Mime Guard Blvd',
      zipCode: '92780',
    });

    const propertyId = created.body.data.id;
    const upload = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'BILL',
        fileName: 'malicious.html',
        base64Data: Buffer.from('fake-image').toString('base64'),
        mimeType: 'image/jpeg',
      });

    expect(upload.status).toBe(201);
    expect(upload.body.success).toBe(true);

    const uploaded = await request(app).get(upload.body.data.url);
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.success).toBe(true);
    expect(uploaded.body.data.fileName.endsWith('.jpg')).toBe(true);
    expect(uploaded.body.data.fileName.endsWith('.html')).toBe(false);
  });

  it('rejects prototype-chain mimeType values', async () => {
    const { buildTestApp } = await import('./helpers/test-app');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '600 Proto Chain Ln, Garden Grove, CA 92840',
      streetNumber: '600',
      streetName: 'Proto Chain Ln',
      zipCode: '92840',
    });

    const propertyId = created.body.data.id;
    const res = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'BILL',
        fileName: 'payload.jpg',
        base64Data: Buffer.from('fake-image').toString('base64'),
        mimeType: '__proto__',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid file type');
  });
});
