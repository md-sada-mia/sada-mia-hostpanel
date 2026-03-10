'use strict';
const fs = require('fs');
const path = require('path');

const CONF_PATH = process.env.HOSTPANEL_CONF || '/etc/hostpanel/config.json';

let _config = null;

function loadConfig() {
  if (_config) return _config;
  if (!fs.existsSync(CONF_PATH)) {
    // Dev fallback — create a local config for development
    const devConf = path.join(__dirname, '../../.dev-config.json');
    if (fs.existsSync(devConf)) {
      _config = JSON.parse(fs.readFileSync(devConf, 'utf8'));
      return _config;
    }
    throw new Error(`Config file not found: ${CONF_PATH}. Run install.sh first, or create .dev-config.json for development.`);
  }
  _config = JSON.parse(fs.readFileSync(CONF_PATH, 'utf8'));
  return _config;
}

const config = loadConfig();

// Normalise & export flat properties for easy import
module.exports = {
  panelSecret:    config.panelSecret,
  panelPort:      config.panelPort      || 4567,
  appsDir:        config.appsDir        || '/var/www/apps',
  logDir:         config.logDir         || '/var/log/hostpanel',
  nginxVhostsDir: config.nginxVhostsDir || '/etc/nginx/sites-available/hostpanel',
  phpVersion:     config.phpVersion     || '8.4',
  portRange:      config.portRange      || { min: 3000, max: 3999 },
  adminEmail:     config.adminEmail     || 'admin@example.com',
  appsFile:       '/etc/hostpanel/apps.json',
  raw: config,
};
