#!/bin/bash
# DCP Log Rotation & Cleanup Script
# Manages log files: rotation when >100MB, compression, cleanup >30 days old
# Usage: ./scripts/rotate-logs.sh
# PM2 Usage: dcp-log-rotation-cron (runs daily via ecosystem.config.js)

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${REPO_ROOT}/backend/logs"
ARCHIVE_DIR="${LOG_DIR}/archive"
MAX_SIZE=$((100 * 1024 * 1024))  # 100MB
RETENTION_DAYS=30
TIMESTAMP=$(date -u '+%Y-%m-%d')
ROTATION_LOG="${LOG_DIR}/rotation.log"

mkdir -p "$ARCHIVE_DIR"

log() {
  local level="$1"
  local message="$2"
  local ts
  ts=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
  printf '[%s] %s | %s\n' "$ts" "$level" "$message" | tee -a "$ROTATION_LOG"
}

log "INFO" "Starting log rotation and cleanup"

# Track statistics
ROTATED_COUNT=0
COMPRESSED_COUNT=0
DELETED_COUNT=0

# 1. Rotate large logs
log "INFO" "Checking for logs >100MB..."

for logfile in "$LOG_DIR"/*.log; do
  [ -f "$logfile" ] || continue

  FILENAME=$(basename "$logfile")
  FILESIZE=$(du -b "$logfile" | awk '{print $1}')

  if [ "$FILESIZE" -gt "$MAX_SIZE" ]; then
    # Rotate: rename with timestamp
    ROTATED_FILE="${ARCHIVE_DIR}/${FILENAME}.${TIMESTAMP}.$(date -u '+%H%M%S')"

    if mv "$logfile" "$ROTATED_FILE" 2>/dev/null; then
      log "PASS" "Rotated: $FILENAME ($(numfmt --to=iec $FILESIZE 2>/dev/null || echo $FILESIZE))"
      ROTATED_COUNT=$((ROTATED_COUNT + 1))

      # Recreate empty log file
      touch "$logfile"

      # Compress rotated file
      if gzip "$ROTATED_FILE" 2>/dev/null; then
        log "PASS" "Compressed: ${FILENAME}.gz"
        COMPRESSED_COUNT=$((COMPRESSED_COUNT + 1))
      fi
    else
      log "WARN" "Failed to rotate: $FILENAME"
    fi
  fi
done

# 2. Compress uncompressed rotated logs
log "INFO" "Compressing rotated logs..."

for logfile in "$ARCHIVE_DIR"/*.log; do
  [ -f "$logfile" ] || continue

  FILENAME=$(basename "$logfile")

  if gzip "$logfile" 2>/dev/null; then
    log "INFO" "Compressed: $FILENAME.gz"
    COMPRESSED_COUNT=$((COMPRESSED_COUNT + 1))
  fi
done

# 3. Delete old compressed logs (>30 days)
log "INFO" "Cleaning up logs older than $RETENTION_DAYS days..."

for archive in "$ARCHIVE_DIR"/*.log.*.gz; do
  [ -f "$archive" ] || continue

  FILENAME=$(basename "$archive")

  # Find files older than RETENTION_DAYS
  if find "$ARCHIVE_DIR" -name "$(basename "$archive")" -mtime "+${RETENTION_DAYS}" 2>/dev/null | grep -q .; then
    if rm -f "$archive" 2>/dev/null; then
      log "INFO" "Deleted: $FILENAME"
      DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
  fi
done

# 4. Report statistics
LOG_SIZE=$(du -sh "$LOG_DIR" 2>/dev/null | awk '{print $1}')
ARCHIVE_SIZE=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | awk '{print $1}')
TOTAL_LOGS=$(find "$LOG_DIR" -name "*.log" 2>/dev/null | wc -l)
TOTAL_ARCHIVES=$(find "$ARCHIVE_DIR" -name "*.gz" 2>/dev/null | wc -l)

log "INFO" "Log directory: ${LOG_SIZE:-0} (${TOTAL_LOGS} active logs)"
log "INFO" "Archive directory: ${ARCHIVE_SIZE:-0} (${TOTAL_ARCHIVES} archived logs)"
log "INFO" "Rotation complete: $ROTATED_COUNT rotated, $COMPRESSED_COUNT compressed, $DELETED_COUNT deleted"

log "PASS" "Log rotation and cleanup complete"

exit 0
