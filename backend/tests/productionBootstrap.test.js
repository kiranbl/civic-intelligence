import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { bootstrapProduction } from '../scripts/bootstrap/initialize.js';
import { baselineFromCsv, loadBaseline } from '../scripts/bootstrap/baseline.js';
import { JJM_SOURCE_URL } from '../src/config/jjm.js';

// Only this in-memory double is used. No Prisma client, URLs, or network calls.
function database() {
  const state = { district: [], citizenRequest: [], infrastructureMetric: [] };
  let writes = 0;
  let failAt = Infinity;
  return {
    state, writes: () => writes, failAt: value => { failAt = value; },
    client: {
      async $transaction(callback, options) {
        assert.equal(options.isolationLevel, 'Serializable');
        const next = structuredClone(state);
        const tx = Object.fromEntries(Object.keys(next).map(table => [table, {
          async findMany(query) {
            return query?.where?.originalText ? next[table].filter(row => query.where.originalText.in.includes(row.originalText)) : next[table];
          },
          async count() { return next[table].length; },
          async create({ data }) {
            writes++;
            if (writes === failAt) throw Error('Simulated insert failure');
            const row = { id: next[table].length + 1, ...structuredClone(data) };
            next[table].push(row);
            return row;
          },
          // No update/delete/reset methods: any such operation would fail the test.
        }]));
        const result = await callback(tx);
        Object.assign(state, next);
        return result;
      },
    },
  };
}

test('empty application tables initialize exactly 8 districts, 32 synthetic requests and 8 official metrics', async () => {
  const db = database();
  assert.deepEqual(await bootstrapProduction(db.client), { initialized: true, districts: 8, requests: 32, infrastructureMetrics: 8, writes: 48 });
  assert.deepEqual(Object.values(db.state).map(rows => rows.length), [8, 32, 8]);
  for (const d of db.state.district) {
    assert.equal(db.state.citizenRequest.filter(r => r.districtId === d.id).length, 4);
    assert.equal(db.state.infrastructureMetric.filter(m => m.districtId === d.id && m.metricType === 'RURAL_FHTC_COVERAGE').length, 1);
  }
  assert(db.state.citizenRequest.every(r => r.originalText.startsWith('[DEMO ONLY - ') && r.aiModel === null && r.aiProcessedAt === null));
  assert(!db.state.citizenRequest.some(r => [33, 34].includes(r.id)));
  assert.deepEqual(new Set(db.state.citizenRequest.map(r => r.language)), new Set(['en', 'kn', 'hi']));
});

test('tracked Census values, exact JJM count-derived precision and all stored provenance are imported', async () => {
  const db = database(); await bootstrapProduction(db.client);
  const populations = [9621551, 990923, 3001127, 1805769, 2678980, 1776421, 1536401, 1082636];
  const rural = [871607, 722179, 1755714, 1497407, 2079902, 1399658, 1056328, 814877];
  const connected = [229635, 184709, 451097, 377759, 453671, 390661, 215095, 214074];
  const households = [317618, 208818, 501970, 401102, 564687, 431593, 272456, 231006];
  db.state.district.forEach((d, i) => {
    assert.equal(d.population, populations[i]); assert.equal(d.ruralPopulation, rural[i]);
    assert.equal(d.urbanPopulation, populations[i] - rural[i]);
    assert.equal(d.populationSource, 'Census of India - Primary Census Abstract');
    assert.equal(d.populationSourceYear, 2011);
    const m = db.state.infrastructureMetric[i];
    assert.equal(m.value, connected[i] / households[i] * 100);
    assert.equal(m.source, 'Jal Jeevan Mission'); assert.equal(m.sourceYear, 2026);
    assert.equal(m.sourceDate.toISOString(), '2026-09-21T00:00:00.000Z');
    assert.equal(m.sourceUrl, JJM_SOURCE_URL); assert.equal(m.unit, 'PERCENT');
  });
});

test('initialized database rerun performs zero writes and preserves timestamps and IDs', async () => {
  const db = database(); await bootstrapProduction(db.client);
  const before = structuredClone(db.state); const writes = db.writes();
  assert.deepEqual(await bootstrapProduction(db.client), { initialized: false, writes: 0 });
  assert.equal(db.writes(), writes); assert.deepEqual(db.state, before);
});

test('additional user requests and unrelated metrics survive reruns without reads of user text or writes', async () => {
  const db = database(); await bootstrapProduction(db.client);
  db.state.citizenRequest.push({ id: 100, districtId: 1, originalText: 'Synthetic test-only additional user request', aiModel: 'mock-model' });
  db.state.infrastructureMetric.push({ id: 100, districtId: 1, metricType: 'OTHER', value: 1 });
  const before = structuredClone(db.state); const writes = db.writes();
  await bootstrapProduction(db.client);
  assert.equal(db.writes(), writes); assert.deepEqual(db.state, before);
});

for (const [label, mutate] of [
  ['missing district', s => s.district.pop()],
  ['extra district', s => s.district.push({ id: 99, name: 'Unrelated' })],
  ['missing baseline request', s => s.citizenRequest.pop()],
  ['altered baseline request', s => { s.citizenRequest[0].areaType = 'URBAN'; }],
  ['duplicate baseline request', s => s.citizenRequest.push({ ...s.citizenRequest[0], id: 99 })],
  ['missing metric', s => s.infrastructureMetric.pop()],
  ['duplicate rural metric', s => s.infrastructureMetric.push({ ...s.infrastructureMetric[0], id: 99 })],
  ['fictional metric', s => { s.infrastructureMetric[0].source = 'FICTIONAL'; }],
  ['Census value drift', s => { s.district[0].ruralPopulation++; }],
  ['Census provenance drift', s => { s.district[0].populationSourceYear = 2026; }],
  ['JJM provenance drift', s => { s.infrastructureMetric[0].sourceUrl = null; }],
  ['JJM rounded rather than exact value', s => { s.infrastructureMetric[0].value = 72.30; }],
]) {
  test(`inconsistent database safely refuses ${label}, without repair`, async () => {
    const db = database(); await bootstrapProduction(db.client); mutate(db.state);
    const before = structuredClone(db.state); const writes = db.writes();
    await assert.rejects(bootstrapProduction(db.client), /no repair performed/);
    assert.equal(db.writes(), writes); assert.deepEqual(db.state, before);
  });
}

test('orphaned nonempty table is not mistaken for an empty database', async () => {
  const db = database(); db.state.citizenRequest.push({ id: 9 });
  await assert.rejects(bootstrapProduction(db.client), /partially initialized/);
  assert.equal(db.writes(), 0);
});

test('insertion failure rolls back the complete initialization', async () => {
  const db = database(); db.failAt(20);
  await assert.rejects(bootstrapProduction(db.client), /Simulated insert failure/);
  assert.deepEqual(Object.values(db.state).map(rows => rows.length), [0, 0, 0]);
});

test('processed CSV validation rejects missing/duplicate districts, invalid populations and changed coverage/provenance', async () => {
  const census = await readFile(new URL('../data/processed/census2011-karnataka-population.csv', import.meta.url), 'utf8');
  const jjm = await readFile(new URL('../data/processed/jjm-karnataka-rural-coverage-2026-09-21.csv', import.meta.url), 'utf8');
  for (const invalid of [census.replace('"9621551"', '""'), census.replace('"9621551"', '"9621552"'), census.replace('"2011"', '"2026"'),
    census.replace('"Bengaluru Rural"', '"Bengaluru Urban"'), census.split('\n').slice(0, 8).join('\n'), census.replace('"Bangalore"', '"Unknown"')]) {
    assert.throws(() => baselineFromCsv(invalid, jjm));
  }
  for (const invalid of [jjm.replace('"72.30"', '"99.99"'), jjm.replace('"317618"', '"317619"'), jjm.replace('"2026-09-21"', '"2026-09-22"'), jjm.replace('"2026-2027"', '"2025-2026"')]) {
    assert.throws(() => baselineFromCsv(census, invalid));
  }
  assert.equal((await loadBaseline()).length, 8);
});
