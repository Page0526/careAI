class HttpError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = options.details;
  }
}

function route(handler) {
  return function wrappedRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function sendJson(res, payload, status = 200) {
  res.status(status).json(payload);
}

function badRequest(message, details) {
  return new HttpError(400, message, { details });
}

function notFound(message) {
  return new HttpError(404, message);
}

function parsePositiveInt(value, { field = 'value', defaultValue } = {}) {
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw badRequest(`${field} is required`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw badRequest(`${field} must be a positive integer`);
  }

  return parsed;
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, 'body')) {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  const status = error.status || 500;
  const payload = {
    error: status >= 500 ? 'Internal server error' : error.message,
  };

  if (status >= 500) {
    payload.message = error.message;
    console.error('Server Error:', error);
  } else if (error.details) {
    payload.details = error.details;
  }

  res.status(status).json(payload);
}

module.exports = {
  HttpError,
  badRequest,
  errorHandler,
  notFound,
  parsePositiveInt,
  route,
  sendJson,
};