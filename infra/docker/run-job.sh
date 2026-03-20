#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  run-job.sh --job-id JOB_ID --image IMAGE [options]

Required:
  --job-id JOB_ID             Logical DCP job id (jobs.job_id)
  --image IMAGE               Docker image to run

Options:
  --job-cmd CMD               Command executed inside container (default: python /dc1/job/task.py)
  --host-job-dir PATH         Host directory copied into tmpfs job dir before launch
  --db-path PATH              SQLite DB path; when set, container id is written to jobs record
  --network MODE              none | bridge:NETWORK_NAME (default: none)
  --cpus N                    CPU quota for container (default: 2)
  --memory SIZE               Memory limit, docker format (default: 4g)
  --tmpfs-size SIZE           Tmpfs size for /dc1/job (default: 1g)
  --gpus REQUEST              Docker GPU request (default: all, set none to disable)
  --pids-limit N              Max process count (default: 256)
  --no-stream-logs            Do not stream container logs
  --help                      Show this help
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

ensure_bridge_network() {
  local network_name="$1"
  if docker network inspect "$network_name" >/dev/null 2>&1; then
    return 0
  fi
  docker network create --driver bridge --internal "$network_name" >/dev/null
}

log_container_id_to_job_record() {
  local db_path="$1"
  local job_id="$2"
  local container_id="$3"

  if [[ -z "$db_path" ]]; then
    return 0
  fi

  if [[ ! -f "$db_path" ]]; then
    echo "Warning: DB path does not exist, skipping job record update: $db_path" >&2
    return 0
  fi

  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "Warning: sqlite3 not installed; cannot log container id to jobs table" >&2
    return 0
  fi

  local job_id_sql
  local container_id_sql
  local now_sql
  local has_container_id_column
  local changes
  job_id_sql="$(sql_escape "$job_id")"
  container_id_sql="$(sql_escape "$container_id")"
  now_sql="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  has_container_id_column="$(sqlite3 "$db_path" \
    "SELECT COUNT(*) FROM pragma_table_info('jobs') WHERE name = 'container_id';" \
    2>/dev/null || echo "0")"

  if [[ "$has_container_id_column" == "1" ]]; then
    changes="$(sqlite3 "$db_path" "
      UPDATE jobs
      SET container_id = '$container_id_sql',
          started_at = COALESCE(started_at, '$now_sql'),
          updated_at = '$now_sql'
      WHERE job_id = '$job_id_sql';
      SELECT changes();
    " | tail -n1)"
  else
    changes="$(sqlite3 "$db_path" "
      UPDATE jobs
      SET notes = CASE
            WHEN notes IS NULL OR notes = '' THEN 'container_id=$container_id_sql'
            ELSE notes || char(10) || 'container_id=$container_id_sql'
          END,
          started_at = COALESCE(started_at, '$now_sql'),
          updated_at = '$now_sql'
      WHERE job_id = '$job_id_sql';
      SELECT changes();
    " | tail -n1)"
  fi

  if [[ "${changes:-0}" == "0" ]]; then
    echo "Warning: no jobs row updated for job_id=$job_id" >&2
  fi
}

JOB_ID=""
IMAGE=""
JOB_CMD="python /dc1/job/task.py"
HOST_JOB_DIR=""
DB_PATH=""
NETWORK_MODE="none"
CPUS="2"
MEMORY="4g"
TMPFS_SIZE="1g"
GPU_REQUEST="all"
PIDS_LIMIT="256"
STREAM_LOGS="1"
TMPFS_JOB_DIR="/dc1/job"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --job-id)
      JOB_ID="${2:-}"; shift 2 ;;
    --image)
      IMAGE="${2:-}"; shift 2 ;;
    --job-cmd)
      JOB_CMD="${2:-}"; shift 2 ;;
    --host-job-dir)
      HOST_JOB_DIR="${2:-}"; shift 2 ;;
    --db-path)
      DB_PATH="${2:-}"; shift 2 ;;
    --network)
      NETWORK_MODE="${2:-}"; shift 2 ;;
    --cpus)
      CPUS="${2:-}"; shift 2 ;;
    --memory)
      MEMORY="${2:-}"; shift 2 ;;
    --tmpfs-size)
      TMPFS_SIZE="${2:-}"; shift 2 ;;
    --gpus)
      GPU_REQUEST="${2:-}"; shift 2 ;;
    --pids-limit)
      PIDS_LIMIT="${2:-}"; shift 2 ;;
    --no-stream-logs)
      STREAM_LOGS="0"; shift ;;
    --help|-h)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ -z "$JOB_ID" || -z "$IMAGE" ]]; then
  echo "Error: --job-id and --image are required" >&2
  usage
  exit 1
fi

if [[ -n "$HOST_JOB_DIR" && ! -d "$HOST_JOB_DIR" ]]; then
  echo "Error: --host-job-dir does not exist: $HOST_JOB_DIR" >&2
  exit 1
fi

require_cmd docker
docker info >/dev/null 2>&1 || {
  echo "Error: Docker daemon is not reachable" >&2
  exit 1
}

EFFECTIVE_NETWORK="none"
if [[ "$NETWORK_MODE" == "none" ]]; then
  EFFECTIVE_NETWORK="none"
elif [[ "$NETWORK_MODE" =~ ^bridge:(.+)$ ]]; then
  EFFECTIVE_NETWORK="${BASH_REMATCH[1]}"
  ensure_bridge_network "$EFFECTIVE_NETWORK"
else
  echo "Error: --network must be 'none' or 'bridge:NETWORK_NAME'" >&2
  exit 1
fi

CONTAINER_NAME="dcp-job-${JOB_ID//[^a-zA-Z0-9_.-]/-}-$(date -u +%s)"
INIT_CMD="if [ -d /dc1/input ]; then cp -a /dc1/input/. ${TMPFS_JOB_DIR}/ 2>/dev/null || true; fi; cd ${TMPFS_JOB_DIR}; ${JOB_CMD}"

docker_args=(
  run
  --detach
  --rm
  --name "$CONTAINER_NAME"
  --network "$EFFECTIVE_NETWORK"
  --cpus "$CPUS"
  --memory "$MEMORY"
  --pids-limit "$PIDS_LIMIT"
  --security-opt no-new-privileges:true
  --cap-drop ALL
  --read-only
  --mount "type=tmpfs,destination=${TMPFS_JOB_DIR},tmpfs-size=${TMPFS_SIZE}"
  --tmpfs "/tmp:rw,noexec,nosuid,size=256m"
  --tmpfs "/var/tmp:rw,noexec,nosuid,size=128m"
)

if [[ "$GPU_REQUEST" != "none" ]]; then
  docker_args+=(--gpus "$GPU_REQUEST")
fi

if [[ -n "$HOST_JOB_DIR" ]]; then
  docker_args+=(--mount "type=bind,src=${HOST_JOB_DIR},dst=/dc1/input,readonly")
fi

docker_args+=("$IMAGE" /bin/sh -lc "$INIT_CMD")

CONTAINER_ID="$(docker "${docker_args[@]}")"
echo "container_id=${CONTAINER_ID}"
echo "network=${EFFECTIVE_NETWORK} cpus=${CPUS} memory=${MEMORY} tmpfs_size=${TMPFS_SIZE}"

log_container_id_to_job_record "$DB_PATH" "$JOB_ID" "$CONTAINER_ID"

if [[ "$STREAM_LOGS" == "1" ]]; then
  docker logs -f "$CONTAINER_ID" &
  LOGS_PID=$!
else
  LOGS_PID=""
fi

EXIT_CODE="$(docker wait "$CONTAINER_ID" 2>/dev/null | tail -n1 || echo "1")"

if [[ -n "${LOGS_PID}" ]]; then
  wait "$LOGS_PID" || true
fi

echo "job_id=${JOB_ID} container_id=${CONTAINER_ID} exit_code=${EXIT_CODE}"
exit "$EXIT_CODE"
