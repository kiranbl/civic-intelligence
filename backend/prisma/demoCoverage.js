import { demoSource, demoYear } from './demoData.js';
import { RURAL_FHTC_METRIC_TYPE } from '../src/config/waterPriority.js';

export async function ensureDemoCoverage(tx, districtId, coverage) {
  const metricKey = { districtId, metricType: RURAL_FHTC_METRIC_TYPE };
  const existing = await tx.infrastructureMetric.findMany({ where: metricKey });
  const legacy = await tx.infrastructureMetric.findMany({ where: {
    districtId, metricType: 'TAP_WATER_COVERAGE', source: demoSource, sourceYear: demoYear,
  } });
  if (existing.length > 1 || legacy.length > 1 || (existing.length && legacy.length)) {
    throw new Error('Ambiguous duplicate coverage metrics; refusing to choose or delete one.');
  }
  // In particular, preserve the official metric and do not recreate demo coverage.
  if (existing.length) return;
  if (legacy.length) {
    await tx.infrastructureMetric.update({ where: { id: legacy[0].id }, data: { metricType: RURAL_FHTC_METRIC_TYPE } });
  } else {
    await tx.infrastructureMetric.create({ data: { ...metricKey, value: coverage, unit: 'percent', source: demoSource, sourceYear: demoYear } });
  }
}
