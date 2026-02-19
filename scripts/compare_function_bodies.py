#!/usr/bin/env python3
"""
Compare function bodies: Cloud (from migration SQL files) vs Local (live DB).
Extracts the LATEST definition of each function from Cloud migration files,
then compares against the actual function body in the local DB.
"""

import os
import re
import subprocess
import json

CLOUD_DIR = "/Users/gunasekaran/Documents/Workspace/interviewtalentgeenie/supabase/migrations"
LOCAL_V2 = "/Users/gunasekaran/Documents/Workspace/interviewtalentgeenie-v2"

def psql(query):
    r = subprocess.run(
        ['docker', 'exec', 'talentgeenie-db', 'psql', '-U', 'postgres', '-t', '-A', '-c', query],
        capture_output=True, text=True
    )
    return r.stdout.strip()

def get_local_function_source(func_name):
    """Get the source code of a function from the local DB."""
    result = psql(f"""
        SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = '{func_name}'
        ORDER BY p.oid DESC
        LIMIT 1
    """)
    return result

def normalize_sql(sql):
    """Normalize SQL for comparison — remove whitespace differences, comments, etc."""
    if not sql:
        return ""
    # Remove SQL comments
    sql = re.sub(r'--[^\n]*', '', sql)
    # Remove block comments
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    # Normalize whitespace
    sql = re.sub(r'\s+', ' ', sql)
    # Lowercase
    sql = sql.lower().strip()
    # Remove trailing semicolons
    sql = sql.rstrip(';').strip()
    return sql

def extract_functions_from_migrations():
    """Extract all function definitions from Cloud migration files.
    Returns dict: {func_name: (source_sql, source_file)}
    For functions defined multiple times, keep the LATEST (by filename sort).
    """
    functions = {}
    
    migration_files = sorted([
        f for f in os.listdir(CLOUD_DIR)
        if f.endswith('.sql')
    ])
    
    for mf in migration_files:
        filepath = os.path.join(CLOUD_DIR, mf)
        with open(filepath, 'r', errors='replace') as f:
            content = f.read()
        
        # Find all CREATE OR REPLACE FUNCTION definitions
        # Pattern: CREATE OR REPLACE FUNCTION public.func_name(...) ... $$ ... $$ LANGUAGE ...;
        pattern = r'(CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(\w+)\s*\([^)]*\).*?(?:\$\w*\$.*?\$\w*\$|\$\$.*?\$\$).*?LANGUAGE\s+\w+[^;]*;)'
        
        matches = re.finditer(pattern, content, re.DOTALL | re.IGNORECASE)
        for m in matches:
            full_def = m.group(1)
            func_name = m.group(2)
            functions[func_name] = (full_def, mf)
    
    return functions

print("=" * 80)
print("FUNCTION BODY COMPARISON: Cloud Migrations vs Local DB")
print("=" * 80)

# Step 1: Get all local function names
local_funcs_raw = psql("""
    SELECT DISTINCT proname FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY proname
""")
local_func_names = [f for f in local_funcs_raw.split('\n') if f]
print(f"\nLocal DB functions: {len(local_func_names)}")

# Step 2: Extract Cloud function definitions
print("Extracting Cloud function definitions from migration files...")
cloud_functions = extract_functions_from_migrations()
print(f"Cloud migration functions: {len(cloud_functions)}")

# Step 3: Compare
identical = []
different = []
local_only = []
cloud_only = []
comparison_errors = []

for func_name in sorted(set(list(cloud_functions.keys()) + local_func_names)):
    in_cloud = func_name in cloud_functions
    in_local = func_name in local_func_names
    
    if in_cloud and not in_local:
        cloud_only.append(func_name)
        continue
    if in_local and not in_cloud:
        local_only.append(func_name)
        continue
    
    # Both exist — compare bodies
    cloud_sql, cloud_file = cloud_functions[func_name]
    local_sql = get_local_function_source(func_name)
    
    if not local_sql:
        comparison_errors.append((func_name, "Could not retrieve local source"))
        continue
    
    cloud_norm = normalize_sql(cloud_sql)
    local_norm = normalize_sql(local_sql)
    
    # Compare key parts — the function body (between $$ markers)
    cloud_body_match = re.search(r'\$[^$]*\$(.*)\$[^$]*\$', cloud_norm, re.DOTALL)
    local_body_match = re.search(r'\$[^$]*\$(.*)\$[^$]*\$', local_norm, re.DOTALL)
    
    cloud_body = cloud_body_match.group(1).strip() if cloud_body_match else cloud_norm
    local_body = local_body_match.group(1).strip() if local_body_match else local_norm
    
    if cloud_body == local_body:
        identical.append(func_name)
    else:
        # Check if the difference is just whitespace/formatting
        if re.sub(r'\s+', '', cloud_body) == re.sub(r'\s+', '', local_body):
            identical.append(func_name)
        else:
            different.append((func_name, cloud_file, cloud_body[:200], local_body[:200]))

print(f"\n{'='*80}")
print("RESULTS")
print(f"{'='*80}")
print(f"\n✅ Identical (body matches): {len(identical)}")
print(f"❌ Different bodies:         {len(different)}")
print(f"☁️  Cloud only (not in local): {len(cloud_only)}")
print(f"💻 Local only (not in cloud): {len(local_only)}")
print(f"⚠️  Comparison errors:        {len(comparison_errors)}")

if different:
    print(f"\n{'='*80}")
    print("FUNCTIONS WITH DIFFERENT BODIES")
    print(f"{'='*80}")
    for func_name, cloud_file, cloud_preview, local_preview in different:
        print(f"\n--- {func_name} (from {cloud_file}) ---")
        print(f"  CLOUD: {cloud_preview}...")
        print(f"  LOCAL: {local_preview}...")

if cloud_only:
    print(f"\n{'='*80}")
    print("FUNCTIONS IN CLOUD BUT NOT IN LOCAL")
    print(f"{'='*80}")
    for f in cloud_only:
        print(f"  - {f} (from {cloud_functions[f][1]})")

if local_only:
    print(f"\n{'='*80}")
    print("FUNCTIONS IN LOCAL BUT NOT IN CLOUD")
    print(f"{'='*80}")
    for f in local_only:
        print(f"  - {f}")

if comparison_errors:
    print(f"\n{'='*80}")
    print("COMPARISON ERRORS")
    print(f"{'='*80}")
    for func_name, err in comparison_errors:
        print(f"  - {func_name}: {err}")

# Save the different ones for fixing
if different:
    fix_sql = []
    for func_name, cloud_file, _, _ in different:
        cloud_sql, _ = cloud_functions[func_name]
        fix_sql.append(f"-- Fix: {func_name} (from {cloud_file})")
        fix_sql.append(cloud_sql)
        fix_sql.append("")
    
    fix_path = os.path.join(LOCAL_V2, "migrations/incremental/20260219_fix_function_bodies.sql")
    with open(fix_path, 'w') as f:
        f.write("-- Functions with body mismatches — apply Cloud version\n")
        f.write("-- Generated by compare_function_bodies.py\n\n")
        f.write('\n'.join(fix_sql))
    print(f"\n📝 Fix SQL saved to: {fix_path}")
