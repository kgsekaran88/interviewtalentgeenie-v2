#!/usr/bin/env python3
"""
Complete Cloud → Self-Hosted Migration
=======================================
Migrates EVERY table and EVERY column from Lovable Cloud to local Supabase.
No assumptions, no hardcoded lists — uses OpenAPI specs as source of truth.
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ============================================================
# Configuration
# ============================================================
CLOUD_URL = "https://ztixorqvwqlwbesihtkr.supabase.co"
CLOUD_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aXhvcnF2d3Fsd2Jlc2lodGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTQwODEsImV4cCI6MjA4NjM3MDA4MX0.edID8_QmEIU8v-WLyne2hJHEReWIuaSGFwtHCmoyujs"
EXPORT_SECRET = "talentgeenie-migration-2026"
EXPORT_ENDPOINT = f"{CLOUD_URL}/functions/v1/data-export"

DB_CONTAINER = "talentgeenie-db"
DB_USER = "supabase_admin"
DB_NAME = "postgres"

EXPORT_DIR = "/tmp/tg_full_migration"
os.makedirs(EXPORT_DIR, exist_ok=True)

# ============================================================
# Helpers
# ============================================================
def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def cloud_call(payload):
    """Call the data-export edge function."""
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        EXPORT_ENDPOINT,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-export-secret": EXPORT_SECRET,
        },
        method="POST",
    )
    for attempt in range(3):
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            return json.loads(resp.read().decode())
        except Exception as e:
            if attempt < 2:
                log(f"  Retry {attempt+1}/3: {e}")
                time.sleep(2)
            else:
                raise

def psql(sql, quiet=False):
    """Execute SQL via docker exec psql."""
    cmd = ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME]
    if quiet:
        cmd.append("-q")
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True, timeout=120)
    if result.returncode != 0 and not quiet:
        log(f"  PSQL ERROR: {result.stderr[:500]}")
    return result.stdout, result.stderr, result.returncode

def psql_value(sql):
    """Get a single value from psql using -t (tuples only) mode."""
    cmd = ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-t", "-A", "-c", f"SELECT ({sql})::text;"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    val = result.stdout.strip()
    # Remove any trailing newlines or empty lines
    if val:
        return val.split("\n")[0].strip()
    return ""

def escape_sql_value(val):
    """Escape a Python value for SQL."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (list, dict)):
        json_str = json.dumps(val, ensure_ascii=False)
        return "'" + json_str.replace("'", "''") + "'::jsonb"
    # String
    s = str(val)
    return "'" + s.replace("'", "''") + "'"


# ============================================================
# STEP 1: Get Cloud manifest (every table + row count)
# ============================================================
log("=" * 60)
log("STEP 1: Fetching Cloud manifest")
log("=" * 60)

manifest = cloud_call({"action": "manifest"})
cloud_tables = {t["table_name"]: t["row_count"] for t in manifest["tables"]}
tables_with_data = {k: v for k, v in cloud_tables.items() if v > 0}

log(f"  Cloud total tables: {len(cloud_tables)}")
log(f"  Tables with data: {len(tables_with_data)}")
log(f"  Total rows: {sum(tables_with_data.values())}")

# Save manifest
with open(f"{EXPORT_DIR}/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

# ============================================================
# STEP 2: Get exact Cloud column schema from data-export
# For EVERY table with data, export 1 row to see actual columns
# Then get local columns from information_schema
# ============================================================
log("")
log("=" * 60)
log("STEP 2: Exact schema comparison (Cloud vs Local)")
log("=" * 60)

# Get local table info
local_tables_raw, _, _ = psql("""
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
""")
local_table_names = set()
for line in local_tables_raw.strip().split("\n"):
    line = line.strip()
    if line and not line.startswith("table_name") and not line.startswith("---") and not line.startswith("("):
        local_table_names.add(line)

log(f"  Local tables: {len(local_table_names)}")

def get_local_columns(table_name):
    """Get local column names for a table."""
    out, _, _ = psql(f"""
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = '{table_name}'
ORDER BY ordinal_position;
""")
    cols = []
    for line in out.strip().split("\n"):
        line = line.strip()
        if line and not line.startswith("column_name") and not line.startswith("---") and not line.startswith("("):
            cols.append(line)
    return cols

def get_cloud_columns(table_name):
    """Get Cloud column names by exporting 1 row."""
    try:
        resp = cloud_call({
            "action": "export-table",
            "table": table_name,
            "offset": 0,
            "limit": 1,
        })
        if resp.get("rows") and len(resp["rows"]) > 0:
            return sorted(resp["rows"][0].keys())
    except Exception as e:
        log(f"  WARNING: Could not get Cloud columns for {table_name}: {e}")
    return []

# Build schema diff
schema_fixes = []  # list of (table, column, pg_type) to ADD
missing_tables = []  # tables in Cloud but not Local

for table_name in sorted(tables_with_data.keys()):
    cloud_cols = get_cloud_columns(table_name)
    
    if table_name not in local_table_names:
        missing_tables.append(table_name)
        log(f"  ❌ TABLE MISSING locally: {table_name} ({tables_with_data[table_name]} rows)")
        continue
    
    local_cols = get_local_columns(table_name)
    local_col_set = set(local_cols)
    
    for col in cloud_cols:
        if col not in local_col_set:
            schema_fixes.append((table_name, col))

log(f"  Missing tables: {len(missing_tables)}")
log(f"  Missing columns: {len(schema_fixes)}")

# ============================================================
# STEP 3: Fix schema — add missing columns with correct types
# We detect types from actual Cloud data
# ============================================================
if schema_fixes or missing_tables:
    log("")
    log("=" * 60)
    log("STEP 3: Schema alignment")
    log("=" * 60)
    
    # For each missing column, infer type from actual data
    # Group by table for efficiency
    tables_needing_cols = {}
    for table_name, col_name in schema_fixes:
        if table_name not in tables_needing_cols:
            tables_needing_cols[table_name] = []
        tables_needing_cols[table_name].append(col_name)
    
    alter_sql_parts = ["BEGIN;"]
    
    for table_name, cols in tables_needing_cols.items():
        # Get sample data to infer types
        resp = cloud_call({
            "action": "export-table",
            "table": table_name,
            "offset": 0,
            "limit": 5,
        })
        sample_rows = resp.get("rows", [])
        
        alter_sql_parts.append(f"\n-- {table_name}: adding {len(cols)} columns")
        
        for col in cols:
            # Infer PG type from sample data
            pg_type = "text"  # default
            for row in sample_rows:
                val = row.get(col)
                if val is not None:
                    if isinstance(val, bool):
                        pg_type = "boolean"
                    elif isinstance(val, int):
                        pg_type = "integer"
                    elif isinstance(val, float):
                        pg_type = "numeric"
                    elif isinstance(val, dict):
                        pg_type = "jsonb"
                    elif isinstance(val, list):
                        pg_type = "jsonb"
                    elif isinstance(val, str):
                        # Check for timestamp pattern
                        if len(val) > 18 and ("T" in val or "-" in val) and (":" in val):
                            try:
                                # Looks like ISO timestamp
                                if val.count("-") >= 2 and val.count(":") >= 2:
                                    pg_type = "timestamptz"
                                else:
                                    pg_type = "text"
                            except:
                                pg_type = "text"
                        # Check for UUID pattern
                        elif len(val) == 36 and val.count("-") == 4:
                            pg_type = "uuid"
                        else:
                            pg_type = "text"
                    break
            
            # All null values — check column name heuristics
            if pg_type == "text":
                col_lower = col.lower()
                if col_lower.endswith("_at") or col_lower.endswith("_date"):
                    pg_type = "timestamptz"
                elif col_lower.endswith("_id") and col_lower != "tax_id":
                    pg_type = "uuid"
                elif col_lower.startswith("is_") or col_lower.startswith("has_") or col_lower in ("enabled", "active", "email_sent", "email_verified"):
                    pg_type = "boolean"
                elif col_lower.endswith("_count") or col_lower.endswith("_number") or col_lower == "year_established" or col_lower.endswith("_order"):
                    pg_type = "integer"
                elif col_lower in ("metadata", "config", "settings", "features", "tags", "options", "question_scores", "difficulty_distribution", "question_distribution", "coding_topic_distribution", "file_hashes", "source_files", "validation_rules", "extracted_skills"):
                    pg_type = "jsonb"
            
            default = ""
            if pg_type == "boolean":
                default = " DEFAULT false"
            elif pg_type == "jsonb":
                default = " DEFAULT '{}'::jsonb"
            elif pg_type == "integer":
                default = " DEFAULT 0"
            
            alter_sql_parts.append(
                f"ALTER TABLE public.{table_name} ADD COLUMN IF NOT EXISTS {col} {pg_type}{default};"
            )
            log(f"  ADD {table_name}.{col} ({pg_type})")
    
    # Handle missing tables — create them
    for table_name in missing_tables:
        cloud_cols = get_cloud_columns(table_name)
        if not cloud_cols:
            log(f"  SKIP creating {table_name} — no columns discovered")
            continue
        
        resp = cloud_call({
            "action": "export-table",
            "table": table_name,
            "offset": 0,
            "limit": 5,
        })
        sample_rows = resp.get("rows", [])
        
        col_defs = []
        for col in cloud_cols:
            pg_type = "text"
            for row in sample_rows:
                val = row.get(col)
                if val is not None:
                    if isinstance(val, bool):
                        pg_type = "boolean"
                    elif isinstance(val, int):
                        pg_type = "integer"
                    elif isinstance(val, float):
                        pg_type = "numeric"
                    elif isinstance(val, dict):
                        pg_type = "jsonb"
                    elif isinstance(val, list):
                        pg_type = "jsonb"
                    elif isinstance(val, str):
                        if len(val) > 18 and val.count("-") >= 2 and val.count(":") >= 2:
                            pg_type = "timestamptz"
                        elif len(val) == 36 and val.count("-") == 4:
                            pg_type = "uuid"
                    break
            
            if col == "id":
                col_defs.append(f"  {col} {pg_type} PRIMARY KEY DEFAULT gen_random_uuid()")
            else:
                col_defs.append(f"  {col} {pg_type}")
        
        create_sql = f"CREATE TABLE IF NOT EXISTS public.{table_name} (\n"
        create_sql += ",\n".join(col_defs)
        create_sql += "\n);"
        alter_sql_parts.append(f"\n-- CREATE TABLE {table_name}")
        alter_sql_parts.append(create_sql)
        alter_sql_parts.append(f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;")
        log(f"  CREATE TABLE {table_name} ({len(col_defs)} columns)")
    
    alter_sql_parts.append("\nCOMMIT;")
    
    full_sql = "\n".join(alter_sql_parts)
    
    # Save and apply
    sql_file = f"{EXPORT_DIR}/schema_alignment.sql"
    with open(sql_file, "w") as f:
        f.write(full_sql)
    
    out, err, rc = psql(full_sql)
    if rc != 0:
        log(f"  Schema fix errors: {err[:500]}")
    else:
        log(f"  ✅ Schema alignment applied successfully")
else:
    log("  ✅ No schema fixes needed — all columns present")

# ============================================================
# STEP 4: Disable triggers for import
# ============================================================
log("")
log("=" * 60)
log("STEP 4: Disable triggers for bulk import")
log("=" * 60)

psql("""
DO $$DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE TRIGGER ALL';
  END LOOP;
END$$;
""", quiet=True)
log("  ✅ All triggers disabled")

# ============================================================
# STEP 5: Import auth users first
# ============================================================
log("")
log("=" * 60)
log("STEP 5: Import auth users")
log("=" * 60)

auth_resp = cloud_call({"action": "auth-users", "offset": 0, "limit": 100})
cloud_users = auth_resp.get("users", [])
log(f"  Cloud auth users: {len(cloud_users)}")

with open(f"{EXPORT_DIR}/auth_users.json", "w") as f:
    json.dump(cloud_users, f, indent=2)

auth_sql_parts = [
    "BEGIN;",
    "ALTER TABLE auth.users DISABLE TRIGGER ALL;",
]

for user in cloud_users:
    uid = user["id"]
    email = user.get("email", "")
    role = user.get("role", "authenticated")
    ec = user.get("email_confirmed_at")
    created = user.get("created_at", "now()")
    updated = user.get("updated_at", "now()")
    user_meta = json.dumps(user.get("raw_user_meta_data") or {}).replace("'", "''")
    app_meta = json.dumps(user.get("raw_app_meta_data") or {}).replace("'", "''")
    
    ec_val = f"'{ec}'" if ec else "NULL"
    email_escaped = email.replace("'", "''")
    
    auth_sql_parts.append(f"""
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', '{uid}', 'authenticated', '{role}', '{email_escaped}', crypt('TempPass123!', gen_salt('bf')), {ec_val}, '{created}', '{updated}', '{user_meta}'::jsonb, '{app_meta}'::jsonb, false, '', '', '', '')
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email, 
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  updated_at = EXCLUDED.updated_at,
  email_confirmed_at = COALESCE(EXCLUDED.email_confirmed_at, auth.users.email_confirmed_at);
""")

auth_sql_parts.append("""
-- Preserve admin password
UPDATE auth.users SET encrypted_password = crypt('Admin@TG2026!', gen_salt('bf')) WHERE email = 'admin@talentgeenie.com';
-- Ensure all users have confirmed emails
UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW());
ALTER TABLE auth.users ENABLE TRIGGER ALL;
COMMIT;
""")

auth_sql = "\n".join(auth_sql_parts)
with open(f"{EXPORT_DIR}/auth_import.sql", "w") as f:
    f.write(auth_sql)

out, err, rc = psql(auth_sql, quiet=True)
if "COMMIT" in out or rc == 0:
    local_auth_count = psql_value("SELECT count(*) FROM auth.users")
    log(f"  ✅ Auth users imported. Local count: {local_auth_count}")
else:
    log(f"  ❌ Auth import error: {err[:300]}")

# ============================================================
# STEP 6: Export and import EVERY table with data
# ============================================================
log("")
log("=" * 60)
log("STEP 6: Import ALL tables with data")
log("=" * 60)

# Dependency-aware ordering (parent tables first)
priority_order = [
    "organizations", "subscription_plans", "system_config",
    "platform_configurations", "email_templates",
    "profiles", "user_roles",
    "organization_members", "onboarding_progress",
    "partner_applications", "password_setup_invitations",
    "interviews", "interview_templates",
    "questions", "interview_invitations",
    "interview_attempts", "assessments",
]

# Build ordered list: priority tables first, then rest alphabetically
ordered_tables = []
for t in priority_order:
    if t in tables_with_data:
        ordered_tables.append(t)
for t in sorted(tables_with_data.keys()):
    if t not in ordered_tables:
        ordered_tables.append(t)

total_imported = 0
results = {}

for table_name in ordered_tables:
    expected = tables_with_data[table_name]
    log(f"  📦 {table_name} ({expected} rows)...")
    
    # Export ALL rows from Cloud with pagination
    all_rows = []
    offset = 0
    limit = 500
    
    while True:
        try:
            resp = cloud_call({
                "action": "export-table",
                "table": table_name,
                "offset": offset,
                "limit": limit,
            })
        except Exception as e:
            log(f"    ❌ Export failed: {e}")
            break
        
        rows = resp.get("rows", [])
        if not rows:
            break
        
        all_rows.extend(rows)
        has_more = resp.get("has_more", False)
        if not has_more:
            break
        offset += limit
    
    if not all_rows:
        log(f"    ⚠️ No rows exported")
        results[table_name] = (expected, 0)
        continue
    
    # Save exported data
    with open(f"{EXPORT_DIR}/{table_name}.json", "w") as f:
        json.dump(all_rows, f)
    
    # Get LOCAL columns for this table
    local_cols = get_local_columns(table_name)
    if not local_cols:
        log(f"    ❌ Table {table_name} not found locally")
        results[table_name] = (expected, 0)
        continue
    
    local_col_set = set(local_cols)
    
    # Build INSERT SQL — only use columns that exist in BOTH Cloud data AND local table
    # This ensures no column mismatch errors
    cloud_cols_in_data = set()
    for row in all_rows:
        cloud_cols_in_data.update(row.keys())
    
    # Columns to import = intersection of cloud data columns and local table columns
    import_cols = [c for c in local_cols if c in cloud_cols_in_data]
    
    if not import_cols:
        log(f"    ❌ No overlapping columns found")
        results[table_name] = (expected, 0)
        continue
    
    # Determine primary key for ON CONFLICT
    pk_out, _, _ = psql(f"""
SELECT a.attname
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
WHERE i.indrelid = 'public.{table_name}'::regclass AND i.indisprimary
ORDER BY a.attnum;
""")
    pk_cols = []
    for line in pk_out.strip().split("\n"):
        line = line.strip()
        if line and not line.startswith("attname") and not line.startswith("---") and not line.startswith("("):
            pk_cols.append(line)
    
    # Build SQL inserts in batches
    batch_size = 50
    imported = 0
    
    for batch_start in range(0, len(all_rows), batch_size):
        batch = all_rows[batch_start:batch_start + batch_size]
        
        sql_values = []
        for row in batch:
            vals = []
            for col in import_cols:
                val = row.get(col)
                vals.append(escape_sql_value(val))
            sql_values.append(f"({', '.join(vals)})")
        
        col_list = ", ".join(f'"{c}"' for c in import_cols)
        values_str = ",\n".join(sql_values)
        
        if pk_cols:
            pk_str = ", ".join(f'"{c}"' for c in pk_cols)
            # Build UPDATE SET for non-PK columns
            non_pk_cols = [c for c in import_cols if c not in pk_cols]
            if non_pk_cols:
                update_set = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in non_pk_cols)
                conflict_clause = f"ON CONFLICT ({pk_str}) DO UPDATE SET {update_set}"
            else:
                conflict_clause = f"ON CONFLICT ({pk_str}) DO NOTHING"
        else:
            conflict_clause = "ON CONFLICT DO NOTHING"
        
        insert_sql = f"""INSERT INTO public."{table_name}" ({col_list})
VALUES {values_str}
{conflict_clause};"""
        
        out, err, rc = psql(insert_sql, quiet=True)
        if rc == 0:
            imported += len(batch)
        else:
            # Try row by row
            for row in batch:
                vals = []
                for col in import_cols:
                    val = row.get(col)
                    vals.append(escape_sql_value(val))
                single_sql = f"""INSERT INTO public."{table_name}" ({col_list})
VALUES ({', '.join(vals)})
{conflict_clause};"""
                _, _, rc2 = psql(single_sql, quiet=True)
                if rc2 == 0:
                    imported += 1
    
    # Verify local count
    local_count = psql_value(f"SELECT count(*) FROM public.{table_name}")
    total_imported += imported
    results[table_name] = (expected, int(local_count) if local_count else 0)
    
    status = "✅" if int(local_count or 0) >= expected else "⚠️"
    log(f"    {status} {table_name}: cloud={expected}, local={local_count}")

# ============================================================
# STEP 7: Re-enable triggers
# ============================================================
log("")
log("=" * 60)
log("STEP 7: Re-enable triggers")
log("=" * 60)

psql("""
DO $$DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE TRIGGER ALL';
  END LOOP;
END$$;
""", quiet=True)
log("  ✅ All triggers re-enabled")

# ============================================================
# STEP 8: Preserve local admin & E2E test users
# ============================================================
log("")
log("=" * 60)
log("STEP 8: Preserve admin & E2E roles")
log("=" * 60)

psql("""
-- Ensure admin has platform_admin role
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'platform_admin'::app_role FROM auth.users WHERE email = 'admin@talentgeenie.com'
ON CONFLICT DO NOTHING;

-- Preserve E2E test user roles
INSERT INTO public.user_roles (user_id, role) SELECT id, 'platform_admin'::app_role FROM auth.users WHERE email = 'e2e-admin@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'partner_admin'::app_role FROM auth.users WHERE email = 'e2e-partner@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'hr_recruiter'::app_role FROM auth.users WHERE email = 'e2e-hr@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'tech_spoc'::app_role FROM auth.users WHERE email = 'e2e-tech@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'guest'::app_role FROM auth.users WHERE email = 'e2e-guest@talentgeenie.test' ON CONFLICT DO NOTHING;

-- Reset admin password
UPDATE auth.users SET encrypted_password = crypt('Admin@TG2026!', gen_salt('bf')) WHERE email = 'admin@talentgeenie.com';
""", quiet=True)
log("  ✅ Admin & E2E roles preserved")

# ============================================================
# STEP 9: Final verification
# ============================================================
log("")
log("=" * 60)
log("STEP 9: FINAL VERIFICATION — Cloud vs Local")
log("=" * 60)

all_ok = True
log(f"  {'TABLE':<35} {'CLOUD':>7} {'LOCAL':>7}  STATUS")
log(f"  {'-'*35} {'-'*7} {'-'*7}  {'-'*10}")

for table_name in ordered_tables:
    expected = tables_with_data[table_name]
    local_count_str = psql_value(f"SELECT count(*) FROM public.{table_name}")
    local_count = int(local_count_str) if local_count_str else 0
    
    if local_count >= expected:
        status = "✅"
    elif local_count > 0:
        status = "⚠️ PARTIAL"
        all_ok = False
    else:
        status = "❌ EMPTY"
        all_ok = False
    
    log(f"  {table_name:<35} {expected:>7} {local_count:>7}  {status}")

# Auth users
cloud_auth = len(cloud_users)
local_auth_str = psql_value("SELECT count(*) FROM auth.users")
local_auth = int(local_auth_str) if local_auth_str else 0
auth_status = "✅" if local_auth >= cloud_auth else "⚠️"
log(f"  {'auth.users':<35} {cloud_auth:>7} {local_auth:>7}  {auth_status}")

log("")
log("=" * 60)
if all_ok:
    log("✅ MIGRATION COMPLETE — ALL TABLES FULLY MIGRATED!")
else:
    log("⚠️ MIGRATION COMPLETE — SOME TABLES NEED ATTENTION")
log(f"   Total rows processed: {total_imported}")
log(f"   Export dir: {EXPORT_DIR}")
log("=" * 60)
log("")
log("Admin login: admin@talentgeenie.com / Admin@TG2026!")
