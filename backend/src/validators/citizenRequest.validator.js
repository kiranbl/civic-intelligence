export const MAX_REQUEST_TEXT_LENGTH = 5000;
export const REQUEST_CHANNELS = ['TEXT', 'VOICE', 'MESSAGING'];

function invalid() {
  const error = new Error('Invalid request');
  error.status = 400;
  throw error;
}

export function validateRequestText(value) {
  if (typeof value !== 'string' || value.length > MAX_REQUEST_TEXT_LENGTH) invalid();
  const text = value.trim();
  if (!text) invalid();
  return text;
}

export function validateCitizenRequestBody(body, save = false) {
  const keys = save ? ['districtId', 'text', 'channel'] : ['text'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) invalid();
  const text = validateRequestText(body.text);
  if (!save) return { text };
  if (!Number.isInteger(body.districtId) || body.districtId <= 0 || body.districtId > 2147483647
    || !REQUEST_CHANNELS.includes(body.channel)) invalid();
  return { districtId: body.districtId, text, channel: body.channel };
}

export const validateAnalyzeRequest = (req, res, next) => {
  res.locals.input = validateCitizenRequestBody(req.body);
  next();
};
export const validateCreateRequest = (req, res, next) => {
  res.locals.input = validateCitizenRequestBody(req.body, true);
  next();
};
