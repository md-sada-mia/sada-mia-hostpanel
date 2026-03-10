#!/usr/bin/env bash
# =============================================================================
# Setup PHP-FPM pool for a Laravel app
# Usage: sudo bash scripts/setup-php-fpm.sh <slug>
# =============================================================================
set -euo pipefail

SLUG="${1:?Usage: $0 <app-slug>}"
PHP_VER="${2:-8.4}"
APPS_DIR="${3:-/var/www/apps}"
POOL_FILE="/etc/php/${PHP_VER}/fpm/pool.d/${SLUG}.conf"
SOCKET="/run/php/php${PHP_VER}-fpm-${SLUG}.sock"
REPO_DIR="${APPS_DIR}/${SLUG}/repo"

cat > "$POOL_FILE" <<POOLEOF
; Sada Mia HostPanel — PHP-FPM pool
; App: ${SLUG}

[${SLUG}]
user = www-data
group = www-data
listen = ${SOCKET}
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = dynamic
pm.max_children = 5
pm.start_servers = 1
pm.min_spare_servers = 1
pm.max_spare_servers = 3
pm.max_requests = 500
chdir = ${REPO_DIR}
php_admin_value[error_log] = /var/log/hostpanel/${SLUG}-fpm.log
php_admin_flag[log_errors] = on
POOLEOF

echo "Pool config written to ${POOL_FILE}"
systemctl reload "php${PHP_VER}-fpm"
echo "PHP-FPM reloaded"
