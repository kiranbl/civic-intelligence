import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, mock, test } from 'node:test';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

let server;
let baseUrl;
const district = { id: 7, name: 'Demo district', state: 'Karnataka', population: 1000 };
const restoreQueries = [];

// Prisma delegates are proxies; replace query functions directly because
// Node's mock.method cannot read their property descriptors.
function mockQuery(model, method, implementation) {
  const original = prisma[model][method];
  const replacement = mock.fn(implementation);
  prisma[model][method] = replacement;
  restoreQueries.push(() => { prisma[model][method] = original; });
  return replacement;
}

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api/districts`;
});

afterEach(() => {
  while (restoreQueries.length) restoreQueries.pop()();
  mock.restoreAll();
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await prisma.$disconnect();
});

test('GET /api/districts lists districts with stable sorting', async () => {
  const query = mockQuery('district', 'findMany', async () => [district]);
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: [district] });
  assert.deepEqual(query.mock.calls[0].arguments, [{ orderBy: [{ name: 'asc' }, { state: 'asc' }] }]);
});

test('GET /api/districts returns an empty list when no districts exist', async () => {
  mockQuery('district', 'findMany', async () => []);
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: [] });
});

test('GET /api/districts/:id retrieves the numeric district ID', async () => {
  const query = mockQuery('district', 'findUnique', async () => district);
  const response = await fetch(`${baseUrl}/7`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: district });
  assert.deepEqual(query.mock.calls[0].arguments, [{ where: { id: 7 } }]);
});

for (const [suffix, model] of [['requests', 'citizenRequest'], ['infrastructure', 'infrastructureMetric']]) {
  test(`GET /api/districts/:id/${suffix} filters records to that district`, async () => {
    mockQuery('district', 'findUnique', async () => district);
    const records = [{ id: 21, districtId: 7 }];
    const query = mockQuery(model, 'findMany', async () => records);
    const response = await fetch(`${baseUrl}/7/${suffix}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: records });
    assert.deepEqual(query.mock.calls[0].arguments[0].where, { districtId: 7 });
  });

  test(`existing district with no ${suffix} returns an empty list`, async () => {
    mockQuery('district', 'findUnique', async () => district);
    mockQuery(model, 'findMany', async () => []);
    const response = await fetch(`${baseUrl}/7/${suffix}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: [] });
  });
}

for (const suffix of ['', '/requests', '/infrastructure']) {
  test(`unknown district returns 404 for /:id${suffix}`, async () => {
    mockQuery('district', 'findUnique', async () => null);
    const requests = mockQuery('citizenRequest', 'findMany', async () => []);
    const metrics = mockQuery('infrastructureMetric', 'findMany', async () => []);
    const response = await fetch(`${baseUrl}/999${suffix}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { success: false, message: 'District not found' });
    assert.equal(requests.mock.callCount(), 0);
    assert.equal(metrics.mock.callCount(), 0);
  });

  test(`invalid IDs return 400 before a database query for /:id${suffix}`, async () => {
    const query = mockQuery('district', 'findUnique', async () => district);
    for (const id of ['0', '-1', '1.5', 'abc', '1abc', '1e2', '01', '%20', '2147483648', '9007199254740993']) {
      const response = await fetch(`${baseUrl}/${id}${suffix}`);
      assert.equal(response.status, 400, `ID: ${id}`);
      assert.deepEqual(await response.json(), { success: false, message: 'Invalid request' });
    }
    assert.equal(query.mock.callCount(), 0);
  });
}

for (const [suffix, model, method] of [
  ['', 'district', 'findMany'],
  ['/7', 'district', 'findUnique'],
  ['/7/requests', 'citizenRequest', 'findMany'],
  ['/7/infrastructure', 'infrastructureMetric', 'findMany'],
]) {
  test(`database errors are hidden for GET /api/districts${suffix}`, async () => {
    if (model !== 'district') mockQuery('district', 'findUnique', async () => district);
    mockQuery(model, method, async () => {
      throw new Error('Prisma internal connection details must not be exposed');
    });
    mock.method(console, 'error', () => {});
    const response = await fetch(`${baseUrl}${suffix}`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false, message: 'Internal server error' });
  });
}

test('district write endpoints are not available', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await fetch(`${baseUrl}/7`, { method });
    assert.equal(response.status, 404);
  }
});
