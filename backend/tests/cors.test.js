import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../src/config/cors.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

test('CORS development defaults allow both Vite origins and reject other origins', () => {
  const config = corsOptions({ NODE_ENV: 'development' });
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', undefined]) {
    config.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  }
  config.origin('https://untrusted.invalid', error => assert.equal(error.status, 403));
});

test('production CORS requires explicit HTTPS origins and rejects wildcards, paths, credentials and null origin', () => {
  for (const value of ['', '*', 'null', 'http://localhost:5173', 'https://site.invalid/path', 'https://site.invalid/', 'https://user:pass@site.invalid', 'https://*.vercel.app', 'https://site.invalid,']) {
    assert.throws(() => corsOptions({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: value }), /CORS_ALLOWED_ORIGINS/);
  }
});

test('production CORS serves allowed preflight, denies disallowed POST before handler and permits no-Origin health', async () => {
  const app = express(); let posts = 0;
  app.use(cors(corsOptions({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://frontend.example.invalid,https://preview.example.invalid' })));
  app.get('/api/health', (req, res) => res.json({ success: true }));
  app.post('/example', (req, res) => { posts++; res.json({ success: true }); });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const preflight = await fetch(base + '/example', { method: 'OPTIONS', headers: { Origin: 'https://frontend.example.invalid', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://frontend.example.invalid');
    assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
    assert.equal(preflight.headers.get('access-control-allow-headers'), 'Content-Type');
    assert.match(preflight.headers.get('vary'), /Origin/);
    const rejected = await fetch(base + '/example', { method: 'POST', headers: { Origin: 'https://evil.invalid' } });
    assert.equal(rejected.status, 403); assert.equal(posts, 0);
    assert.equal(rejected.headers.get('access-control-allow-origin'), null);
    assert.equal((await fetch(base + '/api/health')).status, 200);
    const allowed = await fetch(base + '/api/health', { headers: { Origin: 'https://preview.example.invalid' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://preview.example.invalid');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
