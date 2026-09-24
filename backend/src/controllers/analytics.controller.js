import { getWaterPriority } from '../services/waterPriority.service.js';
import { getWaterPlanning } from '../services/waterPlanning.service.js';

export async function getWaterPlanningAnalytics(req, res) {
  const result = await getWaterPlanning();
  res.json({ success: true, ...result });
}

export async function getWaterPriorityAnalytics(req, res) {
  const result = await getWaterPriority();
  res.json({ success: true, ...result });
}
