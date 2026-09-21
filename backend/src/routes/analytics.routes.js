import { Router } from 'express';
import { getWaterPriorityAnalytics } from '../controllers/analytics.controller.js';

const router = Router();

router.get('/water-priority', getWaterPriorityAnalytics);

export default router;
