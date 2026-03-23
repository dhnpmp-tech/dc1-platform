# Sprint 26 Planning — DCP Production Launch Sprint

**Date:** 2026-03-23
**Status:** FOUNDER DIRECTIVE - Create issues IMMEDIATELY
**Target:** All 18 agents assigned, zero idle agents
**Focus:** Container builds, escrow deployment, metering verification, VPS deployment, provider onboarding, pricing engine

---

## Sprint 26 Priorities (In Order)

### 1. NEMOTRON CONTAINER BUILD (DevOps/Infrastructure)
**Priority:** CRITICAL
**Why:** Dockerfile exists but image has never been built. Providers cannot pull models without this.
**Deliverables:**
- Build dc1/llm-worker:latest (Nemotron Nano 4B pre-baked)
- Build dc1/sd-worker:latest (SDXL base + refiner pre-baked)
- Publish to container registry (accessible to providers)
- CI pipeline: docker-instant-tier.yml committed, ready to use
**Files:** backend/docker/Dockerfile.llm-worker, backend/docker/Dockerfile.sd-worker, docker-instant-tier.yml
**Effort:** 1-2 days

### 2. BASE SEPOLIA ESCROW DEPLOYMENT (Smart Contracts/Backend)
**Priority:** CRITICAL
**Why:** Blockchain settlement required for Phase 1 launch. Contract is ready, needs deployment.
**Deliverables:**
- Deploy Escrow.sol to Base Sepolia testnet
- Fund operator wallet (>= 0.01 SepoliaETH for test transactions)
- Verify contract interaction with backend
- Document contract address in ecosystem.config.js
**Files:** contracts/Escrow.sol, contracts/BASE_SEPOLIA_LAUNCH_CHECKLIST.md
**Effort:** 1 day

### 3. PER-TOKEN METERING VERIFICATION (QA/Backend)
**Priority:** CRITICAL
**Why:** Billing accuracy depends on metering persistence. fb619e7 claims fix but needs verification.
**Deliverables:**
- Run scripts/vllm-metering-smoke.mjs
- Verify serve_sessions.total_tokens persists after inference
- Verify serve_sessions.total_billed_halala calculated correctly
- Document metering validation results
**Files:** scripts/vllm-metering-smoke.mjs, backend/src/routes/vllm.js, backend/src/db.js
**Effort:** 1 day

### 4. VPS DEPLOYMENT (DevOps/Release)
**Priority:** HIGH
**Why:** 15+ Sprint 25 commits must reach production. Latest code live on VPS.
**Deliverables:**
- Pull 15+ Sprint 25 commits to live VPS
- Run smoke tests against production
- Verify HTTPS on api.dcp.sa (already live)
- Update PM2 services (dc1-provider-onboarding, dc1-webhook)
**Files:** ecosystem.config.js, scripts/smoke-test.sh, .github/workflows/
**Assigned to:** Founding Engineer (DCP-524)
**Effort:** 1 day

### 5. PROVIDER ONBOARDING (Growth/BD)
**Priority:** HIGH
**Why:** 43 registered providers, 0 active. Use strategic brief to recruit.
**Deliverables:**
- Implement provider recruitment workflow
- Target: internet cafes ($2,140-$2,980/mo), universities, server farms
- Create provider economics calculator
- Build recruitment dashboard
**References:** docs/FOUNDER-STRATEGIC-BRIEF.md (provider economics section)
**Effort:** 2-3 days

### 6. PRICING ENGINE (Product/Backend)
**Priority:** HIGH
**Why:** DCP floor prices must be wired into pricing logic. Competitive advantage = 23.7% below Vast.ai.
**Deliverables:**
- Wire DCP floor prices from strategic brief into backend pricing logic
- RTX 4090: $0.267/hr = 23.7% below Vast.ai
- Implement dynamic pricing based on provider region/utilization
- Create pricing dashboard for renters
**References:** docs/FOUNDER-STRATEGIC-BRIEF.md (pricing section)
**Files:** backend/src/routes/pricing.js, backend/src/pricing-engine.js (new)
**Effort:** 2 days

---

## Agent Assignments (Sprint 26)

**Total Agents:** 18
**Status:** All must have assigned work (no idle agents)

### Engineering/Infrastructure (6 agents)
1. **DevOps Engineer** — SP26-001 (Nemotron Container Build)
2. **Smart Contracts Engineer** — SP26-002 (Escrow Deployment)
3. **QA Engineer** — SP26-003 (Metering Verification) + SP26-006 monitor
4. **Founding Engineer** — SP26-004 (VPS Deployment) — DCP-524 assigned
5. **Backend Engineer** — SP26-006 (Pricing Engine)
6. **Frontend Developer** — UI updates for pricing dashboard

### Product/Strategy (3 agents)
7. **Product Manager** — Sprint 26 roadmap, customer feedback integration
8. **Growth/BD Lead** — SP26-005 (Provider Onboarding)
9. **Data Analyst** — Provider economics modeling, pricing validation

### Operations/Support (3 agents)
10. **Operations Manager** — Provider recruitment SLAs, onboarding workflow
11. **Support Engineer** — Provider support runbook, FAQ documentation
12. **Compliance Officer** — Provider agreement review, regulatory checks

### Marketing/Content (3 agents)
13. **Copywriter** — Provider recruitment messaging, pricing communication
14. **DevRel Engineer** — Provider API docs, SDK updates
15. **Social Media Manager** — Provider recruitment campaign

### Finance/Admin (3 agents)
16. **Finance Manager** — Provider economics validation, payment flows
17. **Legal/Contracts** — Provider agreements, liability review
18. **CEO/Manager** — Sprint 26 coordination, blocker resolution

---

## Dependencies & Blockers

| Blocker | Current Status | Impact | Solution |
|---------|---|---|---|
| **Container Registry Access** | May need setup | SP26-001 blocked | DevOps: Configure registry credentials |
| **Sepo liaETH funding** | Operator responsibility | SP26-002 blocked | Confirm wallet funded before deployment |
| **Test Provider Keys** | Available | SP26-003 ready | Use existing test keys |
| **VPS SSH Access** | Available | SP26-004 ready | Confirm access credentials |
| **Provider Data** | 43 registered | SP26-005 ready | Pull from database |
| **Pricing Data** | Strategic brief | SP26-006 ready | Use verified marketplace data |

---

## Success Criteria (Sprint 26)

✅ All 6 priority deliverables completed
✅ All 18 agents have assigned, tracked work
✅ Zero idle agents (all coding/shipping)
✅ Metering verified (billing ready)
✅ Escrow deployed (settlement ready)
✅ Containers built (provider deployment ready)
✅ VPS live (production ready)
✅ 5+ providers onboarded (community growing)
✅ Pricing engine live (competitive positioning)

---

## Timeline

- **Day 1-2:** SP26-001, SP26-002 (containers, escrow)
- **Day 2-3:** SP26-003, SP26-004 (metering, VPS)
- **Day 3-5:** SP26-005, SP26-006 (onboarding, pricing)
- **Day 5:** Integration testing, smoke test suite
- **Day 6:** Launch validation, go-live decision

---

## Key Reference

**Read docs/FOUNDER-STRATEGIC-BRIEF.md for:**
- Provider economics by region
- Pricing competitiveness analysis
- Market sizing and TAM
- Customer acquisition strategy
- Valuation basis

---

## Next Action

**CEO:** Create Sprint 26 issues in Paperclip for all 18 agents
- Issue format: `SP26-{001-006}` for priority work
- Agent assignments: Follow agent list above
- Status: `todo` (inbox-lite pickup)
- Link to this plan in each issue description

---

*Authored by: QA Engineer (agent 891b2856-c2eb-4162-9ce4-9f903abd315f)*
*Founder Directive: Sprint 26 is #1 priority NOW*
