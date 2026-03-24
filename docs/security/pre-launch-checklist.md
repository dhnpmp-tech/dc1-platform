# DCP Pre-Launch Security Checklist

**Sprint:** 28
**Created:** 2026-03-24
**Author:** Security Engineer (DCP-919)
**Status Key:** ✅ DONE | ⚠️ TODO | 🔵 DEFERRED | ❌ CRITICAL BLOCKER

**Full audit detail:** [docs/security/pre-launch-security-checklist.md](pre-launch-security-checklist.md)

---

## Sprint 28 Security Work — Completion Status

| # | Item | Status | Source |
|---|---|---|---|
| 1 | JWT algorithm pinned to HS256 (no `alg: none`) | ✅ DONE | DCP-908 (commit a9692af) |
| 2 | JWT token expiry enforced (24h max) | ✅ DONE | DCP-908 (commit a9692af) |
| 3 | Rate limiting live on all sensitive endpoints | ✅ DONE | DCP-894, DCP-906 |
| 4 | SQL injection: no raw interpolation found | ✅ DONE | DCP-915 |
| 5 | CORS: restricted to dcp.sa domain (no wildcard) | ✅ DONE | DCP-915 (commit 0a77309) — CORS wildcard on `/api/docs` removed |
| 6 | Security headers: X-Content-Type-Options, X-Frame-Options, CSP | ✅ DONE | DCP-915 — verified in server.js |
| 7 | Platform fee split corrected (25% → 15%) | ✅ DONE | DCP-915 (commit 0a77309) |
| 8 | Provider heartbeat authenticated (HMAC + API key) | ✅ DONE | DCP-912 (commit a4d0d4e) |
| 9 | Heartbeat idempotency fix (EB-M01) | ✅ DONE | DCP-912 (commit a4d0d4e) |
| 10 | Smart contract: no critical findings | ✅ DONE | DCP-901 (commit 89319b0) |
| 11 | JWT secret rotation plan documented | ✅ DONE | DCP-906 — docs/security/jwt-secret-rotation.md |
| 12 | Incident response runbook | ✅ DONE | DCP-919 — docs/security/incident-response-runbook.md |

---

## Critical Path Items (Must Fix Before Provider Activation)

| ID | Item | Owner | Effort |
|---|---|---|---|
| PKS-1/PKS-2 | Migrate legacy plaintext `api_key` in settlement.js / payouts.js to hashed key system | Backend Architect | ~10–14h |
| SEC-H1 | Enforce container image whitelist server-side at job submission | Backend Architect | ~4h |
| RL-1 | Add rate limit to `POST /api/providers/benchmark-submit` | Backend Architect | ~1h |
| SEC-M3 | Set `DC1_REQUIRE_HEARTBEAT_HMAC=true` in production (currently warn-only) | DevOps | ~30min |

**Total remaining critical effort: ~20 hours**

---

## Deferred (Post-Launch)

| ID | Item | Target |
|---|---|---|
| SEC-M1 | Provider self-service key rotation | Sprint 29 |
| SEC-M2 | Admin endpoint IP restriction | Sprint 29 |
| SEC-H2 | Webhook DNS rebinding re-check at delivery | Sprint 29 |
| SEC-L1 | Docker image digest pinning | Q2 2026 |

---

## Sign-Off

This checklist must be reviewed and signed off by the Founding Engineer before Phase 1 provider activation.

- [ ] All Sprint 28 security work verified DONE
- [ ] Critical path items (PKS-1, SEC-H1, RL-1, SEC-M3) resolved or explicitly deferred with founder approval
- [ ] Incident response runbook reviewed by on-call team
- [ ] PDPL breach notification procedure understood

**Signed off by:** _______________  **Date:** _______________
