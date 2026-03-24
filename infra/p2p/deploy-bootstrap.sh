#!/bin/bash
#
# P2P Bootstrap Node Deployment Script
#
# This script deploys the P2P bootstrap node to the VPS and configures it for production use.

set -e

REPO_PATH="/home/node/dc1-platform"
BOOTSTRAP_SERVICE_NAME="dc1-p2p-bootstrap"
LOG_FILE="/var/log/dc1-p2p-bootstrap.log"
PEER_ID_FILE="$REPO_PATH/p2p/BOOTSTRAP_PEER_ID.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}P2P Bootstrap Node Deployment${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Check root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# Phase 1: Pull latest code
echo -e "${YELLOW}[Phase 1] Pulling latest code...${NC}"
if [ ! -d "$REPO_PATH" ]; then
    echo -e "${RED}Repository not found at $REPO_PATH${NC}"
    exit 1
fi

cd "$REPO_PATH"
git pull origin main || {
    echo -e "${RED}Failed to pull latest code${NC}"
    exit 1
}
echo -e "${GREEN}✓ Code updated${NC}\n"

# Phase 2: Install dependencies
echo -e "${YELLOW}[Phase 2] Installing P2P dependencies...${NC}"
if [ ! -d "p2p/node_modules" ]; then
    npm install --prefix p2p || {
        echo -e "${RED}Failed to install dependencies${NC}"
        exit 1
    }
else
    npm install --prefix p2p --production || {
        echo -e "${RED}Failed to update dependencies${NC}"
        exit 1
    }
fi
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Phase 3: Stop any existing service
echo -e "${YELLOW}[Phase 3] Checking for existing service...${NC}"
if pm2 list | grep -q "$BOOTSTRAP_SERVICE_NAME"; then
    echo "  Found existing service, stopping..."
    pm2 stop "$BOOTSTRAP_SERVICE_NAME" || true
    pm2 delete "$BOOTSTRAP_SERVICE_NAME" || true
    sleep 2
fi
echo -e "${GREEN}✓ Old service cleaned up${NC}\n"

# Phase 4: Start bootstrap node with PM2
echo -e "${YELLOW}[Phase 4] Starting P2P bootstrap node...${NC}"

pm2 update || true

pm2 start p2p/bootstrap.js \
    --name "$BOOTSTRAP_SERVICE_NAME" \
    --time \
    --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
    --output "$LOG_FILE" \
    --error "$LOG_FILE" || {
    echo -e "${RED}Failed to start bootstrap node${NC}"
    exit 1
}

echo -e "${GREEN}✓ Bootstrap node started${NC}\n"

# Phase 5: Extract peer ID
echo -e "${YELLOW}[Phase 5] Extracting bootstrap peer ID...${NC}"

sleep 3

PEER_ID=$(pm2 logs "$BOOTSTRAP_SERVICE_NAME" --lines 100 --nostream 2>/dev/null | \
    grep -oP '(12D3Koo|QmV)[A-Za-z0-9]+' | head -1 || echo "")

if [ -z "$PEER_ID" ]; then
    echo -e "${YELLOW}⚠ Could not extract peer ID from logs${NC}"
    sleep 5
    PEER_ID=$(pm2 logs "$BOOTSTRAP_SERVICE_NAME" --lines 200 --nostream 2>/dev/null | \
        grep -oP '(12D3Koo|QmV)[A-Za-z0-9]+' | head -1 || echo "")
fi

if [ -n "$PEER_ID" ]; then
    echo "$PEER_ID" > "$PEER_ID_FILE"
    echo -e "${GREEN}✓ Bootstrap Peer ID: $PEER_ID${NC}"
else
    echo -e "${YELLOW}⚠ Peer ID extraction failed, but service is running${NC}"
fi
echo ""

# Phase 6: Configure PM2 persistence
echo -e "${YELLOW}[Phase 6] Configuring PM2 persistence...${NC}"

pm2 save || {
    echo -e "${RED}Failed to save PM2 config${NC}"
    exit 1
}

pm2 startup || {
    echo -e "${YELLOW}⚠ PM2 startup configuration may need manual setup${NC}"
}

echo -e "${GREEN}✓ PM2 configured for auto-start${NC}\n"

# Phase 7: Verify bootstrap
echo -e "${YELLOW}[Phase 7] Verifying bootstrap node...${NC}"

pm2 list | grep -q "$BOOTSTRAP_SERVICE_NAME" || {
    echo -e "${RED}Bootstrap service is not running${NC}"
    exit 1
}

if netstat -ln 2>/dev/null | grep -q ":4001 "; then
    echo -e "${GREEN}✓ Bootstrap listening on port 4001${NC}"
else
    echo -e "${YELLOW}⚠ Port 4001 not yet open${NC}"
fi

echo ""
echo -e "${GREEN}✓ Bootstrap node deployment complete!${NC}\n"

echo -e "${BLUE}Service Information:${NC}"
pm2 info "$BOOTSTRAP_SERVICE_NAME" || true

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Configure provider nodes with:"
if [ -n "$PEER_ID" ]; then
    echo "     BOOTSTRAP_PEER_ID=$PEER_ID"
else
    echo "     BOOTSTRAP_PEER_ID=\$(cat $PEER_ID_FILE)"
fi
echo ""
echo "  2. Monitor: pm2 logs $BOOTSTRAP_SERVICE_NAME"
echo ""

if [ -n "$PEER_ID" ]; then
    echo -e "${BLUE}Provider Configuration Export:${NC}"
    cat > "$REPO_PATH/p2p/BOOTSTRAP_CONFIG.env" << EXPORT_EOF
# P2P Bootstrap Configuration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

BOOTSTRAP_PEER_ID=$PEER_ID
BOOTSTRAP_ADDR=/ip4/$(hostname -I | awk '{print $1}')/tcp/4001/p2p/$PEER_ID
EXPORT_EOF
    echo "  Exported to: $REPO_PATH/p2p/BOOTSTRAP_CONFIG.env"
fi

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}\n"
