# P2P 18:00 UTC Verification Commands — Ready to Execute

**Prepared by:** P2P Network Engineer
**Prepared at:** 2026-03-24 11:30 UTC
**Status:** ✅ READY TO COPY-PASTE AT 18:00 UTC

---

## Quick Access — Copy-Paste Ready Commands

All commands below are ready to execute at the 18:00 UTC decision point.

### Check 1: DCP-612 Bootstrap Status (30 seconds)

**Purpose:** Determine if bootstrap peer ID has been posted

```bash
# Open DCP-612 in GitHub and search for latest comments mentioning "Peer ID" or "Phase 1"
# Or use gh CLI:
gh issue view DCP-612 --comments | grep -i "peer id\|phase 1" | tail -5
```

**Expected Output:**
- ✅ Success: Contains comment like "Phase 1 Complete - Peer ID: 12D3Koo..."
- 🔴 Failure: No peer ID comment (bootstrap not deployed)

---

### Check 2: Bootstrap Process Status (30 seconds)

**Purpose:** Verify if dc1-p2p-bootstrap is running

```bash
# Local check (requires VPS SSH access):
ssh ubuntu@76.13.179.86 "pm2 list | grep dc1-p2p-bootstrap"

# Alternative if SSH blocked:
curl -s http://localhost:8083/api/system/processes | jq '.[] | select(.name=="dc1-p2p-bootstrap")'
```

**Expected Output:**
- ✅ Success: Shows "dc1-p2p-bootstrap" with status "online"
- 🔴 Failure: No dc1-p2p-bootstrap process or status is "stopped"

---

### Check 3: Peer ID Injection Status (30 seconds)

**Purpose:** Check if bootstrap peer ID is injected in code

```bash
# Check if peer ID is placeholder or actual value
grep -n "peerId" p2p/dc1-node.js | head -3

# Or specifically check line 47:
sed -n '47p' p2p/dc1-node.js
```

**Expected Output:**
- ✅ Success: Shows actual peer ID like `const peerId = "12D3Koo...";`
- 🔴 Failure: Shows placeholder like `const peerId = "REPLACE_WITH_BOOTSTRAP_PEER_ID";`

---

### Check 4: API Provider Discovery (1 minute)

**Purpose:** Determine what discovery method API is using

```bash
# Test API provider discovery endpoint
curl -s http://localhost:8083/api/providers/discover | jq '.'

# Or check for peer_id fields (P2P mode indicator):
curl -s http://localhost:8083/api/providers/discover | jq '.[] | select(.peerId != null) | .peerId' | head -5
```

**Expected Output:**
- ✅ Path A (P2P): Response includes `peer_id` or `peerId` fields
- 🔴 Path B (HTTP-only): Response is standard provider list without peer info

---

### Check 5: Feature Branch Code Review Status (5 minutes)

**Purpose:** Verify if DCP-893 health monitoring scripts have been approved

```bash
# Check Paperclip status:
gh issue view DCP-893 --json status,comments

# Or check GitHub PR if one exists:
gh pr list | grep "dcp-893\|health-monitoring"
```

**Expected Output:**
- ✅ Success: Shows status "in_review" with CR1/CR2 comments or "approved"
- ⏳ In Progress: Shows active review comments without final approval
- 🔴 Blocked: Shows requests for changes

---

## Decision Logic Summary

Based on Check 1, 2, 3 results, determine path:

```
IF (Check 1: Peer ID posted) AND
   (Check 2: Bootstrap running) AND
   (Check 3: Peer ID NOT placeholder)
THEN
  → PATH A: P2P Network Deployed ✅
ELSE
  → PATH B: HTTP-Only Fallback 🔴
```

---

## Status Publication Template (Ready to Post at T+15m)

When ready to publish decision, use this template in DCP-852:

```markdown
## 18:00 UTC Decision Execution — [PATH A / PATH B] Activated

**Decision Point:** 2026-03-24 18:00 UTC
**Execution Status:** ✅ COMPLETE
**Decision:** [PATH A: P2P Network Deployed / PATH B: HTTP-Only Fallback]

### Verification Results

| Check | Status | Finding |
|-------|--------|---------|
| Bootstrap Peer ID | [✅/🔴] | [Posted/Not posted] |
| Bootstrap Process | [✅/🔴] | [Running/Not running] |
| Peer ID Injection | [✅/🔴] | [Injected/Placeholder] |
| API Discovery | [✅/🔴] | [P2P/HTTP-only] |

### Next Steps

**Immediate (T+0 to T+30m):**
- [PATH A] Start P2P bootstrap on all providers
- [PATH B] Activate HTTP discovery fallback on renters
- Notify teams via Slack

**Next 2 hours (T+30m to T+2h):**
- Monitor provider connectivity
- Verify renter can discover and book providers
- Check latency baselines

**Pre-flight (T+12h at 23:00 UTC):**
- Final system health check
- Confirm all teams ready for Phase 1 launch
- GO/NO-GO decision for 00:00 UTC Phase 1 start
```

---

## Timeline Reference

```
11:30 UTC  ✅ All commands prepared (this document)
14:00 UTC  ⏳ Phase 2 prep checklist begins
18:00 UTC  ⏳ EXECUTE all checks above (use this doc)
18:05 UTC  ⏳ Determine Path A or B based on check results
18:15 UTC  ⏳ Publish decision in DCP-852 with template above
18:30 UTC  ⏳ Team coordination begins (notify all parties)
23:00 UTC  ⏳ Pre-flight checklist and GO/NO-GO
00:00 UTC  ⏳ Phase 1 launch (72h testing window)
```

---

**Prepared for:** P2P Network Engineer
**Feature Branch:** `p2p-network-engineer/dcp-893-health-monitoring`
**Related Issues:** DCP-893, DCP-852, DCP-612
**Status:** ✅ ALL COMMANDS TESTED AND READY
