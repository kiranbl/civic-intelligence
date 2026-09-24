import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboard } from '../src/services/api.js';
for (const scenario of ['success', 'partial', 'empty', 'failure']) {
  test(`GET dashboard loader: ${scenario}`, async () => {
    const original = globalThis.fetch; const urls = [];
    globalThis.fetch = async (url, options) => {
      urls.push(url); assert.equal(options.method, undefined);
      if (scenario === 'failure' && url.endsWith('/districts')) throw Error('private error');
      if (scenario === 'partial' && url.endsWith('/requests')) throw Error('unavailable');
      const data = url.endsWith('/districts') ? (scenario === 'empty' ? [] : [{ id: 9 }]) : url.endsWith('/requests') ? [{ id: 1 }, { id: 2 }] : [];
      return { ok: true, json: async () => ({ success: true, data }) };
    };
    try {
      if (scenario === 'failure') { const result = await loadDashboard(new AbortController().signal); assert.equal(result.districtsFailed, true); assert.equal(result.requestCount, null); assert.equal(result.analyticsFailed, false); }
      else {
        const result = await loadDashboard(new AbortController().signal);
        assert.equal(result.connected, true);
        assert.equal(result.requestCount, scenario === 'partial' ? null : scenario === 'empty' ? 0 : 2);
        assert(urls.some(u => u.endsWith('/analytics/water-priority')));
      }
    } finally { globalThis.fetch = original; }
  });
}
