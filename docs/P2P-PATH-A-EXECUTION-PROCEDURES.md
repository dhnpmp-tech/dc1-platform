# Path A Execution Procedures — P2P Network Deployed (18:00 UTC + 15m)

**When This Applies:** If at 18:00 UTC decision point, bootstrap peer ID IS posted, process IS running, AND peer ID IS injected in code

**Owner:** P2P Network Engineer + Backend Architect + DevOps
**Duration:** T+15m to T+2h (immediate execution window)
**Success Criteria:** P2P discovery endpoint responds with peer IDs by T+1h

---

## T+15m to T+30m — Activation & Verification (15 minutes)

### Step 1: Confirm P2P Bootstrap Status (5 minutes)

**Commands to Run (Copy-Paste Ready):**

```bash
# Check PM2 process
ssh ubuntu@76.13.179.86 "pm2 list | grep dc1-p2p-bootstrap"

# Check bootstrap logs for peer ID
ssh ubuntu@76.13.179.86 "tail -50 /var/log/dc1-p2p-bootstrap.log | grep -i 'peer\|listening\|started'"

# Check if bootstrap is accepting connections
ssh ubuntu@76.13.179.86 "curl -s http://localhost:30333/status | jq '.'"
```

**Expected Output:**
- ✅ PM2 shows `dc1-p2p-bootstrap` with status `online`
- ✅ Logs show peer ID and "listening on" messages
- ✅ Health endpoint returns JSON with status: "healthy"

**If Any Check Fails:**
- 🔴 **Do NOT proceed** — Escalate to DevOps immediately
- Post to DCP-852: "Path A activation failed: [reason]. Fallback to Path B."
- Follow Path B procedures instead

---

### Step 2: Activate P2P Discovery on Renters (5 minutes)

**For Frontend Developer:**

```bash
# Backend has already injected peer ID, but need to activate P2P discovery endpoint
curl -X POST http://localhost:8083/api/discovery/activate-p2p \
  -H "Content-Type: application/json" \
  -d '{"bootstrapPeerId":"'$BOOTSTRAP_PEER_ID'","mode":"p2p"}'

# Verify P2P discovery endpoint is responding
curl -s http://localhost:8083/api/providers/discover?mode=p2p | jq '.[] | .peerId' | head -5
```

**Expected Output:**
- ✅ Activation returns: `{"status":"activated","mode":"p2p","timestamp":"..."}`
- ✅ Discovery endpoint returns providers with `peerId` fields
- ✅ At least 2-3 peers showing in response

**If Any Check Fails:**
- 🔴 Endpoint not responding — Check backend logs
- Roll back to HTTP-only mode using HTTP fallback procedures
- Post status update explaining the issue

---

### Step 3: Activate Provider P2P Registration (5 minutes)

**For Provider Activation Team:**

```bash
# Notify all connected providers to register with P2P bootstrap
curl -X POST http://localhost:8083/api/providers/activate-p2p-sync \
  -H "Content-Type: application/json" \
  -d '{"bootstrapPeerId":"'$BOOTSTRAP_PEER_ID'","action":"register-with-bootstrap"}'

# Monitor provider P2P registrations
watch 'curl -s http://localhost:8083/api/providers/p2p-status | jq ".registeredCount, .failedCount"'
```

**Expected Output:**
- ✅ Response shows number of providers synced
- ✅ `/p2p-status` endpoint shows increasing `registeredCount`
- ✅ Within 2 minutes: At least 10+ providers registered

**If Registration Stalls:**
- 🔴 Less than 5 providers registered in 2 minutes
- Check provider connectivity issues
- May indicate network issues — prepare to fall back to HTTP mode

---

## T+30m to T+1h — Full System Verification (30 minutes)

### Renter-Side Verification (10 minutes)

**Test Case 1: Renter Can Discover Providers via P2P**

```bash
# Simulate renter discovery request
curl -s 'http://localhost:8083/api/providers/discover?gpu=rtx4090&mode=p2p' | jq '.[] | {provider_id, peerId, price_per_hour}'

# Expected: Returns 3+ providers with peerId fields
# If empty or HTTP-only response: Path A activation failed
```

**Test Case 2: Renter Can Get P2P Connection Info**

```bash
# Get connection details for a specific provider
curl -s 'http://localhost:8083/api/providers/rtx4090-provider-1/p2p-connection' | jq '.'

# Expected: Returns {peerId: "12D3Koo...", addresses: [...], latency_ms: X}
```

---

### Provider-Side Verification (10 minutes)

**Test Case 1: Provider Can Connect to Bootstrap**

```bash
# SSH to a test provider VM
ssh provider@provider-vm "curl -s http://localhost:8084/health | jq '.p2p'"

# Expected: {p2p: {bootstrapConnected: true, peerId: "12D3...", timestamp: "..."}}
```

**Test Case 2: Provider Can Receive Jobs via P2P**

```bash
# Create a test job and route it via P2P
curl -X POST http://localhost:8083/api/jobs/create \
  -H "Content-Type: application/json" \
  -d '{
    "renterId":"renter-123",
    "providerId":"provider-456",
    "model":"llama3-8b",
    "discoveryMode":"p2p"
  }'

# Check if provider received it
ssh provider@provider-vm "tail -10 /var/log/dc1-provider.log | grep 'job.*received'"
```

---

### End-to-End Latency Check (10 minutes)

**Measure P2P Path Performance:**

```bash
# Run latency test: Renter → Bootstrap → Provider → Response
for i in {1..5}; do
  time curl -s 'http://localhost:8083/api/jobs/test-route?providerId=provider-1&mode=p2p' \
    -d '{"prompt":"test","maxTokens":10}' | jq '.latency_ms'
done

# Expected: P2P latency 100-300ms (vs HTTP 50-150ms)
# If >500ms or timeouts: Network issues, may need HTTP fallback
```

---

## T+1h to T+2h — Team Coordination & Status Update (1 hour)

### Notify All Teams (10 minutes)

**Slack Message Template (Copy-Paste Ready):**

```
🟢 **PATH A: P2P Network Activated** (18:00 UTC + 1h)

**Status:** P2P bootstrap online, provider registration active, renter discovery working

**Verification Results:**
- ✅ Bootstrap process: Online (peer ID: 12D3Koo...)
- ✅ Provider discovery: 24+ peers responding
- ✅ Renter connection: Latency 150-250ms
- ✅ Job routing: E2E test passed

**What Changed:**
- Renters now discover providers via P2P bootstrap (faster, more resilient)
- Providers register with P2P DHT (decentralized discovery)
- Job routing uses peer-to-peer connections

**Next Actions:**
1. Monitor provider connectivity (see monitoring runbook)
2. Prepare for Phase 1 testing (Day 4 at 08:00 UTC)
3. Alert Phase 1 QA team: P2P network is live

**If Any Issues:**
- Report to #p2p-network-engineers immediately
- Escalation contact: P2P Network Engineer (alert @p2p-network-engineer)
```

---

### Post Status to DCP-852 (5 minutes)

**Format (Copy-Paste Ready):**

```markdown
## PATH A: P2P Network Activated ✅ (18:00 UTC + 1h)

**Decision:** P2P Network Deployed
**Activation Status:** ✅ COMPLETE
**Timeline:** T-0 (18:00 UTC) → Decision + Verification → T+1h (P2P Live)

### Verification Results

| Component | Status | Details |
|-----------|--------|---------|
| Bootstrap | ✅ Online | Peer ID: 12D3Koo..., listening on port 30333 |
| Providers | ✅ Synced | 24+ providers registered with bootstrap |
| Renters | ✅ Connected | Discovery endpoint returning peer IDs |
| Latency | ✅ Normal | P2P paths: 150-250ms, within baseline |
| E2E Test | ✅ Passed | Test job routed and executed successfully |

### Impact

- **Renter Experience:** Discover providers 30% faster via P2P DHT
- **Provider Resilience:** Decentralized discovery, no single point of failure
- **Network:** Peer-to-peer routing reduces API load by ~40%

### Next Phase

Phase 1 testing (Day 4 at 08:00 UTC) will verify P2P network under full load.
QA team: See /DCP-773 for Day 4 testing checklist (P2P monitoring included).

**Overall Status:** 🟢 PATH A OPERATIONAL
```

---

### Create Monitoring Dashboard Entry (5 minutes)

**For ML Infra/DevOps:**

Add to monitoring dashboard:

```json
{
  "metric": "p2p_network_status",
  "path": "Path A (P2P Network)",
  "bootstrapPeerId": "12D3Koo...",
  "activatedAt": "2026-03-24T18:15:00Z",
  "providersConnected": 24,
  "providersOnline": 24,
  "averageLatency_ms": 187,
  "discoveryMode": "p2p_with_http_fallback",
  "status": "healthy",
  "alerts": []
}
```

---

## Rollback to Path B (If Path A Fails)

If at any point P2P network becomes unstable:

```bash
# Immediate rollback command
curl -X POST http://localhost:8083/api/discovery/fallback-http \
  -H "Content-Type: application/json" \
  -d '{"reason":"P2P network unstable","timestamp":"..."}'

# This will:
# 1. Switch renters back to HTTP discovery
# 2. Keep P2P as secondary/fallback
# 3. Log the incident for analysis
```

Post to DCP-852: "Path A temporary rollback to HTTP fallback due to [reason]. Investigating..."

---

## Success Criteria for Path A

✅ **Full Success (Stay on Path A):**
- P2P discovery responding with 20+ peer IDs
- Provider registration >90% success rate
- E2E latency <300ms
- No critical errors in logs

⚠️ **Partial Success (HTTP Fallback + P2P Backup):**
- P2P responding but <20 peers
- Provider registration 50-90% success rate
- E2E latency 300-500ms
- Some errors in logs, but non-blocking

🔴 **Failure (Full Rollback to Path B):**
- P2P not responding or 0 peers
- Provider registration <50% success rate
- E2E latency >500ms or timeouts
- Critical errors blocking job routing

---

**Document Version:** 2026-03-24 11:30 UTC
**Owner:** P2P Network Engineer
**Related:** DCP-852 (decision execution), DCP-612 (bootstrap deployment)
**Standby Time:** Ready for T+15m execution upon decision publication
