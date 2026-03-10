'use strict';
/**
 * Nginx config manager — generates, writes, validates, and reloads vhosts.
 */
const path = require('path');
const fs   = require('fs-extra');
const { execa } = require('execa');
const config = require('../config');
const laravelTemplate = require('../templates/nginx-laravel.conf');
const nextjsTemplate  = require('../templates/nginx-nextjs.conf');

function confPath(slug) {
  return path.join(config.nginxVhostsDir, `${slug}.conf`);
}

async function writeNginxConf(app) {
  let conf;
  if (app.type === 'laravel') {
    conf = laravelTemplate(app);
  } else if (app.type === 'nextjs') {
    conf = nextjsTemplate(app);
  } else {
    throw new Error(`Unknown app type: ${app.type}`);
  }

  const dest = confPath(app.slug);
  // Use sudo tee because Nginx dir may be owned by root
  const proc = execa('sudo', ['tee', dest], { input: conf, reject: false });
  const result = await proc;
  if (result.exitCode !== 0) throw new Error(`Failed to write Nginx config: ${result.stderr}`);
}

async function removeNginxConf(slug) {
  const dest = confPath(slug);
  try {
    await execa('sudo', ['rm', '-f', dest]);
  } catch { /* ignore if not exists */ }
}

async function validateAndReload() {
  const test = await execa('sudo', ['nginx', '-t'], { reject: false, all: true });
  if (test.exitCode !== 0) {
    throw new Error(`Nginx config test failed:\n${test.all}`);
  }
  const reload = await execa('sudo', ['systemctl', 'reload', 'nginx'], { reject: false });
  if (reload.exitCode !== 0) throw new Error(`Nginx reload failed: ${reload.stderr}`);
}

module.exports = { writeNginxConf, removeNginxConf, validateAndReload };
