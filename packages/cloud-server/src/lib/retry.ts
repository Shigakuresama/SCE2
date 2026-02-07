export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  }
): Promise<T> {
  let lastError: Error;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === options.maxAttempts) {
        break;
      }

      console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`, error instanceof Error ? error.message : error);

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
    }
  }

  throw lastError!;
}
