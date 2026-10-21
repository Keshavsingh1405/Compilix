/**
 * Execution routes
 */

import { Router } from 'express';
import { execute } from '../controllers/execution.controller.js';
import { validateExecutionRequest } from '../validators/execution.validator.js';
import { executionLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

router.post('/', executionLimiter, validateExecutionRequest, execute);

export default router;
