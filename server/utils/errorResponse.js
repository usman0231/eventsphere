// Central error mapping for the API.
// Turns thrown/caught errors into a safe { status, body } response — mapping common
// Mongoose/JWT errors to proper 4xx codes and NEVER leaking internal 500 details in prod.

function mapError(err) {
  // Mongoose schema validation
  if (err && err.name === 'ValidationError') {
    const fields = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }));
    return {
      status: 400,
      body: { success: false, message: fields[0]?.message || 'Validation failed', errors: fields },
    };
  }

  // Malformed ObjectId / type cast (e.g. /expos/not-an-id)
  if (err && err.name === 'CastError') {
    return { status: 400, body: { success: false, message: `Invalid value for '${err.path}'` } };
  }

  // Duplicate unique key (e.g. email already registered)
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return { status: 409, body: { success: false, message: `That ${field} is already in use` } };
  }

  // JWT problems (normally caught in auth middleware, here as a safety net)
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
    return { status: 401, body: { success: false, message: 'Token invalid or expired' } };
  }

  const status = err.status || err.statusCode || 500;
  // For unexpected server errors, hide the real message in production.
  const exposeMessage = status < 500 || process.env.NODE_ENV !== 'production';
  const message = exposeMessage ? (err.message || 'Internal Server Error') : 'Something went wrong. Please try again.';
  return { status, body: { success: false, message } };
}

// Logs server-side (5xx only) and sends the mapped response.
function sendError(res, err) {
  const { status, body } = mapError(err);
  if (status >= 500) console.error('[API error]', err && err.stack ? err.stack : err);
  return res.status(status).json(body);
}

// Express middleware that exposes res.fail(err) to every route handler.
function attachFail(req, res, next) {
  res.fail = (err) => sendError(res, err);
  next();
}

module.exports = { mapError, sendError, attachFail };
