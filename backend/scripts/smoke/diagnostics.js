// Manual smoke diagnostics only. Never serialize an SDK error/request wholesale.
export function sanitizeDiagnosticMessage(value, secrets = []) {
  if (typeof value !== 'string') return null;
  let text = value;
  for (const secret of secrets.filter(value => typeof value === 'string' && value.length)) {
    for (const form of [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)]) {
      text = text.split(form).join('[REDACTED]');
    }
  }
  // Prefer omitting a diagnostic to disclosing embedded headers or request objects.
  if (/authorization|headers?|process\.env|environment\s*[:=]|request\s*(?:object|body|config)|[{}]/i.test(text)) {
    return '[Message omitted: contains structured request, header, or environment details]';
  }
  return text
    .replace(/AIza[\w-]+/g, '[REDACTED]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:api[_ -]?key|token|secret|password)\s*[:=]\s*\S+/gi, '[REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[URL omitted]')
    .split(/\r?\n/)[0]
    .replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')
    .slice(0, 600);
}

export function geminiDiagnostics(error, { model, apiKey, secrets = [] }) {
  const redactions = [apiKey, ...secrets].filter(Boolean);
  const queue = [error];
  const visited = new Set();
  let httpStatus, errorStatus, message;
  // Only traverse known error envelopes; never inspect request/config/headers.
  for (let i = 0; i < queue.length && i < 30; i++) {
    let item = queue[i];
    if (typeof item === 'string') {
      if (item.length > 16000) continue;
      try { item = JSON.parse(item); } catch { continue; }
    }
    if (!item || typeof item !== 'object' || visited.has(item)) continue;
    visited.add(item);
    for (const key of ['statusCode', 'status', 'code']) {
      const value = item[key];
      if ((typeof value === 'number' || typeof value === 'string') && /^[1-5]\d{2}$/.test(String(value))) {
        httpStatus ??= Number(value);
      } else if (typeof value === 'string' && /^[A-Z][A-Z0-9_.-]{0,79}$/.test(value)) {
        errorStatus ??= sanitizeDiagnosticMessage(value, redactions);
      }
    }
    if (typeof item.message === 'string') {
      let envelope;
      try { envelope = JSON.parse(item.message); } catch { /* plain message */ }
      if (envelope && typeof envelope === 'object') queue.push(envelope);
      else message = sanitizeDiagnosticMessage(item.message, redactions);
    }
    for (const key of ['error', 'response', 'data', 'cause', 'details']) {
      const value = item[key];
      if (Array.isArray(value)) queue.push(...value.slice(0, 10));
      else if (value !== undefined) queue.push(value);
    }
  }
  return {
    model: sanitizeDiagnosticMessage(model, redactions) || 'unknown',
    apiKeyConfigured: Boolean(apiKey?.trim()),
    httpStatus: httpStatus ?? 'unavailable',
    errorStatus: errorStatus ?? 'unavailable',
    message: message || 'No safe error message available',
  };
}

export function printGeminiDiagnostics(diagnostic, log = console.error) {
  log('Gemini smoke test failed');
  log(`Model: ${diagnostic.model}`);
  log(`API key configured: ${diagnostic.apiKeyConfigured ? 'yes' : 'no'}`);
  log(`HTTP status: ${diagnostic.httpStatus}`);
  log(`Error status: ${diagnostic.errorStatus}`);
  log(`Message: ${diagnostic.message}`);
}

export function diagnosticSdkFactory(makeSdk, context, capture) {
  return options => {
    let client;
    try { client = makeSdk(options); } catch (error) {
      capture(geminiDiagnostics(error, context));
      throw error;
    }
    return { models: { async generateContent(args) {
      try {
        const response = await client.models.generateContent(args);
        capture(undefined); // A recovered retry must not mask later validation errors.
        return response;
      } catch (error) {
        capture(geminiDiagnostics(error, { ...context, model: args.model }));
        throw error;
      }
    } } };
  };
}
