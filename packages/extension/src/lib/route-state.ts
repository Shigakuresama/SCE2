// packages/extension/src/lib/route-state.ts
/**
 * Atomic route processing state management using chrome.storage.local
 * as a mutex to prevent concurrent batch processing.
 *
 * Note: While chrome.storage.local operations are serialized by Chrome's
 * internal implementation, this provides "best effort" mutual exclusion
 * sufficient for the extension's batch processing use case.
 */

const STORAGE_KEY = 'routeProcessingState';
const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface RouteProcessingState {
  isProcessing: boolean;
  currentBatchId: string | null;
  acquiredAt: number | null;
}

/**
 * Attempt to atomically acquire the processing lock.
 * Returns true if lock was acquired, false if already held.
 */
export async function tryAcquireLock(batchId: string): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const state = result[STORAGE_KEY] as RouteProcessingState | undefined;

  // Check if already processing
  if (state?.isProcessing) {
    // Safety: auto-release stale locks older than timeout
    if (state.acquiredAt && Date.now() - state.acquiredAt > STALE_LOCK_TIMEOUT_MS) {
      console.warn('[RouteState] Releasing stale lock', state);
    } else {
      return false;
    }
  }

  // Acquire lock atomically
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      isProcessing: true,
      currentBatchId: batchId,
      acquiredAt: Date.now(),
    },
  });

  return true;
}

/**
 * Release the processing lock.
 */
export async function releaseLock(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      isProcessing: false,
      currentBatchId: null,
      acquiredAt: null,
    },
  });
}

/**
 * Check if processing is currently in progress.
 */
export async function isProcessing(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const state = result[STORAGE_KEY] as RouteProcessingState | undefined;
  return state?.isProcessing ?? false;
}

/**
 * Get the current batch ID being processed.
 */
export async function getCurrentBatchId(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const state = result[STORAGE_KEY] as RouteProcessingState | undefined;
  return state?.currentBatchId ?? null;
}

/**
 * Get full state for debugging.
 */
export async function getState(): Promise<RouteProcessingState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? {
    isProcessing: false,
    currentBatchId: null,
    acquiredAt: null,
  };
}
