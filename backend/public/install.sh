#!/usr/bin/env bash
set -euo pipefail

API_BASE="${DCP_API_BASE:-https://api.dcp.sa}"
CONFIG_DIR="${HOME}/.dcp"
CONFIG_FILE="${CONFIG_DIR}/config"
INSTALL_DIR="${HOME}/dcp-provider"
LOG_DIR="${INSTALL_DIR}/logs"
DAEMON_PATH="${INSTALL_DIR}/dc1_daemon.py"
PID_FILE="${INSTALL_DIR}/dc1_daemon.pid"

LAUNCHD_LABEL="com.dcp.provider"
LAUNCHD_PLIST="${HOME}/Library/LaunchAgents/${LAUNCHD_LABEL}.plist"
SYSTEMD_USER_UNIT_DIR="${HOME}/.config/systemd/user"
SYSTEMD_USER_UNIT="${SYSTEMD_USER_UNIT_DIR}/dcp-provider.service"
SYSTEMD_SYSTEM_UNIT="/etc/systemd/system/dcp-provider.service"

OS_UNAME="$(uname -s 2>/dev/null || echo unknown)"
case "${OS_UNAME}" in
  Linux*) DCP_OS="linux" ;;
  Darwin*) DCP_OS="mac" ;;
  *) DCP_OS="linux" ;;
esac

# Accept provider key as first positional arg (curl ... | bash -s KEY)
# or via DCP_PROVIDER_KEY env var.
DCP_PROVIDER_KEY="${DCP_PROVIDER_KEY:-${1:-}}"
DCP_PROVIDER_ID="${DCP_PROVIDER_ID:-}"
DCP_PROVIDER_EMAIL="${DCP_PROVIDER_EMAIL:-}"
DCP_PROVIDER_NAME="${DCP_PROVIDER_NAME:-}"
DCP_PROVIDER_PHONE="${DCP_PROVIDER_PHONE:-}"
DCP_SYSTEMD_MODE="${DCP_SYSTEMD_MODE:-user}" # user (default) or system

# Positional args for non-interactive install:
#   curl -sSL https://dcp.sa/install | bash -s -- email@example.com
#   curl -sSL https://dcp.sa/install | bash -s -- "" https://custom.api.url
#   curl -sSL https://dcp.sa/install | bash -s -- email@example.com https://custom.api.url
if [ -n "${1:-}" ] && [ -z "${DCP_PROVIDER_KEY}" ]; then
  # First arg is email when no API key is set
  DCP_PROVIDER_EMAIL="${1}"
fi
if [ -n "${2:-}" ]; then
  API_BASE="${2}"
fi

step() { printf '\n==> %s\n' "$1"; }
info() { printf '  - %s\n' "$1"; }
warn() { printf '  ! %s\n' "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

shell_quote() {
  printf "%s" "$1" | sed "s/'/'\\\\''/g"
}

json_get_string() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -n 1
}

json_get_number() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p" | head -n 1
}

load_config() {
  local env_key="${DCP_PROVIDER_KEY:-}"
  local env_id="${DCP_PROVIDER_ID:-}"
  local env_email="${DCP_PROVIDER_EMAIL:-}"
  local env_name="${DCP_PROVIDER_NAME:-}"
  if [ -f "${CONFIG_FILE}" ]; then
    # shellcheck disable=SC1090
    . "${CONFIG_FILE}"
  fi
  [ -n "${env_key}" ] && DCP_PROVIDER_KEY="${env_key}" || true
  [ -n "${env_id}" ] && DCP_PROVIDER_ID="${env_id}" || true
  [ -n "${env_email}" ] && DCP_PROVIDER_EMAIL="${env_email}" || true
  [ -n "${env_name}" ] && DCP_PROVIDER_NAME="${env_name}" || true
}

write_config() {
  mkdir -p "${CONFIG_DIR}"
  umask 077
  {
    printf "DCP_PROVIDER_KEY='%s'\n" "$(shell_quote "${DCP_PROVIDER_KEY}")"
    printf "DCP_PROVIDER_ID='%s'\n" "$(shell_quote "${DCP_PROVIDER_ID:-}")"
    printf "DCP_PROVIDER_EMAIL='%s'\n" "$(shell_quote "${DCP_PROVIDER_EMAIL:-}")"
    printf "DCP_PROVIDER_NAME='%s'\n" "$(shell_quote "${DCP_PROVIDER_NAME:-}")"
    printf "DCP_API_BASE='%s'\n" "$(shell_quote "${API_BASE}")"
  } > "${CONFIG_FILE}"
  chmod 600 "${CONFIG_FILE}"

  # Write systemd-compatible env file for the daemon
  {
    printf "DCP_API_KEY=%s\n" "${DCP_PROVIDER_KEY}"
    printf "DCP_API_URL=%s\n" "${API_BASE}"
    if [ -n "${VLLM_ENDPOINT_URL:-}" ]; then
      printf "VLLM_ENDPOINT_URL=%s\n" "${VLLM_ENDPOINT_URL}"
    fi
  } > "${CONFIG_DIR}/env"
  chmod 600 "${CONFIG_DIR}/env"
}

detect_gpu() {
  if command -v nvidia-smi >/dev/null 2>&1; then
    GPU_MODEL="$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    VRAM_MIB_RAW="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d '[:space:]')"
    if [ -z "${GPU_MODEL}" ]; then
      GPU_MODEL="NVIDIA GPU"
    fi
    if [ -n "${VRAM_MIB_RAW}" ] && [ "${VRAM_MIB_RAW}" -ge 0 ] 2>/dev/null; then
      VRAM_GB="$((VRAM_MIB_RAW / 1024))"
    else
      VRAM_GB=0
    fi
  else
    GPU_MODEL="CPU"
    VRAM_GB=0
  fi
}

ensure_python() {
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    fail "python3 is required. Install Python 3.8+ and re-run this installer."
  fi
}

register_provider_if_needed() {
  if [ -n "${DCP_PROVIDER_KEY}" ]; then
    info "Provider key found."
    return
  fi

  # Ask for existing key first
  if [ -r /dev/tty ]; then
    echo ""
    info "Register at https://dcp.sa/provider/register to get your API key."
    echo ""
    read -r -p "  Enter your DCP provider API key (dc1-provider-...): " DCP_PROVIDER_KEY </dev/tty
    echo ""
    if [ -n "${DCP_PROVIDER_KEY}" ]; then
      if echo "${DCP_PROVIDER_KEY}" | grep -q "^dc1-provider-"; then
        success "API key accepted"
        return
      else
        warn "Key doesn't look right (expected dc1-provider-...). Trying auto-registration."
        DCP_PROVIDER_KEY=""
      fi
    fi
  fi

  # Fallback: auto-register with email
  [ -n "${DCP_PROVIDER_NAME}" ] || DCP_PROVIDER_NAME="$(hostname 2>/dev/null || whoami)"

  if [ -z "${DCP_PROVIDER_EMAIL}" ] && [ -r /dev/tty ]; then
    read -r -p "  No API key? Enter your email to register: " DCP_PROVIDER_EMAIL </dev/tty
  fi
  [ -n "${DCP_PROVIDER_EMAIL}" ] || fail "API key or email required. Register at https://dcp.sa/provider/register"

  local payload
  payload=$(cat <<JSON
{"name":"$(json_escape "${DCP_PROVIDER_NAME}")","email":"$(json_escape "${DCP_PROVIDER_EMAIL}")","gpu_model":"$(json_escape "${GPU_MODEL}")","os":"${DCP_OS}","phone":"$(json_escape "${DCP_PROVIDER_PHONE}")","resource_spec":{"gpu":{"model":"$(json_escape "${GPU_MODEL}")","vram_gb":${VRAM_GB}}}}
JSON
)

  info "Registering provider at ${API_BASE}/api/providers/register"
  local response
  response="$(curl -sS -X POST "${API_BASE}/api/providers/register" -H "Content-Type: application/json" -d "${payload}" || true)"

  local api_key
  api_key="$(json_get_string "${response}" "api_key")"
  if [ -z "${api_key}" ]; then
    local err
    err="$(json_get_string "${response}" "error")"
    [ -n "${err}" ] || err="Registration failed: ${response}"
    fail "${err}"
  fi

  DCP_PROVIDER_KEY="${api_key}"
  DCP_PROVIDER_ID="$(json_get_number "${response}" "provider_id")"
  info "Provider registration complete (id: ${DCP_PROVIDER_ID:-unknown})."
}

setup_wireguard() {
  if [ "${DCP_OS}" = "mac" ]; then
    if ! command -v wg >/dev/null 2>&1; then
      info "Installing WireGuard via Homebrew..."
      brew install wireguard-tools 2>/dev/null || warn "Could not install WireGuard. Install manually: brew install wireguard-tools"
    fi
  else
    if ! command -v wg >/dev/null 2>&1; then
      info "Installing WireGuard..."
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq && sudo apt-get install -y -qq wireguard-tools 2>&1 | tail -2
      elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y wireguard-tools 2>&1 | tail -2
      elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y wireguard-tools 2>&1 | tail -2
      else
        warn "Could not install WireGuard automatically. Install wireguard-tools manually."
      fi
    fi
  fi

  if ! command -v wg >/dev/null 2>&1; then
    warn "WireGuard not available. VPN setup will be needed later for NAT traversal."
    return
  fi

  local wg_dir="${CONFIG_DIR}/wireguard"
  mkdir -p "${wg_dir}"

  if [ -f "${wg_dir}/private.key" ]; then
    info "WireGuard keypair already exists."
  else
    wg genkey > "${wg_dir}/private.key"
    chmod 600 "${wg_dir}/private.key"
    wg pubkey < "${wg_dir}/private.key" > "${wg_dir}/public.key"
    info "WireGuard keypair generated."
  fi

  local wg_pubkey
  wg_pubkey="$(cat "${wg_dir}/public.key")"

  # Register WireGuard public key with the backend
  local wg_response
  wg_response="$(curl -sS -X POST "${API_BASE}/api/providers/wireguard" \
    -H "Content-Type: application/json" \
    -H "x-provider-key: ${DCP_PROVIDER_KEY}" \
    -d "{\"public_key\":\"${wg_pubkey}\"}" 2>/dev/null || echo "{}")"

  local wg_ip
  wg_ip="$(json_get_string "${wg_response}" "assigned_ip")"
  local wg_endpoint
  wg_endpoint="$(json_get_string "${wg_response}" "endpoint")"
  local wg_server_pubkey
  wg_server_pubkey="$(json_get_string "${wg_response}" "server_public_key")"

  if [ -n "${wg_ip}" ] && [ -n "${wg_server_pubkey}" ]; then
    # Write WireGuard config
    cat > "${wg_dir}/wg0.conf" <<WGCONF
[Interface]
PrivateKey = $(cat "${wg_dir}/private.key")
Address = ${wg_ip}/24

[Peer]
PublicKey = ${wg_server_pubkey}
Endpoint = ${wg_endpoint:-76.13.179.86:51820}
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
WGCONF
    chmod 600 "${wg_dir}/wg0.conf"
    info "WireGuard config written. Activating VPN..."
    sudo cp "${wg_dir}/wg0.conf" /etc/wireguard/wg0.conf 2>/dev/null || true
    sudo wg-quick up wg0 2>/dev/null || warn "Could not activate WireGuard. Run manually: sudo wg-quick up wg0"
    info "VPN public key: ${wg_pubkey}"
  else
    info "WireGuard public key: ${wg_pubkey}"
    info "VPN config will be assigned by DCP after approval."
  fi
}




select_model_for_vram() {
  # Select the best model based on available VRAM
  # Returns model ID suitable for vLLM
  if [ "${VRAM_GB}" -ge 40 ]; then
    DCP_MODEL="Qwen/Qwen2.5-72B-Instruct-AWQ"
    DCP_MODEL_EXTRA_ARGS="--quantization awq"
    info "Selected: Qwen 2.5 72B AWQ (large GPU)"
  elif [ "${VRAM_GB}" -ge 20 ]; then
    DCP_MODEL="Qwen/Qwen2.5-32B-Instruct-AWQ"
    DCP_MODEL_EXTRA_ARGS="--quantization awq"
    info "Selected: Qwen 2.5 32B AWQ (24GB+ GPU)"
  elif [ "${VRAM_GB}" -ge 12 ]; then
    DCP_MODEL="Qwen/Qwen2.5-14B-Instruct"
    DCP_MODEL_EXTRA_ARGS=""
    info "Selected: Qwen 2.5 14B (16GB GPU)"
  elif [ "${VRAM_GB}" -ge 8 ]; then
    DCP_MODEL="Qwen/Qwen2.5-7B-Instruct"
    DCP_MODEL_EXTRA_ARGS=""
    info "Selected: Qwen 2.5 7B (8GB+ GPU)"
  else
    fail "GPU has less than 8GB VRAM. Minimum: 8GB."
  fi

  # Allow override via env var
  if [ -n "${DCP_MODEL_OVERRIDE:-}" ]; then
    DCP_MODEL="${DCP_MODEL_OVERRIDE}"
    DCP_MODEL_EXTRA_ARGS="${DCP_MODEL_EXTRA_ARGS_OVERRIDE:-}"
    info "Model overridden to: ${DCP_MODEL}"
  fi
}

install_vllm() {
  if "${PYTHON_BIN}" -c "import vllm" 2>/dev/null; then
    info "vLLM already installed"
    return
  fi

  # Check for PyTorch first — vLLM needs it
  if ! "${PYTHON_BIN}" -c "import torch" 2>/dev/null; then
    info "Installing PyTorch with CUDA support..."
    "${PYTHON_BIN}" -m pip install torch --index-url https://download.pytorch.org/whl/cu121 -q 2>&1 | tail -3 || \
      "${PYTHON_BIN}" -m pip install torch -q 2>&1 | tail -3 || {
        warn "Could not install PyTorch. Install manually: pip install torch"
        return 1
      }
    success "PyTorch installed"
  else
    info "PyTorch already installed"
  fi

  info "Installing vLLM (this may take a few minutes)..."
  "${PYTHON_BIN}" -m pip install vllm -q 2>&1 | tail -3 || \
    "${PYTHON_BIN}" -m pip install --user vllm -q 2>&1 | tail -3 || \
    "${PYTHON_BIN}" -m pip install --break-system-packages vllm -q 2>&1 | tail -3 || {
      warn "Could not install vLLM automatically."
      warn "Install manually: pip install vllm"
      return 1
    }
  success "vLLM installed"
}

start_vllm() {
  # Check if vLLM is already running on port 8000
  if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    info "vLLM already running on port 8000"
    # Get the model name from the running instance
    local running_model
    running_model="$(curl -s http://localhost:8000/v1/models 2>/dev/null | "${PYTHON_BIN}" -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])" 2>/dev/null || echo "")"
    if [ -n "${running_model}" ]; then
      DCP_MODEL="${running_model}"
      info "Running model: ${DCP_MODEL}"
    fi
    return
  fi

  select_model_for_vram

  info "Starting vLLM with ${DCP_MODEL}..."
  info "This will download the model weights on first run (may take several minutes)"

  local vllm_log="${LOG_DIR}/vllm.log"
  mkdir -p "${LOG_DIR}"

  # Start vLLM in background
  nohup "${PYTHON_BIN}" -m vllm.entrypoints.openai.api_server \
    --model "${DCP_MODEL}" \
    --host 0.0.0.0 \
    --port 8000 \
    ${DCP_MODEL_EXTRA_ARGS} \
    > "${vllm_log}" 2>&1 &

  local vllm_pid=$!
  echo "${vllm_pid}" > "${INSTALL_DIR}/vllm.pid"
  info "vLLM starting (PID ${vllm_pid}), waiting for health check..."

  # Wait for vLLM to become healthy (up to 10 minutes for model download)
  local attempts=0
  local max_attempts=120
  while [ "${attempts}" -lt "${max_attempts}" ]; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
      success "vLLM is ready — serving ${DCP_MODEL}"
      return
    fi
    # Check if process is still alive
    if ! kill -0 "${vllm_pid}" 2>/dev/null; then
      warn "vLLM process died. Check logs: ${vllm_log}"
      tail -5 "${vllm_log}" 2>/dev/null || true
      fail "vLLM failed to start. Check ${vllm_log} for details."
    fi
    attempts=$((attempts + 1))
    sleep 5
  done
  warn "vLLM did not become healthy within 10 minutes."
  warn "It may still be downloading the model. Check: tail -f ${vllm_log}"
  warn "Once healthy, restart the daemon: systemctl restart dcp-provider"
}

detect_endpoint_url() {
  # For cloud GPUs, figure out the public endpoint URL
  if [ -n "${VLLM_ENDPOINT_URL:-}" ]; then
    return
  fi

  # RunPod: construct from pod ID
  if [ -n "${RUNPOD_POD_ID:-}" ]; then
    VLLM_ENDPOINT_URL="https://${RUNPOD_POD_ID}-8000.proxy.runpod.net"
    info "RunPod endpoint: ${VLLM_ENDPOINT_URL}"
    return
  fi

  # Try to auto-detect from RunPod hostname pattern
  local pod_hostname
  pod_hostname="$(hostname 2>/dev/null || echo "")"
  if echo "${pod_hostname}" | grep -qE '^[0-9a-f]{12}$'; then
    # Looks like a RunPod container ID, but we need the pod ID
    # Check if RUNPOD_POD_ID is in environment
    if [ -n "${RUNPOD_POD_ID:-}" ]; then
      VLLM_ENDPOINT_URL="https://${RUNPOD_POD_ID}-8000.proxy.runpod.net"
      info "RunPod endpoint: ${VLLM_ENDPOINT_URL}"
      return
    fi
  fi

  # Cloud but can't auto-detect — ask the user
  if [ "${IS_CLOUD:-false}" = "true" ]; then
    echo ""
    info "Could not auto-detect your public endpoint URL."
    info "Your vLLM server needs to be reachable from the internet."
    info "Examples:"
    info "  RunPod:  https://<pod-id>-8000.proxy.runpod.net"
    info "  Lambda:  http://<instance-ip>:8000"
    echo ""
    if [ -r /dev/tty ]; then
      read -r -p "  Enter your vLLM endpoint URL (or press Enter to set later): " VLLM_ENDPOINT_URL </dev/tty
    fi
    if [ -n "${VLLM_ENDPOINT_URL:-}" ]; then
      success "Endpoint URL set: ${VLLM_ENDPOINT_URL}"
    else
      info "Set it later at dcp.sa/provider/settings"
    fi
  fi
}

download_daemon() {
  mkdir -p "${INSTALL_DIR}" "${LOG_DIR}"
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "${tmp}"' RETURN

  local primary_url fallback_url
  primary_url="${API_BASE}/api/providers/download/daemon?key=${DCP_PROVIDER_KEY}"
  fallback_url="${API_BASE}/daemon?key=${DCP_PROVIDER_KEY}"

  if curl -fsSL "${primary_url}" -o "${tmp}"; then
    :
  elif curl -fsSL "${fallback_url}" -o "${tmp}"; then
    warn "Using fallback daemon endpoint: ${fallback_url}"
  else
    fail "Failed to download daemon from ${API_BASE}."
  fi

  mv "${tmp}" "${DAEMON_PATH}"
  chmod +x "${DAEMON_PATH}"
  info "Daemon downloaded to ${DAEMON_PATH}."
}

restart_nohup_daemon() {
  local old_pid=""

  # Prefer tracked PID, then try process lookup for idempotent restarts.
  if [ -f "${PID_FILE}" ]; then
    old_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  fi
  if [ -z "${old_pid}" ]; then
    old_pid="$(pgrep -f "${DAEMON_PATH}" | head -n 1 || true)"
  fi
  if [ -n "${old_pid}" ] && kill -0 "${old_pid}" >/dev/null 2>&1; then
    info "Stopping existing daemon process (${old_pid})."
    kill "${old_pid}" >/dev/null 2>&1 || true
    sleep 1
  fi

  DCP_API_KEY="${DCP_PROVIDER_KEY}" DCP_API_URL="${API_BASE}" VLLM_ENDPOINT_URL="${VLLM_ENDPOINT_URL:-}" nohup "${PYTHON_BIN}" "${DAEMON_PATH}" >> "${LOG_DIR}/daemon.log" 2>> "${LOG_DIR}/daemon-error.log" &
  echo $! > "${PID_FILE}"
  info "Daemon started in background (pid: $(cat "${PID_FILE}"))."
}

setup_linux_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    warn "systemctl not found. Falling back to background process mode."
    restart_nohup_daemon
    return
  fi

  if [ "${DCP_SYSTEMD_MODE}" = "system" ]; then
    step "Installing systemd system service (requires sudo)"
    local tmp_unit
    tmp_unit="$(mktemp)"
    cat > "${tmp_unit}" <<UNIT
[Unit]
Description=DCP Provider Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${CONFIG_DIR}/env
ExecStart=${PYTHON_BIN} ${DAEMON_PATH}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
    if command -v sudo >/dev/null 2>&1; then
      sudo cp "${tmp_unit}" "${SYSTEMD_SYSTEM_UNIT}"
      sudo systemctl daemon-reload
      if sudo systemctl is-active --quiet dcp-provider; then
        sudo systemctl restart dcp-provider
        info "Existing system service restarted."
      else
        sudo systemctl enable --now dcp-provider
        info "System service enabled and started."
      fi
    else
      rm -f "${tmp_unit}"
      fail "DCP_SYSTEMD_MODE=system requires sudo installed."
    fi
    rm -f "${tmp_unit}"
    return
  fi

  step "Installing systemd user service"
  mkdir -p "${SYSTEMD_USER_UNIT_DIR}"
  cat > "${SYSTEMD_USER_UNIT}" <<UNIT
[Unit]
Description=DCP Provider Daemon (user)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${CONFIG_DIR}/env
ExecStart=${PYTHON_BIN} ${DAEMON_PATH}
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

  if systemctl --user daemon-reload >/dev/null 2>&1; then
    if systemctl --user is-active --quiet dcp-provider; then
      systemctl --user restart dcp-provider
      info "Existing user service restarted."
    else
      systemctl --user enable --now dcp-provider
      info "User service enabled and started."
    fi
  else
    warn "systemd user session unavailable. Falling back to background process mode."
    restart_nohup_daemon
  fi
}

setup_macos_launchagent() {
  step "Installing macOS LaunchAgent"
  mkdir -p "$(dirname "${LAUNCHD_PLIST}")" "${LOG_DIR}"

  cat > "${LAUNCHD_PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON_BIN}</string>
    <string>${DAEMON_PATH}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DCP_API_KEY</key>
    <string>${DCP_PROVIDER_KEY}</string>
    <key>DCP_API_URL</key>
    <string>${API_BASE}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/daemon-error.log</string>
</dict>
</plist>
PLIST

  launchctl bootout "gui/$(id -u)" "${LAUNCHD_PLIST}" >/dev/null 2>&1 || true
  if launchctl bootstrap "gui/$(id -u)" "${LAUNCHD_PLIST}" >/dev/null 2>&1; then
    :
  else
    launchctl load -w "${LAUNCHD_PLIST}" >/dev/null 2>&1 || true
  fi
  launchctl kickstart -k "gui/$(id -u)/${LAUNCHD_LABEL}" >/dev/null 2>&1 || true
  info "LaunchAgent loaded and restarted."
}

setup_macos_menubar() {
  step "Installing DCP menu bar monitor"
  local menubar_path="${INSTALL_DIR}/dcp_menubar.py"
  local menubar_url="${API_BASE}/api/providers/download/menubar"
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "${tmp}"' RETURN

  if curl -fsSL "${menubar_url}" -o "${tmp}" 2>/dev/null; then
    mv "${tmp}" "${menubar_path}"
    chmod +x "${menubar_path}"
  else
    warn "Could not download menu bar app. Skipping."
    rm -f "${tmp}"
    return
  fi

  # Install rumps + requests if needed
  "${PYTHON_BIN}" -c "import rumps" 2>/dev/null || {
    info "Installing menu bar dependencies (rumps, requests)…"
    "${PYTHON_BIN}" -m pip install rumps requests -q 2>/dev/null || \
      "${PYTHON_BIN}" -m pip install --user rumps requests -q 2>/dev/null || \
      "${PYTHON_BIN}" -m pip install --break-system-packages rumps requests -q 2>/dev/null || {
        warn "Could not install rumps. Menu bar app will install deps on first launch."
      }
  }

  # Create a LaunchAgent to start the menu bar app at login
  local mb_label="com.dcp.provider.menubar"
  local mb_plist="${HOME}/Library/LaunchAgents/${mb_label}.plist"
  mkdir -p "$(dirname "${mb_plist}")"

  cat > "${mb_plist}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${mb_label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON_BIN}</string>
    <string>${menubar_path}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/menubar.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/menubar-error.log</string>
</dict>
</plist>
PLIST

  # Load (or reload) the menu bar agent
  launchctl bootout "gui/$(id -u)" "${mb_plist}" >/dev/null 2>&1 || true
  if launchctl bootstrap "gui/$(id -u)" "${mb_plist}" >/dev/null 2>&1; then
    :
  else
    launchctl load -w "${mb_plist}" >/dev/null 2>&1 || true
  fi
  info "Menu bar monitor installed and launched."
}

fetch_provider_id_if_missing() {
  if [ -n "${DCP_PROVIDER_ID}" ]; then
    return
  fi

  local me_response
  me_response="$(curl -sS "${API_BASE}/api/providers/me?key=${DCP_PROVIDER_KEY}" || true)"
  DCP_PROVIDER_ID="$(json_get_number "${me_response}" "id")"
}

step "DCP Provider setup starting"
info "API base: ${API_BASE}"
info "Detected OS: ${DCP_OS}"

load_config

step "Detecting GPU"
detect_gpu
info "GPU model: ${GPU_MODEL}"
info "VRAM (GB): ${VRAM_GB}"

step "Ensuring Python runtime"
ensure_python
info "Python: ${PYTHON_BIN}"

step "Provider registration"
register_provider_if_needed

step "Saving local config"
write_config
info "Config saved at ${CONFIG_FILE}"

step "Detecting environment"
IS_CLOUD=false
# RunPod detection
if [ -n "${RUNPOD_POD_ID:-}" ] || [ -f /etc/runpod.conf ] || hostname 2>/dev/null | grep -qE '^[0-9a-f]{12}$'; then
  IS_CLOUD=true
  info "Cloud GPU detected (RunPod)"
# Lambda Labs detection
elif [ -n "${LAMBDA_NODE_ID:-}" ] || [ -d /opt/lambda ]; then
  IS_CLOUD=true
  info "Cloud GPU detected (Lambda Labs)"
# Generic Docker/container detection
elif [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
  IS_CLOUD=true
  info "Containerized environment detected"
# Manual override
elif [ "${DCP_CLOUD_GPU:-}" = "true" ]; then
  IS_CLOUD=true
  info "Cloud GPU mode (manual override)"
else
  info "Local/home GPU detected"
fi

if [ "${IS_CLOUD}" = "false" ]; then
  step "Setting up WireGuard VPN"
  setup_wireguard
fi

step "Setting up inference server"
install_vllm
start_vllm

if [ "${IS_CLOUD}" = "true" ]; then
  step "Configuring cloud endpoint"
  detect_endpoint_url
fi

step "Downloading daemon"
download_daemon

if [ "${DCP_OS}" = "mac" ]; then
  setup_macos_launchagent
  setup_macos_menubar
else
  setup_linux_service
fi

step "Finalizing"
fetch_provider_id_if_missing
write_config

printf '\n%s\n' "============================================"
printf '%s\n' "  DCP Provider is LIVE"
printf '%s\n' "============================================"
echo ""
info "Provider ID:  ${DCP_PROVIDER_ID:-unknown}"
info "GPU:          ${GPU_MODEL} (${VRAM_GB}GB)"
info "Model:        ${DCP_MODEL:-unknown}"
info "Status:       Heartbeating every 30s"
if [ -n "${VLLM_ENDPOINT_URL:-}" ]; then
  info "Endpoint:     ${VLLM_ENDPOINT_URL}"
fi
info "Dashboard:    https://dcp.sa/provider"
info "Daemon logs:  ${LOG_DIR}/daemon.log"
info "vLLM logs:    ${LOG_DIR}/vllm.log"
echo ""
