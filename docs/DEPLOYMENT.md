# SCIEHub — Deployment Guide

This guide is the long-form companion to the short "Deploying to a server" section
in [README.md](../README.md). It walks through taking SCIEHub from a fresh
server to a production deployment behind a reverse proxy with HTTPS, automated
restarts, scheduled backups and a clean upgrade path.

If you only want the minimal "git clone → run" version, scroll down to
[Quickstart (single command)](#quickstart-single-command) — everything else here
is optional.

---

## 1. Requirements

| Component        | Minimum          | Tested with        | Notes                                            |
| ---------------- | ---------------- | ------------------ | ------------------------------------------------ |
| Node.js          | 18.x             | 22.x (LTS)         | Required by Vite 5 and Fastify 5.               |
| npm              | bundled with Node| npm 10.x           | Yarn / pnpm work too, but the lockfile is npm. |
| OS               | any              | Ubuntu 22.04 / Debian 12 / macOS | Linux is recommended for production.     |
| RAM              | 512 MB           | 1 GB               | SQLite + better-sqlite3 is memory-light.       |
| Disk             | ~2 GB            | 20 GB              | Mostly upload storage; plan ahead for growth.  |
| Outbound ports   | 4000 (or chosen) |                    | Inbound only — no external service calls.      |

No external services are required. SCIEHub runs as a single Node.js process
with an embedded SQLite database and a local uploads directory. There is no
separate DB, cache, queue or object store to provision.

---

## 2. Architecture in production

```
                                  ┌─────────────────────────────┐
   Browser ────── HTTPS ───────►  │  Nginx (or Caddy) reverse    │
                                  │  proxy :443 → :4000         │
                                  └─────────────┬───────────────┘
                                                │ plain HTTP, loopback
                                                ▼
                                  ┌─────────────────────────────┐
                                  │  Node.js process            │
                                  │  Fastify @ :4000            │
                                  │  ├─ /api/*  → JSON API      │
                                  │  ├─ /uploads/* → static     │
                                  │  └─ /* → SPA (React)        │
                                  └─────────────┬───────────────┘
                                                │
                              ┌─────────────────┴────────────────┐
                              ▼                                  ▼
              packages/server/data/sciehub.db       packages/server/data/uploads/
                       (SQLite file)                   (uploaded repo files)
```

One process serves everything. There is no second node (web and API are not
split in production — `npm run build` produces a static SPA and the server
falls back to `index.html` for client-side routes).

---

## 3. Quickstart (single command)

On a fresh server with Node.js 18+ installed:

```bash
git clone https://github.com/JasonSun2009CN/SCIEHub.git
cd SCIEHub
npm install
JWT_SECRET="$(openssl rand -hex 48)" npm run deploy
```

Open `http://<server-ip>:4000`, register the **first account** — that user
becomes the site admin automatically. No demo data is loaded.

`npm run deploy` is shorthand for `npm run build && npm run start -w @sciehub/server`.
The `prestart` hook on `npm start` already runs the build, so `npm start` alone
also works.

> ⚠️ **Set `JWT_SECRET` in production.** The default value is a clearly-marked
> dev placeholder and will log a warning at boot. Anyone with the JWT secret
> can forge sessions.

---

## 4. Environment variables

| Variable        | Default                              | Purpose                                                                 |
| --------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| `PORT`          | `4000`                               | HTTP listen port.                                                       |
| `HOST`          | `0.0.0.0`                            | Bind address. Set to `127.0.0.1` if fronted by a reverse proxy on the same host. |
| `JWT_SECRET`    | `sciehub-dev-secret-change-me`       | **Required in production.** Used to sign and verify auth tokens.       |
| `ADMIN_EMAILS`  | *(empty)*                            | Comma-separated emails promoted to admin on register/login. Overrides the first-user rule. |
| `DB_PATH`       | `packages/server/data/sciehub.db`    | SQLite file location. Override to back the DB onto a separate volume.   |
| `UPLOAD_DIR`    | `packages/server/data/uploads`       | Where uploaded repository files land.                                   |
| `WEB_DIST`      | `packages/web/dist`                  | Built SPA that Fastify serves as static files in production.            |

For persistent overrides, prefer an `.env`-style systemd `EnvironmentFile` or
a PM2 `ecosystem.config.js` rather than exporting inline every time.

---

## 5. First-run checklist

1. **Pick a port.** Default 4000. If you put Nginx in front, you can keep 4000
   and bind Fastify to `127.0.0.1` only.
2. **Open the firewall / security group** for the chosen port (`4000/tcp`).
   If you terminate TLS at a reverse proxy, you only need 443 open publicly.
3. **Set `JWT_SECRET`** to a long random string.
4. **Register the owner account first.** The first account registered on a
   fresh database becomes the site admin. After that, register any other
   accounts (or use `ADMIN_EMAILS` to auto-promote specific emails).
5. **Verify backups.** Trigger a fake upload to make sure the upload directory
   is writable, then take a backup of the DB + uploads and restore it on
   another machine before you trust the setup.

---

## 6. Reverse proxy (Nginx)

The recommended setup: Nginx on `:443` with TLS, forwarding to Fastify on
`127.0.0.1:4000`.

```nginx
server {
    listen 80;
    server_name sciehub.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sciehub.example.com;

    ssl_certificate     /etc/letsencrypt/live/sciehub.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sciehub.example.com/privkey.pem;

    client_max_body_size 200m;   # match Fastify multipart limits if you raise them

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

**Don't forget `client_max_body_size`.** SCIEHub accepts multi-file uploads
up to a generous size per file; the default Nginx cap of 1 MB will silently
truncate large uploads.

If you prefer Caddy:

```caddy
sciehub.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4000
    tls {
        dns cloudflare <API_TOKEN>   # or use the on-demand issuer
    }
}
```

---

## 7. Running as a service

### 7a. systemd (Linux)

Create `/etc/systemd/system/sciehub.service`:

```ini
[Unit]
Description=SCIEHub (Fastify + SPA)
After=network.target

[Service]
Type=simple
User=sciehub
WorkingDirectory=/opt/sciehub
EnvironmentFile=/opt/sciehub/.env
ExecStart=/usr/bin/node packages/server/dist/index.js
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`/opt/sciehub/.env`:

```
PORT=4000
HOST=127.0.0.1
JWT_SECRET=<long-random>
ADMIN_EMAILS=owner@example.com
```

Then:

```bash
sudo useradd -r -m -d /opt/sciehub sciehub
sudo chown -R sciehub:sciehub /opt/sciehub
sudo systemctl daemon-reload
sudo systemctl enable --now sciehub
sudo journalctl -u sciehub -f      # tail logs
```

> **Build before serving.** systemd as written runs `node packages/server/dist/index.js`.
> Make sure `npm run build` has been run (the `prestart` hook does this; you can
> also add `ExecStartPre=/usr/bin/npm run build` to the unit if you want
> automatic rebuilds on every restart — slower but simpler).

### 7b. PM2

```bash
npm install -g pm2
pm2 start npm --name sciehub -- start
pm2 save
pm2 startup        # follow the printed command to enable on boot
```

Or with an `ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'sciehub',
    script: 'npm',
    args: 'start',
    cwd: '/opt/sciehub',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
      HOST: '127.0.0.1',
      JWT_SECRET: '<long-random>',
    },
    max_memory_restart: '512M',
  }],
};
```

---

## 8. Backups

Two things are worth backing up:

1. **The SQLite database** — `packages/server/data/sciehub.db` (or wherever
   `DB_PATH` points).
2. **The uploads directory** — `packages/server/data/uploads/` (or `UPLOAD_DIR`).

A daily cron with SQLite's online backup API is the safest approach (no
file-copy race conditions):

```bash
sqlite3 packages/server/data/sciehub.db ".backup '/var/backups/sciehub/sciehub-$(date +%F).db'"
tar -czf /var/backups/sciehub/uploads-$(date +%F).tgz packages/server/data/uploads/
```

If you stop the service for the backup (e.g. during a maintenance window),
`cp`/`rsync` are also fine. Test your restore on a separate machine before
you need it.

Off-host delivery: copy the produced files to S3 / B2 / another server with
`rclone`. Don't keep backups on the same disk as the running service.

---

## 9. Upgrades

```bash
cd /opt/sciehub
git pull
npm install
npm run build
sudo systemctl restart sciehub
```

The SQLite schema is forward-compatible across patches. New columns are added
on boot; existing rows are left untouched. A short outage (seconds) is enough
for the build + restart cycle.

For major upgrades that change the schema, take a backup before `git pull` and
verify it after the restart.

---

## 10. Hardening checklist

- [ ] `JWT_SECRET` is set to a real random string and not the default.
- [ ] Fastify is bound to `127.0.0.1` (or a private interface), not `0.0.0.0`
      publicly — Nginx/Caddy should be the only public listener.
- [ ] HTTPS is terminated upstream (Let's Encrypt via certbot or Caddy).
- [ ] The server runs as a non-root user (`sciehub` or similar).
- [ ] Backups run on a schedule and have been restore-tested.
- [ ] Disk space is monitored — uploads grow monotonically.
- [ ] The first registered account is the owner you trust. Lock that down
      before opening registration publicly.
- [ ] `ADMIN_EMAILS` is set if you want other specific addresses promoted
      automatically (overrides the first-user rule).
- [ ] The `data/` directory is on a volume you control (separate disk or
      remote mount for larger deployments).

---

## 11. Troubleshooting

| Symptom                                              | Likely cause                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `EADDRINUSE :::4000` at boot                         | Another process holds the port. `lsof -i :4000` to find it.         |
| Login works locally but fails behind Nginx           | Missing `X-Forwarded-Proto` / `Host` headers — use the snippet above. |
| Upload fails with 413 / connection reset             | Nginx `client_max_body_size` too small — raise it.                   |
| Frontend 404s on refresh of `/repos/123`             | Normal if you're hitting Fastify directly without the SPA fallback; behind Nginx with the `proxy_pass` config above it's handled. |
| "Build the frontend with npm run build…" at `/`     | `packages/web/dist` is missing — run `npm run build`.               |
| `sqlite3` complains about a locked database          | Another process (often an old `node` from a prior crash) is holding the file open. `pkill -f sciehub && systemctl start sciehub`. |
| JWT errors after restart with no code change         | `JWT_SECRET` changed between deploys — sessions are invalidated by design. |

---

## 12. What this guide does NOT cover

- **Container images / Docker.** SCIEHub doesn't ship a Dockerfile today —
  the quickstart + systemd path is the supported route. If you need
  containers, the build/start commands above map cleanly to a two-stage
  Node image.
- **Horizontal scaling.** The current architecture is single-process and
  uses a local SQLite file. For multi-node deployments you would need to
  switch to a shared database (Postgres) and move uploads to object storage.
  See [ROADMAP.md](../ROADMAP.md) for where this sits on the roadmap.
- **Email / outbound notifications.** SCIEHub does not send email from the
  server today — account recovery and report contact go through the address
  baked into the UI (`jasonsun2009@yeah.net`).
