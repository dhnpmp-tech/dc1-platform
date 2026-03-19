# DC1 Platform — Complete Handover Document
## For Next Claude Cowork Instance (March 13, 2026)

---

## 1. WHAT IS DC1

DC1 is a **GPU compute marketplace** — providers share their idle GPUs, renters submit AI jobs (LLM inference, image generation), and DC1 takes a 25% fee. Think of it as Airbnb for GPUs.

- **Website**: https://dc1st.com (Vercel)
- **API Backend**: http://76.13.179.86:8083 (Hostinger VPS)
- **GitHub**: https://github.com/dhnpmp-tech/dc1-platform

---

## 2. ARCHITECTURE

```
[Next.js 14 on Vercel] → API Proxy → [Express.js on VPS:8083] → [SQLite DB]
                                            ↑
                                    [Provider Daemon on Yazan's PC]
                                    (heartbeats every 30s, executes jobs)
```

- **Frontend**: Next.js 14 (App Router), deployed on Vercel (auto-deploys from `main` branch)
- **Backend**: Express.js, SQLite (better-sqlite3), PM2 process manager
- **VPS**: Hostinger srv1328172, Ubuntu, IP `76.13.179.86`
- **API Proxy**: `next.config.js` rewrites `/api/dc1/:path*` → `http://76.13.179.86:8083/api/:path*`
- **Database**: `/root/dc1-platform/backend/data/providers.db` (SQLite)

### API Base Pattern (used in all frontend pages)
```javascript
const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'
```

---

## 3. HOW TO ACCESS EVERYTHING

### GitHub (from Mac terminal via Desktop Commander)
```bash
cd /Users/pp/DC1-Platform/dc1-platform
git pull origin main
git push origin main
```
The git remote has a PAT embedded: `git remote get-url origin` shows the token in the URL.

### VPS Access (SSH from Mac)
```bash
ssh root@76.13.179.86
```
No password prompt — SSH key is configured on Peter's Mac.

### Deploy Backend to VPS
```bash
# From Mac:
cd /Users/pp/DC1-Platform/dc1-platform
scp backend/src/routes/admin.js root@76.13.179.86:/root/dc1-platform/backend/src/routes/admin.js
scp backend/src/routes/providers.js root@76.13.179.86:/root/dc1-platform/backend/src/routes/providers.js
scp backend/src/routes/jobs.js root@76.13.179.86:/root/dc1-platform/backend/src/routes/jobs.js
# Then restart:
ssh root@76.13.179.86 "pm2 restart dc1-provider-onboarding"
```

### Deploy Frontend to Vercel
Just push to `main` — Vercel auto-deploys:
```bash
git add -A && git commit -m "feat: description" && git push
```

### Query the Database
```bash
ssh root@76.13.179.86 "sqlite3 /root/dc1-platform/backend/data/providers.db \"YOUR SQL HERE;\""
```

### PM2 Services on VPS
| ID | Name | Port | Purpose |
|----|------|------|---------|
| 0 | dc1-mission-control | — | Legacy |
| 1 | mission-control-api | — | Legacy |
| 5 | dc1-provider-onboarding | 8083 | **Main API** |
| 6 | dc1-webhook | — | Webhook handler |

---

## 4. AUTH MODEL

- **Providers**: `?key=dc1-provider-xxx` query param on `/api/providers/me`
- **Renters**: `?key=dc1-renter-xxx` query param on `/api/renters/me`
- **Admin**: `x-admin-token` header on all `/api/admin/*` endpoints
- **Admin Token**: `<DC1_ADMIN_TOKEN>`

### Crediting a Renter (example)
```bash
ssh root@76.13.179.86 "curl -s -X POST http://localhost:8083/api/admin/renters/ID/balance \
  -H 'Content-Type: application/json' \
  -H 'x-admin-token: <DC1_ADMIN_TOKEN>' \
  -d '{\"amount_halala\": 5000, \"reason\": \"Credit 50 SAR\"}'"
```
100 halala = 1 SAR.

---

## 5. BILLING MODEL

- **LLM jobs**: 15 halala/min
- **Image Gen jobs**: 20 halala/min
- **Split**: 75% provider, 25% DC1
- **New accounts**: Renters get 10 SAR (1000 halala) starting balance automatically

---

## 6. KEY FILES

### Backend Routes
| File | Purpose |
|------|---------|
| `backend/src/routes/providers.js` | Provider registration, heartbeat, /me, withdraw, settings |
| `backend/src/routes/renters.js` | Renter registration, /me, topup, balance |
| `backend/src/routes/jobs.js` | Job submit, queue system, results, cancel |
| `backend/src/routes/admin.js` | All admin endpoints (providers, renters, jobs, finance, withdrawals, security, audit) |
| `backend/src/db.js` | SQLite connection |

### Frontend Pages
| Path | File | Purpose |
|------|------|---------|
| `/` | `app/page.tsx` | Landing page |
| `/login` | `app/login/page.tsx` | API key login (all roles) |
| `/provider` | `app/provider/page.tsx` | Provider dashboard |
| `/provider/register` | `app/provider/register/page.tsx` | Provider signup |
| `/renter` | `app/renter/page.tsx` | Renter dashboard + GPU Playground |
| `/renter/register` | `app/renter/register/page.tsx` | Renter signup |
| `/admin` | `app/admin/page.tsx` | Admin dashboard |
| `/admin/providers` | `app/admin/providers/page.tsx` | Provider management |
| `/admin/providers/[id]` | `app/admin/providers/[id]/page.tsx` | Provider detail |
| `/admin/renters` | `app/admin/renters/page.tsx` | Renter management |
| `/admin/renters/[id]` | `app/admin/renters/[id]/page.tsx` | Renter detail |
| `/admin/jobs` | `app/admin/jobs/page.tsx` | Jobs management |
| `/admin/jobs/[id]` | `app/admin/jobs/[id]/page.tsx` | Job detail |
| `/admin/finance` | `app/admin/finance/page.tsx` | Finance dashboard |
| `/admin/withdrawals` | `app/admin/withdrawals/page.tsx` | Withdrawal management |
| `/admin/security` | `app/admin/security/page.tsx` | Security events |
| `/admin/fleet` | `app/admin/fleet/page.tsx` | Fleet health |

### Design System
| File | Purpose |
|------|---------|
| `tailwind.config.ts` | DC1 design tokens |
| `app/globals.css` | DC1 utility classes |
| `app/components/ui/StatCard.tsx` | Stat card component |
| `app/components/ui/StatusBadge.tsx` | Status badge component |
| `app/components/layout/DashboardLayout.tsx` | Shared dashboard shell |

### Component Props
```typescript
// StatCard
{ label: string, value: string, icon?: ReactNode, trend?: string, accent?: 'amber' | 'success' | 'error' | 'info' | 'default' }

// StatusBadge - StatusType is NOT exported (local type in file)
type StatusType = 'online' | 'offline' | 'active' | 'inactive' | 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'warning'
// Use `as any` if you need types not in the union
```

### Design Tokens
- **Amber**: #F5A524 (`dc1-amber`)
- **Void Black**: #07070E (`dc1-void`)
- **Surfaces**: `dc1-surface-l1`, `dc1-surface-l2`, `dc1-surface-l3`
- **Font**: Inter

---

## 7. DATABASE SCHEMA (Key Tables)

### providers
`id, name, email, gpu_model, os, api_key, status, gpu_status (JSON), provider_ip, provider_hostname, last_heartbeat, gpu_name_detected, gpu_vram_mib, total_earnings (REAL), total_jobs, uptime_percent, daemon_version, is_paused, run_mode, cached_models`

### renters
`id, name, email, api_key, organization, status, balance_halala, total_spent_halala, total_jobs, created_at`

### jobs
`id, job_id (unique), provider_id, renter_id, status, job_type, cost_halala, actual_cost_halala, provider_earned_halala, dc1_fee_halala, task_spec, result, error, submitted_at, started_at, completed_at, timeout_at, progress_phase, max_duration_seconds`

Job statuses: `queued → pending → running → completed/failed/cancelled`

### withdrawals
`id, withdrawal_id, provider_id, amount_sar, payout_method, payout_details, status (pending/approved/completed/rejected), requested_at, processed_at, notes`

### admin_audit_log
`id, action, target_type, target_id, details, timestamp`

### daemon_events
`id, provider_id, event_type, severity, daemon_version, job_id, hostname, os_info, details, event_timestamp`

### heartbeat_log
`id, provider_id, received_at, provider_ip, gpu_util_pct, gpu_temp_c, gpu_power_w, gpu_vram_free_mib, daemon_version`

---

## 8. JOB QUEUE SYSTEM

When a renter submits a job and the provider is busy, the job enters a FIFO queue:

1. `POST /api/jobs/submit` → if provider busy, status = `queued`
2. When running job completes/fails/cancels → `promoteNextQueuedJob()` auto-dispatches next
3. Timeout enforcement also triggers queue promotion
4. Queue position tracked via `GET /api/jobs/:job_id`
5. `GET /api/jobs/queue/:provider_id` shows full queue

The `promoteNextQueuedJob()` helper is in `backend/src/routes/jobs.js` near the top.

---

## 9. GPU PLAYGROUND

Located at `/renter` (tabbed: Dashboard | GPU Playground).

### Available Models
- **LLM**: TinyLlama 1.1B Chat, Phi-2
- **Image Gen**: Stable Diffusion v1.4 only

Mistral 7B was removed (too large for 8GB VRAM). SD v1.5, v2.1, SDXL removed (require HuggingFace auth).

### Active Provider
- **Yazan Almazyad** (ID 26, email: Yazan.almazyad@gmail.com)
- Machine: DESKTOP-HMS3278, Windows 11, RTX 3060 Ti 8GB
- Daemon v3.3.1

---

## 10. AGENT ECOSYSTEM

| Agent | Role | Where |
|-------|------|-------|
| Claude-Cowork | VPS/deploy, live debugging, admin build | CLAUDE.md |
| Cursor | IDE/analysis, code refactors | .cursorrules |
| Codex | GitHub PRs, automated fixes | AGENTS.md |
| Nexus | OpenClaw orchestrator | /root/openclaw-nexus/ on VPS |
| Laura | OpenClaw agent | /root/openclaw-laura/ on VPS |

### Cross-Agent Protocol
**EVERY session, BEFORE doing anything**: `git pull origin main` + read `AGENT_LOG.md`
**EVERY session, AFTER changes**: commit + update `AGENT_LOG.md` + push

### Lightpanda Browser
Installed at `/usr/local/bin/lightpanda` on VPS, mounted into Nexus/Laura Docker containers.
Usage: `lightpanda fetch --dump markdown URL`

---

## 11. WHAT WAS COMPLETED (This Session)

### Phase 4A — Admin Console (DONE)
- ✅ Finance Dashboard (`/admin/finance`) — revenue, daily chart, top earners, transactions, discrepancy detection
- ✅ Backend search + pagination on providers, renters, jobs list endpoints
- ✅ Admin dashboard expanded with revenue/renter/job stats
- ✅ Landing page fake stats replaced with real value props

### Phase 4B — Partial (DONE)
- ✅ Withdrawal management — backend endpoints (list, approve, reject, complete) + admin UI page
- ✅ Audit log — `admin_audit_log` table created, all admin actions logged (suspend, unsuspend, balance adjust, withdrawal approve/reject/complete)
- ✅ Provider withdrawal endpoints already existed (POST /providers/withdraw, GET /providers/withdrawal-history)

### Other Fixes This Session
- ✅ Fixed Yazan's duplicate account (merged ID 23 into ID 26)
- ✅ Credited Tariq.Almazyad@gmail.com (renter ID 7) with 100 SAR
- ✅ Set 10 SAR starting balance for all new renter accounts
- ✅ All admin pages now have Finance + Withdrawals nav links

---

## 12. WHAT REMAINS TO BE BUILT

### Phase 4B Remaining (~6h)
1. **Auto-refresh on all admin pages** (~1.5h) — only main dashboard has 30s polling. Add to providers, jobs, fleet, security
2. **Bulk operations** (~2h) — multi-select checkboxes on provider/renter lists, bulk suspend/unsuspend/credit
3. **Provider duplicate detection** (~1.5h) — warn on registration if similar email exists, admin merge tool

### Phase 4C — Security & Hardening (~12h)
4. **Rate limiting** (~2h) — `express-rate-limit` middleware. Registration: 5/hr per IP. Jobs: 30/min per renter. Admin: 100/min
5. **API key rotation** (~2h) — POST /providers/rotate-key, POST /renters/rotate-key
6. **Input validation hardening** (~2h) — sanitize strings, validate integers, CSP headers, CORS lockdown
7. **Monitoring & alerting hooks** (~3h) — /api/admin/health endpoint, webhook for critical events, Telegram integration
8. **Financial reconciliation automation** (~3h) — cron job auditing completed jobs, verify provider_earned + dc1_fee = actual_cost

### Phase 4 (Original Plan) Not Started
- Phase 4 end goal: VPS becomes **headless API** — remove all HTML from backend, Next.js serves everything
- Provider onboarding HTML (`backend/public/provider-onboarding.html`) still serves legacy registration page

---

## 13. KNOWN ISSUES & GOTCHAS

1. **StatusBadge `StatusType` is NOT exported** — defined as a local type in the component file. Use `as any` for types not in the union.
2. **TypeScript test errors** — `app/admin/admin-auth.test.ts` has jest type errors (no `@types/jest` installed). Harmless — Vercel ignores test files.
3. **Git operations MUST run from Mac** (`/Users/pp/DC1-Platform/dc1-platform`) via Desktop Commander, NOT from the Cowork VM.
4. **`total_earnings` in providers table is REAL (SAR)**, not halala. The `/providers/me` endpoint converts: `total_earnings_halala: Math.round(provider.total_earnings * 100)`
5. **Provider email uniqueness** — duplicate emails return 409. Yazan had 2 accounts because he used different emails.
6. **HuggingFace gated models** — any model requiring auth will fail with 401. Only use open-access models.
7. **8GB VRAM limit** — Yazan's RTX 3060 Ti can only run models <4GB comfortably. TinyLlama (1.1B) works, Mistral 7B (14GB) does not.

---

## 14. QUICK REFERENCE COMMANDS

```bash
# Check if backend is running
ssh root@76.13.179.86 "pm2 status"

# View backend logs
ssh root@76.13.179.86 "pm2 logs dc1-provider-onboarding --lines 50 --nostream"

# Check online providers
ssh root@76.13.179.86 "curl -s http://localhost:8083/api/admin/providers -H 'x-admin-token: <DC1_ADMIN_TOKEN>' | python3 -m json.tool | head -20"

# Credit a renter
ssh root@76.13.179.86 "curl -s -X POST http://localhost:8083/api/admin/renters/RENTER_ID/balance -H 'Content-Type: application/json' -H 'x-admin-token: <DC1_ADMIN_TOKEN>' -d '{\"amount_halala\": 5000}'"

# Check a job
ssh root@76.13.179.86 "sqlite3 /root/dc1-platform/backend/data/providers.db \"SELECT job_id, status, job_type, result FROM jobs WHERE id = JOB_ID;\""

# TypeScript check before pushing
cd /Users/pp/DC1-Platform/dc1-platform && npx tsc --noEmit 2>&1 | grep -v admin-auth.test

# Full deploy cycle
cd /Users/pp/DC1-Platform/dc1-platform
scp backend/src/routes/admin.js root@76.13.179.86:/root/dc1-platform/backend/src/routes/admin.js
ssh root@76.13.179.86 "pm2 restart dc1-provider-onboarding"
git add -A && git commit -m "feat: description" && git push
```

---

## 15. CURRENT RENTER ACCOUNTS

| ID | Name | Email | Balance |
|----|------|-------|---------|
| 1 | Peter | dhnpmp@gmail.com | varies |
| 6 | Tareq | tak@alchemist.trade | 50 SAR |
| 7 | Tariq Almazyad | Tariq.Almazyad@gmail.com | 100 SAR |

### Provider API Key for Testing
Renter key for dhnpmp@gmail.com: `<REDACTED_TEST_RENTER_KEY>`

---

*Document generated March 13, 2026 by Claude Cowork. All code committed and pushed to main.*
