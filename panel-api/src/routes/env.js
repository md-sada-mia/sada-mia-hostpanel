'use strict';
/**
 * Environment variables route.
 * GET  /api/apps/:slug/env   — read .env key→value pairs
 * PUT  /api/apps/:slug/env   — write (merge) .env key→value pairs
 */
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const registry = require('../services/appRegistry');
const envManager = require('../services/envManager');

router.get('/:slug/env', auth, async (req, res) => {
  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const env = await envManager.readEnv(slug);
  res.json({ slug, env });
});

router.put('/:slug/env', auth, [
  body('env').isObject().withMessage('env must be a key-value object'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const existing = await envManager.readEnv(slug);
  const merged   = { ...existing, ...req.body.env };
  await envManager.writeEnv(slug, merged);

  res.json({ message: 'Environment updated', slug, env: merged });
});

module.exports = router;
