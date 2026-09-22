import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DISTRICT_ALIASES, POPULATION_SOURCE, extractCensusPopulations, importPopulations, populationCsv,
} from '../scripts/import/censusPopulationData.js';

const header = ['State', 'District', 'Subdistt', 'Town/Village', 'Ward', 'EB', 'Level', 'Name', 'TRU', 'TOT_P'];
const sourceNames = ['Bangalore', 'Bangalore Rural', 'Mysore', 'Mandya', 'Tumkur', 'Hassan', 'Kolar', 'Ramanagara'];
const expectedNames = ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mandya', 'Tumakuru', 'Hassan', 'Kolar', 'Ramanagara'];
function row(name, code, population = 12345) {
  return ['29', code, '00000', '000000', '0000', '000000', 'DISTRICT', name, 'Total', population];
}
function fixture() {
  return [header, ['29', '000', '00000', '000000', '0000', '000000', 'STATE', 'KARNATAKA', 'Total', 61095297],
    ...sourceNames.map((name, index) => row(name, String(571 + index))),
    ...sourceNames.flatMap((name, index) => [
      change(row(name, String(571 + index), 8000), 'TRU', 'Rural'),
      change(row(name, String(571 + index), 4345), 'TRU', 'Urban'),
    ])];
}
function change(record, column, value) {
  const copy = [...record];
  copy[header.indexOf(column)] = value;
  return copy;
}

test('explicit historical aliases select exactly eight unique application districts', () => {
  const records = extractCensusPopulations(fixture());
  assert.deepEqual(records.map(record => record.applicationDistrictName), expectedNames);
  assert.equal(new Set(records.map(record => record.applicationDistrictName)).size, 8);
  assert.equal(DISTRICT_ALIASES.Bangalore, 'Bengaluru Urban');
  assert.equal(DISTRICT_ALIASES.Mysore, 'Mysuru');
  assert.equal(DISTRICT_ALIASES.Tumkur, 'Tumakuru');
  assert.ok(records.every(record => record.populationSource === POPULATION_SOURCE && record.populationSourceYear === 2011));
});

test('filters other states, state totals, and every lower geographic level', () => {
  const rows = fixture();
  const target = rows[2];
  rows.push(change(target, 'TRU', 'Other'));
  for (const level of ['STATE', 'SUB-DISTRICT', 'TOWN', 'VILLAGE', 'WARD', 'India']) rows.push(change(target, 'Level', level));
  rows.push(change(target, 'State', '28'));
  for (const column of ['Subdistt', 'Town/Village', 'Ward', 'EB']) rows.push(change(target, column, '00001'));
  rows.push(row('Belgaum', '555', 999));
  assert.equal(extractCensusPopulations(rows).length, 8);
});

test('Rural in Bangalore Rural name does not exclude its Total district row', () => {
  const records = extractCensusPopulations(fixture());
  assert.equal(records[1].sourceDistrictName, 'Bangalore Rural');
});

test('header names drive lookup even when columns are reordered', () => {
  const reversed = fixture().map(record => [...record].reverse());
  assert.deepEqual(extractCensusPopulations(reversed), extractCensusPopulations(fixture()));
});

test('missing or duplicate population columns are rejected instead of guessed', () => {
  assert.throws(() => extractCensusPopulations(fixture().map(record => record.slice(0, -1))), /TOT_P column/);
  const rows = fixture(); rows[0] = [...header, 'TOT_P'];
  assert.throws(() => extractCensusPopulations(rows), /TOT_P column/);
});

test('duplicate district names and duplicate district codes are rejected', () => {
  const rows = fixture(); rows.push([...rows[2]]);
  assert.throws(() => extractCensusPopulations(rows), /Duplicate district/);
  const duplicateCode = fixture(); duplicateCode[3] = change(duplicateCode[3], 'District', duplicateCode[2][1]);
  assert.throws(() => extractCensusPopulations(duplicateCode), /Duplicate district/);
});

test('a missing district is rejected, including when only a rural row remains', () => {
  const rows = fixture().filter(record => record[7] !== 'Ramanagara');
  assert.throws(() => extractCensusPopulations(rows), /Missing: Ramanagara/);
  const ruralOnly = fixture(); ruralOnly.splice(2, 1);
  assert.throws(() => extractCensusPopulations(ruralOnly), /Missing Total population for Bangalore/);
});

test('invalid, blank, fractional, or oversized population values are rejected', () => {
  for (const population of [undefined, null, '', '12345', 'unknown', NaN, Infinity, 0, -1, 1.5, true, 2147483648]) {
    const rows = fixture(); rows[2] = change(rows[2], 'TOT_P', population);
    assert.throws(() => extractCensusPopulations(rows), /Invalid TOT_P/);
  }
});

test('state identity and district codes must be present and valid', () => {
  const rows = fixture(); rows[1] = change(rows[1], 'State', '28');
  assert.throws(() => extractCensusPopulations(rows), /Karnataka/);
  for (const code of ['', '000', 'abc']) {
    const invalid = fixture(); invalid[2] = change(invalid[2], 'District', code);
    assert.throws(() => extractCensusPopulations(invalid), /Invalid district code/);
  }
});

test('dry-run logs eight populations without even acquiring a database client', async () => {
  const logs = [];
  const result = await importPopulations(extractCensusPopulations(fixture()), {
    dryRun: true, log: message => logs.push(message),
    getClient: () => { throw new Error('Dry-run attempted database access'); },
  });
  assert.deepEqual(result, { matched: 8, updated: 0, dryRun: true });
  assert.equal(logs.filter(line => line.includes(' -> ')).length, 8);
});

function fakeDatabase() {
  const districts = expectedNames.map((name, index) => ({ id: index + 1, name, state: 'Karnataka', population: 1, populationSource: null, populationSourceYear: null }));
  const writes = [];
  let transactionCount = 0;
  const db = {
    $transaction: async work => {
      transactionCount++;
      return work({ district: {
        findMany: async ({ where }) => {
          assert.equal(where.state, 'Karnataka');
          assert.deepEqual(where.name.in, expectedNames);
          return districts;
        },
        update: async ({ where, data }) => {
          assert.deepEqual(Object.keys(data).sort(), ['population', 'populationSource', 'populationSourceYear', 'ruralPopulation', 'urbanPopulation']);
          writes.push({ where, data });
          Object.assign(districts.find(district => district.id === where.id), data);
        },
      } });
    },
  };
  return { db, districts, writes, get transactionCount() { return transactionCount; } };
}

test('successful import updates only population/provenance and rerun performs zero updates', async () => {
  const state = fakeDatabase();
  const records = extractCensusPopulations(fixture());
  const options = { dryRun: false, getClient: async () => state.db, log: () => {} };
  assert.deepEqual(await importPopulations(records, options), { matched: 8, updated: 8, dryRun: false });
  assert.equal(state.writes.length, 8);
  assert.equal(state.transactionCount, 1);
  const snapshot = structuredClone(state.districts);
  assert.deepEqual(await importPopulations(records, options), { matched: 8, updated: 0, dryRun: false });
  assert.deepEqual(state.districts, snapshot);
  assert.equal(state.writes.length, 8);
});

test('missing database target fails before the first update', async () => {
  const state = fakeDatabase(); state.districts.pop();
  await assert.rejects(importPopulations(extractCensusPopulations(fixture()), {
    dryRun: false, getClient: async () => state.db, log: () => {},
  }), /eight unique Karnataka/);
  assert.equal(state.writes.length, 0);
});

test('processed CSV has exactly the eight requested columns and eight data records', () => {
  const lines = populationCsv(extractCensusPopulations(fixture())).trim().split('\n');
  assert.equal(lines.length, 9);
  assert.equal(lines[0], 'applicationDistrictName,sourceDistrictName,censusDistrictCode,totalPopulation,ruralPopulation,urbanPopulation,populationSource,populationSourceYear');
});

test('extracts separate Total, Rural and Urban values and verifies exact reconciliation', () => {
  const [record] = extractCensusPopulations(fixture());
  assert.equal(record.totalPopulation, 12345);
  assert.equal(record.ruralPopulation, 8000);
  assert.equal(record.urbanPopulation, 4345);
  const rows = fixture(); rows[10] = change(rows[10], 'TOT_P', 8001);
  assert.throws(() => extractCensusPopulations(rows), /reconciliation failed/);
});

test('rejects missing and duplicate Rural or Urban rows', () => {
  for (const tru of ['Rural', 'Urban']) {
    const rows = fixture();
    const index = rows.findIndex(record => record[7] === 'Bangalore' && record[8] === tru);
    const duplicate = [...rows, rows[index]];
    assert.throws(() => extractCensusPopulations(duplicate), /Duplicate district/);
    rows.splice(index, 1);
    assert.throws(() => extractCensusPopulations(rows), new RegExp(`Missing ${tru}`));
  }
});

test('validates each component while allowing a genuine zero population component', () => {
  for (const tru of ['Rural', 'Urban']) {
    for (const invalid of [null, '', '8000', NaN, Infinity, -1, 1.5]) {
      const rows = fixture();
      const index = rows.findIndex(record => record[7] === 'Bangalore' && record[8] === tru);
      rows[index] = change(rows[index], 'TOT_P', invalid);
      assert.throws(() => extractCensusPopulations(rows), /Invalid TOT_P/);
    }
  }
  const rows = fixture(); rows[10] = change(rows[10], 'TOT_P', 0); rows[11] = change(rows[11], 'TOT_P', 12345);
  assert.equal(extractCensusPopulations(rows)[0].ruralPopulation, 0);
});

test('inconsistent geographic codes across the three rows are rejected', () => {
  const rows = fixture(); rows[10] = change(rows[10], 'District', '999');
  assert.throws(() => extractCensusPopulations(rows), /Inconsistent district code/);
});
