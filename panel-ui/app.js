'use strict';

let API_TOKEN = localStorage.getItem('hp_token') || '';
let statusInterval = null;

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

// ─── Authentication ───────────────────────────────────────────────────────────
function saveToken() {
  const val = document.getElementById('inp-token').value.trim();
  if (!val) { toast('Enter a valid token', 'error'); return; }
  API_TOKEN = val;
  localStorage.setItem('hp_token', val);
  toast('Checking...', 'info', 1000);
  checkAuthAndLoad();
}

async function checkAuthAndLoad() {
  if (!API_TOKEN) {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('launcher-section').style.display = 'none';
    return;
  }
  
  try {
    // Test auth
    await api('GET', '/api/apps');
    // Auth passed, show launcher
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('launcher-section').style.display = 'block';
    pollStatus();
    if (!statusInterval) {
      statusInterval = setInterval(pollStatus, 3000);
    }
  } catch (e) {
    if (e.message.includes('401') || e.message.includes('Unauthorized')) {
      toast('Invalid API token', 'error');
      localStorage.removeItem('hp_token');
      API_TOKEN = '';
      document.getElementById('auth-section').style.display = 'block';
      document.getElementById('launcher-section').style.display = 'none';
      if (statusInterval) clearInterval(statusInterval);
    } else {
      toast(`Offline: ${e.message}`, 'error');
    }
  }
}

// ─── Process Control ──────────────────────────────────────────────────────────
async function pollStatus() {
  const icon = document.getElementById('pm2-status-icon');
  const text = document.getElementById('pm2-status-text');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const linkContainer = document.getElementById('panel-link-container');
  const panelLink = document.getElementById('panel-link');
  
  try {
    const data = await api('GET', '/api/settings/ui/status');
    const status = data.status; // 'online', 'stopped', 'errored', 'missing'
    
    if (status === 'online') {
      icon.textContent = '🟢';
      text.textContent = 'Next.js Panel is RUNNING';
      btnStart.style.display = 'none';
      btnStop.style.display = 'flex';
      linkContainer.style.display = 'block';
      document.getElementById('log-container').style.display = 'block';
      
      if (!logInterval) {
        logInterval = setInterval(fetchLogs, 2000);
        fetchLogs();
      }
      
      const host = window.location.hostname;
      const port = data.port || 3000;
      panelLink.href = `http://${host}:${port}`;
    } else {
      icon.textContent = '🔴';
      text.textContent = 'Next.js Panel is OFFLINE';
      btnStart.style.display = 'flex';
      btnStop.style.display = 'none';
      linkContainer.style.display = 'none';
    }
  } catch (e) {
    icon.textContent = '🔴';
    text.textContent = 'Backend Unreachable';
    btnStart.style.display = 'none';
    btnStop.style.display = 'none';
    linkContainer.style.display = 'none';
  }
}

let logInterval = null;

async function fetchLogs() {
  const logEl = document.getElementById('pm2-logs');
  const logContainer = document.getElementById('log-container');
  try {
    const data = await api('GET', '/api/settings/ui/logs');
    if (data.logs) {
      logContainer.style.display = 'block';
      logEl.textContent = data.logs;
      logEl.scrollTop = logEl.scrollHeight;
    }
  } catch (e) {
    // silently fail logging if process is missing
  }
}

function clearLogs() {
  document.getElementById('pm2-logs').textContent = '';
}

async function copyLogs() {
  const text = document.getElementById('pm2-logs').textContent;
  if (!text) return;
  
  // Try modern API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Logs copied to clipboard!', 'success');
      return;
    } catch (err) {
      console.warn('Modern clipboard API failed, trying fallback...');
    }
  }

  // Fallback method
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Ensure textarea is not visible but part of DOM
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      toast('Logs copied (fallback mode)!', 'success');
    } else {
      throw new Error('Fallback failed');
    }
  } catch (err) {
    toast('Failed to copy logs', 'error');
    console.error('Final copy failure:', err);
  }
}

async function startPanel() {
  document.getElementById('pm2-status-icon').textContent = '⏳';
  document.getElementById('pm2-status-text').textContent = 'Starting Panel...';
  // Show log area immediately
  document.getElementById('log-container').style.display = 'block';
  document.getElementById('pm2-logs').textContent = 'Initialising Next.js...\n';
  
  if (!logInterval) logInterval = setInterval(fetchLogs, 2000);

  try {
    await api('POST', '/api/settings/ui/start');
    toast('Booting Next.js...', 'success');
  } catch (e) {
    toast(`Failed to start: ${e.message}`, 'error');
  }
}

async function stopPanel() {
  document.getElementById('pm2-status-icon').textContent = '⏳';
  document.getElementById('pm2-status-text').textContent = 'Shutting down...';
  try {
    await api('POST', '/api/settings/ui/stop');
    toast('Next.js process killed.', 'success');
    if (logInterval) {
      clearInterval(logInterval);
      logInterval = null;
    }
  } catch (e) {
    toast(`Failed to stop: ${e.message}`, 'error');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  const saved = localStorage.getItem('hp_token');
  if (saved) {
    document.getElementById('inp-token').value = saved;
    checkAuthAndLoad();
  } else {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('launcher-section').style.display = 'none';
  }
})();
