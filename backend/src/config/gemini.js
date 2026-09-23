import 'dotenv/config';
import { ServiceError } from '../errors/serviceError.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_FALLBACK_MODELS = Object.freeze(['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
export const GEMINI_RETRY_JITTER_MS = 250;
export const GEMINI_RETRY_DELAYS_MS = Object.freeze([1000, 2000, 4000]);
export const GEMINI_RETRYABLE_STATUSES = Object.freeze([408, 429, 500, 502, 503, 504]);
export const GEMINI_TIMEOUT_MS = 30000;

// Lazy validation: health and other non-AI endpoints work without a key.
export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const fallbackModels = process.env.GEMINI_FALLBACK_MODELS === undefined
    ? [...DEFAULT_GEMINI_FALLBACK_MODELS]
    : process.env.GEMINI_FALLBACK_MODELS.split(',').map(value => value.trim());
  if (!apiKey || ![model, ...fallbackModels].every(value => /^gemini-[a-zA-Z0-9._-]{1,180}$/.test(value))) throw new ServiceError('AI_NOT_CONFIGURED');
  return { apiKey, model, fallbackModels: [...new Set(fallbackModels)].filter(value => value !== model) };
}
