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
  if (!validate(result) || !result.summaryEnglish.trim() || result.summaryEnglish.length > 1000
    || (result.subcategory !== null && !/^[A-Z][A-Z0-9_]{0,63}$/.test(result.subcategory))
    || (result.locationText !== null && (!result.locationText.trim() || result.locationText.length > 191
      || !originalText.includes(result.locationText)))) {
    throw new ServiceError('AI_INVALID_OUTPUT');
  }
  // Schema rejects unknown fields rather than dropping them, including IDs/scores.
  return result;
}
