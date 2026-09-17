# Darse Burhani — Student Information System

School SIS (attendance, points/rewards, Hifz, library, mood tracking, and more),
migrated from Next.js (App Router) to a **Vite + Node.js (Express)** stack:

- `server/` — Express backend built with Vite SSR (vite-node in dev, `vite build` in prod).
- `client/` — React SPA built with Vite; replaces the Next.js App Router pages.
- React Router v6 handles routing; `next/*` and `next-auth/*` are shimmed in the client.
- Auth is JWT-cookie based (`sis_session`), signed with `NEXTAUTH_SECRET`.

## Requirements

- Node.js 20+ (dev tooling targets Node 22)
- Docker (for the local PostgreSQL database) — everything runs locally, no cloud account needed

## Run everything with Docker (recommended)

The whole app (PostgreSQL + API + SPA) runs in Docker — nothing needs to be
installed or started manually except Docker itself:

```bash
docker compose up -d       # build the app image + start db & app
# open http://localhost:4000  (admin@darseburhani.edu / password123)
```

- First run automatically applies migrations (`prisma migrate deploy`).
- Data persists in named volumes: `darseburhani-pgdata` (database) and
  `darseburhani-uploads` (uploaded files).
- `docker compose up -d --build` rebuilds the image after code changes.
- `docker compose down` stops everything (data is kept).
- `docker compose logs -f app` tail the app logs.

> The database and all uploaded files are stored **locally** on your machine —
> no online/cloud dependency, no paid plan required.

## Development (without Docker)

```bash
npm install            # installs workspaces + runs prisma generate (postinstall)
docker compose up -d db   # local PostgreSQL (data persists in a named volume)
npx prisma migrate deploy # apply migrations
npm run seed              # optional: create the admin user (admin@darseburhani.edu / password123)
npm run dev               # server on :4000 (vite-node, hot reload) + client on :3000
```

## Production

```bash
npm run build        # bundles server (SSR) + client (SPA)
npm start            # node server/dist/index.js — serves the API + the built SPA
```

## Ports & env

| Env var              | Default                  | Used by |
| -------------------- | ------------------------ | ------- |
| `PORT`               | `4000`                   | server  |
| `API_PROXY_TARGET`   | `http://localhost:4000`  | client dev proxy |
| `UPLOAD_DIR`         | `<repo>/public/uploads`  | server  |
| `DATABASE_URL`       | `postgresql://darseburhani:darseburhani@localhost:5432/darseburhani` | Prisma (docker compose) |
| `NEXTAUTH_SECRET`    | —                        | session cookie signing |

## Workspace scripts

- `npm run typecheck -w server` / `-w client`
- `npm run build -w server` / `-w client`
- `npm run dev:server` / `npm run dev:client`

## Layout

```
server/src/          Express app, auth, middleware, routes (mirrors old API routes)
client/src/          React SPA: App.tsx (routes), app/, components/, shims/
prisma/              Schema + seed
```
