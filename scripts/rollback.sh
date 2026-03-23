#!/bin/bash
#
# DC1 Production Rollback Script
#
# Usage:
#   ./scripts/rollback.sh [--version VERSION] [--force] [--dry-run]
#
# Examples:
#   ./scripts/rollback.sh                    # Rollback to previous version
#   ./scripts/rollback.sh --version abc1234  # Rollback to specific version
#   ./scripts/rollback.sh --force            # Force rollback without confirmation
#   ./scripts/rollback.sh --dry-run          # Preview changes without applying

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-.}"
DOCKER_COMPOSE_FILE="${DEPLOYMENT_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${DEPLOYMENT_DIR}/.rollback-backups"
STATE_FILE="${BACKUP_DIR}/state.json"
POSTGRES_BACKUP_DIR="${BACKUP_DIR}/postgres"

# Flags
DRY_RUN=0
FORCE=0
TARGET_VERSION=""
VERBOSE=0

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✓${NC} $*"
}

log_error() {
  echo -e "${RED}✗${NC} $*" >&2
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $*"
}

# Confirm action with user
confirm() {
  if [ "$FORCE" = "1" ]; then
    return 0
  fi

  local prompt="$1"
  local response
  read -p "$(echo -e ${YELLOW})${prompt} (y/N)$(echo -e ${NC}) " response
  [[ "$response" =~ ^[Yy]$ ]]
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    log_error "docker-compose.prod.yml not found at $DOCKER_COMPOSE_FILE"
    exit 1
  fi

  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
  fi

  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed or not in PATH"
    exit 1
  fi

  log_success "All prerequisites met"
}

# Get current deployment info
get_current_deployment() {
  log_info "Retrieving current deployment info..."

  if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps > /dev/null 2>&1; then
    log_error "Unable to connect to Docker daemon"
    exit 1
  fi

  # Get running image versions
  local frontend_image=$(docker-compose -f "$DOCKER_COMPOSE_FILE" images frontend | awk 'NR==2 {print $2}')
  local backend_image=$(docker-compose -f "$DOCKER_COMPOSE_FILE" images backend | awk 'NR==2 {print $2}')

  echo "{\"frontend\": \"$frontend_image\", \"backend\": \"$backend_image\", \"timestamp\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"}"
}

# Get git history
get_git_history() {
  log_info "Retrieving git history..."

  if [ ! -d .git ]; then
    log_error "Not in a git repository"
    exit 1
  fi

  # Get last 10 commits
  git log --oneline -10 --format='%h %s' main || true
}

# Get previous version from git
get_previous_version() {
  if [ -z "$TARGET_VERSION" ]; then
    # Use previous commit
    TARGET_VERSION=$(git rev-parse HEAD~1 2>/dev/null || echo "")
  fi

  if [ -z "$TARGET_VERSION" ]; then
    log_error "Unable to determine target version for rollback"
    exit 1
  fi

  echo "${TARGET_VERSION:0:8}"
}

# Backup current database state
backup_database() {
  log_info "Backing up current database..."

  mkdir -p "$POSTGRES_BACKUP_DIR"

  local backup_file="$POSTGRES_BACKUP_DIR/db-backup-$(date +%s).sql"

  if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_dump -U dc1 dc1 > "$backup_file" 2>/dev/null; then
    log_success "Database backed up to $backup_file"
    echo "$backup_file"
  else
    log_error "Failed to backup database"
    return 1
  fi
}

# Backup current state
save_backup() {
  log_info "Saving current deployment state..."

  mkdir -p "$BACKUP_DIR"

  # Save current deployment info
  get_current_deployment > "$STATE_FILE"

  log_success "Deployment state saved to $STATE_FILE"
}

# Perform rollback
perform_rollback() {
  local target_version="$1"

  log_info "Rolling back to version $target_version..."

  if [ "$DRY_RUN" = "1" ]; then
    log_warn "[DRY RUN] Would execute: git reset --hard $target_version"
    log_warn "[DRY RUN] Would restart containers"
    return 0
  fi

  # Reset git
  log_info "Resetting git to $target_version..."
  if ! git reset --hard "$target_version" > /dev/null 2>&1; then
    log_error "Failed to reset git to $target_version"
    exit 1
  fi
  log_success "Git reset to $target_version"

  # Restart containers
  log_info "Restarting docker-compose services..."
  if docker-compose -f "$DOCKER_COMPOSE_FILE" down > /dev/null 2>&1; then
    log_success "Services stopped"
  fi

  if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d > /dev/null 2>&1; then
    log_success "Services started"
  else
    log_error "Failed to restart services"
    exit 1
  fi
}

# Wait for services to be healthy
wait_for_healthy() {
  log_info "Waiting for services to be healthy..."

  local max_attempts=30
  local attempt=0

  while [ $attempt -lt $max_attempts ]; do
    local healthy=$(docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -c "healthy" || true)
    if [ "$healthy" -gt 0 ]; then
      log_success "Services are healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    echo -ne "\rWaiting... ($attempt/$max_attempts)"
    sleep 2
  done

  echo ""
  log_error "Services failed to become healthy"
  return 1
}

# Verify rollback
verify_rollback() {
  log_info "Verifying rollback..."

  local api_status=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8083/api/health || echo "000")
  local frontend_status=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000 || echo "000")

  if [ "$api_status" = "200" ] && [ "$frontend_status" = "200" ]; then
    log_success "All services responding"
    return 0
  else
    log_error "Service health check failed (API: $api_status, Frontend: $frontend_status)"
    return 1
  fi
}

# Print summary
print_summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}Rollback Summary${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Target Version: ${TARGET_VERSION:0:8}"
  echo "Timestamp: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "Deployment Dir: $DEPLOYMENT_DIR"
  echo "Backups: $BACKUP_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. Verify application functionality: curl http://localhost:3000"
  echo "  2. Check logs: docker-compose -f docker-compose.prod.yml logs -f"
  echo "  3. If issues occur, restore database: psql < $POSTGRES_BACKUP_DIR/db-backup-*.sql"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      TARGET_VERSION="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -v|--verbose)
      VERBOSE=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Main execution
main() {
  log_info "DC1 Production Rollback Script"
  echo ""

  check_prerequisites

  # Show current deployment
  echo ""
  log_info "Current Deployment:"
  get_git_history | head -3

  # Determine target version
  TARGET_VERSION=$(get_previous_version)
  log_info "Target rollback version: $TARGET_VERSION"

  # Confirm
  if ! confirm "Proceed with rollback to $TARGET_VERSION?"; then
    log_warn "Rollback cancelled"
    exit 0
  fi

  # Save backup
  save_backup
  backup_database || log_warn "Database backup may have failed"

  # Perform rollback
  perform_rollback "$TARGET_VERSION"
  wait_for_healthy || log_error "Services may not be healthy after rollback"
  verify_rollback || log_error "Rollback verification failed"

  # Summary
  print_summary

  log_success "Rollback complete"
}

main "$@"
