// Base error class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error (400)
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

// Not found error (404)
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(404, message);
  }
}

// Conflict error (409)
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

// Unprocessable entity error (422)
export class UnprocessableEntityError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}
