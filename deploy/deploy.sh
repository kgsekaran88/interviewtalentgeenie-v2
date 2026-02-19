#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — Deploy / Restart
# =============================================================================
# Run on the VPS (or locally for testing) to (re)deploy the full stack.
# Usage: cd ~/app && bash deploy/deploy.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$APP_DIR/.env.production"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TalentGeenie — Deploying                                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "  App dir: $APP_DIR"
echo "  Env:     $ENV_FILE"
echo ""

# ── Preflight checks ────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE"
  echo "   Copy .env.production to $ENV_FILE and fill in secrets."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "❌ Docker not installed. Run deploy/setup-server.sh first."
  exit 1
fi

cd "$APP_DIR"

# ── Pull latest code ────────────────────────────────────────────────────────
if [ -d .git ]; then
  echo "→ Pulling latest code..."
  git pull origin main --ff-only
fi

# ── Build & deploy ───────────────────────────────────────────────────────────
COMPOSE_CMD="docker compose -f docker-compose.supabase.yml -f docker-compose.deploy.yml --env-file .env.production"

echo "→ Pulling updated images..."
$COMPOSE_CMD pull --ignore-buildable

echo "→ Building frontend..."
$COMPOSE_CMD build app

echo "→ Starting all services..."
$COMPOSE_CMD up -d

# ── Wait for health ─────────────────────────────────────────────────────────
echo ""
echo "→ Waiting for services to become healthy..."
sleep 10

SERVICES=("talentgeenie-db" "talentgeenie-kong" "talentgeenie-auth" "talentgeenie-caddy" "talentgeenie-app" "talentgeenie-pgbouncer")
ALL_HEALTHY=true

for svc in "${SERVICES[@]}"; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "not-found")
  if [ "$STATUS" = "healthy" ]; then
    echo "  ✅ $svc"
  elif [ "$STATUS" = "starting" ]; then
    echo "  ⏳ $svc (still starting)"
    ALL_HEALTHY=false
  else
    echo "  ❌ $svc ($STATUS)"
    ALL_HEALTHY=false
  fi
done

echo ""
if [ "$ALL_HEALTHY" = true ]; then
  DOMAIN=$(grep "^DOMAIN=" "$ENV_FILE" | cut -d= -f2)
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ✅ Deployment complete!                                   ║"
  echo "║                                                            ║"
  echo "║  Frontend:  https://$DOMAIN                 ║"
  echo "║  API:       https://$DOMAIN/rest/v1/        ║"
  echo "║  Auth:      https://$DOMAIN/auth/v1/        ║"
  echo "║  Functions: https://$DOMAIN/functions/v1/   ║"
  echo "║                                                            ║"
  echo "║  Studio (via SSH tunnel):                                  ║"
  echo "║    ssh -L 3001:localhost:3001 user@server                  ║"
  echo "║    http://localhost:3001                                   ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
else
  echo "⚠️  Some services are still starting. Check again in 30s:"
  echo "   docker ps --format 'table {{.Names}}\t{{.Status}}'"
fi
