# Snip — AI agent instructions

> Keep this file in sync with `CLAUDE.md` (same content, two destinations).

---

## What this repo is

A **superproject** (`main` branch) that wires three source layers together as git
submodules, each living on its own orphan branch, plus a fourth `bundle` branch that
holds generated, deployment-ready output assembled by `scripts/build-bundle.mjs`.

```
main  ← you are here
├── backend/   → branch: backend   (Node/Bun HTTP server, zero deps)
├── frontend/  → branch: frontend  (Angular 19 SPA)
├── cli/       → branch: cli       (Node CLI, zero deps)
└── bundle/    → branch: bundle    (GENERATED — never hand-edit)
```

---

## Layout & tech stack

| Path | Branch | Runtime | Notes |
|------|--------|---------|-------|
| `backend/server.js` | `backend` | Node ≥ 18 / Bun | HTTP only, no framework |
| `frontend/src/` | `frontend` | Angular 19, TypeScript | `ng build` output goes to `dist/snip-frontend/browser/` |
| `cli/cli.js` | `cli` | Node ≥ 18 | CommonJS, zero deps, uses built-in `fetch` |
| `bundle/` | `bundle` | Bun (Docker: `oven/bun:1-alpine`) | server.js + cli.js + public/ + Dockerfile |
| `scripts/build-bundle.mjs` | `main` | Node ≥ 18 (ESM) | Assembles bundle from the three source branches |
| `.github/workflows/` | `main` | GitHub Actions | `bundle.yml` (hourly) + `docker.yml` (on bundle pointer bump) |

---

## API contract

**Change it everywhere or nowhere.** The contract is implemented in `backend/server.js`,
consumed by `frontend/src/app/links.service.ts` and `cli/cli.js`, and documented in
the root `README.md`. All four must stay in sync.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|-------|
| `POST` | `/api/links` | `{ "url": "https://…" }` | `201 { code, url, shortUrl, hits, createdAt }` | `400 { error }` |
| `GET` | `/api/links` | — | `200` array of link objects | — |
| `GET` | `/:code` | — | `302 Location: <url>` (hits++) | `404 { error }` |

Link object: `code` (6 base-62 chars), `url`, `shortUrl`, `hits` (int), `createdAt` (ISO 8601).

---

## Key commands

```bash
# Clone (submodules are required)
git clone --recurse-submodules https://github.com/Mastercong/snip-demo.git

# Run backend (dev)
cd backend && node server.js          # or: bun run server.js

# Run frontend (dev)
cd frontend && npm start              # ng serve → http://localhost:4200

# Run CLI
cd cli && node cli.js add https://example.com
cd cli && node cli.js ls

# Assemble bundle locally (no push)
node scripts/build-bundle.mjs

# Assemble + push (updates bundle branch + bumps pointers in main)
node scripts/build-bundle.mjs --push
```

---

## Edit → push → pointer-bump workflow

1. Edit source files in the relevant submodule directory (`backend/`, `frontend/`, `cli/`).
2. Commit and push **from inside that subdirectory** to its own branch:
   ```bash
   cd backend
   git add -A && git commit -m "fix: …"
   git push origin HEAD:backend
   ```
3. Either wait for the hourly `bundle.yml` CI to run, or trigger it manually
   (`workflow_dispatch`), or run `node scripts/build-bundle.mjs --push` locally.
4. The script commits inside `bundle/` and bumps the submodule pointer in `main`.
5. The pointer bump on `main` triggers `docker.yml`, which builds and pushes the image.

---

## Do / Don't

| | Rule | Why |
|-|------|-----|
| ✗ | **Never hand-edit files in `bundle/`** | Everything there is overwritten on every build run. Edit the source branch instead. |
| ✗ | **Don't add `"type": "module"` to any `package.json` near `cli.js`** | `cli.js` is CommonJS. Adding ESM mode breaks it under plain `node`. The bundle `package.json` deliberately omits the `type` field. |
| ✗ | **Don't change the Angular output path** | The build script hard-checks for `dist/snip-frontend/browser/index.html` and exits non-zero if it's missing. Changing `outputPath` in `angular.json` breaks the bundle CI. |
| ✗ | **Don't add persistent storage expecting it to survive restarts** | Links are stored in a `Map` in memory (plus an optional `links.json` file). This is intentional for the demo scope — no external database. |
| ✗ | **Don't add a push trigger to `bundle.yml`** | The file only exists on `main`; a push trigger would only fire for direct pushes to `main`, never for changes pushed to `backend`/`frontend`/`cli`. The hourly schedule is the correct mechanism. |
| ✗ | **Don't expect `docker.yml`'s `paths: [bundle]` to watch files** | `bundle` is a submodule, so the entry in `main`'s tree is a **gitlink** (a commit-SHA pointer), not a directory of files. The paths filter fires when that pointer changes — i.e. when a new bundle release is pinned. |
| ✓ | **Always clone with `--recurse-submodules`** | A plain `git clone` leaves all four submodule directories empty. |
| ✓ | **Run `build-bundle.mjs` from the superproject root** | The script resolves all paths relative to `import.meta.url`; running it from a subdirectory will break path resolution. |
