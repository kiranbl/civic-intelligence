// FICTIONAL DEMO DATA ONLY. Replace all populations and metrics with verified
// data later. No values or requests in this seed come from official datasets.
import prisma from '../src/config/prisma.js';
import { demoDistricts, demoRequests, demoSource, demoYear } from './demoData.js';

async function seed() {
  const counts = { districts: 0, requests: 0, infrastructureMetrics: 0 };

  // Run as a single transaction; reruns preserve existing districts and only
  // insert missing demo records. Never delete or overwrite non-demo data.
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
        metricType: 'TAP_WATER_COVERAGE',
        source: demoSource,
        sourceYear: demoYear,
      };
      const existingMetric = await tx.infrastructureMetric.findFirst({ where: metricKey });
      if (!existingMetric) {
        await tx.infrastructureMetric.create({
          data: { ...metricKey, value: fixture.coverage, unit: 'percent' },
        });
      }
      counts.infrastructureMetrics += 1;

      for (const request of demoRequests(fixture.name)) {
        const existingRequest = await tx.citizenRequest.findFirst({
          where: { districtId: district.id, originalText: request.originalText },
        });
        if (!existingRequest) {
          await tx.citizenRequest.create({ data: { districtId: district.id, ...request } });
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
