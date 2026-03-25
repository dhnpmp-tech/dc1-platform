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
  [ -n "${env_key}" ] && DCP_PROVIDER_KEY="${env_key}"
  [ -n "${env_id}" ] && DCP_PROVIDER_ID="${env_id}"
  [ -n "${env_email}" ] && DCP_PROVIDER_EMAIL="${env_email}"
  [ -n "${env_name}" ] && DCP_PROVIDER_NAME="${env_name}"
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
    info "Existing provider key found; skipping registration."
    return
  fi

  [ -n "${DCP_PROVIDER_NAME}" ] || DCP_PROVIDER_NAME="$(hostname 2>/dev/null || whoami)"

  if [ -z "${DCP_PROVIDER_EMAIL}" ] && [ -r /dev/tty ]; then
    read -r -p "Enter provider email: " DCP_PROVIDER_EMAIL </dev/tty
  fi
  [ -n "${DCP_PROVIDER_EMAIL}" ] || fail "DCP_PROVIDER_EMAIL is required for auto-registration."

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

  nohup "${PYTHON_BIN}" "${DAEMON_PATH}" >> "${LOG_DIR}/daemon.log" 2>> "${LOG_DIR}/daemon-error.log" &
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

step "Downloading daemon"
download_daemon

if [ "${DCP_OS}" = "mac" ]; then
  setup_macos_launchagent
else
  setup_linux_service
fi

step "Finalizing"
fetch_provider_id_if_missing
write_config

if [ -n "${DCP_PROVIDER_ID}" ]; then
  printf '\n%s\n' "✓ DCP Provider setup complete! Your provider ID: ${DCP_PROVIDER_ID}"
else
  printf '\n%s\n' "✓ DCP Provider setup complete! Your provider ID: unknown"
fi

info "Provider key saved to ${CONFIG_FILE}"
info "Daemon path: ${DAEMON_PATH}"
info "Log path: ${LOG_DIR}/daemon.log"
if [ "${DCP_OS}" = "linux" ]; then
  info "Optional system service mode: DCP_SYSTEMD_MODE=system (uses sudo)"
fi
