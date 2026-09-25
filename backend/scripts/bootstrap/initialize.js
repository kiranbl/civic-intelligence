import { BootstrapError, loadBaseline } from './baseline.js';

const matches = (row, expected) => Object.entries(expected).every(([key, value]) => value instanceof Date
  ? row[key] instanceof Date && row[key].getTime() === value.getTime() : row[key] === value);

async function inspect(tx, baseline) {
  const districts = await tx.district.findMany();
  const metrics = await tx.infrastructureMetric.findMany();
  const requestCount = await tx.citizenRequest.count();
  if (!districts.length && !metrics.length && !requestCount) return 'EMPTY';
  if (districts.length !== 8 || requestCount < 32) throw new BootstrapError('Database is partially initialized: expected eight districts and all 32 baseline requests; no repair performed');
  // Read only baseline texts, not additional users' request content.
  const requests = await tx.citizenRequest.findMany({ where: { originalText: { in: baseline.flatMap(b => b.requests.map(r => r.originalText)) } } });
  if (requests.length !== 32) throw new BootstrapError('Missing or duplicate baseline requests; no repair performed');
  for (const entry of baseline) {
    const district = districts.find(d => d.name === entry.district.name && d.state === 'Karnataka');
    if (!district || !matches(district, entry.district)) throw new BootstrapError('District populations or Census provenance differ from the baseline; no repair performed');
    const coverage = metrics.filter(m => m.districtId === district.id && m.metricType === entry.metric.metricType);
    if (coverage.length !== 1 || !matches(coverage[0], entry.metric)) throw new BootstrapError('Expected one matching official JJM metric per district; no repair performed');
    for (const expected of entry.requests) {
      const found = requests.filter(r => r.districtId === district.id && r.originalText === expected.originalText);
      if (found.length !== 1 || !matches(found[0], expected)) throw new BootstrapError('Synthetic baseline request is missing, duplicated, or changed; no repair performed');
    }
  }
  return 'INITIALIZED';
}

// No Prisma import here: tests provide an isolated transactional database double.
export async function bootstrapProduction(prisma) {
  const baseline = await loadBaseline(); // Validate tracked sources before acquiring a transaction.
  return prisma.$transaction(async tx => {
    if (await inspect(tx, baseline) === 'INITIALIZED') return { initialized: false, writes: 0 };
    for (const entry of baseline) {
      const district = await tx.district.create({ data: entry.district });
      await tx.infrastructureMetric.create({ data: { districtId: district.id, ...entry.metric } });
      for (const request of entry.requests) await tx.citizenRequest.create({ data: { districtId: district.id, ...request } });
    }
    // Verify inside the same transaction; failure rolls back every inserted row.
    if (await inspect(tx, baseline) !== 'INITIALIZED') throw new BootstrapError('Bootstrap verification failed');
    return { initialized: true, districts: 8, requests: 32, infrastructureMetrics: 8, writes: 48 };
  }, { isolationLevel: 'Serializable', timeout: 30000 });
}
