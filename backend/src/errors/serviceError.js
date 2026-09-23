const errors = {
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
