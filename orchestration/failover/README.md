# DC1 Gate 0 — Failover & Recovery System

Automatic GPU failover (<60s) and intelligent recovery state machine for DC1 Gate 0.

## Components

| File | Purpose |
|------|---------|
| `models.py` | Dataclasses: FailureEvent, FailoverResult, CheckpointRef, RecoveryContext |
| `controller.py` | Failover Controller — detect failure, execute failover, test drills |
| `recovery.py` | Recovery Orchestrator — state machine with retry/failover/escalate |
| `checkpoint.py` | Checkpoint Manager — dual NAS+S3 with SHA-256 verification |

## Architecture

```
Health Daemon → detect_failure() → RecoveryOrchestrator.handle_interruption()
                                      │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                     Reconnect    Failover     Escalate
                    (5 retries)  (backup GPU)  (Telegram)
                     ~31s max     ~20s          Human
```

## How <60s Failover is Achieved

1. **Detection:** ~instant (health daemon polls every 10s)
2. **Reconnect phase:** skipped when going direct to failover, or ~31s max with backoff
3. **Failover execution:** ~20s
   - Verify backup GPU: ~2s (single API call + SSH check)
   - Load checkpoint from NAS: ~5s (local network, no S3 latency)
   - Relaunch job via MC API: ~5s
   - Verify running: ~5s (polling 0.5s intervals)
   - Notify renter: ~1s (async, non-blocking)
4. **Total worst case:** 31s reconnect + 20s failover = ~51s < 60s ✅

## Environment Variables

```bash
# Mission Control
MC_API_URL=http://76.13.179.86:8084/api
MC_API_TOKEN=dc1-mc-gate0-2026

# S3 (Saudi/Bahrain region)
S3_BUCKET=dc1-gate0-checkpoints
S3_REGION=me-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Local NAS
NAS_PATH=/mnt/nas/dc1/checkpoints

# Telegram alerts
TELEGRAM_BOT_TOKEN=...
DC1_TELEGRAM_GROUP=-5275672778

# Checkpoint retention
CHECKPOINT_KEEP_N=3
```

## Testing Without Real GPUs

1. **Mock MC API:** Run a local Flask/Express server on port 8084 returning fake GPU statuses
2. **Mock SSH:** Set `ssh_host` to localhost with a listening SSH daemon
3. **Mock S3:** Use `moto` library or localstack
4. **Run test_failover():** `python -c "from orchestration.failover.controller import test_failover; print(test_failover('pc1-rtx3090', 'pc1-rtx3060'))"`

## GPU Mapping (Gate 0)

| GPU | Role | VRAM | ID |
|-----|------|------|----|
| RTX 3090 | Primary | 24GB | pc1-rtx3090 |
| RTX 3060 | Backup | 12GB | pc1-rtx3060 |

## State Machine

```
RUNNING → INTERRUPTION_DETECTED → RECONNECTING → FAILING_OVER → ESCALATING → RESOLVED/FAILED
```

See `recovery.py` for full transition logic and backoff schedule.
