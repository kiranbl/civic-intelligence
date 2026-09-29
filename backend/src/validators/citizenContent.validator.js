import { ServiceError } from '../errors/serviceError.js';

// Script-independent sanity only; civic meaning is assessed by the shared AI
// analysis. Do not blacklist SQL words or modify citizen text as sanitization.
export function validateCitizenContent(text) {
  const letters = text.normalize('NFKC').toLowerCase().match(/\p{L}/gu) ?? [];
  if (letters.length < 3 || new Set(letters).size < 2) throw new ServiceError('INVALID_CIVIC_CONTENT');
  return text;
}
