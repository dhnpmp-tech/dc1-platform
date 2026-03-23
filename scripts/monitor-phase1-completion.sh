#!/bin/bash
#
# Phase 1 Completion Monitor
# Checks every 5 minutes for bootstrap peer ID injection
# Triggers Phase 4 validation when detected
#
# Usage: bash scripts/monitor-phase1-completion.sh
# Runs continuously until Phase 1 detected

PHASE_2_CONFIG="/home/node/dc1-platform/p2p/dc1-node.js"
PLACEHOLDER="REPLACE_WITH_BOOTSTRAP_PEER_ID"
CHECK_INTERVAL=300  # 5 minutes
LOG_FILE="/tmp/phase1-monitor.log"

echo "[$(date)] Phase 1 Completion Monitor started" | tee -a "$LOG_FILE"
echo "[$(date)] Checking for bootstrap peer ID injection every $((CHECK_INTERVAL / 60)) minutes" | tee -a "$LOG_FILE"
echo "[$(date)] Looking for placeholder replacement in $PHASE_2_CONFIG" | tee -a "$LOG_FILE"

while true; do
  # Check if Phase 1 has been executed (peer ID injected)
  if grep -q "$PLACEHOLDER" "$PHASE_2_CONFIG"; then
    # Placeholder still exists - Phase 1 not done
    echo "[$(date)] Phase 1 status: NOT EXECUTED (placeholder still present)" | tee -a "$LOG_FILE"
  else
    # Placeholder replaced - Phase 1 complete!
    PEER_ID=$(grep -o '/p2p/12D3Koo[^[:space:]]*' "$PHASE_2_CONFIG" | head -1)
    echo "[$(date)] 🎉 PHASE 1 DETECTED! Bootstrap peer ID: $PEER_ID" | tee -a "$LOG_FILE"
    echo "[$(date)] Phase 2 completed. Waiting for Phase 3 (30 seconds)..." | tee -a "$LOG_FILE"

    # Wait for Phase 3 (automatic DHT re-announcement - 30 seconds)
    sleep 30

    # Check if providers are coming online
    echo "[$(date)] Checking provider status after Phase 3..." | tee -a "$LOG_FILE"

    # Phase 4: Execute validation
    echo "[$(date)] Executing Phase 4 validation..." | tee -a "$LOG_FILE"
    bash scripts/validate-p2p-setup.sh 2>&1 | tee -a "$LOG_FILE"
    VALIDATION_EXIT=$?

    if [ $VALIDATION_EXIT -eq 0 ]; then
      echo "[$(date)] ✅ Phase 4 SUCCESSFUL - P2P Network Ready!" | tee -a "$LOG_FILE"
    else
      echo "[$(date)] ❌ Phase 4 FAILED - Check logs above" | tee -a "$LOG_FILE"
    fi

    # Phase 4 complete - exit monitor
    echo "[$(date)] Phase 1 launch sequence COMPLETE" | tee -a "$LOG_FILE"
    exit $VALIDATION_EXIT
  fi

  echo "[$(date)] Next check in $((CHECK_INTERVAL / 60)) minutes..." | tee -a "$LOG_FILE"
  sleep $CHECK_INTERVAL
done
