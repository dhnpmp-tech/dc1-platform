# DCP Platform — Paperclip Agent Instructions

## READ FIRST
You are an AI agent managed by Paperclip, working on the DCP Platform.
You run INSIDE a Docker container as the node user. Do NOT run any git commands.

Before doing anything:
1. Read this file fully (platform context)
2. Read `AGENT_LOG.md` (what other agents recently changed) — use the Read tool, NOT git
3. For deep technical details, read `DCP-AGENT-BRIEFING.md`

CRITICAL: Never run git pull, git push, git commit, or any git commands. They will fail with permission errors.

## What Is DCP
DCP is a GPU compute marketplace for Saudi Arabia. Providers register NVIDIA GPUs, install a Python daemon, and earn SAR. Renters submit compute jobs (LLM inference, image gen, training) that run on provider hardware. DCP takes 25% fee; providers earn 75%. Currency: SAR (halala = 1/100 SAR).

## Live Systems

### Production Sites
| System | URL | Purpose |
|--------|-----|---------|
| Frontend | dcp.sa (Vercel) — PRODUCTION | Next.js 14 App Router — provider/renter/admin dashboards |
| Backend API | 76.13.179.86:8083 | Express.js — all provider, renter, job, admin endpoints |
| Supabase | rwxqcqgjszvbwcyjfpec.supabase.co | Real-time reads, wallet sync, machine metrics |
| Paperclip | 76.13.179.86:3100 | Agent orchestration (this system) |
| GitHub | github.com/dhnpmp-tech/dc1-platform | Source repo, CI/CD |

### VPS Services (76.13.179.86, Ubuntu)
| Service | Manager | Port | Notes |
|---------|---------|------|-------|
| DCP API | PM2 (ID 5) | 8083 | Main backend — dc1-provider-onboarding |
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
- Admin: `x-admin-token` header (token: REDACTED_USE_DC1_ADMIN_TOKEN_ENV)

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

## MANDATORY: Paperclip Heartbeat Procedure

You are managed by Paperclip and run in **heartbeats**. Each heartbeat, follow these steps IN ORDER using curl:

### Step 1: Check inbox for assigned issues
```bash
curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PAPERCLIP_API_URL/api/agents/me/inbox-lite"
```

### Step 2: Pick the highest priority issue and check it out
Work on in_progress first, then todo. Skip blocked.
```bash
curl -s -X POST -H "Authorization: Bearer $PAPERCLIP_API_KEY" -H "Content-Type: application/json" -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" "$PAPERCLIP_API_URL/api/issues/{issueId}/checkout" -d "{\"agentId\": \"$PAPERCLIP_AGENT_ID\", \"expectedStatuses\": [\"todo\", \"backlog\"]}"
```

### Step 3: Get issue context
```bash
curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PAPERCLIP_API_URL/api/issues/{issueId}/heartbeat-context"
```

### Step 4: Do the actual work
Read the codebase files mentioned in the issue description. Write code, make changes to fix the issue.

### Step 5: Update the issue status when done
```bash
curl -s -X PATCH -H "Authorization: Bearer $PAPERCLIP_API_KEY" -H "Content-Type: application/json" -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" "$PAPERCLIP_API_URL/api/issues/{issueId}" -d "{\"status\": \"done\", \"comment\": \"What was done.\"}"
```

### CRITICAL RULES
- All env vars ($PAPERCLIP_API_KEY, $PAPERCLIP_API_URL, $PAPERCLIP_AGENT_ID, $PAPERCLIP_RUN_ID) are auto-injected
- Use Authorization: Bearer $PAPERCLIP_API_KEY on ALL API calls
- Always include X-Paperclip-Run-Id header on writes
- Your FIRST action every heartbeat MUST be to check your inbox via curl

### PROACTIVE WORK (CEO AGENT ONLY)
If your inbox is empty and you are the CEO agent, do NOT exit quietly. Instead:
1. **Scan the backlog** — query for unassigned `todo` or `backlog` issues:
   ```bash
   curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PAPERCLIP_API_URL/api/issues?status=todo&status=backlog&limit=10"
   ```
2. **Prioritize and assign** — pick the highest-priority unblocked issues and assign them to the appropriate agents (Frontend Developer, Founding Engineer, etc.)
3. **Create new issues** if you identify gaps — broken features, missing docs, UX improvements, performance issues. You are the CEO: think strategically about what the platform needs next.
4. **Check blocked issues** — see if any blockers have been resolved and unblock them.
5. **Review the roadmap** — ensure the team is progressing toward launch readiness (DCP-308).

### PROACTIVE WORK (ALL OTHER AGENTS)
If your inbox is empty and you are NOT the CEO:
1. **Scan for unassigned issues matching your role** — e.g., Frontend Developer looks for frontend/i18n issues:
   ```bash
   curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" "$PAPERCLIP_API_URL/api/issues?status=todo&status=backlog&limit=5"
   ```
2. **Self-assign** issues that match your expertise and are unblocked.
3. If truly nothing to do, exit quietly — but this should be rare.





## ABSOLUTE RULE: DO NOT USE GIT

You MUST NOT run any git commands. This includes:
- git add, git commit, git push, git pull, git checkout, git merge
- ANY git command whatsoever

ALL git operations are handled by Claude-Cowork (the board operator).
You write code. Claude-Cowork reviews and pushes.
If you push broken code, it breaks the production website (dcp.sa).

This rule has NO exceptions. Not even for "just documentation" or "just a log update."
Write your code to files. Claude-Cowork will find it, review it, and push it.

## CRITICAL: Frontend Build Rules

These rules MUST be followed by ALL agents. Violations will break the Vercel production deploy.

1. **NEVER create new TypeScript directories** without adding them to tsconfig.json excludes
2. **DashboardLayout** only accepts: children, navItems, role, userName — NO title prop
3. **All imports must use existing components** — check app/components/ before importing
4. **New app/ pages must use relative imports** for DashboardLayout: ../../components/layout/DashboardLayout
5. **Do NOT install npm packages** on the VPS — it can break native modules (better-sqlite3)
6. **tsconfig.json excludes** currently: node_modules, backend, orchestration, frontend, security, vitest.config.ts, vscode-extension, sdk, p2p, docker-templates

If you create a new top-level directory with .ts/.tsx files, ADD IT to tsconfig.json excludes immediately.
## Cross-Agent Protocol

### IMPORTANT: No Git Commands Inside Paperclip
You are running inside a Docker container with a READ-ONLY volume mount of the DCP repo.
Do NOT run `git pull`, `git push`, `git commit`, or any git commands — they will fail.
The codebase is automatically kept in sync via the host volume mount.

### Before starting work:
1. Read `AGENT_LOG.md` (understand what other agents changed)
2. Read relevant source files for your task
3. Check for conflicts with other agents' recent changes

### After completing work:
1. Report your changes via Paperclip issue comments
2. Note any files you would modify and what changes are needed
3. The CEO or Claude-Cowork agent will commit and push changes from outside the container

### If you need to make code changes:
- Write the changes to files in your working directory
- The host volume mount will reflect your changes on the VPS
- Do NOT attempt git operations — they will error with permission denied

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
├── DCP-AGENT-BRIEFING.md   # Comprehensive technical reference
├── NEXUS-MONITORING.md     # Nexus endpoint map
├── next.config.js          # API proxy rewrites
└── tailwind.config.ts      # DCP design tokens
```

## For Detailed Technical Reference
Read `DCP-AGENT-BRIEFING.md` — it contains:
- Complete database schema (providers, jobs, renters tables)
- All 40+ API endpoints with auth requirements
- Billing model (halala rates, 75/25 split)
- Docker image mapping for job execution
- Supabase sync bridge architecture
- Full git commit history
- Environment variables reference
- Provider daemon lifecycle
- Gap analysis vs vast.ai

---

## RESEARCH-TO-IMPLEMENTATION LOOP (MANDATORY)

This is the core process that makes DCP self-improving. Every agent MUST follow this.

### For CEO Agent (Mandatory Every Heartbeat):

1. **Read Completed Deliverables**: Check for any issues in 'done' status that have attached documents or reports in docs/ directory. Read them fully.
2. **Extract Actionable Items**: From every research report, UX audit, competitive analysis, or content draft, extract EVERY actionable recommendation.
3. **Create Implementation Issues**: For each actionable item, create a new issue with clear title, description including file paths and acceptance criteria, and priority.
4. **Assign to Right Engineer**: Match each task to the agent with the right expertise (frontend dev for UI changes, backend dev for API work, etc.).
5. **Track Completion**: In your next heartbeat, check if assigned issues are progressing. If stalled, reassign or break down further.

### For ALL Agents (Self-Improving Behavior):

- When you complete a task and discover something that needs follow-up work, create a new issue for it immediately.
- When you encounter an unexpected finding during implementation, document it and create an issue.
- When you see something broken or wrong that is outside your current task scope, flag it as a new issue.
- Never let knowledge die in a completed issue. If it is actionable, it becomes a new issue.

### For Research Agents (UX Researcher, Copywriter, UI/UX Specialist):

Every deliverable MUST include an "Implementation Checklist" section at the end with:
- Specific file paths to modify
- Exact changes needed (not vague suggestions)
- Priority ranking (P0, P1, P2)
- Acceptance criteria for each item
- Suggested assignee role

---

## DCP UNIQUE POSITIONING (ALL AGENTS MUST KNOW)

DCP has two key competitive advantages that must be emphasized in all content, copy, and strategic decisions:

### 1. Saudi Energy Cost Advantage
- Saudi Arabia has among the lowest electricity costs globally
- This is a structural, permanent advantage (not a temporary promo)
- This means GPU compute on DCP can be fundamentally cheaper than US/EU-based providers
- This MUST be headline-level messaging, not buried in a FAQ
- Compare to: Vast.ai, RunPod, Lambda all run on expensive US/EU energy

### 2. Arabic AI Models - First-Class Support
- DCP natively supports Arabic-optimized AI models:
  - ALLaM 7B (SDAIA foundation model)
  - Falcon H1 (TII Abu Dhabi)
  - JAIS 13B (Inception/G42)
  - BGE-M3 (multilingual embeddings)
- No other GPU cloud platform offers this level of Arabic AI support
- This is a key differentiator for MENA customers
- Position as: "The home for Arabic AI development"

### Content Guidelines:
- NEVER invent pricing, rates, or financial figures unless explicitly approved by leadership
- NEVER claim "bare-metal" GPUs - DCP uses GPU-accelerated Docker containers with NVIDIA Container Toolkit
- Always lead with the energy cost advantage and Arabic AI support as top-level differentiators
- NO billing, Moyasar, or escrow implementation until platform is stable
- Focus on: features, hardening, containers, models, auth flows, scale readiness
