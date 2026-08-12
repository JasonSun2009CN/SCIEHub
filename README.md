# SCIEHub

A GitHub-style study-materials sharing platform for international high school students (IB · AS/A-Level · AP · IGCSE).

**Share, Collaborate, Excel.** Create your own study repositories — each holding multiple files like a GitHub repo — share them into subject groups, compete on the community leaderboard, and download from classmates. Dark-first, GitHub-inspired interface.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite 5 · TailwindCSS · shadcn/ui (Radix) · react-icons/fa · TanStack Query · React Router (history mode) |
| Backend | Node.js · Fastify · TypeScript · better-sqlite3 |
| Auth | JWT + bcrypt (email/password) |
| Repo | npm workspaces monorepo: `packages/web` + `packages/server` + `packages/shared` |

## Features

- **Repositories** — users create repos (name, description, category, tags) and upload multiple files into them, GitHub-style.
- **Feed & search** — browse repositories with category filters, sorting (recent / most downloaded / most viewed) and full-text search.
- **Study groups** — join groups by **requesting membership**; the group creator approves or rejects each request. Groups collect repositories shared into them.
- **Sharing** — a repo owner can share a repository into any group they belong to (and remove it again).
- **Leaderboard** — `/leaderboard` ranks contributors by number of files shared, showing total size alongside.
- **Community guidelines** — `/conduct` sets the rules; **Report** buttons on every repository and comment store reports for review.
- **Admin console** — `/admin` lets admins see site stats, review reports, delete violating repositories/files/comments, and suspend, un-admin or delete users. Admins can add other admins and step down (transfer) their own role.
- **Account safety** — every sign-in is logged (IP + browser); users can review their login history, **sign out all devices**, **deactivate** their account (deleted after 30 days unless they sign back in) or **permanently delete** it with their password.
- **Comments & favorites** per repository, per-file download counters, drag-and-drop multi-file uploads with progress.
- **Dark/light themes** (dark default) driven by CSS-variable tokens.

## Getting started (development)

```bash
npm install          # installs all workspaces
npm run dev          # Fastify API on :4000 + Vite dev server on :5173 (proxies /api & /uploads)
```

Open http://localhost:5173.

## Deploying to a server

Requirements: **Node.js 18+** (tested on 22) and **npm**. No database service is needed — SQLite is a single file.

On a fresh server, from a clean clone:

```bash
# 1. Install everything
npm install

# 2. Build the frontend + backend, then start
npm start
#   npm start automatically runs the production build first (via "prestart").
#   Equivalent one-shot command: npm run deploy

# 3. Open
#   http://<server-ip-or-domain>:4000
```

`npm start` serves **both the built SPA and the API** on port `4000`. On first boot the app creates an empty SQLite database (`packages/server/data/sciehub.db`) and an uploads folder automatically — **no demo data is included**. Register an account at `/auth` and it works immediately.

### Production checklist

| Step | Command / value |
| --- | --- |
| Open the firewall/security-group port | `4000` |
| Set a real signing secret | `JWT_SECRET=<long-random-string> npm start` (otherwise a dev default is used) |
| First user is the admin | The **first account registered** on a fresh install becomes the site admin automatically |
| Make another user admin | `ADMIN_EMAILS=<their@email> npm start` (promoted on their register/login) or `npm run promote-admin -w @sciehub/server -- <email>` |
| Optional: custom port | `PORT=8080 npm start` |
| Optional: bind address | default `0.0.0.0` (all interfaces) |
| Keep the service running | run under `pm2 start 'npm start'` or a systemd unit |

Back up two things after real usage starts: `packages/server/data/sciehub.db` and `packages/server/data/uploads/`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `JWT_SECRET` | dev-only default | **Set a real secret in production** |
| `ADMIN_EMAILS` | empty | Optional: comma-separated emails that get **admin** on register/login (overrides the first-user rule) |
| `DB_PATH` | `packages/server/data/sciehub.db` | SQLite file |
| `UPLOAD_DIR` | `packages/server/data/uploads` | Uploaded files |
| `WEB_DIST` | `packages/web/dist` | Built frontend (served in production) |

## Monorepo layout

```
packages/
├── shared/     # Domain types + constants (Repository, RepoFile, User, categories, report reasons…)
├── server/     # Fastify API, SQLite schema, JWT auth, uploads, static SPA hosting
└── web/        # React SPA — pages, shadcn/ui components, theme system
```

## Key routes

| Route | Page |
| --- | --- |
| `/` | Home — hero, trending repos, top contributors, active groups |
| `/feed` | Browse/search repositories with filters + sorting |
| `/repos/:id` | Repository detail — files, comments, favorite, share, report |
| `/upload` | Create a repository / add files to one you own |
| `/groups` | Group directory + create-group dialog |
| `/groups/:id` | Group detail — repositories / members (+ join requests) / settings (creator) |
| `/users/:username` | Public profile — repositories / favorites / groups |
| `/leaderboard` | Top contributors by files shared + total size |
| `/conduct` | Community guidelines |
| `/contributing` | Contribute — send suggestions, report issues, open PRs |
| `/admin` | Admin console (admins only) |
| `/settings` | Profile, avatar, notification prefs, password |
| `/auth` | Sign in / register |

## Notes

- Joining a group creates a **join request**; the group creator (admin) approves/rejects it. Admins cannot leave — they delete the group instead.
- Reports (`reports` table) are stored for future moderation; there is no review UI yet.
- **Email registered without your permission?** If you find your email is already taken on the sign-up page, use that email to write to `jasonsun2009@yeah.net` — the sign-up form includes a ready-made "claim" email link. Never create an account on an email you don't own. Forgot your password? The sign-in form has a "contact the admin to reset it" link to the same address.
- **Admins** can open `/admin` from their account menu. The **first registered user** on a fresh install becomes the site admin — no default password exists anywhere in the code. Backups: emails in `ADMIN_EMAILS` are auto-promoted on register/login, and the `promote-admin` script grants admin to any existing user. Admins can **add other admins** (Users tab) and **step down** (transfer) their own admin role — the last admin is protected from being removed. Tip: register your owner account first so no stranger grabs admin on a public server.
- **Account security** — every login attempt is recorded and shown on `/settings` (login history). "Sign out all devices" invalidates every session. Deactivating an account freezes it for 30 days; signing in again restores it, otherwise it is deleted. Accounts can also be permanently deleted with their password.
- Uploaded files live on the server disk; the database stores relative paths. Back up both `data/sciehub.db` and `data/uploads/`.
- React Router uses history mode — the Fastify server falls back to `index.html` so deep links and refreshes work in production.
- Source: [github.com/JasonSun2009CN/SCIEHub](https://github.com/JasonSun2009CN/SCIEHub)
- Architecture decisions are recorded in [`ADR.md`](./ADR.md); see [`ROADMAP.md`](./ROADMAP.md) and [`HANDOFF.md`](./HANDOFF.md) for status and handoff details.
