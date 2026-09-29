import { Router } from 'express';
import { getWaterPriorityAnalytics, getWaterPlanningAnalytics, getCitizenPriorityAnalytics } from '../controllers/analytics.controller.js';

const router = Router();
router.get('/citizen-priorities', getCitizenPriorityAnalytics);

router.get('/water-priority', getWaterPriorityAnalytics);
router.get('/water-planning', getWaterPlanningAnalytics);

export default router;
