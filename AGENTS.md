# AGENTS.md

SCIEHub is an npm-workspaces monorepo deployed as a **Cloudflare Worker** with **D1** (database), **R2** (uploads), and **Workers Assets** (built SPA). Node 18+ is only needed for local tooling.

## Commands

```bash
npm install
npm run dev                        # wrangler :8787 + Vite :5173
npm run typecheck                  # builds shared, then typechecks all workspaces
npm run build                      # shared -> web (Worker is bundled by wrangler)
npm run deploy                     # build + remote D1 migrations + wrangler deploy
npm run db:migrate:local           # apply D1 migrations to local .wrangler state
npm run db:migrate:remote          # apply migrations to the real D1 database
```

- Focused verification: `npm run typecheck -w @sciehub/server` (or `web` / `shared`).
- `npm run dev` runs `wrangler dev` and Vite; Vite proxies `/api` and `/uploads` to `:8787`.
- `predev` builds `shared` + `web` and applies local migrations. The web build is required because Workers Assets point at `packages/web/dist`.
- There are **no tests, linter, formatter, CI, or pre-commit hooks**. Verify with typecheck, `npm run build`, `wrangler deploy --dry-run`, and manual API checks.
- A clean local D1 can be reset by deleting `.wrangler/state` (gitignored) and rerunning `npm run db:migrate:local`.

## Architecture

- `wrangler.jsonc` — Worker entry, D1/R2/Assets bindings, SPA fallback, cron trigger. `main` is `packages/server/src/worker.ts`.
- `packages/server/src/worker.ts` — Hono app; initializes runtime bindings, parses JWT, registers route modules, serves `/uploads/*` from R2, handles Cron.
- `packages/server/src/routes/*.ts` — one `registerXxxRoutes(app)` per domain, mounted in `worker.ts`. Endpoints live under `/api/...`.
- `packages/server/src/db.ts` — all D1 queries and data mapping. D1 is async: use the `one` / `all` / `run` / `batch` helpers; never reintroduce better-sqlite3 or synchronous DB calls.
- `packages/server/src/runtime.ts` — `Env` type and per-request binding/config initialization (`initRuntime`). Do not read `process.env` in the Worker.
- `packages/server/src/auth.ts` — JWT via `jose` (HS256); tokens carry `token_version` so “sign out all devices” invalidates old sessions. `requireAuth` / `requireAdmin` throw `HttpError`.
- `packages/server/src/password.ts` — PBKDF2-SHA256 via Web Crypto; legacy bcrypt `$2...` hashes are still accepted.
- `packages/server/src/storage.ts` — R2 helpers. DB stores `/uploads/<key>`; R2 stores `<key>`.
- `packages/shared/src/index.ts` — domain types plus constants (`PLATFORM_FEE_RATE`, `MAX_FILE_PRICE`, categories, formatters). Both apps import the **built** `@sciehub/shared` `dist/`.
- `packages/web/src/routes.tsx` — routes; pages in `src/pages`; fetch wrapper in `src/lib/api.ts`; `@/` aliases `src/`. `components/generated/` is hand-maintained despite the name (no codegen).

## Database and money flow

- Schema/migrations live in `packages/server/migrations/*.sql`; apply them with the `db:migrate:*` scripts. There is no ORM and no runtime schema creation.
- D1 has no interactive transactions. Multi-statement writes use `db.batch()`; payment/refund invariants are enforced by triggers in `0001_init.sql` (`order_not_pending`, `insufficient_balance`, `order_already_refunded`). Preserve those guards.
- Repository taxonomy is three-dimensional: `level_id` (IG / AS / A Level / IB / AP), `category_id` (subject), and `resource_type` (notes / practice / past-paper). Source lists are `LEVELS`, `CATEGORIES`, and `RESOURCE_TYPES` in `packages/shared/src/index.ts`; keep the DB columns, API validation, and UI selects in sync.
- Product is **free-first**: `/free` is the main shelf, `/marketplace` shows all, `/paid` is optional. Free resources download directly; paid resources use contact requests, not on-site checkout.
- `is_anonymous` on repos hides the publisher name. Anonymous publishing is allowed for free resources only; paid listings require a username for seller accountability.
- Paid flow: `POST /repos/:id/purchase-request` creates a `purchase_requests` row with the buyer's account email. Sellers see it in `/requests`, then arrange payment/delivery off-platform. Internal checkout/pay endpoints intentionally return `410`.
- The Commons (`/community`) is a global `community_posts` board; users can post by username or anonymously. Admins can delete any post or block `canChat`.
- Moderation is granular on `users`: `is_suspended` (ban all), `can_buy`, `can_publish_free`, `can_publish_paid`, `can_chat`. Enforce these in API routes, not only admin UI.
- Uploaded files are written to R2 under UUID names; `files.file_path` is `/uploads/<key>`. Deleting a repo/file/user removes the corresponding R2 objects.
- File downloads are gated by `owner || purchased || free || preview`; keep access checks in the API, not only the UI. A completed purchase request unlocks reviews but does not automatically unlock files — delivery is arranged with the seller.

## Auth / config / deployment

- JWT bearer token is stored in `localStorage`. The Worker secret is `JWT_SECRET` (`wrangler secret put JWT_SECRET`); local dev falls back to a dev placeholder when unset.
- The app does **not** load `.env`; use `.dev.vars` locally or Cloudflare secrets/vars. `.dev.vars` and `.wrangler/` are gitignored.
- Common env: `JWT_SECRET`, `ADMIN_EMAILS`, `SCIEHUB_MAX_FILE_MB` (default 50), `SCIEHUB_MAX_FILES` (default 8), `SCIEHUB_ALLOW_SELF_TOPUP=1` (sandbox only).
- D1 binding `DB`, R2 binding `UPLOADS`, Assets binding `ASSETS`. `wrangler.jsonc` contains the deployed database ID and bucket name.
- First registered account becomes admin. `ADMIN_EMAILS` auto-promotes those emails on register/login; admins can promote others from `/admin`.
- Workers Assets use `not_found_handling: "single-page-application"`; `run_worker_first` sends `/api/*` and `/uploads/*` to the Worker. No custom Nginx/SPA fallback is needed.
- GitHub push-to-deploy: connect the repo in **Workers & Pages → sciehub → Settings → Builds** (Workers Builds, not Pages). Build command `npm ci && npm run build`, deploy command `npm run deploy:ci`.
- `README.md` is the source of truth for setup/deploy; `ADR.md` records architecture decisions. `HANDOFF.md`, `ROADMAP.md`, and `design.md` are mostly Chinese status/design docs; their references to VPS/Fastify/SQLite are historical.

## Conventions

- 2-space indent, single quotes. Tailwind classes only; theme colors come from CSS variables in `packages/web/src/index.css` and `tailwind.config.js`. Dark theme is default.
- UI direction is **“Academic Atelier”**: Fraunces display headings (`font-display`), Plus Jakarta Sans body, mint actions, amber premium, parchment light mode and forest dark mode. Reuse `section-shell`, `panel`, `panel-muted`, `eyebrow`, `link-arrow`, and `card-hover` instead of inventing new card styles.
- Tailwind colors use RGB-channel variables, so opacity utilities such as `bg-surface/75` work. Add new palette colors as both `--name` and `--name-rgb` in `index.css`.
- Icons use `react-icons/fa`; avoid emoji in UI. Keep hover transitions to color/border/shadow (no layout-shifting scale on cards).
