# Provider Onboarding — Phase 1 P2P Launch Edition

**Purpose:** Rapidly activate 43 registered providers once P2P discovery is live
**Timeline:** Execute immediately after Phase 1 launch-ready confirmation
**Target:** 40+ providers online and discoverable within 24 hours of Phase 1 launch

---

## Pre-Launch Preparation (This Week)

### Provider Communication Setup

Send email to all 43 registered providers 24 hours before Phase 1 launch:

```
Subject: DCP GPU Marketplace - Phase 1 Launch Tomorrow - Action Required

Dear Provider Partner,

The DCP GPU Marketplace Phase 1 is launching tomorrow. Your provider registration is active and ready.

To ensure your GPU availability is immediately visible to renters:

1. Ensure your provider daemon is running (latest version)
2. Update to latest daemon version if prompted
3. No additional configuration needed - P2P discovery is automatic
4. Monitor your provider dashboard for online status

Your GPU will be automatically discoverable in the marketplace once Phase 1 launches.

Expected Timeline:
- Phase 1 Launch: Tomorrow, ~2pm UTC
- Your GPU Online: ~30 minutes after launch
- Available for Bookings: Immediately after online status

Questions? Visit: docs.dcp.sa or reply to this email.

Best regards,
DCP Team
```

### Pre-Launch Infrastructure Check

```bash
# Verify all 43 providers have valid configs
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN approval_status='approved' THEN 1 END) as approved,
  COUNT(CASE WHEN resource_spec IS NOT NULL THEN 1 END) as with_specs,
  COUNT(CASE WHEN daemon_version IS NOT NULL THEN 1 END) as with_daemon
FROM providers;
EOF

# Check for any blockers
sqlite3 /path/to/dcp.db << 'EOF'
SELECT id, api_key, status, approval_status, daemon_version
FROM providers
WHERE approval_status != 'approved' OR resource_spec IS NULL
LIMIT 20;
EOF
```

---

## Phase 1 Launch Day (T+0 to T+30 min)

### T+0: Phase 1 Launch Confirmed

When Phase 4 validation passes:
```bash
# Announce Phase 1 live
echo "Phase 1 P2P Discovery Network: LIVE" | mail -s "DCP Phase 1 Live" providers@dcp.sa

# Send webhook to provider daemons (auto-connect signal)
curl -X POST https://api.dcp.sa/api/admin/notify-providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"event":"phase1_live","action":"reconnect"}'
```

### T+5 min: Monitor Provider Re-connection

```bash
# Check provider connection rate (30-second heartbeats)
watch -n 5 'sqlite3 /path/to/dcp.db "
SELECT
  COUNT(CASE WHEN last_heartbeat > datetime(\"now\", \"-1 minutes\") THEN 1 END) as online_now,
  COUNT(CASE WHEN last_heartbeat > datetime(\"now\", \"-5 minutes\") THEN 1 END) as online_5m,
  COUNT(*) as total
FROM providers WHERE approval_status=\"approved\";
"'

# Expected progression:
# T+0: 0-5 online
# T+5: 15-25 online
# T+10: 30-35 online
# T+15: 38-42 online
```

### T+10 min: Provider Discovery Verification

```bash
# Check provider peer IDs assigned
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  COUNT(CASE WHEN p2p_peer_id IS NOT NULL THEN 1 END) as with_peer_ids,
  COUNT(CASE WHEN p2p_peer_id IS NULL THEN 1 END) as without_peer_ids
FROM providers WHERE approval_status='approved';
EOF

# Expected: 40+ providers with peer IDs
```

### T+20 min: Renter Discovery Test

```bash
# Test renter can discover providers
curl -s https://api.dcp.sa/api/providers/available \
  -H "Authorization: Bearer $RENTER_TOKEN" | jq '.providers | length'

# Expected: > 40 providers discoverable
```

### T+30 min: Provider Online Status Confirmed

```bash
# Final online count
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  COUNT(CASE WHEN status='online' THEN 1 END) as online,
  COUNT(CASE WHEN status='degraded' THEN 1 END) as degraded,
  COUNT(CASE WHEN status='offline' THEN 1 END) as offline,
  COUNT(*) as total
FROM providers WHERE approval_status='approved';
EOF

# Expected: 40-42 online, 0-1 degraded, 1-2 offline
```

---

## Post-Launch Provider Support (T+30 min to T+24 hours)

### Provider Troubleshooting Response

**Issue: Provider shows offline despite daemon running**

```bash
# 1. Check provider heartbeat logs
sqlite3 /path/to/dcp.db << 'EOF'
SELECT api_key, last_heartbeat, status, COUNT(*) as recent_beats
FROM heartbeat_log
WHERE provider_id = (SELECT id FROM providers WHERE api_key='pk_xxx')
AND received_at > datetime('now', '-10 minutes')
GROUP BY provider_id;
EOF

# 2. Check daemon version
sqlite3 /path/to/dcp.db << 'EOF'
SELECT api_key, daemon_version, last_heartbeat
FROM providers WHERE api_key='pk_xxx';
EOF

# 3. If old daemon: Recommend upgrade
# 4. If no recent heartbeats: Check daemon logs on provider side
# 5. If network issue: Escalate to DevOps
```

**Issue: Provider can't find bootstrap node**

```bash
# This indicates Phase 1 bootstrap deployment issue
# Check bootstrap health:
pm2 status | grep bootstrap

# If bootstrap down:
pm2 logs dc1-p2p-bootstrap | tail -50
# Escalate to DevOps immediately
```

**Issue: Provider shows online but not discoverable to renters**

```bash
# Check provider resource spec
sqlite3 /path/to/dcp.db << 'EOF'
SELECT api_key, resource_spec, gpu_count, status
FROM providers WHERE api_key='pk_xxx';
EOF

# If resource_spec missing: Request provider update their hardware profile
# If gpu_count is 0: Verify GPU detection on provider daemon
```

### Provider Success Stories (First 24 hours)

```bash
# Identify early winners (quick to come online)
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  api_key,
  last_heartbeat,
  CASE WHEN status='online' THEN 'Online' ELSE 'Offline' END as status,
  gpu_count,
  gpu_profile_source
FROM providers
WHERE last_heartbeat > datetime('now', '-24 hours')
AND approval_status='approved'
ORDER BY last_heartbeat DESC
LIMIT 10;
EOF

# Send congratulations email to early online providers
# Feature them in provider newsletter
# Encourage others: "50% of providers already online!"
```

---

## Provider Earnings Activation (First 24 hours)

Once providers are online and discoverable, they can earn:

### Earnings Calculation Ready

```bash
# Verify pricing engine ready for bookings
curl -s https://api.dcp.sa/api/pricing/floor-rates \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.rates'

# Expected: RTX 4090 at $0.267/hr (23.7% below Vast.ai)
# This enables provider earnings immediately
```

### First Booking Support

When first bookings come in:

```bash
# Monitor earnings in real-time
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  p.api_key,
  COUNT(*) as booking_count,
  SUM(j.total_cost_tokens * token_price) as earnings_estimate
FROM providers p
JOIN jobs j ON p.id = j.provider_id
WHERE j.created_at > datetime('now', '-24 hours')
AND j.status IN ('completed', 'in_progress')
GROUP BY p.id
ORDER BY earnings_estimate DESC;
EOF
```

---

## Monitoring Dashboard (First 24 Hours)

### Key Metrics

| Metric | Target | T+30m | T+6h | T+24h |
|--------|--------|-------|------|-------|
| Online Providers | > 40 | 40-42 | 41-42 | 42+ |
| Peer IDs Assigned | 100% | 98%+ | 99%+ | 100% |
| Avg Uptime | > 99% | - | 99.5% | 99.9% |
| Bookings Received | Growing | 0-2 | 5-20 | 50+ |
| Earnings Processed | Growing | $0 | $50-200 | $1000+ |

### Alert Rules

```bash
# Alert: Online provider count drops
if [ "$(sqlite3 /path/to/dcp.db \
  'SELECT COUNT(*) FROM providers WHERE status=\"online\" AND last_heartbeat > datetime(\"now\", \"-5 minutes\");')" -lt 35 ]; then
  alert "WARNING: Online provider count dropped below 35"
fi

# Alert: Provider going offline
# Alert: No heartbeats received in 10 minutes
# Alert: Peer ID assignment rate drops
```

---

## Success Milestones

### 1-Hour Mark
- ✅ 40+ providers online
- ✅ All approved providers have peer IDs
- ✅ Renter discovery working
- ✅ First bookings coming in

### 6-Hour Mark
- ✅ 41+ providers maintaining online status
- ✅ Zero provider P2P connection issues
- ✅ 20+ bookings processed
- ✅ Provider earnings flowing

### 24-Hour Mark
- ✅ 42+ providers online (optimal)
- ✅ > 99.5% average provider uptime
- ✅ 100+ bookings processed
- ✅ $1000+ provider earnings distributed
- ✅ No escalations or critical issues

---

## Post-24 Hour Operations

### Daily Provider Health Check

```bash
# Run every morning at 9am UTC
sqlite3 /path/to/dcp.db << 'EOF'
-- Daily uptime report
SELECT
  DATE(last_heartbeat) as date,
  COUNT(DISTINCT CASE WHEN status='online' THEN provider_id END) as daily_online,
  COUNT(DISTINCT provider_id) as unique_providers,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN status='online' THEN provider_id END) /
        COUNT(DISTINCT provider_id), 1) as online_pct
FROM heartbeat_log
WHERE received_at > datetime('now', '-7 days')
GROUP BY DATE(last_heartbeat)
ORDER BY date DESC;
EOF
```

### Weekly Provider Review

```bash
# Run every Monday at 10am UTC
# 1. Identify any offline providers
# 2. Send reconnection reminders
# 3. Feature top performers
# 4. Update earnings reports
# 5. Plan next week's optimizations
```

---

## Expected Outcomes (First Week of Phase 1)

**Provider Activation:**
- 42/43 providers online (97.7%)
- 0 providers permanently offline
- 1 provider with intermittent connectivity

**Provider Earnings:**
- 100+ bookings processed
- $5000+ total earnings distributed
- Average $119 per active provider

**Marketplace Health:**
- 99.5%+ provider uptime
- 100% renter discovery success
- Zero critical P2P issues
- All 42 providers profitable at 70% utilization

**Marketing Impact:**
- Provider satisfaction: > 4.5/5
- Retention rate: 98%
- Referral rate: 30% of providers referring others
- Social proof: Real GPU availability, real earnings

---

## Documentation & References

- **P2P Discovery**: P2P-PHASE1-OPERATIONS.md
- **Phase 1 Launch**: PHASE1-LAUNCH-RESOURCE-INDEX.md
- **Provider Economics**: docs/FOUNDER-STRATEGIC-BRIEF.md
- **Pricing Strategy**: docs/PRICING-ENGINE-GUIDE.md (when created)

---

**Phase 1 Provider Onboarding: Ready to Launch**

43 registered providers awaiting Phase 1 to activate and earn. 🚀

