import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';
import { AppError } from '../types/errors.js';

// Async handler wrapper - catches errors in async route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error response formatter
function formatError(error: Error) {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        statusCode: error.statusCode,
      },
    };
  }

  // Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return {
      success: false,
      error: {
        message: 'Database operation failed',
        statusCode: 500,
        details: error.message,
      },
    };
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        statusCode: 400,
        details: error.message,
      },
    };
  }

  // Unknown errors
  return {
    success: false,
    error: {
      message: 'Internal server error',
      statusCode: 500,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        stack: error.stack,
      }),
    },
  };
}

// Global error handler middleware
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Format and send response
  const formatted = formatError(error);
  const statusCode = formatted.error.statusCode || 500;

  res.status(statusCode).json(formatted);
}

// 404 handler
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
    },
  });
}
