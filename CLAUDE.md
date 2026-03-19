# DC1 Platform  Claude Agent Memory

## MANDATORY: Cross-Agent Communication Protocol

**EVERY session, BEFORE doing anything else:**
1. `git pull origin main`
2. Read `AGENT_LOG.md`  understand what other agents changed
3. Act on any breaking changes or notes left by Cursor, Codex, or Nexus

**EVERY session, AFTER making any code/config changes:**
1. Commit your code changes with conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
2. Append a timestamped entry to `AGENT_LOG.md` with: commit hash, files changed, impact, breaking changes
3. Commit the log update
4. `git push origin main`

**NEVER skip the AGENT_LOG.md update. This is how other agents know what you did.**

## Architecture

- **Frontend**: Next.js 14 (App Router) deployed on Vercel (dcp.sa)
- **Backend**: Express.js (port 8083), SQLite (better-sqlite3), PM2 process manager
- **VPS**: Hostinger srv1328172 (76.13.179.86), Ubuntu, accessed via web terminal
- **Repo**: github.com/dhnpmp-tech/dc1-platform (PAT auth in git remote)
- **API Proxy**: `next.config.js` rewrites `/api/dc1/:path*` → `http://76.13.179.86:8083/api/:path*`
- **Auth Model**: API key based (no passwords). Providers: `?key=` query param on `/providers/me`. Renters: `?key=` on `/renters/me`. Admin: `x-admin-token` header on `/admin/*`.
- **Design System**: DC1 brand — Amber (#F5A524), Void Black (#07070E), Surface hierarchy (l1/l2/l3), Inter font, Tailwind custom classes (`dc1-amber`, `dc1-void`, `dc1-surface-l1/l2/l3`)
- **PM2 Services**: dc1-mission-control (ID 0), mission-control-api (ID 1), dc1-provider-onboarding (ID 5), dc1-webhook (ID 6)

## Migration Plan (4 Phases)

- **Phase 1**: Unify design system ✅ (PR #36, merged)
- **Phase 2**: Wire registration/login to real VPS API ✅ (merged)
- **Phase 3**: Build missing pages — IN PROGRESS (branch: `phase3-missing-pages`)
- **Phase 4**: VPS becomes headless API (remove HTML from backend, Next.js serves everything)

## Key Files

- `backend/src/routes/providers.js`  All provider API routes (register, heartbeat, jobs, earnings, daemon download)
- `backend/public/provider-onboarding.html`  Provider registration frontend
- `backend/installers/daemon.ps1`  Thin installer v2.0.0 (downloads dc1_daemon.py)
- `backend/src/daemon/dc1_daemon.py`  Universal daemon v3.3.0 (auto-update, job execution, heartbeat)
- `backend/data/providers.db`  SQLite database (email UNIQUE constraint)
- `AGENT_LOG.md`  Cross-agent communication log (ALWAYS read and update)

## Agent Roster

| Agent | Role | Memory File |
|-------|------|------------|
| Claude-Cowork | VPS/deploy, live debugging | CLAUDE.md (this file) |
| Cursor | IDE/analysis, code refactors | .cursorrules |
| Codex | GitHub PRs, automated fixes | AGENTS.md |
| Nexus | OpenClaw orchestrator | reads AGENT_LOG.md |

## GitHub Issues Convention

- Use curl + GitHub API (no `gh` CLI on VPS)
- Token extracted from git remote: `TOKEN=$(git remote get-url origin | grep -oP '(?<=://)[^@]+(?=@)')`
- Labels: `architecture`, `documentation`, `bug`, `enhancement`

## Key Files (Next.js Frontend)

- `app/provider/register/page.tsx` — Provider registration (wired to POST `/api/providers/register`)
- `app/renter/register/page.tsx` — Renter registration (wired to POST `/api/renters/register`)
- `app/login/page.tsx` — API key login for all roles (renter/provider/admin)
- `app/provider/page.tsx` — Provider dashboard (wired to GET `/providers/me?key=`)
- `app/renter/page.tsx` — Renter dashboard + GPU Playground (tabbed)
- `app/admin/page.tsx` — Admin dashboard (wired to GET `/admin/dashboard`)
- `app/components/layout/DashboardLayout.tsx` — Shared dashboard shell with sidebar
- `app/components/layout/Footer.tsx` — Global footer (links to legal, docs, support pages)
- `app/components/ui/StatCard.tsx` — Reusable stat card component
- `app/components/ui/StatusBadge.tsx` — Status indicator badge
- `tailwind.config.ts` — DC1 design tokens (colors, fonts)
- `app/globals.css` — DC1 utility classes and component styles
- `next.config.js` — API proxy rewrite rules

## Recent Context

- Issue #34: Daemon Consolidation docs
- Issue #35: Cross-Agent Communication Protocol
- Provider #2 (dhnpmp@gmail.com) already registered — duplicate email returns 409
- Registration error fix deployed: line 485 of provider-onboarding.html now reads response.json()
- Phase 1 merged (PR #36): unified design system across all pages
- Phase 2 merged: all auth flows hit real VPS backend
- Phase 3 in progress: building admin panel, legal pages, docs, support, marketplace, billing
