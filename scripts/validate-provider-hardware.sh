#!/bin/bash
#
# Provider Hardware Validation Script
# Sprint 27: Verify provider GPU, Docker, and storage readiness for model serving
#
# Usage:
#   ./validate-provider-hardware.sh
#   ./validate-provider-hardware.sh --tier tier_a
#   ./validate-provider-hardware.sh --verbose
#

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

# Configuration
VALIDATION_TIER="${1:-tier_a}"
VERBOSE="${VERBOSE:-0}"
PORTFOLIO_FILE="${DCP_ARABIC_PORTFOLIO_FILE:-$REPO_ROOT/infra/config/arabic-portfolio.json}"
CACHE_ROOT="${DCP_MODEL_CACHE_ROOT:-/opt/dcp/model-cache}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

log() {
  printf '%s\n' "$1"
}

info() {
  printf "${BLUE}ℹ${NC} %s\n" "$1"
}

pass() {
  printf "${GREEN}✓${NC} %s\n" "$1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

warn() {
  printf "${YELLOW}⚠${NC} %s\n" "$1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
  printf "${RED}✗${NC} %s\n" "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

header() {
  printf "\n${BLUE}=== %s ===${NC}\n" "$1"
}

# ============================================================================
# VALIDATION CHECKS
# ============================================================================

validate_docker() {
  header "Docker Runtime"

  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker not installed"
    return 1
  fi
  pass "Docker executable found"

  if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon not reachable"
    return 1
  fi
  pass "Docker daemon responsive"

  local docker_version
  docker_version=$(docker --version | grep -oP '\d+\.\d+')
  if [[ "$docker_version" =~ ^[2-9]\.[0-9]+ ]] || [[ "$docker_version" =~ ^1\.[2-9][0-9] ]]; then
    pass "Docker version $docker_version (20.10+ compatible)"
  else
    warn "Docker version $docker_version (recommend 20.10+)"
  fi

  # Check docker-compose
  if command -v docker-compose >/dev/null 2>&1; then
    local compose_version
    compose_version=$(docker-compose --version | grep -oP '\d+\.\d+' | head -1)
    pass "docker-compose version $compose_version"
  elif docker compose version >/dev/null 2>&1; then
    pass "docker compose (v2) available"
  else
    warn "docker-compose not found (may be needed for multi-container deployments)"
  fi

  # Check docker volume
  local volume_name="${DCP_MODEL_CACHE_VOLUME:-dcp-model-cache}"
  if docker volume inspect "$volume_name" >/dev/null 2>&1; then
    pass "Docker volume '$volume_name' exists"
  else
    warn "Docker volume '$volume_name' not created (can be auto-created)"
  fi
}

validate_nvidia_gpu() {
  header "NVIDIA GPU"

  if ! command -v nvidia-smi >/dev/null 2>&1; then
    fail "nvidia-smi not found (NVIDIA driver not installed)"
    return 1
  fi
  pass "NVIDIA driver installed"

  # Get GPU count
  local gpu_count
  gpu_count=$(nvidia-smi --list-gpus | wc -l)
  if [ "$gpu_count" -eq 0 ]; then
    fail "No GPUs detected"
    return 1
  fi
  pass "Found $gpu_count GPU(s)"

  # Check CUDA version
  local cuda_version
  cuda_version=$(nvidia-smi | grep "CUDA Version" | grep -oP '\d+\.\d+')
  if [[ "$cuda_version" =~ ^1[2-9]\.[0-9] ]]; then
    pass "CUDA version $cuda_version (12.0+ compatible)"
  else
    warn "CUDA version $cuda_version (recommend 12.2+)"
  fi

  # Check each GPU
  info "GPU Details:"
  nvidia-smi --query-gpu=index,name,memory.total,driver_version \
    --format=csv,noheader,nounits | while IFS=',' read -r idx name mem driver; do
    local mem_gb=$((mem / 1024))
    printf "  GPU $idx: $name ($mem_gb GB) Driver: $driver\n"

    # Validate minimum VRAM for Tier A models
    if [[ "$VALIDATION_TIER" == "tier_a" ]]; then
      if [ "$mem_gb" -ge 24 ]; then
        pass "GPU $idx: ${mem_gb}GB VRAM sufficient for ALLaM/Falcon (24GB required)"
      elif [ "$mem_gb" -ge 16 ]; then
        warn "GPU $idx: ${mem_gb}GB VRAM sufficient for Qwen/Llama/Mistral (16GB), not ALLaM/Falcon"
      elif [ "$mem_gb" -ge 8 ]; then
        warn "GPU $idx: ${mem_gb}GB VRAM only for Nemotron Nano/BGE (8GB)"
      else
        fail "GPU $idx: ${mem_gb}GB VRAM too small for Tier A"
      fi
    fi
  done

  # Check for compute capability (Ampere or newer for optimal performance)
  local compute_cap
  compute_cap=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader,nounits | head -1)
  if [[ "$compute_cap" =~ ^[89] ]]; then
    pass "GPU compute capability $compute_cap (Ampere+ for optimal performance)"
  elif [[ "$compute_cap" =~ ^7 ]]; then
    warn "GPU compute capability $compute_cap (Turing, supported but older)"
  else
    fail "GPU compute capability $compute_cap (unsupported, requires 7.0+)"
  fi
}

validate_cuda_env() {
  header "CUDA Environment"

  if [ -z "${CUDA_HOME:-}" ]; then
    warn "CUDA_HOME not set (may not be needed if driver is recent)"
  else
    pass "CUDA_HOME=$CUDA_HOME"
  fi

  if command -v nvcc >/dev/null 2>&1; then
    local nvcc_version
    nvcc_version=$(nvcc --version | grep -oP 'release \K\d+\.\d+')
    pass "CUDA toolkit found (nvcc version $nvcc_version)"
  else
    warn "nvcc not found (CUDA toolkit may not be installed, may still work with driver only)"
  fi
}

validate_storage() {
  header "Storage & Disk Space"

  # Check if cache root exists
  if [ ! -d "$CACHE_ROOT" ]; then
    warn "Cache root '$CACHE_ROOT' does not exist yet (can be created on first run)"
    return 0
  fi
  pass "Cache root directory exists: $CACHE_ROOT"

  # Determine required space based on tier
  local required_gb=0
  if [[ "$VALIDATION_TIER" == "tier_a" ]]; then
    required_gb=125  # 104 GB models + 20% overhead
  elif [[ "$VALIDATION_TIER" == "tier_b" ]]; then
    required_gb=60   # 45 GB models + overhead
  else
    required_gb=125  # All tiers
  fi

  # Check available space
  local available_gb
  if command -v df >/dev/null 2>&1; then
    available_gb=$(df "$CACHE_ROOT" 2>/dev/null | awk 'NR==2 {printf "%.0f", $4 / 1024 / 1024}' || echo "unknown")
    if [ "$available_gb" != "unknown" ]; then
      if [ "$available_gb" -ge "$required_gb" ]; then
        pass "Available disk space: ${available_gb}GB (required: ${required_gb}GB)"
      elif [ "$available_gb" -ge $((required_gb / 2)) ]; then
        warn "Available disk space: ${available_gb}GB (required: ${required_gb}GB) — may be tight"
      else
        fail "Available disk space: ${available_gb}GB (required: ${required_gb}GB) — INSUFFICIENT"
      fi
    fi
  fi

  # Check disk write speed
  local test_file="$CACHE_ROOT/.dcp_write_speed_test"
  if [ -w "$CACHE_ROOT" ]; then
    local start
    start=$(date +%s%N)
    dd if=/dev/zero of="$test_file" bs=1M count=100 2>/dev/null
    local end
    end=$(date +%s%N)
    local elapsed_ms=$(((end - start) / 1000000))
    local speed_mb_s=$((100 * 1000 / elapsed_ms))
    rm -f "$test_file"

    if [ "$speed_mb_s" -ge 100 ]; then
      pass "Disk write speed: ${speed_mb_s}MB/s (adequate for prefetch)"
    elif [ "$speed_mb_s" -ge 50 ]; then
      warn "Disk write speed: ${speed_mb_s}MB/s (slower than optimal, prefetch may take longer)"
    else
      fail "Disk write speed: ${speed_mb_s}MB/s (too slow for prefetch)"
    fi
  else
    warn "Cannot write to cache root (may need sudo to test)"
  fi

  # Check directory structure
  for subdir in hf vllm tmp; do
    local path="$CACHE_ROOT/$subdir"
    if [ -d "$path" ]; then
      pass "Cache subdirectory exists: $subdir"
    else
      info "Cache subdirectory missing: $subdir (will be created on prefetch)"
    fi
  done
}

validate_networking() {
  header "Networking"

  # Check internet connectivity
  if command -v curl >/dev/null 2>&1; then
    if curl -s --max-time 3 "https://huggingface.co" >/dev/null 2>&1; then
      pass "Network connectivity to HuggingFace Hub verified"
    else
      fail "Cannot reach HuggingFace Hub (required for model downloads)"
    fi
  else
    warn "curl not found (cannot verify network connectivity)"
  fi

  # Check DNS
  if command -v nslookup >/dev/null 2>&1 || command -v host >/dev/null 2>&1; then
    if nslookup huggingface.co >/dev/null 2>&1 || host huggingface.co >/dev/null 2>&1; then
      pass "DNS resolution working"
    else
      fail "DNS resolution failure"
    fi
  fi
}

validate_software() {
  header "Additional Software"

  # Python (for portfolio parsing)
  if command -v python3 >/dev/null 2>&1; then
    local py_version
    py_version=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
    if [[ "$py_version" =~ ^3\.[8-9] ]] || [[ "$py_version" =~ ^3\.1[0-9] ]]; then
      pass "Python $py_version available"
    else
      warn "Python version $py_version (recommend 3.8+)"
    fi
  else
    warn "Python3 not found (needed for portfolio JSON parsing)"
  fi

  # Git (useful for version tracking)
  if command -v git >/dev/null 2>&1; then
    pass "Git available"
  else
    info "Git not found (optional)"
  fi
}

validate_permissions() {
  header "File Permissions"

  # Check cache root writability
  if [ -w "$CACHE_ROOT" ]; then
    pass "Cache root is writable"
  elif [ -d "$CACHE_ROOT" ]; then
    fail "Cache root is not writable (may need sudo)"
  fi

  # Check docker group
  if groups | grep -q docker; then
    pass "User is in docker group (can run docker without sudo)"
  else
    warn "User not in docker group (may need sudo for docker commands)"
  fi

  # Check if running as root
  if [ "$(id -u)" -eq 0 ]; then
    warn "Running as root (not recommended for production)"
  fi
}

# ============================================================================
# PORTFOLIO-BASED VALIDATION
# ============================================================================

validate_portfolio() {
  header "Arabic Portfolio Configuration"

  if [ ! -f "$PORTFOLIO_FILE" ]; then
    fail "Portfolio file not found: $PORTFOLIO_FILE"
    return 1
  fi
  pass "Portfolio file found"

  # Validate JSON
  if command -v python3 >/dev/null 2>&1; then
    if python3 -m json.tool "$PORTFOLIO_FILE" >/dev/null 2>&1; then
      pass "Portfolio JSON is valid"
    else
      fail "Portfolio JSON is invalid"
      return 1
    fi
  fi

  # Parse tier info
  if [ "$VERBOSE" = "1" ]; then
    info "Models in tier '$VALIDATION_TIER':"
    if command -v python3 >/dev/null 2>&1; then
      python3 << 'PYEOF'
import json
import sys
with open(sys.argv[1]) as f:
  data = json.load(f)
tier = sys.argv[2].lower()
tiers = data.get("tiers", {})
if tier in tiers:
  for model in tiers[tier]:
    print(f"  - {model.get('id', '?')}: {model.get('min_vram_gb', '?')}GB VRAM required")
PYEOF
    fi
  fi
}

# ============================================================================
# REPORT
# ============================================================================

print_summary() {
  header "Validation Summary"

  printf "Checks passed: ${GREEN}%d${NC}\n" "$PASS_COUNT"
  printf "Warnings:      ${YELLOW}%d${NC}\n" "$WARN_COUNT"
  printf "Failures:      ${RED}%d${NC}\n" "$FAIL_COUNT"

  if [ "$FAIL_COUNT" -eq 0 ]; then
    printf "\n${GREEN}✓ Hardware validation PASSED${NC}\n"
    if [ "$WARN_COUNT" -gt 0 ]; then
      printf "  (with %d warnings — see above)\n" "$WARN_COUNT"
    fi
    return 0
  else
    printf "\n${RED}✗ Hardware validation FAILED${NC}\n"
    printf "  Please resolve %d failure(s) before deploying models.\n" "$FAIL_COUNT"
    return 1
  fi
}

# ============================================================================
# MAIN
# ============================================================================

main() {
  log "DCP Provider Hardware Validation"
  log "================================"
  log ""
  info "Validating for tier: $VALIDATION_TIER"
  info "Cache root: $CACHE_ROOT"
  log ""

  validate_docker
  validate_nvidia_gpu
  validate_cuda_env
  validate_storage
  validate_networking
  validate_software
  validate_permissions
  validate_portfolio

  print_summary
}

main "$@"
