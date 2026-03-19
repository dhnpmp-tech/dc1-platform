#!/bin/bash

# DCP uptime monitor for backend health endpoint.
# Usage: ./scripts/health-check.sh
# Cron example: */5 * * * * /home/node/dc1-platform/scripts/health-check.sh

set -u

HEALTH_URL="https://api.dcp.sa/health"
LOG_FILE="/var/log/dcp-health.log"
CURL_TIMEOUT_SECONDS=15

http_code=$(curl -sS -o /dev/null -m "$CURL_TIMEOUT_SECONDS" -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)

if [ "$http_code" != "200" ]; then
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  printf "%s health_check_failed url=%s status=%s\n" "$timestamp" "$HEALTH_URL" "$http_code" >> "$LOG_FILE"

  # Future: send Telegram alert here after notification channel is configured.
  exit 1
fi

exit 0
