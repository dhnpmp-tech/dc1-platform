# DC1 Platform — Paperclip Agent Instructions

## READ FIRST
You are an AI agent managed by Paperclip, working on the DC1 Platform.
Before doing anything, read these files in order:
1. This file (context about the platform)
2. `AGENT_LOG.md` (what other agents recently changed)
3. `DC1-AGENT-BRIEFING.md` (comprehensive technical reference)

## What Is DC1
DC1 is a GPU compute marketplace for Saudi Arabia. Providers register NVIDIA GPUs, install a Python daemon, and earn SAR. Renters submit compute jobs (LLM inference, image gen, training) that run on provider hardware. DC1 takes 25% fee; providers earn 75%. Currency: SAR (halala = 1/100 SAR).

## Live Systems

### Production Sites
| System | URL | Purpose |
|--------|-----|---------|
| Frontend | dc1st.com (Vercel) | Next.js 14 App Router — provider/renter/admin dashboards |
| Backend API | 76.13.179.86:8083 | Express.js — all provider, renter, job, admin endpoints |
| Supabase | rwxqcqgjszvbwcyjfpec.supabase.co | Real-time reads, wallet sync, machine metrics |
| Paperclip | 76.13.179.86:3100 | Agent orchestration (this system) |
| GitHub | github.com/dhnpmp-tech/dc1-platform | Source repo, CI/CD |

### VPS Services (76.13.179.86, Ubuntu)
| Service | Manager | Port | Notes |
|---------|---------|------|-------|
| DC1 API | PM2 (ID 5) | 8083 | Main backend — dc1-provider-onboarding |
| Paperclip | Docker | 3100 | Agent orchestration |
| Bella (OpenClaw) | Docker | 18803-18804 | AI gateway |
| Laura (OpenClaw) | Docker (Hostinger) | — | AI gateway |
| PostgreSQL | Docker | 5433 | Paperclip database |

### Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind, deployed on Vercel
- **Backend**: Express.js, SQLite (better-sqlite3), PM2
- **Daemon**: Python 3 (dc1_daemon.py v3.3.0) — runs on provider GPU machines
- **Sync**: SQLite → Supabase bridge (30s interval)
- **Design**: Amber (#F5A524), Void Black (#07070E), Inter font

### Auth Model
- Providers: `?key=` query param or `x-provider-key` header
- Renters: `?key=` query param or `x-renter-key` header
- Admin: `x-admin-token` header (token: 9ca7c4f924374229b9c9f584758f055373878dfce3fea309ff192d638756342b)

## Current State (March 2026)

### Completed
- Phase 1: Unified design system (PR #36)
- Phase 2: Real VPS API auth flows
- Provider registration, heartbeat, daemon system (v3.3.0)
- Renter registration, balance, job submission
- Pre-pay billing with 75/25 split
- Machine verification (38-GPU fraud detection)
- Docker-based job execution with NVIDIA Container Toolkit
- Supabase sync bridge (3 phases: providers, jobs, wallets)
- CORS lockdown, rate limiting, HMAC task signing
- Windows NSIS installer + Linux/Mac setup scripts

### In Progress (Phase 3)
- Building missing Next.js pages: admin panel, legal pages, docs, support, marketplace, billing
- Branch: phase3-missing-pages

### Critical Gaps (not yet built)
1. Payment gateway (Stripe/Tap for real SAR deposits)
2. Provider payout system (bank transfers, IBAN)
3. Domain + SSL (currently raw IP for API)
4. Provider price controls (can't set own rates)
5. WebSocket live updates (currently polling)

## Cross-Agent Protocol

### Before starting work:
1. `git pull origin main`
2. Read `AGENT_LOG.md`
3. Check for conflicts with other agents' recent changes

### After completing work:
1. Conventional commits: feat:, fix:, docs:, refactor:, test:, chore:
2. Append timestamped entry to `AGENT_LOG.md`
3. `git push origin main`

### Agent Roster
| Agent | Role | Adapter |
|-------|------|---------|
| CEO | Orchestrator / triage | Claude (local) in Paperclip |
| Nexus | Monitoring / ops | OpenClaw |
| Claude-Cowork | VPS / deploy / live debug | External (Cowork sessions) |
| Cursor | IDE analysis / refactors | External (Cursor IDE) |

## Key API Endpoints (most common)

### Provider
- POST /api/providers/register — new provider
- POST /api/providers/heartbeat — daemon heartbeat (30s)
- GET /api/providers/me?key= — provider dashboard data
- GET /api/providers/earnings — earnings/withdrawal balance

### Renter
- POST /api/renters/register — new renter
- GET /api/renters/me?key= — renter profile + jobs
- POST /api/renters/topup — add balance
- GET /api/renters/available-providers — online GPUs

### Jobs
- POST /api/jobs/submit — submit job (x-renter-key auth)
- GET /api/providers/:key/jobs — daemon polls for work
- GET /api/jobs/:id/output — fetch job output

### Admin
- GET /api/admin/dashboard — system overview
- GET /api/admin/providers — all providers
- All admin endpoints require x-admin-token header

## File Structure (key paths)
```
dc1-platform/
├── app/                    # Next.js 14 frontend
│   ├── provider/           # Provider dashboard + register
│   ├── renter/             # Renter dashboard + register
│   ├── admin/              # Admin panel
│   ├── login/              # API key login
│   └── components/         # Shared UI (DashboardLayout, StatCard, etc.)
├── backend/
│   ├── src/
│   │   ├── server.js       # Express app, CORS, rate limiting
│   │   ├── db.js           # SQLite schema + migrations
│   │   ├── routes/         # providers.js, jobs.js, renters.js, admin.js, verification.js
│   │   ├── services/       # supabase-sync.js, recovery-engine.js
│   │   └── daemon/         # dc1_daemon.py (v3.3.0)
│   ├── installers/         # daemon.ps1, NSIS installer
│   └── data/providers.db   # SQLite database
├── CLAUDE.md               # Agent memory (Claude-Cowork)
├── AGENTS.md               # Agent memory (Codex)
├── AGENT_LOG.md            # Cross-agent communication log
├── DC1-AGENT-BRIEFING.md   # Comprehensive technical reference
├── NEXUS-MONITORING.md     # Nexus endpoint map
├── next.config.js          # API proxy rewrites
└── tailwind.config.ts      # DC1 design tokens
```

## For Detailed Technical Reference
Read `DC1-AGENT-BRIEFING.md` — it contains:
- Complete database schema (providers, jobs, renters tables)
- All 40+ API endpoints with auth requirements
- Billing model (halala rates, 75/25 split)
- Docker image mapping for job execution
- Supabase sync bridge architecture
- Full git commit history
- Environment variables reference
- Provider daemon lifecycle
- Gap analysis vs vast.ai
