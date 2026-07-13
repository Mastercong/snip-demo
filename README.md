# Snip — Tiny URL Shortener

One backend, two clients, three branches, one repo.

```
main (this branch)
├── backend/   → branch: backend   (Bun/Node HTTP server, zero deps)
├── frontend/  → branch: frontend  (Angular 19 SPA)
└── cli/       → branch: cli       (Node CLI, zero deps)
```

Each layer lives on its own **orphan branch** and is wired into `main` as a
**git submodule**, so every piece has a clean, independent history while still
being discoverable from a single URL.

---

## API contract

All responses are JSON. CORS is open (`*`).

| Method | Path | Body | Success | Error |
|--------|------|------|---------|-------|
| `POST` | `/api/links` | `{ "url": "https://…" }` | `201` `{ code, url, shortUrl, hits, createdAt }` | `400 { error }` |
| `GET` | `/api/links` | — | `200` array of link objects | — |
| `GET` | `/:code` | — | `302 Location: <original URL>` (hits++) | `404 { error }` |

**Link object shape**

```jsonc
{
  "code":      "aB3xYz",          // 6 random base-62 chars
  "url":       "https://…",       // original URL
  "shortUrl":  "https://…/aB3xYz",// BASE_URL + "/" + code
  "hits":      0,                 // incremented on every redirect
  "createdAt": "2026-07-13T…Z"    // ISO 8601 timestamp
}
```

---

## Branch-per-layer layout

| Branch | Contents | Start command |
|--------|----------|---------------|
| `backend` | `server.js`, `package.json`, `README.md` | `bun run server.js` |
| `frontend` | Angular 19 project (`src/`, `angular.json`, …) | `npm start` |
| `cli` | `cli.js`, `package.json`, wrappers, `README.md` | `node cli.js help` |
| `main` | This README + `.gitmodules` only | — |

---

## Cloning

A plain `git clone` leaves the submodule folders **empty**. Always recurse:

```bash
git clone --recurse-submodules https://github.com/Mastercong/snip-demo.git
cd snip-demo
```

If you already cloned without the flag:

```bash
git submodule update --init --recursive
```

---

## Running all three pieces

### 1 — Backend (Bun required, or plain Node ≥ 18)

```bash
cd backend
bun run server.js          # default port 3000

# env knobs:
# PORT=4000
# BASE_URL=https://your-domain.com
# PUBLIC_DIR=../frontend/dist/snip-frontend/browser   # serve Angular build
```

### 2 — Frontend (dev server)

```bash
cd frontend
npm install
npm start                  # http://localhost:4200 — proxies nothing, points at :3000
```

Or build and serve through the backend:

```bash
npm run build              # outputs to dist/snip-frontend/browser
PUBLIC_DIR=dist/snip-frontend/browser bun run ../backend/server.js
```

### 3 — CLI

```bash
cd cli
node cli.js help

# or with the wrapper (after npm install -g . or adding cli/ to PATH):
snip add https://example.com
snip ls
snip open <code>

# point at a different backend:
SNIP_API=https://your-domain.com node cli.js ls
```

---

## Keeping submodules in sync

Each submodule is a normal git repo on its own branch. Workflow:

### Make a change inside a submodule

```bash
cd backend          # or frontend / cli
# … edit files …
git add .
git commit -m "fix: something"
git push            # pushes to origin/backend
cd ..
```

### Bump the superproject pointer

```bash
# still in snip-demo root
git submodule update --remote backend   # fast-forwards the submodule to latest
git add backend
git commit -m "chore: bump backend submodule"
git push
```

> The superproject stores a **commit SHA** (the "pointer"), not a branch name.
> `--remote` is what advances that pointer to the branch tip after a push.

### Update all submodules at once

```bash
git submodule update --remote
git add backend frontend cli
git commit -m "chore: bump all submodules"
git push
```
