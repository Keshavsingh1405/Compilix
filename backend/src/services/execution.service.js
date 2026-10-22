/**
 * Execution orchestration service
 */

import { executeInDocker } from './docker.service.js';

export async function executeCode({ language, code, stdin, filename }) {
  const result = await executeInDocker({ language, code, stdin, filename });
  return result;
}
