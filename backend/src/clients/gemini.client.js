import { GoogleGenAI } from '@google/genai';
import { getGeminiConfig, GEMINI_TIMEOUT_MS } from '../config/gemini.js';
import { ServiceError } from '../errors/serviceError.js';
import { REQUEST_ANALYSIS_SCHEMA } from '../schemas/requestAnalysis.schema.js';
import { CITIZEN_REQUEST_INSTRUCTION, citizenRequestContents } from '../prompts/citizenRequest.prompt.js';

// Factory permits SDK-contract tests with no network and no API key.
export function createGeminiClient({ config = getGeminiConfig, sdk = options => new GoogleGenAI(options), timeoutMs = GEMINI_TIMEOUT_MS } = {}) {
  return {
    async analyze(text) {
      const { apiKey, model } = config();
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
        if (abort.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') throw new ServiceError('AI_TIMEOUT');
        // Never propagate SDK messages, causes, response bodies, or stack traces.
        throw new ServiceError('AI_UNAVAILABLE');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const geminiClient = createGeminiClient();
