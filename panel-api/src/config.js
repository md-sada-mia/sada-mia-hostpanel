'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_CONF_PATH = '/etc/hostpanel/config.json';
const DEV_CONF_PATH = path.join(__dirname, '../../.dev-config.json');

let _config = null;
let currentConfPath = process.env.HOSTPANEL_CONF || DEFAULT_CONF_PATH;

function loadConfig() {
  if (_config) return _config;

  try {
    if (fs.existsSync(currentConfPath)) {
      _config = JSON.parse(fs.readFileSync(currentConfPath, 'utf8'));
      return _config;
    }
  } catch (e) {
    if (e.code !== 'EACCES' && e.code !== 'ENOENT') throw e;
    console.warn(`System config ${currentConfPath} inaccessible. Falling back to dev config.`);
  }

  // Fallback to dev config
  if (fs.existsSync(DEV_CONF_PATH)) {
    currentConfPath = DEV_CONF_PATH;
    _config = JSON.parse(fs.readFileSync(DEV_CONF_PATH, 'utf8'));
    return _config;
  }
  
  throw new Error(`Config file not found or inaccessible at ${DEFAULT_CONF_PATH}, and no .dev-config.json found.`);
}

const config = loadConfig();
const isDev = currentConfPath === DEV_CONF_PATH;

function saveConfig(updates) {
  Object.assign(config, updates);
  try {
    fs.writeFileSync(currentConfPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error(`Failed to save config to ${currentConfPath}:`, e.message);
    throw e;
  }
  return config;
}

// Normalise & export flat properties for easy import
module.exports = {
  get panelSecret() { return config.panelSecret; },
  get panelPort() { return config.panelPort || 4567; },
  get appsDir() { return config.appsDir || (isDev ? path.join(__dirname, '../../dev-apps') : '/var/www/apps'); },
  get logDir() { return config.logDir || (isDev ? path.join(__dirname, '../../dev-logs') : '/var/log/hostpanel'); },
  get nginxVhostsDir() { return config.nginxVhostsDir || '/etc/nginx/sites-available/hostpanel'; },
  get phpVersion() { return config.phpVersion || '8.4'; },
  get portRange() { return config.portRange || { min: 3000, max: 3999 }; },
  get adminEmail() { return config.adminEmail || 'admin@example.com'; },
  get githubClientId() { return config.githubClientId || ''; },
  get githubClientSecret() { return config.githubClientSecret || ''; },
  get githubAccessToken() { return config.githubAccessToken || ''; },
  get appsFile() { return isDev ? path.join(__dirname, '../../dev-apps.json') : '/etc/hostpanel/apps.json'; },
  get configPath() { return currentConfPath; },
  saveConfig,
  raw: config,
  isDev
};
