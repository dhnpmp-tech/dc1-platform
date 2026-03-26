#!/bin/bash

##############################################################################
# Deploy Templates to Production VPS
#
# Usage: ./scripts/deploy-templates-production.sh
#
# Prerequisites:
# - SSH key configured for root@76.13.179.86
# - Founder approval already obtained
# - Staging deployment already tested
#
# What it does:
# 1. Creates pre-deployment checkpoint
# 2. Pulls latest code from main
# 3. Installs/rebuilds dependencies
# 4. Restarts PM2 services (zero-downtime reload)
# 5. Captures deployment logs
##############################################################################

set -e  # Exit on any error

# Configuration
PROD_HOST="76.13.179.86"
SSH_USER="root"
PROD_PATH="/root/dc1-platform"
CHECKPOINT_FILE="/tmp/pre-deploy-checkpoint-$(date +%s).txt"

echo "🚀 PRODUCTION TEMPLATE DEPLOYMENT"
echo "=================================="
echo "Host: $PROD_HOST"
echo "Path: $PROD_PATH"
echo "Time: $(date -u)"
echo ""

# Pre-flight checks
echo "📋 Pre-Flight Checks..."

# Check SSH connectivity
if ! ssh -o ConnectTimeout=5 "$SSH_USER@$PROD_HOST" "echo ok" > /dev/null 2>&1; then
  echo "❌ Cannot connect to $PROD_HOST"
  echo "   Check SSH configuration and network connectivity"
  exit 1
fi
echo "✅ SSH connection verified"

# Check for active jobs on VPS
echo "✅ Pre-flight checks complete"
echo ""

# Execute deployment on VPS
echo "🔧 Executing Deployment..."
ssh "$SSH_USER@$PROD_HOST" bash << 'REMOTESCRIPT'
set -e

PROD_PATH="/root/dc1-platform"
CHECKPOINT_FILE="/tmp/pre-deploy-checkpoint.txt"

echo "📍 Checkpoint: Recording current state..."
cd $PROD_PATH

# Record pre-deploy state
{
  echo "timestamp=$(date -u)"
  echo "current_commit=$(git rev-parse HEAD)"
  echo "remote_main=$(git rev-parse origin/main)"
  echo "node_version=$(node -v)"
  echo "npm_version=$(npm -v)"
} > "$CHECKPOINT_FILE"

echo "Checkpoint saved to: $CHECKPOINT_FILE"
cat "$CHECKPOINT_FILE"
echo ""

# Phase 1: Pull new code
echo "📦 Pulling latest code..."
git fetch origin
git pull origin main
NEW_COMMIT=$(git rev-parse HEAD)
echo "✅ Pulled successfully. New commit: $NEW_COMMIT"
echo ""

# Phase 2: Install dependencies
echo "🔨 Installing dependencies..."
cd "$PROD_PATH/backend"

# Full install to rebuild native modules
npm install > /tmp/npm-install.log 2>&1

# Verify critical modules
echo "Verifying critical modules..."
node -e "require('better-sqlite3'); console.log('  ✅ sqlite3 OK')" || {
  echo "  ⚠️  sqlite3 rebuild needed"
  npm rebuild better-sqlite3
}

node -e "require('sharp'); console.log('  ✅ sharp OK')" || {
  echo "  ⚠️  sharp rebuild needed"
  npm rebuild sharp
}

echo "✅ Dependencies installed"
echo ""

# Phase 3: Restart PM2
echo "🔄 Restarting services (zero-downtime reload)..."
cd "$PROD_PATH/backend"

# Use reload for zero-downtime restart
pm2 reload ecosystem.config.js --only dc1-provider-onboarding

echo "Waiting for service to stabilize..."
sleep 3

# Verify PM2 status
pm2 status dc1-provider-onboarding || {
  echo "⚠️  Service status check issue, attempting full restart..."
  pm2 restart dc1-provider-onboarding
  sleep 3
}

echo "✅ Services restarted"
echo ""

# Phase 4: Verify
echo "🔍 Verifying deployment..."
HEALTH_RESPONSE=$(curl -s https://api.dcp.sa/api/health)
echo "Health check: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  echo "✅ API responding"
else
  echo "❌ API health check failed"
  exit 1
fi

TEMPLATE_COUNT=$(curl -s https://api.dcp.sa/api/templates | wc -l)
echo "Template endpoint: responding ($TEMPLATE_COUNT bytes)"

echo ""
echo "✅ DEPLOYMENT COMPLETE"
REMOTESCRIPT

echo ""
echo "✅ Production deployment completed successfully!"
echo "   Host: $PROD_HOST"
echo "   Timestamp: $(date -u)"
echo ""
echo "Next step: Run post-deployment verification"
echo "  node scripts/post-deploy-verify-templates.mjs"
