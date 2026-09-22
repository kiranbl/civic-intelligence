import { geminiClient } from '../clients/gemini.client.js';
import { validateRequestText } from '../validators/citizenRequest.validator.js';
import { validateRequestAnalysis } from '../validators/requestAnalysis.validator.js';

export async function analyzeCitizenText(input) {
  const text = validateRequestText(input);
  const response = await geminiClient.analyze(text);
  return { ...validateRequestAnalysis(response.text, text), model: response.model };
}
