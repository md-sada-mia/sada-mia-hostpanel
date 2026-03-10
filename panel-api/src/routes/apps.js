'use strict';
/**
 * Apps route — CRUD for applications.
 * POST /api/apps        — create a new app
 * GET  /api/apps        — list all apps
 * GET  /api/apps/:slug  — get single app
 * DELETE /api/apps/:slug — remove app
 */
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuid } = require('uuid');
const router = express.Router();

const { auth } = require('../middleware/auth');
const registry = require('../services/appRegistry');
const portManager = require('../services/portManager');
const nginxManager = require('../services/nginxManager');
const fpmManager = require('../services/fpmManager');
const dbProvisioner = require('../services/dbProvisioner');
const envManager = require('../services/envManager');
const { execa } = require('execa');

// ─── List all apps ────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const apps = await registry.readApps();
  res.json({ apps });
});

// ─── Get single app ───────────────────────────────────────────────────────────
router.get('/:slug', auth, [param('slug').isSlug()], async (req, res) => {
  const app = await registry.getApp(req.params.slug);
  if (!app) return res.status(404).json({ error: 'App not found' });
  res.json({ app });
});

// ─── Create new app ───────────────────────────────────────────────────────────
router.post('/', auth, [
  body('name').trim().notEmpty().withMessage('App name is required'),
  body('repoUrl').isURL({ require_tld: false, require_protocol: true }).withMessage('Valid repo URL required'),
  body('domain').trim().notEmpty().withMessage('Domain is required'),
  body('type').isIn(['laravel', 'nextjs']).withMessage('Type must be laravel or nextjs'),
  body('branch').optional().trim().default('main'),
  body('createDb').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { name, repoUrl, domain, type, branch = 'main', createDb = true } = req.body;

  // Generate URL-safe slug from name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // Assign port for Next.js apps
  let port = null;
  if (type === 'nextjs') {
    port = await portManager.assignPort();
  }

  // Provision DB
  let dbCreds = {};
  if (createDb) {
    dbCreds = await dbProvisioner.createDatabase(slug);
  }

  // Generate .env
  if (type === 'laravel') {
    await envManager.generateLaravelEnv(slug, domain, dbCreds);
  } else {
    await envManager.generateNextjsEnv(slug, domain, dbCreds);
  }

  // Generate webhook token
  const webhookToken = uuid().replace(/-/g, '');

  // Persist app record
  const app = await registry.addApp({
    slug, name, repoUrl, domain, type,
    branch, port,
    webhookToken,
    dbName: dbCreds.dbName || null,
    dbUser: dbCreds.dbUser || null,
    phpVersion: '8.4',
  });

  // Setup PHP-FPM pool for Laravel
  if (type === 'laravel') {
    await fpmManager.createPool(slug);
  }

  // Generate Nginx config
  await nginxManager.writeNginxConf({ ...app });
  await nginxManager.validateAndReload();

  res.status(201).json({
    app,
    webhookUrl: `/webhook/${slug}/${webhookToken}`,
    message: 'App created. Trigger a deploy to go live.',
  });
});

// ─── Delete app ───────────────────────────────────────────────────────────────
router.delete('/:slug', auth, async (req, res) => {
  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  // Stop PM2 process (Next.js)
  if (app.type === 'nextjs') {
    await execa('pm2', ['delete', slug], { reject: false });
    await execa('pm2', ['save'], { reject: false });
  }

  // Remove PHP-FPM pool (Laravel)
  if (app.type === 'laravel') {
    await fpmManager.removePool(slug).catch(() => {});
  }

  // Remove Nginx config
  await nginxManager.removeNginxConf(slug);
  await nginxManager.validateAndReload().catch(() => {});

  // Drop DB
  if (app.dbName) {
    await dbProvisioner.dropDatabase(slug).catch(() => {});
  }

  // Remove from registry
  await registry.removeApp(slug);

  res.json({ message: `App '${slug}' deleted successfully.` });
});

module.exports = router;
