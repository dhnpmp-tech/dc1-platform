#!/bin/bash

##############################################################################
# Rollback Template Deployment
#
# Usage: ./scripts/rollback-templates.sh [COMMIT_HASH]
#
# If no commit hash provided, uses the checkpoint file from last deployment
#
# What it does:
# 1. Reads pre-deployment checkpoint (or uses provided commit)
# 2. Reverts code to that commit
# 3. Rebuilds dependencies for reverted version
# 4. Restarts PM2 services
# 5. Verifies rollback succeeded
##############################################################################

set -e

PROD_HOST="76.13.179.86"
SSH_USER="root"
PROD_PATH="/root/dc1-platform"
CHECKPOINT_FILE="/tmp/pre-deploy-checkpoint.txt"
ROLLBACK_COMMIT="${1:-}"

echo "⚠️  ROLLBACK PROCEDURE"
echo "===================="
echo "Host: $PROD_HOST"
echo "Time: $(date -u)"
echo ""

# Determine rollback commit
if [ -z "$ROLLBACK_COMMIT" ]; then
  # Try to read from checkpoint file on VPS
  echo "📍 Reading pre-deployment checkpoint..."
  ROLLBACK_COMMIT=$(ssh "$SSH_USER@$PROD_HOST" "cat $CHECKPOINT_FILE 2>/dev/null | grep current_commit" | awk -F= '{print $2}')

  if [ -z "$ROLLBACK_COMMIT" ]; then
    echo "❌ Cannot find checkpoint file and no commit provided"
    echo "   Usage: ./scripts/rollback-templates.sh [COMMIT_HASH]"
    echo "   Example: ./scripts/rollback-templates.sh abc123def456"
    exit 1
  fi
fi

echo "Rolling back to: $ROLLBACK_COMMIT"
echo ""

# Execute rollback on VPS
echo "🔄 Executing rollback..."
ssh "$SSH_USER@$PROD_HOST" bash << REMOTESCRIPT
set -e

PROD_PATH="$PROD_PATH"
ROLLBACK_COMMIT="$ROLLBACK_COMMIT"

cd \$PROD_PATH

echo "📝 Current commit:"
git rev-parse HEAD

echo ""
echo "🔙 Reverting to: \$ROLLBACK_COMMIT"
git reset --hard \$ROLLBACK_COMMIT

echo "✅ Code reverted"
echo ""

# Rebuild dependencies for reverted version
echo "🔨 Rebuilding dependencies for reverted version..."
cd \$PROD_PATH/backend
npm install > /tmp/npm-rollback.log 2>&1

echo "✅ Dependencies rebuilt"
echo ""

# Restart services
echo "🔄 Restarting services..."
pm2 restart ecosystem.config.js

sleep 3

echo "✅ Services restarted"
echo ""

# Verify
echo "🔍 Verifying rollback..."
HEALTH=$(curl -s https://api.dcp.sa/api/health)
echo "Health: \$HEALTH"

if echo "\$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ ROLLBACK SUCCESSFUL"
else
  echo "❌ Health check failed after rollback"
  exit 1
fi
REMOTESCRIPT

echo ""
echo "✅ Rollback completed successfully!"
echo "   Rolled back to: $ROLLBACK_COMMIT"
echo "   Time: $(date -u)"
echo ""
echo "⚠️  ACTION REQUIRED: Post incident analysis in Paperclip issue"
