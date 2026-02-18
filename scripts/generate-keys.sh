#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — JWT Key Generator
# =============================================================================
# Generates JWT_SECRET, ANON_KEY, and SERVICE_ROLE_KEY for self-hosted Supabase.
#
# Usage:
#   ./scripts/generate-keys.sh                    # Print to stdout
#   ./scripts/generate-keys.sh > .env.supabase    # Write to env file
#   ./scripts/generate-keys.sh --append .env.supabase  # Append to existing
#
# Requirements: openssl, python3 (or node) for JWT encoding
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APPEND_FILE=""
if [ "${1:-}" = "--append" ] && [ -n "${2:-}" ]; then
  APPEND_FILE="$2"
fi

# ---------------------------------------------------------------------------
# Generate a random JWT secret (64 chars, base64url-safe)
# ---------------------------------------------------------------------------
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')
# Ensure at least 32 characters
if [ ${#JWT_SECRET} -lt 32 ]; then
  JWT_SECRET="${JWT_SECRET}$(openssl rand -hex 16)"
fi

# ---------------------------------------------------------------------------
# JWT generation — use Python3 (preinstalled on macOS/most Linux)
# Falls back to Node.js if Python not available.
# ---------------------------------------------------------------------------
generate_jwt() {
  local role="$1"
  local iss="supabase"
  # Expire in ~10 years (for local dev)
  local iat
  iat=$(date +%s)
  local exp=$((iat + 315360000))

  # Try Python3 first
  if command -v python3 &>/dev/null; then
    python3 -c "
import hmac, hashlib, base64, json

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header = b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
payload = b64url(json.dumps({
    'role': '${role}',
    'iss': '${iss}',
    'iat': ${iat},
    'exp': ${exp}
}).encode())

signing_input = f'{header}.{payload}'
signature = hmac.new(
    '${JWT_SECRET}'.encode(),
    signing_input.encode(),
    hashlib.sha256
).digest()
sig = b64url(signature)
print(f'{signing_input}.{sig}')
"
    return
  fi

  # Fallback: Node.js
  if command -v node &>/dev/null; then
    node -e "
const crypto = require('crypto');
function b64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
}
const header = b64url(Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT'})));
const payload = b64url(Buffer.from(JSON.stringify({
  role: '${role}', iss: '${iss}', iat: ${iat}, exp: ${exp}
})));
const sig = b64url(crypto.createHmac('sha256', '${JWT_SECRET}').update(header + '.' + payload).digest());
console.log(header + '.' + payload + '.' + sig);
"
    return
  fi

  echo >&2 "ERROR: Neither python3 nor node found. Cannot generate JWT."
  exit 1
}

ANON_KEY=$(generate_jwt "anon")
SERVICE_ROLE_KEY=$(generate_jwt "service_role")

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
output_lines="# =============================================================================
# TalentGeenie — Self-Hosted Supabase Keys (auto-generated)
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# =============================================================================
# ⚠️  These keys are for LOCAL DEVELOPMENT only.
# ⚠️  Generate new keys for staging/production environments.
# =============================================================================

JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"

if [ -n "$APPEND_FILE" ]; then
  echo "" >> "$APPEND_FILE"
  echo "$output_lines" >> "$APPEND_FILE"
  echo -e "${GREEN}Keys appended to ${APPEND_FILE}${NC}" >&2
else
  echo "$output_lines"
fi

# Print summary to stderr (so stdout can be piped)
echo "" >&2
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}" >&2
echo -e "${GREEN} JWT Keys Generated Successfully${NC}" >&2
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}" >&2
echo -e "${BLUE}JWT_SECRET:${NC}      ${JWT_SECRET:0:20}..." >&2
echo -e "${BLUE}ANON_KEY:${NC}        ${ANON_KEY:0:40}..." >&2
echo -e "${BLUE}SERVICE_ROLE_KEY:${NC} ${SERVICE_ROLE_KEY:0:40}..." >&2
echo "" >&2
echo -e "${YELLOW}Usage:${NC}" >&2
echo -e "  Copy the above into your ${BLUE}.env.supabase${NC} file," >&2
echo -e "  or run: ${BLUE}./scripts/generate-keys.sh --append .env.supabase${NC}" >&2
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}" >&2
