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
  } else if (status === 413) {
    message = 'Request body too large';
  } else if (status < 500) {
    message = 'Request could not be processed';
  }

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ success: false, message });
}
