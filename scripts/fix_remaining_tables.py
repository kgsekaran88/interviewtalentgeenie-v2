#!/usr/bin/env python3
"""
Fix remaining 8 tables using type-aware SQL generation.
Reads actual column types from local DB to cast values correctly.
"""
import json
import subprocess
import sys

DB = ["docker", "exec", "-i", "talentgeenie-db", "psql", "-U", "supabase_admin", "-d", "postgres"]
EXPORT_DIR = "/tmp/tg_full_migration"

def run_sql(sql):
    r = subprocess.run(DB, input=sql, capture_output=True, text=True, timeout=60)
    return r.stdout, r.stderr, r.returncode

def get_column_types(table):
    """Get {column_name: data_type} for a table."""
    sql = f"""SELECT column_name, udt_name FROM information_schema.columns 
WHERE table_schema='public' AND table_name='{table}' ORDER BY ordinal_position;"""
    out, _, _ = run_sql(sql)
    result = {}
    for line in out.strip().split("\n"):
        parts = [p.strip() for p in line.split("|")]
        if len(parts) == 2 and parts[0] and not parts[0].startswith("column") and not parts[0].startswith("-"):
            result[parts[0]] = parts[1]
    return result

def escape_typed(val, pg_type):
    """Escape a value with proper type casting for PostgreSQL."""
    if val is None:
        return "NULL"
    
    # JSONB columns need special handling
    if pg_type in ("jsonb", "json"):
        if isinstance(val, (dict, list)):
            json_str = json.dumps(val, ensure_ascii=False).replace("'", "''")
            return f"'{json_str}'::{pg_type}"
        elif isinstance(val, str):
            # String value going into jsonb - must be valid JSON
            # Wrap as JSON string
            json_str = json.dumps(val, ensure_ascii=False).replace("'", "''")
            return f"'{json_str}'::{pg_type}"
        elif isinstance(val, bool):
            return f"'{json.dumps(val)}'::{pg_type}"
        elif isinstance(val, (int, float)):
            return f"'{json.dumps(val)}'::{pg_type}"
        else:
            return "NULL"
    
    # Boolean
    if pg_type == "bool":
        if isinstance(val, bool):
            return "TRUE" if val else "FALSE"
        return "TRUE" if val else "FALSE"
    
    # Numeric types
    if pg_type in ("int2", "int4", "int8", "numeric", "float4", "float8"):
        if isinstance(val, (int, float)):
            return str(val)
        try:
            return str(int(val)) if pg_type in ("int2", "int4", "int8") else str(float(val))
        except (ValueError, TypeError):
            return "NULL"
    
    # Array types
    if pg_type.startswith("_"):
        if isinstance(val, list):
            # Text array
            items = []
            for item in val:
                if item is None:
                    items.append("NULL")
                else:
                    items.append('"' + str(item).replace('"', '\\"') + '"')
            return "ARRAY[" + ",".join(f"'{str(i)}'" for i in val if i is not None) + "]::text[]" if val else "'{}'"
        return "'{}'"
    
    # UUID
    if pg_type == "uuid":
        if val and str(val).count("-") == 4 and len(str(val)) == 36:
            return f"'{val}'"
        return "NULL"
    
    # Timestamp
    if pg_type in ("timestamptz", "timestamp"):
        if val:
            return f"'{str(val)}'"
        return "NULL"
    
    # Default: text
    s = str(val).replace("'", "''")
    return f"'{s}'"


# Tables to fix
TABLES = [
    "system_config", "password_setup_invitations", "interviews",
    "interview_operation_logs", "learning_plans", "platform_documentation",
    "test_suites", "usage_tracking",
]

# First disable all triggers
print("Disabling triggers...")
trigger_sql = "DO $$DECLARE r RECORD;\nBEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP\n  EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE TRIGGER ALL';\nEND LOOP; END$$;"
run_sql(trigger_sql)

for table in TABLES:
    print(f"\n=== {table} ===")
    
    try:
        data = json.load(open(f"{EXPORT_DIR}/{table}.json"))
    except FileNotFoundError:
        print(f"  No export file found")
        continue
    
    if not data:
        print(f"  No data to import")
        continue
    
    # Get column types
    col_types = get_column_types(table)
    if not col_types:
        print(f"  Could not get column types")
        continue
    
    # Get cloud columns present in data
    cloud_cols = set()
    for row in data:
        cloud_cols.update(row.keys())
    
    # Import columns = intersection of local columns and cloud data columns
    import_cols = [c for c in col_types.keys() if c in cloud_cols]
    
    # For system_config, cloud data has no "id" but local needs it
    if table == "system_config" and "id" not in cloud_cols:
        # We'll handle this specially
        pass
    
    print(f"  Rows: {len(data)}, Columns: {len(import_cols)}")
    
    ok = 0
    errors = 0
    
    for row in data:
        if table == "system_config" and "id" not in row:
            # Generate ID for system_config
            vals = ["gen_random_uuid()"]
            cols = ['"id"']
            for c in import_cols:
                cols.append(f'"{c}"')
                vals.append(escape_typed(row.get(c), col_types.get(c, "text")))
        else:
            cols = [f'"{c}"' for c in import_cols]
            vals = [escape_typed(row.get(c), col_types.get(c, "text")) for c in import_cols]
        
        col_str = ", ".join(cols)
        val_str = ", ".join(vals)
        
        # Use ON CONFLICT with UPDATE for tables with id PK
        non_pk = [c for c in import_cols if c != "id"]
        if non_pk and "id" in col_types:
            update_set = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in non_pk)
            conflict = f"ON CONFLICT (id) DO UPDATE SET {update_set}"
        else:
            conflict = "ON CONFLICT DO NOTHING"
        
        sql = f'INSERT INTO public."{table}" ({col_str}) VALUES ({val_str}) {conflict};'
        
        out, err, rc = run_sql(sql)
        if rc == 0:
            ok += 1
        else:
            errors += 1
            if errors <= 2:
                # Show truncated error
                err_msg = err.strip().split("\n")[0][:200]
                print(f"  ERR: {err_msg}")
    
    # Verify
    out, _, _ = run_sql(f"SELECT count(*) FROM public.{table};")
    count_line = [l.strip() for l in out.strip().split("\n") if l.strip() and l.strip().isdigit()]
    local_count = count_line[0] if count_line else "?"
    
    print(f"  Imported: {ok}/{len(data)}, Errors: {errors}, Local total: {local_count}")

# Re-enable triggers
print("\nRe-enabling triggers...")
trigger_sql = "DO $$DECLARE r RECORD;\nBEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP\n  EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE TRIGGER ALL';\nEND LOOP; END$$;"
run_sql(trigger_sql)

# Preserve roles
run_sql("""
UPDATE auth.users SET encrypted_password = crypt('Admin@TG2026!', gen_salt('bf')) WHERE email = 'admin@talentgeenie.com';
INSERT INTO public.user_roles (user_id, role) SELECT id, 'platform_admin'::app_role FROM auth.users WHERE email='admin@talentgeenie.com' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'platform_admin'::app_role FROM auth.users WHERE email='e2e-admin@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'partner_admin'::app_role FROM auth.users WHERE email='e2e-partner@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'hr_recruiter'::app_role FROM auth.users WHERE email='e2e-hr@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'tech_spoc'::app_role FROM auth.users WHERE email='e2e-tech@talentgeenie.test' ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'guest'::app_role FROM auth.users WHERE email='e2e-guest@talentgeenie.test' ON CONFLICT DO NOTHING;
""")

print("\n✅ DONE — Roles preserved, triggers re-enabled")
