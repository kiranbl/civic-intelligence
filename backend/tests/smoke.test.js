import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSmoke } from '../scripts/smoke/gemini.js';
import { createGeminiClient } from '../src/clients/gemini.client.js';
import prisma from '../src/config/prisma.js';

const context = { model: 'gemini-3.8-flash', apiKey: 'test-placeholder' };
const output = { language: 'en', category: 'WATER', subcategory: null, urgency: 'HIGH', areaType: 'RURAL', summaryEnglish: 'Village needs water.', locationText: null, confidence: 0.9 };
test('smoke continues all languages after exhaustion, validates results and never writes to DB', async () => {
  const original = prisma.citizenRequest.create;
  let writes = 0;
  prisma.citizenRequest.create = () => { writes++; assert.fail('smoke must not write'); };
  const logs = [], inputs = [];
  const client = createGeminiClient({ config: () => ({ ...context }), sleep: async () => {}, random: () => 0, log: () => {},
    sdk: () => ({ models: { async generateContent(args) {
      const text = args.contents[0].parts[0].text; inputs.push(text);
      if (text.includes('The drinking')) throw { status: 503 };
      return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] };
    } } }),
  });
  try {
    const result = await runSmoke({ client, context, log: value => logs.push(value) });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.results.map(r => [r.language, r.passed]), [['English', false], ['Kannada', true], ['Hindi', true], ['Prompt injection', true]]);
    assert.equal(new Set(inputs).size, 4);
    assert(logs.includes('English: FAIL - all models unavailable'));
    assert(logs.includes('Hindi: PASS - gemini-3.8-flash'));
    assert(!logs.join('\n').includes(context.apiKey));
    assert.equal(writes, 0);
  } finally { prisma.citizenRequest.create = original; }
});
test('smoke all-pass summary returns zero exit status and reports each actual model', async () => {
  const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  let calls = 0;
  const result = await runSmoke({ context, log: () => {}, analyze: async () => ({ ...output, model: models[calls++] }) });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.results.map(r => r.model), models);
});

test('smoke flags an instruction-overridden injection classification as failure', async () => {
  const result = await runSmoke({ context, log: () => {}, analyze: async text => ({ ...output, model: context.model,
    category: text.startsWith('Ignore all previous') ? 'ELECTRICITY' : 'WATER',
  }) });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.results.map(r => r.passed), [true, true, true, false]);
  assert.equal(result.results[3].language, 'Prompt injection');
});
