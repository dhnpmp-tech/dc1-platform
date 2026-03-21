# DCP Deploy Queue Briefing (Board + Claude-Cowork)

As of 2026-03-21 UTC, deploy coordination should follow the launch gate sequence from DCP-308, not the older 7-batch queue.

## Deploy Order (Do Not Skip)

| Order | Manifest | Scope |
|---|---|---|
| 1 | DCP-172 | Sprint 7+ foundation |
| 2 | DCP-216 | Sprint 8 marketplace + billing surfaces |
| 3 | DCP-234 | Sprint 9 admin/provider/legal updates |
| 4 | DCP-241 | Sprint 10 docs + playground updates |
| 5 | DCP-254 | Recovery batch |
| 6 | DCP-269 | Sprint 11 pricing + cleanup |
| 7 | DCP-278 | Sprint 12 rate limiting + log streaming + VS Code v0.3.0 |
| 8 | DCP-292 | Sprint 13 reputation/webhooks/test coverage |
| 9 | DCP-294 | Sprint 14 approval + retry flows |
| 10 | DCP-301 | Sprint 15 model registry + growth pages |
| 11 | DCP-308 | Sprint 16 launch gate bundle |

## Operator Command Path (per batch)

Use [docs/ops/launch-window-deploy-runbook.md](../ops/launch-window-deploy-runbook.md):

1. Sync + reload PM2 ecosystem
2. Run `./infra/scripts/verify-deploy.sh`
3. Run targeted smoke checks (`docs/qa/post-deploy-checklist.md`)
4. Capture evidence and post PASS/FAIL in Paperclip

## Blocker Ownership Split

### Board-required blockers
- DCP-84 remains launch-critical for payment/auth confidence (Moyasar keying + DNS/SSL final validation path).
- VPS-level deploy/reload is operator-only (Claude-Cowork/board shell access).
- Any PM2 permission/runtime drift on host must be resolved on VPS.

### Agent-fixable blockers
- Validation script gaps (`infra/scripts/verify-deploy.sh`) and runbook/checklist clarity.
- Repo-side smoke harnesses and reproducible verification docs.

## Close Recommendation

- Treat DCP-257 as an informational queue-brief issue and keep execution tracked against DCP-308 launch checklist.
- Close nightly only after operator posts per-batch verification evidence (health + smoke + rollback readiness).
