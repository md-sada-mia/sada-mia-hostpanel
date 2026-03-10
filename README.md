# Sada Mia HostPanel

> **Lightweight, container-free web hosting panel for Laravel + Next.js on Ubuntu Linux.**
> No Docker. No Kubernetes. Just Nginx, PHP-FPM, PM2, and PostgreSQL — running lean on your bare-metal or VPS.

---

## Features

| Feature                     | Detail                                              |
| --------------------------- | --------------------------------------------------- |
| **One-click deploy**        | Laravel (PHP-FPM) and Next.js (PM2) apps            |
| **Automatic Nginx config**  | Per-app vhost generation with zero manual editing   |
| **Port management**         | Auto-assigned ports (3000–3999) for Next.js apps    |
| **Git-based deploys**       | Webhook endpoint for GitHub/GitLab push auto-deploy |
| **PostgreSQL provisioning** | Isolated DB + user per app                          |
| **Environment editor**      | Web-based `.env` editor per app                     |
| **SSL**                     | One-click Let's Encrypt via Certbot                 |
| **Low RAM**                 | Handles 50–100 apps with minimal PHP-FPM pool sizes |
| **Web panel UI**            | Premium dark-mode SPA with no frontend framework    |

---

## Requirements

- **OS**: Ubuntu 20.04 / 22.04 / 24.04
- **Access**: Root (or sudo) on initial install
- **RAM**: 1 GB minimum recommended (2 GB+ for 10+ apps)
- **Disk**: 10 GB+ recommended

---

## Quick Start

```bash
# 1. Clone this repository onto your server
git clone https://github.com/your-org/sada-mia-hostpanel.git /opt/hostpanel-src
cd /opt/hostpanel-src

# 2. Run the installer (as root)
sudo bash install.sh
```

The installer will:

1. Install Nginx, PHP 8.4 + FPM, Node.js 20, PM2, PostgreSQL 16, Composer, Certbot
2. Create system directories and the `hostpanel` system user
3. Configure Nginx to include per-app vhost configs
4. Generate `/etc/hostpanel/config.json` with a random API secret
5. Start the panel as a systemd service on **port 4567**

At the end, the installer prints:

```
Panel URL:   http://YOUR_SERVER_IP:4567
API Secret:  <generated-secret>
```

---

## Using the Panel

### 1. Set your API Token

Open `http://YOUR_SERVER_IP:4567` → click **Settings** → paste your `API Secret` → **Save**.

### 2. Deploy an App

Click **+ New App**, fill in:

- **App Name** — becomes the slug (e.g. `my-blog`)
- **App Type** — Laravel or Next.js
- **Repository URL** — public or private Git URL
- **Domain** — the domain pointing to this server
- **Branch** — default `main`
- **Create DB** — auto-provisions PostgreSQL DB + user + `.env` DB creds

Click **Create & Deploy**. The panel will:

1. Clone the repo
2. Install dependencies
3. Build (Next.js) / migrate (Laravel)
4. Configure Nginx + PHP-FPM (Laravel) or PM2 (Next.js)
5. Reload Nginx

### 3. Auto-Deploy on Git Push (Webhook)

After creating an app, the API returns a webhook URL:

```
/webhook/{slug}/{token}
```

Add it to **GitHub → Settings → Webhooks** with Content-Type `application/json`.
Every push to your configured branch will automatically redeploy.

### 4. SSL

Click the **🔒 SSL** button on any app card. Requires:

- The domain's DNS A record pointing to this server
- Port 80 accessible from the internet (for ACME challenge)

### 5. Environment Variables

Click **⚙ Env** on any app card to open the editor. Save changes, then redeploy for them to take effect.

---

## API Reference

All API routes require `Authorization: Bearer <panelSecret>` header.

| Method   | Endpoint                 | Description                   |
| -------- | ------------------------ | ----------------------------- |
| `GET`    | `/api/apps`              | List all apps                 |
| `POST`   | `/api/apps`              | Create new app                |
| `GET`    | `/api/apps/:slug`        | Get app details               |
| `DELETE` | `/api/apps/:slug`        | Delete app (+ Nginx, FPM, DB) |
| `POST`   | `/api/apps/:slug/deploy` | Trigger deploy                |
| `GET`    | `/api/apps/:slug/logs`   | Get deploy log                |
| `GET`    | `/api/apps/:slug/env`    | Read `.env`                   |
| `PUT`    | `/api/apps/:slug/env`    | Update `.env`                 |
| `POST`   | `/api/apps/:slug/db`     | Provision PostgreSQL DB       |
| `DELETE` | `/api/apps/:slug/db`     | Drop PostgreSQL DB            |
| `POST`   | `/api/apps/:slug/ssl`    | Provision SSL certificate     |
| `POST`   | `/webhook/:slug/:token`  | Git push webhook receiver     |
| `GET`    | `/api/health`            | Health check                  |

---

## Directory Structure

```
/opt/hostpanel/           ← Panel source (installed by install.sh)
  install.sh
  panel-api/              ← Express.js API
    src/
      index.js
      config.js
      middleware/
      routes/             ← apps, deploy, webhook, database, ssl, env
      services/           ← deployer, nginxManager, fpmManager, dbProvisioner, envManager
      templates/          ← nginx-laravel.conf.js, nginx-nextjs.conf.js
  panel-ui/               ← Vanilla HTML/CSS/JS frontend
  scripts/                ← Helper shell scripts

/var/www/apps/            ← All deployed app code
  {slug}/repo/            ← Git clone target
  {slug}/.env             ← App environment file

/etc/hostpanel/
  config.json             ← Panel config (panelSecret, portRange, etc.)
  apps.json               ← App registry

/etc/nginx/sites-available/hostpanel/
  {slug}.conf             ← Auto-generated Nginx vhosts

/var/log/hostpanel/
  {slug}.log              ← Deploy logs
```

---

## Configuration

`/etc/hostpanel/config.json`:

```json
{
  "panelSecret": "your-secret",
  "panelPort": 4567,
  "appsDir": "/var/www/apps",
  "logDir": "/var/log/hostpanel",
  "nginxVhostsDir": "/etc/nginx/sites-available/hostpanel",
  "phpVersion": "8.4",
  "portRange": { "min": 3000, "max": 3999 },
  "adminEmail": "admin@example.com"
}
```

---

## Service Management

```bash
# Check panel status
systemctl status hostpanel

# Restart panel
systemctl restart hostpanel

# View panel logs
journalctl -u hostpanel -f

# Check all Next.js processes
pm2 list

# Check Nginx
nginx -t && systemctl reload nginx
```

---

## Development (local)

```bash
cd panel-api
cp ../.dev-config.json.example ../.dev-config.json  # edit as needed
npm install
npm run dev   # starts with nodemon on port 4567
```

> The API will fall back to `.dev-config.json` if `/etc/hostpanel/config.json` doesn't exist.

---

## License

MIT — © Sada Mia HostPanel Contributors
