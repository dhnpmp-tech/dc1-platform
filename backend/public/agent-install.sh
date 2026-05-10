#!/usr/bin/env bash
# DCP Agent — one-line bootstrap installer.
#
# Pulls the DCP Agent (Hermes fork) from GitHub, sets up a venv, saves the
# install token, and launches the agent gateway. From there the agent itself
# orchestrates everything: detects GPU, installs/checks Ollama, sets up
# WireGuard, registers with api.dcp.sa, and enters the always-on loop.
#
# Provider runs ONE command:
#   curl -sSL https://api.dcp.sa/install/agent | bash -s -- --token TOKEN
#
# After it finishes, the provider opens http://localhost:8642 in their
# browser and talks to the agent via the LIVE / CHAT tabs. The agent
# narrates everything it does and self-heals when something breaks.
#
# Linux + macOS supported. Windows uses a separate path.

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────
# DCP Agent code is served as a tarball from api.dcp.sa (the underlying repo
# is private; the backend keeps an up-to-date copy in installers/). Override
# DCP_AGENT_TARBALL for testing against staging.
DCP_AGENT_TARBALL="${DCP_AGENT_TARBALL:-https://api.dcp.sa/installers/dcp-agent.tar.gz}"
DCP_HOME="${DCP_HOME:-${HOME}/.dcp}"
AGENT_DIR="${DCP_HOME}/agent"
AGENT_REPO_DIR="${AGENT_DIR}/repo"
AGENT_VENV="${AGENT_DIR}/.venv"
TOKEN_FILE="${DCP_HOME}/install_token"
LOG_FILE="${DCP_HOME}/install.log"

# ── Inputs ───────────────────────────────────────────────────────────────
TOKEN=""
PROVIDER_KEY=""
NO_LAUNCH=0
while [ $# -gt 0 ]; do
  case "$1" in
    --token|-t)      TOKEN="${2:-}"; shift 2 ;;
    --api-key|-k)    PROVIDER_KEY="${2:-}"; shift 2 ;;
    --no-launch)     NO_LAUNCH=1; shift ;;
    -h|--help)
      cat <<USAGE
DCP Agent installer.

Usage:
  curl -sSL https://api.dcp.sa/install/agent | bash -s -- --token TOKEN

Flags:
  --token TOKEN     install token from dcp.sa/setup (preferred)
  --api-key KEY     existing provider api_key (alternative to token)
  --no-launch       install only, don't start the agent

The agent does the rest — checks Ollama, WireGuard, GPU; installs what's
missing; registers your provider; and then runs always-on. Open
http://localhost:8642 once it's up to chat with it.
USAGE
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ -z "${TOKEN}" ] && [ -z "${PROVIDER_KEY}" ]; then
  echo "ERROR: --token or --api-key required."
  echo "Get a token from https://dcp.sa/setup."
  exit 1
fi

# ── Pretty logging ───────────────────────────────────────────────────────
mkdir -p "${DCP_HOME}"
exec > >(tee -a "${LOG_FILE}") 2>&1
say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[1;33m!\033[0m %s\n" "$*"; }
fail() { printf "  \033[1;31m✗\033[0m %s\n" "$*"; exit 1; }

cat <<'BANNER'

  ┌──────────────────────────────────────────────┐
  │                                              │
  │           DCP Agent — bootstrap              │
  │                                              │
  │  After this script: agent takes over.        │
  │  Open http://localhost:8642 to chat with it. │
  │                                              │
  └──────────────────────────────────────────────┘

BANNER

# ── 1. Detect platform ───────────────────────────────────────────────────
say "Detecting platform"
case "$(uname -s)" in
  Linux*)  PLATFORM=linux ;;
  Darwin*) PLATFORM=mac ;;
  *) fail "Unsupported OS. Linux and macOS only for this installer." ;;
esac
ARCH="$(uname -m)"
ok "Platform: ${PLATFORM} (${ARCH})"

# ── 2. Find / install Python 3.11+ ───────────────────────────────────────
say "Locating Python 3.11+"
PY=""
for cand in python3.13 python3.12 python3.11 python3; do
  if command -v "$cand" >/dev/null 2>&1; then
    ver=$("$cand" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    major=${ver%.*}
    minor=${ver#*.}
    if [ "$major" -ge 3 ] && [ "$minor" -ge 11 ]; then
      PY="$(command -v "$cand")"
      break
    fi
  fi
done

if [ -z "${PY}" ]; then
  warn "Python 3.11+ not found — installing"

  # Pre-flight: confirm sudo can actually elevate. If we're piped through
  # bash via curl with no controlling tty, sudo's password prompt breaks
  # silently — better to detect early and tell the user how to recover.
  SUDO=""
  if [ "$(id -u)" = "0" ]; then
    SUDO=""
  elif sudo -n true 2>/dev/null; then
    SUDO="sudo -n"
  elif [ -t 0 ] || [ -t 1 ]; then
    SUDO="sudo"
  else
    cat <<'NOTTY' >&2
ERROR: This installer needs sudo to install Python 3.11, but the curl-pipe-bash
shell has no controlling terminal, so sudo can't prompt for your password.
Run instead:

  curl -sSL https://api.dcp.sa/install/agent -o /tmp/dcp.sh
  chmod +x /tmp/dcp.sh
  sudo /tmp/dcp.sh --api-key YOUR_KEY

(Or run as root.)
NOTTY
    exit 1
  fi

  if [ "${PLATFORM}" = linux ]; then
    if command -v apt-get >/dev/null 2>&1; then
      # Distro detection — Ubuntu 22.04 ships python3.10; Python 3.11
      # lives in the deadsnakes PPA. Ubuntu 24.04+ has 3.12 in main.
      DISTRO="$(. /etc/os-release 2>/dev/null && echo "${ID:-unknown}")"
      DISTRO_VER="$(. /etc/os-release 2>/dev/null && echo "${VERSION_ID:-0}")"
      ${SUDO} apt-get update -qq
      ${SUDO} apt-get install -y -qq software-properties-common ca-certificates curl gnupg
      # Try to install python3.11 from default repos; if that fails on
      # Ubuntu/Debian, add the deadsnakes PPA and try again.
      if ! ${SUDO} apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip 2>/dev/null; then
        if [ "${DISTRO}" = "ubuntu" ] || [ "${DISTRO}" = "debian" ]; then
          warn "python3.11 not in default repos — adding deadsnakes PPA"
          ${SUDO} add-apt-repository -y ppa:deadsnakes/ppa 2>&1 | tail -3 || true
          ${SUDO} apt-get update -qq
          ${SUDO} apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip || \
            fail "deadsnakes install failed — try Ubuntu 24.04 (python3.12 native) or install Python 3.11 manually."
        else
          fail "Could not install Python 3.11 from default repos on ${DISTRO}. Install manually and re-run."
        fi
      fi
      PY="$(command -v python3.11)"
    elif command -v dnf >/dev/null 2>&1; then
      ${SUDO} dnf install -y python3.11 python3.11-devel python3-pip
      PY="$(command -v python3.11)"
    elif command -v pacman >/dev/null 2>&1; then
      ${SUDO} pacman -Sy --noconfirm python python-pip
      PY="$(command -v python3)"
    else
      fail "No supported package manager (apt-get / dnf / pacman). Install Python 3.11+ manually and re-run."
    fi
  else
    if command -v brew >/dev/null 2>&1; then
      brew install python@3.12
      PY="$(brew --prefix)/bin/python3.12"
    else
      fail "Homebrew required on macOS. Install from brew.sh and re-run."
    fi
  fi
fi

# Belt-and-suspenders: even if Python 3.11 was already present, verify
# the venv module works (some distros ship python3 without -venv).
if ! "${PY}" -c 'import venv, ensurepip' 2>/dev/null; then
  warn "${PY} missing venv/ensurepip module — installing"
  if [ "${PLATFORM}" = linux ] && command -v apt-get >/dev/null 2>&1; then
    PYVER="$("${PY}" -c 'import sys; print(f"python{sys.version_info.major}.{sys.version_info.minor}")')"
    ${SUDO:-sudo} apt-get install -y -qq "${PYVER}-venv" "${PYVER}-dev" || \
      fail "Could not install ${PYVER}-venv. Install manually."
  fi
fi
ok "Python: ${PY} ($("${PY}" --version))"

# ── 3. git + curl + tar present (auto-install if missing) ───────────────
say "Verifying git + curl + tar"
MISSING=""
command -v git  >/dev/null 2>&1 || MISSING="${MISSING} git"
command -v curl >/dev/null 2>&1 || MISSING="${MISSING} curl"
command -v tar  >/dev/null 2>&1 || MISSING="${MISSING} tar"
if [ -n "${MISSING}" ]; then
  warn "Missing:${MISSING} — installing"
  if [ "${PLATFORM}" = linux ]; then
    if command -v apt-get >/dev/null 2>&1; then
      ${SUDO:-sudo} apt-get install -y -qq ${MISSING} || fail "apt-get install${MISSING} failed"
    elif command -v dnf >/dev/null 2>&1; then
      ${SUDO:-sudo} dnf install -y ${MISSING} || fail "dnf install${MISSING} failed"
    elif command -v pacman >/dev/null 2>&1; then
      ${SUDO:-sudo} pacman -Sy --noconfirm ${MISSING} || fail "pacman install${MISSING} failed"
    else
      fail "No supported package manager — install${MISSING} manually and re-run."
    fi
  else
    if command -v brew >/dev/null 2>&1; then
      brew install ${MISSING} || fail "brew install${MISSING} failed"
    else
      fail "Homebrew required on macOS — install from brew.sh."
    fi
  fi
fi
ok "git + curl + tar present."

# ── 4. Save the install token ────────────────────────────────────────────
say "Saving install credentials"
if [ -n "${TOKEN}" ]; then
  printf '%s' "${TOKEN}" > "${TOKEN_FILE}"
  chmod 600 "${TOKEN_FILE}"
  ok "Install token written to ${TOKEN_FILE}"
fi
if [ -n "${PROVIDER_KEY}" ]; then
  printf 'DCP_PROVIDER_KEY=%s\n' "${PROVIDER_KEY}" > "${DCP_HOME}/env"
  chmod 600 "${DCP_HOME}/env"
  ok "Provider API key written to ${DCP_HOME}/env"
  # Also drop a token-equivalent marker so the agent's first-run
  # orchestration triggers on api-key installs (existing providers
  # re-installing). The provider-registration skill reads either.
  if [ -z "${TOKEN}" ] && [ ! -f "${TOKEN_FILE}" ]; then
    printf 'apikey:%s' "${PROVIDER_KEY}" > "${TOKEN_FILE}"
    chmod 600 "${TOKEN_FILE}"
    ok "First-run orchestration marker set"
  fi
fi

# ── 5. Download + extract dcp-agent ──────────────────────────────────────
say "Downloading DCP Agent code"
mkdir -p "${AGENT_DIR}"
TARBALL_TMP="$(mktemp -t dcp-agent.XXXXXX.tar.gz)"
curl -fsSL "${DCP_AGENT_TARBALL}" -o "${TARBALL_TMP}" || fail "Could not download ${DCP_AGENT_TARBALL}"
rm -rf "${AGENT_REPO_DIR}"
mkdir -p "${AGENT_REPO_DIR}"
tar xzf "${TARBALL_TMP}" -C "${AGENT_REPO_DIR}" --strip-components=1 || fail "Tarball extract failed"
rm -f "${TARBALL_TMP}"
ok "Agent code at ${AGENT_REPO_DIR}"

# ── 6. Create venv + install agent ───────────────────────────────────────
say "Setting up Python venv"
if [ ! -d "${AGENT_VENV}" ]; then
  "${PY}" -m venv "${AGENT_VENV}"
fi
"${AGENT_VENV}/bin/pip" install --quiet --upgrade pip wheel setuptools

say "Installing DCP Agent (this takes 1–2 min)"
"${AGENT_VENV}/bin/pip" install --quiet "${AGENT_REPO_DIR}"
ok "Agent installed."

# ── 6b. Wire Hermes brain to our gateway (no MiniMax key on this box) ────
# Hermes' built-in `minimax` provider posts Anthropic-format requests to
# <MINIMAX_BASE_URL>/v1/messages. Pointing at our gateway means:
#   • The MiniMax subscription key never leaves the VPS.
#   • We can swap the brain (Claude / in-house / OpenRouter) by editing
#     UPSTREAMS in routes/agent-gateway.js — no client redeploy.
#   • All provider agent traffic is observable centrally.
say "Wiring Hermes brain through api.dcp.sa gateway"
mkdir -p "${HOME}/.hermes"
HERMES_ENV="${HOME}/.hermes/.env"
HERMES_CONFIG="${HOME}/.hermes/config.yaml"
# Effective auth value sent to MiniMax's Anthropic-compat surface: the
# DCP gateway *strips* this header and re-signs with its server-side
# MINIMAX_AGENT_KEY, so any non-empty value is fine here. We send the
# provider's DCP key when present so server-side telemetry can attribute
# usage to a provider; otherwise a placeholder.
EFFECTIVE_KEY="${PROVIDER_KEY:-dcp-bootstrap-no-key}"
{
  echo "# Generated by agent-install.sh — do not edit; re-run installer."
  echo "MINIMAX_BASE_URL=https://api.dcp.sa/api/agent/gateway"
  echo "MINIMAX_API_KEY=${EFFECTIVE_KEY}"
  if [ -n "${PROVIDER_KEY}" ]; then
    echo "DCP_PROVIDER_KEY=${PROVIDER_KEY}"
  fi
  echo "DCP_API_BASE=https://api.dcp.sa"
  echo "# Yolo approvals so first-run-orchestration runs unattended."
  echo "HERMES_AUTO_APPROVE=1"
} > "${HERMES_ENV}"
chmod 600 "${HERMES_ENV}"

# config.yaml — match Peter's verified-working setup on macOS exactly:
# top-level `model: <name>` + a custom `providers.dcp-gateway` block
# using OpenAI chat-completions API pointed at our gateway. The
# built-in `minimax` overlay uses Anthropic-format which routes to a
# different upstream URL we don't want. The placeholder apiKey is fine
# because our gateway re-signs with the server-side MINIMAX_AGENT_KEY.
cat > "${HERMES_CONFIG}" <<'YAMLEOF'
model: MiniMax-M2.7-highspeed
approvals:
  mode: yolo
  timeout: 60
  cron_mode: allow
command_allowlist:
  - '*'
hooks_auto_accept: true
agent:
  api_max_retries: 3
  max_turns: 50
YAMLEOF
chmod 600 "${HERMES_CONFIG}"

# auth.json — load-bearing for hermes -z (oneshot) and for the agent
# loop in general. Hermes reads credential_pool.minimax[0] to find the
# MiniMax provider's auth + base URL. Peter's verified-working entry on
# macOS (2026-05-06) has shape:
#   { id, label, auth_type: 'api_key', priority: 0, source, access_token,
#     base_url, request_count: 0 }
# We point base_url at our gateway and use the provider's DCP key as
# access_token — the gateway ignores incoming auth and re-signs with
# the server-side MINIMAX_AGENT_KEY upstream. Provider's machine never
# holds the MiniMax key.
HERMES_AUTH="${HOME}/.hermes/auth.json"
CRED_TOKEN="${PROVIDER_KEY:-dcp-bootstrap-no-key}"
"${PY}" - <<PYAUTH
import json, os, secrets, datetime
path = os.path.expanduser('${HERMES_AUTH}')
entry = {
    'id': secrets.token_hex(3),
    'label': 'DCP_PROVIDER_KEY',
    'auth_type': 'api_key',
    'priority': 0,
    'source': 'dcp-installer:auth.json',
    'access_token': '${CRED_TOKEN}',
    'last_status': None,
    'last_status_at': None,
    'last_error_code': None,
    'last_error_reason': None,
    'last_error_message': None,
    'last_error_reset_at': None,
    # Trailing /anthropic triggers Hermes' anthropic_messages transport
    # (runtime_provider.py:_detect_api_mode_for_url). Without it Hermes
    # falls back to chat_completions and gets a response shape it can't
    # parse → "(empty)" sentinel. Gateway aliases this to /v1/messages.
    'base_url': 'https://api.dcp.sa/api/agent/gateway/anthropic',
    'request_count': 0,
}
auth = {
    'version': 1,
    'providers': {},
    'credential_pool': {'minimax': [entry]},
    'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
with open(path, 'w') as f:
    json.dump(auth, f, indent=2)
os.chmod(path, 0o600)
print('auth.json written:', path)
PYAUTH

ok "Brain endpoint set: api.dcp.sa/api/agent/gateway (provider=minimax, yolo)"

# ── 7. WireGuard userland tools (kernel module is in-tree on modern Linux) ─
say "Checking WireGuard tools"
if ! command -v wg-quick >/dev/null 2>&1; then
  warn "wg-quick not installed — installing"
  if [ "${PLATFORM}" = linux ] && command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y -qq wireguard-tools
  elif [ "${PLATFORM}" = mac ] && command -v brew >/dev/null 2>&1; then
    brew install wireguard-tools
  else
    warn "Install wireguard-tools manually if the agent reports tunnel issues."
  fi
fi
command -v wg-quick >/dev/null 2>&1 && ok "WireGuard tools present."

# ── 8. Hand off to the agent ─────────────────────────────────────────────
if [ "${NO_LAUNCH}" = 1 ]; then
  cat <<NEXT

  Install complete (no-launch mode). Start the agent yourself with:

    ${AGENT_VENV}/bin/hermes gateway run

  Or, after activating the venv:

    source ${AGENT_VENV}/bin/activate
    hermes gateway run

NEXT
  exit 0
fi

cat <<HANDOFF

  ┌──────────────────────────────────────────────┐
  │                                              │
  │  Bootstrap done. Starting DCP Agent…         │
  │                                              │
  │  Open this in your browser:                  │
  │      http://localhost:8642                   │
  │                                              │
  │  Tabs:                                       │
  │    • LIVE — what the agent is doing now      │
  │    • CHAT — talk to it directly              │
  │                                              │
  │  The agent reads ${TOKEN_FILE}      │
  │  on first run, finishes registration,        │
  │  and enters always-on mode. You don't need   │
  │  to do anything else.                        │
  │                                              │
  │  Stop with Ctrl+C. Logs at ${LOG_FILE}  │
  │                                              │
  └──────────────────────────────────────────────┘

HANDOFF

# Launch in foreground so the operator sees gateway logs. The agent's
# boot-sequence skill drives first-run-setup → provider-registration →
# always-on by reading $TOKEN_FILE / $DCP_HOME/env.
exec "${AGENT_VENV}/bin/hermes" gateway run
