# DCP Platform — Operational Handbook

> This file is the source of truth for any Claude Code session working on DCP.
> Last updated: 2026-04-01

## What is DCP

DCP (Decentralized Compute Platform) is a GPU compute marketplace and inference-as-a-service platform based in Saudi Arabia. Three pillars:

1. **Saudi Energy Arbitrage** — Saudi electricity USD 0.048-0.053/kWh (3.5-6x cheaper than EU). Providers in KSA rent GPU compute to the world.
2. **Inference as a Service** — OpenAI-compatible API. Arabic-first models (ALLaM, JAIS, Falcon). Working toward OpenRouter listing.
3. **Enterprise & Compliance** — PDPL (Saudi data protection) compliance. Data stays in-Kingdom. SOC 2 Type II planned Q2 2026.

## Co-founders

- Peter (CTO) — setup@oida.ae
- Tareq — tak@dcp.sa / e.tareg@gmail.com
- Fadi — fad@dcp.sa

## Architecture

| Component | Technology | Location |
|-----------|-----------|----------|
| Frontend | Next.js 14 (App Router) | Vercel → dcp.sa |
| Backend | Express.js + SQLite | VPS 76.13.179.86:8083 → api.dcp.sa |
| Auth | Supabase OTP magic links | rwxqcqgjszvbwcyjfpec.supabase.co |
| Payments | Moyasar (SAR, halala) | Integrated |
| Escrow | EIP-712 on Base Sepolia | Testnet (not funded) |
| Issue Tracker | Paperclip | VPS :3100 (Docker) |
| AI Agents | 14 Paperclip agents | VPS (Docker, Codex-based) |
| Chat Widget | Claude Haiku 4.5 | Vercel API route /api/chat |
| File Sharing | Nextcloud | VPS :8889 → files.dcp.sa |
| Hermes Agent | Nous Research | VPS (Docker) → @Hermes_DCP_Bot |
| OpenClaw Nexus | OpenClaw | VPS (Docker) → Telegram group |

## VPS Access (76.13.179.86)

- SSH: `ssh root@76.13.179.86` (password in secure channel)
- Backend code: `/home/ubuntu/workspaces/dc1-platform`
- PM2 process: `dc1-provider-onboarding` on port 8083
- Nginx: reverse proxy for api.dcp.sa (443→8083) and files.dcp.sa (443→8889)
- SSL: Let's Encrypt (auto-renewing via certbot)

## GitHub

- Repo: `dhnpmp-tech/dc1-platform`
- Main branch: `main`
- PRs: Release Engineer agent creates and merges autonomously
- Branch naming: `agent/<role>/<issue-id>-<description>`

## Paperclip Multi-Agent System

14 AI agents running in the Paperclip container on the VPS.

| Agent | Heartbeat | Role |
|-------|-----------|------|
| CEO | 1h | Strategy, roadmap, hiring, issue creation |
| CTO | 2h | Technical decisions, code review |
| Backend Developer | 2h | Express.js/Node.js code |
| Frontend Developer | 2h | React/Next.js code |
| Staff Engineer | 2h | Cross-cutting implementation |
| Release Engineer | 2h | Auto-merges branches to main |
| QA Engineer | 2h | Testing, verification |
| CMO | 3h | Marketing, content |
| UXDesigner | 3h | UI/UX specs |
| Security & Compliance | 3h | PDPL, SOC 2, audit logging |
| FinOps Payments | 3h | Settlement, reconciliation |
| Inference Reliability | 2h | Latency, uptime, monitoring |
| Developer Advocate | 3h | Docs, OpenRouter adoption |
| Platform SRE | 3h | Production reliability |

### Paperclip DB Connection

```
postgresql://paperclip:paperclip@127.0.0.1:54329/paperclip
```

(Run queries inside the paperclip container: `docker exec paperclip-paperclip-1 node -e '...'`)

### Monitor Script

```bash
ssh root@76.13.179.86 "bash /opt/paperclip/monitor.sh && cat /opt/paperclip/latest-report.txt"
```

The monitor auto-fixes: clears stale locks, cancels escalation issues, resets blocked→todo, resets errored agents.

### Agent Config Locations (inside container)

- AGENTS.md: `/paperclip/instances/default/companies/23523831-f399-4d18-8b1a-a16eaad271f6/agents/<agent-id>/instructions/AGENTS.md`
- Company ID: `23523831-f399-4d18-8b1a-a16eaad271f6`

### Key Agent IDs

- CEO: `b219ffbd-93ab-49e5-b582-d5d966e4d307`
- CTO: `5d08f612-4f0c-4b86-b8d5-a6f700db35dd`
- Backend Dev: `fe54d572-3cb6-408c-8e95-e3da583c5663`
- Frontend Dev: `5e4ee34c-01e2-41f9-8ff2-196009c9e290`
- QA: `b92c9e81-b395-4d42-8f64-ba5c58409840`
- Release Engineer: `411ebcbb-0f06-45c0-a89b-ca4638eab0b2`
- Staff Engineer: `9e4906a8-0b85-41b0-be2d-b4eea40884f8`

## Standing Rules (enforced in STANDING-DIRECTIVES.md on VPS)

1. No lock/unblock issues — skip blocked work, move on
2. Git workflow — never commit to main, always feature branches
3. GStack skills — ship, review, investigate
4. No escalation chains — if blocked, note it once and move on
5. Check main before creating branches — no duplicate work
6. No status update comments — only decisions and code
7. No screenshot evidence — code-level verification only
8. Release Engineer has autonomous merge authority

## Production Database (SQLite on VPS)

- Path: `/home/ubuntu/workspaces/dc1-platform/backend/data/providers.db`
- 19 providers (migrated from Supabase), 10 renters
- Backend version: 4.0.0
- Health check: `curl http://localhost:8083/api/health`

## Supabase

- URL: `https://rwxqcqgjszvbwcyjfpec.supabase.co`
- Service key: in `/root/.bashrc` on VPS as `SUPABASE_SERVICE_ROLE_KEY`
- 67 users total (mix of real and test accounts)
- Sync direction: SQLite → Supabase (one-way, currently disabled — no .env on VPS)

## Docker Containers on VPS

Essential (keep running):
- `paperclip-paperclip-1` — agent system
- `nexus2-openclaw-gateway-1` — OpenClaw Nexus (Telegram bot)
- `hermes-agent` — Hermes Agent (Telegram bot @Hermes_DCP_Bot)
- `project-agent-n8n` — n8n automation
- `project-agent-postgres` — n8n database
- `project-agent-redis` — n8n cache
- `nextcloud` — file sharing (files.dcp.sa)

OpenClaw instances (healthy):
- `openclaw-tito`, `openclaw-new`, `openclaw-osito`, `openclaw-sara`, `openclaw-502x`

Stopped (save resources):
- `brain-graphiti`, `brain-neo4j-graphiti` — too heavy for current VPS
- `mem0-dev-*` — belongs to Project Agent (SMB product), separate project
- `gpuscreener-dashboard-1` — GPU screener dashboard
- `openclaw-laura`, `openclaw-romina` — crash loops

Zombie (harmless, can't be killed):
- `openclaw-nexus-openclaw-gateway-1` — old container, stuck in kernel. Will clear on VPS reboot.

## Hermes Agent

- Container: `hermes-agent`
- Config: `/root/.hermes/.env` and `/root/.hermes/config.yaml`
- LLM: MiniMax M2.7 via direct API (custom provider, base_url: https://api.minimaxi.chat/v1)
- Telegram: @Hermes_DCP_Bot
- Data: `/root/.hermes/` (memories, skills, sessions, cron)
- 75 bundled skills

## Nextcloud (files.dcp.sa)

- Container: `nextcloud` on port 8889
- Nginx reverse proxy with SSL
- Admin: admin / (password in secure channel)
- Users: admin, tareq (e.tareg@gmail.com), fadi (fad@dcp.sa)
- Storage: /opt/nextcloud/data
- Branding: DCP Files, cyan theme, DCP logo

## Chat Widget (dcp.sa)

- Route: `/api/chat/route.ts` on Vercel
- Model: Claude Haiku 4.5 via Anthropic API
- **Requires ANTHROPIC_API_KEY in Vercel env vars** (not yet added — widget shows "temporarily unavailable")
- Knowledge base: comprehensive DCP docs compiled into system prompt (~4K tokens)
- Security: rate-limited 10 req/min/IP, system prompt locked server-side, strips client system messages

## Key Technical Gaps (as of 2026-04-01)

- Production VPS is behind main by ~20 commits (last deploy: 2026-03-31)
- 19 providers registered, 0 actively running daemon
- 0 real revenue / 0 paid inference requests
- OpenRouter: 3 compliance checks were blocking, now fixed in code but needs final QA certification
- Template catalog: code shipped to marketplace UI, needs production deploy
- ANTHROPIC_API_KEY not in Vercel env (chat widget inactive)
- Smart contract escrow on testnet only (wallet not funded)
- VPS is Hostinger shared VPS — 94% CPU steal under load. Migration to Hetzner AX102 (EUR 104/mo, 16 cores, 128GB RAM) recommended.

## What Has Been Done (session 2026-03-29 to 2026-04-01)

- 222 issues completed by agent system
- 22 PRs reviewed and merged
- 104+ commits shipped to main
- Production VPS deployed with 73 commits
- 17 providers + 10 renters migrated from Supabase to production SQLite
- AI chat widget built (Claude Haiku + DCP knowledge base)
- Agent system fixed: CEO rewritten as proactive founder-CEO, escalation loops killed, heartbeats optimized
- Release Engineer given autonomous merge authority
- Hermes Agent installed and connected to Telegram
- Nextcloud deployed at files.dcp.sa with DCP branding
- Server stabilized: stopped non-essential containers, load from 34 to 0.5

## Naming

- The project is **DCP** (Decentralized Compute Platform). Never call it "DC-1" or "DC1".
- The company entity uses "DCP" in all communications.

## Deployment Rules

- **Production deploys require founder approval** (Peter).
- After approval: `cd /home/ubuntu/workspaces/dc1-platform && git pull origin main && cd backend && npm ci && pm2 restart dc1-provider-onboarding`
- Verify: `curl http://localhost:8083/api/health`
- Frontend deploys automatically via Vercel on push to main.
