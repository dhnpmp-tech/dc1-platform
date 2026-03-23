#!/bin/bash
# DCP Load Testing Script
# Simulates concurrent API requests to measure performance under load
# Usage: ./scripts/load-test.sh [requests] [concurrency]
# Defaults: 100 requests, 10 concurrent connections
# Output: Test results with latency, throughput, errors

set -u

REQUESTS="${1:-100}"
CONCURRENCY="${2:-10}"
API_BASE="${API_BASE:-http://76.13.179.86:8083/api}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="${REPO_ROOT}/backend/logs/load-test.log"
RESULTS_FILE="${REPO_ROOT}/backend/data/load-test-$(date -u '+%Y%m%d-%H%M%S').json"

mkdir -p "${RESULTS_FILE%/*}" "${LOG_FILE%/*}"

log() {
  local level="$1"
  local message="$2"
  local ts
  ts=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
  printf '[%s] %s | %s\n' "$ts" "$level" "$message" | tee -a "$LOG_FILE"
}

log "INFO" "Starting load test"
log "INFO" "Target: $API_BASE"
log "INFO" "Requests: $REQUESTS, Concurrency: $CONCURRENCY"

# Check if ab (Apache Bench) is available
if ! command -v ab >/dev/null 2>&1; then
  log "WARN" "Apache Bench not available. Installing benchmarking tools..."
  echo "Note: Full load testing requires apache2-utils (ab command)"
  echo "Install with: apt-get install apache2-utils"
fi

# Function to test single endpoint
test_endpoint() {
  local name="$1"
  local endpoint="$2"
  local url="${API_BASE}${endpoint}"

  log "INFO" "Testing: $name ($url)"

  # Get single request baseline
  local single_latency
  single_latency=$(curl -s -m 5 -w '%{time_total}' -o /dev/null "$url" 2>/dev/null || echo "timeout")

  # If ab is available, run load test
  if command -v ab >/dev/null 2>&1; then
    local ab_output
    ab_output=$(ab -n "$REQUESTS" -c "$CONCURRENCY" -t 30 "$url" 2>/dev/null || echo "")

    if [ -n "$ab_output" ]; then
      local complete_requests
      local failed_requests
      local min_time
      local mean_time
      local max_time
      local rps

      complete_requests=$(echo "$ab_output" | grep "Completed requests:" | awk '{print $3}')
      failed_requests=$(echo "$ab_output" | grep "Failed requests:" | awk '{print $3}')
      min_time=$(echo "$ab_output" | grep "Min time:" | awk '{print $3}')
      mean_time=$(echo "$ab_output" | grep "Mean time:" | awk '{print $3}')
      max_time=$(echo "$ab_output" | grep "Max time:" | awk '{print $3}')
      rps=$(echo "$ab_output" | grep "Requests per second:" | awk '{print $4}')

      log "PASS" "$name: ${complete_requests} complete, ${failed_requests} failed, ${mean_time}ms mean"
      echo "    Min: ${min_time}ms, Mean: ${mean_time}ms, Max: ${max_time}ms"
      echo "    RPS: ${rps} requests/sec"
    else
      log "WARN" "$name: ab test failed"
    fi
  else
    log "WARN" "$name: Using curl single request (ab not available). Latency: ${single_latency}s"
  fi
}

# Record start time
START_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
START_EPOCH=$(date -u '+%s')

# Test key endpoints
echo ""
echo "=== Health Check ==="
test_endpoint "API Health" "/health"

echo ""
echo "=== Provider Endpoints ==="
test_endpoint "Providers Available" "/providers/available"

echo ""
echo "=== System Load During Test ==="
# Capture system metrics during baseline
MEM_USAGE=$(free | awk '/^Mem:/ {printf "%.1f%%", ($3/$2)*100}')
CPU_LOAD=$(uptime | sed 's/.*load average: //')

log "INFO" "System metrics: Memory ${MEM_USAGE}, Load ${CPU_LOAD}"

# Record end time
END_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
END_EPOCH=$(date -u '+%s')
DURATION=$((END_EPOCH - START_EPOCH))

# Save results
cat > "$RESULTS_FILE" << EOF
{
  "test_id": "$(date -u '+%s')",
  "timestamp_start": "$START_TIME",
  "timestamp_end": "$END_TIME",
  "duration_seconds": $DURATION,
  "parameters": {
    "requests": $REQUESTS,
    "concurrency": $CONCURRENCY,
    "api_base": "$API_BASE"
  },
  "system": {
    "memory_percent": "$MEM_USAGE",
    "load_average": "$CPU_LOAD"
  },
  "notes": "Load test results. Compare against baseline to identify performance regressions."
}
EOF

log "PASS" "Load test complete"
echo ""
echo "Results saved to: $RESULTS_FILE"
echo "Logs available at: $LOG_FILE"

exit 0
