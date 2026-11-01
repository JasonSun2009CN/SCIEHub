# SCIEHub — Cloudflare Deployment Guide

SCIEHub runs entirely on Cloudflare:

```
Browser
  │
  ▼
Cloudflare Worker (sciehub)
  ├── Workers Assets → packages/web/dist (SPA, index.html fallback)
  ├── /api/*         → Hono routes
  ├── /uploads/*     → R2 bucket
  ├── D1             → users, repos, orders, wallet, reviews…
  └── Cron Trigger   → delete expired deactivated accounts
```

There is no VPS, Nginx, PM2, systemd, or local SQLite file in production.

## 1. Requirements

- Node.js 18+ and npm
- A Cloudflare account with Workers, D1 and R2 enabled
- `wrangler` (installed as a dev dependency)

## 2. First-time setup

```bash
npm install
npx wrangler login
```

Create the resources:

```bash
npx wrangler d1 create sciehub
npx wrangler r2 bucket create sciehub-uploads
```

Copy the returned D1 `database_id` into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "sciehub",
    "database_id": "<your-d1-id>",
    "migrations_dir": "packages/server/migrations"
  }
]
```

Set the JWT secret (never commit it):

```bash
openssl rand -hex 48 | npx wrangler secret put JWT_SECRET
```

Apply the schema:

```bash
npm run db:migrate:remote
```

## 3. Deploy

```bash
npm run deploy
```

This runs:

1. `npm run build` — builds `@sciehub/shared` and the Vite SPA
2. `npm run db:migrate:remote` — applies pending D1 migrations
3. `wrangler deploy` — uploads the Worker and static assets

The Worker URL is printed by Wrangler (for example
`https://sciehub.<account>.workers.dev`). The first account registered on a
fresh D1 database becomes the site admin.

## 4. GitHub push-to-deploy (Workers Builds)

Use **Workers Builds** for a Worker project — not Cloudflare Pages. Pages can
only host static files and cannot run the API.

1. Open **Cloudflare Dashboard → Workers & Pages**.
2. Select the `sciehub` Worker → **Settings → Builds**.
3. Connect the GitHub repository and select the production branch (`main`).
4. Set:
   - **Build command:** `npm ci && npm run build`
   - **Deploy command:** `npm run deploy:ci`
5. Save. Every push to `main` now builds, applies D1 migrations, and deploys.

`deploy:ci` is `npm run db:migrate:remote && wrangler deploy`; it does not
rebuild because the build step already ran.

Keep `JWT_SECRET` as a Worker secret, not a repository variable. Set
`ADMIN_EMAILS` in the dashboard if you want specific emails auto-promoted.

## 5. Custom domain

Workers & Pages → `sciehub` → **Settings → Domains & Routes** → add your
domain. Cloudflare creates the DNS record and certificate automatically.
No SPA rewrite is needed: `wrangler.jsonc` sets
`not_found_handling: "single-page-application"` and routes `/api/*` and
`/uploads/*` to the Worker.

## 6. Environment and bindings

`wrangler.jsonc` defines:

| Binding | Resource |
| --- | --- |
| `DB` | D1 database `sciehub` |
| `UPLOADS` | R2 bucket `sciehub-uploads` |
| `ASSETS` | `packages/web/dist` |

Runtime variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `JWT_SECRET` | dev placeholder locally | Worker secret in production |
| `ADMIN_EMAILS` | empty | Comma-separated auto-admin emails |
| `SCIEHUB_MAX_FILE_MB` | `50` | Per-file limit; Worker request/memory limits still apply |
| `SCIEHUB_MAX_FILES` | `8` | Files per upload request |
| `SCIEHUB_ALLOW_SELF_TOPUP` | unset | `1` enables the sandbox self top-up endpoint |

For local secrets, create `.dev.vars` (gitignored). The app does not load
`.env`.

## 7. Local development

```bash
npm run dev
```

- Worker/API: `http://localhost:8787`
- Vite: `http://localhost:5173` (proxies `/api` and `/uploads` to `:8787`)
- Local D1 state: `.wrangler/state/` (gitignored)

Useful commands:

```bash
npm run db:migrate:local     # apply migrations to local D1
npm run typecheck            # all workspaces
npx wrangler deploy --dry-run
npx wrangler tail            # production logs
```

## 8. Migrations

Add a new SQL file under `packages/server/migrations/` using a sequential
prefix, for example `0002_add_feature.sql`. D1 tracks applied migrations.

```bash
npm run db:migrate:local     # verify locally
npm run db:migrate:remote    # apply to production
```

Never edit `0001_init.sql` after it has been applied; add a new migration
instead. Multi-statement writes use `db.batch()` and the payment/refund
triggers described in `packages/server/migrations/0001_init.sql`.

## 9. Backups

D1:

```bash
npx wrangler d1 export sciehub --remote --output sciehub-$(date +%F).sql
```

R2 uploads:

```bash
# Single object
npx wrangler r2 object get sciehub-uploads/<key> --file ./<key>

# Whole bucket: use any S3-compatible client (rclone, aws-cli) with R2 credentials.
```

Store backups outside Cloudflare and test a restore before relying on them.
Restore D1 with `wrangler d1 execute sciehub --remote --file=<backup.sql>`.

## 10. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `D1_TYPE_ERROR` / undefined binding | Passing `undefined` to `.bind()`; use `null` |
| `no such table` | Migrations not applied (`npm run db:migrate:remote`) |
| `insufficient_balance` on pay | Trigger rejected the payment; expected |
| `order_not_pending` on pay | Order was already paid or cancelled |
| `order_already_refunded` | Refund was already processed |
| 404 on `/api/...` | Worker route missing or request hit Assets instead of the Worker |
| SPA deep link 500 | `assets.not_found_handling` or `run_worker_first` changed |
| Upload 413/CPU/OOM | File exceeds Worker limits; lower `SCIEHUB_MAX_FILE_MB` or use a presigned R2 upload flow |
| Login invalid after redeploy | `JWT_SECRET` changed; all sessions are intentionally invalidated |

## 11. What this setup does not cover

- Multiple Worker regions or horizontal scaling beyond D1/R2 defaults.
- Real payment rails; the wallet remains an internal balance.
- Email delivery; account recovery is still handled through the admin contact
  address in the UI.
