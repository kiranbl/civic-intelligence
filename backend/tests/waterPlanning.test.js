import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, mock, test } from 'node:test';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { addWaterPlanning } from '../src/services/waterPlanning.service.js';

const base = { districtId: 901, districtName: 'Arbitrary district', state: 'Example', ruralPopulation: 100000, ruralWaterRequestCount: 7, ruralWaterRequestsPer100k: 7, demandIndex: 60, infrastructureGap: 30, ruralFhtcCoverage: 70, priorityScore: 45, priorityLevel: 'MEDIUM', dataCompleteness: 'COMPLETE' };
for (const [demandIndex, infrastructureGap, profile, code] of [
  [70, 30, 'HIGH_DEMAND_HIGH_GAP', 'EXPLORE_ACCESS_EXPANSION'],
  [70, 10, 'HIGH_DEMAND_LOW_GAP', 'INVESTIGATE_SERVICE_RELIABILITY'],
  [30, 30, 'LOW_DEMAND_HIGH_GAP', 'VALIDATE_UNDERREPORTED_ACCESS_GAPS'],
  [30, 10, 'LOW_DEMAND_LOW_GAP', 'MONITOR_AND_MAINTAIN'],
  [50, 20, 'HIGH_DEMAND_HIGH_GAP', 'EXPLORE_ACCESS_EXPANSION'],
  [49.99, 20, 'LOW_DEMAND_HIGH_GAP', 'VALIDATE_UNDERREPORTED_ACCESS_GAPS'],
  [50, 19.99, 'HIGH_DEMAND_LOW_GAP', 'INVESTIGATE_SERVICE_RELIABILITY'],
]) test(`planning ${demandIndex}/${infrastructureGap} => ${profile}`, () => {
  const input = { ...base, demandIndex, infrastructureGap, ruralFhtcCoverage: 100 - infrastructureGap };
  const before = structuredClone(input);
  const result = addWaterPlanning(input);
  assert.equal(result.planningProfile, profile);
  assert.equal(result.planningAction.code, code);
  assert.equal(result.rationale.length, 3);
  assert.ok(result.rationale[0].includes(demandIndex.toFixed(2)));
  assert.ok(result.rationale[1].includes(infrastructureGap.toFixed(2)));
  assert.deepEqual(input, before);
  for (const key of Object.keys(result.evidence)) assert.equal(result.evidence[key], input[key]);
  for (const pattern of [/synthetic/, /relative/, /2011/, /21\/09\/2026/, /quantity, quality, pressure/, /prototype planning aid/]) assert.ok(result.limitations.some(s => pattern.test(s)));
  assert.equal(addWaterPlanning({ ...input, districtId: 4, districtName: 'Different name' }).planningProfile, profile);
});

for (const change of [
  { dataCompleteness: 'INCOMPLETE' }, { demandIndex: null }, { infrastructureGap: null, ruralFhtcCoverage: null },
  { demandIndex: NaN }, { infrastructureGap: 101 }, { ruralFhtcCoverage: -1 },
]) test(`incomplete planning refuses to guess: ${JSON.stringify(change)}`, () => {
  const result = addWaterPlanning({ ...base, ...change });
  assert.equal(result.planningProfile, 'INSUFFICIENT_DATA');
  assert.equal(result.planningAction.code, 'REVIEW_DATA');
  assert.equal(result.limitations.length, 6);
  for (const key of Object.keys(result.evidence)) assert.equal(result.evidence[key], ({ ...base, ...change })[key]);
});

let server, url;
const originalFindMany = prisma.district.findMany;
before(async () => {
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}/api/analytics`;
});
afterEach(() => { prisma.district.findMany = originalFindMany; mock.restoreAll(); });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });

test('planning HTTP reuses existing priority output, order, evidence and methodology without changing its contract', async () => {
  const query = mock.fn(async () => [
    { id: 1, name: 'A', state: 'Test', ruralPopulation: 100000, _count: { requests: 10 }, infrastructure: [{ value: 85 }] },
    { id: 2, name: 'B', state: 'Test', ruralPopulation: 100000, _count: { requests: 5 }, infrastructure: [{ value: 60 }] },
    { id: 3, name: 'C', state: 'Test', ruralPopulation: null, _count: { requests: 2 }, infrastructure: [] },
  ]);
  prisma.district.findMany = query;
  const priority = await (await fetch(url + '/water-priority')).json();
  const response = await fetch(url + '/water-planning');
  assert.equal(response.status, 200);
  const planning = await response.json();
  assert.equal(planning.success, true);
  assert.deepEqual(planning.methodology, priority.methodology);
  assert.deepEqual(planning.planningMethodology.thresholds, { highDemand: 50, highGap: 20 });
  assert.deepEqual(planning.data, priority.data.map(addWaterPlanning));
  assert.deepEqual(query.mock.calls[0].arguments, query.mock.calls[1].arguments);
  assert.equal(query.mock.callCount(), 2);
  const priorityAfter = await (await fetch(url + '/water-priority')).json();
  assert.deepEqual(priorityAfter, priority);
  assert.equal(planning.data[2].planningProfile, 'INSUFFICIENT_DATA');
});

test('planning returns an empty collection', async () => {
  prisma.district.findMany = async () => [];
  assert.deepEqual((await (await fetch(url + '/water-planning')).json()).data, []);
});

test('planning database failures use centralized safe errors', async () => {
  prisma.district.findMany = async () => { throw new Error('Private database details'); };
  mock.method(console, 'error', () => {});
  const response = await fetch(url + '/water-planning');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, message: 'Internal server error' });
});
