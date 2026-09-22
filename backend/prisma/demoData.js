// DEMO ONLY: All populations, water coverage values, and requests are fictional.
// These numbers are NOT Census data or any official dataset.
// REPLACE these fixtures with verified data before any real-world planning use.
export const demoDistricts = [
  { name: 'Bengaluru Urban', population: 120000, coverage: 72 },
  { name: 'Bengaluru Rural', population: 80000, coverage: 54 },
  { name: 'Mysuru', population: 95000, coverage: 68 },
  { name: 'Mandya', population: 65000, coverage: 49 },
  { name: 'Tumakuru', population: 85000, coverage: 58 },
  { name: 'Hassan', population: 70000, coverage: 61 },
  { name: 'Kolar', population: 55000, coverage: 46 },
  { name: 'Ramanagara', population: 60000, coverage: 52 },
];

export const demoSource = 'FICTIONAL DEMO ONLY - replace with verified data';
export const demoYear = 2026;

// Intentional synthetic rural-water scenario. These are not real submissions.
// The Kannada road text explicitly describes a village. Other contexts are unknown.

export function demoRequests(districtName) {
  return [
    {
      originalText: `[DEMO ONLY - ${districtName}] Our street needs a reliable tap water supply.`,
      language: 'en', channel: 'TEXT', category: 'WATER', areaType: 'RURAL', urgency: 'HIGH',
    },
    {
      originalText: `[DEMO ONLY - ${districtName}] ನಮ್ಮ ಗ್ರಾಮದ ರಸ್ತೆಯ ಗುಂಡಿಗಳನ್ನು ದಯವಿಟ್ಟು ಸರಿಪಡಿಸಿ.`,
      language: 'kn', channel: 'MESSAGING', category: 'ROADS', areaType: 'RURAL', urgency: 'MEDIUM',
    },
    {
      originalText: `[DEMO ONLY - ${districtName}] हमारे इलाके में नियमित कचरा संग्रह की व्यवस्था चाहिए।`,
      language: 'hi', channel: 'VOICE', category: 'SANITATION', areaType: 'UNKNOWN', urgency: 'MEDIUM',
    },
    {
      originalText: `[DEMO ONLY - ${districtName}] Please add an evening bus service to the nearby clinic.`,
      language: 'en', channel: 'TEXT', category: 'TRANSPORT', areaType: 'UNKNOWN', urgency: 'LOW',
    },
  ];
}
