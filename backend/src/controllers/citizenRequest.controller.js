import { analyzeCitizenText } from '../services/requestAnalysis.service.js';
import { createCitizenRequest } from '../services/citizenRequest.service.js';

export async function analyze(req, res) {
  const data = await analyzeCitizenText(res.locals.input.text);
  res.json({ success: true, data });
}

export async function create(req, res) {
  const data = await createCitizenRequest(res.locals.input);
  res.status(201).json({ success: true, data });
}
