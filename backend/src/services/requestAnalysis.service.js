import { geminiClient } from '../clients/gemini.client.js';
import { validateRequestText } from '../validators/citizenRequest.validator.js';
import { validateRequestAnalysis } from '../validators/requestAnalysis.validator.js';
import { validateCitizenContent } from '../validators/citizenContent.validator.js';
import { ServiceError } from '../errors/serviceError.js';

export async function analyzeCitizenText(input, client = geminiClient) {
  const text = validateCitizenContent(validateRequestText(input));
  const response = await client.analyze(text);
  const analysis = validateRequestAnalysis(response.text, text);
  if (!analysis.isCivicRequest) throw new ServiceError('INVALID_CIVIC_CONTENT');
  return { ...analysis, model: response.model };
}
