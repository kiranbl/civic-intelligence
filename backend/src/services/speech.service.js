import { v2 } from '@google-cloud/speech';
import { ServiceError } from '../errors/serviceError.js';
import { SPEECH_TIMEOUT_MS, SPEECH_API_ENDPOINT, speechRecognizer, recognitionConfig } from '../config/speech.js';

let client;
// Lazy ADC initialization: typed requests/health never need Speech credentials.
export const speechProvider = {
  recognize(request, options) {
    client ??= new v2.SpeechClient({ apiEndpoint: SPEECH_API_ENDPOINT });
    return client.recognize(request, options);
  },
};

export async function transcribeAudio(buffer, languageCode, districtName) {
  try {
    const [response] = await speechProvider.recognize({
      recognizer: speechRecognizer(),
      config: recognitionConfig(languageCode, districtName),
      content: buffer,
    }, { timeout: SPEECH_TIMEOUT_MS, retry: null });
    const transcript = (response.results || []).map(result => result.alternatives?.[0]?.transcript || '').join(' ').trim();
    if (transcript.length > 5000) throw new ServiceError('SPEECH_TOO_LONG');
    return { transcript, languageCode, noSpeech: !transcript };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    // No provider messages, credential paths, request objects, audio or transcript logs.
    throw new ServiceError('SPEECH_UNAVAILABLE');
  }
}
