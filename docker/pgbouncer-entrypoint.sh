#!/bin/sh
set -e

# PgBouncer entrypoint for Supabase multi-role setup
# Generates userlist.txt and pgbouncer.ini from environment variables

PASS="${POSTGRES_PASSWORD:-postgres}"
DB_HOST="${PGBOUNCER_DB_HOST:-db}"
DB_PORT="${PGBOUNCER_DB_PORT:-5432}"
LISTEN_PORT="${PGBOUNCER_LISTEN_PORT:-6432}"
POOL_MODE="${PGBOUNCER_POOL_MODE:-transaction}"
DEFAULT_POOL_SIZE="${PGBOUNCER_DEFAULT_POOL_SIZE:-25}"
MAX_CLIENT_CONN="${PGBOUNCER_MAX_CLIENT_CONN:-1000}"
MAX_DB_CONNECTIONS="${PGBOUNCER_MAX_DB_CONNECTIONS:-100}"

CONFIG_DIR="/etc/pgbouncer"
mkdir -p "$CONFIG_DIR"

# Generate userlist.txt with all Supabase roles
# All roles use the same POSTGRES_PASSWORD in self-hosted Supabase
cat > "$CONFIG_DIR/userlist.txt" << EOF
"postgres" "${PASS}"
"supabase_auth_admin" "${PASS}"
"supabase_storage_admin" "${PASS}"
"authenticator" "${PASS}"
"supabase_admin" "${PASS}"
"anon" "${PASS}"
"authenticated" "${PASS}"
"service_role" "${PASS}"
"supabase_functions_admin" "${PASS}"
"dashboard_user" "${PASS}"
EOF

echo "Generated userlist.txt with $(wc -l < "$CONFIG_DIR/userlist.txt") users"

# Generate pgbouncer.ini
cat > "$CONFIG_DIR/pgbouncer.ini" << EOF
[databases]
* = host=${DB_HOST} port=${DB_PORT}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = ${LISTEN_PORT}

; Authentication
auth_type = scram-sha-256
auth_file = ${CONFIG_DIR}/userlist.txt

; Connection pooling
pool_mode = ${POOL_MODE}
default_pool_size = ${DEFAULT_POOL_SIZE}
max_client_conn = ${MAX_CLIENT_CONN}
max_db_connections = ${MAX_DB_CONNECTIONS}
min_pool_size = 2
reserve_pool_size = 5
reserve_pool_timeout = 3

; PostgREST and Storage compatibility
ignore_startup_parameters = extra_float_digits,options

; Reset state when returning connection to pool
server_reset_query = DISCARD ALL

; Timeouts
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15
client_login_timeout = 60
query_wait_timeout = 120

; Logging
admin_users = postgres
stats_users = postgres
log_connections = 0
log_disconnections = 0
EOF

echo "Generated pgbouncer.ini:"
cat "$CONFIG_DIR/pgbouncer.ini"
echo ""
echo "Starting PgBouncer..."

exec pgbouncer "$CONFIG_DIR/pgbouncer.ini"
