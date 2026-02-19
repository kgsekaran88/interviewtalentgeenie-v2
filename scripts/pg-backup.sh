#!/bin/bash
# ============================================================================
# pg-backup.sh - Automated PostgreSQL Backup for TalentGeenie
# ============================================================================
# Creates full pg_dump backups with:
#   - Schema + data dump (restorable)
#   - 30-day retention with automatic cleanup
#   - Compressed output (.sql.gz)
#   - Manifest with row counts
#   - Pre-operation snapshot mode (--snapshot flag)
#
# Usage:
#   ./scripts/pg-backup.sh                    # Regular backup
#   ./scripts/pg-backup.sh --snapshot         # Pre-operation snapshot (no retention cleanup)
#   ./scripts/pg-backup.sh --retention 60     # Custom retention (60 days)
#
# Restore:
#   gunzip < backups/pg/YYYYMMDD_HHMMSS/talentgeenie_full.sql.gz | \
#     docker exec -i talentgeenie-db psql -U supabase_admin -d postgres
# ============================================================================

set -euo pipefail

# ── Configuration ──
CONTAINER="talentgeenie-db"
DB_USER="supabase_admin"
DB_NAME="postgres"
BACKUP_ROOT="$(cd "$(dirname "$0")/.." && pwd)/backups/pg"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
SNAPSHOT_MODE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --snapshot) SNAPSHOT_MODE=true; shift ;;
    --retention) RETENTION_DAYS="$2"; shift 2 ;;
    *) echo -e "${RED}Unknown argument: $1${NC}"; exit 1 ;;
  esac
done

BACKUP_DIR="${BACKUP_ROOT}/${DATE}"

# ── Pre-flight checks ──
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       TalentGeenie Database Backup              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}✗ Container '${CONTAINER}' is not running${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Database container running${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ── Full database dump ──
echo -e "${YELLOW}⏳ Creating full database dump...${NC}"

docker exec "$CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --schema=public \
  --schema=auth \
  --schema=storage \
  2>/dev/null | gzip > "$BACKUP_DIR/talentgeenie_full.sql.gz"

DUMP_SIZE=$(du -sh "$BACKUP_DIR/talentgeenie_full.sql.gz" | cut -f1)
echo -e "${GREEN}✓ Full dump: ${DUMP_SIZE}${NC}"

# ── Schema-only dump (for reference) ──
echo -e "${YELLOW}⏳ Creating schema-only dump...${NC}"

docker exec "$CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema-only \
  --no-owner \
  --no-acl \
  --schema=public \
  2>/dev/null | gzip > "$BACKUP_DIR/schema_only.sql.gz"

echo -e "${GREEN}✓ Schema dump created${NC}"

# ── Auth users backup ──
echo -e "${YELLOW}⏳ Backing up auth users...${NC}"

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "COPY (SELECT id, email, encrypted_password, role, created_at, confirmed_at, email_confirmed_at, raw_user_meta_data FROM auth.users ORDER BY created_at) TO STDOUT WITH CSV HEADER" \
  2>/dev/null > "$BACKUP_DIR/auth_users.csv"

AUTH_COUNT=$(wc -l < "$BACKUP_DIR/auth_users.csv" | tr -d ' ')
AUTH_COUNT=$((AUTH_COUNT - 1))  # subtract header
echo -e "${GREEN}✓ Auth users: ${AUTH_COUNT} records${NC}"

# ── Row counts manifest ──
echo -e "${YELLOW}⏳ Generating manifest...${NC}"

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' \
  -c "SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count FROM (SELECT table_name, query_to_xml(format('SELECT COUNT(*) AS cnt FROM public.%I', table_name), false, true, '') AS xml_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') t ORDER BY row_count DESC" \
  2>/dev/null > "$BACKUP_DIR/row_counts.txt"

# Build JSON manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "container": "${CONTAINER}",
  "database": "${DB_NAME}",
  "type": "$([ "$SNAPSHOT_MODE" = true ] && echo 'snapshot' || echo 'scheduled')",
  "dump_size": "${DUMP_SIZE}",
  "auth_users": ${AUTH_COUNT},
  "retention_days": ${RETENTION_DAYS},
  "files": [
    "talentgeenie_full.sql.gz",
    "schema_only.sql.gz",
    "auth_users.csv",
    "row_counts.txt"
  ]
}
EOF

echo -e "${GREEN}✓ Manifest generated${NC}"

# ── Show top tables by row count ──
echo ""
echo -e "${BLUE}── Top tables by row count ──${NC}"
head -20 "$BACKUP_DIR/row_counts.txt" | while IFS='|' read -r table count; do
  if [ -n "$table" ] && [ -n "$count" ]; then
    printf "  %-40s %s rows\n" "$table" "$count"
  fi
done

# ── Retention cleanup (skip in snapshot mode) ──
if [ "$SNAPSHOT_MODE" = false ] && [ -d "$BACKUP_ROOT" ]; then
  echo ""
  echo -e "${YELLOW}⏳ Cleaning up backups older than ${RETENTION_DAYS} days...${NC}"
  
  DELETED=0
  for old_backup in "$BACKUP_ROOT"/*/; do
    if [ -d "$old_backup" ] && [ "$old_backup" != "$BACKUP_DIR/" ]; then
      # Get directory age in days
      dir_date=$(basename "$old_backup" | cut -d'_' -f1)
      if [[ "$dir_date" =~ ^[0-9]{8}$ ]]; then
        dir_epoch=$(date -j -f "%Y%m%d" "$dir_date" "+%s" 2>/dev/null || date -d "$dir_date" "+%s" 2>/dev/null || echo "0")
        now_epoch=$(date "+%s")
        age_days=$(( (now_epoch - dir_epoch) / 86400 ))
        
        if [ "$age_days" -gt "$RETENTION_DAYS" ]; then
          rm -rf "$old_backup"
          DELETED=$((DELETED + 1))
        fi
      fi
    fi
  done
  
  if [ "$DELETED" -gt 0 ]; then
    echo -e "${GREEN}✓ Removed ${DELETED} expired backup(s)${NC}"
  else
    echo -e "${GREEN}✓ No expired backups to remove${NC}"
  fi
fi

# ── Summary ──
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Backup Complete                                ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Location: ${BACKUP_DIR}${NC}"
echo -e "${GREEN}║  Size: ${DUMP_SIZE}${NC}"
echo -e "${GREEN}║  Auth users: ${AUTH_COUNT}${NC}"
echo -e "${GREEN}║  Type: $([ "$SNAPSHOT_MODE" = true ] && echo 'Pre-operation snapshot' || echo "Scheduled (${RETENTION_DAYS}-day retention)")${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}To restore:${NC}"
echo "  gunzip < ${BACKUP_DIR}/talentgeenie_full.sql.gz | \\"
echo "    docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}"
