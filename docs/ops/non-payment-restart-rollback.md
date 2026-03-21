# DCP Non-Payment Services Restart and Rollback Runbook

Audience: Claude-Cowork / board operator on VPS host.

Purpose: safely restart and, if needed, roll back non-payment services only (API + operational crons) with deterministic verification.

Out of scope:
- Moyasar/payment gateway changes
- Escrow/billing flow migrations
- Wallet balance manual corrections

## Service Scope

The commands in this runbook target these PM2 services:
- `dc1-provider-onboarding`
- `dcp-vps-health-cron`
- `dcp-job-volume-cleanup-cron`
- `dcp-stale-provider-sweep-cron`

## Preconditions

1. Host has latest approved code synced by board operator.
2. Required PM2 env vars are present:
   - `DC1_ADMIN_TOKEN`
   - `DC1_HMAC_SECRET`
   - `BACKEND_URL`
   - `FRONTEND_URL`
3. No active incident requiring payment-system intervention.

## Restart Sequence (non-payment lane)

```bash
cd /root/dc1-platform

# 1) Snapshot current runtime state for evidence
pm2 status
pm2 show dc1-provider-onboarding

# 2) Reload PM2 ecosystem for non-payment services
cd backend
pm2 startOrReload ecosystem.config.js --only dc1-provider-onboarding,dcp-vps-health-cron,dcp-job-volume-cleanup-cron,dcp-stale-provider-sweep-cron
pm2 save

# 3) Run deterministic deploy + runtime checks
cd /root/dc1-platform
./infra/scripts/verify-deploy.sh
./infra/scripts/verify-runtime-baseline.sh
```

If either verification script fails, stop here and execute rollback sequence.

## Rollback Sequence (non-payment lane)

```bash
cd /root/dc1-platform

# 1) Capture failure evidence first
pm2 status
pm2 logs dc1-provider-onboarding --nostream --lines 200
curl -sS -i http://127.0.0.1:8083/api/health

# 2) Revert to previous known-good revision (board-operator controlled)
# Example only; use approved rollback commit from incident channel
# git checkout <PREVIOUS_GOOD_COMMIT>

# 3) Reload only non-payment services
cd backend
pm2 startOrReload ecosystem.config.js --only dc1-provider-onboarding,dcp-vps-health-cron,dcp-job-volume-cleanup-cron,dcp-stale-provider-sweep-cron
pm2 save

# 4) Re-run verification
cd /root/dc1-platform
./infra/scripts/verify-deploy.sh
./infra/scripts/verify-runtime-baseline.sh
```

## Stop Conditions

Do not continue restart attempts in this runbook if any of the following is true:
- PM2 service ownership/permissions prevent reload.
- `/api/health` does not return `200` with `{"status":"ok"}` after rollback.
- Runtime baseline check reports missing container hardening controls.
- Docker daemon is unreachable.

## Operator Handoff Checklist

- [ ] Captured UTC timestamp for restart start/end
- [ ] Saved PM2 status before and after restart
- [ ] Ran `verify-deploy.sh` and recorded PASS/FAIL
- [ ] Ran `verify-runtime-baseline.sh` and recorded PASS/FAIL
- [ ] If rollback used: documented rollback target revision and reason
- [ ] Posted evidence + outcome in Paperclip issue comment
