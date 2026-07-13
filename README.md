# Snip Backend

A tiny URL shortener backend built with Node.js (zero npm dependencies).

## Features

- Create short links with a POST to `/api/links`
- List all links with a GET to `/api/links`
- Redirect using short codes with automatic hit tracking
- Full CORS support for browser-based frontends
- Optional static file serving for frontend assets
- Environment-based configuration

## API

### POST /api/links
Create a new short link.

**Request:**
```json
{ "url": "https://example.com" }
```

**Response (201):**
```json
{
  "code": "abc123",
  "url": "https://example.com",
  "shortUrl": "http://localhost:3000/abc123",
  "hits": 0,
  "createdAt": "2026-07-13T12:00:00.000Z"
}
```

**Error (400):**
```json
{ "error": "URL must be a valid http(s) URL" }
```

### GET /api/links
List all short links.

**Response (200):**
```json
[
  {
    "code": "abc123",
    "url": "https://example.com",
    "shortUrl": "http://localhost:3000/abc123",
    "hits": 5,
    "createdAt": "2026-07-13T12:00:00.000Z"
  }
]
```

### GET /:code
Redirect to the original URL and increment hit count.

**Response (302):** Redirects to original URL

**Error (404):** Link not found

## Configuration

### Environment Variables

- **PORT**: Server port (default: `3000`)
- **BASE_URL**: Base URL for short links (defaults to `http://localhost:PORT` or `https://$RAILWAY_PUBLIC_DOMAIN`)
- **PUBLIC_DIR**: Directory to serve static files from (optional)

## Running

```bash
npm start
```

Or with Bun:

```bash
bun run server.js
```

## Development

The server is a single Node.js file with zero external dependencies, storing links in an in-memory Map.
