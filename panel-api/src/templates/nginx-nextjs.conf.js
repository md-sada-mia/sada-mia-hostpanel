'use strict';
/**
 * Nginx vhost template — Next.js (reverse proxy to PM2 port)
 */
module.exports = function nextjsNginxConf({ slug, domain, port }) {
  return `# Sada Mia HostPanel — ${slug} (Next.js)
# Auto-generated — do not edit manually

upstream ${slug}_upstream {
    server 127.0.0.1:${port};
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};

    access_log /var/log/nginx/${slug}-access.log;
    error_log  /var/log/nginx/${slug}-error.log;

    client_max_body_size 100M;

    # Next.js static assets
    location /_next/static/ {
        alias /var/www/apps/${slug}/repo/.next/static/;
        expires 1y;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # Proxy all other requests to Next.js
    location / {
        proxy_pass http://${slug}_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
`;
};
