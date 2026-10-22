/**
 * Request validator for code execution
 */

import { config } from '../config/env.js';
import { ValidationError } from '../utils/errors.js';

export const SUPPORTED_LANGUAGES = ['cpp', 'java', 'python', 'javascript'];

const LANGUAGE_EXTENSIONS = {
  cpp: /\.(cpp|cc|cxx)$/i,
  java: /\.java$/i,
  python: /\.py$/i,
  javascript: /\.(js|mjs)$/i
};

export function validateExecutionRequest(req, _res, next) {
  const { language, code, stdin, filename } = req.body || {};

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

  // 4. Filename validation and resolution
  let sanitizedFilename = null;
  if (filename !== undefined && filename !== null) {
    if (typeof filename !== 'string') {
      throw new ValidationError('Field "filename" must be a string if provided.');
    }
    const trimmed = filename.trim();
    if (trimmed.length > 0) {
      if (
        trimmed.length > 128 ||
        trimmed.includes('..') ||
        trimmed.includes('/') ||
        trimmed.includes('\\') ||
        /[\0\r\n\t]/.test(trimmed) ||
        !/^[a-zA-Z0-9_.-]+$/.test(trimmed)
      ) {
        throw new ValidationError('Invalid filename. Filename must be a safe filename without path separators or special characters.');
      }

      const extPattern = LANGUAGE_EXTENSIONS[normalizedLang];
      if (!extPattern || !extPattern.test(trimmed)) {
        throw new ValidationError(`Filename "${trimmed}" does not match the expected extension for language "${normalizedLang}".`);
      }

      sanitizedFilename = trimmed;
    }
  }

  // If filename was not provided, infer or assign standard default
  if (!sanitizedFilename) {
    if (normalizedLang === 'java') {
      // In Java, if a public class is declared, the source file must match that class name
      const publicClassMatch = code.match(/\bpublic\s+(?:final\s+|abstract\s+)*class\s+([a-zA-Z0-9_$]+)\b/);
      if (publicClassMatch) {
        sanitizedFilename = `${publicClassMatch[1]}.java`;
      } else {
        const anyClassMatch = code.match(/\bclass\s+([a-zA-Z0-9_$]+)\b/);
        sanitizedFilename = anyClassMatch ? `${anyClassMatch[1]}.java` : 'Main.java';
      }
    } else {
      const defaults = {
        cpp: 'main.cpp',
        python: 'main.py',
        javascript: 'main.js'
      };
      sanitizedFilename = defaults[normalizedLang] || 'main.txt';
    }
  }

  // Attach sanitized fields to req
  req.sanitized = {
    language: normalizedLang,
    code,
    stdin: typeof stdin === 'string' ? stdin : '',
    filename: sanitizedFilename
  };

  next();
}
