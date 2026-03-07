# DC1 Platform — Agent Briefing Document
> Last updated: 2026-03-07 | Branch: `main` | Commit: be91b72

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
| `routes/jobs.js` | Job submit (renter auth), complete, cancel, assigned (daemon poll), HMAC verify, timeout enforcement, **image gen templates**, **job output endpoint** |
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
  Phase 1:  providers    → users + machines + machine_metrics
  Phase 2:  jobs         → rentals + transactions
  Phase 3a: renters      → users (type='renter') + wallets (balance, held, spent)
  Phase 3b: provider $   → provider wallets (earned, withdrawn, pending, available)
  Phase 3c: withdrawals  → Supabase withdrawals table

READS (Frontend reads from Supabase for speed + real-time):
  Renter dashboard  → Supabase machines table (real-time subscription)
  Rental history    → Supabase rentals table (joined with machines)
  Wallet balances   → Supabase wallets table (renter + provider balances)
  Withdrawals       → Supabase withdrawals table (provider payouts)
  Renter auth/profile → Express backend /api/renters/me (API key check)
```

The sync bridge (`supabase-sync.js`) maintains two caches:
- `providerMap`: SQLite `provider.id` → Supabase `{ userId, machineId }` UUIDs (used in Phase 2 + 3b)
- `renterMap`: SQLite `renter.id` → Supabase `{ userId, walletId }` UUIDs (used in Phase 3a)

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

- Rates in halala/minute: llm-inference=15, training=25, rendering=20, image_generation=20, default=10
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

## What Was Just Built (commit 0b14596 — Supabase Billing Sync)

### 22. Supabase Schema Migrations (applied via MCP)
- Added `rental` + `withdrawal` + `completed` to `transaction_type` enum
- Added `completed` to `transaction_status` enum
- Created `withdrawals` table in Supabase:
  - `id` UUID PK, `provider_id` UUID FK→users, `sqlite_withdrawal_id` TEXT UNIQUE
  - `amount_sar` NUMERIC, `amount_usd` GENERATED (×0.27), `payout_method` enum, `status` payout_status enum
  - RLS: users see own withdrawals, service_role full access
- Added wallet tracking columns: `total_earned_sar`, `total_withdrawn_sar`, `pending_withdrawal_sar`, `total_spent_sar`, `total_jobs`, `wallet_type`, `updated_at`

### 23. Sync Bridge Phase 3 (`supabase-sync.js`)
**Phase 3a — Renter → Wallet Sync:**
- Finds/creates Supabase user for each SQLite renter (type='renter', or 'both' if also provider)
- Finds/creates wallet record per renter
- Syncs: `balance_sar` (from halala/100), `hold_sar` (sum of running job costs), `total_spent_sar`, `total_jobs`
- Maintains `renterMap` cache for cross-referencing

**Phase 3b — Provider Wallet Sync:**
- Creates provider wallets separate from renter wallets (wallet_type='provider' or 'both')
- Syncs: `total_earned_sar`, `total_withdrawn_sar` (completed withdrawals), `pending_withdrawal_sar`
- Calculates available balance: earned - withdrawn - pending

**Phase 3c — Withdrawal Sync:**
- Syncs SQLite `withdrawals` table → Supabase `withdrawals` table
- Maps SQLite withdrawal_id → Supabase `sqlite_withdrawal_id` (unique key for upsert)
- Maps status to `payout_status` enum: pending/processing/completed/failed

### 24. E2E Supabase Sync Verified
- ✅ Sync bridge runs with 0 errors across all 3 phases
- ✅ 30 provider wallets synced (Yazan: 0.22 SAR, Peter: 0.20 SAR)
- ✅ 7 renter wallets synced (E2E test bot: 42.50 SAR balance = 4250 halala)
- ✅ Wallet totals: 30 provider wallets (0.42 SAR earned), 7 renter wallets (33,792.50 SAR balance)
- ✅ Sync cycle: ~10s for 30 providers + 7 jobs + 7 renters + 30 wallets + 0 withdrawals

## Supabase Tables (Project: rwxqcqgjszvbwcyjfpec)

| Table | Rows | Purpose |
|-------|------|---------|
| `users` | 37 | Providers + renters (type: provider/renter/both) |
| `machines` | 35 | GPU machines linked to provider users |
| `machine_metrics` | 5396 | Time-series GPU utilization, temp, memory |
| `rentals` | 10 | Job records (mapped from SQLite jobs) |
| `wallets` | 37 | Renter balances + provider earnings |
| `transactions` | 3 | Completed job payments |
| `withdrawals` | 0 | Provider payout requests |
| `ratings` | 2 | Provider ratings |
| `audit_logs` | 0 | System audit trail |
| `support_tickets` | 0 | Support requests |
| `referrals` | 0 | Referral program |

### Supabase Enums
| Enum | Values |
|------|--------|
| `rental_status` | pending, confirmed, running, completed, cancelled, disputed |
| `transaction_type` | topup, earning, payout, refund, fee, dispute, rental, withdrawal |
| `transaction_status` | pending, confirmed, failed, cancelled, completed |
| `payment_method` | stripe, moyasar, bank_transfer, wallet |
| `payout_status` | pending, processing, completed, failed |
| `user_type` | provider, renter, both |

## What Was Just Built (commits d9e154d + ce5a348 — Image Gen + Docker)

### 25. Image Generation Job Templates (`jobs.js`)
- Added `image_generation: 20` halala/min to COST_RATES
- `generateImageGenScript(params)` — auto-generates full Stable Diffusion Python script from JSON:
  - Input: `{prompt, negative_prompt, steps, width, height, seed, model}`
  - Output: Full Python script using `diffusers` + `StableDiffusionPipeline`
  - Result: base64 PNG via `DC1_RESULT_JSON:` protocol
- `generateLlmInferenceScript(params)` — auto-generates transformers script:
  - Input: `{prompt, max_tokens, model, temperature}`
  - Output: Full Python script using HuggingFace `transformers`
- `JOB_TEMPLATES` map: job_type → script generator function
- Job submit auto-generates task_spec when job_type matches a template
- Renters submit simple JSON `{"prompt":"...", "steps":20}` — backend generates the Python code

### 26. Job Output Endpoint (`GET /api/jobs/:id/output`)
- Parses `DC1_RESULT_JSON:{...}` from job result string
- Image results: serves raw PNG (`Content-Type: image/png`) or JSON with base64 (based on `Accept` header)
- Text results: structured JSON with prompt, response, tokens_per_second
- Includes billing info (actual_cost_halala, actual_cost_sar)
- Express body limit increased to 10mb for base64 image payloads

### 27. Docker-Based Job Execution — Daemon v2.0 (`dc1_daemon.py`)
**Execution modes:**
- **Docker mode** (default when Docker + NVIDIA CT detected): `docker run --gpus all --rm -v job_dir:/dc1/job dc1/sd-worker python /dc1/job/task.py`
- **Bare-metal fallback** (when Docker unavailable): direct subprocess execution (legacy)

**Key improvements:**
- 5 MB stdout capture (was 1 KB) for base64 image data
- 10 min job timeout (was 5 min) for image generation
- Docker health check on startup (cached for session)
- `config.json` → `force_bare_metal: true` option for debugging
- Container resource limits: `--memory 16g --shm-size 2g`
- Background thread for job execution (heartbeats continue during jobs)

**Docker image mapping:**
| Job Type | Docker Image |
|----------|-------------|
| `image_generation` | `dc1/sd-worker:latest` |
| `llm-inference` | `dc1/llm-worker:latest` |
| `training` | `dc1/train-worker:latest` |
| `rendering` | `dc1/render-worker:latest` |
| `benchmark` | `dc1/base-worker:latest` |

### 28. Docker Worker Images (`backend/docker/`)
- `Dockerfile.base` — CUDA 12.2 + Python 3 + PyTorch (cu121) + common ML libs
- `Dockerfile.sd-worker` — extends base + diffusers + SD 2.1 model pre-cached (~2.5 GB)
- `Dockerfile.llm-worker` — extends base + transformers + bitsandbytes + Phi-2 pre-cached (~5.5 GB)
- `build-images.sh` — builds all 3 images + optional registry push (`DC1_REGISTRY` env var)

### 29. Installer Scripts v2.0 (Linux + Windows)
**Linux/Mac (`dc1-setup-unix.sh`)** — 8-step setup:
1. Python 3
2. pip packages (requests, psutil)
3. NVIDIA driver check
4. Docker install (get.docker.com)
5. NVIDIA Container Toolkit install + configure
6. Pre-pull NVIDIA CUDA base image
7. Download daemon + config
8. Create systemd/launchd service

**Windows (`dc1-setup-windows.ps1`)** — 8-step setup:
1. Python 3 (winget)
2. pip packages
3. NVIDIA driver check
4. Docker Desktop (winget)
5. GPU passthrough test (WSL 2 backend)
6. Pre-pull base images
7. Download daemon + config
8. Windows Scheduled Task

### 30. E2E Verification
- ✅ VPS deployed — PM2 process 5 restarted, port 8083
- ✅ Health check — `status: "ok"`
- ✅ Job submit → `"Provider is not online"` (correct — no daemon heartbeating)
- ✅ Job output → `"Job not found"` for non-existent job (correct 404)
- ✅ Supabase sync running — 30 providers, 7 jobs, 0 errors

## What Was Just Built (commit be91b72 — QA Security Fixes)

### 31. Security: Code Injection Prevention (`jobs.js`)
- **Model whitelist** — `ALLOWED_SD_MODELS` (5 models) and `ALLOWED_LLM_MODELS` (5 models)
  - Unknown models fall back to defaults (SD 2.1 base / Phi-2)
  - Prevents `model: "'; import os; os.system('rm -rf /'); '"` injection
- **pyEscape()** function — sanitizes strings for Python single-quoted string embedding:
  1. Escapes backslashes first (`\` → `\\`)
  2. Then single quotes (`'` → `\'`)
  3. Then newlines (`\n` → space, `\r` → removed)
  - Order matters: backslashes MUST be escaped before quotes

### 32. Billing Rate Fix (`jobs.js`)
- `/api/jobs/:id/result` endpoint had hardcoded ternary that missed `image_generation`
- Was: `training=25, rendering=20, else=15` (image_generation fell to 15)
- Now: `COST_RATES[job.job_type] || COST_RATES['default']` (image_generation=20)

### 33. Route Ordering Fix (`jobs.js`)
- `GET /api/jobs/verify-hmac` was defined AFTER `GET /api/jobs/:job_id`
- Express matched "verify-hmac" as a `job_id` parameter → 404
- Moved `/verify-hmac` and `/active` before all `/:job_id` parameterized routes

### 34. Python f-string Variable Fix (`jobs.js`)
- Image gen script had `f"[dc1] Generating {width}x${height}"`
- `{width}` was a Python f-string reference to undefined variable
- Fixed to `${width}x${height}` (both JS template substitutions)

### 35. Daemon Docker Cache Fix (`dc1_daemon.py`)
- Startup `check_docker()` call didn't assign to `_docker_status` global
- First heartbeat's `get_gpu_info()` → `is_docker_available()` would re-run full Docker check
- Fixed: `_docker_status = check_docker()` at startup

### 36. VPS Deployment Verified
- QA fixes deployed to VPS (PM2 process 5 restarted)
- Health check confirmed: `{"status":"ok","timestamp":"2026-03-07T10:09:03.235Z"}`
- All 3 files updated: jobs.js (80 lines changed), dc1_daemon.py (8 lines), agent briefing

## E2E Test Scenario: Image Generation Pipeline

### Best Test: Renter Submits Image Gen → Provider Daemon Executes → Output Retrieved

**Prerequisites:**
1. A provider must be registered and have a daemon heartbeating (status: `online`)
2. A renter must be registered with sufficient balance (at least 200 halala for ~10 min job)
3. Provider machine needs: NVIDIA GPU with ≥6GB VRAM, Python 3, PyTorch, diffusers library
4. If Docker mode: Docker + NVIDIA Container Toolkit + `dc1/sd-worker:latest` image built

**Step-by-step test flow:**

```
1. RENTER SETUP
   POST /api/renters/register
   Body: {"name":"Test Renter","email":"test@dc1.sa"}
   → Save the api_key returned

   POST /api/renters/topup
   Header: x-renter-key: <key>
   Body: {"amount_sar": 50}
   → Balance now 5000 halala

2. PROVIDER SETUP (on GPU machine)
   # Option A: Run installer one-liner
   curl -sL "http://76.13.179.86:8083/api/providers/download/setup?key=PROVIDER_KEY&os=linux" | sudo bash

   # Option B: Run daemon directly (for testing)
   curl -sL "http://76.13.179.86:8083/api/providers/download/daemon?key=PROVIDER_KEY" -o dc1-daemon.py
   python3 dc1-daemon.py

   → Wait for heartbeat to appear (check provider status)
   GET /api/providers/status/PROVIDER_KEY
   → Should show: status="online", gpu_name="RTX ...", daemon_version="2.0.0"

3. SUBMIT IMAGE GENERATION JOB
   POST /api/jobs/submit
   Header: x-renter-key: <renter_key>
   Body: {
     "provider_id": "<provider_id>",
     "job_type": "image_generation",
     "params": {
       "prompt": "A futuristic cityscape of Riyadh at sunset, cyberpunk style",
       "negative_prompt": "blurry, low quality",
       "steps": 20,
       "width": 512,
       "height": 512,
       "seed": 42
     },
     "duration_minutes": 10
   }
   → Returns: job_id, status="pending", cost_halala (deducted from balance)
   → Backend auto-generates full SD Python script via generateImageGenScript()

4. DAEMON PICKS UP JOB (automatic, within 30s)
   → Daemon polls GET /api/jobs/assigned?key=PROVIDER_KEY
   → Receives job with task_spec (auto-generated Python script)
   → Executes via Docker: docker run --gpus all dc1/sd-worker python /dc1/job/task.py
   → Or bare-metal: python3 _dc1_task_<id>.py
   → Script loads SD model, generates image, outputs DC1_RESULT_JSON:{base64 PNG}

5. RESULT REPORTED (automatic)
   → Daemon POST /api/jobs/<id>/result with stdout (up to 5MB base64 image)
   → Backend parses DC1_RESULT_JSON, calculates billing, settles balance

6. FETCH OUTPUT
   GET /api/jobs/<job_id>/output
   Accept: application/json
   → Returns: {"type":"image","format":"png","data":"base64...","billing":{...}}

   GET /api/jobs/<job_id>/output
   Accept: image/png
   → Returns: raw PNG binary (viewable in browser)

7. VERIFY BILLING
   GET /api/renters/balance
   Header: x-renter-key: <key>
   → Balance should be: 5000 - actual_cost_halala (refund if faster than estimate)

   GET /api/providers/earnings
   Header: x-provider-key: <provider_key>
   → Should show earned amount = 75% of job cost
```

**Current blocker:** No provider is currently heartbeating with an active daemon. To run this test, you need a machine with an NVIDIA GPU to run the daemon. Alternatively, you can simulate the daemon's behavior by manually calling the API endpoints in sequence.

**Quick smoke test (no GPU needed):**
```
# 1. Submit job (will fail with "Provider not online" if no daemon — that's correct)
curl -X POST http://76.13.179.86:8083/api/jobs/submit \
  -H "Content-Type: application/json" \
  -H "x-renter-key: dc1-renter-d1f00fc37ee3a0898b2dc88f33bf54b3" \
  -d '{"provider_id":"test","job_type":"image_generation","params":{"prompt":"A red sports car"},"duration_minutes":5}'

# 2. Check output endpoint (returns 404 — correct for non-existent job)
curl http://76.13.179.86:8083/api/jobs/nonexistent/output

# 3. Health check
curl http://76.13.179.86:8083/api/health
```

## What Still Needs Building

### High Priority (Gate 1 remaining)
1. **Get a provider daemon online** — Need at least one GPU machine running the daemon to test full E2E flow (image gen, billing settlement)
2. **Payment gateway integration** — Stripe/Tap for real SAR deposits + provider payouts
3. **Build + push Docker images** — run `build-images.sh` on a machine with GPU + Docker, push to GHCR

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
| `SUPABASE_URL` | VPS backend | Supabase project URL (default: `https://rwxqcqgjszvbwcyjfpec.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | VPS backend | Supabase service role key (required for sync bridge) |
| `SYNC_INTERVAL_MS` | VPS backend | Sync bridge interval (default: 30000ms) |

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
| GET | `/api/jobs/:id/output` | None | Fetch job output (image/text) |
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

The daemon (`dc1_daemon.py` v2.0) is a single Python file that runs as a background service:
1. Detects GPU via `nvidia-smi`
2. Checks Docker + NVIDIA Container Toolkit availability (cached)
3. Starts heartbeat loop (30s interval)
4. Polls for assigned jobs each heartbeat cycle
5. When job found: executes via Docker (`docker run --gpus all`) or bare-metal subprocess
6. Reports result (up to 5MB stdout) back to platform API

## Git Commit History (recent)

| Commit | Description |
|--------|-------------|
| `be91b72` | QA security fixes: code injection, billing rate, route order, daemon cache |
| `5f1676d` | Agent briefing: Docker execution, image gen, daemon v2.0 |
| `ce5a348` | Docker-based job execution + NVIDIA Container Toolkit + installer v2.0 |
| `d9e154d` | Image generation templates + output endpoint + 10mb body limit |
| `e8edea4` | Agent briefing: Supabase sync Phase 3, enums, wallets |
| `0b14596` | Supabase sync Phase 3: renters, wallets, withdrawals |
| `dc42487` | Agent briefing update for Gate 1 |
| `1b05b27` | Gate 1: billing, withdrawal, heartbeat rate limit |
| `90e9077` | Agent briefing update: CORS, env var, E2E |
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
