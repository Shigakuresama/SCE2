// packages/cloud-server/tests/routes/properties.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/test-app.js';
import { prisma } from '../../src/lib/database.js';
import type { Express } from 'express';

describe('Property Routes Validation', () => {
  let app: Express;
  let testRunId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    // Generate unique ID for this test run
    testRunId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Clean up test data
    await prisma.property.deleteMany({
      where: { addressFull: { contains: 'TEST_ADDRESS' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.property.deleteMany({
      where: { addressFull: { contains: 'TEST_ADDRESS' } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/properties', () => {
    it('should create property with valid data', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({
          addressFull: `TEST_ADDRESS_${testRunId}_123`,
          streetNumber: '123',
          streetName: 'Test St',
          zipCode: '92801',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.addressFull).toBe(`TEST_ADDRESS_${testRunId}_123`);
    });

    it('should reject invalid ZIP code', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({
          addressFull: `TEST_ADDRESS_${testRunId}_invalid_zip`,
          streetNumber: '123',
          streetName: 'Test St',
          zipCode: '9280', // Invalid - only 4 digits
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({
          streetNumber: '123 Test St',
          // Missing addressFull and zipCode
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toBeDefined();
    });

    it('should accept ZIP+4 format', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({
          addressFull: `TEST_ADDRESS_${testRunId}_456`,
          streetNumber: '456',
          streetName: 'Test Ave',
          zipCode: '92831-1234', // Valid ZIP+4
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/properties/:id', () => {
    it('should reject invalid id param', async () => {
      const response = await request(app)
        .patch('/api/properties/abc') // Not a number
        .send({ customerName: 'John Doe' });

      expect(response.status).toBe(400);
      expect(response.body.details[0].path).toBe('id');
    });

    it('should reject invalid status value', async () => {
      // First create a property
      const createRes = await request(app)
        .post('/api/properties')
        .send({
          addressFull: `TEST_ADDRESS_${testRunId}_patch_999`,
          streetNumber: '999',
          streetName: 'Test Ave',
          zipCode: '92801',
        });

      const response = await request(app)
        .patch(`/api/properties/${createRes.body.data.id}`)
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
      expect(response.body.details).toBeDefined();
    });
  });

  describe('GET /api/properties', () => {
    it('should accept valid query params', async () => {
      const response = await request(app)
        .get('/api/properties?status=PENDING_SCRAPE&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid status in query', async () => {
      const response = await request(app)
        .get('/api/properties?status=INVALID');

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/properties/all', () => {
    it('should reject invalid status in query', async () => {
      const response = await request(app)
        .delete('/api/properties/all?status=INVALID');

      expect(response.status).toBe(400);
    });
  });
});
