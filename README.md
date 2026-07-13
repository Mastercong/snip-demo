# Snip CLI

A zero-dependency Node.js command-line client for the [Snip](../backend) URL shortener.

## Requirements

- Node.js 18+ (for built-in `fetch`)

## Installation

Link the bin globally:

```bash
npm link
```

Or run directly:

```bash
node cli.js <command>
```

Or use the wrapper scripts:

| Platform       | Script     |
|----------------|------------|
| macOS / Linux  | `./snip`   |
| Windows CMD    | `snip.cmd` |
| PowerShell     | `snip.ps1` |

## Configuration

| Variable   | Default                    | Purpose                     |
|------------|----------------------------|-----------------------------|
| `SNIP_API` | `http://localhost:3000`    | Base URL of the Snip backend |

## Commands

### `snip add <url>`

Shorten a URL. Prints the returned short URL.

```bash
snip add https://example.com
# → http://localhost:3000/aB3xZ9
```

### `snip ls`

List all shortened links in an aligned table.

```
CODE    │ HITS │ URL
────────┼──────┼─
aB3xZ9  │    5 │ https://example.com
k7mN2q  │    1 │ https://github.com
```

Prints `No links yet.` when the list is empty.

### `snip open <code>`

Look up the short code (without following the redirect) and open the destination
URL in the default OS browser.

```bash
snip open aB3xZ9
# → Opening: https://example.com
```

### `snip help`

Print usage information.

## Error handling

- Invalid or non-http(s) URLs print an error and exit with code `1`
- Unknown short codes print an error and exit with code `1`
- Backend unreachable prints an error and exit with code `1`
