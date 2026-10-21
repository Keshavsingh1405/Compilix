/**
 * Express application configuration and middleware assembly
 */

import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { apiLimiter } from './middleware/rate-limit.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

import healthRoutes from './routes/health.routes.js';
import languagesRoutes from './routes/languages.routes.js';
import executionRoutes from './routes/execution.routes.js';

const app = express();

// Security and CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) or matching FRONTEND_ORIGIN
    if (!origin || origin === config.FRONTEND_ORIGIN || config.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

// Body parsing with size guards
app.use(express.json({ limit: `${Math.ceil((config.MAX_CODE_SIZE_BYTES * 2) / 1024)}kb` }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Apply rate limiting to all API endpoints
app.use('/api', apiLimiter);

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/languages', languagesRoutes);
app.use('/api/execute', executionRoutes);

// Catch 404
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

export default app;
