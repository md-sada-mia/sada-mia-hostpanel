'use strict';
/**
 * Environment file manager — generate and persist .env files for apps.
 */
const path = require('path');
const fs   = require('fs-extra');
const config = require('../config');
const { randomBytes } = require('crypto');

function appEnvPath(slug) {
  return path.join(config.appsDir, slug, '.env');
}

async function readEnv(slug) {
  const file = appEnvPath(slug);
  if (!await fs.pathExists(file)) return {};
  const lines = (await fs.readFile(file, 'utf8')).split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

async function writeEnv(slug, envObject) {
  await fs.ensureDir(path.dirname(appEnvPath(slug)));
  const content = Object.entries(envObject)
    .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
    .join('\n') + '\n';
  await fs.outputFile(appEnvPath(slug), content, 'utf8');
}

async function generateLaravelEnv(slug, domain, dbCreds = {}) {
  const appKey = 'base64:' + randomBytes(32).toString('base64');
  const env = {
    APP_NAME: slug,
    APP_ENV: 'production',
    APP_KEY: appKey,
    APP_DEBUG: 'false',
    APP_URL: `https://${domain}`,
    LOG_CHANNEL: 'stack',
    LOG_LEVEL: 'error',
    DB_CONNECTION: 'pgsql',
    DB_HOST: dbCreds.dbHost || '127.0.0.1',
    DB_PORT: String(dbCreds.dbPort || 5432),
    DB_DATABASE: dbCreds.dbName || slug,
    DB_USERNAME: dbCreds.dbUser || 'postgres',
    DB_PASSWORD: dbCreds.dbPassword || '',
    BROADCAST_DRIVER: 'log',
    CACHE_DRIVER: 'file',
    QUEUE_CONNECTION: 'sync',
    SESSION_DRIVER: 'file',
    SESSION_LIFETIME: '120',
  };
  await writeEnv(slug, env);
  return env;
}

async function generateNextjsEnv(slug, domain, dbCreds = {}) {
  const env = {
    NODE_ENV: 'production',
    NEXTAUTH_URL: `https://${domain}`,
    NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
    DATABASE_URL: dbCreds.dbName
      ? `postgresql://${dbCreds.dbUser}:${dbCreds.dbPassword}@${dbCreds.dbHost || '127.0.0.1'}:${dbCreds.dbPort || 5432}/${dbCreds.dbName}`
      : '',
  };
  await writeEnv(slug, env);
  return env;
}

module.exports = { readEnv, writeEnv, generateLaravelEnv, generateNextjsEnv };
