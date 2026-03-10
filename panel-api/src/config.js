'use strict';
const fs = require('fs');
const path = require('path');

const CONF_PATH = process.env.HOSTPANEL_CONF || '/etc/hostpanel/config.json';

let _config = null;

function loadConfig() {
  if (_config) return _config;
  
  const devConf = path.join(__dirname, '../../.dev-config.json');

  try {
    if (fs.existsSync(CONF_PATH)) {
      _config = JSON.parse(fs.readFileSync(CONF_PATH, 'utf8'));
      return _config;
    }
  } catch (e) {
    if (e.code !== 'EACCES') {
      throw e;
    }
    // If permission denied, try loading dev config instead
    console.warn(`Permission denied for ${CONF_PATH}. Falling back to dev config.`);
  }

  // Dev fallback — create a local config for development
  if (fs.existsSync(devConf)) {
    _config = JSON.parse(fs.readFileSync(devConf, 'utf8'));
    return _config;
  }
  
  throw new Error(`Config file not found or inaccessible at ${CONF_PATH}, and no .dev-config.json found.`);
}

const config = loadConfig();

function saveConfig(updates) {
  Object.assign(config, updates);
  fs.writeFileSync(CONF_PATH, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

// Normalise & export flat properties for easy import
module.exports = {
  get panelSecret() { return config.panelSecret; },
  get panelPort() { return config.panelPort || 4567; },
  get appsDir() { return config.appsDir || '/var/www/apps'; },
  get logDir() { return config.logDir || '/var/log/hostpanel'; },
  get nginxVhostsDir() { return config.nginxVhostsDir || '/etc/nginx/sites-available/hostpanel'; },
  get phpVersion() { return config.phpVersion || '8.4'; },
  get portRange() { return config.portRange || { min: 3000, max: 3999 }; },
  get adminEmail() { return config.adminEmail || 'admin@example.com'; },
  get githubClientId() { return config.githubClientId || ''; },
  get githubClientSecret() { return config.githubClientSecret || ''; },
  get githubAccessToken() { return config.githubAccessToken || ''; },
  appsFile:       '/etc/hostpanel/apps.json',
  saveConfig,
  raw: config,
};
