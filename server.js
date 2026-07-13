const http = require('node:http');
const { createReadStream, existsSync, statSync } = require('node:fs');
const path = require('node:path');

const links = new Map();
const port = Number(process.env.PORT || 3000);
const publicDir = process.env.PUBLIC_DIR ? path.resolve(process.env.PUBLIC_DIR) : null;
const baseUrl = getBaseUrl(process.env, port);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (req.method === 'POST' && pathname === '/api/links') {
    handleCreateLink(req, res);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/links') {
    handleListLinks(req, res);
    return;
  }

  if (req.method === 'GET') {
    if (publicDir) {
      const staticResult = tryServeStatic(publicDir, pathname, req, res);
      if (staticResult) {
        return;
      }
    }

    if (pathname === '/' && publicDir) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const code = pathname.replace(/^\//, '');
    if (!code) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const link = links.get(code);
    if (!link) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Link not found' }));
      return;
    }

    link.hits += 1;
    res.writeHead(302, { Location: link.url, 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
  console.log(`Snip backend listening on port ${port}`);
  console.log(`Base URL: ${baseUrl}`);
});

function handleCreateLink(req, res) {
  readJson(req, (err, body) => {
    if (err) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, { error: 'Expected a JSON object' });
      return;
    }

    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!isValidHttpUrl(url)) {
      sendJson(res, 400, { error: 'URL must be a valid http(s) URL' });
      return;
    }

    const code = generateCode();
    const createdAt = new Date().toISOString();
    const link = {
      code,
      url,
      shortUrl: `${baseUrl}/${code}`,
      hits: 0,
      createdAt,
    };

    links.set(code, link);
    sendJson(res, 201, link);
  });
}

function handleListLinks(req, res) {
  const list = Array.from(links.values());
  sendJson(res, 200, list);
}

function readJson(req, callback) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    if (!body) {
      callback(null, {});
      return;
    }

    try {
      callback(null, JSON.parse(body));
    } catch {
      callback(new Error('Invalid JSON'));
    }
  });
  req.on('error', () => callback(new Error('Request stream error')));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function generateCode() {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    code += alphabet[index];
  }
  return code;
}

function getBaseUrl(env, port) {
  const configured = env.BASE_URL ? env.BASE_URL.trim() : '';
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  return `http://localhost:${port}`;
}

function tryServeStatic(rootDir, pathname, req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  const cleanedPath = pathname === '/' ? '/index.html' : pathname;
  const decodedPath = decodeURIComponent(cleanedPath);
  const relativePath = decodedPath.split('?')[0].replace(/^\/+/, '');

  if (!relativePath || relativePath.includes('..')) {
    return false;
  }

  const candidatePaths = [
    path.join(rootDir, relativePath),
    path.join(rootDir, relativePath, 'index.html'),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
      const ext = path.extname(candidatePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.html') contentType = 'text/html; charset=utf-8';
      else if (ext === '.json') contentType = 'application/json; charset=utf-8';
      else if (ext === '.css') contentType = 'text/css; charset=utf-8';
      else if (ext === '.js') contentType = 'application/javascript; charset=utf-8';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';

      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        createReadStream(candidatePath).pipe(res);
      }
      return true;
    }
  }

  return false;
}
