/**
 * Rate limiting middleware for Compilix API
 */

import rateLimit from 'express-rate-limit';

// Standard rate limiter for all general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again after 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

// Stricter rate limiter specifically for resource-heavy code execution
export const executionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 executions per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      message: 'Too many code execution requests. Please wait before running more code.',
      code: 'EXECUTION_RATE_LIMIT_EXCEEDED'
    }
  }
});
