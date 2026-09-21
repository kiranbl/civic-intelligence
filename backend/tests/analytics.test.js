import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, mock, test } from 'node:test';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

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

test('water analytics filters WATER counts and selects the newest tap-water metric', async () => {
  const query = mock.fn(async () => [{
    id: 1, name: 'Demo', state: 'Karnataka', population: 100000,
    _count: { requests: 10 }, infrastructure: [{ value: 60 }],
  }]);
  prisma.district.findMany = query;
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.data, [{
    districtId: 1, districtName: 'Demo', state: 'Karnataka', population: 100000,
    waterRequestCount: 10, waterRequestsPer100k: 10, tapWaterCoverage: 60,
    demandIndex: 0, infrastructureGap: 40, priorityScore: 20, priorityLevel: 'LOW', dataCompleteness: 'COMPLETE',
  }]);
  assert.equal(body.methodology.demandWeight, 0.5);
  assert.equal(body.methodology.infrastructureGapWeight, 0.5);
  assert.match(body.methodology.description, /Prototype/);
  const selection = query.mock.calls[0].arguments[0].select;
  assert.deepEqual(selection._count, { select: { requests: { where: { category: 'WATER' } } } });
  assert.deepEqual(selection.infrastructure, {
    where: { metricType: 'TAP_WATER_COVERAGE' },
    orderBy: [{ sourceYear: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    take: 1, select: { value: true },
  });
});

test('analytics returns incomplete records after complete records over HTTP', async () => {
  prisma.district.findMany = async () => [
    { id: 1, name: 'Missing', state: 'Karnataka', population: 100000, _count: { requests: 30 }, infrastructure: [] },
    { id: 2, name: 'Complete', state: 'Karnataka', population: 100000, _count: { requests: 10 }, infrastructure: [{ value: 80 }] },
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
