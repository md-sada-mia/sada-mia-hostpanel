'use strict';
/**
 * SSL route — triggers Certbot to provision/renew Let's Encrypt certs.
 * POST /api/apps/:slug/ssl
 */
const express = require('express');
const router  = express.Router();
const { execa } = require('execa');
const { auth } = require('../middleware/auth');
const registry = require('../services/appRegistry');
const config = require('../config');

router.post('/:slug/ssl', auth, async (req, res) => {
  const { slug } = req.params;
  const app = await registry.getApp(slug);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const email = req.body.email || config.adminEmail;

  const result = await execa('sudo', [
    'certbot', '--nginx',
    '-d', app.domain,
    '-d', `www.${app.domain}`,
    '--non-interactive',
    '--agree-tos',
    '-m', email,
    '--redirect',
  ], { reject: false, all: true });

  if (result.exitCode !== 0) {
    return res.status(500).json({
      error: 'Certbot failed',
      detail: result.all,
    });
  }

  await registry.updateApp(slug, { sslEnabled: true });
  res.json({ message: `SSL certificate provisioned for ${app.domain}`, output: result.all });
});

module.exports = router;
