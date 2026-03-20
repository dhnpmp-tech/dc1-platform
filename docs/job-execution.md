# DCP Job Execution Runtime (Docker Isolation)

This document defines the runtime contract for isolated job containers launched by:

- `infra/docker/run-job.sh`

## Isolation Baseline

The runner enforces these controls by default:

- `--network none` (or optional dedicated internal bridge via `--network bridge:<name>`)
- `--mount type=tmpfs,destination=/dc1/job` for ephemeral in-container job workspace
- `--cpus 2`
- `--memory 4g`
- `--rm` container auto-cleanup
- `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges:true`
- bounded process count (`--pids-limit 256`)

## Job Record Logging

When `--db-path` is provided, the script logs launched `container_id` to the SQLite `jobs` row:

- If `jobs.container_id` exists, it writes that column.
- Otherwise it appends `container_id=<id>` to `jobs.notes`.
- It also sets `started_at` and `updated_at` timestamps.

## Usage

Minimal example:

```bash
infra/docker/run-job.sh \
  --job-id JOB-123 \
  --image dc1/sd-worker:latest \
  --job-cmd "python /dc1/job/task.py"
```

With host task payload + DB logging:

```bash
infra/docker/run-job.sh \
  --job-id JOB-123 \
  --image dc1/sd-worker:latest \
  --host-job-dir /tmp/dcp/jobs/JOB-123 \
  --db-path backend/data/providers.db \
  --job-cmd "python /dc1/job/task.py"
```

Dedicated bridge network (internal-only):

```bash
infra/docker/run-job.sh \
  --job-id JOB-123 \
  --image dc1/llm-worker:latest \
  --network bridge:dcp-job-net \
  --job-cmd "python /dc1/job/task.py"
```

## CLI Options

```text
--job-id JOB_ID           Required logical job id (jobs.job_id)
--image IMAGE             Required docker image
--job-cmd CMD             Command run inside container (default: python /dc1/job/task.py)
--host-job-dir PATH       Host dir copied into /dc1/job tmpfs before command starts
--db-path PATH            SQLite DB path for jobs table update
--network MODE            none | bridge:NETWORK_NAME (default: none)
--cpus N                  CPU limit (default: 2)
--memory SIZE             Memory limit (default: 4g)
--tmpfs-size SIZE         /dc1/job tmpfs size (default: 1g)
--gpus REQUEST            Docker GPU selector (default: all; use none to disable)
--pids-limit N            Max process count (default: 256)
--no-stream-logs          Disable `docker logs -f` streaming
```

## Deployment Note

This script is prepared for Claude-Cowork VPS deployment flow. It does not require git operations inside the Paperclip container.
