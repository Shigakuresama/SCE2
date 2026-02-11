import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sce2-visit-complete-'));
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

describe('Visit Completion Contract', () => {
  it('rejects completion when BILL and SIGNATURE docs are missing', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '200 Field St, Anaheim, CA 92801',
      streetNumber: '200',
      streetName: 'Field St',
      zipCode: '92801',
    });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);

    const propertyId = created.body.data.id;
    const markReady = await request(app).patch(`/api/properties/${propertyId}`).send({
      status: 'READY_FOR_FIELD',
    });

    expect(markReady.status).toBe(200);
    expect(markReady.body.success).toBe(true);

    const res = await request(app).post(`/api/properties/${propertyId}/complete-visit`).send({});

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('BILL');
    expect(res.body.error.message).toContain('SIGNATURE');
  });

  it('marks property as VISITED when BILL and SIGNATURE docs exist', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '300 Success Ave, Santa Ana, CA 92704',
      streetNumber: '300',
      streetName: 'Success Ave',
      zipCode: '92704',
    });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);

    const propertyId = created.body.data.id;
    const markReady = await request(app).patch(`/api/properties/${propertyId}`).send({
      status: 'READY_FOR_FIELD',
    });

    expect(markReady.status).toBe(200);
    expect(markReady.body.success).toBe(true);

    const billUpload = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'BILL',
        fileName: 'bill.jpg',
        base64Data: Buffer.from('fake-bill').toString('base64'),
        mimeType: 'image/jpeg',
      });

    expect(billUpload.status).toBe(201);
    expect(billUpload.body.success).toBe(true);

    const signatureUpload = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'SIGNATURE',
        fileName: 'signature.jpg',
        base64Data: Buffer.from('fake-signature').toString('base64'),
        mimeType: 'image/jpeg',
      });

    expect(signatureUpload.status).toBe(201);
    expect(signatureUpload.body.success).toBe(true);

    const completed = await request(app).post(`/api/properties/${propertyId}/complete-visit`).send({});

    expect(completed.status).toBe(200);
    expect(completed.body.success).toBe(true);
    expect(completed.body.data.id).toBe(propertyId);
    expect(completed.body.data.status).toBe('VISITED');

    const fetched = await request(app).get(`/api/properties/${propertyId}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body.success).toBe(true);
    expect(fetched.body.data.status).toBe('VISITED');
  });

  it('rejects completion when property is not READY_FOR_FIELD', async () => {
    const { buildTestApp } = await import('./helpers/test-app.js');
    const app = await buildTestApp();

    const created = await request(app).post('/api/properties').send({
      addressFull: '400 Terminal State Way, Orange, CA 92865',
      streetNumber: '400',
      streetName: 'Terminal State Way',
      zipCode: '92865',
    });

    const propertyId = created.body.data.id;

    await request(app).patch(`/api/properties/${propertyId}`).send({
      status: 'COMPLETE',
    });

    const billUpload = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'BILL',
        fileName: 'bill.jpg',
        base64Data: Buffer.from('fake-bill').toString('base64'),
        mimeType: 'image/jpeg',
      });
    expect(billUpload.status).toBe(201);

    const signatureUpload = await request(app)
      .post(`/api/properties/${propertyId}/documents`)
      .send({
        docType: 'SIGNATURE',
        fileName: 'signature.jpg',
        base64Data: Buffer.from('fake-signature').toString('base64'),
        mimeType: 'image/jpeg',
      });
    expect(signatureUpload.status).toBe(201);

    const completed = await request(app).post(`/api/properties/${propertyId}/complete-visit`).send({});
    expect(completed.status).toBe(409);
    expect(completed.body.success).toBe(false);
    expect(completed.body.error.message).toContain('READY_FOR_FIELD');
  });
});
