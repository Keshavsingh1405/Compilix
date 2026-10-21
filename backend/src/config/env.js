/**
 * Environment configuration and startup validation
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root or parent root if not loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function parseNumber(val, defaultValue) {
  if (val === undefined || val === null || val === '') return defaultValue;
  const num = Number(val);
  return Number.isNaN(num) ? defaultValue : num;
}

export const config = {
  PORT: parseNumber(process.env.PORT, 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  EXECUTION_TIMEOUT_MS: parseNumber(process.env.EXECUTION_TIMEOUT_MS, 10000),
  MAX_CODE_SIZE_BYTES: parseNumber(process.env.MAX_CODE_SIZE_BYTES, 65536), // 64 KB
  MAX_STDIN_SIZE_BYTES: parseNumber(process.env.MAX_STDIN_SIZE_BYTES, 65536), // 64 KB
  MAX_OUTPUT_SIZE_BYTES: parseNumber(process.env.MAX_OUTPUT_SIZE_BYTES, 262144), // 256 KB
  MAX_CONCURRENT_EXECUTIONS: parseNumber(process.env.MAX_CONCURRENT_EXECUTIONS, 5),
  DOCKER_CPU_LIMIT: process.env.DOCKER_CPU_LIMIT || '1.0',
  DOCKER_MEMORY_LIMIT: process.env.DOCKER_MEMORY_LIMIT || '256m',
  DOCKER_PIDS_LIMIT: parseNumber(process.env.DOCKER_PIDS_LIMIT, 64)
};

// Validate critical bounds
if (config.EXECUTION_TIMEOUT_MS < 1000 || config.EXECUTION_TIMEOUT_MS > 60000) {
  console.warn(`[Config Warning] EXECUTION_TIMEOUT_MS (${config.EXECUTION_TIMEOUT_MS}ms) outside typical range (1000-60000ms). Resetting to 10000ms.`);
  config.EXECUTION_TIMEOUT_MS = 10000;
}

if (config.MAX_CODE_SIZE_BYTES < 1024) {
  config.MAX_CODE_SIZE_BYTES = 65536;
}
