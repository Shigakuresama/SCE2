/**
 * Simple logging utility for webapp
 * In development: Logs to console with structured format
 * In production: Can be extended to send to Sentry or other error tracking
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   * In production, this should send to Sentry or similar service
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      } : error,
    };

    this.log('error', message, errorContext);

    // TODO: Send to Sentry in production
    // if (!this.isDevelopment && Sentry) {
    //   Sentry.captureException(error, { extra: context });
    // }
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In development, use console methods with colors
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      // biome-ignore lint/suspicious/noConsoleLog: Intentional console usage
      console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}]:`, message, context || '');
    } else {
      // In production, could send to logging service
      // For now, still use console but with structured format
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      // biome-ignore lint/suspicious/noConsoleLog: Intentional console usage
      console[consoleMethod](JSON.stringify(logData));
    }
  }
}

export const logger = new Logger();

/**
 * Convenience function for logging errors
 * Can be used throughout the webapp
 */
export function logError(
  message: string,
  error?: Error | unknown,
  context?: LogContext
): void {
  logger.error(message, error, context);
}

/**
 * Convenience function for logging info
 */
export function logInfo(message: string, context?: LogContext): void {
  logger.info(message, context);
}

/**
 * Convenience function for logging warnings
 */
export function logWarn(message: string, context?: LogContext): void {
  logger.warn(message, context);
}

/**
 * Convenience function for logging debug messages
 */
export function logDebug(message: string, context?: LogContext): void {
  logger.debug(message, context);
}

export default logger;
