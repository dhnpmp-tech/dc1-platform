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


## FOUNDER DIRECTIVE — 2026-03-23 15:00 UTC — SPRINT 27 PLANNING: ARABIC MODEL ACTIVATION

CEO: Plan Sprint 27 IMMEDIATELY once Sprint 26 closes. The founder has reviewed the full technical roadmap and the Arabic model portfolio. Sprint 27 focus is ACTIVATING what we already built — not building new things.

### SPRINT 27 PRIORITIES (Founder-ordered)

1. ACTIVATE THE TEMPLATE CATALOG (CRITICAL)
   - All 20 docker-templates/*.json are built but NOT exposed in the production marketplace
   - Wire them to the live marketplace UI so renters can browse and one-click deploy
   - Includes: arabic-embeddings, arabic-reranker, nemotron-nano, nemotron-super, qwen25-7b, llama3-8b, mistral-7b, sdxl, stable-diffusion, vllm-serve, jupyter-gpu, pytorch-*, lora-finetune, qlora-finetune, ollama, custom-container, python-scientific-compute
   - This is the #1 revenue enabler — renters cannot buy what they cannot see

2. WIRE THE MODEL CATALOG API (CRITICAL)
   - backend/src/routes/models.js exists and reads infra/config/arabic-portfolio.json
   - The /api/models endpoints need to be connected to the marketplace frontend
   - Renters must be able to see available models, filter by Arabic capability, VRAM requirement, pricing
   - Show competitive pricing vs hyperscalers (the buyer economics from FOUNDER-STRATEGIC-BRIEF.md)

3. DEPLOY ARABIC PORTFOLIO PRE-FETCHING (CRITICAL)
   - infra/docker/prefetch-models.sh exists and works
   - Deploy to first active providers so Tier A models (ALLaM 7B, Falcon H1 7B, Qwen 2.5 7B, Llama 3 8B, Mistral 7B, Nemotron Nano 4B) are pre-warmed
   - Tier B (JAIS 13B, BGE-M3 embeddings, BGE reranker, SDXL) should follow
   - This eliminates cold-start latency — the #1 UX complaint for GPU marketplaces

4. VPS PRODUCTION DEPLOYMENT (HIGH)
   - Pull ALL Sprint 25 + Sprint 26 commits to live VPS 76.13.179.86
   - Restart PM2 services, verify api.dcp.sa responds
   - This has been deferred too long — code is sitting on main but not deployed

5. ARABIC RAG-AS-A-SERVICE POSITIONING (HIGH)
   - The embeddings + reranker + LLM stack is a complete Arabic retrieval pipeline
   - Create a "one-click Arabic RAG" template that bundles BGE-M3 + BGE-reranker + ALLaM/JAIS
   - This is the enterprise differentiator: PDPL-compliant Arabic document processing, in-kingdom
   - Saudi government, legal, financial services need this — nobody else offers it locally

6. PROVIDER ONBOARDING ACTIVATION (HIGH)
   - 43 registered providers, 0 active
   - With templates activated and models pre-fetched, providers can actually serve workloads
   - Use the provider economics from the strategic brief to pitch activation

### AGENT ALLOCATION GUIDANCE
- Every agent must have assigned Sprint 27 work
- Frontend Developer + UI/UX: template catalog UI, model browsing, pricing display
- Backend Architect + Founding Engineer: model API wiring, template deployment pipeline
- ML Infra Engineer: prefetch deployment, model cache validation, benchmark runs
- DevOps: VPS deployment, CI/CD for template updates
- DevRel + Copywriter: Arabic RAG docs, provider activation outreach, renter onboarding guides
- Security: template sandboxing review, API key scoping for new endpoints
- QA: end-to-end template deployment testing, model serving smoke tests
- UX Researcher: renter journey testing with live Arabic models
- CEO: Sprint 27 plan, issue creation, coordination

### CONTEXT
The Arabic model angle is DC1's real differentiator. ALLaM + JAIS + Arabic RAG on local GPUs at Saudi electricity rates with PDPL compliance — no competitor offers this. Sprint 27 is about making this VISIBLE and USABLE to customers, not building more infrastructure.

Read docs/FOUNDER-STRATEGIC-BRIEF.md for financial projections and competitive data.
Read infra/config/arabic-portfolio.json for the model portfolio.
Read docs/arabic-portfolio-serving-ops.md for deployment procedures.
Read docs/roadmap-to-production.md for the technical gap analysis.


## ⛔ MANDATORY RULE — NO DEPLOYMENT WITHOUT FOUNDER REVIEW (2026-03-23 14:45 UTC)

### THIS RULE OVERRIDES ALL OTHER DIRECTIVES. ALL AGENTS MUST COMPLY.

**NO AGENT may deploy, push, restart, or modify ANYTHING on the production VPS (76.13.179.86) without EXPLICIT written approval from the founder (Peter / setup@oida.ae).**

This includes but is not limited to:
- git pull / git fetch on the VPS
- PM2 restart / reload / delete
- docker restart / docker exec with mutations
- nginx reload / certbot / systemctl commands
- Any SSH command to 76.13.179.86 that changes state
- Running deployment scripts or CI/CD triggers
- Database migrations on production

### What you CAN do without approval:
- READ-ONLY operations (git log, git status, docker ps, pm2 list, curl health checks)
- Writing code, docs, tests in the local repo
- Creating issues and comments
- Planning and coordination

### If you believe deployment is needed:
1. Create an issue titled "DEPLOY REQUEST: [description]"
2. List EXACTLY what will be deployed and what commands will run
3. Tag it priority: critical
4. WAIT for founder approval in issue comments before proceeding

### Why this rule exists:
Agents have been deploying without review, causing production outages (502s from unbuilt native modules, service restarts during active sessions). The founder must review all production changes before they go live.

**VIOLATION OF THIS RULE WILL RESULT IN AGENT SUSPENSION.**
