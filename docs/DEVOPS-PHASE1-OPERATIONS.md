# DevOps Phase 1 Operations — Post-Launch Runbook

**Status:** Ready for Phase 1 launch and ongoing operations
**Date:** 2026-03-23
**Owner:** DevOps Team
**Scope:** Operational procedures after Phase 1 bootstrap deployment

---

## Overview

This runbook covers DevOps responsibilities for Phase 1 (P2P Provider Discovery Network) after bootstrap deployment is complete. Topics include:
- Health monitoring and alerting
- Database management
- Log management
- Performance tracking
- Incident response
- Provider onboarding support

---

## Daily Operations (Post-Launch)

### Morning Checklist (08:00 UTC Daily)

```bash
# 1. VPS Health Check
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/vps-health.sh'

# 2. Service Status
ssh root@76.13.179.86 'pm2 status'

# 3. Provider Count
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT
    status,
    COUNT(*) as count
  FROM providers
  GROUP BY status
  ORDER BY count DESC;"
EOF

# 4. Recent Job Activity
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "SELECT
    DATE(created_at) as date,
    COUNT(*) as job_count,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed
  FROM jobs
  WHERE created_at > datetime('now', '-7 days')
  GROUP BY DATE(created_at)
  ORDER BY date DESC;"
EOF

# 5. Check Alerts
ssh root@76.13.179.86 'tail -50 /tmp/vps-health-alerts.log' || echo "No alerts yet"
```

### Weekly Review (Every Monday)

```bash
# 1. Provider Growth Metrics
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db << 'SQL'
SELECT
  date(created_at) as registration_date,
  count(*) as new_providers,
  sum(case when status='online' then 1 else 0 end) as online_count
FROM providers
WHERE created_at >= date('now', '-7 days')
GROUP BY registration_date
ORDER BY registration_date DESC;
SQL
EOF

# 2. Job Performance Metrics
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db << 'SQL'
SELECT
  count(*) as total_jobs,
  sum(case when status='completed' then 1 else 0 end) as completed,
  sum(case when status='failed' then 1 else 0 end) as failed,
  avg(CAST((julianday(completed_at) - julianday(created_at)) * 86400 AS INTEGER)) as avg_duration_sec
FROM jobs
WHERE created_at >= date('now', '-7 days')
  and status in ('completed', 'failed');
SQL
EOF

# 3. System Performance Trending
bash /home/node/dc1-platform/scripts/capture-baseline.sh
cat /tmp/phase1-baseline-*.json | tail -1

# 4. Backup Status
ls -lh /home/node/dc1-platform/backend/backups/ | tail -10
```

---

## Monitoring & Alerting

### Real-Time Monitoring

**Active Dashboard (3-terminal setup):**

```bash
# Terminal 1: System Metrics (refresh every 5 seconds)
ssh root@76.13.179.86 'watch -n 5 "free -h && echo && df -h && echo && top -bn1 | head -10"'

# Terminal 2: Service Status (refresh every 10 seconds)
ssh root@76.13.179.86 'watch -n 10 pm2 status'

# Terminal 3: Backend Logs (streaming)
ssh root@76.13.179.86 'pm2 logs dc1-provider-onboarding --follow'
```

### Alerting Rules

**Critical (Page Immediately):**
- Backend service down
- Disk usage > 90%
- Memory usage > 85% (sustained > 5 min)
- Database corruption detected
- Provider count drop > 50% in 1 hour

**High (Alert within 1 hour):**
- Job failure rate > 10%
- Provider response time > 5 seconds
- CPU sustained > 85%
- Disk usage > 80%
- Log errors > 100/min

**Medium (Daily summary):**
- Low provider count (< 5)
- Slow job completion (avg > 10 min)
- Memory fragmentation
- Disk space trending to limits

### Automated Alerting Script

```bash
# Run VPS health check with alerts
ssh root@76.13.179.86 << 'EOF'
# This runs via PM2 cron every 5 minutes
bash /home/node/dc1-platform/scripts/vps-health.sh

# Sends Telegram alerts for critical metrics
# See backend/ecosystem.config.js for configuration
EOF
```

---

## Database Management

### Daily Maintenance

```bash
# 1. Verify Database Integrity
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db "PRAGMA integrity_check;"
# Expected: "ok"
EOF

# 2. Optimize Database
ssh root@76.13.179.86 << 'EOF'
sqlite3 /home/node/dc1-platform/backend/data/providers.db << 'SQL'
PRAGMA optimize;
VACUUM;
SQL
EOF

# 3. Check Database Size
ssh root@76.13.179.86 'ls -lh /home/node/dc1-platform/backend/data/providers.db'
```

### Backup Management

```bash
# Automated daily backup (runs at 3 AM UTC via PM2)
# Manually trigger if needed:
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/backup-db.sh'

# Verify backup integrity
ssh root@76.13.179.86 << 'EOF'
# Most recent backup
BACKUP=$(ls -t /home/node/dc1-platform/backend/backups/providers.db.*.gz | head -1)
echo "Latest backup: $BACKUP"

# Check backup size
ls -lh "$BACKUP"

# Test restore (to /tmp, not production)
zcat "$BACKUP" | sqlite3 /tmp/test-restore.db

# Verify restored database
sqlite3 /tmp/test-restore.db "SELECT COUNT(*) FROM providers;"
EOF
```

### Database Recovery

**If Database Corrupted:**

```bash
ssh root@76.13.179.86 << 'EOF'
# 1. Stop backend service
pm2 stop dc1-provider-onboarding

# 2. Find most recent good backup
BACKUP=$(ls -t /home/node/dc1-platform/backend/backups/providers.db.*.gz | head -1)
echo "Restoring from: $BACKUP"

# 3. Restore backup
bash /home/node/dc1-platform/scripts/restore-db.sh "$BACKUP"

# 4. Verify restoration
sqlite3 /home/node/dc1-platform/backend/data/providers.db "SELECT COUNT(*) FROM providers;"

# 5. Restart backend
pm2 restart dc1-provider-onboarding

# 6. Verify service recovered
pm2 logs dc1-provider-onboarding --lines 20
EOF
```

---

## Log Management

### Log Rotation

**Automated rotation (runs at 4 AM UTC via PM2):**
```bash
# Manual trigger if needed:
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/rotate-logs.sh'

# View rotation status
ssh root@76.13.179.86 'ls -lh /home/node/dc1-platform/backend/logs/ && echo "" && du -sh /home/node/dc1-platform/backend/logs/'
```

### Error Analysis

**Analyze recent errors:**
```bash
ssh root@76.13.179.86 'bash /home/node/dc1-platform/scripts/analyze-logs.sh'

# View error report
cat /tmp/log-analysis-*.txt
```

**Common Errors:**
- `Provider timeout` - Provider not responding, may be offline
- `Job assignment failed` - No available providers
- `DHT announcement failed` - P2P network connectivity issue
- `Database locked` - Concurrent access conflict

---

## Performance Tracking

### Baseline Capture & Trending

```bash
# Capture baseline (run periodically to establish trends)
ssh root@76.13.179.86 << 'EOF'
bash /home/node/dc1-platform/scripts/capture-baseline.sh
EOF

# View latest baseline
cat /tmp/phase1-baseline-*.json | jq '.'

# Compare with previous baseline for regression detection
# Example: API latency trending, resource utilization
```

### Load Testing

**When to load test:**
- After major code deployments
- When approaching capacity limits
- Before public launch phases
- Quarterly performance review

```bash
ssh root@76.13.179.86 << 'EOF'
# Run load test (100 requests, 10 concurrent default)
bash /home/node/dc1-platform/scripts/load-test.sh

# Run heavy load test
bash /home/node/dc1-platform/scripts/load-test.sh 500 50  # 500 requests, 50 concurrent

# View results
cat /tmp/load-test-*.json | jq '.'
EOF
```

---

## Provider Onboarding Support

### Provider Registration Issues

**Provider can't register:**
```bash
ssh root@76.13.179.86 << 'EOF'
# Check if registration endpoint is responding
curl -v http://localhost:8083/api/providers/register

# Check backend logs for registration errors
pm2 logs dc1-provider-onboarding --lines 100 | grep -i "register\|provider"

# Verify database accepts writes
sqlite3 /home/node/dc1-platform/backend/data/providers.db \
  "INSERT INTO test_write (value) VALUES ('test');" 2>&1 || \
  echo "Database write failed"
EOF
```

### Provider Heartbeat Issues

**Provider not sending heartbeats:**
```bash
ssh root@76.13.179.86 << 'EOF'
# Check if heartbeat endpoint is being hit
pm2 logs dc1-provider-onboarding --lines 100 | grep -i "heartbeat"

# Check provider's heartbeat interval
sqlite3 /home/node/dc1-platform/backend/data/providers.db << 'SQL'
SELECT
  provider_id,
  status,
  last_heartbeat,
  CAST((julianday('now') - julianday(last_heartbeat)) * 86400 AS INTEGER) as seconds_since_heartbeat
FROM providers
WHERE status='offline'
  AND last_heartbeat > datetime('now', '-1 hour')
ORDER BY seconds_since_heartbeat DESC
LIMIT 10;
SQL
EOF
```

### Provider Discovery Issues

**Providers not discovered by DHT:**
```bash
ssh root@76.13.179.86 << 'EOF'
# Check P2P node connectivity
pm2 logs dc1-provider-onboarding --lines 50 | grep -i "peer\|dht\|announce"

# Verify bootstrap is running
pm2 status | grep dc1-p2p-bootstrap

# Check provider daemon on provider side
# (Have provider operator run this)
pm2 logs provider-daemon --lines 50 | grep -i "discover\|announce"
EOF
```

---

## Incident Response

### Provider Outage Response

**When provider goes offline:**

1. **Immediate (< 5 min):**
   - Check provider status in database
   - Check last heartbeat timestamp
   - Check VPS can reach provider IP

2. **Short-term (5-30 min):**
   - Contact provider operator
   - Check if network connectivity issue
   - Attempt provider restart (if remote access available)

3. **Investigation:**
   - Check backend logs around disconnect time
   - Check VPS network logs
   - Verify firewall rules haven't changed

4. **Recovery:**
   - Provider daemon typically restarts automatically
   - Provider will re-announce to DHT when online
   - Monitor status until back online

### Backend Service Failure

**If backend crashes:**

```bash
ssh root@76.13.179.86 << 'EOF'
# 1. Check what happened
pm2 logs dc1-provider-onboarding --lines 200

# 2. Restart service
pm2 restart dc1-provider-onboarding

# 3. Verify recovery
pm2 status

# 4. Monitor logs
pm2 logs dc1-provider-onboarding --follow --lines 20 | head -50
EOF
```

### Database Issues

**If database becomes unavailable:**

```bash
ssh root@76.13.179.86 << 'EOF'
# 1. Check database file
ls -lh /home/node/dc1-platform/backend/data/providers.db

# 2. Verify integrity
sqlite3 /home/node/dc1-platform/backend/data/providers.db "PRAGMA integrity_check;"

# 3. If corrupted, restore from backup
bash /home/node/dc1-platform/scripts/restore-db.sh

# 4. Restart backend
pm2 restart dc1-provider-onboarding
EOF
```

---

## Performance Optimization

### When Performance Degrades

1. **Identify bottleneck:**
   ```bash
   ssh root@76.13.179.86 'top -b -n1'  # CPU/Memory
   ssh root@76.13.179.86 'iostat -x 1 5'  # Disk I/O
   ```

2. **Database optimization:**
   ```bash
   ssh root@76.13.179.86 << 'EOF'
   sqlite3 /home/node/dc1-platform/backend/data/providers.db << 'SQL'
   PRAGMA optimize;
   VACUUM;
   ANALYZE;
   SQL
   EOF
   ```

3. **Index verification:**
   ```bash
   ssh root@76.13.179.86 << 'EOF'
   sqlite3 /home/node/dc1-platform/backend/data/providers.db \
     "SELECT name FROM sqlite_master WHERE type='index';"
   EOF
   ```

4. **Backend restart:**
   ```bash
   ssh root@76.13.179.86 'pm2 restart dc1-provider-onboarding'
   ```

---

## Maintenance Windows

### Planned Maintenance Schedule

**No current maintenance windows defined**

When scheduling maintenance:
- Notify providers 48 hours in advance
- Schedule during low-traffic hours (02:00-04:00 UTC)
- Have rollback plan ready
- Monitor extra closely post-maintenance

### Update Procedures

**To deploy code updates:**

```bash
ssh root@76.13.179.86 << 'EOF'
cd /home/node/dc1-platform

# 1. Pull latest code
git pull origin main

# 2. Install dependencies if needed
npm install

# 3. Run tests
npm test || echo "Tests failed - aborting"

# 4. Restart backend
pm2 restart dc1-provider-onboarding

# 5. Monitor logs
pm2 logs dc1-provider-onboarding --lines 50
EOF
```

---

## Key Contacts & Escalation

| Role | Contact | When to Contact |
|------|---------|-----------------|
| DevOps | This agent | Infrastructure issues, deployment support |
| Backend | Backend Engineer | Backend errors, API issues |
| P2P Network | P2P Engineer | Provider discovery, DHT issues |
| QA | QA Engineer | Test execution, validation issues |
| CEO | Founder | Launch decisions, critical escalations |

---

## Post-Launch Checklist (First Week)

- [ ] Monitor provider registrations (target: 10+ per day)
- [ ] Monitor job submissions (target: 5+ per day)
- [ ] Monitor provider uptime (target: > 95%)
- [ ] Monitor job success rate (target: > 95%)
- [ ] Collect user feedback
- [ ] Review performance metrics
- [ ] Optimize database indexes if needed
- [ ] Plan Phase 2 features

---

## Success Metrics (First Month)

| Metric | Target | Current |
|--------|--------|---------|
| Online Providers | > 50 | TBD |
| Job Submission Rate | > 100/day | TBD |
| Provider Uptime | > 99% | TBD |
| Job Success Rate | > 98% | TBD |
| Job Completion Time | < 5 min | TBD |
| User Satisfaction | > 4.5/5 | TBD |

---

## Status: Ready for Phase 1 Operations

All operational procedures, monitoring, and support documentation complete. DevOps ready to support Phase 1 launch and ongoing operations.

**Next Step:** Phase 1 bootstrap deployment (awaiting execution)

---
