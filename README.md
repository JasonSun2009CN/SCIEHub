# SCIEHub

A GitHub-style study-materials sharing platform for international high school students (IB · A-Level · AP · IGCSE).

**Share, Collaborate, Excel.** Upload notes and past papers, join subject study groups, search resources, comment, favorite, and download — all in a dark-first GitHub-inspired interface.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite 5 · TailwindCSS · shadcn/ui (Radix) · react-icons/fa · TanStack Query · React Router (history mode) |
| Backend | Node.js · Fastify · TypeScript · better-sqlite3 |
| Auth | JWT + bcrypt (email/password) |
| Repo | npm workspaces monorepo: `packages/web` + `packages/server` + `packages/shared` |

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

Open http://localhost:4000. A blank database is created and seeded automatically on first boot.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Member | `alice@sciehub.io` | `password123` |
| Member | `bob@sciehub.io` | `password123` |
| … | any `user@sciehub.io` / `password123` | (see seed data) |

Register your own account from the **Sign in** page.

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
├── shared/     # Domain types + shared constants (User, Resource, Group, categories…)
├── server/     # Fastify API, SQLite schema/seed, JWT auth, uploads, static SPA hosting
└── web/        # React SPA — pages, shadcn/ui components, theme system
```

## Key routes

| Route | Page |
| --- | --- |
| `/` | Home — hero, trending resources, active groups |
| `/feed` | Browse/search resources with filters + sorting |
| `/resources/:id` | Resource detail — download, favorite, share, comments |
| `/upload` | Drag-and-drop multi-file upload |
| `/groups` | Group directory + create-group dialog |
| `/groups/:id` | Group detail — resources / members / settings (admin) |
| `/users/:username` | Public profile — uploads / favorites / groups |
| `/settings` | Profile, avatar, notification prefs, password |
| `/auth` | Sign in / register |

## Notes

- The dark theme is the default; a light theme is available via the header toggle. Both share the same CSS-variable tokens (`packages/web/src/index.css`).
- React Router uses history mode — the Fastify server falls back to `index.html` so deep links and refreshes work in production.
- Uploaded files live on the server disk; the database stores relative paths. Back up both `data/sciehub.db` and `data/uploads/`.
- Architecture decisions are recorded in [`ADR.md`](./ADR.md); see [`ROADMAP.md`](./ROADMAP.md) and [`HANDOFF.md`](./HANDOFF.md) for status and handoff details.
