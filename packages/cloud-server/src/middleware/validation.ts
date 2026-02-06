import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types/errors.js';

// Validate required fields in request body
export function validateRequired(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter((field) => !(field in req.body));

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required fields: ${missing.join(', ')}`
      );
    }

    next();
  };
}

// Validate property status
export function validatePropertyStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { status } = req.body;

  const validStatuses = [
    'PENDING_SCRAPE',
    'READY_FOR_FIELD',
    'VISITED',
    'READY_FOR_SUBMISSION',
    'COMPLETE',
    'FAILED',
  ];

  if (status && !validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status: ${status}`);
  }

  next();
}
