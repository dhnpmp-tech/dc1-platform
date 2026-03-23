# Provider Integration Guide — Phase 1 Launch Ready

**Date:** 2026-03-23
**Purpose:** Help providers integrate with DCP Phase 1 P2P discovery network
**Audience:** Provider operators, technical leads
**Status:** Ready for distribution

---

## Overview

Phase 1 of the DCP platform launches the P2P Provider Discovery Network. This guide explains what providers need to do to participate and what to expect.

**Key Information:**
- **Launch Date:** 2026-03-26 (Phase 1 testing begins)
- **Bootstrap Node:** `76.13.179.86:4001`
- **Heartbeat Interval:** Every 30 seconds
- **Required Configuration:** `P2P_DISCOVERY_ENABLED=true`

---

## What is Phase 1?

Phase 1 enables:
1. **Provider Discovery** - Providers automatically discovered via P2P DHT
2. **Job Matching** - Renters can find and submit jobs to providers
3. **Automatic Announcements** - Providers advertise themselves without manual registration
4. **Network Resilience** - Decentralized provider network for redundancy

### What Providers Don't Need to Do
- Manual server registration (automatic)
- Manual price updates (pulled from DCP pricing API)
- Manual heartbeat configuration (automatic every 30 seconds)

---

## Getting Ready for Phase 1

### Step 1: Update Provider Daemon (If Not Already Done)

Ensure you have the latest provider daemon version with P2P support:

```bash
# Check your daemon version
python provider_daemon.py --version

# Update to latest (if using version < 1.2.0)
pip install --upgrade dcp-provider-daemon

# Or clone from repository
git clone https://github.com/dcp/provider-daemon.git
cd provider-daemon
pip install -e .
```

### Step 2: Configure P2P Discovery

Set environment variable to enable P2P discovery:

```bash
export P2P_DISCOVERY_ENABLED=true

# Or add to provider daemon startup script:
P2P_DISCOVERY_ENABLED=true python provider_daemon.py
```

### Step 3: Verify Connectivity to DCP Backend

Test that your provider can reach the DCP backend:

```bash
# Test heartbeat endpoint
curl -X POST http://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"provider_id":"your-provider-id","gpu_count":1}'

# Expected response: 200 OK
```

### Step 4: Verify GPU Configuration

Ensure your GPUs are properly detected and configured:

```bash
# Check provider logs
python provider_daemon.py --check-gpus

# Expected output:
# GPU 0: NVIDIA RTX 4090 (24GB)
# GPU 1: NVIDIA RTX 4090 (24GB)
```

### Step 5: Test Heartbeat Sending

Monitor provider daemon logs to verify heartbeats are being sent:

```bash
# Start provider daemon with verbose logging
P2P_DISCOVERY_ENABLED=true python provider_daemon.py --verbose

# You should see:
# [INFO] Sending P2P heartbeat to DCP backend...
# [INFO] Heartbeat sent successfully
# [INFO] P2P peer ID: 12D3Koo...
```

---

## Phase 1 Timeline for Providers

### Phase 1: Bootstrap Deployment (T+0 to T+10 min)
- DCP deploys P2P bootstrap node
- Bootstrap listening on `76.13.179.86:4001`
- Providers with `P2P_DISCOVERY_ENABLED=true` start announcing

### Phase 2: Configuration Update (T+10 to T+15 min)
- DCP backend configured with bootstrap peer ID
- Backend service restarted
- DHT announcements begin

### Phase 3: Provider Discovery (T+15 to T+20 min)
- Provider daemon detects new bootstrap
- Providers re-announce themselves
- Provider status updates in DCP database
- Provider status becomes "online"

### Phase 4: QA Validation (T+20 to T+40 min)
- QA team tests provider job acceptance
- Test jobs submitted to providers
- Providers execute test jobs
- Results validated

### Phase 1 Complete → Phase 2
- Production provider activation begins
- Renters can submit jobs
- Providers earn revenue

---

## What Happens During Phase 1

### Your Provider Will

1. **Send Heartbeats Automatically**
   - Every 30 seconds to DCP backend
   - Includes GPU status, capacity, availability
   - No manual action required

2. **Announce to P2P Network**
   - Automatically via DHT
   - Updated every time heartbeat sent
   - Discoverable by DCP backend and renters

3. **Receive Test Jobs**
   - QA team submits test jobs during Phase 4
   - Provider should accept and execute
   - Log completion status

4. **Improve Visibility**
   - Status shown as "online" when discovered
   - Available for job matching
   - Ranked by availability and pricing

### What You Should Expect

| Event | What to Look For | Action |
|-------|------------------|--------|
| Bootstrap deployed | Backend logs show P2P node init | ✅ Automatic |
| Your daemon announces | Logs show "P2P heartbeat sent" | ✅ Automatic |
| Provider discovered | Status changes to "online" | ✅ Monitor logs |
| Test job received | Backend receives job assignment | ✅ Execute job |
| Job completed | Provider sends completion status | ✅ Automatic |

---

## Monitoring Your Provider During Phase 1

### Check Provider Status

```bash
# 1. Check logs for heartbeat activity
tail -f provider_daemon.log | grep -i "heartbeat\|p2p"

# 2. Check your provider status on DCP
curl https://api.dcp.sa/api/providers/your-provider-id

# Expected response:
# {
#   "provider_id": "your-provider-id",
#   "status": "online",
#   "last_heartbeat": "2026-03-23T14:35:20Z",
#   "gpu_count": 2,
#   "available_gpus": 2
# }

# 3. Monitor GPU utilization
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits
```

### Common Status Messages

| Status | Meaning | Action |
|--------|---------|--------|
| online | Provider discovered and available | ✅ Ready for jobs |
| offline | Provider not announcing | ⚠️ Check daemon |
| pending | First announcement pending | ✅ Wait 30 seconds |
| inactive | Haven't seen in 90 seconds | ⚠️ Check connectivity |

### Troubleshooting: Provider Offline

If your provider shows "offline", try:

```bash
# 1. Check daemon is running
ps aux | grep provider_daemon

# 2. Check P2P discovery enabled
echo $P2P_DISCOVERY_ENABLED  # Should print "true"

# 3. Check backend connectivity
curl -I http://api.dcp.sa/health

# 4. Check logs for errors
tail -50 provider_daemon.log | grep -i "error\|fail"

# 5. Restart daemon with verbose logging
pkill provider_daemon
P2P_DISCOVERY_ENABLED=true python provider_daemon.py --verbose &
```

---

## During Phase 4 QA Testing

### What QA Will Do

1. Submit small test jobs to your provider
2. Expect completion within 30 seconds
3. Verify job results are correct
4. Check provider logs for proper execution

### What You Should Monitor

```bash
# Watch for incoming jobs
tail -f provider_daemon.log | grep -i "job\|assign"

# Monitor GPU activity
watch -n 1 nvidia-smi

# Check job completion
tail -f provider_daemon.log | grep -i "completed\|success"
```

### If Test Job Fails

1. Check provider logs for error messages
2. Verify GPU is functioning
3. Check disk space available
4. Try job manually to diagnose issue
5. Contact DCP support with logs

---

## Phase 1 Success Criteria (What You Need to Achieve)

For your provider to be "Phase 1 Ready":

- [x] Provider daemon updated to v1.2.0+
- [x] `P2P_DISCOVERY_ENABLED=true` configured
- [x] Can send heartbeats to DCP backend
- [x] GPU detection working
- [x] Logs show P2P announcements
- [x] Provider status shows "online" on DCP dashboard
- [x] Can accept and execute test jobs
- [x] Job completion status reported

---

## FAQ for Providers

### Q: Do I need to do anything manually?
**A:** No. Once `P2P_DISCOVERY_ENABLED=true` is set, heartbeats and announcements happen automatically.

### Q: What if I'm behind a firewall?
**A:** You need outbound access to:
- `api.dcp.sa` (DCP backend heartbeat endpoint)
- Port 4001 (P2P DHT bootstrap node) — outbound

### Q: What's my peer ID?
**A:** Shown in logs like: `[P2P] Peer ID: 12D3Koo...` You may need it for debugging.

### Q: Can I disable P2P temporarily?
**A:** Yes, set `P2P_DISCOVERY_ENABLED=false` and restart daemon. You'll become invisible to DCP.

### Q: How do I know I'm announced to DHT?
**A:** Check logs for: `[P2P] Announcing to DHT...` appearing every ~30 seconds.

### Q: What if my IP changes?
**A:** Provider daemon will re-announce with new IP on next heartbeat (~30 seconds).

### Q: Will Phase 1 affect my existing jobs?
**A:** No. Phase 1 is for new provider discovery. Existing jobs continue normally.

### Q: How do I update my pricing?
**A:** Pricing pulled from DCP backend automatically. No action needed.

### Q: What's the SLA during Phase 1?
**A:** Phase 1 is testing/validation. No SLA guarantees. Full SLA starts Phase 2.

---

## Quick Reference

### Essential Commands

```bash
# Start provider with P2P enabled
P2P_DISCOVERY_ENABLED=true python provider_daemon.py

# Check P2P logs
tail -f provider_daemon.log | grep -i p2p

# Check GPU status
nvidia-smi

# Check provider status on DCP
curl https://api.dcp.sa/api/providers/YOUR_ID
```

### Important Dates
- **Phase 1 Bootstrap:** 2026-03-26 08:00 UTC
- **Phase 1 Testing:** 2026-03-26 to 2026-03-27
- **Phase 2 (Production):** 2026-03-27 onwards

### Key Contacts
- **Technical Support:** devops@dcp.sa
- **Provider Relations:** providers@dcp.sa
- **Emergency:** emergency@dcp.sa

---

## Next Steps

1. ✅ Update provider daemon to v1.2.0+
2. ✅ Enable `P2P_DISCOVERY_ENABLED=true`
3. ✅ Monitor logs during Phase 1 bootstrap
4. ✅ Accept and execute Phase 4 test jobs
5. ✅ Report any issues to support

---

## Support Resources

- **Troubleshooting Guide:** `/docs/P2P-TROUBLESHOOTING-RUNBOOK.md`
- **Phase 1 Timeline:** `/docs/PHASE-1-DEPLOYMENT-SEQUENCE.md`
- **Provider Daemon Docs:** GitHub: `dcp/provider-daemon`
- **DCP API Docs:** https://api.dcp.sa/docs

---

**Status:** Ready for Phase 1 Launch
**Last Updated:** 2026-03-23
**Distribution:** Ready for all providers

---
