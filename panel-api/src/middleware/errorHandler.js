'use strict';

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) console.error('[HostPanel ERROR]', err);
  res.status(status).json({ error: message, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) });
}

module.exports = { errorHandler };
