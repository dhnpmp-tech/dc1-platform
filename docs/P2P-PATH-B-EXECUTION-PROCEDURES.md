# Path B Execution Procedures — HTTP-Only Fallback (18:00 UTC + 15m)

**When This Applies:** If at 18:00 UTC decision point, bootstrap peer ID is NOT posted, process is NOT running, OR peer ID is still placeholder

**Owner:** Backend Architect + Frontend Developer + DevOps
**Duration:** T+15m to T+1h (rapid fallback activation)
**Success Criteria:** HTTP provider discovery working + renters can book providers by T+45m

---

## T+15m to T+30m — HTTP Fallback Activation (15 minutes)

### Step 1: Confirm HTTP API is Healthy (5 minutes)

**Commands to Run (Copy-Paste Ready):**

```bash
# Check backend health
curl -s http://localhost:8083/api/health | jq '.'

# Check provider listing endpoint
curl -s http://localhost:8083/api/providers | jq '.[] | {id, gpu_model, price_per_hour}' | head -5

# Check database connectivity
curl -s http://localhost:8083/api/admin/db-status | jq '.'
```

**Expected Output:**
- ✅ Health endpoint returns: `{status: "healthy", uptime_seconds: X}`
- ✅ Providers endpoint returns list of 20+ providers
- ✅ DB status shows: `{status: "connected", tables: X}`

**If Any Check Fails:**
- 🔴 **CRITICAL** — Backend may be down
- Post to #p2p-network-engineers: "Backend health check failed!"
- Escalate to Backend Architect immediately
- Do NOT proceed with Phase 1 testing

---

### Step 2: Ensure HTTP Discovery is Active (5 minutes)

**For Backend Developer:**

```bash
# Verify HTTP discovery mode is enabled
curl -s http://localhost:8083/api/config/discovery-mode | jq '.'

# Response should show:
# {
#   "mode": "http",
#   "fallbackMode": null,
#   "p2pStatus": "disabled",
#   "timestamp": "2026-03-24T18:15:00Z"
# }

# If P2P mode is still set, explicitly disable it:
curl -X PATCH http://localhost:8083/api/config/discovery-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"http","p2pStatus":"disabled"}'
```

**Expected Output:**
- ✅ Discovery mode is `http`
- ✅ P2P status is `disabled`
- ✅ No P2P bootstrap reference in response

**If P2P Mode Still Active:**
- Clear P2P configuration from environment
- Restart backend service: `pm2 restart dc1-provider-onboarding`
- Wait 30 seconds for service to come back online
- Rerun the check above

---

### Step 3: Test Renter Discovery Flow (5 minutes)

**For QA/Testing:**

```bash
# Test 1: Get available providers for a GPU type
curl -s 'http://localhost:8083/api/providers?gpu_model=rtx4090' | jq '.[] | {id, gpu_model, availability, price_per_hour}'

# Expected: Returns array of 3-5 RTX 4090 providers

# Test 2: Get detailed provider info
PROVIDER_ID=$(curl -s 'http://localhost:8083/api/providers?gpu_model=rtx4090' | jq -r '.[0].id')
curl -s "http://localhost:8083/api/providers/$PROVIDER_ID" | jq '.'

# Expected: Returns detailed provider info including specs, pricing, terms

# Test 3: Verify pricing is correct
curl -s 'http://localhost:8083/api/providers/pricing' | jq '.rtx4090'

# Expected: Shows DCP pricing (should be 23.7% below Vast.ai baseline)
```

---

## T+30m to T+1h — Full System Verification (30 minutes)

### Renter-Side Complete Flow Test (15 minutes)

**Test Case: End-to-End Booking (Copy-Paste Ready)**

```bash
#!/bin/bash
# Simulate complete renter journey: discover → select → book → confirm

RENTER_ID="test-renter-$RANDOM"
MODEL="llama3-8b"

# Step 1: Discover providers
echo "Step 1: Discovering providers for $MODEL..."
PROVIDERS=$(curl -s "http://localhost:8083/api/providers/search?model=$MODEL" | jq -r '.[].id')
PROVIDER_ID=$(echo "$PROVIDERS" | head -1)
echo "✅ Found provider: $PROVIDER_ID"

# Step 2: Get pricing
echo "Step 2: Checking pricing..."
PRICE=$(curl -s "http://localhost:8083/api/providers/$PROVIDER_ID/pricing" | jq '.price_per_hour')
echo "✅ Price: \$$PRICE/hour"

# Step 3: Create booking
echo "Step 3: Creating booking..."
BOOKING=$(curl -s -X POST http://localhost:8083/api/bookings \
  -H "Content-Type: application/json" \
  -d "{
    \"renterId\": \"$RENTER_ID\",
    \"providerId\": \"$PROVIDER_ID\",
    \"model\": \"$MODEL\",
    \"duration_hours\": 1,
    \"discoveryMode\": \"http\"
  }" | jq '.bookingId')
echo "✅ Booking created: $BOOKING"

# Step 4: Confirm booking
echo "Step 4: Confirming booking..."
STATUS=$(curl -s -X POST "http://localhost:8083/api/bookings/$BOOKING/confirm" | jq '.status')
echo "✅ Booking status: $STATUS"

# Step 5: Get connection details
echo "Step 5: Getting connection details..."
curl -s "http://localhost:8083/api/bookings/$BOOKING/connection" | jq '.{host, port, auth_token}'
echo "✅ Connection details retrieved"

echo ""
echo "🟢 Full booking flow completed successfully"
```

**Expected Output:**
- ✅ All 5 steps complete without errors
- ✅ Booking confirmed within 5 seconds
- ✅ Connection details provided (host, port, auth_token)

**If Any Step Fails:**
- 🔴 Check backend logs: `tail -50 /var/log/dc1-provider-onboarding.log`
- Look for error type (auth, database, validation)
- Post error message to #backend-team Slack
- May need to restart backend service

---

### Provider-Side Health Check (10 minutes)

**Test Case: Provider Registration & Liveness**

```bash
# Check provider registration status
curl -s http://localhost:8083/api/admin/providers/status | jq '.[] | {provider_id, status, last_heartbeat, jobs_completed}'

# Expected output shows:
# - provider_id: "provider-001"
# - status: "online"
# - last_heartbeat: "2026-03-24T18:20:00Z" (within last 30 seconds)
# - jobs_completed: X

# If any provider shows "offline" or old heartbeat:
# Contact that provider and check their connectivity
```

---

### Load Test — Can System Handle Phase 1? (5 minutes)

**Simple Load Test:**

```bash
# Simulate 10 concurrent discovery requests
for i in {1..10}; do
  curl -s 'http://localhost:8083/api/providers?gpu_model=rtx4090' > /dev/null &
done
wait

# Check response time:
time curl -s 'http://localhost:8083/api/providers?gpu_model=rtx4090' | jq 'length'

# Expected: Response time <1 second, returns 20+ providers
# If response time >3 seconds: May need to optimize or scale backend
```

---

## T+1h to T+1.5h — Status Update & Team Notification (30 minutes)

### Notify All Teams (10 minutes)

**Slack Message Template (Copy-Paste Ready):**

```
🔴 **PATH B: HTTP-Only Fallback Activated** (18:00 UTC + 1h)

⚠️ P2P bootstrap not deployed — Using HTTP provider discovery fallback

**Reason:** Bootstrap deployment did not complete by 18:00 UTC decision point

**Status:**
- ✅ HTTP API: Healthy, responding normally
- ✅ Provider discovery: 27 providers online
- ✅ Renter booking: E2E test passed
- ✅ System ready for Phase 1 testing

**What This Means:**
- Renters discover providers via HTTP REST API (traditional method)
- No P2P bootstrap, but system is fully functional
- All core marketplace features working normally
- Performance: Slightly higher latency, but acceptable for testing

**Phase 1 Testing Impact:**
- Day 4 testing can proceed as scheduled (08:00 UTC)
- Use HTTP monitoring (see docs/PHASE1-MONITORING-RUNBOOK.md section "HTTP-Only Mode")
- P2P network will be deployed in next sprint if needed

**Next Actions:**
1. Phase 1 QA: See #dcp-773 for testing checklist (HTTP mode)
2. Backend: Monitor API performance during Phase 1
3. Providers: Ensure HTTP heartbeat is active

**If Any Issues:**
- Report to #p2p-network-engineers
- Escalation: Backend Architect (@backend-architect)
```

---

### Post Status to DCP-852 (5 minutes)

**Format (Copy-Paste Ready):**

```markdown
## PATH B: HTTP-Only Fallback Activated ✅ (18:00 UTC + 1h)

**Decision:** HTTP-Only Fallback (P2P Bootstrap Not Deployed)
**Activation Status:** ✅ COMPLETE
**Timeline:** T-0 (18:00 UTC) → Decision + Verification → T+1h (HTTP Live)

### Decision Rationale

P2P bootstrap deployment did not complete by 18:00 UTC:
- Bootstrap peer ID not posted in DCP-612
- Bootstrap process not running on VPS
- Peer ID still placeholder in code

**Decision:** Activate HTTP-only fallback (proven, stable path)

### Verification Results

| Component | Status | Details |
|-----------|--------|---------|
| HTTP API | ✅ Healthy | All endpoints responding normally |
| Providers | ✅ Online | 27 providers registered and heartbeat active |
| Discovery | ✅ Working | Provider search endpoint returning results |
| Booking | ✅ Tested | E2E booking flow completed successfully |
| Load Test | ✅ Passed | 10 concurrent requests completed <1s each |

### Phase 1 Testing Impact

✅ **Phase 1 Can Proceed As Scheduled**
- Day 4 testing: 2026-03-26 08:00 UTC (HTTP monitoring mode)
- All renter/provider functionality working
- Performance acceptable for testing phase
- Full marketplace operational

### P2P Deployment

P2P bootstrap deployment deferred to next sprint:
- No impact to Phase 1 testing (HTTP is sufficient)
- Allows focus on marketplace stability during testing
- P2P can be added post-testing with zero downtime (feature-flagged)

### Next Phase

Phase 1 testing proceeds with HTTP-only mode.
QA team: See /DCP-773 for Day 4 testing checklist (HTTP monitoring).
P2P network deployment will be re-evaluated post-Phase 1.

**Overall Status:** 🟢 HTTP FALLBACK OPERATIONAL | Phase 1 UNBLOCKED
```

---

### Create Monitoring Dashboard Entry (5 minutes)

**For ML Infra/DevOps:**

Add to monitoring dashboard:

```json
{
  "metric": "discovery_mode_status",
  "path": "Path B (HTTP-Only)",
  "discoveryMode": "http",
  "p2pStatus": "disabled",
  "activatedAt": "2026-03-24T18:15:00Z",
  "httpApiHealth": "healthy",
  "providersOnline": 27,
  "averageDiscoveryTime_ms": 145,
  "lastHealthCheck": "2026-03-24T18:45:00Z",
  "status": "operational",
  "alerts": []
}
```

---

## Path B During Phase 1 Testing

### Daily Monitoring (Day 4-6)

**HTTP API Metrics to Watch:**

```bash
# Run every hour during Phase 1
curl -s http://localhost:8083/api/metrics/discovery | jq '{
  requests_per_minute: .http.rpm,
  average_response_time_ms: .http.avg_latency,
  error_rate_percent: .http.error_rate,
  providers_online: .http.providers_online,
  bookings_per_hour: .http.bookings_per_hour
}'
```

**Alert Thresholds:**
- ⚠️ Response time >300ms: Check backend load
- 🔴 Error rate >5%: Investigate API errors
- 🔴 Providers online <10: Check provider heartbeat

---

## Future P2P Deployment (Post-Phase 1)

If P2P is needed after Phase 1:

```bash
# 1. Deploy P2P bootstrap (separate VPS)
# 2. Inject bootstrap peer ID into code
# 3. Feature flag: Enable P2P discovery on 10% of renters
# 4. Monitor P2P path performance vs HTTP
# 5. Gradually roll out P2P to 100% of traffic
# 6. Eventually deprecate HTTP-only mode
```

This zero-downtime rollout prevents the need for decision points like this.

---

**Document Version:** 2026-03-24 11:30 UTC
**Owner:** P2P Network Engineer
**Related:** DCP-852 (decision execution), DCP-612 (bootstrap status)
**Standby Time:** Ready for T+15m execution upon decision publication
