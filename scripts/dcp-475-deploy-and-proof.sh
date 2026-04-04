#!/usr/bin/env bash
set -euo pipefail

# DCP-475 production deploy + proof helper.
# Usage:
#   scripts/dcp-475-deploy-and-proof.sh
#   DCP475_PROOF_ONLY=1 scripts/dcp-475-deploy-and-proof.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS_HOST="${DCP475_VPS_HOST:-76.13.179.86}"
VPS_USER="${DCP475_VPS_USER:-root}"
VPS_REPO_PATH="${DCP475_VPS_REPO_PATH:-/root/dc1-platform}"
DEPLOY_BRANCH="${DCP475_DEPLOY_BRANCH:-agent/backend-dev/dcp-472-restore-allam-capacity}"
PROOF_MODEL="${DCP475_PROOF_MODEL:-ALLaM-AI/ALLaM-7B-Instruct-preview}"
PROOF_OUTPUT_DIR="${DCP475_PROOF_OUTPUT_DIR:-../docs/reports/reliability/dcp-475-proof}"
PROOF_ONLY="${DCP475_PROOF_ONLY:-0}"

echo "[dcp-475] root=${ROOT_DIR}"
echo "[dcp-475] deploy_branch=${DEPLOY_BRANCH}"
echo "[dcp-475] proof_model=${PROOF_MODEL}"

if [[ "${PROOF_ONLY}" != "1" ]]; then
  if ! command -v ssh >/dev/null 2>&1; then
    echo "[dcp-475] error: ssh command is unavailable in this environment." >&2
    echo "[dcp-475] run on an operator machine with VPS SSH access, or set DCP475_PROOF_ONLY=1." >&2
    exit 2
  fi

  echo "[dcp-475] deploying to ${VPS_USER}@${VPS_HOST}:${VPS_REPO_PATH}"
  ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" bash <<EOF
set -euo pipefail
cd "${VPS_REPO_PATH}"
git fetch origin "${DEPLOY_BRANCH}"
git checkout "${DEPLOY_BRANCH}"
git pull --ff-only origin "${DEPLOY_BRANCH}"
cd backend
pm2 restart dc1-provider-onboarding
pm2 save
pm2 status | grep -E "dc1-provider-onboarding|online" || true
EOF
fi

echo "[dcp-475] running live proof package"
(
  cd "${ROOT_DIR}/backend"
  DCP_SMOKE_MODEL="${PROOF_MODEL}" \
  DCP_PROOF_OUTPUT_DIR="${PROOF_OUTPUT_DIR}" \
  npm run test:reliability:first-live-proof
)

echo "[dcp-475] done"
