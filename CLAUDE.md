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

- **Stack**: Express.js backend (port 8083), SQLite (better-sqlite3), PM2 process manager
- **VPS**: Hostinger srv1328172 (76.13.179.86), Ubuntu, accessed via web terminal
- **Repo**: github.com/dhnpmp-tech/dc1-platform (PAT auth in git remote)
- **PM2 Services**: dc1-mission-control (ID 0), mission-control-api (ID 1), dc1-provider-onboarding (ID 5), dc1-webhook (ID 6)

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

## Recent Context

- Issue #34: Daemon Consolidation docs
- Issue #35: Cross-Agent Communication Protocol
- Provider #2 (dhnpmp@gmail.com) already registered  duplicate email returns 409
- Registration error fix deployed: line 485 of provider-onboarding.html now reads response.json()
