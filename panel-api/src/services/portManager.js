'use strict';
/**
 * Port Manager — assigns unique ports to Next.js apps from the configured range.
 */
const config = require('../config');
const { readApps } = require('./appRegistry');

async function getUsedPorts() {
  const apps = await readApps();
  return new Set(apps.filter(a => a.port).map(a => a.port));
}

async function assignPort() {
  const { min, max } = config.portRange;
  const used = await getUsedPorts();
  for (let port = min; port <= max; port++) {
    if (!used.has(port)) return port;
  }
  throw new Error(`No available ports in range ${min}–${max}. All ${max - min + 1} slots are occupied.`);
}

module.exports = { assignPort, getUsedPorts };
