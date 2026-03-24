# DCP API — Recommended Production CORS Configuration

**Last updated:** 2026-03-24 (DCP-915)

---

## Current Configuration (server.js:71–119)

The backend uses an explicit origin allowlist, not a wildcard. All configuration is in `backend/src/server.js`.

### Allowed Origins

```js
const ALLOWED_ORIGINS = [
  'https://dcp.sa',
  'https://www.dcp.sa',
  'https://app.dcp.sa',
  'https://api.dcp.sa',
  // Optional: set FRONTEND_URL env var for preview deployments
  // Optional: set CORS_ORIGINS env var (comma-separated) for additional origins
  // Localhost variants are only included when NODE_ENV !== 'production'
];
```

### Allowed Methods

```js
['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
```

### Allowed Headers

```js
[
  'Authorization',
  'Content-Type',
  'X-Renter-Key',
  'X-Provider-Key',
  'X-Admin-Token',
  'X-DC1-Signature',
  'X-DCP-Event',
  'X-Paperclip-Run-Id',
]
```

### Other Settings

| Setting | Value | Notes |
|---------|-------|-------|
| `credentials` | `true` | Required for `Authorization` header to work cross-origin |
| `maxAge` | `86400` (24h) | Preflight cache duration |

---

## Environment Variables for Dynamic Origins

| Variable | Purpose | Example |
|----------|---------|---------|
| `FRONTEND_URL` | Add a single preview/staging frontend origin | `https://staging.dcp.sa` |
| `CORS_ORIGINS` | Add multiple additional origins (comma-separated) | `https://partner.example.com,https://docs.dcp.sa` |

---

## Production Checklist

Before deploying to production:

- [ ] `NODE_ENV=production` is set — removes localhost variants from allowlist automatically
- [ ] `FRONTEND_URL` is unset or points to a specific `https://` origin — no `http://`
- [ ] No route handler calls `res.setHeader('Access-Control-Allow-Origin', '*')` — audit with:
  ```bash
  grep -rn "Access-Control-Allow-Origin.*\*" backend/src/
  ```
- [ ] Nginx does not add its own `Access-Control-Allow-Origin` header (would duplicate):
  ```bash
  grep -r "add_header.*Access-Control" /etc/nginx/
  ```

---

## What NOT to Do

```js
// Never use this — bypasses the allowlist for all routes
app.use(cors({ origin: '*' }));

// Never set wildcard in individual route handlers
res.setHeader('Access-Control-Allow-Origin', '*');

// Never commit localhost to ALLOWED_ORIGINS unconditionally
const ALLOWED_ORIGINS = ['http://localhost:3000', ...]; // without the isDev guard
```

---

## Nginx Considerations

The production nginx config (api.dcp.sa) reverse-proxies to port 8083. CORS headers should be set by Express only — do **not** add `add_header Access-Control-Allow-Origin` in nginx, as this will cause duplicate headers which some browsers reject.

```nginx
# Correct — let Express handle CORS
location /api/ {
  proxy_pass http://127.0.0.1:8083;
  # No add_header Access-Control-Allow-Origin here
}
```

---

## Requests with No Origin Header

The CORS config explicitly allows requests with no `Origin` header (`if (!origin) return callback(null, true)`). This covers:

- Provider daemon (background process, no browser)
- `curl` / CLI tools
- Server-to-server API calls

This is correct and intentional for a B2B GPU marketplace API.
