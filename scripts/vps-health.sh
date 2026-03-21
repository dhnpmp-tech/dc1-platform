#!/bin/bash

# DCP VPS daily health check
# Usage: ./scripts/vps-health.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
TOTAL_CHECKS=0
ALERT_CHAT_ID="7652446182"
ALERT_LOCKFILE="/tmp/dcp-vps-health-alert.lock"
ALERT_COOLDOWN_SECONDS=$((30 * 60))
ALERT_REASONS=()
PM2_DOWN_PROCESSES=""

report() {
  local level="$1"
  local message="$2"
  printf '[%s] %s\n' "$level" "$message"

  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  case "$level" in
    PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
  esac
}

get_cpu_usage_pct() {
  local cpu_line_start cpu_line_end
  local user1 nice1 system1 idle1 iowait1 irq1 softirq1 steal1
  local user2 nice2 system2 idle2 iowait2 irq2 softirq2 steal2
  local idle_start idle_end total_start total_end total_diff idle_diff usage

  cpu_line_start=$(grep '^cpu ' /proc/stat)
  read -r _ user1 nice1 system1 idle1 iowait1 irq1 softirq1 steal1 _ _ <<< "$cpu_line_start"
  sleep 1
  cpu_line_end=$(grep '^cpu ' /proc/stat)
  read -r _ user2 nice2 system2 idle2 iowait2 irq2 softirq2 steal2 _ _ <<< "$cpu_line_end"

  idle_start=$((idle1 + iowait1))
  idle_end=$((idle2 + iowait2))
  total_start=$((user1 + nice1 + system1 + idle1 + iowait1 + irq1 + softirq1 + steal1))
  total_end=$((user2 + nice2 + system2 + idle2 + iowait2 + irq2 + softirq2 + steal2))

  total_diff=$((total_end - total_start))
  idle_diff=$((idle_end - idle_start))

  if [ "$total_diff" -le 0 ]; then
    echo "0"
    return
  fi

  usage=$(( (100 * (total_diff - idle_diff)) / total_diff ))
  echo "$usage"
}

send_telegram_alert_if_needed() {
  if [ "${#ALERT_REASONS[@]}" -eq 0 ]; then
    return
  fi

  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
    report "WARN" "Telegram alert skipped: TELEGRAM_BOT_TOKEN is not set"
    return
  fi

  local now last_sent elapsed reason_lines message host_name
  now=$(date +%s)
  last_sent=0
  if [ -f "$ALERT_LOCKFILE" ]; then
    last_sent=$(cat "$ALERT_LOCKFILE" 2>/dev/null || echo "0")
  fi

  if ! [[ "$last_sent" =~ ^[0-9]+$ ]]; then
    last_sent=0
  fi

  elapsed=$((now - last_sent))
  if [ "$last_sent" -gt 0 ] && [ "$elapsed" -lt "$ALERT_COOLDOWN_SECONDS" ]; then
    report "PASS" "Alert cooldown active: Telegram suppressed (${elapsed}s since last send)"
    return
  fi

  reason_lines=$(printf ' - %s\n' "${ALERT_REASONS[@]}")
  host_name=$(hostname 2>/dev/null || echo "unknown-host")
  message=$(cat <<EOF
DCP VPS ALERT
Host: ${host_name}
Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

Threshold breaches:
${reason_lines}
EOF
)

  if curl -sS --max-time 10 -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${ALERT_CHAT_ID}" \
    --data-urlencode "text=${message}" >/dev/null; then
    printf '%s\n' "$now" > "$ALERT_LOCKFILE"
    report "WARN" "Telegram alert sent to chat ${ALERT_CHAT_ID}"
  else
    report "WARN" "Telegram alert failed to send"
  fi
}

printf '=== DCP VPS Health Check (%s) ===\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# 1) Disk usage (/), alert if >80%
DISK_LINE=$(df -h / | awk 'NR==2 {print $3"|"$2"|"$5}')
DISK_USED=$(echo "$DISK_LINE" | cut -d'|' -f1)
DISK_TOTAL=$(echo "$DISK_LINE" | cut -d'|' -f2)
DISK_PCT_STR=$(echo "$DISK_LINE" | cut -d'|' -f3)
DISK_PCT=${DISK_PCT_STR%%%}
if [ "$DISK_PCT" -gt 80 ]; then
  report "WARN" "Disk: ${DISK_PCT}% used (${DISK_USED}/${DISK_TOTAL})"
  ALERT_REASONS+=("Disk usage ${DISK_PCT}% > 80%")
else
  report "PASS" "Disk: ${DISK_PCT}% used (${DISK_USED}/${DISK_TOTAL})"
fi

# 2) Memory usage
MEM_LINE=$(free -h | awk '/^Mem:/ {print $3"|"$2}')
MEM_USED=$(echo "$MEM_LINE" | cut -d'|' -f1)
MEM_TOTAL=$(echo "$MEM_LINE" | cut -d'|' -f2)
MEM_PCT=$(free | awk '/^Mem:/ { if ($2 > 0) printf "%d", ($3*100)/$2; else print 0 }')
if [ "$MEM_PCT" -gt 90 ]; then
  report "WARN" "Memory: ${MEM_USED}/${MEM_TOTAL} used (${MEM_PCT}%)"
  ALERT_REASONS+=("Memory usage ${MEM_PCT}% > 90%")
else
  report "PASS" "Memory: ${MEM_USED}/${MEM_TOTAL} used (${MEM_PCT}%)"
fi

# 3) CPU usage / load
CPU_PCT=$(get_cpu_usage_pct)
if [ "$CPU_PCT" -gt 85 ]; then
  report "WARN" "CPU usage: ${CPU_PCT}%"
  ALERT_REASONS+=("CPU usage ${CPU_PCT}% > 85%")
else
  report "PASS" "CPU usage: ${CPU_PCT}%"
fi
LOAD_AVG=$(uptime | sed -E 's/.*load average: //; s/,//g')
report "PASS" "Load avg: ${LOAD_AVG}"

# 4) PM2 status via jlist
if ! command -v pm2 >/dev/null 2>&1; then
  report "WARN" "PM2: command not found"
else
  PM2_JSON=$(pm2 jlist 2>/dev/null || true)
  if [ -z "$PM2_JSON" ] || [ "$PM2_JSON" = "[]" ]; then
    report "WARN" "PM2: no processes returned"
  else
    PM2_ROWS=$(node -e '
      let data = "";
      process.stdin.on("data", c => (data += c));
      process.stdin.on("end", () => {
        try {
          const arr = JSON.parse(data || "[]");
          for (const proc of arr) {
            const name = proc.name || "unknown";
            const status = (proc.pm2_env && proc.pm2_env.status) || "unknown";
            const restarts = (proc.pm2_env && typeof proc.pm2_env.restart_time === "number") ? proc.pm2_env.restart_time : 0;
            console.log(`${name}|${status}|${restarts}`);
          }
        } catch {
          process.exit(1);
        }
      });
    ' <<< "$PM2_JSON" 2>/dev/null || true)

    if [ -z "$PM2_ROWS" ]; then
      report "WARN" "PM2: failed to parse jlist output"
    else
      PM2_OVERALL="PASS"
      while IFS='|' read -r name status restarts; do
        STATUS_UPPER=$(echo "$status" | tr '[:lower:]' '[:upper:]')
        if [ "$STATUS_UPPER" = "ONLINE" ]; then
          printf '[PASS] PM2: %s %s (%s restarts)\n' "$name" "$STATUS_UPPER" "$restarts"
        else
          printf '[WARN] PM2: %s %s (%s restarts) - needs attention\n' "$name" "$STATUS_UPPER" "$restarts"
          PM2_OVERALL="WARN"
          if [ -z "$PM2_DOWN_PROCESSES" ]; then
            PM2_DOWN_PROCESSES="${name}:${STATUS_UPPER}"
          else
            PM2_DOWN_PROCESSES="${PM2_DOWN_PROCESSES}, ${name}:${STATUS_UPPER}"
          fi
        fi
      done <<< "$PM2_ROWS"

      if [ "$PM2_OVERALL" = "PASS" ]; then
        report "PASS" "PM2 overall: all processes ONLINE"
      else
        report "WARN" "PM2 overall: one or more processes not ONLINE"
        ALERT_REASONS+=("PM2 process not online: ${PM2_DOWN_PROCESSES}")
      fi
    fi
  fi
fi

# 5) SQLite database size threshold (>500MB warns)
DB_PATH="${REPO_ROOT}/backend/data/providers.db"
DB_WARN_BYTES=$((500 * 1024 * 1024))
if [ -f "$DB_PATH" ]; then
  DB_BYTES=$(du -sb "$DB_PATH" | awk '{print $1}')
  DB_HUMAN=$(du -sh "$DB_PATH" | awk '{print $1}')
  if [ "$DB_BYTES" -gt "$DB_WARN_BYTES" ]; then
    report "WARN" "SQLite DB: ${DB_HUMAN} (>${DB_WARN_BYTES} bytes threshold)"
  else
    report "PASS" "SQLite DB: ${DB_HUMAN}"
  fi
else
  report "FAIL" "SQLite DB: ${DB_PATH} not found"
fi

# 6) Log file sizes (backend/logs)
LOG_DIR="${REPO_ROOT}/backend/logs"
if [ -d "$LOG_DIR" ]; then
  LOG_TOTAL_HUMAN=$(du -sh "$LOG_DIR" | awk '{print $1}')
  LARGE_LOG_COUNT=$(find "$LOG_DIR" -maxdepth 1 -type f -size +100M | wc -l | awk '{print $1}')
  if [ "$LARGE_LOG_COUNT" -gt 0 ]; then
    report "WARN" "Logs: ${LOG_TOTAL_HUMAN} total (${LARGE_LOG_COUNT} files >100MB)"
  else
    report "PASS" "Logs: ${LOG_TOTAL_HUMAN} total"
  fi
else
  report "WARN" "Logs: ${LOG_DIR} does not exist"
fi

# 7) Port 8083 listening
if ss -tnlp 2>/dev/null | grep -q ':8083 '; then
  report "PASS" "Port 8083: LISTENING"
else
  report "FAIL" "Port 8083: NOT LISTENING"
fi

# 8) Last 5 backend errors
ERROR_LOG="${REPO_ROOT}/backend/logs/error.log"
if [ -f "$ERROR_LOG" ]; then
  RECENT_ERRORS=$(tail -n 5 "$ERROR_LOG")
  if [ -n "$RECENT_ERRORS" ]; then
    report "FAIL" "Error log: up to 5 recent errors (see below)"
    echo "--- Last 5 backend errors ---"
    echo "$RECENT_ERRORS"
  else
    report "PASS" "Error log: no recent errors"
  fi
else
  report "PASS" "Error log: ${ERROR_LOG} not found"
fi

send_telegram_alert_if_needed

printf 'Summary: %s/%s checks passed, %s warning(s), %s failure(s)\n' "$PASS_COUNT" "$TOTAL_CHECKS" "$WARN_COUNT" "$FAIL_COUNT"
