#!/usr/bin/env bash
set -euo pipefail

#######################################################################
# Full Data Migration: Lovable Cloud → Self-Hosted Supabase
#######################################################################

CLOUD_URL="https://ztixorqvwqlwbesihtkr.supabase.co"
EXPORT_SECRET="talentgeenie-migration-2026"
EXPORT_ENDPOINT="${CLOUD_URL}/functions/v1/data-export"

LOCAL_API="http://localhost:8000"
LOCAL_DB_CONTAINER="talentgeenie-db"
LOCAL_SERVICE_KEY="eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc3MTQwNDIzNywgImV4cCI6IDIwODY3NjQyMzd9.6_nqKXwhutXVE2LtPo26yjPILFBbTcv1LBzen3vaf2Y"

TMPDIR_MIG="/tmp/tg-migration-$(date +%s)"
mkdir -p "$TMPDIR_MIG"

TOTAL_IMPORTED=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

export_table() {
  local table="$1"
  local outfile="${TMPDIR_MIG}/${table}.json"
  local offset=0 limit=1000 all_rows="[]" has_more=true
  while [ "$has_more" = "true" ]; do
    local resp
    resp=$(curl -s -X POST "$EXPORT_ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "x-export-secret: $EXPORT_SECRET" \
      -d "{\"action\":\"export-table\",\"table\":\"${table}\",\"offset\":${offset},\"limit\":${limit}}")
    local success=$(echo "$resp" | jq -r '.success // false')
    if [ "$success" != "true" ]; then
      log_error "Failed to export ${table}: $(echo "$resp" | jq -r '.error // "unknown"')"
      return 1
    fi
    local rows_count=$(echo "$resp" | jq '.rows | length')
    all_rows=$(echo "$all_rows" | jq --argjson new "$(echo "$resp" | jq '.rows')" '. + $new')
    has_more=$(echo "$resp" | jq -r '.has_more')
    offset=$((offset + limit))
    [ "$rows_count" -eq 0 ] && has_more=false
  done
  echo "$all_rows" > "$outfile"
  echo "$(echo "$all_rows" | jq 'length')"
}

import_table() {
  local table="$1"
  local datafile="${TMPDIR_MIG}/${table}.json"
  local batch_size=200 imported=0 offset=0
  local total=$(jq 'length' "$datafile")
  [ "$total" -eq 0 ] && echo "0" && return 0
  while [ "$offset" -lt "$total" ]; do
    local batch=$(jq ".[$offset:$((offset + batch_size))]" "$datafile")
    local batch_count=$(echo "$batch" | jq 'length')
    local http_code
    http_code=$(curl -s -o "${TMPDIR_MIG}/resp.txt" -w "%{http_code}" \
      -X POST "${LOCAL_API}/rest/v1/${table}" \
      -H "apikey: ${LOCAL_SERVICE_KEY}" \
      -H "Authorization: Bearer ${LOCAL_SERVICE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: resolution=merge-duplicates" \
      -d "$batch")
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
      imported=$((imported + batch_count))
    else
      log_warn "  ${table} batch HTTP ${http_code}, trying row-by-row..."
      for i in $(seq 0 $((batch_count - 1))); do
        local row=$(echo "$batch" | jq ".[$i]")
        local rc=$(curl -s -o /dev/null -w "%{http_code}" \
          -X POST "${LOCAL_API}/rest/v1/${table}" \
          -H "apikey: ${LOCAL_SERVICE_KEY}" \
          -H "Authorization: Bearer ${LOCAL_SERVICE_KEY}" \
          -H "Content-Type: application/json" \
          -H "Prefer: resolution=merge-duplicates" \
          -d "[$row]")
        [ "$rc" -ge 200 ] && [ "$rc" -lt 300 ] && imported=$((imported + 1))
      done
    fi
    offset=$((offset + batch_size))
  done
  echo "$imported"
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TalentGeenie: Full Cloud → Self-Hosted Data Migration     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verify prereqs
command -v jq &>/dev/null || { log_error "jq required: brew install jq"; exit 1; }
docker exec "$LOCAL_DB_CONTAINER" psql -U supabase_admin -d postgres -c "SELECT 1" &>/dev/null || { log_error "DB not running"; exit 1; }

MANIFEST=$(curl -s -X POST "$EXPORT_ENDPOINT" -H "Content-Type: application/json" -H "x-export-secret: $EXPORT_SECRET" -d '{"action":"manifest"}')
TOTAL_TABLES=$(echo "$MANIFEST" | jq '.tables_with_data')
TOTAL_ROWS=$(echo "$MANIFEST" | jq '.total_rows')
log_ok "Cloud: ${TOTAL_TABLES} tables with data, ${TOTAL_ROWS} total rows"

#######################################################################
# PHASE 1: Auth Users
#######################################################################
echo ""
log_info "━━ PHASE 1: Auth Users ━━"

AUTH_RESP=$(curl -s -X POST "$EXPORT_ENDPOINT" -H "Content-Type: application/json" -H "x-export-secret: $EXPORT_SECRET" -d '{"action":"auth-users","offset":0,"limit":100}')
echo "$AUTH_RESP" | jq '.users' > "${TMPDIR_MIG}/auth_users.json"
AUTH_COUNT=$(jq 'length' "${TMPDIR_MIG}/auth_users.json")
log_info "Exporting ${AUTH_COUNT} Cloud auth users"

# Build SQL for auth user import
AUTH_SQL="${TMPDIR_MIG}/auth_import.sql"
cat > "$AUTH_SQL" << 'SQLHDR'
BEGIN;
ALTER TABLE auth.users DISABLE TRIGGER ALL;
SQLHDR

jq -c '.[]' "${TMPDIR_MIG}/auth_users.json" | while IFS= read -r user; do
  id=$(echo "$user" | jq -r '.id')
  email=$(echo "$user" | jq -r '.email')
  email_confirmed=$(echo "$user" | jq -r '.email_confirmed_at // empty')
  created=$(echo "$user" | jq -r '.created_at')
  updated=$(echo "$user" | jq -r '.updated_at')
  meta=$(echo "$user" | jq -c '.raw_user_meta_data // {}' | sed "s/'/''/g")
  app_meta=$(echo "$user" | jq -c '.raw_app_meta_data // {}' | sed "s/'/''/g")
  role=$(echo "$user" | jq -r '.role // "authenticated"')

  ec_val="NULL"
  [ -n "$email_confirmed" ] && ec_val="'${email_confirmed}'"

  cat >> "$AUTH_SQL" << EOSQL
DELETE FROM auth.users WHERE email = '${email}' AND id != '${id}';
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', '${role}', '${email}', crypt('TempPass123!', gen_salt('bf')), ${ec_val}, '${created}', '${updated}', '${meta}'::jsonb, '${app_meta}'::jsonb, false, '', '', '', '')
ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, raw_user_meta_data=EXCLUDED.raw_user_meta_data, raw_app_meta_data=EXCLUDED.raw_app_meta_data, updated_at=EXCLUDED.updated_at, email_confirmed_at=EXCLUDED.email_confirmed_at;
EOSQL
done

cat >> "$AUTH_SQL" << 'SQLFTR'
ALTER TABLE auth.users ENABLE TRIGGER ALL;
UPDATE auth.users SET encrypted_password = crypt('Admin@TG2026!', gen_salt('bf')) WHERE email = 'admin@talentgeenie.com';
UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) WHERE email_confirmed_at IS NULL;
COMMIT;
SQLFTR

docker exec -i "$LOCAL_DB_CONTAINER" psql -U supabase_admin -d postgres < "$AUTH_SQL" 2>&1 | grep -E "ERROR|COMMIT|BEGIN" || true
log_ok "Auth users imported"

#######################################################################
# PHASE 2: Disable triggers, import all tables
#######################################################################
echo ""
log_info "━━ PHASE 2: Import ${TOTAL_TABLES} tables (${TOTAL_ROWS} rows) ━━"

docker exec "$LOCAL_DB_CONTAINER" psql -U supabase_admin -d postgres -c "
DO \$\$DECLARE r RECORD;
BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE TRIGGER ALL';
END LOOP; END\$\$;" 2>/dev/null

# Import order (dependency-aware)
ORDERED_TABLES=(
  organizations subscription_plans email_templates system_config
  platform_configurations platform_documentation circuit_breaker_state
  architecture_documents learning_plans test_suites
  profiles user_roles onboarding_progress
  organization_members partner_applications password_setup_invitations usage_tracking
  interviews interview_templates email_verification_tokens
  questions assessments interview_attempts interview_invitations interview_operation_logs
  audit_logs email_logs notifications
)

for table in "${ORDERED_TABLES[@]}"; do
  expected=$(echo "$MANIFEST" | jq -r --arg t "$table" '.tables[] | select(.table_name==$t) | .row_count')
  [ -z "$expected" ] || [ "$expected" = "0" ] || [ "$expected" = "null" ] && continue

  log_info "  ${table} (${expected} rows)..."
  exported=$(export_table "$table") || { log_error "  Export failed: ${table}"; continue; }
  imported=$(import_table "$table")
  TOTAL_IMPORTED=$((TOTAL_IMPORTED + imported))
  log_ok "  ${table}: ${imported}/${expected} imported"
done

# Catch any tables not in our ordered list
TABLES_WITH_DATA=$(echo "$MANIFEST" | jq -r '.tables[] | select(.row_count > 0) | .table_name')
for table in $TABLES_WITH_DATA; do
  found=false
  for known in "${ORDERED_TABLES[@]}"; do [ "$known" = "$table" ] && found=true && break; done
  if [ "$found" = "false" ]; then
    expected=$(echo "$MANIFEST" | jq -r --arg t "$table" '.tables[] | select(.table_name==$t) | .row_count')
    log_warn "  Extra table: ${table} (${expected} rows)..."
    exported=$(export_table "$table") || continue
    imported=$(import_table "$table")
    TOTAL_IMPORTED=$((TOTAL_IMPORTED + imported))
    log_ok "  ${table}: ${imported}/${expected} imported"
  fi
done

# Re-enable triggers
docker exec "$LOCAL_DB_CONTAINER" psql -U supabase_admin -d postgres -c "
DO \$\$DECLARE r RECORD;
BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE TRIGGER ALL';
END LOOP; END\$\$;" 2>/dev/null

#######################################################################
# PHASE 3: Preserve local admin + E2E roles
#######################################################################
echo ""
log_info "━━ PHASE 3: Preserve admin & E2E roles ━━"
docker exec "$LOCAL_DB_CONTAINER" psql -U supabase_admin -d postgres -c "
INSERT INTO public.user_roles (user_id, role) SELECT id, 'platform_admin'::app_role FROM auth.users WHERE email='admin@talentgeenie.com' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'platform_admin'::app_role FROM auth.users WHERE email='e2e-admin@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'partner_admin'::app_role FROM auth.users WHERE email='e2e-partner@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'hr_recruiter'::app_role FROM auth.users WHERE email='e2e-hr@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'tech_spoc'::app_role FROM auth.users WHERE email='e2e-tech@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'guest'::app_role FROM auth.users WHERE email='e2e-guest@talentgeenie.test' ON CONFLICT DO NOTHING;
" 2>&1 | grep -v "INSERT" || true
log_ok "Roles preserved"

#######################################################################
# PHASE 4: Verification
#######################################################################
echo ""
log_info "━━ PHASE 4: Verification ━━"
docker exec "$LOCAL_DB_CONTAINER" psql -U supabase_admin -d postgres -c "
SELECT 'auth.users' as table_name, count(*) FROM auth.users
UNION ALL SELECT 'organizations', count(*) FROM public.organizations
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
UNION ALL SELECT 'organization_members', count(*) FROM public.organization_members
UNION ALL SELECT 'interviews', count(*) FROM public.interviews
UNION ALL SELECT 'questions', count(*) FROM public.questions
UNION ALL SELECT 'assessments', count(*) FROM public.assessments
UNION ALL SELECT 'interview_attempts', count(*) FROM public.interview_attempts
UNION ALL SELECT 'interview_invitations', count(*) FROM public.interview_invitations
UNION ALL SELECT 'interview_templates', count(*) FROM public.interview_templates
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs
UNION ALL SELECT 'email_logs', count(*) FROM public.email_logs
UNION ALL SELECT 'email_templates', count(*) FROM public.email_templates
UNION ALL SELECT 'subscription_plans', count(*) FROM public.subscription_plans
UNION ALL SELECT 'partner_applications', count(*) FROM public.partner_applications
UNION ALL SELECT 'architecture_documents', count(*) FROM public.architecture_documents
ORDER BY 1;"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Migration Complete! Total imported: ${TOTAL_IMPORTED} rows            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
log_info "Admin: admin@talentgeenie.com / Admin@TG2026!"
log_info "Temp files: ${TMPDIR_MIG}"
