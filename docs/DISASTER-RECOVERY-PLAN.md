# DCP Disaster Recovery Plan

**Document:** Disaster Recovery Procedures for Phase 1
**Owner:** DevOps Automator
**Created:** 2026-03-23
**Status:** ACTIVE (Phase 1 Launch Ready)

---

## Overview

This document covers disaster recovery procedures for critical DCP infrastructure and data. The primary risk during Phase 1 is data loss of provider/renter information due to:
- Database corruption
- Hardware failure
- Accidental deletion
- Ransomware/compromise

**Recovery Objective:**
- **RTO (Recovery Time Objective):** <30 minutes (restore from backup)
- **RPO (Recovery Point Objective):** <24 hours (daily automated backups)

---

## Critical Assets

### 1. SQLite Database (PRIMARY RISK)
- **Location:** `/root/dc1-platform/backend/data/providers.db`
- **Size:** 50-500MB (varies with usage)
- **Contains:**
  - Provider registrations & balances
  - Renter accounts & billing history
  - Job records & execution history
  - On-chain escrow references
- **Backup:** Daily automated at 3:00 AM UTC
- **Retention:** Last 7 days (5 backups)

### 2. Application Code & Configuration
- **Location:** `/root/dc1-platform`
- **Git Backup:** Hosted on github.com/dhnpmp-tech/dc1-platform
- **Recovery:** `git pull origin main`

### 3. PM2 Process Configuration
- **Location:** `/root/dc1-platform/backend/ecosystem.config.js`
- **Backup:** Git (committed)
- **Recovery:** Automatic on PM2 restart

### 4. TLS Certificates
- **Location:** `/etc/letsencrypt/live/api.dcp.sa/`
- **Provider:** Let's Encrypt (auto-renewal via certbot)
- **Recovery:** Auto-renewal or re-request if expired

### 5. Logs & Monitoring Data
- **Location:** `/root/dc1-platform/backend/logs/`
- **Backup:** Not automatically backed up (can be recreated)
- **Recovery:** Application startup creates new logs

---

## Backup Strategy

### Automated Backups (ACTIVE)

**Backup Script:** `./scripts/backup-db.sh`

**Configuration:**
- **Schedule:** Daily at 3:00 AM UTC (`0 3 * * *`)
- **PM2 Job:** `dcp-db-backup-cron` (in ecosystem.config.js)
- **Compression:** gzip (typical 40-50% compression)
- **Retention:** Last 7 days
- **Storage:** `/root/dc1-platform/backups/`

**Backup File Naming:**
```
providers-db-YYYY-MM-DD-HH-MM-SS.db.gz
Example: providers-db-2026-03-23-03-00-00.db.gz
```

**Backup Process:**
1. Compress current database to gzip
2. Verify backup integrity (gzip -t)
3. Delete backups older than 7 days
4. Log to `/root/dc1-platform/backend/logs/backup.log`

**Verification:**
```bash
# List available backups
ls -lh /root/dc1-platform/backups/

# Check backup size and compression
du -h /root/dc1-platform/backups/providers-db-*.db.gz

# Verify backup integrity
gzip -t /root/dc1-platform/backups/providers-db-2026-03-23-03-00-00.db.gz
```

### Manual Backups

**When to Use:**
- Before major deployments
- Before database schema changes
- Upon operator request
- Before decommissioning a system

**How to Create:**
```bash
cd /root/dc1-platform
./scripts/backup-db.sh
```

**Output Example:**
```
[2026-03-23 03:00:00 UTC] INFO | Starting backup: /root/dc1-platform/backend/data/providers.db (128M)
[2026-03-23 03:00:05 UTC] PASS | Backup created: /root/dc1-platform/backups/providers-db-2026-03-23-03-00-00.db.gz (52M, 59% compression)
[2026-03-23 03:00:06 UTC] PASS | Backup integrity verified (gzip -t)
[2026-03-23 03:00:06 UTC] INFO | Backup summary: 5 backup(s) on disk, total size: 260M
```

---

## Recovery Procedures

### Scenario 1: Database Corruption Detection

**Symptoms:**
- Backend crashes with "database disk image malformed"
- Queries return inconsistent results
- Provider/renter data anomalies
- API returns 500 errors

**Recovery Steps:**

1. **Identify the Problem**
   ```bash
   # Check error logs
   tail -50 /root/dc1-platform/backend/logs/error.log

   # Test database integrity
   sqlite3 /root/dc1-platform/backend/data/providers.db "PRAGMA integrity_check;"
   ```

2. **Stop Services**
   ```bash
   cd /root/dc1-platform
   pm2 stop dc1-provider-onboarding
   ```

3. **Restore from Backup**
   ```bash
   # List available backups
   ls -lh /root/dc1-platform/backups/

   # Restore from most recent backup
   ./scripts/restore-db.sh /root/dc1-platform/backups/providers-db-2026-03-23-03-00-00.db.gz
   ```

4. **Verify Restoration**
   ```bash
   # Check restored database integrity
   sqlite3 /root/dc1-platform/backend/data/providers.db "PRAGMA integrity_check;"

   # Check database size
   du -h /root/dc1-platform/backend/data/providers.db
   ```

5. **Restart Services**
   ```bash
   pm2 restart dc1-provider-onboarding
   pm2 save
   ```

6. **Smoke Tests**
   ```bash
   ./scripts/smoke-test.sh
   ```

7. **Verify Functionality**
   - Check provider registrations: `curl https://api.dcp.sa/api/providers/available`
   - Check renter accounts: Manual test via dashboard
   - Monitor logs: `pm2 logs dc1-provider-onboarding`

---

### Scenario 2: Hardware Failure / VPS Unavailable

**Symptoms:**
- VPS 76.13.179.86 unreachable
- All services down
- Need to migrate to new VPS

**Recovery Steps (OUT OF SCOPE FOR THIS DOCUMENT):**

This is a data center-level disaster requiring:
1. Notify infrastructure team
2. Provision new VPS
3. Restore code from GitHub
4. Restore database from backup
5. Reconfigure TLS certificates
6. Restart all services

**Recovery Time:** 2-4 hours (including provisioning)

---

### Scenario 3: Accidental Data Deletion

**Symptoms:**
- Provider account unexpectedly deleted
- Job history missing
- Balance cleared

**Recovery Steps:**

1. **Stop Services**
   ```bash
   pm2 stop dc1-provider-onboarding
   ```

2. **Identify When Deletion Occurred**
   ```bash
   # Check backup files timestamps
   ls -lh /root/dc1-platform/backups/

   # Select backup from BEFORE deletion time
   ```

3. **Restore from Pre-Deletion Backup**
   ```bash
   ./scripts/restore-db.sh /root/dc1-platform/backups/providers-db-2026-03-22-03-00-00.db.gz
   ```

4. **Restart Services**
   ```bash
   pm2 restart dc1-provider-onboarding
   pm2 save
   ```

5. **Re-apply Any Manual Changes**
   - If any data was manually added after backup timestamp, it will need to be re-entered
   - Check operations log for what changed

---

### Scenario 4: Ransomware / Compromise

**Symptoms:**
- Files encrypted
- Unauthorized access logs
- Services not responding

**IMMEDIATE ACTIONS:**

1. **ISOLATE THE SYSTEM**
   ```bash
   # Disconnect from network (if possible)
   # Prevent further spread
   ```

2. **NOTIFY STAKEHOLDERS**
   - DevOps Automator
   - Security Engineer
   - CEO

3. **PRESERVE EVIDENCE**
   - Do NOT attempt self-recovery
   - Preserve logs and access records
   - Document exact timestamps

4. **RECOVERY (Once Cleared by Security)**
   ```bash
   # Assuming clean VPS provisioned by security team
   cd /root/dc1-platform
   git pull origin main  # Restore code
   ./scripts/restore-db.sh /root/dc1-platform/backups/providers-db-clean-before-incident.db.gz
   pm2 start ecosystem.config.js --env production
   ```

---

## Testing & Validation

### Monthly Backup Test (REQUIRED)

**Schedule:** First Monday of each month

**Test Procedure:**
1. Identify most recent backup file
2. Create temporary test database
3. Restore to temporary location
4. Verify integrity and data completeness
5. Document results

**Test Script:**
```bash
#!/bin/bash
BACKUP="/root/dc1-platform/backups/providers-db-$(date -u '+%Y-%m-%d')-03-00-00.db.gz"
TEST_DB="/tmp/test-restore-$(date +%s).db"

# Decompress to test location
gzip -dc "$BACKUP" > "$TEST_DB"

# Verify with SQLite
sqlite3 "$TEST_DB" "PRAGMA integrity_check;"
sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM providers;"
sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM serve_sessions;"

# Cleanup
rm "$TEST_DB"

echo "✓ Backup test passed: $BACKUP"
```

### Restore Test (QUARTERLY)

**Schedule:** Quarterly (every 3 months)

**Test Procedure:**
1. Provision test database copy
2. Run full restore procedure
3. Test all API endpoints
4. Verify data integrity
5. Document recovery time

---

## Backup Status Monitoring

### Check Backup Health

```bash
# View latest backup logs
tail -20 /root/dc1-platform/backend/logs/backup.log

# Check backup directory
du -sh /root/dc1-platform/backups/
ls -lh /root/dc1-platform/backups/

# Verify latest backup
ls -1t /root/dc1-platform/backups/ | head -1
```

### Alert Thresholds

**Critical Alerts:**
- No backup in last 36 hours (backup job failed)
- Backup directory > 5GB (retention not working)
- Backup file corrupted (gzip -t fails)
- Database size > 1GB (needs investigation)

**Who to Contact:**
- DevOps Automator
- Backend Architect

---

## Runbook Quick Reference

| Scenario | Action | Time |
|----------|--------|------|
| **DB Corruption** | Stop services → Restore from backup → Smoke tests | 10 min |
| **Accidental Deletion** | Stop services → Restore pre-deletion backup → Restart | 10 min |
| **Hardware Failure** | Provision new VPS → Restore code + DB → Reconfigure → Smoke tests | 2-4 hours |
| **Ransomware** | Isolate system → Notify security → Coordinate recovery | + Security review |

---

## Escalation Contacts

- **DevOps Issues:** DevOps Automator (@DevOps Automator)
- **Database Issues:** Backend Architect
- **Security Breach:** Security Engineer + CEO
- **Infrastructure:** Founding Engineer
- **Phase 1 Coordination:** @CEO

---

## Appendix: Useful Commands

### Backup Management

```bash
# List all backups
ls -lh /root/dc1-platform/backups/

# Check backup sizes
du -h /root/dc1-platform/backups/* | sort -h

# Total backup storage used
du -sh /root/dc1-platform/backups/

# Verify specific backup
gzip -t /root/dc1-platform/backups/providers-db-2026-03-23-03-00-00.db.gz
```

### Database Integrity

```bash
# Check current database
sqlite3 /root/dc1-platform/backend/data/providers.db "PRAGMA integrity_check;"

# Get database statistics
sqlite3 /root/dc1-platform/backend/data/providers.db << EOF
.tables
SELECT COUNT(*) as total_providers FROM providers;
SELECT COUNT(*) as total_sessions FROM serve_sessions;
SELECT COUNT(*) as total_jobs FROM jobs;
EOF
```

### Recovery

```bash
# Restore from specific backup
./scripts/restore-db.sh /root/dc1-platform/backups/providers-db-2026-03-23-03-00-00.db.gz

# Create on-demand backup before risky operations
./scripts/backup-db.sh

# View restoration logs
tail -50 /root/dc1-platform/backend/logs/restore.log
```

---

## Document History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-03-23 | 1.0 | Initial version for Phase 1 launch | DevOps Automator |

---

**Status:** ACTIVE — Phase 1 Ready
**Last Updated:** 2026-03-23
**Next Review:** 2026-04-23
