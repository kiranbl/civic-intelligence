import { getWaterPriority } from '../services/waterPriority.service.js';
import { getWaterPlanning } from '../services/waterPlanning.service.js';
import { getCitizenPriorities } from '../services/citizenPriorities.service.js';

export async function getCitizenPriorityAnalytics(req, res) {
  res.json({ success: true, data: await getCitizenPriorities() });
}

export async function getWaterPlanningAnalytics(req, res) {
  const result = await getWaterPlanning();
  res.json({ success: true, ...result });
}

export async function getWaterPriorityAnalytics(req, res) {
  const result = await getWaterPriority();
  res.json({ success: true, ...result });
}
