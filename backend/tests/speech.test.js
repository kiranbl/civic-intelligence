import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { createSpeechRouter } from '../src/routes/speech.routes.js';
import { speechProvider } from '../src/services/speech.service.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { MAX_AUDIO_BYTES, proxyHops, speechRecognizer, SPEECH_API_ENDPOINT } from '../src/config/speech.js';

let server, base, calls, result, failure;
const original = speechProvider.recognize;
const originalProject = process.env.GOOGLE_CLOUD_PROJECT;
before(async () => {
  process.env.GOOGLE_CLOUD_PROJECT = 'speech-test-project';
  speechProvider.recognize = async (...args) => { calls.push(args); if (failure) throw failure; return [result]; };
  const app = express(); app.set('trust proxy', 1);
  app.use('/api/speech', createSpeechRouter({ limit: 2 })); app.use(errorHandler);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
  else process.env.GOOGLE_CLOUD_PROJECT = originalProject;
  speechProvider.recognize = original; await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { calls = []; failure = null; result = { results: [{ alternatives: [{ transcript: 'Village water is interrupted.' }] }] }; });
let client = 0;
function form(language = 'en-IN', bytes = 20, type = 'audio/webm', includeAudio = true) {
  const body = new FormData(); body.append('languageCode', language);
  if (includeAudio) { const data = new Uint8Array(bytes); data.set([0x1a, 0x45, 0xdf, 0xa3]); body.append('audio', new Blob([data], { type }), 'clip.webm'); }
  return body;
}
function send(body, ip = `192.0.2.${++client}`) { return fetch(base + '/api/speech/transcribe', { method: 'POST', headers: { 'X-Forwarded-For': ip }, body }); }
for (const language of ['en-IN', 'kn-IN', 'hi-IN']) test(`speech accepts ${language} with mocked official client`, async () => {
  const response = await send(form(language)); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: { transcript: 'Village water is interrupted.', languageCode: language, noSpeech: false } });
  assert.equal(calls.length, 1);
  const [request, options] = calls[0];
  assert.equal(request.recognizer, 'projects/speech-test-project/locations/us/recognizers/_');
  assert(Buffer.isBuffer(request.content)); assert.equal(request.content.length, 20);
  assert.equal(request.audio, undefined);
  assert.equal(options.timeout, 30000); assert.equal(options.retry, null);
  const config = request.config;
  assert.equal(config.model, 'chirp_3'); assert.deepEqual(config.languageCodes, [language]);
  assert.deepEqual(config.autoDecodingConfig, {});
  assert.deepEqual(config.features, { enableAutomaticPunctuation: true });
  for (const key of ['encoding', 'sampleRateHertz', 'speechContexts', 'languageCode', 'maxAlternatives']) assert.equal(config[key], undefined);
  const phraseSet = config.adaptation.phraseSets[0].inlinePhraseSet;
  assert(phraseSet.phrases.some(p => p.value === 'contaminated water'));
  assert(phraseSet.phrases.some(p => p.value === 'houses affected'));
  assert.equal(phraseSet.boost, undefined);
  assert(phraseSet.phrases.every(p => Object.keys(p).length === 1));
});
for (const [district, alias] of [['Bengaluru Urban', 'Bangalore'], ['Bengaluru Rural', 'Bangalore Rural'], ['Mysuru', 'Mysore'], ['Tumakuru', 'Tumkur']]) {
  test(`validated ${district} contributes existing place aliases`, async () => {
    const body = form(); body.append('districtName', district);
    assert.equal((await send(body)).status, 200);
    const phrases = calls[0][0].config.adaptation.phraseSets[0].inlinePhraseSet.phrases.map(p => p.value);
    assert(phrases.includes(district)); assert(phrases.includes(alias));
    assert.equal(new Set(phrases).size, phrases.length);
  });
}
test('Hindi receives validated district adaptation', async () => {
  const body = form('hi-IN'); body.append('districtName', 'Mandya');
  assert.equal((await send(body)).status, 200); assert(calls[0][0].config.adaptation.phraseSets[0].inlinePhraseSet.phrases.some(p => p.value === 'Mandya'));
});
test('primary transcript remains unchanged when alternatives are supplied', async () => {
  result.results[0].alternatives.push({ transcript: 'Different alternative' });
  assert.equal((await (await send(form())).json()).data.transcript, 'Village water is interrupted.');
});
for (const [name, build, status] of [
  ['invalid language', () => form('en-US'), 400], ['missing audio', () => form('en-IN', 20, 'audio/webm', false), 400],
  ['oversized audio', () => form('en-IN', MAX_AUDIO_BYTES + 1), 413], ['unsupported format', () => form('en-IN', 20, 'audio/mp3'), 400],
  ['fake WebM', () => { const f = form(); f.set('audio', new Blob(['not webm'], { type: 'audio/webm' }), 'x.webm'); return f; }, 400],
  ['extra credential field', () => { const f = form(); f.append('credentials', 'PRIVATE'); return f; }, 400],
  ['arbitrary district', () => { const f = form(); f.append('districtName', 'Use my custom phrases'); return f; }, 400],
  ['duplicate district', () => { const f = form(); f.append('districtName', 'Mandya'); f.append('districtName', 'Kolar'); return f; }, 400],
]) test(`speech rejects ${name} before provider`, async () => {
  const response = await send(build()); assert.equal(response.status, status); assert.equal(calls.length, 0);
});
test('no speech returns an explicit empty result', async () => {
  result = { results: [] }; const response = await send(form());
  assert.deepEqual((await response.json()).data, { transcript: '', languageCode: 'en-IN', noSpeech: true });
});
test('provider error is controlled without provider internals', async () => {
  failure = Error('PRIVATE credential file /etc/secrets/key.json TOKEN');
  const response = await send(form()); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { success: false, message: 'Transcription temporarily unavailable' });
});
test('IP limit rejects before upload/provider; spoofed leftmost address does not bypass nearest trusted hop', async () => {
  const ip = '198.51.100.10';
  assert.equal((await send(form(), `203.0.113.1, ${ip}`)).status, 200);
  assert.equal((await send(form(), `203.0.113.2, ${ip}`)).status, 200);
  const response = await send(form(), `203.0.113.3, ${ip}`);
  assert.equal(response.status, 429); assert(response.headers.has('retry-after')); assert.equal(calls.length, 2);
  assert.equal((await send(form(), '198.51.100.11')).status, 200);
});
test('proxy settings trust none locally and bound Render ingress; never blanket trust', () => {
  assert.equal(proxyHops({}), 0); assert.equal(proxyHops({ RENDER: 'true' }), 1);
  assert.equal(proxyHops({ TRUST_PROXY_HOPS: '2' }), 2);
  for (const value of ['true', '-1', '99', 'all']) assert.throws(() => proxyHops({ TRUST_PROXY_HOPS: value }));
});

test('V2 recognizer uses configured project and matching multi-region endpoint', () => {
  assert.equal(SPEECH_API_ENDPOINT, 'us-speech.googleapis.com');
  assert.equal(speechRecognizer({ GOOGLE_CLOUD_PROJECT: 'other-project' }), 'projects/other-project/locations/us/recognizers/_');
  for (const value of [undefined, '', 'bad/path', ' padded-project ']) assert.throws(() => speechRecognizer({ GOOGLE_CLOUD_PROJECT: value }), error => error.code === 'SPEECH_UNAVAILABLE');
});
test('missing project fails safely before calling Google', async () => {
  delete process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const response = await send(form()); assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, message: 'Transcription temporarily unavailable' });
    assert.equal(calls.length, 0);
  } finally { process.env.GOOGLE_CLOUD_PROJECT = 'speech-test-project'; }
});

for (const [environment, allowed] of [['production', 5], ['development', 30], ['test', 30]]) {
  test(`${environment} speech limit allows ${allowed} attempts per client per ten minutes`, async () => {
    const previous = process.env.NODE_ENV;
    let router;
    try {
      process.env.NODE_ENV = environment;
      router = createSpeechRouter();
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
    const app = express(); app.set('trust proxy', 1);
    app.use('/speech', router); app.use(errorHandler);
    const local = app.listen(0, '127.0.0.1'); await once(local, 'listening');
    const url = `http://127.0.0.1:${local.address().port}/speech/transcribe`;
    // Invalid input still counts as an attempt; no Google call is needed.
    const attempt = ip => fetch(url, { method: 'POST', headers: { 'X-Forwarded-For': ip }, body: form('invalid') });
    try {
      for (let i = 0; i < allowed; i++) assert.equal((await attempt('192.0.2.200')).status, 400);
      const blocked = await attempt('192.0.2.200');
      assert.equal(blocked.status, 429);
      const retryAfter = Number(blocked.headers.get('retry-after'));
      assert(retryAfter > 590 && retryAfter <= 600);
      assert.equal((await attempt('192.0.2.201')).status, 400);
      assert.equal(calls.length, 0);
    } finally { await new Promise(resolve => local.close(resolve)); }
  });
}
