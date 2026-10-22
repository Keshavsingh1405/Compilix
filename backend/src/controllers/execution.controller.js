/**
 * Execution Controller
 * Handles incoming code execution requests, passes sanitized data to service, returns result.
 */

import { executeCode } from '../services/execution.service.js';

export async function execute(req, res, next) {
  try {
    const { language, code, stdin, filename } = req.sanitized;
    const result = await executeCode({ language, code, stdin, filename });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
