// packages/extension/tests/route-state.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Chrome APIs
const mockStorage: Record<string, unknown> = {};
global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys) => Promise.resolve(mockStorage)),
      set: vi.fn((data) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
    },
  },
} as unknown as typeof chrome;

describe('RouteState', () => {
  beforeEach(() => {
    // Clear storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  it('should atomically acquire processing lock', async () => {
    const { tryAcquireLock, releaseLock, isProcessing } = await import('../src/lib/route-state.js');

    const acquired = await tryAcquireLock('test-batch-1');
    expect(acquired).toBe(true);
    expect(await isProcessing()).toBe(true);
  });

  it('should fail to acquire lock when already held', async () => {
    const { tryAcquireLock, releaseLock, isProcessing } = await import('../src/lib/route-state.js');

    await tryAcquireLock('test-batch-1');
    const secondAcquire = await tryAcquireLock('test-batch-2');
    expect(secondAcquire).toBe(false);
  });

  it('should release lock and allow new acquisition', async () => {
    const { tryAcquireLock, releaseLock, isProcessing } = await import('../src/lib/route-state.js');

    await tryAcquireLock('test-batch-1');
    await releaseLock();
    expect(await isProcessing()).toBe(false);

    const newAcquire = await tryAcquireLock('test-batch-2');
    expect(newAcquire).toBe(true);
  });

  it('should track current batch ID', async () => {
    const { tryAcquireLock, getCurrentBatchId } = await import('../src/lib/route-state.js');

    await tryAcquireLock('batch-abc123');
    expect(await getCurrentBatchId()).toBe('batch-abc123');
  });
});
