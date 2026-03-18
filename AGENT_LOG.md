# DC1 Agent Communication Log

> **Protocol**: Every agent MUST append an entry here after making changes.  
> **Format**: `## [YYYY-MM-DD HH:MM UTC] AGENT_NAME  Summary`  
> **Agents**: Claude-Cowork (VPS/deploy), Cursor (IDE/analysis), Codex (GitHub/PRs), Nexus (OpenClaw)  
> **Rule**: `git pull` before work, `git push` after logging.

---

## [2025-03-11 10:00 UTC] Claude-Cowork  Daemon consolidation

- **Commit**: `5f90e1d`  Refactored `daemon.ps1` into thin installer v2.0.0 (303159 lines)
- **Files**: `backend/installers/daemon.ps1`
- **Impact**: daemon.ps1 now only installs; all runtime logic lives in `dc1_daemon.py v3.3.0`
- **Issue**: #34 created with full architecture docs

## [2025-03-11 11:30 UTC] Claude-Cowork  Registration error fix

- **Commit**: `a53509f`  Fix duplicate email error message in provider-onboarding.html
- **Files**: `backend/public/provider-onboarding.html` (line 485)
- **Bug**: Frontend threw generic `Registration failed` instead of reading server's 409 response
- **Fix**: Now reads `response.json()` body  shows "A provider with this email already exists"
- **Tested**: Verified via direct API call  409 + correct error JSON returned

## [2025-03-12 08:00 UTC] Claude-Cowork — Phase 1: Unified Design System + Playground Integration

- **Branch**: `phase1-unified-design-system` → merged via PR #36 (squash)
- **Commit on main**: `3840a66`
- **What changed**:
  - Created unified DC1 design system: amber (#F5A524), void black (#07070E), surface hierarchy (l1/l2/l3)
  - Built reusable components: `DashboardLayout`, `StatCard`, `StatusBadge`, `Footer`
  - Added Tailwind custom classes: `dc1-amber`, `dc1-void`, `dc1-surface-l1/l2/l3`, `dc1-text-primary/secondary/muted`
  - Redesigned all pages (provider register, provider dashboard, renter dashboard, renter register, login, admin)
  - Integrated GPU Playground directly into renter dashboard as tabbed interface (Overview + Playground)
- **Files** (16 files): `tailwind.config.ts`, `app/globals.css`, `app/components/layout/DashboardLayout.tsx`, `app/components/layout/Footer.tsx`, `app/components/ui/StatCard.tsx`, `app/components/ui/StatusBadge.tsx`, all page.tsx files
- **Impact**: All pages now share consistent DC1 brand design. Playground is accessible from renter dashboard tab.

## [2025-03-12 10:00 UTC] Claude-Cowork — Phase 2: Wire Registration & Login to Real VPS API

- **Branch**: `phase2-live-registration` → merged via PR (squash)
- **Commit on main**: `3c4e285`
- **What changed**:
  - **Login page** (`app/login/page.tsx`): Complete rewrite from demo email/password to real API key auth. Supports renter (`/renters/me?key=`), provider (`/providers/me?key=`), admin (`/admin/dashboard` with `x-admin-token` header). Stores correct localStorage keys (`dc1_renter_key`, `dc1_provider_key`, `dc1_admin_token`).
  - **Provider registration** (`app/provider/register/page.tsx`): Fixed field mapping (fullName→name, gpuModel→gpu_model, operatingSystem→os). Fixed response parsing (api_key, provider_id). Fixed status polling to use `/providers/me?key=`. Fixed Windows installer URL to `/download/setup?os=windows`.
  - **Provider dashboard** (`app/provider/page.tsx`): Fetches real data from `/providers/me?key=`. Maps `total_jobs`, earnings fields. Falls back to mock if API unreachable.
  - **Renter dashboard** (`app/renter/page.tsx`): Fixed localStorage persistence on manual login.
- **API contract notes for other agents**:
  - `/providers/me` reads `req.query.key` ONLY (not header) for auth
  - `/admin/*` routes use `x-admin-token` header (not `x-admin-key`)
  - Provider response uses `total_jobs` (not `jobs_completed`), `total_earnings_halala`, `today_earnings_halala`
- **Impact**: All registration, login, and dashboard flows now hit the real VPS backend.

## [2025-03-12 12:00 UTC] Claude-Cowork — Phase 3: Building Missing Pages (IN PROGRESS)

- **Branch**: `phase3-missing-pages`
- **What's being built**: Admin dashboard (wired to real API), legal pages (terms, privacy, acceptable-use), docs pages, support, renter marketplace, renter billing, provider/dashboard redirect
- **Footer 404 audit**: 10 links in Footer.tsx and other pages pointed to non-existent routes
- **Status**: In progress

---

## [2026-03-14 05:35 UTC] Claude-Cowork — Phase 4C: Health monitoring, reconciliation, security hardening

- **Commit**: `6ea6dfd`
- **Files**: `backend/src/server.js`, `backend/src/routes/admin.js`
- **What changed**:
  - **server.js**: Added security headers middleware (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy) and input sanitization middleware (strips HTML tags + null bytes from all req.body/req.query strings)
  - **admin.js**: Added `GET /admin/health` endpoint (DB check, online providers, active/stuck jobs, recent errors, critical daemon events, pending withdrawals — returns healthy/degraded status)
  - **admin.js**: Added `GET /admin/finance/reconciliation` endpoint (split mismatches, missing billing data, provider earnings drift, renter spend drift — configurable `?days=` param up to 90)
- **Impact**: Completes Phase 4C security hardening. All admin endpoints now behind security headers + sanitized inputs. Health and reconciliation endpoints live on VPS.
- **Breaking**: None
- **Deployed**: Yes — VPS pm2 restarted, both endpoints verified working

---

## [2026-03-14 05:50 UTC] Claude-Cowork — Admin page enhancements: health banner, audit log, reconciliation

- **Commit**: `6ec2685`
- **Files**: `app/admin/fleet/page.tsx`, `app/admin/security/page.tsx`, `app/admin/finance/page.tsx`
- **What changed**:
  - **Fleet Health**: Added system health status banner — DB status, online providers, active/stuck jobs, errors, pending withdrawals
  - **Security**: Added Admin Audit Log section with paginated table from `/admin/audit`
  - **Finance**: Added Financial Reconciliation section with period selector and provider/renter drift tables from `/admin/finance/reconciliation`
- **Impact**: All admin pages now wired to live backend data
- **Breaking**: None

---

## [2026-03-14 06:15 UTC] Claude-Cowork — Complete 4B + 4C: bulk ops, CSP, webhook/Telegram alerting

- **Commit**: `386c783`
- **Files**: `backend/src/server.js`, `backend/src/routes/admin.js`, `backend/src/routes/providers.js`, `backend/src/services/notifications.js` (NEW), `app/admin/providers/page.tsx`, `app/admin/renters/page.tsx`
- **What changed**:
  - **4B Bulk Ops**: Multi-select checkboxes on providers + renters pages. Bulk suspend/unsuspend providers, bulk suspend/unsuspend/credit renters. Backend: `POST /admin/bulk/providers`, `POST /admin/bulk/renters` with audit logging
  - **4C CSP**: Added Content-Security-Policy header to server.js
  - **4C Notifications**: Created `notifications.js` service — supports generic webhooks + Telegram Bot API. Admin endpoints: `GET/POST /admin/notifications/config`, `POST /admin/notifications/test`. Config stored in `notification_config` table (auto-created). Auto-alerts fire on critical daemon events (crashes, errors)
- **Impact**: Phase 4B and 4C now fully complete. All security hardening, bulk operations, and alerting infrastructure in place.
- **Breaking**: None
- **New table**: `notification_config` (auto-created on first access)

---

## [2026-03-14 08:15 UTC] Claude-Cowork — Dashboard improvements: quick wins + high-impact features

- **Commit**: `fa94802`
- **Files**: `app/provider/page.tsx`, `app/provider/settings/page.tsx`, `app/renter/page.tsx`, `app/renter/billing/page.tsx`, `app/renter/marketplace/page.tsx`
- **What changed**:
  - **P6**: Added "This Week" earnings stat card to provider dashboard (5-col grid, wired to `week_earnings_halala`)
  - **P7**: Removed dead `generateMockData()` function from provider dashboard
  - **P1**: Added Pause/Resume GPU toggle button to provider dashboard header (POST /providers/pause and /resume)
  - **P2**: Built GPU Preferences panel in provider Settings: run mode, schedule, GPU cap, VRAM reserve, temp limit (POST /providers/preferences)
  - **R1**: Fixed currency display from "$" to "SAR" on renter dashboard stat cards
  - **R6**: Added 30s auto-refresh interval to renter dashboard
  - **R2**: Added Top-Up / Add Funds section to renter Billing page (POST /renters/topup)
  - **R3**: Wrapped Marketplace in DashboardLayout with full sidebar nav, added reliability score + cached models
- **Impact**: 8 dashboard improvements completed. Provider and renter UX significantly enhanced.
- **Breaking**: None

---

## [2026-03-14 10:30 UTC] Claude-Cowork — Phase 4: Advanced dashboard features (P8-P10, R7-R9)

- **Commit**: `3702168`
- **Files**: `app/provider/jobs/[id]/page.tsx` (NEW), `app/provider/page.tsx`, `app/provider/jobs/page.tsx`, `app/provider/settings/page.tsx`, `app/renter/jobs/[id]/page.tsx` (NEW), `app/renter/settings/page.tsx` (NEW), `app/renter/analytics/page.tsx` (NEW), `app/renter/page.tsx`, `app/renter/jobs/page.tsx`, `app/renter/marketplace/page.tsx`, `app/renter/billing/page.tsx`
- **What changed**:
  - **P8**: Provider job detail page at `/provider/jobs/[id]` — earnings breakdown (75/25 split), job parameters, error display, 10s auto-refresh
  - **P9**: 7-day earnings bar chart on Provider dashboard using `earnings-daily` API
  - **P10**: Notification preferences section in Provider settings — 6 notification types
  - **R7**: Renter settings page at `/renter/settings` — profile, account stats, API key management (show/copy/rotate)
  - **R8**: Renter analytics page at `/renter/analytics` — daily spending chart, job type breakdown, success rate, outcome stats
  - **R9**: Renter job detail page at `/renter/jobs/[id]` — output display (LLM text + image gen), performance metrics, retry button
  - Added Settings nav item to all renter sidebar navigations (6 pages updated)
  - Linked job tables to detail pages in both dashboards
- **Impact**: All planned dashboard improvement items now complete. Both dashboards feature-complete.
- **Breaking**: None
- **New pages**: 4 (`provider/jobs/[id]`, `renter/jobs/[id]`, `renter/settings`, `renter/analytics`)

---

## [2026-03-14 09:30 UTC] Claude-Cowork — Phase 3: Dashboard consistency & polish (P3-P5, R4-R5)

- **Commit**: `6a0cf9c`
- **Files**: `app/provider/earnings/page.tsx`, `app/provider/page.tsx`, `app/renter/page.tsx`, `app/renter/jobs/page.tsx`
- **What changed**:
  - **P3+P4**: Rewrote Provider Earnings page — now uses DashboardLayout with full sidebar nav, localStorage auth (redirects to login if no key), DC1 design tokens (replacing hardcoded hex colors), StatCard components, StatusBadge, and 60s auto-refresh. Removed query-param auth pattern.
  - **P5**: Added daemon connection status badge to Provider dashboard GPU Health section — shows Connected (green pulse, <2min), Stale (yellow, <5min), or Disconnected (red) based on `last_heartbeat`. Also shows daemon version.
  - **R4**: Consolidated duplicate Playground — removed the full embedded playground from Renter dashboard (1012→280 lines). Dashboard now has clean overview with GPU table, recent jobs, and quick action links to standalone `/renter/playground`.
  - **R5**: Added 30s auto-refresh to Renter Jobs page + subtitle with job count
- **Impact**: All dashboard pages now use consistent DashboardLayout, auth patterns, and design tokens. Renter dashboard drastically simplified.
- **Breaking**: Provider Earnings page no longer uses `?key=` query param — uses localStorage instead. Old bookmarked links with `?key=` will show login redirect.

---

## [2026-03-14 07:40 UTC] Claude-Cowork — Phase 4 Final: Headless API Migration

- **Commit**: (pending push)
- **Files**: `backend/src/server.js`
- **What changed**:
  - **Removed HTML serving**: Stripped `express.static` for public dir, removed `/provider-onboarding` route, removed `/docs` route, removed `/` HTML redirect
  - **Root route**: Now returns JSON API info (`service`, `version`, `status`, `frontend`, `docs`, `timestamp`) instead of serving `provider-onboarding.html`
  - **Health check**: Updated service name to `dc1-platform-api` with `mode: headless`
  - **CSP simplified**: Changed from full browser CSP to strict API-only CSP (`default-src 'none'; frame-ancestors 'none'`)
  - **Console logs**: Updated startup messages to reflect headless API mode
  - **Preserved**: `/installers` static serving for daemon downloads, all `/api/*` routes unchanged
- **Verified on VPS**:
  - `GET /` returns JSON API info (200)
  - `GET /api/health` returns `{ mode: "headless" }` (200)
  - `GET /admin/dashboard` works with auth (200)
  - `GET /provider-onboarding.html` returns 404
  - `GET /docs` returns 404
  - `GET /admin.html` returns 404
  - `GET /installers/daemon.sh` and `daemon.ps1` still accessible (200)
- **Impact**: VPS is now a pure headless API server. All frontend served by Next.js on Vercel (dc1st.com). Phase 4 migration plan is **COMPLETE**.
- **Breaking**: Anyone bookmarking `http://76.13.179.86:8083/provider-onboarding.html` or `/docs` directly will get 404 — they should use `dc1st.com` instead.

---

## [2026-03-14 15:15 UTC] Claude-Cowork — Wire internal dashboards to real APIs + misc improvements

- **Commit**: `cf13e53`
- **Files**: `app/intelligence/page.tsx`, `app/connections/page.tsx`, `app/security/page.tsx`, `app/docs/api/page.tsx`, `app/docs/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/docs/renter-guide/page.tsx` (NEW), `app/not-found.tsx` (NEW), `app/budget/page.tsx`, `app/components/DashboardLayout.tsx`, `app/components/layout/Footer.tsx`, `app/tokens/page.tsx`
- **What changed**:
  - **I1**: Intelligence dashboard now fetches from `GET /admin/dashboard` + `GET /admin/providers` — shows real provider fleet stats, GPU distribution, provider cards with driver/compute/VRAM, and fleet activity chart. Shows LIVE/Offline badge.
  - **I2**: Connections monitor now pings real VPS API + Mission Control for live service health checks. Hardware section shows real registered providers from admin API. Agent heartbeats remain static (agent roster).
  - **I3**: Security dashboard derives events from real provider data — new registrations (<24h), failed heartbeats, extended offline, online status. Flag button wired to admin suspend endpoint.
  - **D1**: Created `/docs/renter-guide` — complete quickstart guide (account creation, browsing GPUs, first job, billing, API examples).
  - **D2**: Enhanced API docs with curl examples, error response shapes, HTTP status codes, example responses for all endpoints.
  - **P1a**: Custom 404 page with DC1 branding, 4 quick nav cards, support/docs links.
  - **P2d**: All domain references updated from `dc1-platform.vercel.app` to `dcp.sa` (Footer, docs, connections).
  - **P3**: Internal DashboardLayout nav standardized (Dashboard→Mission Control, added Budget, removed Token Usage). DC1 design tokens applied.
  - **P5**: `/tokens` now redirects to `/budget`. Budget page has Model Cost Rates section (Sonnet/Haiku/Opus/MiniMax).
- **Impact**: All 3 internal dashboards (Intelligence, Connections, Security) now wire to real VPS admin API with graceful fallback. 2 new pages created. API docs significantly improved. Domain references updated for dcp.sa launch.
- **Breaking**: None. All pages gracefully handle API offline state.

---

<!-- NEXT ENTRY GOES HERE — Append above this line -->

## [2026-03-18 11:51 UTC] DevOps Automator — DCP-16, DCP-17: NVIDIA CT install fix + container isolation docs

### DCP-16: NVIDIA Container Toolkit + Docker GPU passthrough
- **Files**: `backend/installers/dc1-setup-unix.sh`, `app/docs/provider-guide/page.tsx`
- **What changed**:
  - Fixed NVIDIA CT repo URL in setup script from deprecated distribution-specific path to `stable/deb/nvidia-container-toolkit.list` (fixes Ubuntu 24.04 installs)
  - Improved detection: checks `nvidia-ctk --version` binary in addition to `docker info` grep
  - Added `dnf` package manager support (RHEL/Rocky/Fedora)
  - Verification step now prints GPU name detected inside container
  - Expanded provider-guide Requirements section: hardware specs (CUDA 6.0+, VRAM minimums), full Linux software stack (driver >= 450.x, Docker 20.10+, NVIDIA CT), Windows requirements, new Job Execution Security section, expanded troubleshooting
- **Note**: Core GPU passthrough (`--gpus all` in `run_docker_job()`, NVIDIA CT check in `check_docker()`) was already implemented in prior heartbeats.

### DCP-17: Container network isolation
- **Files**: No code changes needed — already fully implemented in DCP-8 + DCP-21
- **Verified in `run_docker_job()`**: `--network none`, `--security-opt no-new-privileges:true`, `--read-only`, `--cap-drop all`, `--pids-limit 256`, custom seccomp profile
- **Optional bridge network**: Deferred — all current job types are single-container workloads

## [2026-03-18 11:45 UTC] Security Engineer — DCP-21: Container security hardening

- **Issue**: DCP-21 (High priority)
- **Files**: `backend/installers/dc1-daemon.py`, `backend/installers/dc1_daemon.py`
- **What changed**:
  - **`--cpus 4`**: Hard CPU core limit per container (was unlimited)
  - **`--memory-swap 16g`**: Set equal to `--memory` to disable swap headroom
  - **`--pids-limit 256`**: Fork-bomb protection (prevents unbounded process spawning)
  - **`--read-only`**: Root filesystem now immutable; writable areas via tmpfs only
  - **`--tmpfs /tmp:rw,noexec,nosuid,size=1g`** and **`/var/tmp`**: Writable tmp with noexec,nosuid
  - **`--cap-drop all`**: Drops all Linux capabilities (CUDA uses device files, not caps)
  - **`_ensure_seccomp_profile()`**: Writes `/tmp/dc1-gpu-seccomp.json` once at startup. Blacklist policy (default ALLOW) blocking 34 dangerous syscalls: kernel module loading, ptrace, clock manipulation, mount/pivot_root, kexec, perf_event_open, keyring, NUMA
  - **`--security-opt seccomp={path}`**: Custom seccomp attached when writable
  - **Audit events**: `container_start`, `container_complete`, `container_timeout`, `container_error` via `report_event()` → `daemon_events` table
  - **VRAM leak detection**: `container_vram_leak` warning if residual VRAM after container exit > 512 MiB
  - Added `CONTAINER_*` constants for tunable limits
- **Breaking**: Worker images must support read-only root FS. Images writing outside `/tmp`/`/var/tmp` will fail. Re-test all worker images with `--read-only` before production rollout. Providers must re-download daemon.

---

## [2026-03-18 11:38 UTC] Frontend Developer — DCP-22: GPU utilization dashboard

### New pages
- **`app/provider/gpu/page.tsx`** — Provider GPU metrics dashboard
  - SVG area/line charts (no external charting lib): GPU util %, VRAM %, temperature, power draw
  - Time range selector: 1h / 24h / 7d — uses `since` + `limit` query params on `GET /api/providers/me/gpu-metrics`
  - Multi-GPU per-card breakdown with GPU index tabs (reads `all_gpus[]` from DCP-19)
  - Period summary table: avg util, peak temp, peak power, sample count
  - Auto-refresh every 30s with live indicator
- **`app/renter/gpu-comparison/page.tsx`** — Renter provider comparison
  - Grid + table views of online providers from `GET /api/providers/available` (DCP-20)
  - Spec pills: VRAM, GPU count, CUDA, compute capability, location
  - Reliability / uptime progress bars
  - Side-by-side comparison table (select 2–4 providers)
  - Sort: Most VRAM / Reliability / Experience / Cheapest; filter by GPU model
  - Pricing: LLM + image SAR/min from `cost_rates_halala_per_min`

### Nav updates
- Added **GPU Metrics** nav item (`/provider/gpu`) to all 5 provider pages: dashboard, jobs, earnings, job detail, settings
- Added **GPU Compare** nav item (`/renter/gpu-comparison`) to renter sidebar

### Breaking changes
- None

## [2026-03-18 11:12 UTC] Backend Architect — DCP-18, DCP-19, DCP-20: Job execution engine, GPU metrics, GPU spec reporting

### DCP-18: Job execution engine
- **Files**: `backend/src/db.js`, `backend/src/routes/jobs.js`, `backend/installers/dc1_daemon.py`, `backend/installers/dc1-daemon.py`
- **DB migrations**: `jobs.priority` (1=high/2=normal/3=low), `jobs.retry_count`, `jobs.max_retries`, `job_logs` table
- **Priority queue**: `promoteNextQueuedJob()` now orders by `priority ASC, created_at ASC`
- **Status lifecycle**: `pending → assigned → pulling → running → completed/failed`. `/api/jobs/assigned` now sets `assigned`; progress endpoint advances to `pulling`/`running`
- **Retry logic**: result handler handles `transient: true` flag — resets to `pending` if `retry_count < max_retries` (default 2 retries)
- **New endpoints**: `POST /api/jobs/:id/logs` (daemon streams log lines), `GET /api/jobs/:id/logs` (renter/admin reads logs)
- **Daemon**: Docker pull failures return `transient: True`; reports `pulling` phase before pull; posts logs via `post_job_logs()` after execution
- **Breaking**: `/api/jobs/assigned` now returns `status: "assigned"` instead of `"running"` — daemons advance to `running` via progress endpoint

### DCP-19: GPU metrics per container
- **Files**: `backend/src/db.js`, `backend/src/routes/providers.js`, both daemon files
- **Multi-GPU**: `detect_gpu()` now iterates all GPU rows (was GPU 0 only), includes `all_gpus[]` array
- **Container metrics**: `collect_container_gpu_metrics(container_name)` — `nvidia-smi pmon` per-PID attribution; included in Docker job result
- **DB migrations**: `heartbeat_log.gpu_metrics_json`, `heartbeat_log.gpu_count`
- **New endpoint**: `GET /api/providers/:id/gpu-metrics` — time-series GPU metric history, multi-GPU aware, auth by provider key or admin

### DCP-20: Provider GPU spec reporting
- **Files**: `backend/src/db.js`, `backend/src/routes/providers.js`, `backend/src/routes/renters.js`, both daemon files
- **Daemon**: `_get_cuda_version()` parses CUDA version from nvidia-smi; `detect_gpu()` adds `compute_cap` query; heartbeat includes `compute_capability`, `cuda_version`
- **DB migrations**: `providers.gpu_compute_capability`, `providers.gpu_cuda_version`, `providers.gpu_count_reported`, `providers.gpu_spec_json`
- **Heartbeat handler**: stores spec fields on provider record on each heartbeat
- **New endpoint**: `GET /api/providers/available` — rich marketplace endpoint with full GPU spec (VRAM, CUDA, compute cap, driver, gpu_count, cost_rates, is_live)
- **Enhanced**: `GET /api/renters/available-providers` now includes compute_capability, cuda_version, gpu_count, is_live

## [2026-03-17 23:41 UTC] DevOps Automator — DCP-8, DCP-12, DCP-13

### DCP-8: Docker container isolation for job execution
- **Files**: `backend/installers/dc1_daemon.py`, `backend/installers/dc1-daemon.py`, `backend/docker/Dockerfile.general-worker` (NEW), `backend/docker/build-images.sh`
- **What changed**:
  - `run_docker_job()` in both daemons: added `--network none` (no internet inside container), `--name dc1-job-{job_id}` (reliable timeout kill), `--security-opt no-new-privileges:true`, `:ro` read-only volume mount, `shutil.rmtree` cleanup in `finally`
  - Updated image map from GHCR paths to local `dc1/sd-worker`, `dc1/llm-worker`, `dc1/general-worker`
  - Added `job_id` param through `execute_job` → `run_docker_job` for unique container naming
  - Created `Dockerfile.general-worker` (extends base-worker with scipy/matplotlib/pandas/sklearn/opencv)
  - Updated `build-images.sh` to build all 4 images (added step 4: `dc1/general-worker`)
- **Breaking**: Providers with Docker available now run jobs in isolated containers with no network access. `--network none` means job scripts cannot reach the internet.

### DCP-12: Hardcoded URLs → environment variables
- **Files**: `next.config.js`, `lib/api.ts`, `backend/src/server.js`, `.env.example`
- **What changed**:
  - `next.config.js`: proxy rewrite now uses `process.env.BACKEND_URL` (fallback: VPS IP)
  - `lib/api.ts`: `VPS_DIRECT`/`MC_DIRECT` read from `NEXT_PUBLIC_DC1_API`/`NEXT_PUBLIC_MC_URL`
  - `backend/src/server.js`: CORS origins no longer hardcode `76.13.179.86`; added `CORS_ORIGINS` env var for injecting extra allowed origins
  - `.env.example`: comprehensive documentation of all env vars including `DC1_HMAC_SECRET`, `CORS_ORIGINS`
- **Action required**: Set `BACKEND_URL=https://api.dcp.sa` in Vercel project settings once HTTPS is live

### DCP-13: HTTPS with nginx reverse proxy
- **Files**: `infra/nginx/dc1-api.conf` (NEW), `infra/nginx/setup-https.sh` (NEW), `backend/installers/daemon.ps1`, `backend/installers/daemon.sh`, `backend/installers/dc1-setup-helper.ps1`
- **What changed**:
  - `infra/nginx/dc1-api.conf`: nginx site config — HTTP→HTTPS redirect, port 443 http2, Let's Encrypt SSL (`api.dcp.sa`), Mozilla Intermediate TLS, HSTS, 60MB upload limit, 900s proxy timeout, WebSocket headers
  - `infra/nginx/setup-https.sh`: one-shot setup script — installs nginx+certbot, ACME webroot challenge, obtains cert, deploys config, sets up auto-renewal (systemd timer / cron fallback), opens ufw
  - Installer script defaults updated: `http://76.13.179.86:8083` → `https://api.dcp.sa`
- **Pre-requisite**: DNS `api.dcp.sa → 76.13.179.86` must be propagated before running setup-https.sh
- **Action required by Claude-Cowork**: Once DNS is live, run: `sudo bash infra/nginx/setup-https.sh api.dcp.sa admin@dcp.sa` on VPS

## [2026-03-17 23:26 UTC] Security Engineer — DCP-3: task_spec RCE fix + DCP-4: rate limit audit

- **Issues**: DCP-3 (Critical RCE), DCP-4 (Rate Limiting)
- **Files**: `backend/installers/dc1-daemon.py`, `backend/installers/dc1_daemon.py`, `backend/src/routes/jobs.js`, `backend/src/routes/providers.js`, `backend/src/server.js`
- **What changed**:
  - **DCP-3 (RCE)**: Daemon claimed HMAC verification but never implemented it. Added `HMAC_SECRET = "{{HMAC_SECRET}}"` constant to both daemon files, implemented `verify_task_spec_hmac()` using `hmac.compare_digest()`, added HMAC guard in `poll_and_execute()` that rejects and reports jobs with missing/invalid signatures
  - **DCP-3**: Backend now injects `HMAC_SECRET` into daemon at download time (`providers.js`)
  - **DCP-3**: Blocked raw Python `task_spec` from renter submissions (400 error with guidance). Removed raw-Python passthrough from template dispatch
  - **DCP-3**: Added job type whitelist (`ALLOWED_JOB_TYPES`) to reject unknown types at submission
  - **DCP-3**: Added provider key auth + job ownership check to `/api/jobs/verify-hmac`. Added `/api/jobs/verify-hmac-local` for legacy daemon fallback
  - **DCP-3**: Removed `DC1_ADMIN_TOKEN` from HMAC_SECRET fallback (secrets must not share roles); added startup warning if `DC1_HMAC_SECRET` not set
  - **DCP-4**: Existing limits were already in place (provider register, heartbeat, job submit, admin, general catch-all). Added missing specific limiters for `/api/renters/register` (5/IP/hour) and `/api/renters/topup` (10/IP/minute)
- **Breaking**: Providers must re-download daemon to get HMAC_SECRET injected. Existing deployed daemons will reject all jobs until re-downloaded. `DC1_HMAC_SECRET` must be set as env var before PM2 restart.
- **Action required by Claude-Cowork**: (1) Set `DC1_HMAC_SECRET=$(openssl rand -hex 32)` in VPS env (pm2 ecosystem config or .env). (2) Restart `dc1-provider-onboarding` with PM2. (3) Notify providers to re-download daemon.

## [2026-03-13 12:00 UTC] Claude-Cowork — Add Withdrawals nav to admin pages

- **Commit**: `3e128e0`
- **Files**: 10 admin page files updated (app/admin/page.tsx, fleet/page.tsx, jobs/page.tsx, providers/page.tsx, renters/page.tsx, security/page.tsx, finance/page.tsx, jobs/[id]/page.tsx, providers/[id]/page.tsx, renters/[id]/page.tsx)
- **What changed**:
  - Added WalletIcon SVG component definition to all 10 admin pages
  - Added Withdrawals nav item `{ label: 'Withdrawals', href: '/admin/withdrawals', icon: <WalletIcon /> }` positioned after Finance and before Security in navItems arrays
  - All pages now have consistent navigation with link to /admin/withdrawals
- **Impact**: Admin pages now display Withdrawals navigation link with wallet icon

## [2026-03-14 18:30 UTC] Claude-Cowork — Browser testing all dashboard features + nav fix

- **Commit**: `d985e88`
- **Files**: `app/renter/jobs/[id]/page.tsx`
- **What changed**:
  - Added GearIcon SVG and Settings nav item to renter job detail page sidebar (was missing from Phase 4 commit)
- **Testing completed** (all on dc1-platform.vercel.app):
  - Provider Dashboard: daemon status badge, 7-day earnings chart, pause/resume, stats — PASS
  - Provider Earnings: DashboardLayout, 4 tabs (Earnings/Job History/Daemon/Withdrawals), daily chart — PASS
  - Provider Jobs: job list with detail links — PASS
  - Provider Job Detail (/provider/jobs/59): job info, earnings breakdown (75/25 split) — PASS
  - Provider Settings: profile, API key mgmt, GPU prefs, notification preferences — PASS
  - Renter Dashboard: clean overview, no embedded playground, stats, GPU table, recent jobs — PASS
  - Renter Jobs: detail links, auto-refresh — PASS
  - Renter Job Detail (/renter/jobs/38): job info, error display, retry button — PASS
  - Renter Settings: profile, account summary, API key show/copy/rotate — PASS
  - Renter Analytics: stats, daily spending chart, job type breakdown, job outcomes — PASS
  - Renter Marketplace: filter, GPU listing, Settings nav — PASS
  - Renter Billing: add funds UI, Settings nav — PASS
  - Renter Playground: standalone auth (sessionStorage), LLM/image gen, model selector — PASS
- **Issue found**: dc1st.com is NOT connected to dc1-platform Vercel project (no domains configured). dc1st.com points to a separate landing page. App URL is dc1-platform.vercel.app
- **Impact**: Minor nav consistency fix; all dashboard features from improvement plan verified working

## [2026-03-14 12:00 UTC] Claude-Cowork — Phase 2+3: Job & Agent pages wired to real APIs

- **Commit**: `4c040ea`
- **Files changed**:
  - `app/jobs/page.tsx` — Rewrote to fetch from real `/api/dc1/jobs/active` + admin dashboard, DashboardLayout, split-view with sidebar job list + detail panel, 15s auto-refresh, cost in SAR, timeline
  - `app/jobs/submit/page.tsx` — Fixed import path from relative to `@/components/jobs/JobSubmitForm`
  - `app/agents/[id]/page.tsx` — Added Mission Control API integration: fetches live tasks per agent from MC `/api/tasks`, renders "Live Tasks" table with status badges, 30s auto-refresh, MC online/offline indicator
  - `app/agents/page.tsx` — Added aggregate stats row (Total Agents, Active Now, Tasks Done, Completion %)
  - `app/monitor/page.tsx` — Rewrote to ping real VPS API + Mission Control endpoints for health status, shows live platform stats
- **Breaking changes**: None
- **Impact**: Job tracker, agent detail, agent list, and system monitor now use real VPS/MC APIs instead of mock/non-existent endpoints

## [2026-03-15 10:00 UTC] Claude-Cowork — Security fix + support form + provider consolidation

- **Commit**: `f53d7a7`
- **Files changed**:
  - `app/intelligence/page.tsx` — Removed hardcoded admin token, uses `localStorage.getItem('dc1_admin_token')` + 401 redirect
  - `app/security/page.tsx` — Same admin token fix + 401 handling on flag action
  - `app/connections/page.tsx` — Same admin token fix
  - `app/jobs/page.tsx` — Same admin token fix
  - `app/monitor/page.tsx` — Same admin token fix
  - `app/support/page.tsx` — Added contact form (name, email, category, message) with API fallback to mailto
  - `app/provider-onboarding/page.tsx` — Replaced 469-line duplicate wizard with redirect to `/provider/register`
- **Breaking changes**: Internal MC pages now require admin login (localStorage token) — no more anonymous access via hardcoded token
- **Security**: Removed hardcoded admin token `9ca7c...` from 5 client-side files. This was a critical exposure risk.
- **Impact**: All internal pages now use proper auth flow; support page has working contact form; provider registration consolidated to single entry point

## [2026-03-15 11:00 UTC] Claude-Cowork — Add Analytics to renter nav + shared API utility

- **Commit**: `1948bb1`
- **Files changed**:
  - `lib/api.ts` — NEW: shared API utility (getApiBase, getMcBase, getMcToken, getAdminToken, getProviderKey, getRenterKey)
  - `app/renter/page.tsx` — Added Analytics nav item with ChartIcon
  - `app/renter/marketplace/page.tsx` — Same
  - `app/renter/jobs/page.tsx` — Same
  - `app/renter/jobs/[id]/page.tsx` — Same
  - `app/renter/settings/page.tsx` — Same
  - `app/renter/billing/page.tsx` — Same (inline SVG variant)
  - `app/renter/analytics/page.tsx` — Added Analytics to its own nav
- **Breaking changes**: None
- **Impact**: Analytics page now accessible from renter sidebar navigation across all renter pages; shared API utility created for future consolidation

