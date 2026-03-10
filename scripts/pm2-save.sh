#!/usr/bin/env bash
# =============================================================================
# Persist and auto-start all PM2 processes on server reboot.
# Usage: sudo bash scripts/pm2-save.sh
# =============================================================================
set -euo pipefail

echo "Saving PM2 process list..."
pm2 save

echo "Setting up PM2 startup on boot (systemd)..."
PM2_STARTUP=$(pm2 startup systemd -u root --hp /root 2>&1 | grep -E "^sudo" || true)
if [[ -n "$PM2_STARTUP" ]]; then
  eval "$PM2_STARTUP"
fi

echo "Done — PM2 will now start all listed processes on boot."
pm2 list
