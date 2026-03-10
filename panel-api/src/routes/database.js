'use strict';
/**
 * Database route — provision/drop PostgreSQL databases per app.
 * POST   /api/apps/:slug/db  — create DB + user
 * DELETE /api/apps/:slug/db  — drop DB + user
 */
const express = require('express');
const router  = express.Router();
const { auth } = require('../middleware/auth');
const registry = require('../services/appRegistry');
const dbProvisioner = require('../services/dbProvisioner');
const envManager = require('../services/envManager');

router.post('/:slug/db', auth, async (req, res) => {
  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });
  if (app.dbName) return res.status(409).json({ error: 'Database already provisioned for this app' });

  const creds = await dbProvisioner.createDatabase(slug);

  // Merge into existing .env
  const existing = await envManager.readEnv(slug);
  await envManager.writeEnv(slug, {
    ...existing,
    DB_HOST: creds.dbHost,
    DB_PORT: String(creds.dbPort),
    DB_DATABASE: creds.dbName,
    DB_USERNAME: creds.dbUser,
    DB_PASSWORD: creds.dbPassword,
    DATABASE_URL: `postgresql://${creds.dbUser}:${creds.dbPassword}@${creds.dbHost}:${creds.dbPort}/${creds.dbName}`,
  });

  await registry.updateApp(slug, { dbName: creds.dbName, dbUser: creds.dbUser });

  res.status(201).json({ message: 'Database created', dbName: creds.dbName, dbUser: creds.dbUser });
});

router.delete('/:slug/db', auth, async (req, res) => {
  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  await dbProvisioner.dropDatabase(slug);
  await registry.updateApp(slug, { dbName: null, dbUser: null });

  res.json({ message: 'Database dropped' });
});

module.exports = router;
