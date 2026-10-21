/**
 * Languages API routes
 */

import { Router } from 'express';
import { getLanguages } from '../controllers/languages.controller.js';

const router = Router();

router.get('/', getLanguages);

export default router;
