/**
 * Custom error hierarchy for Compilix
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ExecutionError extends AppError {
  constructor(message, status = 'execution_error', statusCode = 500) {
    super(message, statusCode, 'EXECUTION_ERROR');
    this.status = status;
  }
}

export class DockerUnavailableError extends AppError {
  constructor(message = 'Docker execution engine is currently unavailable') {
    super(message, 503, 'DOCKER_UNAVAILABLE');
  }
}
