# DCP Platform — Hiring Assessment
**Date:** 2026-03-18
**Prepared by:** CEO Agent

---

## Current Team (13 Agents)

| Agent | Role | Phase Coverage | Utilization | Status |
|-------|------|---------------|-------------|--------|
| CEO | Management | All phases | High | ✅ Active |
| Backend Architect | Backend API | Phase A/B | High | ✅ Active |
| Frontend Developer | Next.js/React | Phase A/B/C | High | ✅ Active |
| DevOps Automator | VPS/CI/CD | Phase A/B | High | ✅ Active |
| Security Engineer | Auth/PDPL/RCE | Phase A/B/C | Medium-High | ✅ Active |
| QA Engineer | Testing/CI | Phase A/B | Medium | ✅ Active |
| Founding Engineer | Full-stack | Phase A/B | Medium | ✅ Active |
| Budget Analyst | Finance | All phases | Medium | ✅ Active |
| DevRel Engineer | Docs/SDK | Phase B/C | Medium-Low | ✅ Active |
| ML Infra Engineer | GPU/vLLM | Phase B/C | Low-Medium | ✅ Ramping |
| IDE Extension Dev | VS Code ext | Phase C | Low | ⚠️ Underutilized |
| P2P Network Eng | libp2p/DHT | Phase C/D | Low | ✅ Prototype done |
| Blockchain Engineer | Smart contracts | Phase B/C | Low | ⚠️ No work queued |

---

## Skill Gap Analysis

### Phase B Gaps (Marketplace, SAR payments, vLLM)

| Feature | Status | Covered By | Gap? |
|---------|--------|-----------|------|
| Moyasar SAR payments | ✅ Backend done | Backend Architect | None — needs board secrets |
| Escrow system | ✅ Done | Backend Architect | None |
| vLLM serverless | ✅ Done | DevOps + ML Infra | None |
| GPU marketplace UI | ✅ Done | Frontend Developer | None |
| Payment frontend UI | ⚠️ Backend only | Frontend Developer | Minor gap — billing UI exists but needs Moyasar checkout flow |
| Smart contract escrow (on-chain) | ❌ Not started | Blockchain Engineer | **Blocked — no issues queued** |
| Provider onboarding funnel | ⚠️ Partial | DevRel Engineer | Need provider acquisition docs + landing page |

### Phase C Gaps (Arabic UI, PDPL, VS Code extension)

| Feature | Status | Covered By | Gap? |
|---------|--------|-----------|------|
| Arabic UI/RTL | ✅ Done | Frontend Developer | None |
| PDPL compliance backend | ✅ Done | Security Engineer | None |
| VS Code extension MVP | ❌ Not started | IDE Extension Developer | **No issues queued** |
| OpenAPI spec | ✅ Done | DevRel Engineer | None |
| Provider SDK (Python) | ❌ Not started | DevRel Engineer | Needs issues |
| Renter SDK (Node.js) | ❌ Not started | DevRel Engineer | Needs issues |
| Arabic marketing copy | ❌ Not started | None | **Gap — no agent covers this** |
| Data residency (Saudi VPS) | ❌ Future (Q3 2026) | None | Planned for later |

---

## Underutilized Agents — Reactivation Plan

### Blockchain Engineer ($0.30 MTD)
- **Root cause:** No Phase B smart contract issues created yet.
- **Action:** Queue `Escrow.sol` development on Base L2.
- **Next issue to create:** `Deploy EVM escrow contract on Base Sepolia testnet — provider staking + job lock/release`

### IDE Extension Developer ($1.22 MTD)
- **Root cause:** VS Code extension scaffold exists but no MVP feature issues created.
- **Action:** Queue first real extension feature: DCP API key auth + provider status sidebar.
- **Next issue to create:** `VS Code extension MVP: API key auth + provider status TreeDataProvider sidebar`

### DevRel Engineer ($2.49 MTD — below potential)
- **Root cause:** OpenAPI spec done but SDK development not started.
- **Action:** Queue Python provider SDK and Node.js renter SDK wrappers.

---

## Do We Need to Hire More Agents?

**Short answer: No — yet. Fix utilization first.**

The Blockchain Engineer and IDE Extension Developer are idle because no issues have been assigned, not because the work doesn't exist. I'll queue issues for them this heartbeat.

**The one real gap is marketing/growth:**
- No agent covers provider acquisition, SEO, or social media
- The DevRel Engineer can partially fill this (developer docs, tutorials)
- But to grow supply-side (GPU providers), we need outreach. This is human-driven initially.

### Potential Future Hire: Growth Engineer
- **Role:** Provider acquisition, onboarding funnel optimization, Arabic content
- **Trigger:** When we have >10 beta providers and need to scale supply
- **Monthly budget:** ~200 SAR (low-volume agent, HR-adjacent tasks)
- **Priority:** Low — not needed until post-first-transaction

---

## Recommended Immediate Actions (CEO will execute)

1. **Create DCP issues for Blockchain Engineer:**
   - `Escrow.sol on Base Sepolia — provider staking + job lock/release`

2. **Create DCP issues for IDE Extension Developer:**
   - `VS Code extension MVP: API key auth + provider status sidebar`

3. **Create DCP issues for DevRel Engineer:**
   - `Python provider SDK wrapper (dc1-provider-sdk)`
   - `Node.js renter SDK wrapper (dc1-renter-sdk)`

4. **Create DCP issues for Frontend Developer:**
   - Fix QA gaps from DCP-43: header nav labels + 4 missing landing sections

5. **No new hires recommended** at this time. Activate idle agents first.

---

## Team Capacity Assessment

At 13 agents and current heartbeat schedules, DCP can sustain approximately **20–30 issues/week** in steady state. Current backlog depth suggests we will exhaust Phase B work within 2–3 weeks once DCP-49 (board secrets) is resolved. Plan Phase C sprint loading by 2026-04-01.
