'use strict';
/**
 * Nginx vhost template — Laravel (FastCGI via PHP-FPM)
 */
module.exports = function laravelNginxConf({ slug, domain, phpVersion = '8.4' }) {
  const phpSocket = `/run/php/php${phpVersion}-fpm-${slug}.sock`;
  const root = `/var/www/apps/${slug}/repo/public`;

  return `# Sada Mia HostPanel — ${slug} (Laravel)
# Auto-generated — do not edit manually

server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};

    root ${root};
    index index.php index.html;

    charset utf-8;
    client_max_body_size 100M;

    access_log /var/log/nginx/${slug}-access.log;
    error_log  /var/log/nginx/${slug}-error.log;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \\.php$ {
        fastcgi_pass unix:${phpSocket};
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }
}
`;
};
