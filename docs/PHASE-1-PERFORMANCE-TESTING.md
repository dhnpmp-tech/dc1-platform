# Phase 1 Performance Testing & Baseline Procedures

**Document:** Performance Baseline Capture and Load Testing
**Owner:** DevOps Automator
**Created:** 2026-03-23
**Status:** READY FOR PHASE 1

---

## Overview

This document defines procedures for establishing performance baselines before Phase 1 launch and detecting performance regressions during operations.

**Objectives:**
1. Establish known-good performance baseline
2. Identify bottlenecks and limits
3. Define alert thresholds
4. Compare against historical data to detect regressions

---

## Performance Baseline Capture

### What Gets Measured

**System Metrics:**
- CPU: Count, load average, utilization
- Memory: Total, used, available, percentage
- Disk: Space, I/O patterns
- Network: Throughput (optional)
- Uptime: System stability

**Database Metrics:**
- Size (bytes)
- Table count
- Query latency (EXPLAIN QUERY PLAN)
- Connection count

**API Metrics:**
- Endpoint latency (GET /api/health, /api/providers/available)
- Response times
- Error rates
- Throughput (requests/sec)

### Baseline Capture Script

**Location:** `scripts/capture-baseline.sh`

**Features:**
- Captures system metrics
- Tests API endpoints
- Analyzes database performance
- Outputs to JSON for easy comparison
- Logs to `backend/logs/baseline.log`

**Usage:**

```bash
cd /root/dc1-platform

# Capture baseline
./scripts/capture-baseline.sh

# View results
cat backend/data/baseline-20260323-120000.json | jq .

# List all baselines
ls -lh backend/data/baseline-*.json
```

**Output Example:**

```json
{
  "timestamp": "2026-03-23T12:00:00Z",
  "system": {
    "hostname": "vps-76-13-179-86",
    "cpu_count": 8,
    "memory": {
      "total_bytes": 17179869184,
      "used_bytes": 4294967296,
      "available_bytes": 12884901888,
      "utilization_percent": 25
    },
    "load_average": "0.5, 0.4, 0.3"
  },
  "database": {
    "size_bytes": 52428800,
    "table_count": 15
  },
  "api": {
    "endpoints": {
      "health": {
        "latency_seconds": 0.025
      },
      "providers_available": {
        "latency_seconds": 0.045
      }
    }
  }
}
```

### When to Capture Baseline

**Required:**
- ✅ Before Phase 1 launch (THIS WEEK)
- ✅ Before major code deployments
- ✅ After infrastructure changes

**Recommended:**
- Weekly during Phase 1
- Monthly during steady state
- Before/after database optimizations

---

## Load Testing

### Load Test Script

**Location:** `scripts/load-test.sh`

**Features:**
- Concurrent API testing
- Uses Apache Bench (ab) if available
- Measures latency, throughput, errors
- Outputs results to JSON
- Logs to `backend/logs/load-test.log`

**Prerequisites:**

```bash
# Install Apache Bench (if not present)
apt-get install apache2-utils

# Or use built-in curl (slower, less detailed)
```

**Usage:**

```bash
# Default: 100 requests, 10 concurrent
./scripts/load-test.sh

# Custom: 500 requests, 50 concurrent
./scripts/load-test.sh 500 50

# Against different endpoint
API_BASE=http://api.dcp.sa ./scripts/load-test.sh 100 10
```

**Output Example:**

```
=== Health Check ===
Testing: API Health (http://76.13.179.86:8083/api/health)
    Min: 20ms, Mean: 25ms, Max: 150ms
    RPS: 400 requests/sec

=== Provider Endpoints ===
Testing: Providers Available (http://76.13.179.86:8083/api/providers/available)
    Min: 35ms, Mean: 45ms, Max: 200ms
    RPS: 220 requests/sec

Results saved to: backend/data/load-test-20260323-120000.json
```

### Load Test Scenarios

**Scenario 1: Baseline Load (Light)**
```bash
./scripts/load-test.sh 100 10
# 100 requests, 10 concurrent
# Expected: <50ms latency, >200 RPS
```

**Scenario 2: Medium Load**
```bash
./scripts/load-test.sh 300 25
# 300 requests, 25 concurrent
# Expected: <100ms latency, >150 RPS
```

**Scenario 3: Heavy Load**
```bash
./scripts/load-test.sh 500 50
# 500 requests, 50 concurrent
# Expected: <200ms latency, >100 RPS
```

### Interpreting Results

| Metric | Good | Acceptable | Poor |
|--------|------|-----------|------|
| **Latency** | <50ms | <100ms | >200ms |
| **RPS** | >200 | >150 | <100 |
| **Error Rate** | 0% | <1% | >5% |
| **Max Time** | <200ms | <500ms | >1000ms |

---

## Capacity Planning

### Resource Limits

Based on VPS 76.13.179.86 specifications:

**Hardware:**
- CPU: 8 cores
- Memory: 16GB
- Disk: Variable SSD
- Network: Gigabit

**Estimated Limits:**

| Metric | Limit | Safety Margin | Alert Threshold |
|--------|-------|---------------|-----------------|
| **Memory** | 16GB | 80% | 12.8GB |
| **Disk** | Varies | 80% | (varies) |
| **Concurrent Connections** | 500 | 70% | 350 |
| **Database Size** | <1GB | - | 800MB |
| **CPU Load** | 8 cores | 85% | 6.8 cores |

### Identifying Bottlenecks

**During Load Tests:**

1. **CPU Bound** — CPU usage approaches 100% while memory/disk idle
   - Solution: Code optimization, caching, async processing

2. **Memory Bound** — Memory usage approaches 80%
   - Solution: Database query optimization, pagination, compression

3. **Disk Bound** — Disk I/O high, writes/reads delayed
   - Solution: Database indexing, write batching, SSD upgrade

4. **Network Bound** — Network saturation or external delays
   - Solution: Pagination, compression, connection pooling

### Scaling Recommendations

**If hitting 70% of limit:**
1. Optimize the bottleneck (code/database)
2. Consider horizontal scaling (load balancer)
3. Increase VPS resources (vertical scaling)

**Horizontal Scaling:**
- Multiple API instances behind load balancer
- Separate database server
- Cache layer (Redis)

**Vertical Scaling:**
- Larger VPS (more CPU/memory)
- Faster SSD
- Better network tier

---

## Baseline Comparison

### Weekly Performance Review

**Process:**

1. **Capture new baseline**
   ```bash
   ./scripts/capture-baseline.sh
   ```

2. **Compare with previous week**
   ```bash
   # Use jq to compare metrics
   jq '.database.size_bytes' backend/data/baseline-latest.json
   jq '.api.endpoints.health.latency_seconds' backend/data/baseline-latest.json
   ```

3. **Identify changes**
   - Database size growth
   - Latency increases
   - Memory usage trends
   - Error rates

4. **Investigate anomalies**
   - Query optimization needed?
   - Indexes missing?
   - Memory leak?
   - Disk space filling up?

### Performance Regression Detection

**Automated Alerts:** (Future enhancement)

If latency increases > 20%:
```
alert "API Health latency: 30ms (baseline 25ms, +20%)"
```

If database size grows > 50MB/week:
```
alert "Database growth: 50MB/week (baseline 10MB/week)"
```

---

## Monitoring During Phase 1

### Continuous Metrics

**Real-time Monitoring:**
- VPS health checks (5-minute interval) — DCP-628
- API response times (sampled in logs)
- Database size (checked weekly)
- Error rates (per API endpoint)

**Dashboard Metrics:**
- Provider count
- Active jobs
- Renter requests
- System resource usage

### Alert Thresholds

Based on baseline + 50% headroom:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Memory > 80% | Alert | Investigation required |
| Disk > 80% | Alert | Cleanup or scale |
| API latency 2x baseline | Alert | Performance regression |
| Error rate > 5% | Critical | Immediate investigation |
| Database > 800MB | Warning | Cleanup or migration |

---

## Pre-Phase 1 Launch Checklist

**Performance Testing Tasks:**

- [ ] Capture initial baseline: `./scripts/capture-baseline.sh`
- [ ] Run light load test: `./scripts/load-test.sh 100 10`
- [ ] Run medium load test: `./scripts/load-test.sh 300 25`
- [ ] Document baseline metrics in baseline-summary.md
- [ ] Identify any bottlenecks
- [ ] Verify alert thresholds are reasonable
- [ ] Test alert notifications (Telegram)
- [ ] Record capacity limits
- [ ] Create performance dashboard (optional)
- [ ] Brief ops team on metrics

---

## Tools & Commands Reference

### System Monitoring

```bash
# Real-time system stats
top -b -n 1 | head -20

# Memory usage
free -h

# Disk usage
df -h
du -sh backend/data/

# CPU load
uptime

# Network throughput
ifstat -i eth0

# I/O performance
iostat -x 1 5
```

### Database Performance

```bash
# Database size
sqlite3 backend/data/providers.db "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();"

# Table sizes
sqlite3 backend/data/providers.db "SELECT name, COUNT(*) FROM providers GROUP BY 1;"

# Query performance
sqlite3 backend/data/providers.db ".timer on"
sqlite3 backend/data/providers.db "SELECT * FROM providers WHERE created_at > datetime('now', '-1 day');"
```

### API Performance

```bash
# Measure single request latency
curl -s -w "Time: %{time_total}s\n" -o /dev/null http://76.13.179.86:8083/api/health

# Load test with Apache Bench
ab -n 100 -c 10 http://76.13.179.86:8083/api/health

# Run custom baseline script
./scripts/capture-baseline.sh
```

### Log Analysis

```bash
# View performance logs
tail -50 backend/logs/baseline.log
tail -50 backend/logs/load-test.log

# Search for errors
grep "ERROR\|FAIL" backend/logs/*.log

# Monitor in real-time
tail -f backend/logs/out.log
```

---

## Performance Troubleshooting

### High Memory Usage

**Symptoms:**
- Memory > 12GB
- Frequent swapping
- Slow responses

**Investigation:**
```bash
# Check Node.js process
ps aux | grep node
node -e "console.log(process.memoryUsage())"

# Identify memory leak
# Check if memory grows over time
# Review recent code changes
```

**Solutions:**
- Restart PM2 service
- Review large query results
- Implement pagination
- Add memory limits to PM2

### High CPU Usage

**Symptoms:**
- CPU load > 85%
- RPS drops
- High latency

**Investigation:**
```bash
# Check CPU-intensive processes
top -b -n 1 | sort -k 9 -rn | head

# Check query plans
sqlite3 backend/data/providers.db "EXPLAIN QUERY PLAN SELECT ..."
```

**Solutions:**
- Optimize slow queries
- Add database indexes
- Cache results
- Scale horizontally

### High Disk I/O

**Symptoms:**
- Disk utilization high
- Writes/reads delayed
- Database slow

**Investigation:**
```bash
# Monitor disk I/O
iostat -x 1 10

# Check slow queries
sqlite3 backend/data/providers.db ".timer on"
```

**Solutions:**
- Add missing indexes
- Batch writes
- Archive old logs
- Upgrade to faster storage

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-23 | Initial baseline and load testing procedures |

---

**Status:** READY FOR PHASE 1 LAUNCH
**Last Updated:** 2026-03-23
**Next Review:** During Phase 1 (weekly)
