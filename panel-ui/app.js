'use strict';
// ─── State ────────────────────────────────────────────────────────────────────
let API_TOKEN = localStorage.getItem('hp_token') || '';
let allApps = [];
let currentEnvSlug = '';
let currentLogSlug = '';
let confirmCallback = null;

// ─── API helper ───────────────────────────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 4000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span style="font-size:15px">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
  const container = document.getElementById('toast-container');
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function setView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewId}`)?.classList.add('active');
  document.getElementById(`nav-${viewId === 'settings' ? 'settings' : 'dashboard'}`)?.classList.add('active');
  document.getElementById('page-title').textContent = {
    dashboard: 'Dashboard',
    apps: 'Applications',
    settings: 'Settings',
  }[viewId] || 'HostPanel';
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    setView(view);
    if (view === 'dashboard' || view === 'apps') loadApps();
  });
});

// ─── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeOnOverlay(e, id) { if (e.target === e.currentTarget) closeModal(id); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
function saveToken() {
  const val = document.getElementById('inp-token').value.trim();
  if (!val) { toast('Enter a valid token', 'error'); return; }
  API_TOKEN = val;
  localStorage.setItem('hp_token', val);
  toast('API token saved', 'success');
  loadApps();
}

function checkTokenSet() {
  if (!API_TOKEN) {
    toast('Set your API token in Settings first', 'error', 6000);
    setView('settings');
    return false;
  }
  return true;
}

// ─── Load & render apps ───────────────────────────────────────────────────────
async function loadApps() {
  if (!checkTokenSet()) return;
  try {
    const data = await api('GET', '/api/apps');
    allApps = data.apps || [];
    renderApps(allApps);
    updateStats(allApps);
  } catch (e) {
    toast(`Failed to load apps: ${e.message}`, 'error');
  }
}

function updateStats(apps) {
  document.getElementById('stat-total').textContent    = apps.length;
  document.getElementById('stat-running').textContent  = apps.filter(a => a.status === 'running').length;
  document.getElementById('stat-error').textContent    = apps.filter(a => a.status === 'error').length;
  document.getElementById('stat-laravel').textContent  = apps.filter(a => a.type === 'laravel').length;
  document.getElementById('stat-nextjs').textContent   = apps.filter(a => a.type === 'nextjs').length;
}

function filterApps() {
  const q = document.getElementById('search-apps').value.toLowerCase();
  const filtered = allApps.filter(a =>
    a.name?.toLowerCase().includes(q) ||
    a.slug?.toLowerCase().includes(q) ||
    a.domain?.toLowerCase().includes(q)
  );
  renderApps(filtered);
}

function statusBadge(status) {
  const labels = { running: 'Running', error: 'Error', deploying: 'Deploying…', pending: 'Pending' };
  return `<span class="status-badge status-${status || 'pending'}">${labels[status] || status}</span>`;
}

function typeBadge(type) {
  return type === 'laravel'
    ? `<span class="card-type-badge type-laravel">🐘 Laravel</span>`
    : `<span class="card-type-badge type-nextjs">⬡ Next.js</span>`;
}

function formatDate(iso) {
  if (!iso) return 'Never';
  try { return new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); } 
  catch { return iso; }
}

function renderApps(apps) {
  const grid = document.getElementById('app-grid');
  const empty = document.getElementById('empty-state');

  // Remove existing cards (not the empty state)
  grid.querySelectorAll('.app-card').forEach(c => c.remove());

  if (!apps.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  apps.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.id = `card-${app.slug}`;
    card.innerHTML = `
      <div class="card-top">
        <div class="card-info">
          <div class="card-name">${escHtml(app.name || app.slug)}</div>
          <div class="card-domain">🌐 <a href="http://${escHtml(app.domain)}" target="_blank">${escHtml(app.domain)}</a></div>
        </div>
        ${typeBadge(app.type)}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between">
        ${statusBadge(app.status)}
        <span style="font-size:11px;color:var(--text-muted)">Last deploy: ${formatDate(app.lastDeploy)}</span>
      </div>

      <div class="card-meta">
        ${app.port ? `<span>🔌 Port ${app.port}</span>` : ''}
        ${app.dbName ? `<span>🗄 ${escHtml(app.dbName)}</span>` : ''}
        ${app.sslEnabled ? `<span style="color:var(--green)">🔒 SSL</span>` : '<span>🔓 No SSL</span>'}
      </div>

      <div class="card-actions">
        <button class="btn btn-primary btn-sm" onclick="triggerDeploy('${app.slug}')">▶ Deploy</button>
        <button class="btn btn-ghost btn-sm" onclick="openLogs('${app.slug}')">📋 Logs</button>
        <button class="btn btn-ghost btn-sm" onclick="openEnv('${app.slug}')">⚙ Env</button>
        ${!app.sslEnabled ? `<button class="btn btn-ghost btn-sm" onclick="provisionSSL('${app.slug}')">🔒 SSL</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteApp('${app.slug}', '${escHtml(app.name || app.slug)}')">✕</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ─── Create App ────────────────────────────────────────────────────────────────
async function submitNewApp() {
  if (!checkTokenSet()) return;

  const name     = document.getElementById('d-name').value.trim();
  const repoUrl  = document.getElementById('d-repo').value.trim();
  const domain   = document.getElementById('d-domain').value.trim();
  const type     = document.getElementById('d-type').value;
  const branch   = document.getElementById('d-branch').value.trim() || 'main';
  const createDb = document.getElementById('d-createdb').checked;

  if (!name || !repoUrl || !domain) { toast('Please fill in all required fields', 'error'); return; }

  const btn = document.getElementById('btn-deploy-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating…';

  try {
    const res = await api('POST', '/api/apps', { name, repoUrl, domain, type, branch, createDb });
    toast(`App <strong>${name}</strong> created! Deploy triggered.`, 'success', 6000);
    // Auto-trigger deploy
    await api('POST', `/api/apps/${res.app.slug}/deploy`);
    closeModal('modal-deploy');
    resetDeployForm();
    setTimeout(loadApps, 1500);
  } catch (e) {
    toast(`Create failed: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Create &amp; Deploy';
  }
}

function resetDeployForm() {
  ['d-name','d-repo','d-domain'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('d-type').value = 'laravel';
  document.getElementById('d-branch').value = 'main';
  document.getElementById('d-createdb').checked = true;
}

// ─── Redeploy ─────────────────────────────────────────────────────────────────
async function triggerDeploy(slug) {
  if (!checkTokenSet()) return;
  try {
    await api('POST', `/api/apps/${slug}/deploy`);
    toast(`Deploy triggered for <strong>${slug}</strong>`, 'success');
    // Update status locally
    const card = document.getElementById(`card-${slug}`);
    if (card) {
      const badge = card.querySelector('.status-badge');
      if (badge) badge.outerHTML = statusBadge('deploying');
    }
    // Poll for completion
    pollStatus(slug);
  } catch (e) {
    toast(`Deploy failed: ${e.message}`, 'error');
  }
}

async function pollStatus(slug, attempts = 0) {
  if (attempts > 60) return; // Max 5 min
  await delay(5000);
  try {
    const data = await api('GET', `/api/apps/${slug}`);
    if (data.app.status === 'deploying') {
      pollStatus(slug, attempts + 1);
    } else {
      loadApps();
      toast(`<strong>${slug}</strong> deploy ${data.app.status === 'running' ? 'succeeded ✓' : 'finished with status: ' + data.app.status}`, data.app.status === 'running' ? 'success' : 'error');
    }
  } catch { /* ignore poll error */ }
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
async function openLogs(slug) {
  currentLogSlug = slug;
  document.getElementById('log-slug').textContent = slug;
  document.getElementById('log-content').textContent = 'Loading…';
  openModal('modal-logs');
  await fetchLogs();
}

async function fetchLogs() {
  try {
    const data = await api('GET', `/api/apps/${currentLogSlug}/logs?lines=300`);
    const logEl = document.getElementById('log-content');
    logEl.textContent = data.log || '(empty)';
    logEl.scrollTop = logEl.scrollHeight;
  } catch (e) {
    document.getElementById('log-content').textContent = `Error loading logs: ${e.message}`;
  }
}

function refreshLogs() { fetchLogs(); }

// ─── Env Editor ───────────────────────────────────────────────────────────────
async function openEnv(slug) {
  currentEnvSlug = slug;
  document.getElementById('env-slug').textContent = slug;
  document.getElementById('env-rows').innerHTML = '<p style="color:var(--text-muted);font-size:13px">Loading…</p>';
  openModal('modal-env');

  try {
    const data = await api('GET', `/api/apps/${slug}/env`);
    renderEnvRows(data.env || {});
  } catch (e) {
    toast(`Failed to load env: ${e.message}`, 'error');
  }
}

function renderEnvRows(envObj) {
  const container = document.getElementById('env-rows');
  container.innerHTML = '';
  Object.entries(envObj).forEach(([k, v]) => addEnvRow(k, v));
}

function addEnvRow(key = '', value = '') {
  const container = document.getElementById('env-rows');
  const row = document.createElement('div');
  row.className = 'env-row';
  row.innerHTML = `
    <input type="text" class="form-input env-key" value="${escHtml(key)}" placeholder="KEY" />
    <input type="text" class="form-input env-val" value="${escHtml(value)}" placeholder="value" />
    <button class="btn-rm" onclick="this.parentElement.remove()" title="Remove">✕</button>
  `;
  container.appendChild(row);
}

async function saveEnv() {
  const rows = document.querySelectorAll('#env-rows .env-row');
  const env = {};
  rows.forEach(row => {
    const k = row.querySelector('.env-key').value.trim();
    const v = row.querySelector('.env-val').value;
    if (k) env[k] = v;
  });

  try {
    await api('PUT', `/api/apps/${currentEnvSlug}/env`, { env });
    toast(`Env saved for <strong>${currentEnvSlug}</strong>`, 'success');
    closeModal('modal-env');
  } catch (e) {
    toast(`Save failed: ${e.message}`, 'error');
  }
}

// ─── SSL ──────────────────────────────────────────────────────────────────────
async function provisionSSL(slug) {
  if (!confirm(`Provision Let's Encrypt SSL for ${slug}? (Requires domain to point at this server)`)) return;
  try {
    toast(`Provisioning SSL for <strong>${slug}</strong>…`, 'info', 8000);
    await api('POST', `/api/apps/${slug}/ssl`);
    toast(`SSL provisioned for <strong>${slug}</strong> ✓`, 'success');
    loadApps();
  } catch (e) {
    toast(`SSL failed: ${e.message}`, 'error');
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function confirmDeleteApp(slug, name) {
  document.getElementById('confirm-title').textContent = 'Delete Application';
  document.getElementById('confirm-message').innerHTML = `
    <p>This will permanently delete <strong>${escHtml(name)}</strong>, its Nginx config, PHP-FPM pool, PM2 process, and database.</p>
    <p style="margin-top:8px;color:var(--red)">This action cannot be undone.</p>
  `;
  const btn = document.getElementById('confirm-ok-btn');
  btn.onclick = () => deleteApp(slug);
  openModal('modal-confirm');
}

async function deleteApp(slug) {
  closeModal('modal-confirm');
  try {
    await api('DELETE', `/api/apps/${slug}`);
    toast(`App <strong>${slug}</strong> deleted`, 'success');
    loadApps();
  } catch (e) {
    toast(`Delete failed: ${e.message}`, 'error');
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  // Pre-fill token input if saved
  const saved = localStorage.getItem('hp_token');
  if (saved) document.getElementById('inp-token').value = saved;

  if (!API_TOKEN) {
    setView('settings');
    toast('Welcome! Please enter your API secret in Settings to continue.', 'info', 8000);
  } else {
    setView('dashboard');
    loadApps();
    // Auto-refresh every 30s
    setInterval(loadApps, 30_000);
  }
})();
