import { DISTRICT_ALIASES } from '../../scripts/import/censusPopulationData.js';
import { ServiceError } from '../errors/serviceError.js';

// https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
export const SPEECH_LANGUAGES = ['en-IN', 'hi-IN', 'kn-IN'];
export const SPEECH_LOCATION = 'us';
export const SPEECH_API_ENDPOINT = `${SPEECH_LOCATION}-speech.googleapis.com`;
export function speechRecognizer(env = process.env) {
  const project = env.GOOGLE_CLOUD_PROJECT;
  if (typeof project !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) throw new ServiceError('SPEECH_UNAVAILABLE');
  return `projects/${project}/locations/${SPEECH_LOCATION}/recognizers/_`;
}
const CIVIC_PHRASES = ['drinking water', 'water supply', 'water quality', 'dirty water',
  'contaminated water', 'pipeline', 'broken pipeline', 'water shortage', 'low pressure',
  'households', 'houses affected', 'village', 'ward', 'area', 'road', 'garbage',
  'sanitation', 'sewage', 'drainage', 'electricity', 'hospital', 'school', 'transport'];

export function validSpeechDistrict(name) {
  return name === undefined || (typeof name === 'string' && Object.values(DISTRICT_ALIASES).includes(name));
}

export function recognitionConfig(languageCode, districtName) {
  if (!SPEECH_LANGUAGES.includes(languageCode) || !validSpeechDistrict(districtName)) throw new ServiceError('SPEECH_INPUT');
  const aliases = Object.entries(DISTRICT_ALIASES).filter(([, name]) => name === districtName).flat();
  const phrases = [...new Set([...CIVIC_PHRASES, ...aliases])].map(value => ({ value }));
  const config = {
    autoDecodingConfig: {}, languageCodes: [languageCode], model: 'chirp_3',
    features: { enableAutomaticPunctuation: true },
    adaptation: { phraseSets: [{ inlinePhraseSet: { phrases } }] },
  };
  return config;
}
export const MAX_AUDIO_BYTES = 1024 * 1024;
export const SPEECH_TIMEOUT_MS = 30000;

export function proxyHops(env = process.env) {
  // Trust only the nearest Render ingress by default, never every forwarded hop.
  // Increase only after verifying the deployed proxy chain; direct local access trusts none.
  const value = env.TRUST_PROXY_HOPS ?? (env.RENDER === 'true' ? '1' : '0');
  if (!/^[0-5]$/.test(value)) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5');
  return Number(value);
}
