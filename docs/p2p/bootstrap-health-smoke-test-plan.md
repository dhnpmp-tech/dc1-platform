# Bootstrap Node Health Smoke Test Plan

**Date**: 2026-03-23
**Sprint**: 27 Deliverable 4
**Status**: Blocked on DCP-612 Phase 1 deployment
**Execution Window**: Immediate following Phase 1 bootstrap deployment

---

## Executive Summary

Once DCP-612 (Phase 1 P2P bootstrap node deployment) completes, this smoke test validates that:

1. **Bootstrap node is reachable** — TCP connection possible on port 4001
2. **Backend P2P service is running** — Health check passes
3. **Provider discovery is operational** — DHT can return provider list
4. **Capability filtering works** — Model-aware provider search functions
5. **Routing performance is acceptable** — Provider selection < 100 ms
6. **Arabic model support ready** — Arabic RAG can find suitable providers

---

## Deployment Timeline

### Phase 1: Bootstrap Node Deployment (DCP-612)
- **Trigger**: DevOps deploys bootstrap node on 76.13.179.86:4001
- **Expected duration**: 20 minutes (5 min DevOps + 5 min backend + 10 min validation)
- **Manual signal required**: When peer ID is injected into `p2p/dc1-node.js`

### Phase 1 Completion Detected
- P2P monitoring auto-detects peer ID injection
- Phase 4 validation (this document) executes automatically
- OR: Manual trigger via smoke test script

### Smoke Test Execution (THIS DELIVERABLE)
- **When**: 5-10 minutes after bootstrap peer ID injection
- **Duration**: ~2 minutes
- **Exit code**: 0 if all checks pass, 1 if any fail, 2 if setup error
- **Responsible**: P2P Network Engineer or DevOps
- **Approval**: Results posted to DCP-612

---

## Test Environment Setup

### Prerequisites

Before running the smoke test, verify:

```bash
# 1. Bootstrap node is running on correct port
nc -zv 76.13.179.86 4001
# Expected: Connection succeeded

# 2. Backend API is accessible
curl -s http://api.dcp.sa:443/api/p2p/health | head -20
# OR: curl -s http://localhost:8083/api/p2p/health

# 3. At least 1 provider is online (optional, but helps)
curl -s http://api.dcp.sa:443/api/providers/available?limit=1

# 4. Node.js is available
node --version  # v18+

# 5. fetch module is available (npm)
npm list node-fetch
```

### Environment Variables

```bash
# Override default values if needed
export API_BASE="http://api.dcp.sa"  # Default: http://localhost:8083
export BOOTSTRAP_HOST="76.13.179.86"  # Default: 76.13.179.86
export BOOTSTRAP_PORT="4001"          # Default: 4001
export ADMIN_TOKEN="..."              # Optional, for admin endpoints

# Install dependencies (first time only)
npm install node-fetch
```

---

## Execution

### Manual Execution (on VPS or local dev machine)

```bash
cd /home/node/dc1-platform

# Run smoke test
node scripts/bootstrap-health-smoke-test.mjs

# Example output:
# 🚀 DCP Bootstrap Node Health Smoke Test
# 📍 Bootstrap: /ip4/76.13.179.86/tcp/4001
# 📍 API: http://localhost:8083
# 📍 Started: 2026-03-23T15:30:00.000Z
#
# ══ 2026-03-23T15:30:00.123Z Testing: Bootstrap node reachability (TCP 4001)
#   ✓ 2026-03-23T15:30:00.234Z PASS: Bootstrap node reachability (TCP 4001)
# ... [more tests]
#
# ════════════════════════════════════════════════════════════════
#   ✓ Test Results: 10 passed, 0 failed
# ════════════════════════════════════════════════════════════════
#
# ✓ 2026-03-23T15:30:10.456Z Bootstrap health check PASSED ✓
```

### Automated Execution (CI/CD)

In `.github/workflows/phase1-validation.yml`:

```yaml
name: Phase 1 Validation

on:
  workflow_dispatch:  # Manual trigger after bootstrap deployment

jobs:
  bootstrap-health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install node-fetch

      - name: Run bootstrap smoke test
        run: |
          node scripts/bootstrap-health-smoke-test.mjs
        env:
          API_BASE: https://api.dcp.sa
          BOOTSTRAP_HOST: 76.13.179.86
          BOOTSTRAP_PORT: 4001

      - name: Report results to Slack
        if: always()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d '{"text": "Bootstrap health check: ${{ job.status }}"}'
```

---

## Test Descriptions

### Test 1: Bootstrap Node Reachability
**Purpose**: Verify TCP connection to bootstrap peer on port 4001
**Validates**: Network connectivity, no firewall blocking, bootstrap node is running
**Pass Criteria**: TCP handshake succeeds within 5s timeout
**Fail Reason**: Connection refused, timeout, or network unreachable
**Recovery**: Check VPS network, firewall rules, bootstrap PM2 service status

### Test 2: Backend P2P Service
**Purpose**: Verify backend has P2P service and bootstrap is configured
**Validates**: Backend P2P routes are working, bootstrap multiaddr is known
**Pass Criteria**: `GET /api/p2p/health` returns 200 with `bootstrap_configured: true`
**Fail Reason**: P2P service not running, bootstrap not in env vars
**Recovery**: Check `DCP_P2P_BOOTSTRAP` env var, restart backend PM2 service

### Test 3: Provider List API
**Purpose**: Verify centralized provider list still works
**Validates**: SQLite database of providers is queryable
**Pass Criteria**: `GET /api/providers/available` returns array (0+ providers)
**Fail Reason**: Database corrupted, API route broken
**Recovery**: Check provider registration endpoint, verify DB schema

### Test 4: Provider Discovery API
**Purpose**: Test both DHT and centralized discovery endpoints
**Validates**: P2P discovery module is loaded, DHT queries work
**Pass Criteria**: Both `/api/p2p/providers` and shadow-cycle endpoints respond
**Fail Reason**: P2P module not installed, bootstrap not reachable from backend
**Recovery**: Verify `p2p/` directory exists, libp2p module installed

### Test 5: Provider Capability Filtering
**Purpose**: Test model-aware provider search (Phase 27.2 feature)
**Validates**: New provider search endpoints are deployed
**Pass Criteria**: `GET /api/providers/search` returns filtered list (may be empty)
**Fail Reason**: Endpoint not yet deployed (expected before Phase 27.2 ends)
**Recovery**: Deploy Deliverable 2 backend changes

### Test 6: Model Metadata
**Purpose**: Verify model catalog is available for routing
**Validates**: Model VRAM requirements, compute capability are known
**Pass Criteria**: At least 1 model endpoint returns metadata
**Fail Reason**: Models endpoint not deployed yet (Phase 27.2)
**Recovery**: Deploy Sprint 26 models API changes

### Test 7: Admin Debugging Endpoints
**Purpose**: Verify admin panel has P2P monitoring tools
**Validates**: Shadow cycle, peer health can be queried
**Pass Criteria**: Admin endpoints return data or 401 (auth), not 404
**Fail Reason**: Admin routes not registered
**Recovery**: Check backend admin route registration

### Test 8: Heartbeat Mechanism
**Purpose**: Verify provider heartbeats are being logged
**Validates**: Provider-to-backend communication is active
**Pass Criteria**: Recent heartbeat log entries exist (< 2 min old)
**Fail Reason**: No providers online yet, heartbeat table empty
**Recovery**: Wait for providers to register and send heartbeats (5-10 min)

### Test 9: Routing Performance
**Purpose**: Verify provider selection is fast enough
**Validates**: Provider search completes in acceptable time
**Pass Criteria**: Provider query < 100 ms
**Fail Reason**: Database slow, many providers online causing latency
**Recovery**: Check DB indexes on `providers` table

### Test 10: Arabic Model Routing
**Purpose**: Verify Arabic models can be discovered and routed
**Validates**: Arabic model metadata is available, can find compatible providers
**Pass Criteria**: Arabic models searchable (may return 0 providers if none online yet)
**Fail Reason**: Arabic model API not deployed
**Recovery**: Verify Arabic model list is configured

---

## Success Criteria

All 10 tests pass with exit code 0:

```
✓ Test Results: 10 passed, 0 failed
✓ Bootstrap health check PASSED
```

### Acceptable Warnings

These warnings are **not failures** and don't prevent Phase 1 launch:

- Test 3: "No providers currently online" — Expected during cold start; providers come online over 5-10 min
- Test 5: "Provider search endpoint not yet deployed" — Expected if Phase 27.2 hasn't deployed Deliverable 2
- Test 6: "Model metadata endpoint not available" — Expected if Phase 26 API not fully deployed
- Test 8: "No recent heartbeats" — Expected if providers haven't registered yet; auto-resolves when providers join

### Required Passes

**Must pass** for Phase 1 launch approval:

- ✅ Test 1: Bootstrap reachable
- ✅ Test 2: Backend P2P service running
- ✅ Test 4: Provider discovery API responding
- ✅ Test 7: Admin endpoints available
- ✅ Test 9: Performance < 100 ms

---

## Failure Scenarios & Recovery

### Scenario A: Bootstrap Node Not Reachable
**Symptoms**: Test 1 fails with "Cannot connect to 76.13.179.86:4001"
**Root Cause**: Bootstrap PM2 process crashed, firewall blocking, or wrong IP
**Resolution**:
```bash
# 1. Check bootstrap process
pm2 list | grep bootstrap
pm2 logs bootstrap

# 2. Restart if needed
pm2 restart dc1-p2p-bootstrap

# 3. Verify port open
ss -tlnp | grep 4001

# 4. Check firewall
ufw status | grep 4001
```

### Scenario B: Backend P2P Service Not Configured
**Symptoms**: Test 2 fails with "bootstrap_configured: false"
**Root Cause**: `DCP_P2P_BOOTSTRAP` env var not set or empty
**Resolution**:
```bash
# 1. Check env var
echo $DCP_P2P_BOOTSTRAP

# 2. Set to bootstrap multiaddr
export DCP_P2P_BOOTSTRAP="/ip4/76.13.179.86/tcp/4001/p2p/12D3KooXXXX"

# 3. Update PM2 env and restart
pm2 restart dc1-provider-onboarding --update-env

# 4. Verify
curl http://localhost:8083/api/p2p/health | jq .bootstrap_configured
```

### Scenario C: No Providers Online Yet
**Symptoms**: Tests 3, 8, 9 return empty results
**Root Cause**: Providers haven't registered yet (normal for first 5-10 min after bootstrap)
**Resolution**:
```bash
# 1. This is expected — wait for providers to join
# Providers typically register within 5-10 minutes

# 2. Monitor heartbeat growth
curl http://localhost:8083/api/providers/available | jq '.length'

# 3. Check provider registration endpoint
curl -s http://localhost:8083/api/providers/available | head -50

# 4. If still empty after 15 min, check provider logs
# Providers may be unable to reach bootstrap — verify firewall, DNS
```

### Scenario D: Provider Search Slow (>100 ms)
**Symptoms**: Test 9 warns "Slow provider search (>100ms)"
**Root Cause**: Too many providers online, missing DB index, slow disks
**Resolution**:
```bash
# 1. Check SQLite stats
sqlite3 providers.db "SELECT COUNT(*) FROM providers WHERE status='online';"

# 2. Verify indexes exist
sqlite3 providers.db ".indices providers"

# 3. Create missing indexes if needed
sqlite3 providers.db "
  CREATE INDEX IF NOT EXISTS idx_provider_status ON providers(status);
  CREATE INDEX IF NOT EXISTS idx_provider_gpu_model ON providers(gpu_model);
  CREATE INDEX IF NOT EXISTS idx_provider_arabic ON providers(arabic_optimized);
"

# 4. Vacuum and optimize
sqlite3 providers.db "VACUUM; PRAGMA optimize;"

# 5. Re-run test
node scripts/bootstrap-health-smoke-test.mjs
```

---

## Post-Test Actions

### If All Tests Pass ✓

1. **Post Results to DCP-612**:
   ```
   🚀 Bootstrap Health Smoke Test: PASSED
   All 10 checks passed at 2026-03-23 15:35:00 UTC
   Bootstrap: 76.13.179.86:4001
   API: api.dcp.sa
   Performance: <50ms average

   Status: READY FOR PHASE 1 LAUNCH ✓
   ```

2. **Activate Provider Onboarding** — Announce to provider recruitment team that providers can now register

3. **Monitor First 24 Hours**:
   - Run smoke test every 6 hours
   - Track: providers online, heartbeat rate, discovery latency
   - Alert if any metric degrades

4. **Prepare Phase 2 (Next Sprint)**:
   - Implement Deliverable 2 backend (provider capability filtering)
   - Deploy Phase 27.2 changes
   - Run e2e test with Arabic RAG workload

### If Tests Fail ✗

1. **Capture Full Logs**:
   ```bash
   # Collect diagnostic info
   curl -s http://localhost:8083/api/p2p/health?probe=true > bootstrap_health.json
   curl -s http://localhost:8083/api/admin/serve-sessions | head -100 > serve_sessions.log
   pm2 logs --lines 100 > pm2_logs.txt
   sqlite3 providers.db "SELECT * FROM providers LIMIT 5;" > providers_snapshot.txt

   # Save timestamp and test output
   date > test_run.txt
   node scripts/bootstrap-health-smoke-test.mjs >> test_run.txt 2>&1
   ```

2. **Investigate Root Cause** — Use scenarios above or escalate to backend team

3. **Fix & Retry** — Once issue is resolved, re-run full smoke test

4. **Document** — Add lesson learned to troubleshooting runbook

---

## Appendix A: Smoke Test Output Example

```
🚀 DCP Bootstrap Node Health Smoke Test
📍 Bootstrap: /ip4/76.13.179.86/tcp/4001
📍 API: http://api.dcp.sa
📍 Started: 2026-03-23T15:30:00.000Z

══ 2026-03-23T15:30:00.123Z Testing: Bootstrap node reachability (TCP 4001)
  ✓ 2026-03-23T15:30:00.234Z PASS: Bootstrap node reachability (TCP 4001)

══ 2026-03-23T15:30:00.456Z Testing: Backend P2P service available
  ℹ 2026-03-23T15:30:00.567Z   Discovery mode: shadow
  ℹ 2026-03-23T15:30:00.678Z   Bootstrap configured: /ip4/76.13.179.86/tcp/4001
  ✓ 2026-03-23T15:30:00.789Z PASS: Backend P2P service available

══ 2026-03-23T15:30:00.890Z Testing: Provider list API
  ℹ 2026-03-23T15:30:01.012Z   Found 42 online providers
  ℹ 2026-03-23T15:30:01.123Z     - Provider-A (RTX 4090, 24 GB VRAM)
  ℹ 2026-03-23T15:30:01.234Z     - Provider-B (RTX 4080, 16 GB VRAM)
  ✓ 2026-03-23T15:30:01.345Z PASS: Provider list API

══ 2026-03-23T15:30:01.456Z Testing: Provider discovery API endpoints
  ℹ 2026-03-23T15:30:01.567Z   DHT discovery mode: shadow
  ℹ 2026-03-23T15:30:01.678Z   DHT providers found: 38
  ℹ 2026-03-23T15:30:01.789Z   Bootstrap probe: OK (latency 45ms)
  ✓ 2026-03-23T15:30:01.890Z PASS: Provider discovery API endpoints

══ 2026-03-23T15:30:02.012Z Testing: Provider capability filtering
  ⚠ 2026-03-23T15:30:02.123Z   Provider search endpoint not yet deployed (expected in Phase 27.2)
  ✓ 2026-03-23T15:30:02.234Z PASS: Provider capability filtering

══ 2026-03-23T15:30:02.345Z Testing: Model metadata availability
  ℹ 2026-03-23T15:30:02.456Z   Model metadata available: llama3-8b, mistral-7b, allam-7b
  ✓ 2026-03-23T15:30:02.567Z PASS: Model metadata availability

══ 2026-03-23T15:30:02.678Z Testing: Admin debugging endpoints
  ℹ 2026-03-23T15:30:02.789Z   Shadow cycle decision: promote-to-p2p-primary
  ℹ 2026-03-23T15:30:02.890Z   Tracked peers: 40
  ✓ 2026-03-23T15:30:03.012Z PASS: Admin debugging endpoints

══ 2026-03-23T15:30:03.123Z Testing: Provider heartbeat mechanism
  ℹ 2026-03-23T15:30:03.234Z   Latest heartbeat: 5s ago
  ✓ 2026-03-23T15:30:03.345Z PASS: Provider heartbeat mechanism

══ 2026-03-23T15:30:03.456Z Testing: Routing performance (<100ms)
  ℹ 2026-03-23T15:30:03.567Z   Provider search latency: 28ms
  ✓ 2026-03-23T15:30:03.678Z PASS: Routing performance (<100ms)

══ 2026-03-23T15:30:03.789Z Testing: Arabic model routing support
  ℹ 2026-03-23T15:30:03.890Z   allam-7b: 8 candidates available
  ℹ 2026-03-23T15:30:04.012Z   arabic-embeddings-bgem3: 12 candidates available
  ℹ 2026-03-23T15:30:04.123Z   arabic-reranker: 12 candidates available
  ✓ 2026-03-23T15:30:04.234Z PASS: Arabic model routing support

════════════════════════════════════════════════════════════════
  ✓ Test Results: 10 passed, 0 failed
════════════════════════════════════════════════════════════════

✓ 2026-03-23T15:30:04.567Z Bootstrap health check PASSED ✓
✓ 2026-03-23T15:30:04.678Z P2P network is operational and ready for inference routing
✓ 2026-03-23T15:30:04.789Z Next steps: Monitor provider onboarding, test Arabic RAG queries
```

---

## Summary

**Deliverable 4** is ready for execution immediately after Phase 1 bootstrap deployment. The smoke test script validates 10 critical system health checks and provides clear pass/fail determination and recovery procedures for each failure scenario.

**Execution**: When DCP-612 Phase 1 completes, run `node scripts/bootstrap-health-smoke-test.mjs` and report results to DCP-612.

---

*Document version: 1.0*
*Ready for Phase 1 deployment completion*
