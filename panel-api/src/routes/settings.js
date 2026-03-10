'use strict';
/**
 * Settings route — read/update panel config at runtime
 */
const express = require('express');
const router = express.Router();
const config = require('../config');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET /api/settings - returns public settings
router.get('/', (req, res) => {
  res.json({
    githubClientId: config.githubClientId,
    hasGithubSecret: !!config.githubClientSecret,
    hasGithubToken: !!config.githubAccessToken,
    adminEmail: config.adminEmail
  });
});

// PUT /api/settings - updates panel settings
router.put('/', (req, res) => {
  const { githubClientId, githubClientSecret, adminEmail } = req.body;
  const updates = {};
  
  if (githubClientId !== undefined) updates.githubClientId = githubClientId;
  if (githubClientSecret !== undefined && githubClientSecret.trim() !== '') {
    updates.githubClientSecret = githubClientSecret;
  }
  if (adminEmail !== undefined) updates.adminEmail = adminEmail;
  
  config.saveConfig(updates);
  res.json({ success: true });
});

// --- PM2 Next.js UI Control ---
const pm2 = require('pm2');
const path = require('path');

const UI_PM2_NAME = 'hostpanel-ui';
const UI_DIR = path.resolve(__dirname, '../../../panel-frontend');

function getPm2Status(callback) {
  pm2.connect((err) => {
    if (err) return callback(err);
    pm2.describe(UI_PM2_NAME, (err, processDescriptionList) => {
      pm2.disconnect();
      if (err) return callback(err);
      if (!processDescriptionList || processDescriptionList.length === 0) {
        return callback(null, 'missing');
      }
      return callback(null, processDescriptionList[0].pm2_env.status);
    });
  });
}

// GET /api/settings/ui/status
router.get('/ui/status', (req, res) => {
  getPm2Status((err, status) => {
    if (err) return res.status(500).json({ error: 'Failed to communicate with PM2' });
    res.json({ status });
  });
});

// POST /api/settings/ui/start
router.post('/ui/start', (req, res) => {
  pm2.connect((err) => {
    if (err) return res.status(500).json({ error: 'PM2 Connection Failed' });
    
    pm2.start({
      name: UI_PM2_NAME,
      script: 'npm',
      args: 'run start',
      cwd: UI_DIR,
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      }
    }, (err, apps) => {
      pm2.disconnect();
      if (err) {
        // If start fails, maybe it just needs to be restarted if it exists
        pm2.connect(err2 => {
          pm2.restart(UI_PM2_NAME, (err3) => {
            pm2.disconnect();
            if (err3) return res.status(500).json({ error: 'Failed to start Next.js Panel' });
            return res.json({ success: true, status: 'started' });
          });
        });
        return;
      }
      res.json({ success: true, status: 'started' });
    });
  });
});

// POST /api/settings/ui/stop
router.post('/ui/stop', (req, res) => {
  pm2.connect((err) => {
    if (err) return res.status(500).json({ error: 'PM2 Connection Failed' });
    pm2.stop(UI_PM2_NAME, (err) => {
      pm2.disconnect();
      if (err) return res.status(500).json({ error: 'Failed to stop Next.js Panel' });
      res.json({ success: true, status: 'stopped' });
    });
  });
});

module.exports = router;
