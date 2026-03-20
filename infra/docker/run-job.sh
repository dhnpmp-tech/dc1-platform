#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage (template mode, preferred):
  run-job.sh <container_type> <model_path> <job_payload> <output_dir> [options]

Template mode arguments:
  container_type                One of: pytorch-cuda | vllm-serve | training | rendering
  model_path                    Host path to model directory/file (mounted read-only to /opt/dcp/model)
  job_payload                   Host path to payload JSON file
  output_dir                    Host directory for outputs/logs

Template mode options:
  --timeout-seconds N           Max runtime before forced stop (default: 3600)
  --model-cache-dir PATH        Host cache dir mounted to /opt/dcp/model-cache (default: /opt/dcp/model-cache)
  --stream-logs                 Stream docker logs (default: enabled)
  --no-stream-logs              Disable docker log streaming
  --image IMAGE                 Override image resolved from container_type

Legacy mode (backward compatible):
  run-job.sh --job-id JOB_ID --image IMAGE [options]

Legacy options:
  --job-cmd CMD                 Command executed inside container (default: python /dc1/job/task.py)
  --host-job-dir PATH           Host directory copied into tmpfs job dir before launch
  --workspace-volume NAME       Named Docker volume mounted at /workspace (default: dcp-job-{job_id})
  --enable-checkpoint           Enable Docker checkpoint-friendly container options
  --checkpoint-name NAME        Optional checkpoint name metadata for logs
  --db-path PATH                SQLite DB path; when set, container id is written to jobs record
  --pinned-digest SHA256        Expected image digest (format: sha256:<64-hex>)
  --require-pinned-digest       Fail if --pinned-digest is not provided
  --network MODE                none | bridge:NETWORK_NAME (default: none)
  --cpus N                      CPU quota for container (default: 2)
  --memory SIZE                 Memory limit, docker format (default: 4g)
  --tmpfs-size SIZE             Tmpfs size for /dc1/job (default: 1g)
  --gpus REQUEST                Docker GPU request (default: all, set none to disable)
  --pids-limit N                Max process count (default: 256)

Common:
  --help                        Show this help
USAGE
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

ensure_docker_volume() {
  local volume_name="$1"
  if [[ -z "$volume_name" ]]; then
    return 1
  fi
  if docker volume inspect "$volume_name" >/dev/null 2>&1; then
    return 0
  fi
  docker volume create "$volume_name" >/dev/null
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

resolve_image_from_container_type() {
  case "$1" in
    pytorch-cuda) echo "dcp/pytorch-cuda:latest" ;;
    vllm-serve) echo "dcp/vllm-serve:latest" ;;
    training) echo "dcp/training:latest" ;;
    rendering) echo "dcp/rendering:latest" ;;
    *)
      echo "" ;;
  esac
}

verify_pinned_digest() {
  local image_ref="$1"
  local pinned_digest="$2"

  if [[ -z "$pinned_digest" ]]; then
    return 0
  fi

  if [[ ! "$pinned_digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    echo "Error: --pinned-digest must be in format sha256:<64-hex>" >&2
    exit 1
  fi

  local repo_digests
  repo_digests="$(docker image inspect --format '{{json .RepoDigests}}' "$image_ref" 2>/dev/null || true)"
  if [[ -z "$repo_digests" || "$repo_digests" == "null" || "$repo_digests" == "[]" ]]; then
    echo "Error: unable to resolve repo digest for image '$image_ref'" >&2
    exit 1
  fi

  local resolved_digest
  resolved_digest="$(printf '%s' "$repo_digests" | grep -Eo 'sha256:[a-f0-9]{64}' | head -n1 || true)"
  if [[ -z "$resolved_digest" ]]; then
    echo "Error: image '$image_ref' has no sha256 digest metadata" >&2
    exit 1
  fi

  if [[ "$resolved_digest" != "$pinned_digest" ]]; then
    echo "Error: image digest mismatch for '$image_ref' (expected '$pinned_digest', got '$resolved_digest')" >&2
    exit 1
  fi
}

wait_for_container_with_timeout() {
  local container_id="$1"
  local timeout_seconds="$2"
  local wait_output=""
  local wait_status=0

  set +e
  wait_output="$(timeout --foreground "${timeout_seconds}s" docker wait "$container_id" 2>/dev/null)"
  wait_status=$?
  set -e

  if [[ "$wait_status" -eq 124 ]]; then
    echo "Timeout reached (${timeout_seconds}s). Stopping container $container_id" >&2
    docker rm -f "$container_id" >/dev/null 2>&1 || true
    echo "124"
    return 0
  fi

  if [[ "$wait_status" -ne 0 ]]; then
    echo "docker wait failed for container $container_id" >&2
    echo "1"
    return 0
  fi

  echo "${wait_output##*$'\n'}"
}

run_template_mode() {
  local container_type="$1"
  local model_path="$2"
  local job_payload="$3"
  local output_dir="$4"
  local timeout_seconds="$5"
  local model_cache_dir="$6"
  local image_override="$7"
  local stream_logs="$8"
  local pinned_digest="$9"
  local require_pinned_digest="${10}"

  local image
  image="$image_override"
  if [[ -z "$image" ]]; then
    image="$(resolve_image_from_container_type "$container_type")"
  fi

  if [[ -z "$image" ]]; then
    echo "Error: unknown container_type '$container_type' and no --image override provided" >&2
    exit 1
  fi
  if [[ "$require_pinned_digest" == "1" && -z "$pinned_digest" ]]; then
    echo "Error: pinned digest required but --pinned-digest not provided" >&2
    exit 1
  fi

  if [[ ! -e "$model_path" ]]; then
    echo "Error: model_path does not exist: $model_path" >&2
    exit 1
  fi

  if [[ ! -f "$job_payload" ]]; then
    echo "Error: job_payload does not exist or is not a file: $job_payload" >&2
    exit 1
  fi

  verify_pinned_digest "$image" "$pinned_digest"

  mkdir -p "$output_dir"
  mkdir -p "$model_cache_dir"

  local container_name
  local container_id=""
  local logs_pid=""
  container_name="dcp-template-${container_type//[^a-zA-Z0-9_.-]/-}-$(date -u +%s)"

  cleanup_container() {
    if [[ -n "$container_id" ]]; then
      docker rm -f "$container_id" >/dev/null 2>&1 || true
    fi
  }

  trap cleanup_container EXIT INT TERM

  container_id="$(docker run --detach --rm \
    --name "$container_name" \
    --gpus all \
    --security-opt no-new-privileges:true \
    --cap-drop ALL \
    --cap-add SYS_PTRACE \
    --read-only \
    --tmpfs "/tmp:rw,noexec,nosuid,size=256m" \
    --tmpfs "/var/tmp:rw,noexec,nosuid,size=128m" \
    --mount "type=bind,src=${model_cache_dir},dst=/opt/dcp/model-cache" \
    --mount "type=bind,src=${model_path},dst=/opt/dcp/model,readonly" \
    --mount "type=bind,src=${job_payload},dst=/opt/dcp/input/job_payload.json,readonly" \
    --mount "type=bind,src=${output_dir},dst=/opt/dcp/output" \
    -e "DCP_CONTAINER_TYPE=${container_type}" \
    -e "DCP_MODEL_PATH=/opt/dcp/model" \
    -e "DCP_JOB_PAYLOAD_PATH=/opt/dcp/input/job_payload.json" \
    -e "DCP_OUTPUT_DIR=/opt/dcp/output" \
    "$image")"

  echo "mode=template container_id=${container_id} image=${image}"

  if [[ "$stream_logs" == "1" ]]; then
    docker logs -f "$container_id" &
    logs_pid=$!
  fi

  local exit_code
  exit_code="$(wait_for_container_with_timeout "$container_id" "$timeout_seconds")"

  if [[ -n "$logs_pid" ]]; then
    wait "$logs_pid" || true
  fi

  trap - EXIT INT TERM
  cleanup_container

  echo "container_type=${container_type} exit_code=${exit_code} output_dir=${output_dir}"
  return "$exit_code"
}

run_legacy_mode() {
  local job_id="$1"
  local image="$2"
  local job_cmd="$3"
  local host_job_dir="$4"
  local db_path="$5"
  local network_mode="$6"
  local cpus="$7"
  local memory="$8"
  local tmpfs_size="$9"
  local gpu_request="${10}"
  local pids_limit="${11}"
  local stream_logs="${12}"
  local workspace_volume="${13}"
  local enable_checkpoint="${14}"
  local checkpoint_name="${15}"
  local pinned_digest="${16}"
  local require_pinned_digest="${17}"

  if [[ -z "$job_id" || -z "$image" ]]; then
    echo "Error: --job-id and --image are required" >&2
    usage
    exit 1
  fi

  if [[ -n "$host_job_dir" && ! -d "$host_job_dir" ]]; then
    echo "Error: --host-job-dir does not exist: $host_job_dir" >&2
    exit 1
  fi
  if [[ "$require_pinned_digest" == "1" && -z "$pinned_digest" ]]; then
    echo "Error: pinned digest required but --pinned-digest not provided" >&2
    exit 1
  fi

  local effective_network="none"
  if [[ "$network_mode" == "none" ]]; then
    effective_network="none"
  elif [[ "$network_mode" =~ ^bridge:(.+)$ ]]; then
    effective_network="${BASH_REMATCH[1]}"
    ensure_bridge_network "$effective_network"
  else
    echo "Error: --network must be 'none' or 'bridge:NETWORK_NAME'" >&2
    exit 1
  fi

  verify_pinned_digest "$image" "$pinned_digest"

  local container_name
  local init_cmd
  local tmpfs_job_dir="/dc1/job"
  container_name="dcp-job-${job_id//[^a-zA-Z0-9_.-]/-}-$(date -u +%s)"
  if [[ -z "$workspace_volume" ]]; then
    workspace_volume="dcp-job-${job_id//[^a-zA-Z0-9_.-]/-}"
  fi
  ensure_docker_volume "$workspace_volume"
  init_cmd="if [ -d /dc1/input ]; then cp -a /dc1/input/. ${tmpfs_job_dir}/ 2>/dev/null || true; fi; cd ${tmpfs_job_dir}; ${job_cmd}"

  local docker_args
  docker_args=(
    run
    --detach
    --rm
    --name "$container_name"
    --network "$effective_network"
    --cpus "$cpus"
    --memory "$memory"
    --pids-limit "$pids_limit"
    --security-opt no-new-privileges:true
    --cap-drop ALL
    --cap-add SYS_PTRACE
    --read-only
    --mount "type=tmpfs,destination=${tmpfs_job_dir},tmpfs-size=${tmpfs_size}"
    --mount "type=volume,src=${workspace_volume},dst=/workspace"
    --tmpfs "/tmp:rw,noexec,nosuid,size=256m"
    --tmpfs "/var/tmp:rw,noexec,nosuid,size=128m"
  )

  if [[ "$enable_checkpoint" == "1" ]]; then
    docker_args+=(--security-opt seccomp=unconfined)
    docker_args+=(--cap-add CHECKPOINT_RESTORE)
  fi

  if [[ "$gpu_request" != "none" ]]; then
    docker_args+=(--gpus "$gpu_request")
  fi

  if [[ -n "$host_job_dir" ]]; then
    docker_args+=(--mount "type=bind,src=${host_job_dir},dst=/dc1/input,readonly")
  fi

  docker_args+=("$image" /bin/sh -lc "$init_cmd")

  local container_id
  local logs_pid=""
  local exit_code

  container_id="$(docker "${docker_args[@]}")"
  echo "mode=legacy container_id=${container_id}"
  echo "network=${effective_network} cpus=${cpus} memory=${memory} tmpfs_size=${tmpfs_size} workspace_volume=${workspace_volume} checkpoint_enabled=${enable_checkpoint} checkpoint_name=${checkpoint_name}"

  log_container_id_to_job_record "$db_path" "$job_id" "$container_id"

  if [[ "$stream_logs" == "1" ]]; then
    docker logs -f "$container_id" &
    logs_pid=$!
  fi

  exit_code="$(docker wait "$container_id" 2>/dev/null | tail -n1 || echo "1")"

  if [[ -n "$logs_pid" ]]; then
    wait "$logs_pid" || true
  fi

  echo "job_id=${job_id} container_id=${container_id} exit_code=${exit_code}"
  return "$exit_code"
}

# Shared defaults
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
WORKSPACE_VOLUME=""
ENABLE_CHECKPOINT="0"
CHECKPOINT_NAME=""
PINNED_DIGEST=""
REQUIRE_PINNED_DIGEST="0"

# Template mode defaults
CONTAINER_TYPE=""
MODEL_PATH=""
JOB_PAYLOAD=""
OUTPUT_DIR=""
TIMEOUT_SECONDS="3600"
MODEL_CACHE_DIR="${DCP_MODEL_CACHE_DIR:-/opt/dcp/model-cache}"
if [[ "${DCP_REQUIRE_PINNED_IMAGE_DIGEST:-}" == "true" ]]; then
  REQUIRE_PINNED_DIGEST="1"
fi

# Positional shorthand for template mode
if [[ $# -ge 4 && "${1:-}" != -* ]]; then
  CONTAINER_TYPE="$1"
  MODEL_PATH="$2"
  JOB_PAYLOAD="$3"
  OUTPUT_DIR="$4"
  shift 4
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --container-type)
      CONTAINER_TYPE="${2:-}"; shift 2 ;;
    --model-path)
      MODEL_PATH="${2:-}"; shift 2 ;;
    --job-payload)
      JOB_PAYLOAD="${2:-}"; shift 2 ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"; shift 2 ;;
    --timeout-seconds)
      TIMEOUT_SECONDS="${2:-}"; shift 2 ;;
    --model-cache-dir)
      MODEL_CACHE_DIR="${2:-}"; shift 2 ;;
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
    --pinned-digest)
      PINNED_DIGEST="${2:-}"; shift 2 ;;
    --require-pinned-digest)
      REQUIRE_PINNED_DIGEST="1"; shift ;;
    --workspace-volume)
      WORKSPACE_VOLUME="${2:-}"; shift 2 ;;
    --enable-checkpoint)
      ENABLE_CHECKPOINT="1"; shift ;;
    --checkpoint-name)
      CHECKPOINT_NAME="${2:-}"; shift 2 ;;
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
    --stream-logs)
      STREAM_LOGS="1"; shift ;;
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

require_cmd docker
require_cmd timeout
docker info >/dev/null 2>&1 || {
  echo "Error: Docker daemon is not reachable" >&2
  exit 1
}

if [[ -n "$CONTAINER_TYPE" || -n "$MODEL_PATH" || -n "$JOB_PAYLOAD" || -n "$OUTPUT_DIR" ]]; then
  if [[ -z "$CONTAINER_TYPE" || -z "$MODEL_PATH" || -z "$JOB_PAYLOAD" || -z "$OUTPUT_DIR" ]]; then
    echo "Error: template mode requires container_type, model_path, job_payload, and output_dir" >&2
    usage
    exit 1
  fi

  run_template_mode \
    "$CONTAINER_TYPE" \
    "$MODEL_PATH" \
    "$JOB_PAYLOAD" \
    "$OUTPUT_DIR" \
    "$TIMEOUT_SECONDS" \
    "$MODEL_CACHE_DIR" \
    "$IMAGE" \
    "$STREAM_LOGS" \
    "$PINNED_DIGEST" \
    "$REQUIRE_PINNED_DIGEST"
  exit $?
fi

run_legacy_mode \
  "$JOB_ID" \
  "$IMAGE" \
  "$JOB_CMD" \
  "$HOST_JOB_DIR" \
  "$DB_PATH" \
  "$NETWORK_MODE" \
  "$CPUS" \
  "$MEMORY" \
  "$TMPFS_SIZE" \
  "$GPU_REQUEST" \
  "$PIDS_LIMIT" \
  "$STREAM_LOGS" \
  "$WORKSPACE_VOLUME" \
  "$ENABLE_CHECKPOINT" \
  "$CHECKPOINT_NAME" \
  "$PINNED_DIGEST" \
  "$REQUIRE_PINNED_DIGEST"
