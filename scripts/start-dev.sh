#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — Development Environment Startup
# =============================================================================
# One-command startup for the full self-hosted Supabase + frontend stack.
#
# Usage:
#   ./scripts/start-dev.sh              # Start everything
#   ./scripts/start-dev.sh --backend    # Supabase stack only (no frontend)
#   ./scripts/start-dev.sh --reset      # Wipe volumes and start fresh
#   ./scripts/start-dev.sh --stop       # Stop all services
# =============================================================================

set -euo pipefail

# Project root (relative to this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[TalentGeenie]${NC} $*"; }
warn()  { echo -e "${YELLOW}[TalentGeenie]${NC} $*"; }
error() { echo -e "${RED}[TalentGeenie]${NC} $*" >&2; }
info()  { echo -e "${BLUE}[TalentGeenie]${NC} $*"; }

ENV_FILE=".env.supabase"
COMPOSE_FILE="docker-compose.supabase.yml"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
BACKEND_ONLY=false
RESET=false
STOP=false

for arg in "$@"; do
  case "$arg" in
    --backend)   BACKEND_ONLY=true ;;
    --reset)     RESET=true ;;
    --stop)      STOP=true ;;
    --help|-h)
      echo "Usage: $0 [--backend] [--reset] [--stop] [--help]"
      echo ""
      echo "  --backend   Start Supabase stack only (skip frontend)"
      echo "  --reset     Wipe all volumes and start fresh"
      echo "  --stop      Stop all running services"
      echo "  --help      Show this help"
      exit 0
      ;;
    *) error "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------
if [ "$STOP" = true ]; then
  log "Stopping all services..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
  log "All services stopped."
  exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
log "╔═══════════════════════════════════════════════════════╗"
log "║     TalentGeenie Development Environment             ║"
log "╚═══════════════════════════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  error "Docker is not installed. Please install Docker Desktop."
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Please start Docker Desktop."
  exit 1
fi

# Check env file
if [ ! -f "$ENV_FILE" ]; then
  warn "No $ENV_FILE found. Creating from template..."
  cp .env.supabase.example "$ENV_FILE"

  info "Generating JWT keys..."
  chmod +x scripts/generate-keys.sh
  bash scripts/generate-keys.sh --append "$ENV_FILE"

  # Generate a random postgres password
  PG_PASS=$(openssl rand -base64 24 | tr -d '\n/+=')
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|your-super-secret-and-long-postgres-password|${PG_PASS}|g" "$ENV_FILE"
  else
    sed -i "s|your-super-secret-and-long-postgres-password|${PG_PASS}|g" "$ENV_FILE"
  fi

  # Update VITE_SUPABASE_ANON_KEY to match the generated ANON_KEY
  GENERATED_ANON=$(grep '^ANON_KEY=' "$ENV_FILE" | tail -1 | cut -d'=' -f2-)
  if [ -n "$GENERATED_ANON" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|VITE_SUPABASE_ANON_KEY=your-generated-anon-key|VITE_SUPABASE_ANON_KEY=${GENERATED_ANON}|g" "$ENV_FILE"
    else
      sed -i "s|VITE_SUPABASE_ANON_KEY=your-generated-anon-key|VITE_SUPABASE_ANON_KEY=${GENERATED_ANON}|g" "$ENV_FILE"
    fi
  fi

  log "Environment file created: $ENV_FILE"
  echo ""
fi

# ---------------------------------------------------------------------------
# Reset (wipe volumes)
# ---------------------------------------------------------------------------
if [ "$RESET" = true ]; then
  warn "⚠️  Resetting: This will DELETE all database data and storage files!"
  read -r -p "Are you sure? (y/N) " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    log "Stopping services and removing volumes..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v
    log "Volumes removed."
  else
    log "Reset cancelled."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Make scripts executable
# ---------------------------------------------------------------------------
chmod +x scripts/run-bootstrap.sh 2>/dev/null || true
chmod +x scripts/generate-keys.sh 2>/dev/null || true

# ---------------------------------------------------------------------------
# Start Supabase stack
# ---------------------------------------------------------------------------
log "Starting Supabase stack..."
echo ""

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# ---------------------------------------------------------------------------
# Wait for services to be healthy
# ---------------------------------------------------------------------------
log "Waiting for services to become healthy..."
echo ""

wait_for_service() {
  local service="$1"
  local url="$2"
  local max_attempts="${3:-30}"
  local attempt=0

  printf "  %-20s " "$service"
  while [ $attempt -lt $max_attempts ]; do
    if curl -sSf "$url" -o /dev/null 2>/dev/null; then
      echo -e "${GREEN}✓ ready${NC}"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo -e "${RED}✗ timeout${NC}"
  return 1
}

# Source the env file to get ports
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a

KONG_PORT="${KONG_HTTP_PORT:-8000}"
STUDIO_PORT_VAL="${STUDIO_PORT:-3000}"

# Wait for Kong (API Gateway) which depends on everything else
wait_for_service "PostgreSQL" "http://localhost:${KONG_PORT}/rest/v1/" || true
wait_for_service "Auth (GoTrue)" "http://localhost:${KONG_PORT}/auth/v1/health" || true
wait_for_service "Kong Gateway" "http://localhost:${KONG_PORT}/" || true

# Check if Studio is up
wait_for_service "Studio" "http://localhost:${STUDIO_PORT_VAL}/" || true

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "╔═══════════════════════════════════════════════════════╗"
log "║     Development Environment Ready!                   ║"
log "╚═══════════════════════════════════════════════════════╝"
echo ""
info "  Supabase API (Kong):  http://localhost:${KONG_PORT}"
info "  Supabase Studio:      http://localhost:${STUDIO_PORT_VAL}"
info "  PostgreSQL:           localhost:${POSTGRES_PORT:-54322}"
echo ""

if [ "$BACKEND_ONLY" = false ]; then
  info "  To start the frontend:"
  info "    npm install && npm run dev"
  echo ""
  info "  Frontend .env values:"
  info "    VITE_SUPABASE_URL=http://localhost:${KONG_PORT}"
  info "    VITE_SUPABASE_ANON_KEY=<see .env.supabase>"
fi

echo ""
info "  Useful commands:"
info "    make logs          — View all service logs"
info "    make logs-db       — View database logs"
info "    make status        — Check service health"
info "    make stop          — Stop all services"
info "    make reset         — Wipe data and restart"
echo ""
