import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeminiClient } from '../src/clients/gemini.client.js';
import { analyzeCitizenText } from '../src/services/requestAnalysis.service.js';

const primary = 'gemini-3.8-flash', fallback = 'gemini-3.6-flash';
const output = { isCivicRequest: true, language: 'en', category: 'WATER', subcategory: null, urgency: 'HIGH', areaType: 'RURAL', summaryEnglish: 'Village needs water.', locationText: null, confidence: 0.9 };
const response = raw => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: raw }] } }] });
function setup(failures, raw = JSON.stringify(output)) {
  const calls = [], waits = [], logs = [];
  const client = createGeminiClient({
    config: () => ({ apiKey: 'test-placeholder', model: primary, fallbackModels: [fallback, 'gemini-3.5-flash-lite'] }),
    random: () => 0, sleep: async ms => { waits.push(ms); }, log: event => logs.push(event),
    sdk: () => ({ models: { async generateContent(args) {
      calls.push(args);
      const status = failures[calls.length - 1];
      if (status) throw { response: { data: { error: { code: status, message: 'private upstream data' } } } };
      return response(raw);
    } } }),
  });
  return { client, calls, waits, logs };
}
for (const status of [null, 408, 429, 500, 502, 503, 504]) {
  test(`primary ${status || 'first attempt success'} uses bounded mocked retries`, async () => {
    const s = setup(status ? [status] : []);
    assert.equal((await analyzeCitizenText('Village needs water', s.client)).model, primary);
    assert.equal(s.calls.length, status ? 2 : 1);
    assert.deepEqual(s.waits, status ? [1000] : []);
  });
}
test('exhausted primary falls back once with identical prompt/schema and actual model metadata', async () => {
  const s = setup([503, 503, 503, 503]);
  const result = await analyzeCitizenText('Village needs water', s.client);
  assert.equal(result.model, fallback);
  assert.deepEqual(s.calls.map(c => c.model), [primary, primary, primary, primary, fallback]);
  assert.deepEqual(s.waits, [1000, 2000, 4000]);
  for (const call of s.calls) {
    assert.deepEqual(call.contents, s.calls[0].contents);
    assert.deepEqual(call.config.responseJsonSchema, s.calls[0].config.responseJsonSchema);
    assert.equal(call.config.systemInstruction, s.calls[0].config.systemInstruction);
  }
  const logs = JSON.stringify(s.logs);
  assert(!logs.includes('test-placeholder') && !logs.includes('Village needs water') && !logs.includes('private upstream'));
  assert(s.logs.some(l => l.fallbackAttempted && l.successfulModel === fallback));
});
test('all models unavailable gives controlled HTTP 503 without raw errors', async () => {
  const s = setup([503, 503, 503, 503, 503, 503]);
  await assert.rejects(analyzeCitizenText('Water', s.client), { status: 503, message: 'AI service is temporarily unavailable' });
  assert.equal(s.calls.length, 6);
});
for (const status of [400, 401, 403]) {
  test(`${status} never retries or falls back`, async () => {
    const s = setup([status]);
    await assert.rejects(analyzeCitizenText('Water', s.client), { code: 'AI_UNAVAILABLE' });
    assert.equal(s.calls.length, 1); assert.deepEqual(s.waits, []);
  });
}
test('malformed successful output and application validation never trigger fallback', async () => {
  const s = setup([], 'malformed');
  await assert.rejects(analyzeCitizenText('Water', s.client), { code: 'AI_INVALID_OUTPUT' });
  assert.equal(s.calls.length, 1);
  await assert.rejects(analyzeCitizenText('', s.client));
  assert.equal(s.calls.length, 1);
});

test('second fallback succeeds and preserves actual model', async () => {
  const s = setup([503, 503, 503, 503, 503]);
  const result = await analyzeCitizenText('Water', s.client);
  assert.equal(result.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(s.calls.map(c => c.model), [primary, primary, primary, primary, fallback, 'gemini-3.5-flash-lite']);
  for (const call of s.calls) {
    assert.deepEqual(call.contents, s.calls[0].contents);
    assert.equal(call.config.systemInstruction, s.calls[0].config.systemInstruction);
    assert.deepEqual(call.config.responseJsonSchema, s.calls[0].config.responseJsonSchema);
  }
});
test('jitter and delay are injectable; transient nested network errors recover', async () => {
  let calls = 0; const waits = [];
  const client = createGeminiClient({
    config: () => ({ apiKey: 'test-placeholder', model: primary }), random: () => 0.5,
    sleep: async ms => { waits.push(ms); }, log: () => {},
    sdk: () => ({ models: { async generateContent() {
      if (++calls < 4) throw { cause: { code: 'ECONNRESET' } };
      return response(JSON.stringify(output));
    } } }),
  });
  assert.equal((await client.analyze('Water')).model, primary);
  assert.deepEqual(waits, [1125, 2125, 4125]);
});
test('explicit permission status takes precedence over nested transient network cause', async () => {
  let calls = 0;
  const client = createGeminiClient({
    config: () => ({ apiKey: 'test-placeholder', model: primary }),
    sleep: async () => assert.fail('must not wait'), log: () => {},
    sdk: () => ({ models: { async generateContent() { calls++; throw { status: 403, cause: { code: 'ECONNRESET' } }; } } }),
  });
  await assert.rejects(client.analyze('Water'), { code: 'AI_UNAVAILABLE' });
  assert.equal(calls, 1);
});
