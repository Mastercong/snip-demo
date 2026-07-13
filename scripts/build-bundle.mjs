#!/usr/bin/env node
/**
 * scripts/build-bundle.mjs
 *
 * Assembles the "bundle" submodule from the backend / frontend / cli source
 * branches, then optionally pushes everything to origin.
 *
 * Usage:
 *   node scripts/build-bundle.mjs          # assemble only
 *   node scripts/build-bundle.mjs --push   # assemble + push bundle + main
 */

import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── paths ────────────────────────────────────────────────────────────────────
const ROOT    = resolve(fileURLToPath(import.meta.url), '..', '..');
const BACKEND = join(ROOT, 'backend');
const CLI     = join(ROOT, 'cli');
const FRONTEND= join(ROOT, 'frontend');
const BUNDLE  = join(ROOT, 'bundle');

const PUSH = process.argv.includes('--push');

// ── helpers ──────────────────────────────────────────────────────────────────
function run(cmd, cwd = ROOT) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function hasStagedChanges(cwd) {
  try {
    const out = execSync('git diff --cached --name-only', { cwd }).toString().trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function hasUnpushedCommits(cwd, remoteBranch) {
  try {
    const n = execSync(`git rev-list --count ${remoteBranch}..HEAD`, { cwd }).toString().trim();
    return parseInt(n, 10) > 0;
  } catch {
    return false; // remote branch may not exist yet; treat as needing push
  }
}

function safeCommit(cwd, message) {
  run('git add -A', cwd);
  if (!hasStagedChanges(cwd)) {
    console.log(`  [nothing to commit in ${cwd}]`);
    return false;
  }
  run(`git commit -m ${JSON.stringify(message)}`, cwd);
  return true;
}

// ── step 1: update source submodules to branch tips ──────────────────────────
console.log('\n── 1. Updating backend / frontend / cli to branch tips ──');
run('git submodule update --init --remote backend frontend cli');

// ── step 2: build frontend ───────────────────────────────────────────────────
console.log('\n── 2. Building frontend ──');
run('npm install', FRONTEND);
run('npx ng build', FRONTEND);

const INDEX_HTML = join(FRONTEND, 'dist', 'snip-frontend', 'browser', 'index.html');
if (!existsSync(INDEX_HTML)) {
  console.error(`\nERROR: expected build output not found: ${INDEX_HTML}`);
  process.exit(1);
}
console.log('  ✓ frontend/dist/snip-frontend/browser/index.html exists');

// ── step 3: assemble bundle/ ─────────────────────────────────────────────────
console.log('\n── 3. Assembling bundle/ ──');

// 3a. server.js
const serverDst = join(BUNDLE, 'server.js');
cpSync(join(BACKEND, 'server.js'), serverDst);
console.log('  copied backend/server.js → bundle/server.js');

// 3b. cli.js
const cliDst = join(BUNDLE, 'cli.js');
cpSync(join(CLI, 'cli.js'), cliDst);
console.log('  copied cli/cli.js → bundle/cli.js');

// 3c. frontend build → bundle/public/
const PUBLIC_DIR = join(BUNDLE, 'public');
if (existsSync(PUBLIC_DIR)) {
  rmSync(PUBLIC_DIR, { recursive: true, force: true });
}
mkdirSync(PUBLIC_DIR, { recursive: true });
cpSync(join(FRONTEND, 'dist', 'snip-frontend', 'browser'), PUBLIC_DIR, { recursive: true });
console.log('  copied frontend build → bundle/public/');

// 3d. .env
writeFileSync(join(BUNDLE, '.env'), 'PUBLIC_DIR=./public\n');
console.log('  wrote bundle/.env');

// 3e. package.json  (no "type" field — cli.js must run under plain node)
const pkg = {
  name: 'snip-bundle',
  version: '1.0.0',
  description: 'Snip – self-contained bundle (generated)',
  scripts: {
    start: 'bun server.js',
  },
};
writeFileSync(join(BUNDLE, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
console.log('  wrote bundle/package.json');

// 3f. Dockerfile
const dockerfile = `\
FROM oven/bun:1-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD bun server.js
`;
writeFileSync(join(BUNDLE, 'Dockerfile'), dockerfile);
console.log('  wrote bundle/Dockerfile');

// 3g. .dockerignore
const dockerignore = `\
node_modules
.env
`;
writeFileSync(join(BUNDLE, '.dockerignore'), dockerignore);
console.log('  wrote bundle/.dockerignore');

// 3h. railway.json
const railway = {
  $schema: 'https://railway.app/railway.schema.json',
  build: { builder: 'DOCKERFILE', dockerfilePath: './Dockerfile' },
  deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 10 },
};
writeFileSync(join(BUNDLE, 'railway.json'), JSON.stringify(railway, null, 2) + '\n');
console.log('  wrote bundle/railway.json');

// ── step 4: commit inside bundle/ ────────────────────────────────────────────
console.log('\n── 4. Committing in bundle/ ──');
// Derive a readable stamp from the source submodule SHAs
const backendSha  = execSync('git rev-parse --short HEAD', { cwd: BACKEND }).toString().trim();
const frontendSha = execSync('git rev-parse --short HEAD', { cwd: FRONTEND }).toString().trim();
const cliSha      = execSync('git rev-parse --short HEAD', { cwd: CLI }).toString().trim();
const stamp = `backend:${backendSha} frontend:${frontendSha} cli:${cliSha}`;

const committed = safeCommit(BUNDLE, `chore: regenerate bundle (${stamp})`);

// ── step 5: bump submodule pointers in superproject ───────────────────────────
console.log('\n── 5. Bumping submodule pointers in superproject ──');
// Stage all four submodule paths (each is just a pointer change)
run('git add backend frontend cli bundle');
const superCommitted = hasStagedChanges(ROOT)
  ? (() => { run(`git commit -m "chore: bump submodule pointers (${stamp})"`); return true; })()
  : (() => { console.log('  [superproject: nothing to commit]'); return false; })();

// ── step 6: push (only with --push) ──────────────────────────────────────────
if (PUSH) {
  console.log('\n── 6. Pushing ──');
  if (committed || hasUnpushedCommits(BUNDLE, 'origin/bundle')) {
    // bundle submodule is in detached HEAD; push explicitly to the bundle branch
    run('git push origin HEAD:bundle', BUNDLE);
    console.log('  pushed bundle branch');
  } else {
    console.log('  bundle: nothing new to push');
  }
  if (superCommitted || hasUnpushedCommits(ROOT, 'origin/main')) {
    run('git push origin main');
    console.log('  pushed main');
  } else {
    console.log('  main: nothing new to push');
  }
} else {
  console.log('\n── (skipping push — run with --push to publish) ──');
}

console.log('\n✓ build-bundle complete.\n');
