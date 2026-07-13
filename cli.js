#!/usr/bin/env node
'use strict';

const BASE_URL = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/$/, '');

const USAGE = `
Snip CLI — URL shortener tool

Usage:
  snip add <url>    Shorten a URL
  snip ls           List all shortened links
  snip open <code>  Open a short code in the browser
  snip help         Show this help text
`.trim();

async function apiRequest(path, options) {
  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    die(`Cannot reach backend at ${BASE_URL} — ${err.message}`);
  }
  return res;
}

async function cmdAdd(url) {
  if (!url) die('Usage: snip add <url>');

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    die(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    die(`URL must use http or https, got: ${parsed.protocol}`);
  }

  const res = await apiRequest('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    let msg = `Server returned ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {}
    die(msg);
  }

  const link = await res.json();
  console.log(link.shortUrl);
}

async function cmdLs() {
  const res = await apiRequest('/api/links');

  if (!res.ok) {
    die(`Server returned ${res.status}`);
  }

  const links = await res.json();

  if (!links.length) {
    console.log('No links yet.');
    return;
  }

  // Determine column widths
  const codeHead  = 'CODE';
  const hitsHead  = 'HITS';
  const urlHead   = 'URL';

  const codeW = Math.max(codeHead.length, ...links.map(l => l.code.length));
  const hitsW = Math.max(hitsHead.length, ...links.map(l => String(l.hits).length));

  const pad = (s, w) => String(s).padEnd(w);
  const padL = (s, w) => String(s).padStart(w);

  const sep = `${'─'.repeat(codeW + 2)}┼${'─'.repeat(hitsW + 2)}┼─`;

  console.log(`${pad(codeHead, codeW)}  │ ${padL(hitsHead, hitsW)} │ ${urlHead}`);
  console.log(sep);

  for (const link of links) {
    console.log(`${pad(link.code, codeW)}  │ ${padL(link.hits, hitsW)} │ ${link.url}`);
  }
}

async function cmdOpen(code) {
  if (!code) die('Usage: snip open <code>');

  const res = await apiRequest(`/${encodeURIComponent(code)}`, { redirect: 'manual' });

  if (res.status === 404) {
    die(`Unknown code: ${code}`);
  }

  const location = res.headers.get('location');
  if (!location) {
    die(`Backend returned ${res.status} but no Location header`);
  }

  const { execSync } = require('child_process');
  const platform = process.platform;

  let cmd;
  if (platform === 'darwin')      cmd = `open ${JSON.stringify(location)}`;
  else if (platform === 'win32')  cmd = `start "" ${JSON.stringify(location)}`;
  else                            cmd = `xdg-open ${JSON.stringify(location)}`;

  try {
    execSync(cmd, { stdio: 'ignore' });
  } catch {
    die(`Could not open browser. URL: ${location}`);
  }

  console.log(`Opening: ${location}`);
}

function die(msg) {
  process.stderr.write(`snip: ${msg}\n`);
  process.exit(1);
}

async function main() {
  const [,, subcmd, arg] = process.argv;

  switch (subcmd) {
    case 'add':  await cmdAdd(arg);  break;
    case 'ls':   await cmdLs();      break;
    case 'open': await cmdOpen(arg); break;
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      break;
    default:
      console.log(USAGE);
      if (subcmd) process.exit(1);
  }
}

main().catch(err => die(err.message));
