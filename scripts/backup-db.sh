#!/bin/bash
# DCP Database Backup Script
# Automated daily backup of SQLite providers database
# Usage: ./scripts/backup-db.sh
# PM2 Usage: dcp-db-backup-cron (runs daily via ecosystem.config.js)

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_SOURCE="${REPO_ROOT}/backend/data/providers.db"
BACKUP_DIR="/root/dc1-platform/backups"
TIMESTAMP=$(date -u '+%Y-%m-%d-%H-%M-%S')
BACKUP_FILE="${BACKUP_DIR}/providers-db-${TIMESTAMP}.db.gz"
RETENTION_DAYS=7
LOG_FILE="${REPO_ROOT}/backend/logs/backup.log"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
  printf '[%s] %s | %s\n' "$timestamp" "$level" "$message" | tee -a "$LOG_FILE"
}

# Check if database exists
if [ ! -f "$DB_SOURCE" ]; then
  log "ERROR" "Database not found: $DB_SOURCE"
  exit 1
fi

# Get database size
DB_SIZE=$(du -h "$DB_SOURCE" | awk '{print $1}')
DB_BYTES=$(du -b "$DB_SOURCE" | awk '{print $1}')

log "INFO" "Starting backup: $DB_SOURCE ($DB_SIZE)"

# Backup: compress directly to avoid temporary large files
if gzip -c "$DB_SOURCE" > "$BACKUP_FILE"; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
  BACKUP_BYTES=$(du -b "$BACKUP_FILE" | awk '{print $1}')
  COMPRESSION=$((100 - (BACKUP_BYTES * 100 / DB_BYTES)))

  log "PASS" "Backup created: $BACKUP_FILE ($BACKUP_SIZE, $COMPRESSION% compression)"
else
  log "FAIL" "Backup failed: gzip error"
  exit 1
fi

# Verify backup integrity
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
  log "PASS" "Backup integrity verified (gzip -t)"
else
  log "FAIL" "Backup integrity check failed"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Cleanup old backups (keep last 7 days)
log "INFO" "Cleaning up backups older than $RETENTION_DAYS days"
DELETED_COUNT=0
while IFS= read -r old_backup; do
  rm -f "$old_backup"
  DELETED_COUNT=$((DELETED_COUNT + 1))
  log "INFO" "Deleted old backup: $(basename "$old_backup")"
done < <(find "$BACKUP_DIR" -name "providers-db-*.db.gz" -mtime "+${RETENTION_DAYS}" 2>/dev/null)

if [ "$DELETED_COUNT" -eq 0 ]; then
  log "INFO" "No old backups to delete"
else
  log "INFO" "Deleted $DELETED_COUNT old backup(s)"
fi

# Report backup statistics
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "providers-db-*.db.gz" 2>/dev/null | wc -l)
TOTAL_BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')

log "INFO" "Backup summary: $BACKUP_COUNT backup(s) on disk, total size: $TOTAL_BACKUP_SIZE"
log "PASS" "Backup complete: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

exit 0
