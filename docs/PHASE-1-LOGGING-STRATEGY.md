# Phase 1 Logging and Error Tracking Strategy

**Document:** Logging, error tracking, and operational visibility
**Owner:** DevOps Automator
**Created:** 2026-03-23
**Status:** READY FOR PHASE 1

---

## Overview

This document defines the logging strategy for Phase 1 operations. The objective is to provide rapid incident response and troubleshooting through structured logging, error aggregation, and automated analysis.

**Key Principles:**
1. **Structured Logging** — Machine-parseable JSON logs for easy filtering
2. **Error Aggregation** — Group similar errors, detect patterns
3. **Automated Cleanup** — Rotate logs >100MB, delete >30 days old
4. **Real-time Analysis** — Identify critical events and anomalies
5. **Operational Visibility** — Track providers, jobs, billing, database health

---

## Log Architecture

### Log Files

**Location:** `/root/dc1-platform/backend/logs/`

| Log File | Purpose | Size Limit | Rotation |
|----------|---------|-----------|----------|
| **out.log** | Application output, info messages | 100MB | Daily |
| **error.log** | Errors, warnings, critical events | 100MB | Daily |
| **vps-health.log** | VPS health check results | 100MB | Weekly |
| **backup.log** | Database backup operations | 10MB | Monthly |
| **restore.log** | Database restore operations | 10MB | Monthly |
| **load-test.log** | Performance test results | 10MB | On-demand |
| **baseline.log** | Performance baseline capture | 10MB | On-demand |

### Log Rotation

**Trigger:** File size > 100MB OR age > 30 days

**Process:**
1. Rename with timestamp: `error.log` → `error.log.2026-03-23.143000`
2. Compress with gzip: `error.log.2026-03-23.143000.gz`
3. Move to `logs/archive/`
4. Delete archives > 30 days old

**Automated:** Daily at 4 AM UTC via `dcp-log-rotation-cron` PM2 job

**Script:** `scripts/rotate-logs.sh`

```bash
# Manual rotation
./scripts/rotate-logs.sh

# View rotation stats
tail -20 backend/logs/rotation.log
```

---

## Log Levels & Formatting

### Standard Log Levels

```
DEBUG    — Detailed diagnostic information (mostly suppressed in production)
INFO     — General informational messages (normal operation)
WARN     — Warning messages (potential issues, not errors)
ERROR    — Recoverable errors (request failed, retry possible)
CRITICAL — System-level failures (service down, data loss risk)
```

### Log Message Format (Current)

```
[TIMESTAMP] LEVEL | MESSAGE

Example:
[2026-03-23 12:30:00 UTC] WARN | Database query took 500ms, threshold 100ms
[2026-03-23 12:30:15 UTC] ERROR | Provider dc1-provider-1 disconnected
[2026-03-23 12:30:45 UTC] INFO | Job job-12345 submitted by renter-567
```

### Recommended JSON Format (Future Enhancement)

```json
{
  "timestamp": "2026-03-23T12:30:00Z",
  "level": "ERROR",
  "service": "dc1-provider-onboarding",
  "message": "Provider registration failed",
  "error": "Database connection timeout",
  "provider_id": "dc1-provider-1",
  "trace_id": "req-abc-123",
  "context": {
    "retry_count": 2,
    "elapsed_ms": 5000
  }
}
```

---

## Critical Events to Log

### Provider Events

**Provider Registration:**
```
INFO | Provider registered: {provider_id}, {address}, {gpu_count} GPUs
ERROR | Provider registration failed: {provider_id}, reason: {reason}
```

**Provider Connectivity:**
```
INFO | Provider online: {provider_id}
WARN | Provider offline: {provider_id}, last_heartbeat: 5m ago
ERROR | Provider connection lost: {provider_id}, network error
```

**Provider Activity:**
```
INFO | Provider submitted inference job: {job_id}, model: {model}
INFO | Provider completed job: {job_id}, duration: {duration}ms
ERROR | Provider job failed: {job_id}, error: {error}
```

### Renter Events

**Job Submission:**
```
INFO | Job submitted: {job_id}, model: {model}, renter: {renter_id}
ERROR | Job submission failed: {renter_id}, reason: {reason}
```

**Job Execution:**
```
INFO | Job started: {job_id}, provider: {provider_id}
INFO | Job completed: {job_id}, duration: {duration}ms, tokens: {tokens}
ERROR | Job failed: {job_id}, provider: {provider_id}, error: {error}
```

**Billing:**
```
INFO | Billing: {job_id}, tokens: {tokens}, cost: ${cost}, renter: {renter_id}
WARN | Low balance warning: renter_id={renter_id}, balance=${balance}
ERROR | Billing error: {job_id}, reason: {reason}
```

### Database Events

**Query Performance:**
```
WARN | Slow query: SELECT * FROM providers, duration: 250ms (threshold: 100ms)
WARN | Database size: 456MB, threshold: 500MB
ERROR | Database lock timeout: SELECT providers
```

**Maintenance:**
```
INFO | Backup started: providers.db
INFO | Backup completed: 52MB (123MB → 52MB, 58% compression)
INFO | Database restored from backup: {backup_file}
```

### API Events

**Request Processing:**
```
INFO | API request: GET /api/health, duration: 25ms, status: 200
WARN | Slow API response: POST /api/jobs/submit, duration: 250ms, status: 200
ERROR | API error: GET /api/providers/{id}, duration: 5000ms, status: 500, error: Connection timeout
```

**Authentication:**
```
WARN | Failed auth: POST /api/admin/dashboard, reason: invalid token
ERROR | Rate limit exceeded: {ip_address}, endpoint: {endpoint}
```

---

## Log Analysis

### Manual Log Analysis

**View Recent Errors:**
```bash
tail -50 backend/logs/error.log
```

**Search for Specific Error:**
```bash
grep "provider.*disconnect" backend/logs/*.log
grep "timeout" backend/logs/error.log
```

**Count Errors by Type:**
```bash
grep "ERROR" backend/logs/error.log | cut -d'|' -f2- | sort | uniq -c | sort -rn
```

**Follow Logs in Real-Time:**
```bash
tail -f backend/logs/out.log
tail -f backend/logs/error.log
```

### Automated Log Analysis

**Script:** `scripts/analyze-logs.sh`

**Usage:**
```bash
# Analyze last 24 hours (default)
./scripts/analyze-logs.sh

# Analyze last 6 hours
./scripts/analyze-logs.sh 6

# Analyze last 7 days
./scripts/analyze-logs.sh 168
```

**Output:**
```
1. ERROR SUMMARY
   Total Errors: 12
   Critical Errors: 0
   Warnings: 3

2. CRITICAL EVENTS
   Provider Registrations: 5
   Provider Disconnections: 2
   Jobs Submitted: 28
   Jobs Completed: 26
   Jobs Failed: 2
   API 500 Errors: 0

3. RECENT ERRORS
   [2026-03-23 12:30:15 UTC] ERROR | Provider disconnected
   [2026-03-23 12:30:45 UTC] WARN | Slow query: 250ms

4. RECOMMENDATIONS
   ✓ Error rates normal
   ✓ Connectivity stable
```

---

## Error Detection & Alerting

### Critical Error Patterns

**Detect: Error Spike**
```
Trigger: >5 errors per minute
Action: Alert to operations team
Reason: Indicates systematic failure, not isolated error
```

**Detect: Provider Connectivity Loss**
```
Trigger: >3 providers offline simultaneously
Action: Alert, check network connectivity
Reason: May indicate VPS network issue or mass provider failure
```

**Detect: Billing System Failure**
```
Trigger: Billing errors >3 in 1 hour
Action: Critical alert, halt job submissions
Reason: Cannot charge renters, financial loss risk
```

**Detect: Database Issues**
```
Trigger: Slow query (>500ms) OR query timeout
Action: Alert, investigate query plan
Reason: May indicate missing index or lock contention
```

**Detect: API Errors**
```
Trigger: HTTP 500 OR timeout >50% of requests
Action: Alert, check application logs
Reason: May indicate memory leak, connection pool exhausted
```

### Manual Alert Response

When an alert occurs:

1. **Check Severity:**
   ```bash
   # View error context
   tail -50 backend/logs/error.log
   grep "ERROR" backend/logs/error.log | tail -10
   ```

2. **Analyze Cause:**
   ```bash
   # Run automated analysis
   ./scripts/analyze-logs.sh

   # Check system health
   ./scripts/vps-health.sh
   ```

3. **Take Action:**
   - If provider connectivity: Check network connectivity
   - If billing: Check database, verify transactions
   - If API errors: Check application logs, restart service if needed
   - If database: Check query performance, run maintenance

4. **Document:**
   - Record incident in logs
   - Note resolution steps
   - Update runbook if needed

---

## Log Retention Policy

**Active Logs:** Kept in `backend/logs/` directory

| Type | Retention | Size Limit | Rotation |
|------|-----------|-----------|----------|
| **out.log** | 30 days | 100MB | Daily if needed |
| **error.log** | 30 days | 100MB | Daily if needed |
| **vps-health.log** | 30 days | 100MB | Weekly |
| **backup.log** | 90 days | 10MB | Monthly |
| **analysis.log** | 30 days | 10MB | Weekly |

**Archive:** Logs > 30 days automatically deleted

**Backups:** Database backups kept 7 days (separate system)

---

## Log Monitoring During Phase 1

### Daily Log Review

**Schedule:** 9 AM UTC (morning briefing)

**Process:**
1. Run log analysis: `./scripts/analyze-logs.sh 24`
2. Review error summary
3. Check critical events
4. Note trends
5. Report to team if issues found

### Weekly Log Review

**Schedule:** Every Monday 10 AM UTC

**Process:**
1. Run 7-day analysis: `./scripts/analyze-logs.sh 168`
2. Identify patterns
3. Review error trends
4. Discuss improvements
5. Update runbooks if needed

### Real-time Monitoring

**Continuous:**
```bash
# Run in terminal or tmux session
tail -f backend/logs/error.log

# Or watch both simultaneously
tail -f backend/logs/out.log backend/logs/error.log
```

**Automated:** VPS health checks every 5 minutes (DCP-628)

---

## Troubleshooting Common Issues

### "Error logs too large"

**Cause:** Logs > 30 days old not being deleted

**Solution:**
```bash
# Check archive directory size
du -sh backend/logs/archive/

# Manually delete old archives
find backend/logs/archive -name "*.gz" -mtime +30 -delete

# Run rotation script
./scripts/rotate-logs.sh
```

### "Can't find error for incident"

**Cause:** Error was in compressed archive, not active log

**Solution:**
```bash
# List archives
ls -lh backend/logs/archive/

# Decompress and search
gzip -dc backend/logs/archive/error.log.*.gz | grep "keyword"
```

### "Log rotation not working"

**Cause:** Script not running via PM2, or permissions issue

**Solution:**
```bash
# Check PM2 job status
pm2 status | grep log-rotation

# View PM2 logs
pm2 logs dcp-log-rotation-cron

# Run script manually
./scripts/rotate-logs.sh
```

### "Can't analyze logs"

**Cause:** analyze-logs.sh not executable, or missing logs

**Solution:**
```bash
# Make executable
chmod +x ./scripts/analyze-logs.sh

# Verify logs exist
ls -lh backend/logs/

# Run analysis
./scripts/analyze-logs.sh
```

---

## Future Enhancements

**Recommended for Phase 2+:**

1. **Structured JSON Logging**
   - Convert logs to JSON format for machine parsing
   - Easier to aggregate and analyze
   - Better integration with monitoring tools

2. **Centralized Log Aggregation**
   - Send logs to ELK Stack or Splunk
   - Real-time search across all logs
   - Automated alerting

3. **Distributed Tracing**
   - Add trace IDs to follow requests across services
   - Useful when multiple microservices involved
   - Enable correlation of related logs

4. **Custom Dashboards**
   - Grafana dashboard showing error rates
   - Job success/failure trends
   - Provider connectivity status
   - API latency distribution

5. **Automated Incident Response**
   - Trigger actions on error patterns
   - Auto-restart services
   - Notification escalation (Slack, PagerDuty)

---

## Scripts & Tools Reference

| Script | Purpose | Schedule |
|--------|---------|----------|
| `rotate-logs.sh` | Compress and cleanup old logs | Daily 4 AM UTC |
| `analyze-logs.sh` | Generate error summary and trends | On-demand or daily |
| `vps-health.sh` | System health check | Every 5 minutes |
| `backup-db.sh` | Database backup | Daily 3 AM UTC |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-23 | Initial logging strategy for Phase 1 |

---

**Status:** READY FOR PHASE 1 LAUNCH
**Last Updated:** 2026-03-23
**Next Review:** During Phase 1 (weekly)
