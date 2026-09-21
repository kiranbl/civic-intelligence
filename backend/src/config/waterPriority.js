// Prototype heuristic configuration, not an official methodology or AI model.
export const WATER_PRIORITY_WEIGHTS = {
  demand: 0.5,
  infrastructureGap: 0.5,
};

export const WATER_PRIORITY_LEVELS = [
  { minimumScore: 75, level: 'VERY_HIGH' },
  { minimumScore: 50, level: 'HIGH' },
  { minimumScore: 25, level: 'MEDIUM' },
  { minimumScore: 0, level: 'LOW' },
];

export const EQUAL_DEMAND_INDEX = 0;
export const TAP_WATER_METRIC_TYPE = 'TAP_WATER_COVERAGE';

export const WATER_PRIORITY_METHODOLOGY = {
  description: 'Prototype relative infrastructure-priority heuristic; not an official government methodology or an AI prediction.',
  demandWeight: WATER_PRIORITY_WEIGHTS.demand,
  infrastructureGapWeight: WATER_PRIORITY_WEIGHTS.infrastructureGap,
  equalDemandIndex: EQUAL_DEMAND_INDEX,
  normalization: 'All returned districts with valid population participate, including those missing coverage.',
  coverageSelection: 'Newest sourceYear, then createdAt, then id; invalid newest values are not replaced with older values.',
  missingData: 'Missing or invalid coverage or population produces INCOMPLETE results and null for unavailable calculations.',
  rounding: 'Calculate at full precision, round display values to two decimals, and classify the rounded priority score.',
};
