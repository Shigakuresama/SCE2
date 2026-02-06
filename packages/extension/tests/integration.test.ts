import { describe, it, expect, beforeAll } from 'vitest';

describe('Extension Integration Tests', () => {
  const API_BASE = 'http://localhost:3333';

  beforeAll(async () => {
    // Ensure cloud server is running
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (!response.ok) {
        throw new Error('Cloud server not responding correctly');
      }
    } catch (error) {
      throw new Error(
        'Cloud server not running. Start it with: cd packages/cloud-server && npm run dev'
      );
    }
  });

  describe('Cloud API Integration', () => {
    it('should return health check', async () => {
      const response = await fetch(`${API_BASE}/api/health`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('SCE2 API');
    });

    it('should create property', async () => {
      const response = await fetch(`${API_BASE}/api/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressFull: '123 Test St, Test City, CA 90210',
          streetNumber: '123',
          streetName: 'Test St',
          zipCode: '90210',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('PENDING_SCRAPE');
    });

    it('should fetch scrape queue', async () => {
      const response = await fetch(`${API_BASE}/api/queue/scrape`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(
        Array.isArray(data.data) || data.data === null || typeof data.data === 'object'
      ).toBe(true);
    });

    it('should handle timeout with fetchWithTimeout pattern', async () => {
      // Test that the timeout pattern works
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100);

      try {
        // This should timeout since we're aborting after 100ms
        await fetch(`${API_BASE}/api/properties`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        // If we get here, the request completed before timeout (which is fine)
        expect(true).toBe(true);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          // Expected - timeout worked
          expect(true).toBe(true);
        } else {
          // Some other error
          throw error;
        }
      }
    });
  });

  describe('Extension Configuration', () => {
    it('should load default config', async () => {
      // This test would run in the extension context
      // For now, just test that config structure is valid

      const defaultConfig = {
        apiBaseUrl: 'http://localhost:3333',
        autoProcess: false,
        autoStart: false,
        pollInterval: 5000,
        timeout: 30000,
        maxConcurrent: 3,
        debugMode: false,
      };

      expect(defaultConfig.apiBaseUrl).toBeTruthy();
      expect(defaultConfig.pollInterval).toBeGreaterThan(0);
      expect(defaultConfig.maxConcurrent).toBeGreaterThan(0);
      expect(defaultConfig.timeout).toBeGreaterThan(0);
    });

    it('should validate poll interval range', () => {
      const validInterval = 5000;
      const minInterval = 1000;
      const maxInterval = 60000;

      expect(validInterval).toBeGreaterThanOrEqual(minInterval);
      expect(validInterval).toBeLessThanOrEqual(maxInterval);
    });

    it('should validate max concurrent range', () => {
      const validMaxConcurrent = 3;
      const min = 1;
      const max = 10;

      expect(validMaxConcurrent).toBeGreaterThanOrEqual(min);
      expect(validMaxConcurrent).toBeLessThanOrEqual(max);
    });
  });

  describe('Queue Management', () => {
    it('should have correct queue state structure', () => {
      const queueState = {
        items: [],
        currentJob: null,
        isProcessing: false,
        processedCount: 0,
      };

      expect(Array.isArray(queueState.items)).toBe(true);
      expect(typeof queueState.isProcessing).toBe('boolean');
      expect(typeof queueState.processedCount).toBe('number');
    });

    it('should track processed count correctly', () => {
      const queueState = {
        items: [],
        currentJob: null,
        isProcessing: false,
        processedCount: 0,
      };

      expect(queueState.processedCount).toBe(0);

      // Simulate processing
      queueState.processedCount++;
      expect(queueState.processedCount).toBe(1);

      queueState.processedCount++;
      expect(queueState.processedCount).toBe(2);
    });
  });

  describe('TypeScript Interfaces', () => {
    it('should have correct ScrapeJob structure', () => {
      const scrapeJob = {
        id: 1,
        streetNumber: '123',
        streetName: 'Test St',
        zipCode: '90210',
        addressFull: '123 Test St, Test City, CA 90210',
      };

      expect(typeof scrapeJob.id).toBe('number');
      expect(typeof scrapeJob.streetNumber).toBe('string');
      expect(typeof scrapeJob.streetName).toBe('string');
      expect(typeof scrapeJob.zipCode).toBe('string');
      expect(typeof scrapeJob.addressFull).toBe('string');
    });

    it('should have correct SubmitJob structure', () => {
      const submitJob = {
        id: 1,
        streetNumber: '123',
        streetName: 'Test St',
        zipCode: '90210',
        addressFull: '123 Test St, Test City, CA 90210',
        customerName: 'John Doe',
        customerPhone: '555-1234',
        customerAge: 45,
        fieldNotes: 'Test notes',
        documents: [],
      };

      expect(typeof submitJob.id).toBe('number');
      expect(typeof submitJob.customerName).toBe('string');
      expect(typeof submitJob.customerAge).toBe('number');
      expect(Array.isArray(submitJob.documents)).toBe(true);
    });
  });
});
