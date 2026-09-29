const errors = {
  INVALID_CIVIC_CONTENT: [422, 'Please describe a local civic or infrastructure problem.'],
  SPEECH_INPUT: [400, 'Provide one audio file and a supported language: en-IN, kn-IN, or hi-IN'],
  SPEECH_FORMAT: [400, 'Use a WebM Opus audio recording'],
  SPEECH_SIZE: [413, 'Audio recording is too large (maximum 1 MiB)'],
  SPEECH_TOO_LONG: [400, 'Transcription is too long. Record a shorter request.'],
  SPEECH_UNAVAILABLE: [503, 'Transcription temporarily unavailable'],
  AI_NOT_CONFIGURED: [503, 'AI service is not configured'],
  AI_TIMEOUT: [504, 'AI service timed out'],
  AI_UNAVAILABLE: [502, 'AI service is temporarily unavailable'],
  AI_CAPACITY_UNAVAILABLE: [503, 'AI service is temporarily unavailable'],
  AI_INVALID_OUTPUT: [502, 'AI service returned an invalid analysis'],
};

// Only server-owned error codes can produce public AI error messages.
export class ServiceError extends Error {
  constructor(code) {
    const entry = errors[code];
    if (!entry) throw new Error('Unknown service error code');
    super(entry[1]);
    this.status = entry[0];
    this.code = code;
  }
}
