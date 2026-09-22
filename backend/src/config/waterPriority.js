import { JJM_CONTEXT, JJM_SOURCE, JJM_SOURCE_DATE } from './jjm.js';

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
export const RURAL_FHTC_METRIC_TYPE = 'RURAL_FHTC_COVERAGE';

export const WATER_PRIORITY_METHODOLOGY = {
  scope: 'Rural water infrastructure prototype',
  infrastructureContext: JJM_CONTEXT,
  coverageData: 'JJM import is pending; existing fictional demo metrics must not be described as official coverage.',
  populationContext: 'Census of India 2011 rural population; historical context rather than current population. Coverage measures rural households, not persons; these are separate heuristic components.',
  citizenDemand: 'Fictional/synthetic demo citizen requests, not observed citizen demand.',
  description: 'Prototype relative infrastructure-priority heuristic; not an official government methodology or an AI prediction.',
  demandWeight: WATER_PRIORITY_WEIGHTS.demand,
  infrastructureGapWeight: WATER_PRIORITY_WEIGHTS.infrastructureGap,
  equalDemandIndex: EQUAL_DEMAND_INDEX,
  normalization: 'All returned districts with valid positive rural population participate, including those missing coverage. Counts include only WATER requests explicitly marked RURAL; URBAN and UNKNOWN are excluded.',
  coverageSelection: 'Newest sourceYear, then createdAt, then id; invalid newest values are not replaced with older values.',
  missingData: 'Missing or invalid coverage or ruralPopulation produces INCOMPLETE results and null for unavailable calculations.',
  rounding: 'Calculate at full precision, round display values to two decimals, and classify the rounded priority score.',
};

// Keep the pending dry-run deployment truthful, and reflect the actual selected
// sources after import. This changes metadata only, never the scoring formula.
export function waterPriorityMethodology(districts) {
  const metrics = districts.map(row => row.infrastructure[0]).filter(Boolean);
  const official = metrics.filter(row => row.source === JJM_SOURCE && row.sourceYear === 2026
    && row.sourceDate?.toISOString() === `${JJM_SOURCE_DATE}T00:00:00.000Z`).length;
  const demo = metrics.filter(row => row.source?.startsWith('FICTIONAL DEMO ONLY')).length;
  let coverageData = 'Coverage sources are missing, mixed, or unrecognized; inspect stored metric provenance.';
  if (metrics.length && official === metrics.length) coverageData = JJM_CONTEXT;
  else if (metrics.length && demo === metrics.length) coverageData = WATER_PRIORITY_METHODOLOGY.coverageData;
  return { ...WATER_PRIORITY_METHODOLOGY, coverageData };
}
