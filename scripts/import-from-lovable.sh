#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — Import Data from Lovable Cloud to Self-Hosted
# =============================================================================
# 
# This script:
#   1. Calls the data-export edge function on your Lovable Supabase project
#   2. Downloads all table data as JSON
#   3. Imports into your local self-hosted Postgres
#   4. Imports auth users (they will need to reset passwords)
#
# Prerequisites:
#   - Deploy data-export edge function to your Lovable project first
#   - Self-hosted Supabase stack running (make up)
#   - jq installed (brew install jq)
#
# Usage:
#   ./scripts/import-from-lovable.sh
#   ./scripts/import-from-lovable.sh --dry-run        # Preview only
#   ./scripts/import-from-lovable.sh --tables-only     # Skip auth users
#   ./scripts/import-from-lovable.sh --auth-only       # Auth users only
#   ./scripts/import-from-lovable.sh --table profiles  # Single table
# =============================================================================

set -euo pipefail

# ---- Configuration ----
CLOUD_URL="https://ztixorqvwqlwbesihtkr.supabase.co"
CLOUD_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aXhvcnF2d3Fsd2Jlc2lodGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTQwODEsImV4cCI6MjA4NjM3MDA4MX0.edID8_QmEIU8v-WLyne2hJHEReWIuaSGFwtHCmoyujs"
EXPORT_SECRET="talentgeenie-migration-2026"
EXPORT_FUNCTION_URL="${CLOUD_URL}/functions/v1/data-export"

# Local self-hosted config (read from .env.supabase)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.supabase"

LOCAL_KONG_PORT=8000
LOCAL_DB_CONTAINER="supabase-db"
LOCAL_DB_NAME="postgres"
LOCAL_DB_USER="postgres"

PAGE_SIZE=500
DATA_DIR="${PROJECT_ROOT}/.migration-data"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[import]${NC} $*"; }
warn()  { echo -e "${YELLOW}[import]${NC} $*"; }
error() { echo -e "${RED}[import]${NC} $*" >&2; }
info()  { echo -e "${BLUE}[import]${NC} $*"; }

# ---- Parse arguments ----
DRY_RUN=false
TABLES_ONLY=false
AUTH_ONLY=false
SINGLE_TABLE=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=true ;;
    --tables-only)  TABLES_ONLY=true ;;
    --auth-only)    AUTH_ONLY=true ;;
    --table)        shift; SINGLE_TABLE="${2:-}" ;;
    --table=*)      SINGLE_TABLE="${arg#--table=}" ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--tables-only] [--auth-only] [--table=name]"
      exit 0
      ;;
  esac
done

# ---- Pre-flight checks ----
if ! command -v jq &>/dev/null; then
  error "jq is required. Install with: brew install jq"
  exit 1
fi

if ! command -v curl &>/dev/null; then
  error "curl is required."
  exit 1
fi

# Load local env
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE" 2>/dev/null || true
  set +a
  LOCAL_KONG_PORT="${KONG_HTTP_PORT:-8000}"
  LOCAL_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
  LOCAL_PG_PASS="${POSTGRES_PASSWORD:-}"
else
  warn "No .env.supabase found. Make sure self-hosted stack is running."
fi

# Check Docker is running
if ! docker ps &>/dev/null; then
  error "Docker is not running. Start Docker Desktop first."
  exit 1
fi

# Check if local Supabase is up
if ! curl -sf "http://localhost:${LOCAL_KONG_PORT}/rest/v1/" -o /dev/null 2>/dev/null; then
  error "Local Supabase is not running. Run 'make up' first."
  exit 1
fi

mkdir -p "$DATA_DIR"

log "╔═══════════════════════════════════════════════════════╗"
log "║   TalentGeenie — Cloud → Self-Hosted Data Migration  ║"
log "╚═══════════════════════════════════════════════════════╝"
echo ""
info "Cloud:  ${CLOUD_URL}"
info "Local:  http://localhost:${LOCAL_KONG_PORT}"
info "Data:   ${DATA_DIR}"
echo ""

# ---- Helper: call export function ----
call_export() {
  local payload="$1"
  local response
  response=$(curl -sf -X POST "$EXPORT_FUNCTION_URL" \
    -H "Authorization: Bearer ${CLOUD_ANON_KEY}" \
    -H "apikey: ${CLOUD_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "x-export-secret: ${EXPORT_SECRET}" \
    -d "$payload" 2>/dev/null) || {
    echo '{"error":"Failed to call export function"}'
    return 1
  }
  echo "$response"
}

# ---- Helper: run SQL on local DB ----
local_psql() {
  docker exec -i "${LOCAL_DB_CONTAINER}" psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" "$@"
}

# ---- Helper: insert data via local PostgREST ----
local_insert() {
  local table="$1"
  local json_file="$2"
  local row_count
  row_count=$(jq 'length' "$json_file")

  if [ "$row_count" -eq 0 ]; then
    info "  ${table}: no data to import"
    return 0
  fi

  # Use PostgREST bulk insert with upsert (merge duplicates on primary key)
  local http_code
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "http://localhost:${LOCAL_KONG_PORT}/rest/v1/${table}" \
    -H "Authorization: Bearer ${LOCAL_SERVICE_ROLE_KEY}" \
    -H "apikey: ${LOCAL_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d @"$json_file" 2>/dev/null) || http_code="000"

  if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
    log "  ${table}: imported ${row_count} rows ✓"
    return 0
  else
    # Try without merge-duplicates (for tables without PKs)
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
      -X POST "http://localhost:${LOCAL_KONG_PORT}/rest/v1/${table}" \
      -H "Authorization: Bearer ${LOCAL_SERVICE_ROLE_KEY}" \
      -H "apikey: ${LOCAL_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d @"$json_file" 2>/dev/null) || http_code="000"

    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
      log "  ${table}: imported ${row_count} rows ✓"
      return 0
    else
      warn "  ${table}: failed (HTTP ${http_code}), will retry via psql"
      return 1
    fi
  fi
}

# ---- Helper: import via psql as fallback ----
psql_insert() {
  local table="$1"
  local json_file="$2"

  # Generate INSERT SQL from JSON using jq
  local row_count
  row_count=$(jq 'length' "$json_file")

  if [ "$row_count" -eq 0 ]; then
    return 0
  fi

  # Get column names from first row
  local columns
  columns=$(jq -r '.[0] | keys | join(", ")' "$json_file")

  # Generate a temp SQL file
  local sql_file="${DATA_DIR}/${table}_insert.sql"
  
  # Use jq to create a COPY-compatible format
  # But for reliability, use individual INSERTs wrapped in a transaction
  {
    echo "BEGIN;"
    echo "-- Importing ${row_count} rows into ${table}"
    jq -r --arg table "$table" '
      def escape_sql:
        if . == null then "NULL"
        elif type == "boolean" then (if . then "TRUE" else "FALSE" end)
        elif type == "number" then tostring
        elif type == "array" or type == "object" then (tostring | gsub("'"'"'"; "'"'"''"'"'") | "'"'"'" + . + "'"'"'"  + "::jsonb")
        else (tostring | gsub("'"'"'"; "'"'"''"'"'") | "'"'"'" + . + "'"'"'")
        end;
      .[] |
      "INSERT INTO public.\($table) (" + (keys | join(", ")) + ") VALUES (" + ([.[] | escape_sql] | join(", ")) + ") ON CONFLICT DO NOTHING;"
    ' "$json_file"
    echo "COMMIT;"
  } > "$sql_file"

  # Execute
  if local_psql -f "$sql_file" > /dev/null 2>&1; then
    log "  ${table}: imported ${row_count} rows via psql ✓"
    rm -f "$sql_file"
    return 0
  else
    error "  ${table}: psql import failed"
    return 1
  fi
}

# ==========================================================================
# STEP 1: Get manifest (table list + row counts)
# ==========================================================================
if [ "$AUTH_ONLY" = false ]; then
  log "Step 1: Fetching table manifest from Cloud..."

  MANIFEST=$(call_export '{"action":"manifest"}')

  if echo "$MANIFEST" | jq -e '.error' > /dev/null 2>&1; then
    error "Failed to get manifest: $(echo "$MANIFEST" | jq -r '.error')"
    error ""
    error "Make sure the data-export function is deployed to your Lovable project."
    error "Copy interviewtalentgeenie/supabase/functions/data-export/ to your project."
    exit 1
  fi

  TOTAL_TABLES=$(echo "$MANIFEST" | jq '.total_tables')
  TOTAL_ROWS=$(echo "$MANIFEST" | jq '.total_rows')
  
  echo "$MANIFEST" | jq '.' > "${DATA_DIR}/manifest.json"

  log "Found ${TOTAL_TABLES} tables with ${TOTAL_ROWS} total rows"
  echo ""

  # Show table summary
  echo "$MANIFEST" | jq -r '.tables[] | select(.count > 0) | "  \(.table): \(.count) rows"'
  echo ""

  if [ "$DRY_RUN" = true ]; then
    log "Dry run complete. Tables and row counts above."
    echo ""
    info "To run the actual migration:"
    info "  $0"
    exit 0
  fi

  # ==========================================================================
  # STEP 2: Export all tables from Cloud
  # ==========================================================================
  log "Step 2: Downloading table data from Cloud..."
  echo ""

  # Get list of tables with data
  TABLES_WITH_DATA=$(echo "$MANIFEST" | jq -r '.tables[] | select(.count > 0) | .table')

  if [ -n "$SINGLE_TABLE" ]; then
    TABLES_WITH_DATA="$SINGLE_TABLE"
  fi

  for table in $TABLES_WITH_DATA; do
    TOTAL=$(echo "$MANIFEST" | jq -r ".tables[] | select(.table == \"${table}\") | .count")
    
    if [ -z "$TOTAL" ] || [ "$TOTAL" = "null" ]; then
      TOTAL=0
    fi

    info "  Downloading ${table} (${TOTAL} rows)..."

    # Paginated download
    ALL_ROWS="[]"
    OFFSET=0

    while true; do
      RESPONSE=$(call_export "{\"action\":\"export-table\",\"table\":\"${table}\",\"offset\":${OFFSET},\"limit\":${PAGE_SIZE}}")
      
      if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        warn "    Error exporting ${table}: $(echo "$RESPONSE" | jq -r '.error')"
        break
      fi

      ROWS=$(echo "$RESPONSE" | jq '.rows')
      ROW_COUNT=$(echo "$ROWS" | jq 'length')
      HAS_MORE=$(echo "$RESPONSE" | jq '.has_more')

      # Merge rows
      ALL_ROWS=$(echo "$ALL_ROWS" "$ROWS" | jq -s '.[0] + .[1]')

      OFFSET=$((OFFSET + PAGE_SIZE))

      if [ "$HAS_MORE" != "true" ] || [ "$ROW_COUNT" -eq 0 ]; then
        break
      fi
    done

    # Save to file
    FINAL_COUNT=$(echo "$ALL_ROWS" | jq 'length')
    echo "$ALL_ROWS" > "${DATA_DIR}/${table}.json"
    log "    ${table}: saved ${FINAL_COUNT} rows"
  done

  echo ""

  # ==========================================================================
  # STEP 3: Import into local Postgres
  # ==========================================================================
  log "Step 3: Importing data into local self-hosted Postgres..."
  echo ""

  # Disable FK constraints and triggers for bulk import
  log "Disabling foreign key checks..."
  local_psql -c "SET session_replication_role = 'replica';" 2>/dev/null || true

  FAILED_TABLES=()

  for table in $TABLES_WITH_DATA; do
    JSON_FILE="${DATA_DIR}/${table}.json"

    if [ ! -f "$JSON_FILE" ]; then
      continue
    fi

    ROW_COUNT=$(jq 'length' "$JSON_FILE")
    if [ "$ROW_COUNT" -eq 0 ]; then
      continue
    fi

    # Try PostgREST first (fastest), fall back to psql
    if ! local_insert "$table" "$JSON_FILE"; then
      psql_insert "$table" "$JSON_FILE" || {
        FAILED_TABLES+=("$table")
        warn "  ${table}: FAILED — manual import needed"
      }
    fi
  done

  # Re-enable FK constraints
  log "Re-enabling foreign key checks..."
  local_psql -c "SET session_replication_role = 'origin';" 2>/dev/null || true

  echo ""

  if [ ${#FAILED_TABLES[@]} -gt 0 ]; then
    warn "Failed tables (${#FAILED_TABLES[@]}):"
    for t in "${FAILED_TABLES[@]}"; do
      warn "  - ${t} (JSON saved at ${DATA_DIR}/${t}.json)"
    done
    echo ""
  fi
fi

# ==========================================================================
# STEP 4: Import auth users
# ==========================================================================
if [ "$TABLES_ONLY" = false ]; then
  log "Step 4: Importing auth users..."
  echo ""

  AUTH_PAGE=1
  AUTH_TOTAL=0
  AUTH_IMPORTED=0

  while true; do
    RESPONSE=$(call_export "{\"action\":\"auth-users\",\"page\":${AUTH_PAGE},\"per_page\":${PAGE_SIZE}}")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
      warn "Error fetching auth users: $(echo "$RESPONSE" | jq -r '.error')"
      break
    fi

    USERS=$(echo "$RESPONSE" | jq '.users')
    USER_COUNT=$(echo "$USERS" | jq 'length')
    HAS_MORE=$(echo "$RESPONSE" | jq '.has_more')

    if [ "$USER_COUNT" -eq 0 ]; then
      break
    fi

    # Save auth users
    echo "$USERS" >> "${DATA_DIR}/auth_users.json"

    # Import each user via local GoTrue admin API
    for i in $(seq 0 $((USER_COUNT - 1))); do
      USER=$(echo "$USERS" | jq ".[$i]")
      USER_ID=$(echo "$USER" | jq -r '.id')
      USER_EMAIL=$(echo "$USER" | jq -r '.email // empty')
      USER_PHONE=$(echo "$USER" | jq -r '.phone // empty')
      USER_META=$(echo "$USER" | jq -c '.user_metadata // {}')
      APP_META=$(echo "$USER" | jq -c '.app_metadata // {}')
      CREATED_AT=$(echo "$USER" | jq -r '.created_at // empty')
      EMAIL_CONFIRMED=$(echo "$USER" | jq -r '.email_confirmed_at // empty')

      # Insert directly into auth.users via psql (preserves UUIDs and avoids password issues)
      SQL="INSERT INTO auth.users (
        instance_id, id, aud, role, email, phone,
        encrypted_password, email_confirmed_at, 
        created_at, updated_at, 
        raw_user_meta_data, raw_app_meta_data,
        is_super_admin, confirmation_token, recovery_token, email_change_token_new,
        email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        '${USER_ID}',
        'authenticated',
        'authenticated',
        $([ -n "$USER_EMAIL" ] && echo "'${USER_EMAIL}'" || echo "NULL"),
        $([ -n "$USER_PHONE" ] && echo "'${USER_PHONE}'" || echo "NULL"),
        '\$2a\$10\$PznXGOpJN2M.gGHM0RqGJuTBjUiHnRBtFKDAJ6cUziMRBVH3UQaAm',
        $([ -n "$EMAIL_CONFIRMED" ] && echo "'${EMAIL_CONFIRMED}'" || echo "NOW()"),
        $([ -n "$CREATED_AT" ] && echo "'${CREATED_AT}'" || echo "NOW()"),
        NOW(),
        '${USER_META}'::jsonb,
        '${APP_META}'::jsonb,
        false, '', '', '', ''
      ) ON CONFLICT (id) DO NOTHING;"

      if echo "$SQL" | local_psql > /dev/null 2>&1; then
        AUTH_IMPORTED=$((AUTH_IMPORTED + 1))
      else
        warn "  Failed to import user: ${USER_EMAIL:-$USER_ID}"
      fi
    done

    AUTH_TOTAL=$((AUTH_TOTAL + USER_COUNT))

    if [ "$HAS_MORE" != "true" ]; then
      break
    fi

    AUTH_PAGE=$((AUTH_PAGE + 1))
  done

  log "Auth users: ${AUTH_IMPORTED}/${AUTH_TOTAL} imported"
  warn "⚠ Users will need to reset passwords (use 'Forgot Password' flow)"
  echo ""
fi

# ==========================================================================
# Summary
# ==========================================================================
log "╔═══════════════════════════════════════════════════════╗"
log "║   Migration Complete!                                ║"
log "╚═══════════════════════════════════════════════════════╝"
echo ""
info "Data saved to: ${DATA_DIR}/"
info "You can re-run specific tables: $0 --table=table_name"
echo ""
warn "IMPORTANT next steps:"
warn "  1. Users must reset passwords via 'Forgot Password'"
warn "  2. Storage files need manual download from Cloud (signed URLs)"
warn "  3. Remove the data-export function from your Lovable project"
warn "  4. Delete migration data: rm -rf ${DATA_DIR}/"
echo ""
