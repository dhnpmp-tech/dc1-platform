# DC1 Platform — Production Runbook

**Last Updated**: 2026-03-23
**Status**: Beta
**Environment**: Production (VPS 76.13.179.86)

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Process](#deployment-process)
4. [Health Monitoring](#health-monitoring)
5. [Troubleshooting](#troubleshooting)
6. [Rollback Procedures](#rollback-procedures)
7. [Maintenance Tasks](#maintenance-tasks)
8. [Contacts & Escalation](#contacts--escalation)

---

## Overview

DCP Production runs on a single VPS (76.13.179.86) with Docker Compose orchestrating:

- **Frontend** (Next.js, port 3000) — Provider/renter dashboards
- **Backend** (Express, port 8083) — API for all services; uses SQLite (better-sqlite3) for persistence
- **Health Monitor** (Node.js, port 9090) — System monitoring & metrics

> **Database note:** The backend uses embedded SQLite, not PostgreSQL. The database file is
> persisted in the `backend-db` Docker named volume at `/app/data/providers.db`.

All code is deployed from the `main` branch via GitHub Actions. Deployments happen automatically on push or manually via workflow dispatch.

### Key Files

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production service definition |
| `Dockerfile.frontend` | Next.js build image |
| `backend/Dockerfile` | Express API build image |
| `.github/workflows/deploy-prod.yml` | Automated deployment pipeline |
| `scripts/rollback.sh` | Full rollback with backups |
| `scripts/quick-rollback.sh` | Emergency one-command rollback |

---

## Pre-Deployment Checklist

Before pushing to `main`:

- [ ] All tests pass locally: `npm test` (backend), `npm run test:e2e` (frontend)
- [ ] Code review completed and approved
- [ ] Secrets are NOT committed (check `.gitignore` and `.env.example`)
- [ ] Database migrations (if any) are backwards-compatible
- [ ] Health check endpoints respond correctly
- [ ] No breaking API changes without frontend compatibility

### Environment Variables

Production uses these secrets (set in GitHub Actions secrets):

```env
# GitHub Container Registry
GITHUB_TOKEN=<auto-injected>

# Deployment SSH
PROD_HOST=76.13.179.86
PROD_USER=dc1
PROD_DEPLOY_KEY=<SSH private key>

# Application secrets (required)
DC1_ADMIN_TOKEN=<generate: openssl rand -hex 32>
DC1_HMAC_SECRET=<generate: openssl rand -hex 32>

# Payment processing (optional)
MOYASAR_SECRET_KEY=<from Moyasar dashboard>
MOYASAR_WEBHOOK_SECRET=<from Moyasar dashboard>

# Email (optional)
RESEND_API_KEY=<from Resend dashboard>

# Telegram health alerts (optional)
TELEGRAM_BOT_TOKEN=<from BotFather>

# Frontend URLs
FRONTEND_URL=https://dcp.sa
CORS_ORIGINS=https://dcp.sa,https://www.dcp.sa
BACKEND_URL=https://api.dcp.sa

# Supabase (frontend only — optional if not using Supabase auth)
NEXT_PUBLIC_SUPABASE_URL=<from Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase>
```

---

## Deployment Process

### Automatic Deployment (Recommended)

1. **Push to main**
   ```bash
   git push origin main
   ```

2. **GitHub Actions triggers automatically**
   - Builds Docker images
   - Runs smoke tests
   - Deploys to production
   - Verifies health checks
   - Rolls back on failure

3. **Monitor progress**
   - View run: GitHub repo → Actions → Latest run
   - Check logs in real-time
   - Deployment takes ~5-10 minutes

### Manual Deployment

```bash
# If GitHub Actions is unavailable
ssh dc1@76.13.179.86 << 'EOF'
cd /home/dc1/dc1-platform
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --force-recreate
docker-compose -f docker-compose.prod.yml logs -f
EOF
```

### What Happens During Deploy

1. **Build Phase** — Docker images built in GitHub Actions
2. **Test Phase** — Backend unit tests run
3. **Deploy Phase** — SSH to production, pull code, restart containers
4. **Verification** — Health checks verify all services respond
5. **Rollback** — If health checks fail, automatically reverts to previous commit

---

## Health Monitoring

### Health Check Endpoints

Three levels of health information are available:

#### 1. Liveness Probe (`/health`)
Minimal check — just enough to know services are running.

```bash
curl -f http://localhost:9090/health
# Returns 200 if healthy, 503 if degraded
```

#### 2. Status Report (`/status`)
Full system status with metrics.

```bash
curl http://localhost:9090/status
```

**Response:**
```json
{
  "timestamp": "2026-03-23T12:34:56Z",
  "services": {
    "frontend": {
      "status": "ok",
      "latency": 45,
      "avgLatency": 50,
      "successRate": 98
    },
    "backend": {
      "status": "ok",
      "latency": 120,
      "avgLatency": 130,
      "successRate": 99
    },
    "database": {
      "status": "ok",
      "latency": 5,
      "successRate": 100
    }
  }
}
```

#### 3. Metrics (`/metrics`)
Prometheus-format metrics for monitoring systems.

```bash
curl http://localhost:9090/metrics
```

### Docker Service Health

Check individual service health:

```bash
# All services and their status
docker-compose -f docker-compose.prod.yml ps

# View service logs
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f healthcheck

# Inspect specific container
docker inspect dc1-frontend | jq '.[] | .State.Health'
```

### Monitoring Setup

For ongoing monitoring, integrate the `/metrics` endpoint with:

- **Prometheus** — Scrape `http://localhost:9090/metrics` every 30s
- **Grafana** — Import dashboards from `./docs/grafana-dashboards/`
- **AlertManager** — Configure alerts for `frontend_latency_ms > 500` or `*_check_status == 0`

---

## Troubleshooting

### Frontend Not Responding

**Symptoms**: `curl http://localhost:3000` times out or returns 5xx

**Quick Check**:
```bash
docker-compose -f docker-compose.prod.yml logs frontend | tail -50
docker-compose -f docker-compose.prod.yml ps frontend
```

**Common Issues**:

| Symptom | Cause | Fix |
|---------|-------|-----|
| Port 3000 not listening | Container crashed | `docker-compose logs frontend` |
| 502 Bad Gateway | Backend unreachable | Check backend is running: `docker ps` |
| Memory limit exceeded | Too many requests or leak | Restart: `docker-compose restart frontend` |
| Build failed | Missing dependencies | Rebuild: `docker-compose build --no-cache frontend` |

**Resolution**:
```bash
# Restart just frontend
docker-compose -f docker-compose.prod.yml restart frontend

# Or rebuild from latest image
docker-compose -f docker-compose.prod.yml up -d --force-recreate frontend
```

### Backend API Errors

**Symptoms**: `curl http://localhost:8083/api/health` returns 5xx

**Quick Check**:
```bash
docker-compose -f docker-compose.prod.yml logs backend | tail -100
docker-compose -f docker-compose.prod.yml exec backend curl http://localhost:8083/api/health
```

**Common Issues**:

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | SQLite file missing or corrupt | Check: `docker exec dc1-backend ls /app/data/` |
| `E_DB_INIT` | Migrations failed | Restore DB backup and retry |
| `SIGTERM` timeout | Graceful shutdown failed | Force restart: `docker-compose kill backend` |
| Memory error | Heap limit exceeded | Increase Docker memory or restart |

**Resolution**:
```bash
# Restart backend
docker-compose -f docker-compose.prod.yml restart backend

# Or inspect the container
docker exec dc1-backend ps aux
docker exec dc1-backend cat /app/logs/error.log
```

### Database Issues (SQLite)

**Symptoms**: Backend health check returns `db` ≠ `ok`

**Quick Check**:
```bash
# Verify SQLite file exists in volume
docker exec dc1-backend ls -lah /app/data/
docker exec dc1-backend sqlite3 /app/data/providers.db "SELECT COUNT(*) FROM providers;"
docker-compose -f docker-compose.prod.yml logs backend | tail -50
```

**Common Issues**:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `SQLITE_CANTOPEN` | Volume not mounted or path wrong | Check `DC1_DB_PATH` env var |
| `disk full` | Data volume exhausted | `df -h` and clean up old logs |
| `database is locked` | Multiple writer processes | Restart backend (only one process should write) |
| Connection timeout | Network issue | Check network: `docker network ls` |

**Resolution**:
```bash
# Backup SQLite database then restart backend
docker exec dc1-backend cp /app/data/providers.db /app/data/providers.db.bak
docker-compose -f docker-compose.prod.yml restart backend
```

### All Services Down

**Symptoms**: All containers stopped or restarting

**Recovery Steps**:

1. **Check what happened**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs --tail=200
   ```

2. **Try restart**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart
   sleep 30
   docker-compose -f docker-compose.prod.yml ps
   ```

3. **If services still unhealthy**, use quick rollback:
   ```bash
   ./scripts/quick-rollback.sh
   ```

4. **If that fails**, full manual recovery:
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   docker-compose -f docker-compose.prod.yml logs -f
   ```

---

## Rollback Procedures

### Scenario 1: Deployment Succeeded But Found Critical Bug

**Use Full Rollback**:

```bash
./scripts/rollback.sh
```

This script:
- ✓ Backs up current database
- ✓ Resets git to previous commit
- ✓ Restarts all services
- ✓ Verifies health checks
- ✓ Saves backups for reference

**Interactive mode** — asks for confirmation at each step.
**Force mode** — skips confirmations:
```bash
./scripts/rollback.sh --force
```

**Options**:
```bash
./scripts/rollback.sh --version abc1234  # Rollback to specific commit
./scripts/rollback.sh --dry-run          # Preview changes without applying
./scripts/rollback.sh --verbose          # Show detailed logs
```

### Scenario 2: Emergency — Need Immediate Rollback

**Use Quick Rollback**:

```bash
./scripts/quick-rollback.sh
```

One command:
- ✓ Backs up database
- ✓ Resets to previous commit
- ✓ Restarts services
- ✓ Verifies health

Takes ~30 seconds. No confirmation prompts.

### Scenario 3: Rollback Failed — Manual Recovery

```bash
# Step 1: Stop everything
docker-compose -f docker-compose.prod.yml down

# Step 2: Restore SQLite database from backup
docker cp /tmp/db-backup-*.db dc1-backend:/app/data/providers.db

# Step 3: Reset to known-good commit
git log --oneline | head
git reset --hard <commit-hash>

# Step 4: Start services
docker-compose -f docker-compose.prod.yml up -d

# Step 5: Verify
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:9090/health
```

### After Rollback

1. **Check status**:
   ```bash
   curl http://localhost:9090/status
   ```

2. **Review logs**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs --tail=100
   ```

3. **Verify data**:
   ```bash
   curl http://localhost:8083/api/admin/fleet/health
   ```

4. **Investigate root cause**:
   - Check GitHub Actions logs for failed deploy
   - Review backend logs for errors
   - Check database for corruption

5. **Fix and redeploy**:
   ```bash
   # Fix the issue on a branch
   git checkout -b fix/critical-issue
   # ... make fixes ...
   git push origin fix/critical-issue
   # Open PR, get review, merge to main
   ```

---

## Maintenance Tasks

### Daily Tasks

**Nothing required** — services are designed to run 24/7 with zero manual intervention.

### Weekly Tasks

1. **Review logs for errors**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs --since 7d | grep -i error | tail -100
   ```

2. **Check disk space**:
   ```bash
   df -h /var/lib/docker
   docker system df
   ```

3. **Verify SQLite database is healthy**:
   ```bash
   docker exec dc1-backend sqlite3 /app/data/providers.db "PRAGMA integrity_check;"
   ```

### Monthly Tasks

1. **SQLite maintenance (WAL checkpoint)**:
   ```bash
   docker exec dc1-backend sqlite3 /app/data/providers.db "PRAGMA wal_checkpoint(TRUNCATE);"
   ```

2. **Update base images**:
   ```bash
   docker pull node:20-alpine
   docker-compose -f docker-compose.prod.yml build --no-cache
   ```

3. **Test rollback procedure**:
   ```bash
   ./scripts/rollback.sh --dry-run
   ```

### Backup Strategy

**Current**: SQLite database is in the `backend-db` Docker named volume. Back it up with:
```bash
docker exec dc1-backend cp /app/data/providers.db /app/data/providers.db.$(date +%s)
docker cp dc1-backend:/app/data/providers.db /tmp/dc1-backup-$(date +%Y%m%d).db
```

**Recommendations**:

1. **Automated backups** — Set up cron job for daily backups:
   ```bash
   # Add to crontab: 0 2 * * * docker cp dc1-backend:/app/data/providers.db /backups/dc1-$(date +%Y%m%d).db
   ```

2. **Off-site backups** — Copy to cloud storage (S3, GCS, Azure):
   ```bash
   aws s3 cp /tmp/dc1-backup.db s3://dcp-backups/$(date +%Y-%m-%d).db
   ```

3. **Backup retention** — Keep 30 days of daily backups + one per week for 12 weeks

4. **Test restores** — Monthly restore test to verify backups are valid

---

## Contacts & Escalation

### On-Call Runbook

**Service Down (Critical)**:
1. Check health: `curl http://localhost:9090/health`
2. View logs: `docker-compose logs -f`
3. Try restart: `docker-compose restart`
4. Last resort: `./scripts/quick-rollback.sh`
5. Escalate to: **CTO**

**Slow Performance (High)**:
1. Check latency: `curl http://localhost:9090/status`
2. Check resources: `docker stats`
3. Review backend logs: `docker logs dc1-backend | tail -50`
4. Optimize: Consider `docker-compose up -d --force-recreate`

**Data Corruption (Critical)**:
1. STOP — Do not deploy further
2. Backup current state: `docker cp dc1-backend:/app/data/providers.db /tmp/corrupted.db`
3. Restore last known-good backup
4. Contact: **Database Admin**

### Escalation Contacts

| Severity | Contact | On-Call |
|----------|---------|---------|
| P0 (Down) | CTO | On-call engineer |
| P1 (Broken) | Tech Lead | Team lead |
| P2 (Slow) | DevOps | Rotating on-call |
| P3 (Degraded) | Team | Next available |

### Important Links

- **Monitoring Dashboard**: [Grafana](http://localhost:3000/grafana) (internal only)
- **Logs**: `docker-compose logs` (on VPS)
- **Status Page**: http://76.13.179.86:9090/status
- **GitHub Actions**: https://github.com/dhnpmp-tech/dc1-platform/actions
- **VPS**: 76.13.179.86 (SSH: `ssh dc1@76.13.179.86`)

---

## Appendix: Common Commands

```bash
# View all services
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
docker-compose -f docker-compose.prod.yml logs -f backend

# Restart a service
docker-compose -f docker-compose.prod.yml restart backend

# SSH to container
docker exec -it dc1-backend sh

# Check resource usage
docker stats

# View volumes
docker volume ls
docker volume inspect dc1-platform_backend-db

# Clean up (careful!)
docker system prune -a              # Remove unused images
docker volume prune                 # Remove unused volumes (DANGER: deletes SQLite DB if backend-db unused)
docker image prune --filter until=72h

# Manual health check
curl http://localhost:9090/health
curl http://localhost:9090/status
curl http://localhost:8083/api/health

# Check SQLite database
docker exec dc1-backend sqlite3 /app/data/providers.db "SELECT COUNT(*) AS providers FROM providers;"
```

---

**Version**: 1.0
**Last Updated**: 2026-03-23
**Status**: Production Ready
