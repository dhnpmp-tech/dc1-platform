# DC1 Platform — Agent Briefing Document
> Last updated: 2026-03-07 | Branch: `main` | Commit: 1b05b27

## What Is DC1

DC1 is a GPU compute marketplace for Saudi Arabia. Providers register their NVIDIA GPUs, install a Python daemon, and earn SAR. Renters submit compute jobs (LLM inference, training, rendering) that run on provider hardware. DC1 takes a 25% fee; providers earn 75%.

Currency: SAR (Saudi Riyal). Internal billing in **halala** (1 SAR = 100 halala).

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│  Next.js 14     │───▶│  Express Backend      │◀───│  Python Daemon   │
│  Vercel (UI)    │    │  VPS 76.13.179.86     │    │  Provider GPU    │
│  Port: Vercel   │    │  Port: 8083           │    │  Heartbeat 30s   │
└─────────────────┘    └──────────────────────┘    └──────────────────┘
                              │
                       ┌──────┴──────┐
                       │  SQLite DB  │
                       │  + Supabase │
                       │  sync bridge│
                       └─────────────┘
```

## GitHub Repo

**URL**: `https://github.com/dhnpmp-tech/dc1-platform`
**Main branch**: `main`
**Working branch**: `feat/platform-hardening`

## Key Files

### Backend (Express.js — `/backend/src/`)
| File | Purpose |
|------|---------|
| `server.js` | Express app setup, CORS lockdown, rate limiting, route mounting, recovery/timeout intervals |
| `db.js` | SQLite schema — providers, jobs, renters tables + migrations |
| `routes/providers.js` | Provider register, heartbeat, readiness, self-service (pause/resume/preferences) |
| `routes/jobs.js` | Job submit (renter auth), complete, cancel, assigned (daemon poll), HMAC verify, timeout enforcement |
| `routes/renters.js` | **NEW** — Renter register, profile (/me), available-providers listing |
| `routes/admin.js` | Admin dashboard, provider management, job management |
| `services/supabase-sync.js` | SQLite → Supabase periodic sync |
| `services/recovery-engine.js` | Stale heartbeat detection, provider disconnect recovery |
| `services/fallback-loop.js` | Bottleneck detection + scheduling |

### Frontend (Next.js 14 — `/app/`)
| File | Purpose |
|------|---------|
| `app/renter/page.tsx` | **REWRITTEN** — Fetches from Express backend, API key login, provider marketplace, job history |
| `app/jobs/submit/page.tsx` | Job submission form |
| `app/provider/page.tsx` | Provider dashboard (earnings, GPU status) |
| `app/admin/page.tsx` | Admin panel |
| `app/budget/page.tsx` | Budget monitoring (mission control) |
| `app/agents/page.tsx` | Agent monitoring (mission control) |

### Daemon & Installers (`/backend/installers/`)
| File | Purpose |
|------|---------|
| `dc1_daemon.py` | Python daemon template — heartbeats, GPU detection, job polling, task execution |
| `dc1-setup-helper.ps1` | Windows setup: Python install, pip, scheduled task, dashboard shortcut |
| `dc1-provider-Windows.nsi` | NSIS installer (6-page GUI, no admin, LOCALAPPDATA) |
| `dc1-provider-setup.sh` | Linux/Mac setup script |

## Data Flow Architecture

```
WRITES (Express backend is source of truth):
  Provider register → SQLite providers table
  Heartbeat         → SQLite providers table (status, GPU metrics)
  Job submit        → SQLite jobs table (renter auth via x-renter-key)
  Job complete      → SQLite jobs table (billing calculated)

SYNC (SQLite → Supabase, every 30s):
  Phase 1: providers → users + machines + machine_metrics
  Phase 2: jobs     → rentals + transactions

READS (Frontend reads from Supabase for speed + real-time):
  Renter dashboard  → Supabase machines table (real-time subscription)
  Rental history    → Supabase rentals table (joined with machines)
  Renter auth/profile → Express backend /api/renters/me (API key check)
```

The sync bridge (`supabase-sync.js`) maintains a providerMap cache that maps SQLite `provider.id` → Supabase `{ userId, machineId }` UUIDs. This mapping is used in Phase 2 to link jobs to the correct Supabase rentals.

**RLS Policies** (Supabase Row Level Security):
- `machines_read_public`: anon can SELECT where status = 'active' or 'verified'
- `rentals_read_own`: anon can SELECT all rentals (filtered by renter_id in query)
- `transactions_read_own`: anon can SELECT all transactions

## What Was Just Built (feat/platform-hardening)

### 1. Rate Limiting (`server.js`)
- Registration: 5/hr per IP
- Job submit: 30/min per IP
- Admin: 100/min per IP
- General API: 300/min per IP
- Uses `express-rate-limit` package

### 2. Renter Authentication (`jobs.js` + `renters.js`)
- New `renters` table in SQLite (name, email, api_key, balance, spending)
- `requireRenter` middleware on job submit — validates `x-renter-key` header
- `POST /api/renters/register` — creates renter with `dc1-renter-` prefixed key
- `GET /api/renters/me?key=` — renter profile + recent jobs
- `GET /api/renters/available-providers` — lists online providers (public endpoint)

### 3. HMAC Task Signing (`jobs.js`)
- `signTaskSpec()` — SHA-256 HMAC on task_spec content
- Secret: `DC1_HMAC_SECRET` env var (falls back to `DC1_ADMIN_TOKEN` or random)
- `GET /api/jobs/verify-hmac?job_id=X&hmac=Y` — daemon verifies before executing
- Prevents task_spec tampering between submission and execution

### 4. Job Timeout Enforcement (`jobs.js`)
- New columns: `max_duration_seconds` (default 600, max 3600), `timeout_at`
- `enforceJobTimeouts()` runs every 30s via `setInterval`
- Auto-fails running jobs past timeout_at with `status = 'failed'`

### 5. Renter Dashboard — Hybrid Supabase/Express (`app/renter/page.tsx`)
- **Reads from Supabase** `machines` table with real-time postgres_changes subscription
- **Auth via Express** `/api/renters/me` — validates API key, returns profile
- **Rental history from Supabase** `rentals` table (joined with `machines` for GPU type)
- GPU cards show: utilization %, 30-day uptime, hourly SAR rate, online/offline status
- Offline GPUs shown but disabled ("Currently Offline" button)
- API key login flow with sessionStorage persistence

### 7. Supabase Sync Bridge Upgrade (`supabase-sync.js`)
- Phase 1 (existing): providers → users + machines + machine_metrics
- Phase 2 (NEW): jobs → rentals + transactions
  - Maps SQLite jobs to Supabase rentals (with status, cost, duration, tags)
  - Creates transactions for completed jobs linked to renter wallets
  - Only syncs recent/active jobs (last 24h + running) to avoid backlog
  - Caches provider_id → Supabase UUID mapping for cross-table lookups

### 6. Env Var Cleanup
- `NEXT_PUBLIC_DC1_API` — client-side backend URL
- `NEXT_PUBLIC_MC_URL` — mission control URL
- `BACKEND_URL` — server-side backend URL (already existed)
- Hardcoded IPs remain as fallbacks only

## Database Schema (SQLite)

### providers
```
id, name, email, api_key, gpu_model, gpu_name_detected, gpu_vram_mib,
status (online/offline/disconnected), location, reliability_score,
total_earnings, total_jobs, is_paused, run_mode, scheduled_start,
scheduled_end, last_heartbeat, daemon_version, current_job_id
```

### jobs
```
id, job_id, provider_id, renter_id, job_type, status (pending/running/completed/failed/cancelled),
submitted_at, started_at, completed_at, duration_minutes, cost_halala,
actual_duration_minutes, actual_cost_halala, provider_earned_halala, dc1_fee_halala,
gpu_requirements (JSON), task_spec, task_spec_hmac, result, error,
max_duration_seconds, timeout_at, picked_up_at, notes, created_at
```

### renters (NEW)
```
id, name, email, api_key, organization, status, balance_halala,
total_spent_halala, total_jobs, created_at, updated_at
```

## Billing Model

- Rates in halala/minute: llm-inference=15, training=25, rendering=20, default=10
- 75/25 split: provider gets floor(75%), DC1 gets remainder
- Job completion recalculates cost based on actual elapsed time, not estimate
- Provider earnings stored in SAR (halala/100)

## What Was Just Built (Gate 0 — commit eb15dd9)

### 8. Renter Registration Page (`/renter/register`)
- Form → `POST /api/renters/register` with name, email, organization
- Shows API key on success with copy button
- "Go to Dashboard" button stores key in sessionStorage + redirects to `/renter`
- Link to `/renter` for existing users

### 9. Job Submit Form Auth + Task Spec (`components/jobs/JobSubmitForm.tsx`)
- Auth gate: must log in with renter API key before seeing form
- Passes `x-renter-key` header on job submit fetch
- Collapsible "Advanced: Task Specification (JSON)" field for task_spec
- GPU availability fetches from `/api/renters/available-providers` (Express backend)

### 10. Provider Daemon System
**Backend endpoints added to `providers.js`:**
- `POST /api/providers/readiness` — daemon reports CUDA/PyTorch/VRAM checks
- `GET /api/providers/:api_key/jobs` — daemon polls for pending jobs (marks running, sets timeout)
- `POST /api/providers/job-result` — daemon submits result + billing calculated
- `GET /api/providers/download/daemon` — serves `dc1-daemon.py` with injected API key
- `GET /api/providers/download/setup` — OS-specific setup script with injected key

**Backend endpoint added to `jobs.js`:**
- `POST /api/jobs/test` — admin creates test benchmark job for a specific provider

**New: `dc1-daemon.py`** (~300 lines, single-file Python daemon):
- GPU detection via nvidia-smi subprocess
- Readiness checks: CUDA available? PyTorch? VRAM >= 4GB?
- Heartbeat thread (every 30s → POST /api/providers/heartbeat)
- Job poll thread (every 10s → GET /api/providers/:key/jobs)
- GPU benchmark: PyTorch matmul → GFLOPS measurement
- HMAC verification of task_spec before execution
- Logging to ~/dc1-provider/logs/daemon.log
- CLI: `--key` and `--url` overrides

**New: `dc1-setup-unix.sh`** — Linux/Mac one-liner installer:
- Checks/installs Python 3, pip, requests, PyTorch
- Downloads daemon from backend with injected API key
- Creates systemd service (Linux) or launchd agent (Mac)
- Enables + starts service automatically

**New: `dc1-setup-windows.ps1`** — Windows one-liner installer:
- Checks/installs Python via winget
- Installs pip packages + PyTorch
- Downloads daemon, creates config
- Creates Windows Scheduled Task (run at logon, auto-restart)

### 11. Updated Provider Onboarding HTML
- Post-registration now shows one-liner install commands (not broken .exe/.deb links)
- Linux: `curl -sL HOST/api/providers/download/setup?key=KEY&os=linux | sudo bash`
- Windows: `powershell -c "irm 'HOST/api/providers/download/setup?key=KEY&os=windows' | iex"`
- Real-time status polling (every 5s) with visual progress: Registered → Installing → Online → Ready

### 12. DB Schema Extensions
- `providers.readiness_status` (pending/checking/ready/failed)
- `providers.readiness_details` (JSON: cuda, pytorch, vram checks)
- `providers.daemon_version` (e.g. "1.0.0")
- `providers.current_job_id` (tracks active job)

## What Was Just Built (commit 763afa4)

### 13. CORS Lockdown (`server.js`)
- Replaced `cors()` wildcard with origin whitelist
- Allowed origins: `dc1-platform.vercel.app`, `dc1-platform-dc11.vercel.app`, VPS IPs, localhost:3000
- Vercel preview deploys allowed via regex (`*.vercel.app`)
- No-origin requests allowed (daemon heartbeat/polls, curl, server-to-server)
- Blocked origins get 500 error + `[cors] Blocked origin: X` log

### 14. NEXT_PUBLIC_DC1_API Vercel Env Var
- Set `NEXT_PUBLIC_DC1_API=http://76.13.179.86:8083` in Vercel project settings
- Applies to all environments (production, preview, development)
- Redeployment triggered — frontend now uses proper env var instead of hardcoded fallback

### 15. Task Spec Serialization Fix (`jobs.js`)
- Fixed bug: `task_spec` passed as JSON object was stored as `[object Object]`
- Now stringifies objects before HMAC signing and DB insert
- Ensures HMAC verification works correctly for daemon

### 16. E2E Pipeline Verified
Full test results:
- ✅ Health check — `ok`
- ✅ Renter registration — creates renter + returns API key
- ✅ Renter `/me` — returns profile + job history
- ✅ Available providers — lists 2 online GPUs (RTX 3060 Ti + RTX 4090)
- ✅ Job submit (renter auth) — creates job with HMAC-signed task_spec
- ✅ Admin test benchmark job — creates pending job for daemon pickup
- ✅ CORS blocking — unauthorized origins rejected, Vercel domains allowed

## What Was Just Built (commit 1b05b27 — Gate 1 Billing)

### 17. Pre-Pay Billing (`jobs.js`)
- Balance check on job submit: rejects with 402 if `balance_halala < cost_halala`
- Upfront deduction: estimated cost deducted from renter balance at submit time
- Settlement on job completion (`providers.js` job-result handler):
  - Refunds difference if actual cost < estimated
  - Charges extra if actual > estimated
  - Updates renter `total_spent_halala` and `total_jobs`

### 18. Renter Top-Up & Balance (`renters.js`)
- `POST /api/renters/topup` — accepts `amount_sar` or `amount_halala`, max 1000 SAR per tx
- `GET /api/renters/balance` — returns balance, held amount (running jobs), available, total spent
- In production: will connect to Stripe/Tap payment gateway

### 19. Provider Earnings & Withdrawal (`providers.js`)
- `GET /api/providers/earnings` — shows total earned, pending withdrawals, withdrawn, available SAR
- `POST /api/providers/withdraw` — creates withdrawal request (min 10 SAR, bank_transfer default)
- New `withdrawals` table: withdrawal_id, provider_id, amount_sar, payout_method, status, timestamps

### 20. Heartbeat Rate Limiting (`server.js`)
- 4 requests per minute per IP (daemon sends every 30s = 2/min normally)
- Prevents heartbeat flooding from misconfigured or malicious daemons

### 21. E2E Billing Verified
- ✅ Renter top-up (50 SAR → 5000 halala balance)
- ✅ Job submit deducts estimated cost (750 halala for 30min training)
- ✅ Balance shows correct deduction (5000 → 4250)
- ✅ Insufficient balance rejected with 402 + shortfall details
- ✅ Provider earnings shows 0.22 SAR earned
- ✅ Withdrawal below minimum (10 SAR) correctly rejected

## What Still Needs Building

### High Priority (Gate 1 remaining)
1. **Docker isolation** — container-based job execution with GPU passthrough (`--gpus device=0`)
2. **Payment gateway integration** — Stripe/Tap for real SAR deposits + provider payouts

### Medium Priority
3. **Admin token rotation** — expiring admin tokens instead of static
4. **Job queue** — multiple pending jobs per provider, FIFO execution
5. **WebSocket live updates** — replace polling with real-time job status
6. **Installer auto-update** — daemon self-update mechanism

### Lower Priority
7. **Provider reputation system** — reliability scoring based on uptime + job completion
8. **Renter API key rotation** — allow renters to regenerate keys
9. **Multi-GPU provider support** — parallel job execution on multi-GPU rigs

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `BACKEND_URL` | Vercel (server) | Express backend URL |
| `NEXT_PUBLIC_DC1_API` | Vercel (client) | Express backend URL for browser fetch |
| `NEXT_PUBLIC_MC_URL` | Vercel (client) | Mission control URL (port 8084) |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Supabase publishable key |
| `DC1_HMAC_SECRET` | VPS backend | HMAC signing secret for task_spec |
| `DC1_ADMIN_TOKEN` | VPS backend | Admin API auth token |
| `DC1_PROVIDER_PORT` | VPS backend | Express port (default 8083) |

## API Endpoints Reference

### Provider Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/providers/register` | None (rate limited) | Register new provider |
| POST | `/api/providers/heartbeat` | api_key in body | 30s heartbeat with GPU metrics |
| GET | `/api/providers/status/:key` | API key in URL | Provider status check |
| POST | `/api/providers/pause` | api_key in body | Pause provider |
| POST | `/api/providers/resume` | api_key in body | Resume provider |
| POST | `/api/providers/readiness` | api_key in body | Daemon reports system checks |
| GET | `/api/providers/:key/jobs` | API key in URL | Daemon polls for pending jobs |
| POST | `/api/providers/job-result` | api_key in body | Daemon submits job result |
| GET | `/api/providers/download/daemon` | key query param | Serve dc1-daemon.py with injected key |
| GET | `/api/providers/download/setup` | key+os query params | OS-specific setup script |
| GET | `/api/providers/earnings` | x-provider-key header | Check earnings balance |
| POST | `/api/providers/withdraw` | api_key in body | Request earnings withdrawal |

### Job Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/jobs/submit` | x-renter-key header | Submit job to provider |
| POST | `/api/jobs/test` | x-admin-token header | Create test benchmark job |
| GET | `/api/jobs/assigned?key=` | Provider API key | Daemon polls for assigned jobs |
| POST | `/api/jobs/:id/result` | None | Daemon posts job result |
| POST | `/api/jobs/:id/complete` | None | Manual job completion |
| POST | `/api/jobs/:id/cancel` | None | Cancel a job |
| GET | `/api/jobs/:id` | None | Get job details |
| GET | `/api/jobs/active` | None | List active jobs |
| GET | `/api/jobs/verify-hmac` | None | Verify task_spec HMAC |

### Renter Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/renters/register` | None | Register new renter |
| GET | `/api/renters/me?key=` | Renter API key | Renter profile + jobs |
| GET | `/api/renters/available-providers` | None | List online GPUs |
| POST | `/api/renters/topup` | x-renter-key header | Add balance (amount_sar or amount_halala) |
| GET | `/api/renters/balance` | x-renter-key header | Check balance, held, available |

### Admin Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/dashboard` | DC1_ADMIN_TOKEN | System overview |
| GET | `/api/admin/providers` | DC1_ADMIN_TOKEN | All providers |
| GET | `/api/admin/jobs/:id` | DC1_ADMIN_TOKEN | Job details |

## Provider Daemon Lifecycle

```
registered → [downloads installer via one-liner] → online (heartbeating) → ready (passed CUDA/PyTorch/VRAM checks) → executing (running job) → idle (waiting for next job)
```

The daemon (`dc1-daemon.py`) is a single Python file that runs as a background service:
1. Detects GPU via `nvidia-smi`
2. Runs readiness checks → reports to backend
3. Starts heartbeat thread (30s interval)
4. Starts job poll thread (10s interval)
5. When job found: executes GPU benchmark (PyTorch matmul) → submits result

## Git Commit History (recent)

| Commit | Description |
|--------|-------------|
| `1b05b27` | Gate 1: billing, withdrawal, heartbeat rate limit |
| `763afa4` | CORS lockdown + task_spec serialization fix |
| `eb15dd9` | Gate 0 daemon system: readiness, job execution, installer scripts |
| `ae8c5ee` | Renter registration page + job submit auth |
| `d35bc57` | Fix rental status enum mapping |
| `da15dce` | Sync bridge upgrade: jobs→rentals, renter page hybrid Supabase |
| `69427cc` | Rate limiting, renter auth, HMAC signing, job timeouts, dashboard rewrite |

## Development Notes

- SQLite migrations use `ALTER TABLE ... ADD COLUMN` wrapped in try/catch (SQLite-safe)
- The `renters` table is created with `CREATE TABLE IF NOT EXISTS` (not a migration)
- The HMAC secret auto-generates if no env var is set — BUT this means it changes on restart, invalidating existing signatures. Set `DC1_HMAC_SECRET` in production.
- Job timeout enforcement and recovery engine both run on 30s intervals — they don't conflict but could be merged
- The renter page uses `sessionStorage` for API key persistence (cleared on tab close — intentional for security)
- Frontend `NEXT_PUBLIC_*` env vars are baked at build time on Vercel — must be set before deploy
