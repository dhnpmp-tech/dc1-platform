# Audit C5 — false positive memo

**Date:** 2026-04-28
**Reviewer:** Peter (DCP)
**Audit source:** Nexus/Tito consolidated technical review

## Audit claim

> **C5. SQL Injection Surface in Admin Endpoints**
> `routes/admin.js` lines 1827-1830 construct SQL queries by concatenating
> column names from dynamic input. While WHERE clauses use parameterized
> queries, the dynamic column list construction could be exploited if column
> names come from user-controlled input.

## Reviewed code (admin.js:1810-1830)

```js
const providerColumns = new Set(db.all(`PRAGMA table_info(providers)`).map(r => r.name));
const jobColumns = new Set(db.all(`PRAGMA table_info(jobs)`).map(r => r.name));

const providerSet = ["status = 'offline'"];
if (providerColumns.has('current_job_id')) providerSet.push('current_job_id = NULL');
if (providerColumns.has('updated_at')) providerSet.push("updated_at = datetime('now')");

const jobSet = ["status = 'queued'", 'provider_id = NULL'];
const jobParams = [];
if (jobColumns.has('error')) { jobSet.push('error = ?'); jobParams.push('Provider marked offline by manual sweep'); }
if (jobColumns.has('last_error')) { jobSet.push('last_error = ?'); jobParams.push('Provider marked offline by manual sweep'); }
// ...

const markOfflineStmt = db.prepare(`UPDATE providers SET ${providerSet.join(', ')} WHERE id = ?`);
const requeueStmt = db.prepare(
  `UPDATE jobs SET ${jobSet.join(', ')} WHERE provider_id = ? AND status IN ('running', 'pending', 'assigned', 'pulling')`
);
```

## Why it is not exploitable

1. **`providerSet` and `jobSet` only ever receive hardcoded string literals.**
   Every `push()` call writes a fixed compile-time string (`'current_job_id = NULL'`,
   `'error = ?'`, etc.). There is no `req.query`, `req.body`, or `req.params`
   reference that lands in either array.

2. **The `Set` they are gated on (`providerColumns`, `jobColumns`) is built
   from `PRAGMA table_info(...)`** — SQLite's own schema metadata. The
   schema is server-controlled (defined in `backend/src/db.js` and migrations).
   No user-controllable input feeds those column names.

3. **All values are bound through `?` parameter placeholders**: `jobParams`
   carries the values, and `markOfflineStmt.run(p.id)` /
   `requeueStmt.run(...jobParams, p.id)` bind them at execution.

4. **The endpoint is admin-gated**: `app.use('/api/admin', adminLimiter)` and
   admin token auth (server.js + admin route auth middleware) require a
   valid admin token before this code path is reachable.

There is no path from any HTTP request input to the column-name fragments
in the constructed SQL.

## Sweep results across the rest of `admin.js`

A wider sweep of `backend/src/routes/admin.js` (3000+ LOC) for dynamic-SQL
patterns found:

| Pattern | Locations | Verdict |
|---------|-----------|---------|
| `${where}` interpolation | 14 sites (1043, 1059, 2605, 2613, 3155, 3171, 3492, 3502, 3901, 3911, 4329, 4335, 4511, 4611) | All build `where` from hardcoded SQL fragments only; user input bound via `?` placeholders into `params`/`wParams` arrays. **Safe.** |
| `${updates.join(', ')}` (4279) | `notification_config` POST | `updates` only receives hardcoded `'col = ?'` literals; values go through `?`. **Safe.** |
| `${providerSet.join(', ')}` (1827) | This memo's subject | **Safe** (analysis above). |
| `LIMIT ${limit} OFFSET ${offset}` | Multiple | `limit`/`offset` are bounded integers via `Math.min(parseInt(...) \|\| N, MAX)`. Coerced to integers at parse; non-numeric input → `NaN \|\| 0` → bounded. **Safe.** |
| IN clause `(${arr.map(() => '?').join(',')})` | 3141, etc. | Generates only `?` placeholders; count derived from array length, values bound. **Safe.** |
| Classic vectors (`orderBy`, `sortBy`, `sortColumn`, `filterField`, dynamic column from `req.*`) | 0 hits | None in admin.js. |

## Conclusion

C5 as written is a false positive. We recommend the audit close C5 with
"reviewed, safe by construction" and re-open only if a specific user-input →
column-name path is identified.

If the audit's underlying concern is *defense-in-depth against future
edits introducing such a path*, we agree to keep this memo and the
column-allowlist pattern (`Set` filtered by `PRAGMA table_info`) as the
documented house style for any future dynamic-fragment SQL in
`admin.js`.

## What is shipping in this PR alongside

- **C1 phase 1** (server.js): `Deprecation`/`Sunset`/`Link` response headers
  + per-path rate-limited deprecation logging when query-param API keys are
  used. Existing `?key=` clients keep working through the 30-day sunset.
  Phase 2 (hard rejection) is a separate change after telemetry.

## References

- Audit findings list (Nexus 2026-04-28 consolidated report)
- `backend/src/routes/admin.js:1810-1840` (sweep-stale endpoint)
- `backend/src/server.js:296-360` (C1 middleware)
