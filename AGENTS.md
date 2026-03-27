# DC1 Platform  Codex Agent Instructions

## MANDATORY: Cross-Agent Communication Protocol

This codebase is maintained by multiple AI agents. You MUST follow this protocol.

### BEFORE starting any task:
1. Read `AGENT_LOG.md`  understand recent changes by other agents
2. Check for conflicts or dependencies before modifying files

### AFTER completing any task:
1. Use conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
2. Append a log entry to `AGENT_LOG.md`:
   ```
   ## [YYYY-MM-DD HH:MM UTC] Codex  Short Summary
   - **Commit**: `hash`  What changed
   - **Files**: files touched
   - **Impact**: what other agents need to know
   ```
3. Include the AGENT_LOG.md update in your PR or commit

**NEVER skip updating AGENT_LOG.md. Other agents depend on it.**

## Project Structure

```
dc1-platform/
  backend/
    src/
      routes/providers.js    # Main API (register, heartbeat, jobs, earnings)
    installers/
      dc1_daemon.py          # Universal Python daemon v3.3.0
      daemon.ps1             # Thin PowerShell installer v2.0.0
      daemon.sh              # Unix shell installer
    public/
      provider-onboarding.html  # Registration frontend (vanilla JS)
    data/
      providers.db           # SQLite (email UNIQUE constraint)
  AGENT_LOG.md               # Cross-agent communication (READ+WRITE every session)
  CLAUDE.md                  # Claude agent memory
  .cursorrules               # Cursor agent rules
  AGENTS.md                  # This file (Codex memory)
```

## Tech Stack

- **Frontend**: Next.js 14 (App Router) on Vercel (dc1st.com)
- **Backend**: Express.js on port 8083, Node.js
- **Database**: SQLite via better-sqlite3 (no ORM, raw SQL)
- **API Proxy**: Next.js rewrites `/api/dc1/:path*` → `http://76.13.179.86:8083/api/:path*`
- **Auth**: API key based. Providers: `?key=` query param. Renters: `?key=` query param. Admin: `x-admin-token` header.
- **Design System**: Amber (#F5A524), Void Black (#07070E), Tailwind custom classes (`dc1-amber`, `dc1-void`, `dc1-surface-l1/l2/l3`)
- **Process Manager**: PM2
- **Daemon**: Python 3 (dc1_daemon.py) — runs on provider machines
- **VPS**: Hostinger (76.13.179.86), Ubuntu

## API Routes (providers.js)

POST /api/providers/register — New provider registration (expects: name, email, gpu_model, os, phone)
GET  /api/providers/me?key=KEY — Provider dashboard data (returns: provider object with total_jobs, total_earnings_halala, today/week earnings)
POST /api/providers/heartbeat — Daemon heartbeat with GPU stats
POST /api/providers/job-result — Job completion reporting
GET  /api/providers/download/daemon?key=KEY — Serves dc1_daemon.py with injected API key
GET  /api/providers/download/setup?key=KEY&os=windows — Platform-specific installer script
POST /api/providers/pause — Pause provider
POST /api/providers/resume — Resume provider

## API Routes (renters.js)

POST /api/renters/register — New renter registration (expects: name, email, organization)
GET  /api/renters/me?key=KEY — Renter dashboard data
GET  /api/renters/available-providers — List online GPUs

## API Routes (admin.js)

GET  /api/admin/dashboard — Platform stats (x-admin-token header required)
GET  /api/admin/providers — All providers list
GET  /api/admin/providers/:id — Provider detail
GET  /api/admin/jobs/:id — Job detail
GET  /api/admin/daemon-health — Daemon health overview

## Error Handling Convention

All error responses MUST return JSON: `{ "error": "descriptive message" }`
Frontend MUST read response.json() before throwing errors.

## Agent Roster

| Agent | Role | Memory File | What they change |
|-------|------|------------|-----------------|
| Claude-Cowork | VPS/deploy | CLAUDE.md | Server config, PM2, live hotfixes |
| Cursor | IDE/analysis | .cursorrules | Code refactors, new features |
| Codex | GitHub PRs | AGENTS.md (this) | Automated fixes, PR reviews |
| Nexus | Orchestrator | AGENT_LOG.md | Multi-agent task routing |

## PR Guidelines

- Reference related issues (e.g., "Fixes #34")
- Keep PRs focused  one logical change per PR
- Run through the error handling convention above
- Update AGENT_LOG.md in the PR
