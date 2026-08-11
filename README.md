# SCIEHub

A GitHub-style study-materials sharing platform for international high school students (IB · A-Level · AP · IGCSE).

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
- **Comments & favorites** per repository, per-file download counters, drag-and-drop multi-file uploads with progress.
- **Dark/light themes** (dark default) driven by CSS-variable tokens.

## Getting started

```bash
npm install          # installs all workspaces
npm run dev          # Fastify API on :4000 + Vite dev server on :5173 (proxies /api & /uploads)
```

Open http://localhost:5173.

### Production (deploy-to-server)

```bash
npm run build        # builds shared → server → web
npm start            # Fastify serves the built SPA + API on :4000
```

Open http://localhost:4000. A blank database is created automatically on first boot — **no demo data is included**; register your own account from the **Sign in** page.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `JWT_SECRET` | dev-only default | **Set a real secret in production** |
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
| `/settings` | Profile, avatar, notification prefs, password |
| `/auth` | Sign in / register |

## Notes

- Joining a group creates a **join request**; the group creator (admin) approves/rejects it. Admins cannot leave — they delete the group instead.
- Reports (`reports` table) are stored for future moderation; there is no review UI yet.
- Uploaded files live on the server disk; the database stores relative paths. Back up both `data/sciehub.db` and `data/uploads/`.
- React Router uses history mode — the Fastify server falls back to `index.html` so deep links and refreshes work in production.
- Architecture decisions are recorded in [`ADR.md`](./ADR.md); see [`ROADMAP.md`](./ROADMAP.md) and [`HANDOFF.md`](./HANDOFF.md) for status and handoff details.
