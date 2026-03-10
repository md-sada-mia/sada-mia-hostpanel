'use strict';
/**
 * Deploy route — manual deploy & log streaming.
 * POST /api/apps/:slug/deploy  — triggers deploy
 * GET  /api/apps/:slug/logs   — returns last N lines of deploy log
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const registry = require('../services/appRegistry');
const { deploy, getDeployLog } = require('../services/deployer');

// In-memory lock — prevent concurrent deploys of the same app
const deployingApps = new Set();

router.post('/:slug/deploy', auth, async (req, res) => {
  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  if (deployingApps.has(slug)) {
    return res.status(409).json({ error: 'A deploy is already in progress for this app.' });
  }

  deployingApps.add(slug);
  // Respond immediately, deploy runs in background
  res.json({ message: 'Deploy triggered', slug });

  deploy(app).catch(err => {
    console.error(`[Deploy] ${slug} failed: ${err.message}`);
  }).finally(() => {
    deployingApps.delete(slug);
  });
});

router.get('/:slug/logs', auth, async (req, res) => {
  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const lines = Math.min(parseInt(req.query.lines || '200', 10), 1000);
  const log = await getDeployLog(slug, lines);
  res.json({ slug, log });
});

module.exports = router;
