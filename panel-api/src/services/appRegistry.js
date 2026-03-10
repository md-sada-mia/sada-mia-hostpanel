'use strict';
/**
 * App Registry — reads/writes /etc/hostpanel/apps.json
 * Uses a simple async-safe read/write pattern. For production at scale,
 * replace with a lightweight SQLite DB.
 */
const fs = require('fs-extra');
const config = require('../config');

const APPS_FILE = config.appsFile;

async function readApps() {
  await fs.ensureFile(APPS_FILE);
  const raw = await fs.readFile(APPS_FILE, 'utf8');
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

async function writeApps(apps) {
  await fs.outputFile(APPS_FILE, JSON.stringify(apps, null, 2), 'utf8');
}

async function getApp(slug) {
  const apps = await readApps();
  return apps.find(a => a.slug === slug) || null;
}

async function addApp(appData) {
  const apps = await readApps();
  if (apps.find(a => a.slug === appData.slug)) {
    throw Object.assign(new Error(`App '${appData.slug}' already exists`), { status: 409 });
  }
  const record = {
    ...appData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending',
    lastDeploy: null,
  };
  apps.push(record);
  await writeApps(apps);
  return record;
}

async function updateApp(slug, updates) {
  const apps = await readApps();
  const idx = apps.findIndex(a => a.slug === slug);
  if (idx === -1) throw Object.assign(new Error(`App '${slug}' not found`), { status: 404 });
  apps[idx] = { ...apps[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeApps(apps);
  return apps[idx];
}

async function removeApp(slug) {
  const apps = await readApps();
  const filtered = apps.filter(a => a.slug !== slug);
  if (filtered.length === apps.length) throw Object.assign(new Error(`App '${slug}' not found`), { status: 404 });
  await writeApps(filtered);
}

module.exports = { readApps, getApp, addApp, updateApp, removeApp };
