import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jjmFixture } from './fixtures/jjmFixtures.js';
import { detectJjmFormat, parseJ1, parseJ5, reconcileJjm, calculateJjmCoverage, jjmCoverageCsv, JJM_TARGETS } from '../scripts/import/jjmCoverageData.js';
import { importJjmCoverage } from '../scripts/import/jjmCoverageImport.js';
import { demoSource } from '../prisma/demoData.js';
import { ensureDemoCoverage } from '../prisma/demoCoverage.js';
import { waterPriorityMethodology } from '../src/config/waterPriority.js';
import { JJM_SOURCE, JJM_SOURCE_DATE, JJM_SOURCE_URL } from '../src/config/jjm.js';

const records = () => reconcileJjm(parseJ1(jjmFixture('J1')), parseJ5(jjmFixture('J5')));
const quiet = { log() {}, table() {} };

for (const [format, parse] of [['J1', parseJ1], ['J5', parseJ5]]) {
  test(`${format}: detects HTML Excel and exactly eight explicit case-insensitive targets`, () => {
    const html = jjmFixture(format);
    assert.equal(detectJjmFormat(Buffer.from(html)), 'HTML_EXCEL');
    const result = parse(html);
    const rows = result.records || result;
    assert.deepEqual(rows.map(row => row.applicationDistrictName), JJM_TARGETS);
    assert.equal(rows[1].sourceDistrictName, 'BENGALURU RURAL');
  });
  test(`${format}: rejects missing and duplicate districts`, () => {
    assert.throws(() => parse(jjmFixture(format, { mutateRows: rows => rows.pop() })), /missing district/);
    assert.throws(() => parse(jjmFixture(format, { mutateRows: rows => rows.push([...rows[0]]) })), /duplicate district/);
  });
  test(`${format}: does not fuzzy-match or reuse historical Census aliases`, () => {
    for (const name of ['Bangalore', 'Mysore', 'Bengaluru Urbn', '__proto__']) {
      assert.throws(() => parse(jjmFixture(format, { mutateRows: rows => { rows[0][1] = name; } })), /missing district/);
    }
  });
  test(`${format}: rejects wrong state, format, headers, and grouped column spans`, () => {
    assert.throws(() => parse(jjmFixture(format, { state: 'Kerala' })), /Karnataka/);
    assert.throws(() => parse(jjmFixture(format).replace(`Format- ${format}`, 'Format- X9')), /Expected Format/);
    assert.throws(() => parse(jjmFixture(format).replace('District Name', 'Block Name')), /header/);
    assert.throws(() => parse(jjmFixture(format).replace('colspan="3"', 'colspan="4"')), /grouping/);
  });
  test(`${format}: rejects blank, negative, fractional, and nonnumeric counts`, () => {
    for (const value of ['', '-1', '1.5', 'unknown', '9007199254740992']) {
      assert.throws(() => parse(jjmFixture(format, { mutateRows: rows => { rows[0][5] = value; } })), /integer/);
    }
  });
}

test('rejects binary XLS, ZIP XLSX, and ordinary non-Excel HTML', () => {
  for (const input of [Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.from('PK\x03\x04'), '<html><table></table></html>']) {
    assert.throws(() => detectJjmFormat(input), /HTML Excel/);
  }
});
test('J5 parses the explicit report date and financial year and rejects other snapshots', () => {
  const result = parseJ5(jjmFixture('J5'));
  assert.equal(result.sourceDate, '2026-09-21');
  assert.equal(result.financialYear, '2026-2027');
  for (const date of ['20/09/2026', '31/02/2026', '']) assert.throws(() => parseJ5(jjmFixture('J5', { date })), /Reported Till/);
  assert.throws(() => parseJ5(jjmFixture('J5', { year: '2025-2026' })), /Financial Year/);
});
test('independent J5 sums all six bands and reconciles households and connections to J1', () => {
  const rows = records();
  assert.equal(rows[0].pwsHouseholds, 600);
  assert.equal(rows[0].tapConnectedHouseholds, 290);
  assert(rows.every(row => row.householdReconciliation === 'MATCH' && row.connectionReconciliation === 'MATCH'));
});
test('rejects J1/J5 household mismatch and connection mismatch independently', () => {
  const j1 = parseJ1(jjmFixture('J1'));
  const households = parseJ5(jjmFixture('J5', { mutateRows: rows => { rows[0][5]++; } }));
  assert.throws(() => reconcileJjm(j1, households), /household mismatch/);
  const connections = parseJ5(jjmFixture('J5', { mutateRows: rows => { rows[0][9]++; } }));
  assert.throws(() => reconcileJjm(j1, connections), /connection mismatch/);
});
test('private connections must be zero before reconciliation is accepted', () => {
  const j1 = parseJ1(jjmFixture('J1', { mutateRows: rows => { rows[0][5] = 1; } }));
  assert.throws(() => reconcileJjm(j1, parseJ5(jjmFixture('J5'))), /Private connections/);
});
test('coverage includes non-PWS unconnected households and retains full precision', () => {
  assert.deepEqual(calculateJjmCoverage(397959, 3143, 0, 377759), { totalReportedRuralHouseholds: 401102, ruralFhtcCoverage: 377759 / 401102 * 100 });
  const row = records()[0];
  assert.equal(row.totalReportedRuralHouseholds, 620);
  assert.equal(row.ruralFhtcCoverage, 290 / 620 * 100);
  assert.notEqual(row.ruralFhtcCoverage, Number(row.ruralFhtcCoverage.toFixed(2)));
});
test('coverage rejects invalid counts, denominator, and impossible percentages', () => {
  for (const args of [[0, 0, 0, 0], [10, 0, 0, 11], [10, 5, 0, 12], [10, 0, 0, -1], [NaN, 0, 0, 1], [10, 0, 0, Infinity], [10, -1, 0, 5]]) {
    assert.throws(() => calculateJjmCoverage(...args), /Invalid/);
  }
  assert.equal(calculateJjmCoverage(10, 0, 0, 0).ruralFhtcCoverage, 0);
  assert.equal(calculateJjmCoverage(10, 0, 0, 10).ruralFhtcCoverage, 100);
});
test('CSV contains only eight target rows and the eleven required fields, with display rounding', () => {
  const lines = jjmCoverageCsv(records()).trim().split('\n');
  assert.equal(lines.length, 9);
  assert.equal(lines[0], 'applicationDistrictName,j1SourceDistrictName,j5SourceDistrictName,pwsHouseholds,nonPwsUnconnectedHouseholds,totalReportedRuralHouseholds,tapConnectedHouseholds,ruralFhtcCoverage,source,sourceDate,financialYear');
  assert.match(lines[1], /"46.77"/);
});

function database() {
  const state = {
    districts: JJM_TARGETS.map((name, i) => ({ id: i + 1, name, state: 'Karnataka', population: 1000, ruralPopulation: 600, urbanPopulation: 400, populationSource: 'Census of India - Primary Census Abstract', populationSourceYear: 2011 })),
    requests: [{ id: 1, originalText: '[DEMO ONLY] water', areaType: 'RURAL' }],
    metrics: JJM_TARGETS.map((name, i) => ({ id: i + 1, districtId: i + 1, metricType: 'RURAL_FHTC_COVERAGE', source: demoSource, sourceYear: 2026, sourceDate: null, sourceUrl: null, value: 50, unit: 'percent', updatedAt: new Date('2026-01-01') })),
  };
  state.metrics.push({ id: 90, districtId: 1, metricType: 'OTHER', value: 8 });
  let writes = 0;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => value?.in ? value.in.includes(row[key]) : row[key] === value);
  const client = {
    async $transaction(callback) {
      const next = structuredClone(state);
      const tx = {
        district: { async findMany({ where }) { return next.districts.filter(row => matches(row, where)); } },
        infrastructureMetric: {
          async findMany({ where }) { return next.metrics.filter(row => matches(row, where)); },
          async update({ where, data }) {
            writes++;
            Object.assign(next.metrics.find(row => row.id === where.id), data, { updatedAt: new Date('2026-09-22') });
          },
          async create({ data }) { writes++; next.metrics.push({ id: 100, ...data }); },
        },
      };
      const result = await callback(tx);
      Object.assign(state, next);
      return result;
    },
  };
  return { state, client, writes: () => writes };
}
test('dry run prints the summary and never acquires a database client or writes', async () => {
  let table;
  const result = await importJjmCoverage(records(), { log() {}, table: rows => { table = rows; }, getClient() { assert.fail('Dry run connected to DB'); } });
  assert.deepEqual(result, { matched: 8, updated: 0, dryRun: true });
  assert.equal(table.length, 8);
  assert.equal(table[0].coverage, '46.77');
});
test('successful import replaces demo metrics in place, preserving Census, requests and other metric types', async () => {
  const db = database();
  const before = structuredClone(db.state);
  const result = await importJjmCoverage(records(), { ...quiet, dryRun: false, getClient: async () => db.client });
  assert.equal(result.updated, 8);
  assert.deepEqual(db.state.districts, before.districts);
  assert.deepEqual(db.state.requests, before.requests);
  assert.deepEqual(db.state.metrics.find(row => row.id === 90), before.metrics.find(row => row.id === 90));
  for (let i = 0; i < 8; i++) {
    const metric = db.state.metrics[i];
    assert.equal(metric.id, before.metrics[i].id);
    assert.equal(metric.source, JJM_SOURCE);
    assert.equal(metric.sourceYear, 2026);
    assert.equal(metric.sourceDate.toISOString(), `${JJM_SOURCE_DATE}T00:00:00.000Z`);
    assert.equal(metric.sourceUrl, JJM_SOURCE_URL);
    assert.equal(metric.unit, 'PERCENT');
    assert.equal(metric.value, records()[i].ruralFhtcCoverage);
    assert.equal(db.state.metrics.filter(row => row.districtId === metric.districtId && row.metricType === 'RURAL_FHTC_COVERAGE').length, 1);
  }
  const first = structuredClone(db.state);
  const rerun = await importJjmCoverage(records(), { ...quiet, dryRun: false, getClient: async () => db.client });
  assert.equal(rerun.updated, 0);
  assert.equal(db.writes(), 8);
  assert.deepEqual(db.state, first); // including timestamps
  await db.client.$transaction(async tx => { for (const d of db.state.districts) await ensureDemoCoverage(tx, d.id, 50); });
  assert.deepEqual(db.state, first);
  assert.equal(db.writes(), 8, 'seed must not recreate demo records');
});
test('missing districts, missing metrics, duplicates, and unrelated sources fail preflight before any write', async () => {
  const mutations = [
    state => state.districts.pop(), state => state.metrics.splice(7, 1),
    state => state.metrics.push({ ...state.metrics[7], id: 99 }),
    state => { state.metrics[7].source = 'Unrelated official source'; },
  ];
  for (const mutate of mutations) {
    const db = database(); mutate(db.state); const before = structuredClone(db.state);
    await assert.rejects(importJjmCoverage(records(), { ...quiet, dryRun: false, getClient: async () => db.client }));
    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state, before);
  }
});
test('invalid reconciled records never reach the database, even for real import mode', async () => {
  for (const change of [r => { r[0].privateHouseholds = 1; }, r => { r[0].ruralFhtcCoverage = 101; }, r => { r[0].source = 'Other'; }, r => { r[0].sourceDate = '2025-09-21'; }, r => { r[0].householdReconciliation = 'MISMATCH'; }, r => r.pop(), r => { r[1] = r[0]; }]) {
    const rows = records(); change(rows);
    await assert.rejects(importJjmCoverage(rows, { ...quiet, dryRun: false, getClient() { assert.fail('Invalid input connected'); } }));
  }
});
test('analytics metadata distinguishes official, demo, mixed and absent selected sources', () => {
  const official = { infrastructure: [{ source: JJM_SOURCE, sourceYear: 2026, sourceDate: new Date('2026-09-21T00:00:00Z') }] };
  const demo = { infrastructure: [{ source: demoSource }] };
  assert.match(waterPriorityMethodology([official]).coverageData, /as of 21\/09\/2026/);
  assert.match(waterPriorityMethodology([demo]).coverageData, /import is pending/);
  assert.match(waterPriorityMethodology([official, demo]).coverageData, /mixed/);
  assert.match(waterPriorityMethodology([]).coverageData, /missing/);
  assert.match(waterPriorityMethodology([official]).citizenDemand, /synthetic/);
});
