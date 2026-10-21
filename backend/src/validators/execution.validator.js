/**
 * Request validator for code execution
 */

import { config } from '../config/env.js';
import { ValidationError } from '../utils/errors.js';

export const SUPPORTED_LANGUAGES = ['cpp', 'java', 'python', 'javascript'];

export function validateExecutionRequest(req, _res, next) {
  const { language, code, stdin } = req.body || {};

  // 1. Language validation
  if (!language || typeof language !== 'string') {
    throw new ValidationError('Field "language" is required and must be a string.');
  }

  const normalizedLang = language.trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.includes(normalizedLang)) {
    throw new ValidationError(
      `Unsupported language "${language}". Supported languages are: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      { supportedLanguages: SUPPORTED_LANGUAGES }
    );
  }

  // 2. Code validation
  if (code === undefined || code === null || typeof code !== 'string') {
    throw new ValidationError('Field "code" is required and must be a string.');
  }

  if (code.trim().length === 0) {
    throw new ValidationError('Source code cannot be empty.');
  }

  const codeSizeBytes = Buffer.byteLength(code, 'utf8');
  if (codeSizeBytes > config.MAX_CODE_SIZE_BYTES) {
    throw new ValidationError(
      `Source code size (${codeSizeBytes} bytes) exceeds maximum permitted size of ${config.MAX_CODE_SIZE_BYTES} bytes.`
    );
  }

  // 3. Stdin validation (optional, but must be string if present)
  if (stdin !== undefined && stdin !== null) {
    if (typeof stdin !== 'string') {
      throw new ValidationError('Field "stdin" must be a string if provided.');
    }

    const stdinSizeBytes = Buffer.byteLength(stdin, 'utf8');
    if (stdinSizeBytes > config.MAX_STDIN_SIZE_BYTES) {
      throw new ValidationError(
        `Standard input size (${stdinSizeBytes} bytes) exceeds maximum permitted size of ${config.MAX_STDIN_SIZE_BYTES} bytes.`
      );
    }
  }

  // Attach sanitized fields to req
  req.sanitized = {
    language: normalizedLang,
    code,
    stdin: typeof stdin === 'string' ? stdin : ''
  };

  next();
}
