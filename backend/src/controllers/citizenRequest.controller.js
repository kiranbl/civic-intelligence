import { analyzeCitizenRequest, createCitizenRequest } from '../services/citizenRequest.service.js';

export async function analyze(req, res) {
  const data = await analyzeCitizenRequest(res.locals.input);
  res.json({ success: true, data });
}

export async function create(req, res) {
  const data = await createCitizenRequest(res.locals.input);
  res.status(201).json({ success: true, data });
}
