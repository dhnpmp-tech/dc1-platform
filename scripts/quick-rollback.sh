#!/bin/bash
#
# DC1 Quick Rollback — Emergency Recovery
#
# One-command rollback to previous commit when deployment fails
# Usage:
#   ./scripts/quick-rollback.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-.}"
DOCKER_COMPOSE_FILE="$DEPLOYMENT_DIR/docker-compose.prod.yml"

echo -e "${RED}⚠️  DC1 Emergency Rollback${NC}"
echo "Rolling back to previous deployment..."
echo ""

# Backup current database
echo "📦 Backing up database..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_dump -U dc1 dc1 > "/tmp/dc1-rollback-$(date +%s).sql" 2>/dev/null; then
  echo "✓ Database backed up"
else
  echo "⚠ Database backup may have failed (continuing anyway)"
fi

# Reset to previous commit
echo "↩️  Resetting to previous commit..."
git reset --hard HEAD~1
echo "✓ Git reset complete"

# Restart services
echo "▶️  Restarting services..."
docker-compose -f "$DOCKER_COMPOSE_FILE" down
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
echo "✓ Services restarted"

# Wait for health
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
api_status=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8083/api/health || echo "000")
if [ "$api_status" = "200" ]; then
  echo -e "${GREEN}✅ Rollback successful${NC}"
  echo ""
  echo "Services are now running with the previous version."
  echo "Check logs: docker-compose -f docker-compose.prod.yml logs -f"
  exit 0
else
  echo -e "${RED}❌ Health check failed (HTTP $api_status)${NC}"
  echo "Review logs and manual intervention may be required."
  exit 1
fi
