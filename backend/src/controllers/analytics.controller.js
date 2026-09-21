import { getWaterPriority } from '../services/waterPriority.service.js';

export async function getWaterPriorityAnalytics(req, res) {
  const result = await getWaterPriority();
  res.json({ success: true, ...result });
}
