import 'dotenv/config';
import { ServiceError } from '../errors/serviceError.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_TIMEOUT_MS = 30000;

// Lazy validation: health and other non-AI endpoints work without a key.
export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!apiKey || !/^gemini-[a-zA-Z0-9._-]{1,180}$/.test(model)) throw new ServiceError('AI_NOT_CONFIGURED');
  return { apiKey, model };
}
