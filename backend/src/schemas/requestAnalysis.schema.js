// Gemini-supported JSON Schema. Length/identifier/evidence checks are also
// enforced in application code because not every JSON Schema keyword is supported.
export const REQUEST_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['language', 'category', 'subcategory', 'urgency', 'areaType', 'summaryEnglish', 'locationText', 'confidence'],
  properties: {
    language: { type: 'string', enum: ['en', 'kn', 'hi', 'other'] },
    category: { type: 'string', enum: ['WATER', 'ROADS', 'HEALTHCARE', 'EDUCATION', 'SANITATION', 'TRANSPORT', 'ELECTRICITY', 'OTHER'] },
    subcategory: { type: ['string', 'null'], description: 'Null or a short uppercase identifier, at most 64 characters, such as WATER_SUPPLY_INTERRUPTION.' },
    urgency: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    areaType: { type: 'string', enum: ['RURAL', 'URBAN', 'UNKNOWN'] },
    summaryEnglish: { type: 'string', description: 'Concise English summary, at most 1000 characters. Preserve meaning; do not add facts.' },
    locationText: { type: ['string', 'null'], description: 'Null or an explicitly mentioned place copied verbatim in its original script, at most 191 characters.' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
};
