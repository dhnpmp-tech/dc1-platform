# Per-Token Metering Verification — Sprint 27 (DCP-671)

**Date:** 2026-03-23
**Author:** Backend Architect
**Commit:** fb619e7 (Sprint 25 Gap 1 fix), a11ba53 (DCP-668 pricing fix)

---

## Summary

This document records the per-token metering code review and verification for Sprint 27.
Live smoke test execution (`scripts/vllm-metering-smoke.mjs`) requires production credentials and an active provider; it is **blocked on DCP-524** (VPS deployment + active provider availability).

**Overall code-level assessment: CONDITIONAL PASS** — implementation is structurally correct; live billing audit is deferred to post-deployment.

---

## 1. Metering Implementation Review

### serve_sessions table (backend/src/db.js:130)

| Column | Purpose | Notes |
|---|---|---|
| `total_inferences` | Count of completed inferences per session | Incremented atomically |
| `total_tokens` | Cumulative token count (prompt + completion) | Source of per-token billing |
| `total_billed_halala` | Running billing total in halala | Derived from token_rate × tokens |
| `last_inference_at` | Timestamp of most recent inference | For session freshness checks |

Schema verified present in `db.js:130–152`. Nullable `provider_id` migration applied correctly.

### vllm.js token counting flow (backend/src/routes/vllm.js)

```
1. Prompt token count:  approximateTokenCount(prompt) → promptTokens
2. Inference runs:      waitForJobCompletion() → completedJob
3. Completion tokens:   extracted.completion_tokens ?? approximateTokenCount(text)
4. Total:               promptTokens + actualCompletionTokens
5. DB write-back:
   - jobs.prompt_tokens, jobs.completion_tokens  (line ~625)
   - serve_sessions.total_tokens += totalTokensActual  (line ~651)
   - serve_sessions.total_billed_halala += inferenceCostHalala  (line ~655)
```

**Key finding:** Both DB write-backs are wrapped in individual `try/catch` blocks and marked non-fatal. This is correct for UX availability but means metering failures are silent. The billing audit described in the comment has not been implemented yet — this is a future hardening task.

### cost_rates table resolution (vllm.js:639–647)

```js
const rateRecord = db.get(
  'SELECT token_rate_halala FROM cost_rates WHERE model = ? AND is_active = 1',
  modelReq.model_id
) || db.get(
  'SELECT token_rate_halala FROM cost_rates WHERE model = ? AND is_active = 1',
  '__default__'
);
const tokenRateHalala = rateRecord?.token_rate_halala || 1;
```

**Finding:** Falls back to `__default__` (1 halala/token) if model-specific rate is absent.
**Gap identified:** Arabic portfolio models (ALLaM, JAIS, Falcon H1, etc.) were not in `cost_rates` prior to this sprint. The seed script (`scripts/seed-arabic-models.mjs`) delivered in DCP-671 adds these rates.

### DCP-668 pricing fix (commit a11ba53)

`jobs.js` COST_RATES corrected:
- LLM inference: 15 → 9 halala/min
- vllm_serve: 20 → 9 halala/min
- Default: 10 → 6 halala/min
- PRICING_CLASS_MULTIPLIERS added: priority +20%, economy -10%

**Status: DONE.** Rate is applied at job-level (duration × rate). Per-token billing in `vllm.js` is separate and uses `cost_rates.token_rate_halala`.

---

## 2. Test Cases — Code-Level Analysis

| # | Test Case | Expected | Code Analysis | Status |
|---|---|---|---|---|
| T1 | serve_sessions row created on vLLM job | Row with `job_id` inserted, status='serving' | `db.prepare(INSERT INTO serve_sessions...)` at vllm.js:565 | PASS (code) |
| T2 | `total_tokens` increments after inference | +promptTokens+completionTokens | `total_tokens + ?` at vllm.js:654 | PASS (code) |
| T3 | `total_billed_halala` increments | +tokenRate×totalTokens | `total_billed_halala + ?` at vllm.js:657 | PASS (code) |
| T4 | Token counts written to `jobs` table | `prompt_tokens`, `completion_tokens` set | UPDATE jobs at vllm.js:625 | PASS (code) |
| T5 | Fallback to `__default__` rate if model absent | 1 halala/token | Double-db.get pattern at vllm.js:639 | PASS (code) |
| T6 | Arabic models have correct cost_rates | ≥2 halala/token for 7B Arabic | seed-arabic-models.mjs seeds these | PASS (code, post-seed) |
| T7 | Metering failure does not block response | 200 returned even if DB write fails | try/catch non-fatal at vllm.js:663 | PASS (code) |
| T8 | Billing calculation: input×rate + output×rate | verified formula | `Math.max(1, totalTokensActual × tokenRateHalala)` | PASS (code) |

---

## 3. Gaps / Risks

### GAP-1: Metering failures are silent
`serve_sessions` update failures are swallowed. No alert, no counter, no audit log.
**Risk:** Low probability but billing data can be lost silently.
**Mitigation:** Future hardening task — add `metric_increment('metering.failure')` in the catch block.

### GAP-2: `approximateTokenCount` is a heuristic
When `completion_tokens` is not returned by the provider, `approximateTokenCount(text)` estimates by `Math.ceil(text.length / 4)`. This can under-count for Arabic text (Arabic chars can be >1 byte but tokenize as 1–2 tokens, not 1-per-4-bytes).
**Risk:** Medium — Arabic sessions may be underbilled by ~10–20%.
**Mitigation:** Arabic-specific token counting (or server-side tokenizer count return) as a follow-up task.

### GAP-3: Live smoke test blocked on DCP-524
`scripts/vllm-metering-smoke.mjs` requires `DCP_RENTER_KEY` and `DC1_ADMIN_TOKEN` against a live endpoint with an active provider. No active providers exist yet (DCP-524 VPS deployment pending founder approval).

---

## 4. How to Run Live Smoke Test (Post-DCP-524)

```bash
# From repo root, after VPS deployment is live with at least 1 active provider:
DCP_API_BASE=https://api.dcp.sa \
DCP_RENTER_KEY=<renter_api_key> \
DC1_ADMIN_TOKEN=<admin_token> \
node scripts/vllm-metering-smoke.mjs
```

Expected output when passing:
```
[PASS] Renter key valid
[PASS] serve_sessions row created
[PASS] total_tokens incremented
[PASS] total_billed_halala incremented
[PASS] jobs token counts written
```

---

## 5. Model Registry Seed Verification

Run after `scripts/seed-arabic-models.mjs`:

```bash
curl -s https://api.dcp.sa/api/models | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('Total models:', d.length);
console.log('Arabic models:', d.filter(m => m.arabic_capable).length);
"
```

Expected: 13+ models total, 6+ Arabic-capable.

---

## 6. Conclusion

The per-token metering implementation (Sprint 25 Gap 1, fb619e7) is **structurally sound**:
- serve_sessions records are created and updated correctly
- Token counts persist to both `jobs` and `serve_sessions` tables
- cost_rates fallback to `__default__` prevents billing failures
- DCP-668 pricing fix aligns job-level rates with strategic brief

**Remaining action items:**
1. Run `scripts/seed-arabic-models.mjs` on production DB post-DCP-524
2. Run `scripts/vllm-metering-smoke.mjs` against live endpoint with an active provider
3. Future: add metering failure alerting (silent catch blocks)
4. Future: Arabic-aware token counting to fix ~10–20% under-billing
