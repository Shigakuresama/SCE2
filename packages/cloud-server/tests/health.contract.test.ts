import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/test-app.js';

describe('Health Contract', () => {
  it('returns API health payload', async () => {
    const app = await buildTestApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('SCE2 API is running');
    expect(typeof res.body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });
});
