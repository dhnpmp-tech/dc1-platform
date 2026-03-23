#!/bin/bash
# DCP Performance Baseline Capture Script
# Captures system metrics, API performance, and database stats before Phase 1 launch
# Usage: ./scripts/capture-baseline.sh
# Output: backend/data/baseline-$(date +%Y%m%d-%H%M%S).json

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_DIR="${REPO_ROOT}/backend/data"
TIMESTAMP=$(date -u '+%Y%m%d-%H%M%S')
BASELINE_FILE="${BASELINE_DIR}/baseline-${TIMESTAMP}.json"
LOG_FILE="${REPO_ROOT}/backend/logs/baseline.log"
API_BASE="${API_BASE:-http://76.13.179.86:8083/api}"

mkdir -p "${BASELINE_DIR}" "${LOG_FILE%/*}"

log() {
  local level="$1"
  local message="$2"
  local ts
  ts=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
  printf '[%s] %s | %s\n' "$ts" "$level" "$message" | tee -a "$LOG_FILE"
}

# Fetch JSON from curl, handle errors gracefully
fetch_json() {
  local url="$1"
  local timeout="${2:-5}"

  local response
  response=$(curl -s -m "$timeout" "$url" 2>/dev/null || echo "")

  if [ -z "$response" ]; then
    echo "{\"error\": \"request failed or timed out\"}"
  else
    echo "$response"
  fi
}

log "INFO" "Starting performance baseline capture"
log "INFO" "Timestamp: $TIMESTAMP"
log "INFO" "API Base: $API_BASE"

# Collect baseline data
echo "Collecting system metrics..."

# 1. System Information
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")
KERNEL=$(uname -r 2>/dev/null || echo "unknown")
UPTIME=$(uptime 2>/dev/null | sed 's/.*up //' | sed 's/, [0-9]* user.*//')
LOAD=$(uptime 2>/dev/null | sed 's/.*load average: //')

# 2. Memory
MEM_TOTAL=$(free -b | awk '/^Mem:/ {print $2}')
MEM_AVAILABLE=$(free -b | awk '/^Mem:/ {print $7}')
MEM_USED=$(free -b | awk '/^Mem:/ {print $3}')
MEM_PCT=$((100 * MEM_USED / MEM_TOTAL))

# 3. CPU
CPU_COUNT=$(nproc 2>/dev/null || echo "unknown")

# 4. Disk
DISK_ROOT=$(df -B1 / | awk 'NR==2 {print "{\"total\": "$2", \"used\": "$3", \"available\": "$4"}')

# 5. Database size
DB_PATH="${REPO_ROOT}/backend/data/providers.db"
if [ -f "$DB_PATH" ]; then
  DB_BYTES=$(du -b "$DB_PATH" | awk '{print $1}')
  DB_TABLES=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type=\"table\";" 2>/dev/null || echo "0")
else
  DB_BYTES="null"
  DB_TABLES="null"
fi

# 6. API Performance Tests
log "INFO" "Testing API endpoints..."

HEALTH_RESPONSE=$(fetch_json "$API_BASE/health" 3)
HEALTH_TIME=$(date -u '+%s%N')
curl -s -m 3 -o /dev/null -w '%{time_total}' "$API_BASE/health" > /dev/null 2>&1
HEALTH_LATENCY=$(curl -s -m 3 -w '%{time_total}' -o /dev/null "$API_BASE/health" 2>/dev/null || echo "null")

PROVIDERS_LATENCY=$(curl -s -m 3 -w '%{time_total}' -o /dev/null "$API_BASE/providers/available" 2>/dev/null || echo "null")

# 7. Database Query Performance
log "INFO" "Testing database performance..."

DB_PERF_PROVIDERS=$(sqlite3 "$DB_PATH" "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM providers;" 2>/dev/null | head -1 || echo "")
DB_PERF_SESSIONS=$(sqlite3 "$DB_PATH" "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM serve_sessions;" 2>/dev/null | head -1 || echo "")

# Build JSON output
cat > "$BASELINE_FILE" << EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "version": "1.0",
  "system": {
    "hostname": "$HOSTNAME",
    "kernel": "$KERNEL",
    "uptime": "$UPTIME",
    "cpu_count": $CPU_COUNT,
    "load_average": "$LOAD",
    "memory": {
      "total_bytes": $MEM_TOTAL,
      "used_bytes": $MEM_USED,
      "available_bytes": $MEM_AVAILABLE,
      "utilization_percent": $MEM_PCT
    },
    "disk": {
      "root": $DISK_ROOT
    }
  },
  "database": {
    "path": "$DB_PATH",
    "size_bytes": $DB_BYTES,
    "table_count": $DB_TABLES
  },
  "api": {
    "base_url": "$API_BASE",
    "endpoints": {
      "health": {
        "latency_seconds": $HEALTH_LATENCY,
        "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
      },
      "providers_available": {
        "latency_seconds": $PROVIDERS_LATENCY,
        "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
      }
    }
  },
  "notes": "Baseline capture for Phase 1 launch. Record these metrics for comparison during load testing and performance monitoring."
}
EOF

log "PASS" "Baseline captured: $BASELINE_FILE"
log "INFO" "System: $HOSTNAME ($KERNEL)"
log "INFO" "Memory: ${MEM_USED} / ${MEM_TOTAL} bytes (${MEM_PCT}%)"
log "INFO" "Disk: ${DISK_ROOT}"
log "INFO" "Database: ${DB_BYTES} bytes, ${DB_TABLES} tables"
log "INFO" "API Health Latency: ${HEALTH_LATENCY}s"
log "INFO" "API Providers Latency: ${PROVIDERS_LATENCY}s"

echo ""
echo "✓ Baseline saved to: $BASELINE_FILE"
echo ""
echo "To view baseline:"
echo "  cat $BASELINE_FILE | jq ."
echo ""
echo "Next: Run load tests and compare against baseline"

exit 0
