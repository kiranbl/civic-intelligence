import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, mock, test } from 'node:test';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { demoRequests } from '../prisma/demoData.js';

let server;
let baseUrl;
const originalFindMany = prisma.district.findMany;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api/analytics/water-priority`;
});

afterEach(() => {
  prisma.district.findMany = originalFindMany;
  mock.restoreAll();
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  await prisma.$disconnect();
});

test('water analytics filters rural WATER counts and selects the newest rural FHTC metric', async () => {
  const query = mock.fn(async () => [{
    id: 1, name: 'Demo', state: 'Karnataka', ruralPopulation: 100000,
    _count: { requests: 10 }, infrastructure: [{ value: 60 }],
  }]);
  prisma.district.findMany = query;
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.data, [{
    districtId: 1, districtName: 'Demo', state: 'Karnataka', ruralPopulation: 100000,
    ruralWaterRequestCount: 10, ruralWaterRequestsPer100k: 10, ruralFhtcCoverage: 60,
    demandIndex: 0, infrastructureGap: 40, priorityScore: 20, priorityLevel: 'LOW', dataCompleteness: 'COMPLETE',
  }]);
  assert.equal(body.methodology.demandWeight, 0.5);
  assert.equal(body.methodology.infrastructureGapWeight, 0.5);
  assert.match(body.methodology.description, /Prototype/);
  assert.equal(body.methodology.scope, 'Rural water infrastructure prototype');
  assert.match(body.methodology.coverageData, /fictional demo data, not real JJM/);
  const selection = query.mock.calls[0].arguments[0].select;
  assert.deepEqual(selection._count, { select: { requests: { where: { category: 'WATER', areaType: 'RURAL' } } } });
  assert.deepEqual(selection.infrastructure, {
    where: { metricType: 'RURAL_FHTC_COVERAGE' },
    orderBy: [{ sourceYear: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    take: 1, select: { value: true },
  });
});

test('fictional demo request area types reflect the authorized scenario, not inferred geography', () => {
  const requests = demoRequests('Bengaluru Urban');
  assert.equal(requests.find(row => row.category === 'WATER').areaType, 'RURAL');
  assert.equal(requests.find(row => row.category === 'ROADS').areaType, 'RURAL');
  assert.equal(requests.find(row => row.category === 'SANITATION').areaType, 'UNKNOWN');
  assert.equal(requests.find(row => row.category === 'TRANSPORT').areaType, 'UNKNOWN');
  assert.ok(requests.every(row => row.originalText.startsWith('[DEMO ONLY')));
});

test('rural query excludes URBAN and UNKNOWN water requests and non-water rural requests', async () => {
  const requests = [
    { category: 'WATER', areaType: 'RURAL' },
    { category: 'WATER', areaType: 'RURAL' },
    { category: 'WATER', areaType: 'URBAN' },
    { category: 'WATER', areaType: 'UNKNOWN' },
    { category: 'ROADS', areaType: 'RURAL' },
  ];
  prisma.district.findMany = async ({ select }) => {
    const where = select._count.select.requests.where;
    const count = requests.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)).length;
    return [{ id: 1, name: 'Demo', state: 'Karnataka', population: 100000, ruralPopulation: 1000, _count: { requests: count }, infrastructure: [{ value: 50 }] }];
  };
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const [row] = (await response.json()).data;
  assert.equal(row.ruralWaterRequestCount, 2);
  assert.equal(row.ruralWaterRequestsPer100k, 200);
});

test('analytics returns incomplete records after complete records over HTTP', async () => {
  prisma.district.findMany = async () => [
    { id: 1, name: 'Missing', state: 'Karnataka', ruralPopulation: 100000, _count: { requests: 30 }, infrastructure: [] },
    { id: 2, name: 'Complete', state: 'Karnataka', ruralPopulation: 100000, _count: { requests: 10 }, infrastructure: [{ value: 80 }] },
  ];
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data.map(row => row.districtId), [2, 1]);
  assert.equal(data[1].dataCompleteness, 'INCOMPLETE');
  assert.equal(data[1].priorityScore, null);
});

test('analytics returns an empty data array when there are no districts', async () => {
  prisma.district.findMany = async () => [];
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

test('analytics database failure uses the centralized safe error response', async () => {
  prisma.district.findMany = async () => { throw new Error('Private Prisma connection details'); };
  mock.method(console, 'error', () => {});
  const response = await fetch(baseUrl);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, message: 'Internal server error' });
});
