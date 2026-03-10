#!/usr/bin/env bash
# =============================================================================
# Sada Mia HostPanel — Installation Script (Idempotent)
# Supports: Ubuntu 20.04 / 22.04 / 24.04
# Usage: sudo bash install.sh
# Re-running is safe — already-installed tools are skipped.
# =============================================================================
set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[SKIP]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════${NC}"; echo -e "  ${BOLD}$*${NC}"; echo -e "${BOLD}${BLUE}══════════════════════════════════════${NC}\n"; }

# ─── Helpers ──────────────────────────────────────────────────────────────────
is_installed() { command -v "$1" &>/dev/null; }
pkg_installed() { dpkg -l "$1" 2>/dev/null | grep -q '^ii'; }
service_active() { systemctl is-active --quiet "$1" 2>/dev/null; }

# ─── Root check ───────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Run this script as root: sudo bash install.sh"

# ─── Config ───────────────────────────────────────────────────────────────────
PANEL_DIR="/opt/hostpanel"
APPS_DIR="/var/www/apps"
CONF_DIR="/etc/hostpanel"
LOG_DIR="/var/log/hostpanel"
NGINX_VHOSTS="/etc/nginx/sites-available/hostpanel"
PANEL_PORT=4567
PANEL_USER="hostpanel"
NODE_MAJOR=20
PHP_VER="8.4"   # Default PHP version

export COMPOSER_ALLOW_SUPERUSER=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

header "Sada Mia HostPanel Installer"
info "Panel source:        $SCRIPT_DIR"
info "Panel install dir:   $PANEL_DIR"
info "PHP version:         $PHP_VER"
info "Node.js version:     $NODE_MAJOR"
echo ""

# ─── 1. System update ─────────────────────────────────────────────────────────
header "Step 1 — Updating system packages"
apt-get update -qq
apt-get install -y curl wget gnupg2 lsb-release software-properties-common apt-transport-https ca-certificates unzip git
success "Base packages ready"

# ─── 2. Node.js ───────────────────────────────────────────────────────────────
header "Step 2 — Node.js ${NODE_MAJOR}"
INSTALLED_NODE_MAJOR=0
if is_installed node; then
  INSTALLED_NODE_MAJOR=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
fi

if [[ "$INSTALLED_NODE_MAJOR" -ge "$NODE_MAJOR" ]]; then
  warn "Node.js $(node -v) already installed — skipping"
else
  info "Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  success "Node.js $(node -v) installed"
fi

# ─── 3. PM2 ───────────────────────────────────────────────────────────────────
header "Step 3 — PM2"
if is_installed pm2; then
  warn "PM2 $(pm2 -v) already installed — skipping"
else
  info "Installing PM2..."
  npm install -g pm2 --quiet
  success "PM2 $(pm2 -v) installed"
fi
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ─── 4. PHP & PHP-FPM ─────────────────────────────────────────────────────────
header "Step 4 — PHP ${PHP_VER} + extensions"

# Add Ondřej PPA if needed (for PHP 8.4 on Ubuntu <24.10)
if ! apt-cache policy php${PHP_VER} 2>/dev/null | grep -q "Candidate:"; then
  info "Adding Ondřej Surý PHP PPA..."
  add-apt-repository -y ppa:ondrej/php 2>/dev/null || true
  apt-get update -qq
fi

PHP_PKGS=(
  php${PHP_VER}
  php${PHP_VER}-fpm
  php${PHP_VER}-cli
  php${PHP_VER}-mbstring
  php${PHP_VER}-xml
  php${PHP_VER}-pgsql
  php${PHP_VER}-curl
  php${PHP_VER}-zip
  php${PHP_VER}-bcmath
  php${PHP_VER}-intl
  php${PHP_VER}-gd
  php${PHP_VER}-tokenizer
  php${PHP_VER}-fileinfo
)

# Only install packages that are not already installed
MISSING_PHP=()
for pkg in "${PHP_PKGS[@]}"; do
  pkg_installed "$pkg" || MISSING_PHP+=("$pkg")
done

if [[ ${#MISSING_PHP[@]} -eq 0 ]]; then
  warn "PHP ${PHP_VER} + all extensions already installed — skipping"
else
  info "Installing missing PHP packages: ${MISSING_PHP[*]}"
  apt-get install -y "${MISSING_PHP[@]}"
fi

# Redis extension (optional — skip if unavailable instead of erroring)
pkg_installed "php${PHP_VER}-redis" || apt-get install -y php${PHP_VER}-redis 2>/dev/null || true

if ! service_active "php${PHP_VER}-fpm"; then
  systemctl enable "php${PHP_VER}-fpm"
  systemctl start "php${PHP_VER}-fpm"
fi
success "PHP $(php${PHP_VER} -r 'echo PHP_VERSION;') + FPM ready"

# ─── 5. Composer ──────────────────────────────────────────────────────────────
header "Step 5 — Composer"
if is_installed composer; then
  warn "Composer $(composer --version --no-ansi 2>/dev/null | awk '{print $3}') already installed — skipping"
else
  info "Installing Composer..."
  info "Fetching installer signature..."
  EXPECTED_CHECKSUM="$(curl -fsSL --connect-timeout 10 https://composer.github.io/installer.sig)"
  
  info "Downloading installer..."
  curl -fsSL --connect-timeout 10 -o composer-setup.php https://getcomposer.org/installer
  
  info "Verifying installer..."
  ACTUAL_CHECKSUM="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"
  
  if [[ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]]; then
    rm -f composer-setup.php
    error "Composer installer checksum mismatch"
  fi
  
  info "Running installer..."
  php composer-setup.php --quiet --install-dir=/usr/local/bin --filename=composer
  rm -f composer-setup.php
  success "Composer $(composer --version --no-ansi | awk '{print $3}') installed"
fi

# ─── 6. Nginx ─────────────────────────────────────────────────────────────────
header "Step 6 — Nginx"

# Stop Apache2 if it's running on port 80 (common conflict)
if is_installed apache2 && service_active apache2; then
  warn "Apache2 is running — stopping and disabling it to free port 80..."
  systemctl stop apache2
  systemctl disable apache2
fi

# Kill anything else holding port 80
if ss -tlnp | grep -q ":80 "; then
  PORT80_PID=$(ss -tlnp | grep ":80 " | awk -F'pid=' '{print $2}' | cut -d, -f1 | head -1)
  [[ -n "$PORT80_PID" ]] && { warn "Killing PID $PORT80_PID on port 80"; kill -9 "$PORT80_PID" || true; sleep 1; }
fi

if is_installed nginx && service_active nginx; then
  warn "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}') is already running — skipping install"
else
  if ! pkg_installed nginx; then
    info "Installing Nginx..."
    apt-get install -y nginx
  fi
  systemctl enable nginx
  systemctl start nginx
  success "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}') ready"
fi

# ─── 7. PostgreSQL ────────────────────────────────────────────────────────────
header "Step 7 — PostgreSQL"
if is_installed psql && service_active postgresql; then
  PG_VER=$(psql --version | awk '{print $3}' | cut -d. -f1)
  warn "PostgreSQL ${PG_VER} already running — skipping"
else
  if ! pkg_installed postgresql; then
    info "Installing PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
  fi
  systemctl enable postgresql
  systemctl start postgresql
  PG_VER=$(psql --version | awk '{print $3}' | cut -d. -f1)
  success "PostgreSQL ${PG_VER} ready"
fi

# ─── 8. Certbot ───────────────────────────────────────────────────────────────
header "Step 8 — Certbot"
if is_installed certbot; then
  warn "Certbot $(certbot --version 2>&1 | awk '{print $2}') already installed — skipping"
else
  info "Installing Certbot..."
  apt-get install -y certbot python3-certbot-nginx
  success "Certbot $(certbot --version 2>&1 | awk '{print $2}') installed"
fi

# ─── 9. System user ───────────────────────────────────────────────────────────
header "Step 9 — System user '${PANEL_USER}'"
if id "$PANEL_USER" &>/dev/null; then
  warn "User '${PANEL_USER}' already exists — skipping"
else
  useradd --system --shell /bin/bash --home /opt/hostpanel --create-home "$PANEL_USER"
  success "User '${PANEL_USER}' created"
fi

# ─── 10. Directory structure ──────────────────────────────────────────────────
header "Step 10 — Directory structure"
mkdir -p "$APPS_DIR" "$CONF_DIR" "$LOG_DIR" "$NGINX_VHOSTS"
chown -R "$PANEL_USER":www-data "$APPS_DIR"
chmod -R 775 "$APPS_DIR"
chown -R "$PANEL_USER":"$PANEL_USER" "$LOG_DIR"
success "Directories ready"

# ─── 11. Nginx global include ─────────────────────────────────────────────────
header "Step 11 — Nginx vhost include"
INCLUDE_LINE="include ${NGINX_VHOSTS}/*.conf;"
NGINX_CONF="/etc/nginx/nginx.conf"
if grep -qF "$INCLUDE_LINE" "$NGINX_CONF"; then
  warn "Nginx include already configured — skipping"
else
  sed -i "/http {/a\\    ${INCLUDE_LINE}" "$NGINX_CONF"
  info "Added include to nginx.conf"
fi

# Placeholder so the include dir is never empty (empty glob causes nginx error)
cat > "$NGINX_VHOSTS/_placeholder.conf" <<'NGINXEOF'
# Sada Mia HostPanel — app vhosts are auto-generated below
NGINXEOF
nginx -t && systemctl reload nginx
success "Nginx include configured and reloaded"

# ─── 12. Sudoers ──────────────────────────────────────────────────────────────
header "Step 12 — Sudoers"
SUDOERS_FILE="/etc/sudoers.d/hostpanel"
if [[ -f "$SUDOERS_FILE" ]]; then
  warn "Sudoers entry already exists — skipping"
else
  cat > "$SUDOERS_FILE" <<SUDOEOF
# Allow hostpanel to manage nginx, php-fpm, certbot, psql
${PANEL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx, /bin/systemctl restart nginx
${PANEL_USER} ALL=(ALL) NOPASSWD: /bin/systemctl reload php${PHP_VER}-fpm, /bin/systemctl restart php${PHP_VER}-fpm
${PANEL_USER} ALL=(ALL) NOPASSWD: /usr/bin/certbot
${PANEL_USER} ALL=(postgres) NOPASSWD: /usr/bin/psql
${PANEL_USER} ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/nginx/sites-available/hostpanel/*
${PANEL_USER} ALL=(ALL) NOPASSWD: /bin/rm /etc/nginx/sites-available/hostpanel/*
${PANEL_USER} ALL=(ALL) NOPASSWD: /bin/tee /etc/php/${PHP_VER}/fpm/pool.d/*
${PANEL_USER} ALL=(ALL) NOPASSWD: /bin/rm /etc/php/${PHP_VER}/fpm/pool.d/*
SUDOEOF
  chmod 440 "$SUDOERS_FILE"
  success "Sudoers configured"
fi

# ─── 13. Panel source ─────────────────────────────────────────────────────────
header "Step 13 — Installing panel to ${PANEL_DIR}"
if [[ "$SCRIPT_DIR" != "$PANEL_DIR" ]]; then
  rm -rf "$PANEL_DIR"
  cp -r "$SCRIPT_DIR" "$PANEL_DIR"
fi
chown -R "$PANEL_USER":"$PANEL_USER" "$PANEL_DIR"

# Install/update Node dependencies for panel API
info "Installing Node.js dependencies for panel API..."
cd "$PANEL_DIR/panel-api"
npm install --omit=dev --quiet
cd "$SCRIPT_DIR"
success "Panel source installed"

# ─── 14. Config ───────────────────────────────────────────────────────────────
header "Step 14 — Panel configuration"
[[ -f "$CONF_DIR/apps.json" ]] || echo "[]" > "$CONF_DIR/apps.json"
if [[ -f "$CONF_DIR/config.json" ]]; then
  warn "Config already exists at ${CONF_DIR}/config.json — skipping generation"
  PANEL_SECRET=$(python3 -c "import json; print(json.load(open('${CONF_DIR}/config.json'))['panelSecret'])" 2>/dev/null || echo "see ${CONF_DIR}/config.json")
else
  PANEL_SECRET=$(openssl rand -hex 32)
  cat > "$CONF_DIR/config.json" <<JSONEOF
{
  "panelSecret": "${PANEL_SECRET}",
  "panelPort": ${PANEL_PORT},
  "appsDir": "${APPS_DIR}",
  "logDir": "${LOG_DIR}",
  "nginxVhostsDir": "${NGINX_VHOSTS}",
  "phpVersion": "${PHP_VER}",
  "portRange": { "min": 3000, "max": 3999 },
  "adminEmail": "admin@example.com",
  "nodeVersion": "${NODE_MAJOR}"
}
JSONEOF
  chown "$PANEL_USER":"$PANEL_USER" "$CONF_DIR/apps.json" "$CONF_DIR/config.json"
  chmod 600 "$CONF_DIR/config.json"
  success "Config generated"
fi

# ─── 15. Systemd service ──────────────────────────────────────────────────────
header "Step 15 — Systemd service"
cat > /etc/systemd/system/hostpanel.service <<SERVICEEOF
[Unit]
Description=Sada Mia HostPanel API
After=network.target postgresql.service nginx.service

[Service]
Type=simple
User=${PANEL_USER}
WorkingDirectory=${PANEL_DIR}/panel-api
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hostpanel
Environment=NODE_ENV=production
Environment=HOSTPANEL_CONF=${CONF_DIR}/config.json

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable hostpanel

if service_active hostpanel; then
  info "Restarting hostpanel service..."
  systemctl restart hostpanel
else
  info "Starting hostpanel service..."
  systemctl start hostpanel
fi
success "hostpanel service running"

# ─── Done ─────────────────────────────────────────────────────────────────────
header "✅ Installation Complete!"
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo -e "${BOLD}Panel URL:${NC}    http://${PUBLIC_IP}:${PANEL_PORT}"
echo -e "${BOLD}API Secret:${NC}   ${PANEL_SECRET}"
echo -e "${YELLOW}⚠  Save the API Secret — it is stored in ${CONF_DIR}/config.json${NC}"
echo ""
echo -e "Check service status: ${CYAN}systemctl status hostpanel${NC}"
echo -e "View live logs:       ${CYAN}journalctl -u hostpanel -f${NC}"
