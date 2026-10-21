/**
 * Execution orchestration service
 */

import { executeInDocker } from './docker.service.js';

export async function executeCode({ language, code, stdin }) {
  const result = await executeInDocker({ language, code, stdin });
  return result;
}
