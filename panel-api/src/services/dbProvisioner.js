const config = require('../config');

async function psql(sql) {
  if (config.isDev) {
    console.log(`[Dev] Skipping psql: ${sql}`);
    return '';
  }
  const result = await execa('sudo', ['-u', 'postgres', 'psql', '-c', sql], { reject: false, all: true });
  if (result.exitCode !== 0) {
    // Ignore "already exists" errors silently
    if (!result.all.includes('already exists')) {
      throw new Error(`psql failed: ${result.all}`);
    }
  }
  return result.all;
}

async function createDatabase(slug) {
  // Generate short safe identifiers
  const dbName   = `hp_${slug.replace(/-/g, '_')}`;
  const dbUser   = `hp_${slug.replace(/-/g, '_')}_user`;
  const password = randomPassword();

  await psql(`CREATE USER "${dbUser}" WITH PASSWORD '${password}';`);
  await psql(`CREATE DATABASE "${dbName}" OWNER "${dbUser}";`);
  await psql(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}";`);

  return { dbName, dbUser, dbPassword: password, dbHost: '127.0.0.1', dbPort: 5432 };
}

async function dropDatabase(slug) {
  const dbName = `hp_${slug.replace(/-/g, '_')}`;
  const dbUser = `hp_${slug.replace(/-/g, '_')}_user`;

  // Terminate active connections first
  await psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbName}';`).catch(() => {});
  await psql(`DROP DATABASE IF EXISTS "${dbName}";`);
  await psql(`DROP USER IF EXISTS "${dbUser}";`);
}

function randomPassword(len = 24) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%^&*';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = { createDatabase, dropDatabase };
