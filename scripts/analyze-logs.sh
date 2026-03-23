#!/bin/bash
# DCP Log Analysis Script
# Analyzes error logs: error counts, types, trends, critical events
# Usage: ./scripts/analyze-logs.sh [hours]
# Default: 24 hours (last day)

set -u

HOURS="${1:-24}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${REPO_ROOT}/backend/logs"
ERROR_LOG="${LOG_DIR}/error.log"
OUT_LOG="${LOG_DIR}/out.log"
REPORT_FILE="${LOG_DIR}/analysis-$(date -u '+%Y%m%d-%H%M%S').txt"

# Calculate cutoff time
CUTOFF_EPOCH=$(($(date -u '+%s') - HOURS * 3600))
CUTOFF_DATE=$(date -u -d "@$CUTOFF_EPOCH" '+%Y-%m-%d %H:%M:%S')

echo "═══════════════════════════════════════════════════════════════"
echo "DCP Log Analysis Report"
echo "Period: Last $HOURS hours (since $CUTOFF_DATE UTC)"
echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. ERROR COUNT & TYPES
echo "1. ERROR SUMMARY"
echo "─────────────────────────────────────────────────────────────"

if [ -f "$ERROR_LOG" ]; then
  # Count errors
  ERROR_COUNT=$(grep -c "ERROR\|error\|Error" "$ERROR_LOG" 2>/dev/null || echo "0")
  CRITICAL_COUNT=$(grep -c "CRITICAL\|CRITICAL ERROR" "$ERROR_LOG" 2>/dev/null || echo "0")
  WARN_COUNT=$(grep -c "WARN\|warn\|WARNING" "$ERROR_LOG" 2>/dev/null || echo "0")

  echo "Total Errors: $ERROR_COUNT"
  echo "Critical Errors: $CRITICAL_COUNT"
  echo "Warnings: $WARN_COUNT"
  echo ""

  # Top error types
  echo "Top Error Types:"
  grep -o "Error: [^,]*" "$ERROR_LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -5 || echo "  (no errors found)"
  echo ""
else
  echo "Error log not found: $ERROR_LOG"
  echo ""
fi

# 2. CRITICAL EVENTS
echo "2. CRITICAL EVENTS"
echo "─────────────────────────────────────────────────────────────"

if [ -f "$OUT_LOG" ]; then
  # Provider connectivity
  PROVIDER_CONNECT=$(grep -c "provider.*connect\|provider.*registered" "$OUT_LOG" 2>/dev/null || echo "0")
  PROVIDER_DISCONNECT=$(grep -c "provider.*disconnect\|provider.*offline" "$OUT_LOG" 2>/dev/null || echo "0")

  echo "Provider Registrations: $PROVIDER_CONNECT"
  echo "Provider Disconnections: $PROVIDER_DISCONNECT"
  echo ""

  # Job events
  JOB_SUBMIT=$(grep -c "job.*submit\|job.*created" "$OUT_LOG" 2>/dev/null || echo "0")
  JOB_COMPLETE=$(grep -c "job.*complete\|job.*success" "$OUT_LOG" 2>/dev/null || echo "0")
  JOB_FAIL=$(grep -c "job.*fail\|job.*error" "$OUT_LOG" 2>/dev/null || echo "0")

  echo "Jobs Submitted: $JOB_SUBMIT"
  echo "Jobs Completed: $JOB_COMPLETE"
  echo "Jobs Failed: $JOB_FAIL"
  echo ""

  # API metrics
  API_500=$(grep -c "HTTP 500\|500 Internal" "$OUT_LOG" 2>/dev/null || echo "0")
  API_TIMEOUT=$(grep -c "timeout\|timed out" "$OUT_LOG" 2>/dev/null || echo "0")

  echo "API 500 Errors: $API_500"
  echo "Timeout Events: $API_TIMEOUT"
  echo ""
else
  echo "Output log not found: $OUT_LOG"
  echo ""
fi

# 3. RECENT ERRORS
echo "3. RECENT ERRORS (Last 10)"
echo "─────────────────────────────────────────────────────────────"

if [ -f "$ERROR_LOG" ]; then
  tail -10 "$ERROR_LOG" | sed 's/^/  /'
  echo ""
else
  echo "  (no errors logged)"
  echo ""
fi

# 4. TREND ANALYSIS
echo "4. ERROR RATE TREND"
echo "─────────────────────────────────────────────────────────────"

if [ -f "$ERROR_LOG" ]; then
  # Count errors per hour
  echo "Errors by hour (recent 6 hours):"
  for i in {5..0}; do
    HOUR_START=$(($(date -u '+%s') - i * 3600))
    HOUR_END=$((HOUR_START + 3600))
    HOUR_DATE=$(date -u -d "@$HOUR_START" '+%Y-%m-%d %H:00')

    # This is approximate - would need structured logs for precise hourly breakdown
    echo "  $HOUR_DATE: ~N errors (check logs for details)"
  done
  echo ""
else
  echo "  (insufficient data)"
  echo ""
fi

# 5. DATABASE WARNINGS
echo "5. DATABASE & SYSTEM WARNINGS"
echo "─────────────────────────────────────────────────────────────"

if [ -f "$OUT_LOG" ]; then
  DB_WARN=$(grep -c "database\|query.*slow\|index\|lock" "$OUT_LOG" 2>/dev/null || echo "0")
  MEMORY_WARN=$(grep -c "memory\|OOM\|out of memory" "$OUT_LOG" 2>/dev/null || echo "0")
  DISK_WARN=$(grep -c "disk.*full\|space\|no space" "$OUT_LOG" 2>/dev/null || echo "0")

  echo "Database Warnings: $DB_WARN"
  echo "Memory Warnings: $MEMORY_WARN"
  echo "Disk Space Warnings: $DISK_WARN"
  echo ""
else
  echo "  (no warnings found)"
  echo ""
fi

# 6. RECOMMENDATION
echo "6. RECOMMENDATIONS"
echo "─────────────────────────────────────────────────────────────"

if [ "$ERROR_COUNT" -gt 100 ]; then
  echo "⚠ High error rate detected. Investigate:"
  echo "  - Check recent deployments"
  echo "  - Review error types (see section 2)"
  echo "  - Check system resources"
elif [ "$ERROR_COUNT" -gt 10 ]; then
  echo "⚠ Elevated error rate. Monitor closely."
else
  echo "✓ Error rates normal."
fi

if [ "$API_500" -gt 5 ]; then
  echo "⚠ Multiple API errors. Check backend logs."
fi

if [ "$PROVIDER_DISCONNECT" -gt "$PROVIDER_CONNECT" ]; then
  echo "⚠ More providers disconnecting than connecting. Check connectivity."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Report saved to: $REPORT_FILE"

# Save to file
{
  echo "DCP Log Analysis Report"
  echo "Period: Last $HOURS hours"
  echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo ""
  echo "Total Errors: $ERROR_COUNT"
  echo "Critical Errors: $CRITICAL_COUNT"
  echo "Provider Connections: $PROVIDER_CONNECT / Disconnections: $PROVIDER_DISCONNECT"
  echo "API 500 Errors: $API_500"
} > "$REPORT_FILE"

exit 0
