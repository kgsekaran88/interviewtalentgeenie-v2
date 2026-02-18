#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — Database Bootstrap Script
# =============================================================================
# Runs the fresh-deploy migrations against the self-hosted Supabase PostgreSQL.
# Executed by the db-migrations container after PostgreSQL is healthy.
#
# The supabase/postgres image already provides:
#   - auth schema (GoTrue tables)
#   - storage schema (storage tables)
#   - Required extensions (uuid-ossp, pgcrypto, pgjwt, etc.)
#   - Required roles (anon, authenticated, service_role, etc.)
#
# This script adds our application-specific schema on top.
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[BOOTSTRAP]${NC} $*"; }
warn()  { echo -e "${YELLOW}[BOOTSTRAP]${NC} $*"; }
error() { echo -e "${RED}[BOOTSTRAP]${NC} $*" >&2; }
info()  { echo -e "${BLUE}[BOOTSTRAP]${NC} $*"; }

# ---------------------------------------------------------------------------
# Wait for PostgreSQL to be ready
# ---------------------------------------------------------------------------
log "Waiting for PostgreSQL at ${PGHOST:-db}:${PGPORT:-5432}..."
retries=30
until pg_isready -h "${PGHOST:-db}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -q; do
  retries=$((retries - 1))
  if [ "$retries" -le 0 ]; then
    error "PostgreSQL did not become ready in time. Aborting."
    exit 1
  fi
  sleep 2
done
log "PostgreSQL is ready!"

# ---------------------------------------------------------------------------
# Create migration tracking table
# ---------------------------------------------------------------------------
log "Ensuring migration tracking table exists..."
psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._schema_migrations (
  id          SERIAL PRIMARY KEY,
  version     TEXT NOT NULL UNIQUE,
  filename    TEXT NOT NULL,
  checksum    TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# ---------------------------------------------------------------------------
# Run fresh-deploy migrations (ordered by filename)
# ---------------------------------------------------------------------------
FRESH_DIR="/migrations/fresh-deploy"
INCREMENTAL_DIR="/migrations/incremental"

run_migration() {
  local filepath="$1"
  local filename
  filename=$(basename "$filepath")
  local checksum
  checksum=$(md5sum "$filepath" | awk '{print $1}')

  # Check if already applied
  local applied
  applied=$(psql -tAc "SELECT COUNT(*) FROM public._schema_migrations WHERE filename = '$filename' AND checksum = '$checksum'")

  if [ "$applied" -gt 0 ]; then
    info "  ✓ Already applied: $filename (skipping)"
    return 0
  fi

  # Check if same filename but different checksum (schema drift)
  local drift
  drift=$(psql -tAc "SELECT COUNT(*) FROM public._schema_migrations WHERE filename = '$filename' AND checksum != '$checksum'")

  if [ "$drift" -gt 0 ]; then
    warn "  ⚠ Schema drift detected: $filename (checksum changed)"
    warn "    Re-applying migration..."
    psql -tAc "DELETE FROM public._schema_migrations WHERE filename = '$filename'"
  fi

  log "  → Applying: $filename"
  if psql -v ON_ERROR_STOP=1 -f "$filepath"; then
    psql -v ON_ERROR_STOP=1 -c \
      "INSERT INTO public._schema_migrations (version, filename, checksum) VALUES ('$(date +%Y%m%d%H%M%S)_${filename%.sql}', '$filename', '$checksum')"
    log "  ✓ Applied: $filename"
  else
    error "  ✗ Failed: $filename"
    exit 1
  fi
}

# --- Fresh deploy (base schema) ---
if [ -d "$FRESH_DIR" ]; then
  log "Running fresh-deploy migrations from $FRESH_DIR..."
  file_count=$(find "$FRESH_DIR" -name '*.sql' -type f | wc -l | tr -d ' ')
  log "Found $file_count SQL files"

  for f in $(find "$FRESH_DIR" -name '*.sql' -type f | sort); do
    run_migration "$f"
  done
  log "Fresh-deploy migrations complete!"
else
  warn "No fresh-deploy directory found at $FRESH_DIR"
fi

echo ""

# --- Incremental migrations (from supabase/migrations/) ---
# On a fresh deploy, these are redundant since fresh-deploy already has the
# full schema. We mark them as applied to keep the migration history complete.
if [ -d "$INCREMENTAL_DIR" ]; then
  file_count=$(find "$INCREMENTAL_DIR" -name '*.sql' -type f | wc -l | tr -d ' ')

  # Check if fresh-deploy was just run (any fresh-deploy entries exist)
  fresh_count=$(psql -tAc "SELECT COUNT(*) FROM public._schema_migrations WHERE filename LIKE '0%'" 2>/dev/null || echo "0")

  if [ "$fresh_count" -gt 0 ]; then
    log "Fresh-deploy was applied — marking $file_count incremental migrations as baseline..."
    for f in $(find "$INCREMENTAL_DIR" -name '*.sql' -type f | sort); do
      local_filename=$(basename "$f")
      local_checksum=$(md5sum "$f" | awk '{print $1}')
      already=$(psql -tAc "SELECT COUNT(*) FROM public._schema_migrations WHERE filename = '$local_filename'" 2>/dev/null || echo "0")
      if [ "$already" -gt 0 ]; then
        continue
      fi
      psql -v ON_ERROR_STOP=1 -c \
        "INSERT INTO public._schema_migrations (version, filename, checksum) VALUES ('baseline_${local_filename%.sql}', '$local_filename', '$local_checksum') ON CONFLICT (version) DO NOTHING" 2>/dev/null || true
    done
    log "All incremental migrations marked as baseline."
  else
    log "Running incremental migrations from $INCREMENTAL_DIR..."
    log "Found $file_count SQL files"

    for f in $(find "$INCREMENTAL_DIR" -name '*.sql' -type f | sort); do
      run_migration "$f"
    done
    log "Incremental migrations complete!"
  fi
else
  warn "No incremental directory found at $INCREMENTAL_DIR"
fi

echo ""
log "============================================"
log " Database bootstrap complete!"
log " Total migrations applied:"
psql -c "SELECT COUNT(*) as total, MAX(applied_at) as last_applied FROM public._schema_migrations"
log "============================================"

# ---------------------------------------------------------------------------
# Run post-setup scripts (realtime publication, etc.)
# ---------------------------------------------------------------------------
POST_SETUP_DIR="/migrations/post-setup"
if [ -d "$POST_SETUP_DIR" ]; then
  log "Running post-setup scripts from $POST_SETUP_DIR..."
  for f in $(find "$POST_SETUP_DIR" -name '*.sql' -type f | sort); do
    log "  → Executing: $(basename "$f")"
    psql -v ON_ERROR_STOP=1 -f "$f" || warn "  ⚠ Post-setup script failed: $(basename "$f")"
  done
  log "Post-setup complete!"
fi
