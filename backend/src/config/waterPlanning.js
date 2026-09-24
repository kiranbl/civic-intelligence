// Prototype thresholds applied to the existing display-rounded analytics output.
export const WATER_PLANNING_THRESHOLDS = Object.freeze({ highDemand: 50, highGap: 20 });

export const WATER_PLANNING_ACTIONS = {
  HIGH_DEMAND_HIGH_GAP: {
    code: 'EXPLORE_ACCESS_EXPANSION',
    title: 'Explore targeted household water-access expansion',
    description: 'Investigate underserved rural areas, connection deficits, and localized infrastructure expansion needs. Construction is not automatically required.',
  },
  HIGH_DEMAND_LOW_GAP: {
    code: 'INVESTIGATE_SERVICE_RELIABILITY',
    title: 'Investigate localized water-supply reliability',
    description: 'Review interruptions, pipeline failures, pressure, supply regularity, and localized service issues before assuming the main problem is household connection access.',
  },
  LOW_DEMAND_HIGH_GAP: {
    code: 'VALIDATE_UNDERREPORTED_ACCESS_GAPS',
    title: 'Validate potentially under-reported access needs',
    description: 'Investigate whether low citizen-request volume reflects genuinely low demand or limited participation/reporting despite a significant infrastructure gap.',
  },
  LOW_DEMAND_LOW_GAP: {
    code: 'MONITOR_AND_MAINTAIN',
    title: 'Monitor coverage and maintain service quality',
    description: 'Continue monitoring demand and service reliability while prioritizing preventive maintenance and data quality.',
  },
  INSUFFICIENT_DATA: {
    code: 'REVIEW_DATA',
    title: 'Review available infrastructure data',
    description: 'A planning consideration cannot be generated reliably because required data is incomplete.',
  },
};

export const WATER_PLANNING_LIMITATIONS = [
  'Citizen demand currently contains synthetic seeded requests and locally created AI demonstration requests, not representative public complaints.',
  'Demand normalization is relative to the districts currently analysed; low observed demand does not establish low need.',
  'Census rural population reference year is 2011, not a current population estimate.',
  'The configured JJM snapshot is 21/09/2026; consult coverage provenance for the data actually available.',
  'Reported tap-connection coverage does not independently prove water quantity, quality, pressure, or supply regularity.',
  'This is a prototype planning aid, not an official government recommendation. Local verification is required.',
];
