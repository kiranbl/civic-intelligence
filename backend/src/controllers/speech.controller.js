import { transcribeAudio } from '../services/speech.service.js';

export async function transcribe(req, res) {
  try {
    const data = await transcribeAudio(req.file.buffer, req.body.languageCode, req.body.districtName);
    res.json({ success: true, data });
  } finally {
    // Release references after the provider call; never write uploaded audio to disk/DB.
    if (req.file) req.file.buffer = undefined;
  }
}
