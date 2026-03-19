# DCP Platform — Next Sprint Plan
**Date:** 2026-03-19
**Sprint:** April 2026 (Sprint 2)
**Prepared by:** CEO

---

## Strategic Context

Phase A (core infrastructure) is complete. Phase B code is complete but dark — blocked on 3 board actions (DCP-84, DCP-85, DCP-87). Once the board completes those 3 actions (~45 minutes), DCP is functionally live with: SAR payments, GPU marketplace, vLLM serverless, off-chain escrow, and published SDKs.

**Sprint 2 goal: Phase B goes live. First paying renters and providers.**

---

## Priority 1: Board Actions (Unlock Everything)

These are NOT agent tasks — they require board SSH access and account credentials. Agents are blocked until these are done.

| Action | Issue | Time | Unlocks |
|--------|-------|------|---------|
| SSH → git pull + pm2 reload on VPS | DCP-87 | 30 sec | ALL Phase B backend routes |
| SSH → set MOYASAR_SECRET_KEY, rotate admin token | DCP-84 | 10 min | SAR payments, security |
| Fix api.dcp.sa DNS → 76.13.179.86 | DCP-84 | 5 min | HTTPS, SDK default URL |
| npm automation token + PyPI API token | DCP-85 | 5 min | SDK publishing |

---

## Priority 2: First Week Agents (Once Board Unlocks)

### Backend Architect
- **DCP-NEW:** Moyasar sandbox payment end-to-end test — validate full topup → webhook → balance credit flow using sk_test_ keys
- **DCP-NEW:** Provider withdrawal flow — test `POST /providers/withdraw` with claimable_earnings_halala against live escrow system
- **DCP-NEW:** Job timeout sweep — verify expired escrow holds are auto-released and renter balance refunded

### DevOps Automator
- **DCP-NEW:** HTTPS setup — once api.dcp.sa DNS is fixed, run `sudo bash infra/nginx/setup-https.sh api.dcp.sa admin@dcp.sa` on VPS
- **DCP-NEW:** Vercel env var — set `BACKEND_URL=https://api.dcp.sa` in Vercel project settings after HTTPS is live
- **DCP-NEW:** Telegram alerting — configure `POST /admin/notifications/config` with Telegram Bot token for production alerts (bot already coded in DCP-4C)

### QA Engineer
- **DCP-NEW:** Moyasar sandbox E2E test — submit payment, verify webhook, confirm balance credit, verify job submission succeeds
- **DCP-NEW:** Full provider lifecycle test — register → daemon install → heartbeat → job assigned → complete → earnings → withdraw
- **DCP-NEW:** SDK smoke test — `npm install dc1-renter-sdk` and `pip install dc1` against https://api.dcp.sa after publish

### DevRel Engineer
- **DCP-83:** Publish dc1-renter-sdk to npm (unblocked by DCP-85)
- **DCP-NEW:** Publish dc1 Python SDK to PyPI (unblocked by DCP-85)
- **DCP-NEW:** Provider onboarding guide update — document dc1_provider Python SDK in provider-guide; update daemon download instructions with new HMAC requirement

### Frontend Developer
- **DCP-NEW:** Wire renter billing /topup to real Moyasar checkout URL — currently shows a form; needs to redirect to Moyasar-hosted payment page on submit
- **DCP-NEW:** Payment success/failure page at `/renter/billing/confirm` — poll `GET /api/payments/verify/:id` after Moyasar redirect back
- **DCP-NEW:** Arabic UI rebuild (Phase C) — attempt 2 with build-safe approach; i18n.tsx previously broke build. Use next-intl or a simpler string-table approach that doesn't require new npm packages

---

## Priority 3: Second Week Agents

### Blockchain Engineer
- **DCP-88:** Deploy Escrow.sol to Base Sepolia testnet (needs board: deployer wallet + test ETH)
- **DCP-NEW:** Integrate deployed contract address — once deployed, add `ESCROW_CONTRACT_ADDRESS` to ecosystem.config.js, reload PM2, verify ChainEscrowService shows isEnabled=true

### Security Engineer
- **DCP-NEW:** PDPL compliance review (Phase C) — Saudi Personal Data Protection Law audit of DCP's data handling: what PII is stored, retention policy, consent flows, cross-border data transfer (Supabase US region). Produce a gap analysis.
- **DCP-NEW:** Admin token rotation confirmation — verify new DC1_ADMIN_TOKEN is set after board completes DCP-84; confirm old token no longer works

### ML Infrastructure Engineer
- **DCP-NEW:** vLLM serve provider test — set up vllm/vllm-openai container on the Ampere GPU (already in OPEX), run a test job, confirm endpoint_url is returned and OpenAI-compatible endpoint works
- **DCP-NEW:** Document VRAM requirements — update docs for each supported model (TinyLlama-1.1B, Mistral-7B, Llama-3-8B, Phi-3-mini, Gemma-2B-it) with actual observed VRAM usage

### P2P Network Engineer (Phase C — lower priority)
- **DCP-NEW:** Provider announce hook — wire `p2p/provider-announce.js` into the daemon heartbeat (subprocess call on each heartbeat) so providers self-announce to the DHT in production
- **DCP-NEW:** Bootstrap node setup — deploy a public bootstrap node on VPS for DHT seeding

### IDE Extension Developer (Phase C)
- **DCP-NEW:** VS Code extension publish prep — generate Publisher ID on VS Code Marketplace, prepare `vsce package`, create CHANGELOG.md, submit to Marketplace
- Note: Extension scaffold already built; publish requires VS Code Marketplace account

---

## Priority 4: Growth / DevRel

### DevRel Engineer
- **DCP-NEW:** Provider acquisition content — write "How to earn SAR with your GPU" blog post in Arabic + English; post to Saudi tech communities (Hsoub, LinkedIn Saudi Tech)
- **DCP-NEW:** GitHub repo polish — add README badges (CI, npm version, PyPI), link to docs, add contributing guide. Target: stars from Saudi ML community.
- **DCP-NEW:** OpenAPI spec refresh — update `docs/openapi.yaml` to include all Phase B endpoints (payments, escrow, templates, vLLM serve, gpu-metrics)

---

## Agent Heartbeat Schedule (Cost Optimized)

| Agent | Interval | Rationale |
|-------|----------|-----------|
| CEO | 15 min | Git relay + orchestration |
| Backend Architect | 1 hr | Active Phase B backend work |
| QA Engineer | 1 hr | Continuous test coverage |
| Frontend Developer | 1 hr | Moyasar UI + Arabic UI |
| DevOps Automator | 4 hr | VPS work mostly board-blocked |
| Security Engineer | 2 hr | PDPL audit + token rotation |
| DevRel Engineer | 4 hr | SDK publish + content |
| ML Infrastructure Engineer | 2 hr | vLLM provider test |
| Founding Engineer | 1 hr | Full-stack ownership |
| Budget Analyst | 4 hr | Monthly cost report cadence |
| Blockchain Engineer | daily | Waiting on board for testnet ETH |
| P2P Network Engineer | daily | Phase C, lower priority |
| IDE Extension Developer | daily | Phase C, lower priority |

---

## Sprint 2 Success Criteria

1. ✅ `https://api.dcp.sa` returns JSON API info (Phase A complete)
2. ✅ Moyasar sandbox payment → balance credit → job submission works end-to-end
3. ✅ dc1-renter-sdk published on npm (`npm install dc1-renter-sdk` works)
4. ✅ dc1 SDK published on PyPI (`pip install dc1` works)
5. ✅ At least 1 vLLM serve job runs on a real GPU (provider with ≥14GB VRAM)
6. ✅ Escrow.sol deployed to Base Sepolia, contract address set in ecosystem.config.js
7. ✅ Arabic UI renders on dcp.sa with EN↔AR toggle (Phase C)
8. ✅ First external provider registers via dc1_provider SDK

---

## Revenue Milestone

**Target for Sprint 2:** First paid job.
- 1 external provider with GPU registered and daemon running
- 1 renter tops up 50 SAR via Moyasar mada/credit card
- 1 GPU job runs, completes, provider earns 37.5 SAR (75%), DCP earns 12.5 SAR (25%)

DCP takes 25% fee. Break-even on current OPEX (2,956 SAR/mo) requires ~24 SAR/hr in GPU compute throughput continuously — achievable with 3-4 active GPU providers.
