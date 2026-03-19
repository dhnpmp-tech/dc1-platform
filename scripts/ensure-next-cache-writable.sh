#!/usr/bin/env bash

set -euo pipefail

NEXT_DIR=".next"

if [ ! -e "$NEXT_DIR" ]; then
  mkdir -p "$NEXT_DIR"
  exit 0
fi

if [ -w "$NEXT_DIR" ] && [ -w "$NEXT_DIR/." ]; then
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
stale_dir=".next.stale-${timestamp}"

echo "[WARN] $NEXT_DIR is not writable by $(id -un). Rotating cache to $stale_dir."

if mv "$NEXT_DIR" "$stale_dir"; then
  mkdir -p "$NEXT_DIR"
  echo "[OK] Created fresh writable $NEXT_DIR cache directory."
  exit 0
fi

echo "[ERROR] Failed to rotate $NEXT_DIR. Fix permissions and retry:"
echo "  sudo chown -R $(id -un):$(id -gn) $NEXT_DIR"
exit 1
