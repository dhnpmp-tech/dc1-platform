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
# Use board-approved release sync workflow to place the approved build in /root/dc1-platform.
# Record the deployed commit SHA from the release manifest in the Paperclip issue comment.

# 2) Apply PM2 ecosystem safely
cd backend
pm2 startOrReload ecosystem.config.js
pm2 save

# 3) Run deterministic verification bundle (single command)
cd /root/dc1-platform
./infra/scripts/post-deploy-verify.sh --batch DCP-308 --api-base http://127.0.0.1:8083/api

# 4) Optional targeted smoke checks by batch scope
# See docs/qa/post-deploy-checklist.md for batch-specific checks.
```

Verification artifacts are written to:

- `infra/artifacts/post-deploy/<run_id>-<batch>/summary.txt`
- `infra/artifacts/post-deploy/<run_id>-<batch>/summary.json`
- per-stage logs (`verify_deploy.log`, `verify_runtime.log`, `template_smoke.log`, `platform_smoke.log`)

If `post-deploy-verify.sh` exits non-zero, treat the deploy as failed and move to rollback sequence.

## Rollback Sequence (if deploy verification fails)

```bash
cd /root/dc1-platform

# 1) Capture evidence first (for Paperclip + AGENT_LOG)
pm2 status
pm2 logs dc1-provider-onboarding --nostream --lines 200
curl -sS -i http://127.0.0.1:8083/api/health

# 2) Restore previous known-good release (board-operator controlled)
# Use the rollback target from the incident/release channel and restore /root/dc1-platform accordingly.
# Record the rollback commit SHA in Paperclip + AGENT_LOG evidence.

# 3) Restart/reload services
cd backend
pm2 startOrReload ecosystem.config.js
pm2 save

# 4) Re-run health verification
cd /root/dc1-platform
./infra/scripts/post-deploy-verify.sh --batch rollback-verify --api-base http://127.0.0.1:8083/api
```

## Blocking Conditions

### Board-required blockers
- `api.dcp.sa` DNS/SSL not reachable from VPS.
- Required secrets not present in PM2 runtime env (`DC1_ADMIN_TOKEN`, `DC1_HMAC_SECRET`).
- VPS package/runtime drift that breaks native modules (`better-sqlite3` ABI mismatch).
- PM2 process ownership/permissions prevent reload.

### Agent-fixable blockers
- Script coverage gaps in `infra/scripts/verify-deploy.sh`.
- Runtime baseline drift in `infra/docker/run-job.sh` (container hardening flags missing).
- Missing operator docs/runbook steps in repo.
- Non-fatal endpoint path mismatches (`/health` vs `/api/health`) that can be handled in validation scripts.

## Related Runbooks

- `docs/ops/non-payment-restart-rollback.md` for non-payment restart/rollback operations with operator handoff checklist.
- `docs/ops/dcp-559-step2-infra-evidence.md` for launch-gate Step 2 infra closure artifacts (env vars, DNS, certbot/TLS).

## Reporting Template (Paperclip comment)

```text
Deploy window result: PASS/FAIL at <UTC>.
Deploy commit: <sha>.
Verification artifact: infra/artifacts/post-deploy/<run_id>-<batch>/summary.txt.
Smoke checks: PASS/FAIL (+ checklist batch IDs run).
Board blockers: <none or list>.
Agent-fixable follow-ups: <none or list>.
```
