/**
 * Centralized error handling and 404 middleware
 */

import { AppError } from '../utils/errors.js';
import { config } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  const err = new AppError(`Resource not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(err);
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isProduction = config.NODE_ENV === 'production';

  // Log error on server side (exclude sensitive info)
  if (statusCode >= 500) {
    console.error(`[Server Error] ${err.name}: ${err.message}`);
    if (!isProduction && err.stack) {
      console.error(err.stack);
    }
  } else {
    console.warn(`[Client Error ${statusCode}] ${err.message}`);
  }

  const responseBody = {
    success: false,
    error: {
      message: statusCode >= 500 && isProduction
        ? 'An unexpected server error occurred. Please try again later.'
        : err.message,
      code: err.code || 'INTERNAL_ERROR'
    }
  };

  if (err.details) {
    responseBody.error.details = err.details;
  }

  res.status(statusCode).json(responseBody);
}
