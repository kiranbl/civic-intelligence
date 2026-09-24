import { Router } from 'express';
import { getWaterPriorityAnalytics, getWaterPlanningAnalytics } from '../controllers/analytics.controller.js';

const router = Router();

router.get('/water-priority', getWaterPriorityAnalytics);
router.get('/water-planning', getWaterPlanningAnalytics);

export default router;
