# DCP Launch Window Deploy Runbook

Audience: Claude-Cowork / board operator on VPS host.

Purpose: run a consistent deploy + verify + rollback sequence for launch-critical batches.

## Preflight (must pass before deploy)

```bash
cd /root/dc1-platform

# 1) Confirm required DNS targets resolve from host
getent hosts dcp.sa
getent hosts api.dcp.sa

# 2) Confirm PM2 ecosystem app names in this repo
node -e "const c=require('./backend/ecosystem.config.js'); console.log(c.apps.map(a=>a.name).join('\n'))"

# 3) Confirm launch-critical env vars are set in PM2 context
pm2 env dc1-provider-onboarding | egrep 'DC1_ADMIN_TOKEN|DC1_HMAC_SECRET|BACKEND_URL|FRONTEND_URL'
```

If DNS does not resolve or PM2 env values are placeholder/empty, stop and resolve before deploy.

## Deploy Sequence (operator commands)

```bash
cd /root/dc1-platform

# 1) Sync latest code (operator-controlled)
git fetch --all --prune
git pull --ff-only origin main

# 2) Apply PM2 ecosystem safely
cd backend
pm2 startOrReload ecosystem.config.js
pm2 save

# 3) Verify services are healthy
cd /root/dc1-platform
./infra/scripts/verify-deploy.sh

# 4) Run focused smoke checks
./infra/scripts/deploy-templates.sh --api-base http://127.0.0.1:8083/api --skip-scan
```

## Rollback Sequence (if deploy verification fails)

```bash
cd /root/dc1-platform

# 1) Capture evidence first (for Paperclip + AGENT_LOG)
pm2 status
pm2 logs dc1-provider-onboarding --nostream --lines 200
curl -sS -i http://127.0.0.1:8083/api/health

# 2) Roll back repo to previous known-good commit
git log --oneline -n 5
git checkout <PREVIOUS_GOOD_COMMIT>

# 3) Restart/reload services
cd backend
pm2 startOrReload ecosystem.config.js
pm2 save

# 4) Re-run health verification
cd /root/dc1-platform
./infra/scripts/verify-deploy.sh
```

## Blocking Conditions

### Board-required blockers
- `api.dcp.sa` DNS/SSL not reachable from VPS.
- Required secrets not present in PM2 runtime env (`DC1_ADMIN_TOKEN`, `DC1_HMAC_SECRET`).
- VPS package/runtime drift that breaks native modules (`better-sqlite3` ABI mismatch).
- PM2 process ownership/permissions prevent reload.

### Agent-fixable blockers
- Script coverage gaps in `infra/scripts/verify-deploy.sh`.
- Missing operator docs/runbook steps in repo.
- Non-fatal endpoint path mismatches (`/health` vs `/api/health`) that can be handled in validation scripts.

## Reporting Template (Paperclip comment)

```text
Deploy window result: PASS/FAIL at <UTC>.
Deploy commit: <sha>.
Verify script: PASS/FAIL.
Smoke checks: PASS/FAIL.
Board blockers: <none or list>.
Agent-fixable follow-ups: <none or list>.
```
