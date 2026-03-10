'use strict';
const config = require('../config');

/**
 * Bearer token authentication middleware.
 * Reads Authorization header: "Bearer <PANEL_SECRET>"
 */
function auth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token || token !== config.panelSecret) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API token.' });
  }
  next();
}

module.exports = { auth };
