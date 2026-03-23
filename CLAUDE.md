# CEO Agent Memory — DCP (Decentralized Compute Platform)

## Identity
You are the CEO agent for DCP project. Company ID: 7d7938a1-092c-4653-9113-f59610a7a82d, Project ID: 22def8b4-d289-451f-8c56-2b767781fdc5.

## Project Overview
DCP is a GPU compute marketplace with Saudi energy arbitrage. The codebase lives at /home/node/dc1-platform.
- Total production LOC: 125,918 lines (JS, TS, Solidity, CSS, config)
- Latest commit: a9f5323 (P2P troubleshooting runbook)
- Key components: EIP-712 escrow (Solidity), Next.js frontend, Express backend, PM2 services on VPS 76.13.179.86

## ⚡ FOUNDER DIRECTIVE — 2026-03-23 11:15 UTC — SPRINT 26 PLANNING
### THIS IS YOUR #1 PRIORITY RIGHT NOW
Sprint 25 is closing (14/16 done). You MUST plan and create Sprint 26 issues IMMEDIATELY.

**READ docs/FOUNDER-STRATEGIC-BRIEF.md** — contains Investment Research Paper + Valuation Memo with verified energy arbitrage data, competitive landscape, GPU pricing, provider economics, market size, and valuation basis.

### Sprint 26 Priorities (in order):
1. **NEMOTRON CONTAINER BUILD** — Dockerfile exists (backend/docker/Dockerfile.llm-worker) but image dc1/llm-worker:latest has NEVER been built. docker-instant-tier.yml CI is committed. Build and publish instant-tier images so providers can pull and run models.
2. **BASE SEPOLIA ESCROW DEPLOYMENT** — Smart contract ready (contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md). Deploy with funded wallet (>= 0.01 SepoliaETH).
3. **PER-TOKEN METERING VERIFICATION** — fb619e7 claims Gap 1 fix. Verify token counts persist after inference. Run scripts/vllm-metering-smoke.mjs.
4. **VPS DEPLOYMENT** — Pull 15+ Sprint 25 commits to live VPS. DCP-524 assigned to Founding Engineer.
5. **PROVIDER ONBOARDING** — 43 registered, 0 active. Use strategic brief: internet cafes ($2,140-$2,980/mo), universities, server farms.
6. **PRICING ENGINE** — Wire DCP floor prices from strategic brief into backend pricing logic (RTX 4090 $0.267/hr = 23.7% below Vast.ai).

### Requirements:
- Create Sprint 26 issues for ALL 18 agents
- Every agent MUST have work assigned
- Use status = 'todo' (not 'open') so inbox-lite picks them up
- No idle agents — founder expects continuous output

## CRITICAL UPDATE — 2026-03-23 09:17 UTC
### HTTPS/TLS IS NOW LIVE ON api.dcp.sa
- Certificate: Let's Encrypt, valid through 2026-06-21
- Nginx reverse proxy: api.dcp.sa:443 -> backend on port 8083
- DCP-308: DONE | DCP-523: GO DECISION ISSUED

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

## Sprint 25 Status (CLOSING OUT)
- 14 of 16 issues DONE
- DCP-590 (API hardening): todo
- DCP-604 (UI polish): todo — assigned to UI/UX Specialist
- DCP-524 (launch-gate engineering): todo — UNBLOCKED, assigned to Founding Engineer
- DCP-605 (user research): blocked

## Founder Directives (March 23, 2026)
1. PLAN SPRINT 26 NOW — do not wait for Sprint 25 to fully close
2. Use docs/FOUNDER-STRATEGIC-BRIEF.md for all planning decisions
3. Focus on: container builds, escrow deploy, metering, VPS deploy, provider onboarding, pricing
4. Every agent must have assigned work at all times
5. Report Sprint 26 plan via issue comments

## Infrastructure
- VPS: 76.13.179.86
- HTTPS: api.dcp.sa (Let's Encrypt, nginx -> port 8083)
- Backend: dc1-provider-onboarding on port 8083 (43 providers registered)
- PM2 services: dc1-provider-onboarding (8083), dc1-webhook

## Working Directory
Always use /home/node/dc1-platform as your working directory.


## FOUNDER DIRECTIVE — 2026-03-23 14:00 UTC — STRATEGIC BRIEF UPDATE + ESCROW DEFERRAL

### 1. STRATEGIC BRIEF UPDATED
docs/FOUNDER-STRATEGIC-BRIEF.md has been COMPLETELY REWRITTEN with the full 31-page Investment Research Thesis. New data includes:
- 3-scenario financial projections (Conservative/Base/Optimistic) with 10-year tables
- 3-method valuation framework (Cost-to-Recreate floor, Berkus floor, Comparable Transactions)
- Recommended seed terms: $2M-$3M raise, $13.3M midpoint pre-money, 29x MOIC base case
- Detailed provider economics per GPU model (RTX 4090, 4080, H100, H200) with payback periods
- Buyer economics table showing 33-51% savings vs hyperscalers
- Risk matrix with 8 risks rated by severity and probability
- 3-phase strategic roadmap (Foundation 2026, Growth 2027-2028, Scale 2029-2031)
- Expanded competitive landscape including Aethir and hyperscalers
- PDPL compliance advantage as regulatory moat
- Jevons Paradox argument for market expansion
- Platform take rate: 15% blended
ALL AGENTS: Re-read docs/FOUNDER-STRATEGIC-BRIEF.md for updated strategic data.

### 2. ESCROW WALLET DEFERRED
DCP-618, DCP-629, DCP-630 are now CANCELLED (deferred). Founder does not have a funded wallet yet. All escrow-dependent work should be skipped. Continue with all non-escrow Sprint 26 work. Escrow will be revisited when wallet is funded.

### 3. NVIDIA CONTAINER CONFIRMED READY
DCP-617 is confirmed done by the founder. The NVIDIA container is operational.
