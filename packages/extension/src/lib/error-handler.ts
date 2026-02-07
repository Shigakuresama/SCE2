/**
 * Error Handling Utilities
 * Provides robust error handling for form interactions
 */

// ==========================================
// ERROR TYPES
// ==========================================

export class ElementNotFoundError extends Error {
  constructor(
    public selector: string,
    public fieldName?: string,
    public context?: string
  ) {
    super(`Element not found: ${selector}${fieldName ? ` (field: ${fieldName})` : ''}${context ? ` in ${context}` : ''}`);
    this.name = 'ElementNotFoundError';
  }
}

export class TimeoutError extends Error {
  constructor(
    public operation: string,
    public timeout: number,
    public details?: string
  ) {
    super(`Operation timed out: ${operation} after ${timeout}ms${details ? ` (${details})` : ''}`);
    this.name = 'TimeoutError';
  }
}

export class SectionNotFoundError extends Error {
  constructor(public sectionName: string) {
    super(`Section not found: ${sectionName}`);
    this.name = 'SectionNotFoundError';
  }
}

export class FormValidationError extends Error {
  constructor(
    public field: string,
    public value: string,
    public reason: string
  ) {
    super(`Validation failed for ${field}: ${reason} (value: ${value})`);
    this.name = 'FormValidationError';
  }
}

export class NetworkError extends Error {
  constructor(
    public url: string,
    public status: number,
    public message: string
  ) {
    super(`Network error: ${url} returned ${status} - ${message}`);
    this.name = 'NetworkError';
  }
}

// ==========================================
// ERROR RESULT TYPES
// ==========================================

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E; context?: string };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// ==========================================
// ERROR HANDLING FUNCTIONS
// ==========================================

/**
 * Wrap a function in error handling with context
 */
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: string
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    console.error(`[${operation}] Error${context ? ` in ${context}` : ''}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      context,
    };
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 300,
    maxDelay = 5000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);

      console.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`, {
        error: lastError.message,
      });

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Execute multiple operations and collect all errors
 */
export async function withErrorCollection<T>(
  operations: Array<{
    name: string;
    fn: () => Promise<T>;
  }>
): Promise<{
  successful: Array<{ name: string; data: T }>;
  failed: Array<{ name: string; error: Error }>;
}> {
  const results = await Promise.allSettled(
    operations.map(async op => ({
      name: op.name,
      result: await withErrorHandling(op.name, op.fn),
    }))
  );

  const successful: Array<{ name: string; data: T }> = [];
  const failed: Array<{ name: string; error: Error }> = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.result.success) {
        successful.push({ name: result.value.name, data: result.value.result.data });
      } else {
        failed.push({
          name: result.value.name,
          error: result.value.result.error,
        });
      }
    } else {
      failed.push({
        name: result.reason?.name || 'unknown',
        error: result.reason || new Error('Unknown error'),
      });
    }
  }

  return { successful, failed };
}

/**
 * Timeout a promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string = 'operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(operation, timeoutMs)), timeoutMs)
    ),
  ]);
}

/**
 * Validate that a value is not empty
 */
export function validateNotEmpty(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new FormValidationError(fieldName, value, 'Value is empty');
  }
}

/**
 * Validate that a value matches a pattern
 */
export function validatePattern(value: string, pattern: RegExp, fieldName: string): void {
  if (!pattern.test(value)) {
    throw new FormValidationError(fieldName, value, `Does not match pattern ${pattern}`);
  }
}

/**
 * Validate that a value is within a range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value < min || value > max) {
    throw new FormValidationError(fieldName, String(value), `Must be between ${min} and ${max}`);
  }
}

/**
 * Validate a selector exists
 */
export function validateSelector(selector: string, context?: string): Element {
  const element = document.querySelector(selector);
  if (!element) {
    throw new ElementNotFoundError(selector, undefined, context);
  }
  return element;
}

/**
 * Safe query selector with error handling
 */
export function safeQuerySelector(
  selector: string,
  options: {
    timeout?: number;
    context?: string;
    required?: boolean;
  } = {}
): Element | null {
  const { timeout: timeoutMs = 0, context, required = false } = options;

  try {
    const element = document.querySelector(selector);
    if (required && !element) {
      throw new ElementNotFoundError(selector, undefined, context);
    }
    return element;
  } catch (error) {
    if (required) {
      throw error;
    }
    console.warn(`[safeQuerySelector] Failed to find ${selector}:`, error);
    return null;
  }
}

/**
 * Safe wait for element with error handling
 */
export function safeWaitForElement(
  selector: string,
  options: {
    timeout?: number;
    context?: string;
    required?: boolean;
  } = {}
): Promise<Element | null> {
  const { timeout: timeoutMs = 10000, context, required = false } = options;

  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);

    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      if (required) {
        reject(new TimeoutError(`Wait for element: ${selector}`, timeoutMs));
      } else {
        resolve(null);
      }
    }, timeoutMs);

    // Store timeout ID for cleanup if needed
    (observer as any)._timeoutId = timeoutId;
  });
}

/**
 * Log operation with start/end timing
 */
export function logOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  const start = Date.now();
  const prefix = context ? `[${context}]` : '';
  console.log(`${prefix} ${operation} - started`);

  return fn().finally(() => {
    const duration = Date.now() - start;
    console.log(`${prefix} ${operation} - completed in ${duration}ms`);
  });
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastResult: ReturnType<T>;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = fn.apply(this, args);

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }

    return lastResult;
  };
}

// Helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// ERROR LOGGING
// ==========================================

interface ErrorLog {
  timestamp: Date;
  error: Error;
  context?: string;
  data?: any;
}

const errorLogs: ErrorLog[] = [];

export function logError(error: Error, context?: string, data?: any): void {
  const logEntry: ErrorLog = {
    timestamp: new Date(),
    error,
    context,
    data,
  };
  errorLogs.push(logEntry);

  console.error('[Error Logged]', {
    timestamp: logEntry.timestamp.toISOString(),
    message: error.message,
    stack: error.stack,
    context,
    data,
  });
}

export function getErrorLogs(): ErrorLog[] {
  return [...errorLogs];
}

export function clearErrorLogs(): void {
  errorLogs.length = 0;
}

export function getRecentErrors(count = 10): ErrorLog[] {
  return errorLogs.slice(-count);
}

// ==========================================
// ERROR RECOVERY SUGGESTIONS
// ==========================================

export function getSuggestedFix(error: Error): string | null {
  if (error instanceof ElementNotFoundError) {
    return `Check if selector "${error.selector}" is correct and element exists in DOM`;
  }

  if (error instanceof TimeoutError) {
    return `Try increasing timeout or check if network is slow. Operation: ${error.operation}`;
  }

  if (error instanceof SectionNotFoundError) {
    return `Verify section name "${error.sectionName}" matches available sections`;
  }

  if (error instanceof FormValidationError) {
    return `Check value format for field "${error.field}". Reason: ${error.reason}`;
  }

  if (error instanceof NetworkError) {
    return `Check network connectivity and server status. URL: ${error.url}`;
  }

  return null;
}
