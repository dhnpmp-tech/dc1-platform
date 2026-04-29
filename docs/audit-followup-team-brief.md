# Audit follow-up — team brief (2026-04-29)

Status snapshot of the Tito/Nexus security-audit follow-up work, the two
items that need a design call before any code lands, and the still-open
Windows-installer backlog.

---

## 1. Audit-follow-up PRs (what shipped)

All listed PRs are merged to `main` and deployed to the VPS unless noted.

### Backend

| PR | Audit IDs | What it did |
|----|-----------|-------------|
| **#318** | M7, H3, H6, M8 | Catalog filter to `providers_online > 0` by default; per-provider in-flight gate (`MAX_INFLIGHT_PER_PROVIDER`) returning `503 Retry-After: 5` instead of overloading; in-memory Idempotency-Key replay cache (60 s TTL, replay header `Idempotent-Replayed: true`); per-class hard timeout caps (vision 60 s / chat 90 s / reasoning 300 s) layered on top of token-scaled timeout. |
| **#320** | H1, H2, M1, M6 | Strict key-type validation in `/v1/*` and provider-auth middleware (renter keys can't claim provider routes and vice versa); per-key-type rate-limit buckets (prefix-aware, separate quotas for `dcp-renter-` / `dcp-provider-` / admin); CORS tightened in production (no localhost origins); webhook secret no longer falls back to renter API key. |
| **#319** | H4, H5 (daemon half) | Daemon advertises WireGuard mesh IP in heartbeat (`wg_mesh_ip`); backend `providers` table gained `wg_mesh_ip` column with COALESCE update. Windows GPU detection chain rewritten: `nvidia-smi` → registry `qwMemorySize` → `Get-CimInstance Win32_VideoController` (handles `>4 GB` AdapterRAM uint32 truncation). DAEMON_VERSION 4.2.1 → 4.2.2. |
| **#322** | C1 phase 1, C5 | `Deprecation` / `Sunset` / `Link` response headers when a request uses `?key=` / `?renter_key=` / `?provider_key=` / `?api_key=`; per-path rate-limited stderr telemetry tagged `[c1-deprecation]` to size phase-2 cutover. C5: false-positive sweep memo for admin.js dynamic-fragment SQL — all paths safe by construction. |
| **#323** | C2, C3, C4 | `withFinancialIdempotency()` middleware on `POST /api/payments/topup` + `POST /api/providers/:id/payouts` (DB-backed `idempotency_keys` table, 24 h TTL); 30 s background reachability probe on every online provider's `vllm_endpoint_url` with `getCapableProviders` filtering on `endpoint_reachable !== 0`; daemon unclean-exit detection via `~/.dcp/daemon_state.json` running/clean marker (DAEMON_VERSION 4.2.2 → 4.2.3). |
| **#326** | L3 | False-positive sweep memo for admin audit logging — 28+ `INSERT INTO admin_audit_log` sites in admin.js plus per-request middleware already cover the Tito/Nexus concern. |
| **#327** | L1, L2 | False-positive memo for L1 `console.log` "credential leak" sweep (matches were variable-name strings in config-absence checks, not secret values). Real fix for L2: new `safeErrorPayload(err, fallback)` helper at `backend/src/lib/error-response.js`, wired into 30 5xx leak sites across 8 routes (hyperagent, fallback, sync, openrouter-settlement, reconciliation, jobs, providers, admin). Production responses now show generic strings; dev/test still get `error.message` for debugging. |
| **#329** | C1 phase 2 (scope only) | Doc-only PR — `docs/audit-c1-phase2-scope.md` summarising 24 h of phase-1 telemetry: 2 837 hits, 100 % bare `?key=`, 99 % from six daemon endpoints. Lays out a 5-step phased cutover (daemon header migration → installer URL migration → frontend page sweep → per-path reject middleware → `download/daemon` last). No code change. |

### Daemon

| PR | Audit IDs | What it did |
|----|-----------|-------------|
| #319 *(see above)* | H4, H5 (heartbeat half) | Windows GPU fallback + WG mesh IP heartbeat. Version 4.2.1 → 4.2.2. |
| **#324** | M2 | Ollama blob-integrity sweep on daemon startup + 5-minute loop; `is_ollama_model_verified` filter in `detect_served_models`; mid-repull `is_repull_in_flight` blocks `accepting_jobs`; opt-in auto-repull behind `DCP_OLLAMA_AUTO_REPULL=1` (1/hr throttle). 15 new tests at `backend/installers/tests/test_ollama_integrity_v424.py`. Version 4.2.3 → 4.2.4. |
| **#325** | G19 | Tauri `update_daemon` fetches `/api/providers/download/daemon/manifest` first, verifies size + sha256 of downloaded bytes **before** the kill-and-replace; manifest is computed over post-key-injection bytes so it matches per-key. Adds `sha2` + `hex` Rust crates. Backend helper `_buildInjectedDaemonScript` keeps download + manifest in lockstep. |
| **#328** | M3 | Ollama re-pull retry-with-exponential-backoff inside `_watch_repull` (env knobs `DCP_OLLAMA_REPULL_MAX_ATTEMPTS` / `_BACKOFF_SEC` / `_BACKOFF_CAP_SEC` / `DCP_OLLAMA_PULL_TIMEOUT_SEC`); post-pull `verify_ollama_model()` integrity check; new events `model_repull_verify_failed` + `model_repull_exhausted`; `_OLLAMA_REPULL_ACTIVE` gate keeps `accepting_jobs=False` for the entire retry window. 6 new tests, 71/71 daemon suite green. Version 4.2.4 → 4.2.5. |

### Audit-finding status

| ID | Description | Status |
|----|-------------|--------|
| H1 | Key-type validation | ✅ #320 |
| H2 | Per-type rate buckets | ✅ #320 |
| H3 | In-flight gate | ✅ #318 |
| H4 | Windows GPU fallback | ✅ #319 |
| H5 | Daemon WG heartbeat | ✅ #319 |
| H5 | v1.js routing pref | ⏳ tiny PR — **Fadi-blocked** until WG mesh verified end-to-end |
| H6 | Idempotency replay cache | ✅ #318 |
| M1 | CORS localhost in prod | ✅ #320 |
| M2 | Ollama health ping + integrity | ✅ #324 (daemon v4.2.4) |
| M3 | Model download retry + checksum | ✅ #328 (daemon v4.2.5) |
| M4 | Admin token timing-safe compare | ✅ done (timingSafeEqual already in place — verified) |
| M5 | Auth rate-limit tightening | ⛔ **needs design call** (see §2) |
| M6 | Webhook secret fallback | ✅ #320 |
| M7 | Catalog filter on online | ✅ #318 |
| M8 | Per-class timeout caps | ✅ #318 |
| M9 | Graceful degradation when no providers | ⛔ **needs design call** (see §2) |
| L1 | console.log sanitize | ✅ #327 (false positive — memo) |
| L2 | Prod error generification | ✅ #327 (`safeErrorPayload`) |
| L3 | Admin audit log | ✅ #326 (false positive — memo) |
| L4 | Heartbeat timing | ✅ no action needed per audit |
| C1 | Keys in URL — phase 1 (telemetry) | ✅ #322 |
| C1 | Keys in URL — phase 2 (cutover) | ✅ scope #329; 5-step cutover sequence pending |
| C2 | Idempotency on financial ops | ✅ #323 |
| C3 | Backend reachability probe | ✅ #323 |
| C4 | Daemon crash detection | ✅ #323 (daemon v4.2.3) |
| C5 | Admin SQL injection sweep | ✅ #322 (false positive — memo) |
| G19 | Tauri sha256 manifest verify | ✅ #325 |

---

## 2. Items that need a design call before any code

Both items are real but the audit text is one-line; either fix has more
than one reasonable shape and the wrong one creates a new problem. Each
should be a 30-min call with Tito + whoever owns the affected surface.

### M5 — auth rate-limit tightening

**Audit ask.** Lower the per-IP rate-limit ceiling on
`/api/providers/register`, `/api/renters/register`, and the failed-auth
path in general, so a credential-stuffing run can't burn through the
existing 5/10 min ceiling on a single IP.

**Why it can't just be lowered.** The current limit is keyed by
`req.ip`. We have legitimate traffic patterns where a single egress IP
is shared by many real users:

- corporate / university NATs (one outbound IP for hundreds of users);
- the dcp.sa frontend itself, which proxies some calls — if we hit it
  from `/api/dc1/*` paths they all look like one IP to us;
- the Tauri installer's internet-check + first registration arrive from
  the same IP within seconds, so a tight per-IP ceiling can also break
  the *single happy-path user* on a flaky retry;
- WireGuard mesh peers — every mesh member appears as `10.8.0.x` to
  internal routes; that's not an IP we want to throttle on.

**Decision points for the call.**

1. **Key the limiter on what?** Options: (a) `req.ip`, today's behaviour;
   (b) `req.ip + user-agent hash`, narrow but easy to spoof; (c) email
   bucket on register paths (each new email = clock from zero); (d) two
   layered limiters — soft per-IP + hard per-account.
2. **Different ceilings for different routes?** Register, login, and
   provider activation all reuse the same 5/10 min ceiling today, but
   they have very different abuse profiles.
3. **Captcha or proof-of-work as the safety valve** when a bucket is
   exhausted, instead of a flat 429? Especially on `/register`.
4. **Telemetry first.** Before tightening, ship a one-week observability
   pass on existing 429 emissions to size what the real abuse vs.
   legitimate-burst ratio looks like.

**Recommended pre-read for the call.**
`backend/src/middleware/rateLimiter.js`, plus the C1 phase-1 telemetry
methodology in `docs/audit-c1-phase2-scope.md` as a model for "measure
before flipping."

### M9 — graceful degradation when all providers offline

**Audit ask.** When a `/v1/chat/completions` request lands and there are
zero capable providers online for the requested model, return something
better than a flat 503 — "try a similar model that *is* online."

**Why this is more than an if-statement.** Today `getCapableProviders()`
returns an empty list and the route 503s. To "recommend a similar model"
we have to define *similar* — and we don't have that vocabulary yet:

- **Architecture-similar** (qwen3-4b → qwen3-8b)? Risk: pricing /
  latency / context-window differ, renter is silently spending more.
- **Capability-similar** (any 7-8B chat model)? Risk: response style
  changes; bad surprise for a renter chaining the call into a pipeline.
- **Family-similar** (any qwen)? Risk: small-family qwen renter gets
  upgraded to a 14B and budget breaks.
- **Strict opt-in** (header `X-Substitute-Model: allow`)? Cleanest, but
  it's not really "graceful degradation" any more — it's a feature.

**Decision points for the call.**

1. **Default behaviour: 503 (today), or substitute, or 503 + body that
   *suggests* substitutes the renter must explicitly retry against?**
   Tito's audit phrasing leaned toward "suggest", which is the safest
   default.
2. **Where does the similarity table live?** Hard-coded in `models.js`,
   or computed from the catalog's `model_class` + parameter-count
   metadata?
3. **What about the price delta?** A renter substituting up from 4B to
   8B has roughly 2× the cost; do we cap the suggestion at "same or
   cheaper"?
4. **Is this even the right priority?** Today's catalog is small enough
   that "no online provider for X" usually means "no online providers
   for *anything* that class," in which case the substitute logic is
   moot and the right answer is provider-supply work. Worth confirming
   from PM2 logs whether this is a hot path.

**Recommended pre-read for the call.**
`backend/src/routes/v1.js` (the `getCapableProviders` site +
existing 503 path) and `backend/src/routes/models.js` (catalog shape).

---

## 3. Windows-installer backlog (Fadi-independent)

Tier numbers below come from the Windows-installer audit classification.
Tier 1 is fully merged. The list here is what's open and **does not
depend on Fadi's WG verification**, so it's all immediately workable.

### In progress

| Tier / ID | Title | Notes |
|-----------|-------|-------|
| Tier 2.7 / **G56** | Tray Pause/Resume wiring | Tray menu items exist but `pause` doesn't actually stop heartbeat / refuse jobs. Pairs with Tier 4.16 / G47 below — both must land together to deliver a real pause. |
| Tier 2.9 / **M5** | Track child PIDs instead of `pkill -f` | Today the tray "stop daemon" action runs `pkill -f dcp_daemon` which can match unrelated processes that include the daemon path. Switch to recording the PID of children we spawn and signaling them by PID only. |

### Pending — Tier 3 (medium severity)

| Tier / ID | Title | Notes |
|-----------|-------|-------|
| Tier 3.13 / **G57** | Tray 60 s refresh loop | Tray status (online / accepting jobs / model count) is frozen at the moment the menu was opened. Add a 60 s refresh that re-reads `/api/providers/me`. |
| Tier 3.14 / **G33** | "Report a Problem" upload | Tray has a "Report a Problem" entry that does nothing. Wire it to bundle the daemon log tail + last 100 events JSON and POST to a backend ingest endpoint. |
| Tier 3.15 / **C2** | Updater error path with UI escape | When `update_daemon` fails (network, sha256 mismatch, write error) the tray today shows a generic "update failed" with no way out. Surface the specific error and offer "retry / open logs / cancel." |

### Pending — Tier 4 (lower severity / harder)

| Tier / ID | Title | Notes |
|-----------|-------|-------|
| Tier 4.16 / **G47** | Real pause via heartbeat | Backend half of Tier 2.7. Heartbeat needs an `accepting_jobs=false` field that tells the scheduler not to assign work; tray pause sets it, tray resume clears it. |
| Tier 4.19 / **G37** | Single-instance plugin | If the user re-launches the installer while it's already running, today we get two trays. Add Tauri's `single-instance` plugin and bring the existing window to front instead. |

### Pending — Tier 5 (hygiene / hardening)

| Tier / ID | Title | Notes |
|-----------|-------|-------|
| Tier 5.20 / **C1 + L1** | Shell scope + CSP | Restrict the `tauri.conf.json` shell-allowlist to the actual binaries we invoke (currently broader than needed) and add a Content-Security-Policy that blocks any non-bundled origin. |

### Bug bundle from Fadi 2026-04-27 session

| Task | Title |
|------|-------|
| #117 | Six Windows installer bugs surfaced during the 2026-04-27 troubleshooting session — to be triaged into Tier 2/3 buckets when worked. |

### Already merged in Tier 1 / Tier 2 (for context, not action)

| Tier / ID | Title |
|-----------|-------|
| Tier 1.1 / G55 | Tray "View Logs" path |
| Tier 1.2 / H9 | Replace `unwrap()`s in Tauri `setup()` |
| Tier 1.3 / L2 | Tray separator4 layout fix |
| Tier 1.4 / L4 | `chrono_now` ISO date format |
| Tier 1.5 / M7 | `daemon.log` append-not-truncate |
| Tier 2.6 / G2 | Detached daemon spawn |
| Tier 2.8 / M3 partial | Log silenced errors |
| Tier 2.10 / M6 | `tail_file` seeks from end |
| Tier 2.11 / M11 | Atomic daemon write |
| Tier 2.12 / H8 | `register_provider` reachability check |
| Tier 4.17 / G19 | sha256 manifest verify |
| Tier 4.18 / G6 | Tauri `update_daemon` backup + rollback |

---

## 4. Suggested next moves

1. **Schedule the M5 design call.** The questions above are short enough
   for a 30-min slot. Bring rate-limiter telemetry from one week of
   stderr logs.
2. **Schedule the M9 design call after M5.** It depends on a
   priority-vs-supply judgement that's easier once we've seen real 503
   counts in production.
3. **Pick the next installer tier item.** Recommendation: finish
   Tier 2.7 (G56) + Tier 4.16 (G47) as a paired PR — that delivers a
   *real* pause feature instead of two half-features. Tier 3.13 (G57)
   is a fast follow.
4. **Hold the C1 phase-2 cutover** until the daemon-header migration
   PR is in flight. The scope doc at `docs/audit-c1-phase2-scope.md`
   spells out the order.

Anyone reading this for context: the underlying audit follow-up notes
also live in Peter's local memory at
`~/.claude/projects/-Users-pp-DC1-Platform/memory/project_security_audit_followup.md`,
which is the canonical task-status table.
