import { demoSource, demoYear } from '../../prisma/demoData.js';
import { RURAL_FHTC_METRIC_TYPE } from '../../src/config/waterPriority.js';
import { JJM_SOURCE, JJM_SOURCE_DATE, JJM_SOURCE_URL, JJM_FINANCIAL_YEAR } from '../../src/config/jjm.js';
import { calculateJjmCoverage, JJM_TARGETS } from './jjmCoverageData.js';

export async function importJjmCoverage(records, { dryRun = true, getClient, log = console.log, table = console.table } = {}) {
  if (records.length !== 8 || new Set(records.map(row => row.applicationDistrictName)).size !== 8) throw new Error('Expected eight unique validated districts.');
  for (const row of records) {
    const result = calculateJjmCoverage(row.pwsHouseholds, row.nonPwsUnconnectedHouseholds, row.privateHouseholds, row.tapConnectedHouseholds);
    if (!JJM_TARGETS.includes(row.applicationDistrictName) || row.source !== JJM_SOURCE || row.sourceDate !== JJM_SOURCE_DATE
      || row.financialYear !== JJM_FINANCIAL_YEAR || row.householdReconciliation !== 'MATCH' || row.connectionReconciliation !== 'MATCH'
      || result.totalReportedRuralHouseholds !== row.totalReportedRuralHouseholds || result.ruralFhtcCoverage !== row.ruralFhtcCoverage) {
      throw new Error('Invalid reconciled JJM record.');
    }
  }
  log('JJM reported rural household tap-connection coverage. Reported Till 21/09/2026; Financial Year 2026-2027.');
  log('Not independently verified water-service functionality. C / (H + U) * 100; private connections validated as zero.');
  table(records.map(row => ({ district: row.applicationDistrictName, J1: row.j1SourceDistrictName, J5: row.j5SourceDistrictName,
    pwsHouseholds: row.pwsHouseholds, nonPwsUnconnected: row.nonPwsUnconnectedHouseholds,
    totalRuralHouseholds: row.totalReportedRuralHouseholds, tapConnected: row.tapConnectedHouseholds,
    coverage: row.ruralFhtcCoverage.toFixed(2), households: row.householdReconciliation, connections: row.connectionReconciliation })));
  if (dryRun) {
    log('Dry run: zero database connections or writes. Database replacement eligibility has not been checked.');
    return { matched: 8, updated: 0, dryRun: true };
  }
  const prisma = await getClient();
  return prisma.$transaction(async tx => {
    const districts = await tx.district.findMany({ where: { state: 'Karnataka', name: { in: JJM_TARGETS } }, select: { id: true, name: true } });
    if (districts.length !== 8 || new Set(districts.map(row => row.name)).size !== 8
      || JJM_TARGETS.some(name => !districts.some(row => row.name === name))) throw new Error('Database must contain all eight target districts.');
    const metrics = await tx.infrastructureMetric.findMany({ where: { districtId: { in: districts.map(row => row.id) }, metricType: RURAL_FHTC_METRIC_TYPE } });
    // Preflight the whole set before updating. Never delete unknown or duplicate records.
    const updates = records.map(row => {
      const district = districts.find(d => d.name === row.applicationDistrictName);
      const matches = metrics.filter(metric => metric.districtId === district.id);
      if (matches.length !== 1) throw new Error(`Expected exactly one existing rural coverage metric for ${district.name}.`);
      const metric = matches[0];
      const demo = metric.source === demoSource && metric.sourceYear === demoYear;
      const sameSnapshot = metric.source === JJM_SOURCE && metric.sourceYear === 2026
        && metric.sourceDate?.toISOString() === `${JJM_SOURCE_DATE}T00:00:00.000Z`;
      if (!demo && !sameSnapshot) throw new Error(`Refusing to overwrite an unrelated source for ${district.name}.`);
      const data = { value: row.ruralFhtcCoverage, unit: 'PERCENT', source: JJM_SOURCE, sourceYear: 2026,
        sourceDate: new Date(`${JJM_SOURCE_DATE}T00:00:00.000Z`), sourceUrl: JJM_SOURCE_URL };
      return { metric, data };
    });
    let updated = 0;
    for (const { metric, data } of updates) {
      if (Object.entries(data).every(([key, value]) => value instanceof Date
        ? metric[key]?.getTime() === value.getTime() : metric[key] === value)) continue;
      await tx.infrastructureMetric.update({ where: { id: metric.id }, data });
      updated++;
    }
    return { matched: 8, updated, dryRun: false };
  }, { isolationLevel: 'Serializable' });
}
