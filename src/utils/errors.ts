// Extend the Error interface to include captureStackTrace
declare interface ErrorConstructor {
  captureStackTrace(targetObject: object, constructorOpt?: Function): void;
}

// Base error class for application-specific errors
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NetworkError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', 503, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 'AUTHZ_ERROR', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} service is currently unavailable`, 'SERVICE_UNAVAILABLE', 503);
  }
}

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && 'code' in error && 'statusCode' in error;
}

// Type guard for network errors
export function isNetworkError(error: unknown): error is { status: number; statusText: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'statusText' in error
  );
}

// Helper function to convert unknown errors to AppError
export function toAppError(error: unknown, defaultMessage = 'An unexpected error occurred'): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new NetworkError('Request was aborted');
    }
    return new AppError(error.message, 'UNKNOWN_ERROR', 500, error);
  }

  if (typeof error === 'string') {
    return new AppError(error, 'UNKNOWN_ERROR');
  }

  return new AppError(defaultMessage, 'UNKNOWN_ERROR', 500, error);
}
