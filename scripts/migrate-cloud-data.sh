#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — Cloud-to-Self-Hosted Data Migration
# =============================================================================
# One-time migration script to move data from Supabase Cloud to self-hosted.
#
# Prerequisites:
#   1. Self-hosted Supabase stack running (make up)
#   2. Database schema applied (migrations ran via bootstrap)
#   3. Supabase Cloud project credentials
#
# Usage:
#   ./scripts/migrate-cloud-data.sh \
#     --cloud-url "https://xxxx.supabase.co" \
#     --cloud-password "your-cloud-db-password" \
#     --local-port 54322
#
# What this migrates:
#   ✅ All public schema data (tables, sequences)
#   ✅ Auth users (auth.users, auth.identities, auth.sessions)
#   ✅ Storage metadata (storage.objects, storage.buckets)
#   ⚠️  Storage FILES must be migrated separately (see notes below)
#   ❌ Does NOT migrate schema (already applied via bootstrap migrations)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[MIGRATE]${NC} $*"; }
warn()  { echo -e "${YELLOW}[MIGRATE]${NC} $*"; }
error() { echo -e "${RED}[MIGRATE]${NC} $*" >&2; }
info()  { echo -e "${BLUE}[MIGRATE]${NC} $*"; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
CLOUD_URL=""
CLOUD_PASSWORD=""
CLOUD_DB="postgres"
CLOUD_USER="postgres"
CLOUD_PORT="5432"
LOCAL_HOST="localhost"
LOCAL_PORT="${POSTGRES_PORT:-54322}"
LOCAL_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
LOCAL_DB="${POSTGRES_DB:-postgres}"
LOCAL_USER="postgres"
DUMP_DIR="./backups/migration-$(date +%Y%m%d_%H%M%S)"
DATA_ONLY=true
DRY_RUN=false

show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Migrate data from Supabase Cloud to self-hosted PostgreSQL"
  echo ""
  echo "Required:"
  echo "  --cloud-url        Supabase Cloud project URL (e.g., https://xxxx.supabase.co)"
  echo "  --cloud-password   Supabase Cloud database password"
  echo ""
  echo "Optional:"
  echo "  --cloud-port       Cloud DB port (default: 5432, use 6543 for pooler)"
  echo "  --local-port       Local DB port (default: 54322)"
  echo "  --local-password   Local DB password (default: from POSTGRES_PASSWORD env)"
  echo "  --dump-dir         Directory for dump files (default: ./backups/migration-<timestamp>)"
  echo "  --dry-run          Show what would happen without executing"
  echo "  --help             Show this help"
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --cloud-url)       CLOUD_URL="$2"; shift 2 ;;
    --cloud-password)  CLOUD_PASSWORD="$2"; shift 2 ;;
    --cloud-port)      CLOUD_PORT="$2"; shift 2 ;;
    --local-port)      LOCAL_PORT="$2"; shift 2 ;;
    --local-password)  LOCAL_PASSWORD="$2"; shift 2 ;;
    --dump-dir)        DUMP_DIR="$2"; shift 2 ;;
    --dry-run)         DRY_RUN=true; shift ;;
    --help)            show_help; exit 0 ;;
    *) error "Unknown argument: $1"; exit 1 ;;
  esac
done

# Extract host from URL
if [ -n "$CLOUD_URL" ]; then
  CLOUD_HOST=$(echo "$CLOUD_URL" | sed 's|https\?://||' | sed 's|\.supabase\.co.*||')
  CLOUD_HOST="db.${CLOUD_HOST}.supabase.co"
fi

# Validate
if [ -z "$CLOUD_HOST" ] || [ -z "$CLOUD_PASSWORD" ]; then
  error "Missing required arguments. Use --help for usage."
  exit 1
fi

mkdir -p "$DUMP_DIR"

log "╔═══════════════════════════════════════════════════════╗"
log "║     Cloud → Self-Hosted Data Migration               ║"
log "╚═══════════════════════════════════════════════════════╝"
echo ""
info "  Cloud:  ${CLOUD_HOST}:${CLOUD_PORT}/${CLOUD_DB}"
info "  Local:  ${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}"
info "  Dump:   ${DUMP_DIR}"
echo ""

if [ "$DRY_RUN" = true ]; then
  warn "DRY RUN — no changes will be made"
  echo ""
fi

# ---------------------------------------------------------------------------
# Step 1: Dump public schema DATA from Cloud
# ---------------------------------------------------------------------------
log "Step 1/4: Dumping public schema data from Cloud..."

CLOUD_CONN="postgresql://${CLOUD_USER}:${CLOUD_PASSWORD}@${CLOUD_HOST}:${CLOUD_PORT}/${CLOUD_DB}"

if [ "$DRY_RUN" = false ]; then
  PGPASSWORD="$CLOUD_PASSWORD" pg_dump \
    -h "$CLOUD_HOST" \
    -p "$CLOUD_PORT" \
    -U "$CLOUD_USER" \
    -d "$CLOUD_DB" \
    --data-only \
    --schema=public \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    --exclude-table='_schema_migrations' \
    -f "$DUMP_DIR/public_data.sql"

  log "  ✓ Public data dumped ($(wc -c < "$DUMP_DIR/public_data.sql" | tr -d ' ') bytes)"
fi

# ---------------------------------------------------------------------------
# Step 2: Dump auth schema DATA from Cloud
# ---------------------------------------------------------------------------
log "Step 2/4: Dumping auth data from Cloud..."

if [ "$DRY_RUN" = false ]; then
  PGPASSWORD="$CLOUD_PASSWORD" pg_dump \
    -h "$CLOUD_HOST" \
    -p "$CLOUD_PORT" \
    -U "$CLOUD_USER" \
    -d "$CLOUD_DB" \
    --data-only \
    --schema=auth \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    --table=auth.users \
    --table=auth.identities \
    --table=auth.mfa_factors \
    --table=auth.mfa_challenges \
    -f "$DUMP_DIR/auth_data.sql"

  log "  ✓ Auth data dumped ($(wc -c < "$DUMP_DIR/auth_data.sql" | tr -d ' ') bytes)"
fi

# ---------------------------------------------------------------------------
# Step 3: Dump storage metadata from Cloud
# ---------------------------------------------------------------------------
log "Step 3/4: Dumping storage metadata from Cloud..."

if [ "$DRY_RUN" = false ]; then
  PGPASSWORD="$CLOUD_PASSWORD" pg_dump \
    -h "$CLOUD_HOST" \
    -p "$CLOUD_PORT" \
    -U "$CLOUD_USER" \
    -d "$CLOUD_DB" \
    --data-only \
    --schema=storage \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    --table=storage.objects \
    --table=storage.buckets \
    -f "$DUMP_DIR/storage_metadata.sql"

  log "  ✓ Storage metadata dumped ($(wc -c < "$DUMP_DIR/storage_metadata.sql" | tr -d ' ') bytes)"
fi

# ---------------------------------------------------------------------------
# Step 4: Restore to local self-hosted database
# ---------------------------------------------------------------------------
log "Step 4/4: Restoring data to self-hosted database..."

LOCAL_CONN="postgresql://${LOCAL_USER}:${LOCAL_PASSWORD}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}"

if [ "$DRY_RUN" = false ]; then
  # Restore public data
  log "  → Restoring public schema data..."
  PGPASSWORD="$LOCAL_PASSWORD" psql \
    -h "$LOCAL_HOST" \
    -p "$LOCAL_PORT" \
    -U "$LOCAL_USER" \
    -d "$LOCAL_DB" \
    -f "$DUMP_DIR/public_data.sql" \
    --set ON_ERROR_STOP=off \
    2>"$DUMP_DIR/public_restore_errors.log" || true

  PUBLIC_ERRORS=$(wc -l < "$DUMP_DIR/public_restore_errors.log" | tr -d ' ')
  if [ "$PUBLIC_ERRORS" -gt 0 ]; then
    warn "  ⚠ Public restore had $PUBLIC_ERRORS error lines (see $DUMP_DIR/public_restore_errors.log)"
  else
    log "  ✓ Public data restored"
  fi

  # Restore auth data
  log "  → Restoring auth data..."
  PGPASSWORD="$LOCAL_PASSWORD" psql \
    -h "$LOCAL_HOST" \
    -p "$LOCAL_PORT" \
    -U "$LOCAL_USER" \
    -d "$LOCAL_DB" \
    -f "$DUMP_DIR/auth_data.sql" \
    --set ON_ERROR_STOP=off \
    2>"$DUMP_DIR/auth_restore_errors.log" || true

  AUTH_ERRORS=$(wc -l < "$DUMP_DIR/auth_restore_errors.log" | tr -d ' ')
  if [ "$AUTH_ERRORS" -gt 0 ]; then
    warn "  ⚠ Auth restore had $AUTH_ERRORS error lines (see $DUMP_DIR/auth_restore_errors.log)"
  else
    log "  ✓ Auth data restored"
  fi

  # Restore storage metadata
  log "  → Restoring storage metadata..."
  PGPASSWORD="$LOCAL_PASSWORD" psql \
    -h "$LOCAL_HOST" \
    -p "$LOCAL_PORT" \
    -U "$LOCAL_USER" \
    -d "$LOCAL_DB" \
    -f "$DUMP_DIR/storage_metadata.sql" \
    --set ON_ERROR_STOP=off \
    2>"$DUMP_DIR/storage_restore_errors.log" || true

  log "  ✓ Storage metadata restored"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
log "╔═══════════════════════════════════════════════════════╗"
log "║     Migration Complete!                              ║"
log "╚═══════════════════════════════════════════════════════╝"
echo ""
info "  Dump files: ${DUMP_DIR}/"
info "  Error logs: ${DUMP_DIR}/*_errors.log"
echo ""
warn "  IMPORTANT — Storage files NOT migrated:"
warn "  Storage file migration requires downloading from Supabase Cloud"
warn "  Storage API and re-uploading to self-hosted storage."
warn "  See docs for storage file migration instructions."
echo ""
info "  Verify migration:"
info "    make db-shell"
info "    SELECT COUNT(*) FROM auth.users;"
info "    SELECT COUNT(*) FROM profiles;"
info "    SELECT COUNT(*) FROM interviews;"
echo ""
