// FICTIONAL DEMO DATA ONLY. Replace all populations and metrics with verified
// data later. No values or requests in this seed come from official datasets.
import prisma from '../src/config/prisma.js';
import { demoDistricts, demoRequests, demoSource, demoYear } from './demoData.js';
import { RURAL_FHTC_METRIC_TYPE } from '../src/config/waterPriority.js';

async function seed() {
  const counts = { districts: 0, requests: 0, infrastructureMetrics: 0 };

  // Run as a single transaction; reruns preserve existing districts and only
  // insert missing demo records and align exact demo records with rural semantics.
  // Never delete or overwrite non-demo data or imported populations.
  await prisma.$transaction(async (tx) => {
    for (const fixture of demoDistricts) {
      const district = await tx.district.upsert({
        where: { name_state: { name: fixture.name, state: 'Karnataka' } },
        update: {},
        create: { name: fixture.name, state: 'Karnataka', population: fixture.population },
      });
      counts.districts += 1;

      const metricKey = {
        districtId: district.id,
        metricType: RURAL_FHTC_METRIC_TYPE,
        source: demoSource,
        sourceYear: demoYear,
      };
      // Only rename legacy metrics with the exact fictional source/year/district.
      const legacyKey = { ...metricKey, metricType: 'TAP_WATER_COVERAGE' };
      const existingMetric = await tx.infrastructureMetric.findFirst({ where: metricKey });
      const legacyMetrics = await tx.infrastructureMetric.findMany({ where: legacyKey });
      if (legacyMetrics.length > 1 || (existingMetric && legacyMetrics.length)) {
        throw new Error('Ambiguous duplicate demo coverage metrics; refusing to choose or delete one.');
      }
      if (!existingMetric) {
        if (legacyMetrics.length === 1) {
          await tx.infrastructureMetric.update({ where: { id: legacyMetrics[0].id }, data: { metricType: RURAL_FHTC_METRIC_TYPE } });
        } else {
          await tx.infrastructureMetric.create({ data: { ...metricKey, value: fixture.coverage, unit: 'percent' } });
        }
      }
      counts.infrastructureMetrics += 1;

      for (const request of demoRequests(fixture.name)) {
        const existingRequest = await tx.citizenRequest.findFirst({
          where: { districtId: district.id, originalText: request.originalText, category: request.category, language: request.language, channel: request.channel },
        });
        if (!existingRequest) {
          await tx.citizenRequest.create({ data: { districtId: district.id, ...request } });
        } else if (existingRequest.areaType !== request.areaType) {
          await tx.citizenRequest.update({ where: { id: existingRequest.id }, data: { areaType: request.areaType } });
        }
        counts.requests += 1;
      }
    }
  }, { timeout: 30000 });

  console.log('Fictional demo records present after seed:', counts);
}

seed()
  .catch(() => {
    // Do not print connection details from Prisma errors.
    console.error('Demo seed failed. Check local database configuration and migrations.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
