'use strict';
/**
 * PHP-FPM pool manager — creates/removes per-app pool configs.
 * Each Laravel app gets its own unix socket for process isolation.
 */
const path = require('path');
const { execa } = require('execa');
const config = require('../config');

function poolPath(slug) {
  return path.join(config.fpmPoolsDir, `${slug}.conf`);
}

async function createPool(slug) {
  const socket = path.join('/run/php', `php${config.phpVersion}-fpm-${slug}.sock`);
  const repoDir = path.join(config.appsDir, slug, 'repo');
  const poolConf = `; Sada Mia HostPanel — PHP-FPM pool for ${slug}
; Auto-generated — do not edit manually
[${slug}]
user = www-data
group = www-data
listen = ${socket}
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = dynamic
pm.max_children = 5
pm.start_servers = 1
pm.min_spare_servers = 1
pm.max_spare_servers = 3
pm.max_requests = 500
chdir = ${repoDir}
php_admin_value[error_log] = ${path.join(config.logDir, `${slug}-fpm.log`)}
php_admin_flag[log_errors] = on
`;

  if (config.isDev) {
    const dest = poolPath(slug);
    const fs = require('fs-extra');
    await fs.ensureDir(path.dirname(dest));
    await fs.writeFile(dest, poolConf, 'utf8');
    return;
  }

  const proc = await execa('sudo', ['tee', poolPath(slug)], { input: poolConf, reject: false });
  if (proc.exitCode !== 0) throw new Error(`Failed to write FPM pool: ${proc.stderr}`);

  await reloadFpm();
}

async function removePool(slug) {
  if (config.isDev) {
    const fs = require('fs-extra');
    await fs.remove(poolPath(slug));
    return;
  }
  await execa('sudo', ['rm', '-f', poolPath(slug)], { reject: false });
  await reloadFpm();
}

async function reloadFpm() {
  if (config.isDev) return;
  await execa('sudo', ['systemctl', 'reload', `php${config.phpVersion}-fpm`], { reject: false });
}

module.exports = { createPool, removePool, reloadFpm };
