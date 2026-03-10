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
    res.json({ 
      status, 
      port: config.isDev ? 3001 : 3000 
    });
  });
});

// POST /api/settings/ui/start
router.post('/ui/start', (req, res) => {
  pm2.connect((err) => {
    if (err) return res.status(500).json({ error: 'PM2 Connection Failed' });

    const startOptions = {
      name: UI_PM2_NAME,
      script: 'npm',
      args: config.isDev ? 'run dev' : 'run start',
      cwd: UI_DIR,
      env: {
        PORT: config.isDev ? 3001 : 3000,
        NODE_ENV: config.isDev ? 'development' : 'production'
      }
    };

    // Always delete first to ensure configuration (args, env) is updated
    pm2.delete(UI_PM2_NAME, (errDelete) => {
      // Ignore errDelete if process didn't exist
      pm2.start(startOptions, (errStart) => {
        pm2.disconnect();
        if (errStart) {
          console.error('PM2 Start Error:', errStart);
          return res.status(500).json({ error: 'Failed to start Next.js Panel' });
        }
        res.json({ success: true, status: 'started' });
      });
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

// GET /api/settings/ui/logs
router.get('/ui/logs', (req, res) => {
  pm2.connect((err) => {
    if (err) return res.status(500).json({ error: 'PM2 Connection Failed' });
    pm2.describe(UI_PM2_NAME, (err, list) => {
      pm2.disconnect();
      if (err || !list || list.length === 0) {
        return res.status(404).json({ error: 'Process not found' });
      }
      
      const logPath = list[0].pm2_env.pm_out_log_path;
      const errorPath = list[0].pm2_env.pm_err_log_path;
      const fs = require('fs');
      
      try {
        const outLogs = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').slice(-100).join('\n') : '';
        const errLogs = fs.existsSync(errorPath) ? fs.readFileSync(errorPath, 'utf8').split('\n').slice(-100).join('\n') : '';
        res.json({ logs: outLogs + '\n' + errLogs });
      } catch (e) {
        res.status(500).json({ error: 'Failed to read logs' });
      }
    });
  });
});

module.exports = router;
