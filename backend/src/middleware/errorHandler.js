import { ServiceError } from '../errors/serviceError.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

  let message = 'Internal server error';

  if (status === 400) {
    message = 'Invalid request';
  } else if (status === 404) {
    message = 'District not found';
  } else if (status === 413) {
    message = 'Request body too large';
  } else if (status < 500) {
    message = 'Request could not be processed';
  }

  if (status >= 500) {
    // Do not log raw SDK/Prisma errors or citizen text: they may contain secrets.
    console.error('Request failed', { status, code: error instanceof ServiceError ? error.code : 'INTERNAL_ERROR' });
  }

  if (error instanceof ServiceError) message = error.message;

  res.status(status).json({ success: false, message });
}
