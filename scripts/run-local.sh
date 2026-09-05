#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — one-command local run (Supabase Docker + Vite frontend)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE=docker-compose.supabase.yml
ENV_FILE=.env.supabase

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.supabase.example and configure keys."
  exit 1
fi

echo "[TalentGeenie] Starting Supabase Docker stack (db, kong, auth, rest, storage, functions, studio)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

ANON=$(grep '^ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)
KONG_PORT=$(grep '^KONG_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2- || true)
KONG_PORT=${KONG_PORT:-8000}
STUDIO_PORT=$(grep '^STUDIO_PORT=' "$ENV_FILE" | cut -d= -f2- || true)
STUDIO_PORT=${STUDIO_PORT:-3001}
FRONTEND_PORT=$(grep -E 'port:\s*[0-9]+' vite.config.ts | head -1 | grep -oE '[0-9]+' || true)
FRONTEND_PORT=${FRONTEND_PORT:-8084}

echo "[TalentGeenie] Waiting for Kong/Auth..."
for i in $(seq 1 40); do
  if curl -sf "http://localhost:${KONG_PORT}/auth/v1/health" -H "apikey: ${ANON}" >/dev/null; then
    echo "[TalentGeenie] Backend ready"
    break
  fi
  if [[ "$i" -eq 40 ]]; then
    echo "[TalentGeenie] Backend did not become healthy in time. Check: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps"
    exit 1
  fi
  sleep 2
done

# Keep frontend env in sync with local Kong
cat > .env.development <<EOF
VITE_SUPABASE_URL=http://localhost:${KONG_PORT}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON}
VITE_SUPABASE_PROJECT_ID=local
VITE_SENTRY_DSN=
EOF

# Mirror into .env.local for tools that prefer it
if [[ -f .env.local ]]; then
  if [[ "$(uname)" == Darwin ]]; then
    sed -i '' "s|^VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=http://localhost:${KONG_PORT}|" .env.local
    sed -i '' "s|^VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=${ANON}|" .env.local
  else
    sed -i "s|^VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=http://localhost:${KONG_PORT}|" .env.local
    sed -i "s|^VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=${ANON}|" .env.local
  fi
fi

echo ""
echo "[TalentGeenie] Local URLs"
echo "  App (Vite):     http://127.0.0.1:${FRONTEND_PORT}"
echo "  Supabase API:   http://localhost:${KONG_PORT}"
echo "  Supabase Studio:http://localhost:${STUDIO_PORT}"
echo ""
echo "[TalentGeenie] Starting Vite (depends on Docker Supabase above)..."
exec npx vite --host 127.0.0.1 --port "${FRONTEND_PORT}" --strictPort
