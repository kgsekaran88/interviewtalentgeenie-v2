#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — Create Storage Buckets via Storage API
# Run AFTER the self-hosted Supabase stack is fully up (storage API healthy).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env
if [ -f "$ROOT_DIR/.env.supabase" ]; then
  set -a; source "$ROOT_DIR/.env.supabase"; set +a
fi

KONG_URL="${API_EXTERNAL_URL:-http://localhost:8000}"
SRK="${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY not set}"

create_bucket() {
  local id="$1"
  local name="$2"
  local public="$3"
  local file_size_limit="${4:-null}"
  local allowed_mime_types="${5:-null}"

  echo "[storage] Creating bucket: $id (public=$public)"
  
  local body
  body=$(cat <<EOF
{
  "id": "$id",
  "name": "$name",
  "public": $public,
  "file_size_limit": $file_size_limit,
  "allowed_mime_types": $allowed_mime_types
}
EOF
)

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$KONG_URL/storage/v1/bucket" \
    -H "apikey: $SRK" \
    -H "Authorization: Bearer $SRK" \
    -H "Content-Type: application/json" \
    -d "$body")

  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    echo "[storage]   ✓ Created: $id"
  elif [ "$status" = "409" ]; then
    echo "[storage]   → Already exists: $id (updating...)"
    curl -s -o /dev/null \
      -X PUT "$KONG_URL/storage/v1/bucket/$id" \
      -H "apikey: $SRK" \
      -H "Authorization: Bearer $SRK" \
      -H "Content-Type: application/json" \
      -d "$body"
    echo "[storage]   ✓ Updated: $id"
  else
    echo "[storage]   ✗ Failed ($status): $id"
    return 1
  fi
}

echo "═══════════════════════════════════════════════════"
echo " TalentGeenie — Storage Bucket Initialization"
echo "═══════════════════════════════════════════════════"

# Wait for storage API to be ready
echo "[storage] Waiting for Storage API..."
for i in $(seq 1 30); do
  if curl -s "$KONG_URL/storage/v1/bucket" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" > /dev/null 2>&1; then
    echo "[storage] Storage API is ready."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "[storage] ✗ Storage API did not become ready. Aborting."
    exit 1
  fi
  sleep 2
done

# Create buckets
create_bucket "certificates" "certificates" true \
  10485760 '["application/pdf","image/png","image/jpeg"]'

create_bucket "consent-documents" "consent-documents" false \
  10485760 '["application/pdf","image/png","image/jpeg"]'

create_bucket "documentation" "documentation" false \
  10485760 '["application/pdf"]'

create_bucket "proctoring-recordings" "proctoring-recordings" false \
  null null

echo ""
echo "[storage] ✓ All buckets initialized."
echo "═══════════════════════════════════════════════════"
