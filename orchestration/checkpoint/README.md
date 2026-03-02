# DC1 Checkpoint Manager

Hourly job state persistence to S3 + local NAS for GPU job resumption.

## Overview

When a job runs on a provider GPU, the checkpoint manager saves job state every hour. If the provider fails, the job can be resumed on a different GPU from the last checkpoint.

**Dual-write strategy:** Every checkpoint is saved to both S3 and local NAS. S3 is primary; local NAS is a fast fallback.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DC1_S3_BUCKET` | ✅ | — | S3 bucket name |
| `DC1_S3_REGION` | — | `me-south-1` | AWS region |
| `DC1_S3_ACCESS_KEY` | ✅ | — | S3 access key |
| `DC1_S3_SECRET_KEY` | ✅ | — | S3 secret key |
| `DC1_S3_ENDPOINT_URL` | — | — | Custom endpoint (for Cloudflare R2) |
| `DC1_CHECKPOINT_LOCAL_PATH` | — | `/var/dc1/checkpoints` | Local NAS path |
| `DC1_MC_API_URL` | — | — | Mission Control API URL |
| `DC1_MC_TOKEN` | — | — | Mission Control auth token |
| `DC1_AGENT_ID` | — | `atlas` | Agent identifier for heartbeats |

## Quick Start

```bash
pip install -r requirements.txt

# Set required env vars
export DC1_S3_BUCKET=dc1-checkpoints
export DC1_S3_ACCESS_KEY=...
export DC1_S3_SECRET_KEY=...

# Use in code
python -c "
import asyncio
from orchestration.checkpoint import CheckpointManager, CheckpointConfig
mgr = CheckpointManager(CheckpointConfig.from_env())
# await mgr.save_checkpoint('job-1', 'ctr-1', {...})
"
```

## Running with PM2

```bash
# Create a runner script (e.g. run_scheduler.py) that calls:
#   mgr.start_hourly_scheduler(job_id, container_id, state_fn)
# Then:
pm2 start run_scheduler.py --name dc1-checkpoint --interpreter python3
pm2 save
```

## Running Tests

```bash
pip install -r requirements.txt
pytest orchestration/checkpoint/tests/ -v
```

Tests are fully mocked — no real S3 or filesystem access needed.

## Notes

- Checkpoints are **NOT encrypted** (job state is non-sensitive metadata: GPU model, elapsed time, wallet amounts)
- S3 bucket must have a **lifecycle policy** set to 60-day auto-delete
- All file writes are **atomic** (temp file + rename) to prevent corruption
- S3 failures retry 3× with exponential backoff (1s → 2s → 4s)
- If both S3 and local fail, a `CheckpointError` is raised (job should be paused)
