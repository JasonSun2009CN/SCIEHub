# SCIEHub

A free-first **study-resource library and community** for international high school students (IGCSE · AS/A-Level · IB · AP).

**Share, ask, excel.** A **free** study-resource library and community for international high school students. Download notes, practice and past papers, join **The Commons** to talk study, or publish your own work — under your username or anonymously. There is no marketplace, no checkout and no paid tier.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite 5 · TailwindCSS · shadcn/ui (Radix) · react-icons/fa · TanStack Query · React Router (history mode) |
| Backend | Cloudflare Workers · Hono · TypeScript |
| Data | Cloudflare D1 (SQLite) |
| Files | Cloudflare R2 |
| Auth | JWT (`jose`) + PBKDF2 (email/password) |
| Repo | npm workspaces monorepo: `packages/web` + `packages/server` + `packages/shared` |

## Features

### Free resource library
- **Everything is free** — `/library` is the only shelf. Notes, practice and past papers download without checkout, payment or an account.
- **Curriculum taxonomy** — resources are classified by level (**IGCSE / IG, AS, A Level, IB, AP**), subject (Math, English Literature, English Language, Physics, Biology, Computer Science, Chinese, History, Chemistry, Economics, Business, Psychology…), and resource type (**Notes, Practice Questions, Past Papers**).
- **Anonymous or named publishing** — every resource can be published under your username or anonymously. Anonymous listings hide the publisher identity.
- **In-browser preview** — PDFs and images can be previewed in a dialog before downloading.
- **Reviews** — any signed-in student can rate a repository 1–5 stars and leave a comment.
- **Leaderboard** — `/leaderboard` ranks the **top contributors** by files shared and total size.

### Community & sharing
- **The Commons** — `/community` is a shared public board where every signed-in user can post questions, tips and resource requests, anonymously or by username. Posts refresh automatically.
- **Plaza (campus wall)** — `/plaza` is an X-style photo/text wall: up to 4 images per post, likes, comments, anonymous posting, and admin/owner deletion. Images only — video uploads are intentionally disabled.
- **Repositories** — users create repos (name, description, level, subject, resource type, tags) and upload multiple files into them. Owners can edit metadata/tags, delete a wrong file, and re-upload a replacement.
- **Library & search** — browse by level, subject, resource type, rating and full-text search.
- **Study groups** — join groups by **requesting membership**; the group creator approves or rejects each request. Groups collect repositories shared into them.
- **Sharing** — a repo owner can share a repository into any group they belong to (and remove it again).
- **Community guidelines** — `/conduct` sets the rules; **Report** buttons on every repository and comment store reports for review.
- **School email only** — registration requires a school address in the format `s12345.chen@stu.scie.com.cn` (`s` + student ID + `.` + family name + fixed domain). External emails are rejected to keep the community inside the school.
- **Account safety** — every sign-in is logged (IP + browser); users can review their login history, **sign out all devices**, **deactivate** their account (deleted after 30 days unless they sign back in) or **permanently delete** it with their password.
- **Comments & favorites** per repository, per-file download counters, drag-and-drop multi-file uploads with progress.
- **Dark/light themes** (dark default) driven by CSS-variable tokens.

### Admin
- **Admin console** — `/admin` shows site stats, reports, repositories and users.
- **Moderation** — ban all features, delete users, and remove repositories, files, comments or community posts.
- **Granular permissions** — independently allow or block **publishing free content** and **posting in the community**.

## Getting started (development)

Requirements: **Node.js 18+** and a Cloudflare account for `wrangler`.

```bash
npm install
npx wrangler login       # one-time browser authorization
npm run dev              # Worker on :8787 + Vite dev server on :5173
```

Open http://localhost:5173. Vite proxies `/api` and `/uploads` to `wrangler dev` on `:8787`.

First-time setup creates local D1 state automatically via `predev`. To use your own Cloudflare resources, create them and replace the IDs in `wrangler.jsonc`:

```bash
npx wrangler d1 create sciehub
npx wrangler r2 bucket create sciehub-uploads
npm run db:migrate:local
```

## Deploying to Cloudflare

The app runs as a single Worker: **Workers Assets** serve the built SPA, **Hono** handles `/api/*`, **D1** stores data, and **R2** stores uploads.

```bash
npm install
npx wrangler login
npm run deploy
```

`npm run deploy` builds `shared` + `web`, applies pending D1 migrations, and deploys the Worker. On the first deploy, also set the signing secret:

```bash
openssl rand -hex 48 | npx wrangler secret put JWT_SECRET
```

### Production checklist

| Step | Command / value |
| --- | --- |
| Set a real signing secret | `npx wrangler secret put JWT_SECRET` |
| First user is the admin | The **first account registered** on a fresh database becomes the site admin automatically |
| Make another user admin | Set `ADMIN_EMAILS=<their@email>` in the dashboard, or promote from `/admin` |
| Custom domain | Workers & Pages → `sciehub` → Settings → Domains & Routes |
| Push-to-deploy | Workers & Pages → `sciehub` → Settings → Builds → connect GitHub; build `npm ci && npm run build`, deploy `npm run deploy:ci` |
| Logs | `npx wrangler tail` |
| Backups | D1 export + R2 copy (see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)) |

Fresh installs contain **no demo data**. Register an account at `/auth` and it works immediately. Large uploads are subject to Worker request/memory limits; the default is 50MB per file (configurable with `SCIEHUB_MAX_FILE_MB`).

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | dev-only default | **Set as a Worker secret in production** |
| `ADMIN_EMAILS` | empty | Optional: comma-separated emails that get **admin** on register/login (overrides the first-user rule) |
| `SCIEHUB_MAX_FILE_MB` | `50` | Max size per uploaded file |
| `SCIEHUB_MAX_FILES` | `8` | Max files per upload request |

Cloudflare bindings (configured in `wrangler.jsonc`): `DB` (D1), `UPLOADS` (R2), `ASSETS` (Workers Assets). The app does not read `.env`; use `.dev.vars` locally and Worker secrets/vars in production.

## Monorepo layout

```
packages/
├── shared/     # Domain types + constants (Repository, RepoFile, User, categories, report reasons…)
├── server/     # Hono Worker API, D1 queries, JWT auth, R2 uploads
│   └── migrations/  # D1 SQL migrations
└── web/        # React SPA — pages, shadcn/ui components, theme system
wrangler.jsonc  # Worker entry, D1/R2/Assets bindings, SPA fallback, cron
```

## Key routes

| Route | Page |
| --- | --- |
| `/` | Home — free library hero, free shelf, trending, community, groups |
| `/library` (aliases `/feed`, `/marketplace`, `/free`, `/paid`) | Browse/search resources by level, subject and resource type |
| `/repos/:id` | Repository detail — files, inline preview, free download, reviews, comments, share |
| `/community` | The Commons — shared community board (username or anonymous) |
| `/plaza` | Plaza — campus wall with text + image posts, likes and comments |
| `/upload` | Create a repository / publish anonymously / add files |
| `/groups` | Group directory + create-group dialog |
| `/groups/:id` | Group detail — repositories / members (+ join requests) / settings (creator) |
| `/users/:username` | Public profile — repositories / favorites / groups |
| `/leaderboard` | Top contributors by files shared |
| `/conduct` | Community guidelines |
| `/contributing` | Contribute — send suggestions, report issues, open PRs |
| `/admin` | Admin console (admins only) — overview, reports, users, repos |
| `/settings` | Profile, avatar, notification prefs, password |
| `/auth` | Sign in / register |

## User manual

A plain-language guide for readers and publishers lives in [`docs/USER_MANUAL.md`](./docs/USER_MANUAL.md) — how to publish, preview files, use the community and review.

## Notes

- Joining a group creates a **join request**; the group creator (admin) approves/rejects it. Admins cannot leave — they delete the group instead.
- **Free only** — every resource downloads directly, and publishing can be anonymous or under a username.
- **Original work** — only upload material you own or have permission to share. If your own notes were uploaded by someone else without permission, contact the administrator for removal.
- **The Commons** — every signed-in user can post. Admins can block a user's community posting independently of other permissions, and can delete any post.
- **Reviews** — any signed-in student can review. Reviews can be edited or deleted by their author.
- Reports are triaged in `/admin` → Reports.
- **Email registered without your permission?** If you find your email is already taken on the sign-up page, use that email to write to `jasonsun2009@yeah.net` — the sign-up form includes a ready-made "claim" email link. Never create an account on an email you don't own. Forgot your password? The sign-in form has a "contact the admin to reset it" link to the same address.
- **Admins** can open `/admin` from their account menu. The **first registered user** on a fresh install becomes the site admin — no default password exists anywhere in the code. Emails in `ADMIN_EMAILS` are auto-promoted on register/login, and existing admins can promote others from the Users tab. Admins can **add other admins** and **step down** (transfer) their own admin role — the last admin is protected from being removed. Tip: register your owner account first so no stranger grabs admin on a public server.
- **Account security** — every login attempt is recorded and shown on `/settings` (login history). "Sign out all devices" invalidates every session. Deactivating an account freezes it for 30 days; signing in again restores it, otherwise it is deleted. Accounts can also be permanently deleted with their password.
- Uploaded files live in Cloudflare R2; D1 stores `/uploads/<key>` paths. Back up/export both D1 and the R2 bucket.
- React Router uses history mode — Workers Assets serve `index.html` for unmatched navigation routes, so deep links and refreshes work.
- Source: [github.com/JasonSun2009CN/SCIEHub](https://github.com/JasonSun2009CN/SCIEHub)
- Architecture decisions are recorded in [`ADR.md`](./ADR.md); see [`ROADMAP.md`](./ROADMAP.md) and [`HANDOFF.md`](./HANDOFF.md) for status and handoff details.
