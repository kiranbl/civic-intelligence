import { sanitizeLocationText } from './locationText.js';
import { WATER_SUBCATEGORIES } from '../config/waterSubcategories.js';
import Ajv from 'ajv';
import { REQUEST_ANALYSIS_SCHEMA } from '../schemas/requestAnalysis.schema.js';
import { ServiceError } from '../errors/serviceError.js';

const validate = new Ajv({ strict: true, coerceTypes: false, removeAdditional: false }).compile(REQUEST_ANALYSIS_SCHEMA);
export function validateRequestAnalysis(raw, originalText) {
  let result;
  try {
    if (typeof raw !== 'string' || raw.length > 16000) throw new Error();
    result = JSON.parse(raw);
  } catch {
    throw new ServiceError('AI_INVALID_OUTPUT');
  }
  if (!validate(result)) throw new ServiceError('AI_INVALID_OUTPUT');
  result.locationText = sanitizeLocationText(result.locationText);
  // Optional for compatibility with older structured results. Never accept
  // a romanized location without an evidenced original-script place.
  if (result.locationTextLatin !== undefined && result.locationTextLatin !== null) {
    result.locationTextLatin = result.locationTextLatin.trim();
    if (!result.locationTextLatin || !/^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Zs}]+$/u.test(result.locationTextLatin)
      || !/\p{Script=Latin}/u.test(result.locationTextLatin)) throw new ServiceError('AI_INVALID_OUTPUT');
    if (result.locationText === null) result.locationTextLatin = null;
  }
  if ((result.category === 'WATER' && result.subcategory !== null && !WATER_SUBCATEGORIES.includes(result.subcategory)) || !result.summaryEnglish.trim() || result.summaryEnglish.length > 1000
    || (result.subcategory !== null && !/^[A-Z][A-Z0-9_]{0,63}$/.test(result.subcategory))
    || (result.locationText !== null && (!result.locationText.trim() || result.locationText.length > 191
      || !originalText.includes(result.locationText)))) {
    throw new ServiceError('AI_INVALID_OUTPUT');
  }
  // Schema rejects unknown fields rather than dropping them, including IDs/scores.
  return result;
}
