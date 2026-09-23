import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geminiDiagnostics, diagnosticSdkFactory, printGeminiDiagnostics } from '../scripts/smoke/diagnostics.js';
import { createGeminiClient } from '../src/clients/gemini.client.js';

const context = { model: 'gemini-3.8-flash', apiKey: 'test-secret-not-a-real-key' };
test('extracts Google JSON error messages without dumping SDK properties', () => {
  const error = new Error(JSON.stringify({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'The API is disabled.' } }));
  error.request = { headers: { authorization: 'private-header' } };
  const result = geminiDiagnostics(error, context);
  assert.deepEqual(result, { model: context.model, apiKeyConfigured: true, httpStatus: 403, errorStatus: 'PERMISSION_DENIED', message: 'The API is disabled.' });
});
test('supports nested response/data/error and cause/details status fields', () => {
  const result = geminiDiagnostics({ response: { status: 429, data: { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded.' } } } }, context);
  assert.equal(result.httpStatus, 429); assert.equal(result.errorStatus, 'RESOURCE_EXHAUSTED'); assert.equal(result.message, 'Quota exceeded.');
  assert.equal(geminiDiagnostics({ cause: { details: [{ code: 'ECONNRESET', message: 'Connection reset.' }] } }, context).errorStatus, 'ECONNRESET');
});
test('redacts keys, encoded keys, other configured secrets, URLs, headers and stacks', () => {
  for (const message of [`Invalid key ${context.apiKey}`, `Key ${encodeURIComponent(context.apiKey)}`, 'Authorization: Bearer private-header', 'headers={"x-key":"private-header"}', 'Failed https://example.test?key=private-header', 'Failure\n at secret/path:1', 'Password: private-password']) {
    const result = geminiDiagnostics({ message }, { ...context, secrets: ['private-password'] });
    const lines = []; printGeminiDiagnostics(result, value => lines.push(value));
    const printed = lines.join('\n');
    for (const secret of [context.apiKey, 'private-header', 'private-password', 'secret/path']) assert(!printed.includes(secret));
  }
});
test('missing fields and cyclic envelopes produce bounded safe diagnostics', () => {
  const error = {}; error.cause = error;
  const result = geminiDiagnostics(error, { model: context.model });
  assert.equal(result.apiKeyConfigured, false); assert.equal(result.httpStatus, 'unavailable');
  assert.equal(result.message, 'No safe error message available');
});
test('smoke wrapper captures diagnostics but production client still returns the same safe error', async () => {
  let captured;
  const sdk = diagnosticSdkFactory(() => ({ models: { async generateContent() { throw { status: 403, error: { status: 'PERMISSION_DENIED', message: 'Permission denied.' } }; } } }), context, value => { captured = value; });
  const client = createGeminiClient({ config: () => ({ apiKey: context.apiKey, model: context.model }), sdk });
  await assert.rejects(client.analyze('Water please'), { code: 'AI_UNAVAILABLE', message: 'AI service is temporarily unavailable' });
  assert.equal(captured.httpStatus, 403); assert.equal(captured.errorStatus, 'PERMISSION_DENIED');
});
