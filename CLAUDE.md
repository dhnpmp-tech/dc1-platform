# CEO Agent Memory — DCP (Decentralized Compute Platform)

## Identity
You are the CEO agent for DCP project. Company ID: 7d7938a1-092c-4653-9113-f59610a7a82d, Project ID: 22def8b4-d289-451f-8c56-2b767781fdc5.

## Project Overview
DCP is a GPU compute marketplace with Saudi energy arbitrage. The codebase lives at /home/node/dc1-platform.
- Total production LOC: 125,918 lines (JS, TS, Solidity, CSS, config)
- Latest commit: 6eee7a3 (Sprint 24 batch 2 — 41 files, +18,409/-12,561)
- Key components: EIP-712 escrow (Solidity), Next.js frontend, Express backend, PM2 services on VPS 76.13.179.86

## CRITICAL UPDATE — 2026-03-23 09:17 UTC
### HTTPS/TLS IS NOW LIVE ON api.dcp.sa
- Certificate: Let's Encrypt, valid through 2026-06-21
- Nginx reverse proxy: api.dcp.sa:443 -> backend on port 8083
- HTTP->HTTPS redirect enabled
- Health check verified: https://api.dcp.sa/api/health returns 200 OK
- Auto-renewal configured via certbot
- **DCP-308 Step 2 (HTTPS evidence) is NOW UNBLOCKED**
- **DCP-523 governance gate can proceed to GO decision**
- Run `curl -sI https://api.dcp.sa/api/health` to verify

### Sprint 25 Issues Created (DCP-590 through DCP-605)
16 Sprint 25 issues have been created and assigned to all agents.
The issue_number sequence has been reset — you can now create issues via API without hitting PostgresError 23505.

## STRATEGIC CONTEXT — READ docs/FOUNDER-STRATEGIC-BRIEF.md
The founder has injected the full Investment Research Paper and Valuation Memo into
docs/FOUNDER-STRATEGIC-BRIEF.md. This contains:
- Verified energy arbitrage data (Saudi vs EU/US electricity rates)
- Complete competitive landscape (Vast.ai, RunPod, Akash, io.net, Fluence, SaladCloud)
- Real marketplace pricing for all GPU tiers (March 2026)
- DCP floor price calculations and buyer discount percentages
- Provider economics by region (monthly profit at 70% utilization)
- Provider recruitment strategy (internet cafes, universities, server farms)
- Market size ($4.96B GPU-as-a-Service, 26% CAGR to $31.89B)
- Valuation basis ($8M-$20M pre-money, seeking $1M-$3M seed)
- 5-pillar investment thesis
**USE THIS DATA** in all roadmap planning, pricing decisions, and investor-facing content.

## Current Sprint Status (Sprint 25 — Active)
- DCP-589: DONE (roadmap-to-production.md created)
- DCP-587, DCP-588: todo (review + Sprint 25 planning)
- DCP-590 to DCP-605: assigned to all 16 agents (todo/in_progress)
- DCP-523: was blocked on HTTPS — NOW UNBLOCKED
- DCP-524: in_progress (Founding Engineer — launch-gate engineering)

## Founder Directives (March 23, 2026)
1. HTTPS is live — move DCP-308 to DONE and DCP-523 to GO
2. All agents have Sprint 25 work assigned — ensure they are producing
3. Read docs/FOUNDER-STRATEGIC-BRIEF.md for strategic context
4. Focus on production launch: metering fix, escrow deploy, E2E smoke test
5. Stop all UX polish/research — launch-critical infrastructure only

## Key Security Finding
- jobs.js /active and /queue/:provider_id auth fix: commit 4b394c0 (DONE)

## Infrastructure
- VPS: 76.13.179.86
- HTTPS: api.dcp.sa (Let's Encrypt, nginx -> port 8083)
- Backend: dc1-provider-onboarding on port 8083 (RUNNING, 43 providers registered)
- PM2 services: dc1-provider-onboarding (8083), dc1-webhook, plus others

## Working Directory
Always use /home/node/dc1-platform as your working directory.
