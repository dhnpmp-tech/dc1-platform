# P2P Network Phase 1 Operations Guide

**Owner:** P2P Network Engineer / SRE
**Duration:** Ongoing post-Phase 4
**Purpose:** Sustain and optimize P2P discovery network operations

---

## Daily Operations

### Morning Health Check (First Thing)

```bash
# 1. Bootstrap node status
pm2 status | grep dc1-p2p-bootstrap
# Expected: status "online"

# 2. Provider discovery metrics
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  COUNT(*) as total_providers,
  COUNT(CASE WHEN status='online' AND last_heartbeat > datetime('now', '-5 minutes') THEN 1 END) as online_now,
  COUNT(CASE WHEN status='online' AND last_heartbeat > datetime('now', '-1 hours') THEN 1 END) as online_1h,
  COUNT(CASE WHEN p2p_peer_id IS NOT NULL THEN 1 END) as with_peer_ids
FROM providers;
EOF

# 3. Backend P2P service status
pm2 status | grep dc1-provider-onboarding
# Expected: status "online"

# 4. Recent errors
grep -i "p2p\|bootstrap\|dht" /var/log/dc1-provider-onboarding.log | tail -20
# Expected: No critical errors
```

### Hourly Metrics (Via Monitoring)

**Key metrics to track:**
- Online provider count (target: > 40/43)
- DHT announcement success rate (target: > 99%)
- Heartbeat endpoint latency (target: < 100ms)
- Bootstrap node availability (target: 99.9%)
- Provider peer ID registration rate (target: > 99%)

### Weekly Review (Monday Morning)

```bash
# Weekly summary
sqlite3 /path/to/dcp.db << 'EOF'
-- Provider uptime summary
SELECT
  DATE(last_heartbeat) as date,
  COUNT(*) as heartbeats_received,
  COUNT(DISTINCT provider_id) as unique_providers,
  AVG(CAST(SUBSTR(gpu_util_pct, 1, 3) AS FLOAT)) as avg_gpu_util
FROM heartbeat_log
WHERE received_at > datetime('now', '-7 days')
GROUP BY DATE(last_heartbeat)
ORDER BY date DESC;

-- Provider status breakdown
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM providers), 1) as percentage
FROM providers
GROUP BY status;

-- P2P peer ID distribution
SELECT
  COUNT(CASE WHEN p2p_peer_id IS NOT NULL THEN 1 END) as with_peer_ids,
  COUNT(CASE WHEN p2p_peer_id IS NULL THEN 1 END) as without_peer_ids
FROM providers;
EOF

# Review logs for warnings/errors
grep -i "warning\|error" /var/log/dc1-provider-onboarding.log | tail -50
```

---

## Real-Time Monitoring

### Monitoring Setup

Create monitoring dashboard with these key metrics:

```yaml
P2P_NETWORK_HEALTH:
  bootstrap_node:
    - uptime (target: 99.9%)
    - port_4001_available (target: true)
    - peer_id_consistency (target: unchanged)

  provider_discovery:
    - online_providers_count (target: > 40)
    - peer_id_assignment_rate (target: 100%)
    - dht_announcement_success (target: > 99%)

  heartbeat_health:
    - endpoint_latency_ms (target: < 100ms)
    - heartbeat_receive_rate (target: > 40/min)
    - recent_heartbeat_freshness (target: < 5min)

  database:
    - p2p_peer_id_uniqueness (target: no duplicates)
    - heartbeat_log_growth (target: 40+ logs/min)
```

### Alert Rules

```bash
# Alert: Bootstrap node down
if [ "$(pm2 status | grep -c 'dc1-p2p-bootstrap.*online')" -eq 0 ]; then
  alert "CRITICAL: Bootstrap node offline"
fi

# Alert: Online providers < 30
ONLINE=$(sqlite3 /path/to/dcp.db \
  "SELECT COUNT(*) FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');")
if [ "$ONLINE" -lt 30 ]; then
  alert "WARNING: Only $ONLINE providers online (expected > 40)"
fi

# Alert: Peer ID assignment rate drops
UNASSIGNED=$(sqlite3 /path/to/dcp.db "SELECT COUNT(*) FROM providers WHERE p2p_peer_id IS NULL;")
if [ "$UNASSIGNED" -gt 5 ]; then
  alert "WARNING: $UNASSIGNED providers without peer IDs"
fi
```

---

## Database Management

### Daily Backup

```bash
# Backup heartbeat_log (grows fastest)
BACKUP_DIR="/backups/dcp"
DATE=$(date +%Y%m%d-%H%M%S)

sqlite3 /path/to/dcp.db << 'EOF'
-- Export recent heartbeat logs
SELECT * FROM heartbeat_log WHERE received_at > datetime('now', '-1 days')
INTO OUTFILE '/backups/dcp/heartbeat_log_daily_$DATE.csv' FIELDS TERMINATED BY ',';
EOF

# Archive older logs (keep 30 days online, archive beyond)
sqlite3 /path/to/dcp.db << 'EOF'
-- Move logs older than 30 days to archive table
INSERT INTO heartbeat_log_archive
SELECT * FROM heartbeat_log WHERE received_at < datetime('now', '-30 days');

DELETE FROM heartbeat_log WHERE received_at < datetime('now', '-30 days');
VACUUM;
EOF
```

### Database Health Check (Weekly)

```bash
# Integrity check
sqlite3 /path/to/dcp.db "PRAGMA integrity_check;" | head -20

# Index efficiency
sqlite3 /path/to/dcp.db << 'EOF'
ANALYZE;
SELECT * FROM sqlite_stat1 WHERE stat LIKE '%heartbeat%' ORDER BY cnt DESC LIMIT 10;
EOF

# Query performance
EXPLAIN QUERY PLAN
SELECT * FROM providers
WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');
```

---

## Log Management and Rotation

### Daily Log Rotation

```bash
# Rotate P2P logs
pm2 flush  # Clears PM2 logs

# Archive and compress
ARCHIVE_DIR="/var/log/archive"
DATE=$(date +%Y%m%d)

tar -czf "$ARCHIVE_DIR/dc1-logs-$DATE.tar.gz" \
  /var/log/dc1-provider-onboarding.log*

# Cleanup logs older than 7 days
find /var/log/archive -name "dc1-logs-*.tar.gz" -mtime +7 -delete
```

### Log Analysis

```bash
# Find patterns in logs
grep "DHT announce" /var/log/dc1-provider-onboarding.log | wc -l
# Expected: > 40/min * 60 min = 2400+ announcements/hour

# Error rate
ERROR_COUNT=$(grep -i "error" /var/log/dc1-provider-onboarding.log | wc -l)
TOTAL_LINES=$(wc -l < /var/log/dc1-provider-onboarding.log)
ERROR_RATE=$((100 * ERROR_COUNT / TOTAL_LINES))
echo "Error rate: $ERROR_RATE%"  # Target: < 0.1%
```

---

## Performance Tracking

### Provider Availability Metrics

```bash
# Calculate 7-day uptime for each provider
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  p.api_key,
  COUNT(DISTINCT DATE(hl.received_at)) as days_with_heartbeats,
  ROUND(100.0 * COUNT(DISTINCT DATE(hl.received_at)) / 7, 1) as uptime_pct,
  COUNT(*) as total_heartbeats,
  MAX(hl.received_at) as last_heartbeat
FROM providers p
LEFT JOIN heartbeat_log hl ON p.id = hl.provider_id
WHERE hl.received_at > datetime('now', '-7 days')
GROUP BY p.id
ORDER BY uptime_pct DESC;
EOF
```

### Provider Health Scoring

```bash
# Score providers on P2P readiness
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  id,
  api_key,
  CASE
    WHEN p2p_peer_id IS NULL THEN 0
    WHEN status='offline' THEN 25
    WHEN status='degraded' THEN 75
    WHEN status='online' THEN 100
  END as p2p_health_score,
  p2p_peer_id,
  status,
  last_heartbeat
FROM providers
WHERE p2p_peer_id IS NOT NULL
ORDER BY p2p_health_score DESC;
EOF
```

### DHT Announcement Tracking

```bash
# Monitor DHT announcement success
grep "DHT announce success\|DHT announce failed" /var/log/dc1-provider-onboarding.log | \
  tail -100 | \
  awk -F'success|failed' '{
    if ($1 ~ /success/) success++
    else failed++
  }
  END {
    total = success + failed
    pct = (success * 100) / total
    printf "DHT announcements: %d success, %d failed (%.1f%% success)\n", success, failed, pct
  }'
```

---

## Provider Onboarding Support

### New Provider Checklist (At Registration)

When a new provider registers:
1. ✓ Verify daemon can connect to backend
2. ✓ Verify provider receives heartbeat endpoint OK
3. ✓ Verify provider gets assigned peer ID from bootstrap
4. ✓ Verify provider announces to DHT successfully
5. ✓ Verify provider shows as "online" within 5 minutes

### Troubleshooting New Provider Issues

```bash
# Provider stuck "offline"
PROVIDER_ID="xyz"
sqlite3 /path/to/dcp.db << 'EOF'
SELECT
  id, api_key, status, last_heartbeat, p2p_peer_id,
  strftime('%s', 'now') - strftime('%s', last_heartbeat) as seconds_since_heartbeat
FROM providers
WHERE id = '$PROVIDER_ID';
EOF

# Check if heartbeats are being received
sqlite3 /path/to/dcp.db << 'EOF'
SELECT COUNT(*) as recent_heartbeats
FROM heartbeat_log
WHERE provider_id = (SELECT id FROM providers WHERE api_key = 'pk_xxx')
AND received_at > datetime('now', '-5 minutes');
EOF

# Check backend logs for provider-specific errors
grep "pk_xxx\|provider_id=123" /var/log/dc1-provider-onboarding.log | tail -50
```

---

## Incident Response

### Bootstrap Node Down

**Symptoms:**
- Validation script fails on bootstrap connectivity check
- New providers can't discover DHT

**Response (5-10 min):**
1. Check bootstrap status: `pm2 status | grep bootstrap`
2. Check logs: `pm2 logs dc1-p2p-bootstrap | tail -50`
3. Verify port 4001: `netstat -tlnp | grep 4001`
4. Restart if needed: `pm2 restart dc1-p2p-bootstrap`
5. Confirm peer ID unchanged: `pm2 logs dc1-p2p-bootstrap | grep "Peer ID"`
6. Post update to status page

### Provider Discovery Stalled

**Symptoms:**
- Online provider count drops below 30
- New providers not showing as online
- DHT announcements failing

**Response (10-15 min):**
1. Check backend status: `pm2 status | grep dc1-provider-onboarding`
2. Check heartbeat endpoint: `curl https://api.dcp.sa/api/providers/heartbeat`
3. Check backend logs for P2P errors
4. Query providers without peer IDs
5. If DHT issue: restart backend, not bootstrap
6. Post incident update

### Database Corruption

**Symptoms:**
- SQLite errors when querying
- Heartbeat logs not being recorded
- Provider status queries hang

**Response (15-30 min):**
1. Run integrity check: `sqlite3 dcp.db "PRAGMA integrity_check;"`
2. If corrupted: restore from latest backup
3. If recoverable: run `VACUUM` and retry
4. Post incident summary

---

## Performance Optimization

### Optimize for High Provider Count (50+)

```bash
# Add indices for heartbeat queries
sqlite3 /path/to/dcp.db << 'EOF'
CREATE INDEX IF NOT EXISTS idx_heartbeat_provider_time
ON heartbeat_log(provider_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_heartbeat_time
ON heartbeat_log(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_status_heartbeat
ON providers(status, last_heartbeat DESC);
EOF

# Archive old heartbeat logs
sqlite3 /path/to/dcp.db << 'EOF'
-- Keep last 7 days online, archive older
DELETE FROM heartbeat_log
WHERE received_at < datetime('now', '-7 days');

VACUUM;
EOF
```

### Load Testing

```bash
# Simulate provider heartbeats to test capacity
for i in {1..100}; do
  curl -s -X POST https://api.dcp.sa/api/providers/heartbeat \
    -H "X-Provider-Key: pk_test_$i" \
    -d '{"gpu_util": 75}' &
done
wait

# Check results
echo "Heartbeats processed: $(sqlite3 /path/to/dcp.db \
  'SELECT COUNT(*) FROM heartbeat_log WHERE received_at > datetime(\"now\", \"-1 minutes\");')"
```

---

## Maintenance Windows

### Monthly Maintenance (1st Sunday, 2am-3am UTC)

- [ ] Full database backup
- [ ] Log rotation and archival
- [ ] Database optimization (VACUUM, ANALYZE)
- [ ] Performance review
- [ ] Security patches if needed
- [ ] Documentation updates

### Quarterly Deep Dive (Every 3 months)

- [ ] Full P2P network audit
- [ ] Provider economics analysis
- [ ] Performance trend analysis
- [ ] Capacity planning
- [ ] Disaster recovery drill

---

## Success Metrics & KPIs

### Primary Metrics (Track Daily)

| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| Online Providers | > 40/43 | ? | ↗ |
| Bootstrap Uptime | 99.9% | ? | ↗ |
| Heartbeat Latency | < 100ms | ? | → |
| DHT Announce Success | > 99% | ? | ↗ |
| Peer ID Assignment | 100% | ? | → |

### Secondary Metrics (Track Weekly)

- Provider 7-day uptime distribution
- DHT announcement latency (p50, p95, p99)
- New provider onboarding success rate
- Provider earnings impact from P2P
- Network health score (0-100)

---

## Runbook References

- **Quick Diagnostics:** P2P-TROUBLESHOOTING-RUNBOOK.md
- **Phase 4 Validation:** PHASE-4-EXECUTION-PLAYBOOK.md
- **DevOps Operations:** DEVOPS-PHASE1-OPERATIONS.md
- **Provider Heartbeat:** p2p/heartbeat-protocol.js
- **Backend Integration:** backend/src/routes/providers.js

---

## Contact & Escalation

**P2P Network Engineer:** On-call for P2P network issues
**Escalation path:**
1. Check logs and try basic troubleshooting
2. Contact P2P Engineer via DCP-612
3. If urgent: Page on-call engineer
4. If critical: Escalate to DevOps lead

---

**Phase 1 P2P Operations Enabled**

Sustained, proactive operations for Phase 1 P2P discovery network. 🎉

