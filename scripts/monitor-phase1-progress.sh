#!/bin/bash
# Monitor Phase 1 P2P Deployment Progress

ISSUE_ID="8d79cec3-d2af-410a-a600-90a1c5b7768b"
API_URL="${PAPERCLIP_API_URL:-http://localhost:3100}"
API_KEY="${PAPERCLIP_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Error: PAPERCLIP_API_KEY not set"
  exit 1
fi

echo "=== Phase 1 Deployment Progress Monitor ==="
echo "Time: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo ""

# Check DCP-612 comments for Phase 1 completion signals
COMMENTS=$(curl -s "${API_URL}/api/issues/${ISSUE_ID}/comments" \
  -H "Authorization: Bearer ${API_KEY}")

# Count total comments
COMMENT_COUNT=$(echo "$COMMENTS" | grep -o '"id":"' | wc -l)
echo "DCP-612 Comments: $COMMENT_COUNT"

# Check for Phase 1 peer ID (look for actual peer ID in format 12D3Koo followed by alphanumeric, not in documentation)
# Better: check for "Peer ID" mentions in comments after first 3 (which are my docs)
if [ "$COMMENT_COUNT" -gt 3 ]; then
  echo "⏳ PHASE 1: New comments detected - checking for peer ID..."
  NEW_COMMENTS=$(echo "$COMMENTS" | tail -100)
  if echo "$NEW_COMMENTS" | grep -q "Peer ID.*12D3Koo[A-Za-z0-9]\{40,\}"; then
    echo "✅ PHASE 1 COMPLETE: Bootstrap peer ID posted by DevOps"
    PEER_ID=$(echo "$NEW_COMMENTS" | grep -o "12D3Koo[A-Za-z0-9]*" | head -1)
    echo "   Peer ID: $PEER_ID"
  else
    echo "⏳ PHASE 1: Awaiting DevOps bootstrap deployment and peer ID"
  fi
else
  echo "⏳ PHASE 1: Awaiting DevOps bootstrap deployment"
fi

# Check if bootstrap is running (if we have SSH access)
if command -v ssh &> /dev/null 2>&1; then
  BOOTSTRAP_STATUS=$(ssh root@76.13.179.86 "pm2 status 2>/dev/null | grep dc1-p2p-bootstrap" 2>/dev/null | grep -c "online" || echo "0")
  if [ "$BOOTSTRAP_STATUS" -gt "0" ]; then
    echo "   Direct check: Bootstrap node is running on VPS ✓"
  fi
fi

echo ""
echo "Next check: in ~10 minutes (cron job: 5aec426d)"
