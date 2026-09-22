import prisma from '../config/prisma.js';
import { getDistrictById } from './district.service.js';
import { analyzeCitizenText } from './requestAnalysis.service.js';

export async function createCitizenRequest({ districtId, text, channel }) {
  await getDistrictById(districtId); // Avoid a paid AI call for a nonexistent district.
  const analysis = await analyzeCitizenText(text);
  // Explicit mapping: model output never supplies IDs, coordinates or DB operations.
  return prisma.citizenRequest.create({
    data: {
      districtId, originalText: text, channel,
      language: analysis.language, category: analysis.category,
      subcategory: analysis.subcategory, urgency: analysis.urgency, areaType: analysis.areaType,
      summaryEnglish: analysis.summaryEnglish, locationText: analysis.locationText,
      aiModel: analysis.model, aiConfidence: analysis.confidence, aiProcessedAt: new Date(),
    },
  });
}
