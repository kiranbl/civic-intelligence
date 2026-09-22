import { Router } from 'express';
import { analyze, create } from '../controllers/citizenRequest.controller.js';
import { validateAnalyzeRequest, validateCreateRequest } from '../validators/citizenRequest.validator.js';

const router = Router();
router.post('/analyze', validateAnalyzeRequest, analyze);
router.post('/', validateCreateRequest, create);
export default router;
