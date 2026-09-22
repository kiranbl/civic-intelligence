import { analyzeCitizenText } from '../../src/services/requestAnalysis.service.js';
import { ServiceError } from '../../src/errors/serviceError.js';

// Explicit manual command only. No Prisma import and no database writes.
const samples = [
  'The drinking water pipeline in our village has been broken for two weeks and around 40 houses are not getting water.',
  'ನಮ್ಮ ಗ್ರಾಮದ ಕುಡಿಯುವ ನೀರಿನ ಪೈಪ್ ಎರಡು ವಾರಗಳಿಂದ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ. ಸುಮಾರು 40 ಮನೆಗಳಿಗೆ ನೀರು ಬರುತ್ತಿಲ್ಲ.',
  'हमारे गांव में दो हफ्तों से पीने के पानी की पाइपलाइन खराब है और लगभग 40 घरों में पानी नहीं आ रहा है।',
];
try {
  if (!process.env.GEMINI_API_KEY?.trim()) throw new ServiceError('AI_NOT_CONFIGURED');
  for (const text of samples) console.log(JSON.stringify({ text, analysis: await analyzeCitizenText(text) }, null, 2));
} catch (error) {
  console.error(error instanceof ServiceError ? error.message : 'Gemini smoke test failed');
  process.exitCode = 1;
}
