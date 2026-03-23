#!/bin/bash
# DCP Database Restore Script
# Restore SQLite providers database from backup
# Usage: ./scripts/restore-db.sh <backup-file>
# Example: ./scripts/restore-db.sh /root/dc1-platform/backups/providers-db-2026-03-23-03-00-00.db.gz

set -u

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Available backups:"
  ls -lh /root/dc1-platform/backups/providers-db-*.db.gz 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_TARGET="${REPO_ROOT}/backend/data/providers.db"
DB_BACKUP="${DB_TARGET}.backup.$(date -u '+%Y%m%d-%H%M%S')"
LOG_FILE="${REPO_ROOT}/backend/logs/restore.log"

mkdir -p "${LOG_FILE%/*}"

log() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
  printf '[%s] %s | %s\n' "$timestamp" "$level" "$message" | tee -a "$LOG_FILE"
}

# Validate backup file
if [ ! -f "$BACKUP_FILE" ]; then
  log "ERROR" "Backup file not found: $BACKUP_FILE"
  exit 1
fi

log "INFO" "Starting restore from: $BACKUP_FILE"

# Verify backup integrity
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  log "ERROR" "Backup file is corrupted (gzip -t failed)"
  exit 1
fi

log "PASS" "Backup integrity verified"

# Check if target database exists and backup it first
if [ -f "$DB_TARGET" ]; then
  log "INFO" "Creating safety backup of current database: $DB_BACKUP"
  if ! cp "$DB_TARGET" "$DB_BACKUP"; then
    log "ERROR" "Failed to create safety backup"
    exit 1
  fi
  log "PASS" "Safety backup created: $DB_BACKUP"
else
  log "WARN" "Current database does not exist: $DB_TARGET"
fi

# Perform restore
log "INFO" "Restoring database to: $DB_TARGET"

# Create a temporary file for decompression
TEMP_DB="/tmp/providers-db-restore-$$.db"

if ! gzip -dc "$BACKUP_FILE" > "$TEMP_DB" 2>/dev/null; then
  log "ERROR" "Failed to decompress backup"
  rm -f "$TEMP_DB"
  exit 1
fi

log "INFO" "Backup decompressed to temporary file"

# Verify decompressed database with SQLite
if ! command -v sqlite3 >/dev/null 2>&1; then
  log "WARN" "sqlite3 not found, skipping integrity check"
else
  if ! sqlite3 "$TEMP_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
    log "ERROR" "Restored database integrity check failed"
    rm -f "$TEMP_DB"
    exit 1
  fi
  log "PASS" "Restored database integrity check passed"
fi

# Move restored database to target location
if ! mv "$TEMP_DB" "$DB_TARGET"; then
  log "ERROR" "Failed to move restored database to target location"
  rm -f "$TEMP_DB"
  exit 1
fi

log "PASS" "Database restored successfully: $DB_TARGET"

# Report sizes
OLD_SIZE="$DB_BACKUP"
NEW_SIZE="$(du -h "$DB_TARGET" | awk '{print $1}')"
BACKUP_SIZE="$(du -h "$BACKUP_FILE" | awk '{print $1}')"

log "INFO" "Safety backup location: $DB_BACKUP"
log "INFO" "Database size (restored): $NEW_SIZE"
log "INFO" "Backup size: $BACKUP_SIZE"

log "PASS" "Restore complete: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""
echo "Next steps:"
echo "1. Verify application is working correctly"
echo "2. If restore failed, manual recovery is available at: $DB_BACKUP"
echo "3. If restore successful, you may delete the safety backup"

exit 0
