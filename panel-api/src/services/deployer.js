'use strict';
/**
 * Core deployment orchestrator.
 * Handles: git clone/pull → install deps → build → start/restart process
 */
const path  = require('path');
const fs    = require('fs-extra');
const { execa } = require('execa');
const simpleGit = require('simple-git');
const config = require('../config');
const { updateApp } = require('./appRegistry');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function logFile(slug) {
  return path.join(config.logDir, `${slug}.log`);
}

async function log(slug, msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  await fs.appendFile(logFile(slug), line);
}

async function runCmd(slug, cmd, args, cwd, env = {}) {
  await log(slug, `$ ${cmd} ${args.join(' ')}`);
  const proc = execa(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    reject: false,
    all: true,
  });
  for await (const line of proc) {
    await fs.appendFile(logFile(slug), line + '\n');
  }
  const result = await proc;
  if (result.exitCode !== 0) {
    throw new Error(`Command failed (exit ${result.exitCode}): ${cmd} ${args.join(' ')}\n${result.stderr}`);
  }
}

// ─── Git ──────────────────────────────────────────────────────────────────────
function getAuthUrl(repoUrl) {
  const token = config.githubAccessToken;
  if (!token || !repoUrl.includes('github.com')) return repoUrl;
  try {
    const u = new URL(repoUrl);
    u.username = 'oauth2';
    u.password = token;
    return u.toString();
  } catch (e) {
    return repoUrl;
  }
}

async function gitCloneOrPull(slug, repoUrl, branch, repoDir) {
  const authUrl = getAuthUrl(repoUrl);
  
  if (await fs.pathExists(path.join(repoDir, '.git'))) {
    await log(slug, `Pulling latest from branch '${branch}'…`);
    const git = simpleGit(repoDir);
    await git.remote(['set-url', 'origin', authUrl]);
    await git.fetch();
    await git.checkout(branch);
    await git.pull('origin', branch, { '--rebase': false });
    // Restore clean URL so token implies no lingering credentials
    await git.remote(['set-url', 'origin', repoUrl]);
  } else {
    await log(slug, `Cloning repository (branch: ${branch})…`);
    await fs.ensureDir(repoDir);
    const git = simpleGit();
    await git.clone(authUrl, repoDir, ['--branch', branch, '--depth', '1']);
    // Restore clean URL
    const repoGit = simpleGit(repoDir);
    await repoGit.remote(['set-url', 'origin', repoUrl]);
  }
}

// ─── Laravel deploy ───────────────────────────────────────────────────────────
async function deployLaravel(app, repoDir) {
  const { slug } = app;
  await log(slug, '--- Laravel deploy start ---');

  // Ensure storage & bootstrap/cache are writable
  await runCmd(slug, 'chmod', ['-R', '775', 'storage', 'bootstrap/cache'], repoDir);
  await runCmd(slug, 'chown', ['-R', `${process.env.USER || 'www-data'}:www-data`, 'storage', 'bootstrap/cache'], repoDir);

  // Composer install
  await runCmd(slug, 'composer', ['install', '--no-dev', '--optimize-autoloader', '--no-interaction', '--quiet'], repoDir);

  // .env copy if missing
  const envFile = path.join(repoDir, '.env');
  const appEnv  = path.join(config.appsDir, slug, '.env');
  if (await fs.pathExists(appEnv)) {
    await fs.copy(appEnv, envFile, { overwrite: true });
  } else if (!await fs.pathExists(envFile) && await fs.pathExists(path.join(repoDir, '.env.example'))) {
    await fs.copy(path.join(repoDir, '.env.example'), envFile);
  }

  // Artisan commands
  await runCmd(slug, 'php', ['artisan', 'key:generate', '--force'], repoDir);
  await runCmd(slug, 'php', ['artisan', 'migrate', '--force', '--no-interaction'], repoDir);
  await runCmd(slug, 'php', ['artisan', 'config:cache'], repoDir);
  await runCmd(slug, 'php', ['artisan', 'route:cache'], repoDir);
  await runCmd(slug, 'php', ['artisan', 'view:cache'], repoDir);
  await runCmd(slug, 'php', ['artisan', 'storage:link'], repoDir);

  await log(slug, '--- Laravel deploy complete ---');
}

// ─── Next.js deploy ───────────────────────────────────────────────────────────
async function deployNextjs(app, repoDir) {
  const { slug, port } = app;
  await log(slug, '--- Next.js deploy start ---');

  // .env copy
  const appEnv = path.join(config.appsDir, slug, '.env');
  if (await fs.pathExists(appEnv)) {
    await fs.copy(appEnv, path.join(repoDir, '.env.local'), { overwrite: true });
  }

  // Install & build
  await runCmd(slug, 'npm', ['ci', '--prefer-offline', '--quiet'], repoDir);
  
  await log(slug, 'Running optimized build…');
  await runCmd(slug, 'npm', ['run', 'build'], repoDir, { 
    PORT: String(port),
    NEXT_FONT_GOOGLE_OPTOUT: '1'
  });

  // PM2 start or restart
  const { stdout: pm2List } = await execa('pm2', ['list', '--no-ansi', '--no-color'], { reject: false });
  const isRunning = pm2List.includes(slug);

  if (isRunning) {
    await log(slug, 'Restarting existing PM2 process…');
    await runCmd(slug, 'pm2', ['restart', slug], repoDir, { PORT: String(port) });
  } else {
    await log(slug, `Starting PM2 process on port ${port}…`);
    await runCmd(slug, 'pm2', [
      'start', 'npm',
      '--name', slug,
      '--',
      'start'
    ], repoDir, { PORT: String(port) });
  }
  await runCmd(slug, 'pm2', ['save'], repoDir);
  await log(slug, '--- Next.js deploy complete ---');
}

// ─── Main deploy entry ────────────────────────────────────────────────────────
async function deploy(app) {
  const { slug, repoUrl, branch = 'main', type } = app;
  const repoDir  = path.join(config.appsDir, slug, 'repo');

  // Reset log for this deploy
  await fs.ensureDir(config.logDir);
  await fs.outputFile(logFile(slug), `=== Deploy started at ${new Date().toISOString()} ===\n`);

  await updateApp(slug, { status: 'deploying', lastDeploy: new Date().toISOString() });

  try {
    await gitCloneOrPull(slug, repoUrl, branch, repoDir);

    if (type === 'laravel') {
      await deployLaravel(app, repoDir);
    } else if (type === 'nextjs') {
      await deployNextjs(app, repoDir);
    } else {
      throw new Error(`Unknown app type: ${type}`);
    }

    await updateApp(slug, { status: 'running' });
    await log(slug, '✅ Deploy successful');
    return { success: true };
  } catch (err) {
    await updateApp(slug, { status: 'error' });
    await log(slug, `❌ Deploy failed: ${err.message}`);
    throw err;
  }
}

async function getDeployLog(slug, lines = 200) {
  const file = logFile(slug);
  if (!await fs.pathExists(file)) return '(no deploy log yet)';
  const content = await fs.readFile(file, 'utf8');
  const all = content.split('\n');
  return all.slice(-lines).join('\n');
}

module.exports = { deploy, getDeployLog };
