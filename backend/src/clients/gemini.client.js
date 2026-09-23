import { GoogleGenAI } from '@google/genai';
import { getGeminiConfig, GEMINI_TIMEOUT_MS, DEFAULT_GEMINI_FALLBACK_MODELS, GEMINI_RETRY_DELAYS_MS, GEMINI_RETRYABLE_STATUSES, GEMINI_RETRY_JITTER_MS } from '../config/gemini.js';
import { ServiceError } from '../errors/serviceError.js';
import { REQUEST_ANALYSIS_SCHEMA } from '../schemas/requestAnalysis.schema.js';
import { CITIZEN_REQUEST_INSTRUCTION, citizenRequestContents } from '../prompts/citizenRequest.prompt.js';

// Inspect only known error envelopes; never log raw SDK errors.
export function geminiHttpStatus(error) {
  const queue = [error], seen = new Set();
  for (let i = 0; i < queue.length && i < 20; i++) {
    let value = queue[i];
    if (typeof value === 'string' && value.length < 16000) {
      try { value = JSON.parse(value); } catch { continue; }
    }
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    for (const field of ['status', 'statusCode', 'code']) {
      if (/^[1-5]\d{2}$/.test(String(value[field]))) return Number(value[field]);
    }
    for (const field of ['error', 'response', 'data', 'cause', 'message']) queue.push(value[field]);
  }
  return null;
}

// Only explicit transport failures are transient; generic errors are not retried.
function isTransient(error, status) {
  if (status !== null) return GEMINI_RETRYABLE_STATUSES.includes(status);
  if (error instanceof ServiceError) return error.code === 'AI_TIMEOUT';
  const codes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'];
  const seen = new Set();
  for (let value = error; value && !seen.has(value); value = value.cause) {
    seen.add(value);
    if (codes.includes(value.code) || value.name === 'TimeoutError') return true;
  }
  return false;
}

// Tests inject SDK calls, retry waits and randomness.
export function createGeminiClient({ config = getGeminiConfig, sdk = options => new GoogleGenAI(options), timeoutMs = GEMINI_TIMEOUT_MS,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  retryDelays = GEMINI_RETRY_DELAYS_MS,
  random = Math.random,
  log = event => console.info('Gemini availability', event),
} = {}) {
  return {
    async analyze(text) {
      const { apiKey, model: primaryModel, fallbackModels = DEFAULT_GEMINI_FALLBACK_MODELS } = config();
      const attempt = async model => {
        const abort = new AbortController();
        let timer;
        try {
          const client = sdk({ apiKey, vertexai: false, httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } } });
          const request = client.models.generateContent({
            model,
            contents: citizenRequestContents(text),
            config: {
              systemInstruction: CITIZEN_REQUEST_INSTRUCTION,
              responseMimeType: 'application/json',
              responseJsonSchema: REQUEST_ANALYSIS_SCHEMA,
              abortSignal: abort.signal,
              maxOutputTokens: 2048,
            },
          });
          const deadline = new Promise((resolve, reject) => {
            timer = setTimeout(() => { abort.abort(); reject(new ServiceError('AI_TIMEOUT')); }, timeoutMs);
          });
          const response = await Promise.race([request, deadline]);
          // Do not use the SDK text getter: it can log warnings about other parts.
          const candidates = response?.candidates;
          const candidate = candidates?.[0];
          const parts = candidate?.content?.parts;
          if (response?.promptFeedback?.blockReason || candidates?.length !== 1 || candidate?.finishReason !== 'STOP'
            || !Array.isArray(parts) || !parts.length || parts.some(part => typeof part.text !== 'string' || part.thought)) {
            throw new ServiceError('AI_INVALID_OUTPUT');
          }
          return { text: parts.map(part => part.text).join(''), model };
        } catch (error) {
          if (error instanceof ServiceError) throw error;
          if (abort.signal.aborted || error?.name === 'TimeoutError') throw new ServiceError('AI_TIMEOUT');
          // The outer retry loop converts SDK failures to controlled service errors.
          throw error;
        } finally {
          clearTimeout(timer);
        }
      };
      const models = [...retryDelays.map(() => primaryModel), primaryModel, ...fallbackModels];
      for (let index = 0; index < models.length; index++) {
        const fallback = index > retryDelays.length;
        if (index > 0 && !fallback) await sleep(retryDelays[index - 1] + Math.floor(random() * GEMINI_RETRY_JITTER_MS));
        const model = models[index];
        log({ attempt: fallback ? 1 : index + 1, fallbackAttempted: fallback });
        try {
          const result = await attempt(model);
          log({ successfulModel: model, fallbackAttempted: fallback });
          return result;
        } catch (error) {
          const status = error instanceof ServiceError ? null : geminiHttpStatus(error);
          log({ attempt: fallback ? 1 : index + 1, httpStatus: status, fallbackAttempted: fallback });
          if (!isTransient(error, status)) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError('AI_UNAVAILABLE');
          }
          if (index === models.length - 1) throw new ServiceError('AI_CAPACITY_UNAVAILABLE');
        }
      }
    },
  };
}

export const geminiClient = createGeminiClient();
