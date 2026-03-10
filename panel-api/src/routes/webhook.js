'use strict';
/**
 * Webhook route — receives Git push hooks to auto-redeploy.
 * POST /webhook/:slug/:token
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const registry = require('../services/appRegistry');
const { deploy } = require('../services/deployer');

const deployingApps = new Set();

router.post('/:slug/:token', async (req, res) => {
  const { slug, token } = req.params;
  const app = await registry.getApp(slug);

  if (!app) return res.status(404).json({ error: 'App not found' });

  // Constant-time token comparison to prevent timing attacks
  const expected = Buffer.from(app.webhookToken || '');
  const provided  = Buffer.from(token);
  const valid = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);

  if (!valid) return res.status(401).json({ error: 'Invalid webhook token' });

  if (deployingApps.has(slug)) {
    return res.status(202).json({ message: 'Deploy already in progress, request queued' });
  }

  // Respond immediately to satisfy GitHub/GitLab 10s timeout
  res.json({ message: 'Webhook received — deploy triggered', slug });

  deployingApps.add(slug);
  deploy(app).catch(err => {
    console.error(`[Webhook Deploy] ${slug} failed: ${err.message}`);
  }).finally(() => {
    deployingApps.delete(slug);
  });
});

module.exports = router;
