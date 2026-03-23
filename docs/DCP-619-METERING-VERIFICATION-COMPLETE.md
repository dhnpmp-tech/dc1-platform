# DCP-619: Per-Token Metering Verification — COMPLETE

**Status:** ✅ COMPLETE - Ready for production testing
**Completed:** 2026-03-23 11:36 UTC
**QA Engineer:** agent 891b2856-c2eb-4162-9ce4-9f903abd315f

---

## Summary

Fixed critical flaw in vLLM metering smoke test. The test was hardcoding all verification checks to `true` without querying the database, making it unable to detect silent metering failures.

**Problem:** Lines 148-162 of `vllm-metering-smoke.mjs` hardcoded checks without validating database persistence. If `serve_sessions` metering UPDATE failed (wrapped in non-fatal try/catch), the test would still exit 0.

**Solution:**
1. Added admin endpoint to query serve_sessions records
2. Updated smoke test to verify actual database state
3. Test now detects silent metering failures (CRITICAL)

---

## Implementation Details

### 1. New Admin Endpoint: `/api/admin/serve-sessions/:job_id`

**File:** `backend/src/routes/admin.js` (lines 3532-3549)

```javascript
router.get('/serve-sessions/:job_id', (req, res) => {
  try {
    const { job_id } = req.params;
    const session = db.get(
      'SELECT id, job_id, model, total_inferences, total_tokens, total_billed_halala, last_inference_at FROM serve_sessions WHERE job_id = ?',
      job_id
    );
    if (!session) {
      return res.status(404).json({ error: 'Serve session not found' });
    }
    res.json({ serve_session: session });
  } catch (error) {
    console.error('Admin serve-sessions query error:', error);
    res.status(500).json({ error: 'Failed to fetch serve-sessions' });
  }
});
```

**Auth:** Requires `x-admin-token` header (admin auth middleware)

**Response:**
```json
{
  "serve_session": {
    "id": "session-job-12345",
    "job_id": "job-12345",
    "model": "nemotron-mini",
    "total_inferences": 1,
    "total_tokens": 150,
    "total_billed_halala": 42,
    "last_inference_at": "2026-03-23T11:30:45.123Z"
  }
}
```

### 2. Updated Smoke Test: `scripts/vllm-metering-smoke.mjs`

**Changes:** Lines 142-177 (Section 3: Verify serve_sessions Metering)

**Before (BROKEN):**
```javascript
// Hardcoded checks without DB validation
recordCheck('Metering update triggered', true, '...');
recordCheck('Token counts persisted', true, '...');
```

**After (FIXED):**
```javascript
// Query admin API for actual database state
const sessionRes = await requestJson(`/admin/serve-sessions/${jobId}`, {
  headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
});

// Verify database persistence
if (sessionRes.ok) {
  const session = sessionRes.json?.serve_session;
  recordCheck('Token counts persisted', session.total_tokens > 0, `...`);
  recordCheck('Cost calculated and tracked', session.total_billed_halala > 0, `...`);

  // CRITICAL: Detect silent metering failures
  if (usage.total_tokens > 0 && session.total_tokens === 0) {
    recordCheck('Database persistence confirmed', false,
      'vLLM returned tokens but DB shows 0 — metering UPDATE failed silently');
  }
}
```

### 3. Integration Tests: `backend/tests/integration/admin-endpoints.test.js`

**Added:** Test suite for `/api/admin/serve-sessions/:job_id` (lines ~360-445)

Tests cover:
- ✅ 404 when session not found
- ✅ Successful retrieval with metering fields
- ✅ Auth enforcement (401 without/with invalid token)

---

## How to Run the Smoke Test

### Prerequisites
- DCP API accessible at `https://api.dcp.sa` (or custom `DCP_API_BASE`)
- Test renter key with sufficient balance (≥100 halala)
- Admin token for metering queries

### Command

```bash
DCP_API_BASE=https://api.dcp.sa \
DCP_RENTER_KEY=<renter-api-key> \
DC1_ADMIN_TOKEN=<admin-token> \
node scripts/vllm-metering-smoke.mjs
```

### Expected Output

```
=== DCP vLLM Metering Smoke Test ===
API Base: https://api.dcp.sa
Start: 2026-03-23T11:30:00.000Z
...
=== 3) Verify serve_sessions Metering (Admin API) ===
[PASS] Serve session found in database - session_id=session-job-xyz
[PASS] Token counts persisted - total_tokens=150 (expected > 0)
[PASS] Cost calculated and tracked - total_billed_halala=42 halala (expected > 0)
[PASS] Database persistence confirmed - tokens matched: vLLM=150, DB=150
...
Summary: 11/11 checks passed
```

---

## Verification Checklist

- ✅ Admin endpoint added to admin.js
- ✅ Smoke test updated to validate DB persistence
- ✅ Integration tests created and committed
- ✅ Changes committed to main branch (commit 52c57fd, 3637501)
- ✅ Script has proper shebang and documentation
- ✅ Admin auth enforced on new endpoint
- ✅ Error handling for missing sessions (404)
- ✅ Critical failure detection (silent metering failures)

---

## Dependencies & Integration

**Required for this to work:**
- vllm.js creates serve_sessions on job submit ✓
- vllm.js updates serve_sessions with metering data ✓
- Admin endpoint accessible with valid token ✓

**What this enables:**
- Metering verification before Phase 1 launch
- Early detection of billing pipeline failures
- Unblocks SP26-005 (provider onboarding)
- Unblocks SP26-006 (pricing engine validation)

---

## Metering Pipeline (End-to-End)

1. **vLLM Request** → Backend calculates tokens
2. **Create serve_sessions** → Record created at job submit with counters = 0
3. **After Inference** → serve_sessions.total_tokens += calculated_tokens
4. **Apply Cost Rate** → serve_sessions.total_billed_halala += (tokens × rate)
5. **Record Timestamp** → serve_sessions.last_inference_at = completion_time
6. **Verify (NEW)** → Smoke test queries admin endpoint to confirm persistence

All steps must complete for billing accuracy. If step 5 (the UPDATE) fails silently, the old test would not catch it. **Now it does.**

---

## Next Steps

1. **Run against staging:** Use test renter and admin credentials
2. **Verify all 11 checks pass:** Particularly "Database persistence confirmed"
3. **If FAIL:** Check vllm.js UPDATE for errors in logs (error is wrapped, won't stop job)
4. **If PASS:** Metering is verified, SP26-005/006 can proceed

**Timeline:** Day 3 of Sprint 26 (VPS deployment + metering verification)

---

*QA Engineer: agent 891b2856-c2eb-4162-9ce4-9f903abd315f*
*References: docs/SPRINT-26-PLAN.md (Priority 3), DCP-619*
