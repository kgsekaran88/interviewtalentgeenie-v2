#!/usr/bin/env python3
"""
Thorough function body comparison: Cloud pg_dump migration vs Local DB.
Handles both pg_dump format (SET ... CREATE FUNCTION) and incremental migration format.
"""

import os
import re
import subprocess
import hashlib

CLOUD_MIGRATIONS = "/Users/gunasekaran/Documents/Workspace/interviewtalentgeenie/supabase/migrations"
OUTPUT_DIR = "/Users/gunasekaran/Documents/Workspace/interviewtalentgeenie-v2/migrations/incremental"

def psql(query):
    r = subprocess.run(
        ['docker', 'exec', 'talentgeenie-db', 'psql', '-U', 'postgres', '-t', '-A', '-c', query],
        capture_output=True, text=True
    )
    return r.stdout.strip()

def get_local_function_def(func_name):
    """Get the actual function definition from local DB using pg_get_functiondef."""
    result = psql(f"""
        SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = '{func_name}'
        ORDER BY p.oid DESC
        LIMIT 1
    """)
    return result

def extract_body(funcdef):
    """Extract just the function body between $$ markers."""
    if not funcdef:
        return ""
    # Match $tag$...$tag$ or $$...$$
    m = re.search(r'\$([^$]*)\$(.*?)\$\1\$', funcdef, re.DOTALL)
    if m:
        return m.group(2).strip()
    return funcdef

def normalize(text):
    """Normalize for comparison."""
    if not text:
        return ""
    # Remove comments
    text = re.sub(r'--[^\n]*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text

def extract_all_cloud_functions():
    """Parse ALL migration files to find function definitions."""
    functions = {}  # name -> (full_sql, file, line)
    
    migration_files = sorted([
        f for f in os.listdir(CLOUD_MIGRATIONS) if f.endswith('.sql')
    ])
    
    for mf in migration_files:
        filepath = os.path.join(CLOUD_MIGRATIONS, mf)
        with open(filepath, 'r', errors='replace') as f:
            content = f.read()
        
        # Pattern 1: CREATE OR REPLACE FUNCTION public.name(...)
        # Handles both $$ and $function$ delimiters
        # The key: match dollar-quoted strings properly
        pos = 0
        while pos < len(content):
            # Find start of function definition
            match = re.search(
                r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(\w+)',
                content[pos:],
                re.IGNORECASE
            )
            if not match:
                break
            
            func_name = match.group(1)
            start = pos + match.start()
            
            # Find the dollar-quoted body
            remaining = content[start:]
            
            # Find first $tag$ or $$
            dollar_match = re.search(r'\$([^$]*)\$', remaining)
            if not dollar_match:
                pos = start + len(match.group(0))
                continue
            
            tag = dollar_match.group(1)
            open_tag = f'${tag}$'
            # Find matching close tag
            body_start = remaining.index(open_tag) + len(open_tag)
            close_pos = remaining.find(open_tag, body_start)
            
            if close_pos == -1:
                pos = start + len(match.group(0))
                continue
            
            # Find the LANGUAGE declaration after the close tag
            after_body = remaining[close_pos + len(open_tag):]
            lang_match = re.search(r'LANGUAGE\s+\w+', after_body, re.IGNORECASE)
            
            if lang_match:
                end = start + close_pos + len(open_tag) + lang_match.end()
                # Also capture any trailing clauses before the semicolon
                trailing = content[end:]
                semi = trailing.find(';')
                if semi != -1 and semi < 200:
                    end += semi + 1
                
                full_def = content[start:end].strip().rstrip(';').strip() + ';'
                functions[func_name] = (full_def, mf)
            
            pos = start + max(1, close_pos + len(open_tag))
    
    return functions

# =============================================
# MAIN
# =============================================
print("=" * 80)
print("COMPREHENSIVE FUNCTION BODY COMPARISON")
print("=" * 80)

# Get local function names
local_names_raw = psql("""
    SELECT DISTINCT proname FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY proname
""")
local_names = [f for f in local_names_raw.split('\n') if f]
print(f"Local functions: {len(local_names)}")

# Extract Cloud functions
print("Parsing Cloud migration files...")
cloud_funcs = extract_all_cloud_functions()
print(f"Cloud functions extracted: {len(cloud_funcs)}")

# Compare
identical = []
different = []
cloud_only = []
local_only = []

all_names = sorted(set(list(cloud_funcs.keys()) + local_names))

for name in all_names:
    in_cloud = name in cloud_funcs
    in_local = name in local_names
    
    if in_cloud and not in_local:
        cloud_only.append(name)
        continue
    if in_local and not in_cloud:
        local_only.append(name)
        continue
    
    # Both exist — compare
    cloud_sql, cloud_file = cloud_funcs[name]
    local_sql = get_local_function_def(name)
    
    cloud_body = normalize(extract_body(cloud_sql))
    local_body = normalize(extract_body(local_sql))
    
    if cloud_body == local_body:
        identical.append(name)
    else:
        # Try even more aggressive normalization
        cloud_stripped = re.sub(r'[^a-z0-9]', '', cloud_body)
        local_stripped = re.sub(r'[^a-z0-9]', '', local_body)
        if cloud_stripped == local_stripped:
            identical.append(name)
        else:
            different.append((name, cloud_file, cloud_sql, local_sql))

print(f"\n{'='*80}")
print("RESULTS")
print(f"{'='*80}")
print(f"✅ Identical:         {len(identical)}")
print(f"❌ Different bodies:  {len(different)}")
print(f"☁️  Cloud only:        {len(cloud_only)}")
print(f"💻 Local only:        {len(local_only)}")

if different:
    print(f"\n{'='*80}")
    print("FUNCTIONS WITH DIFFERENT BODIES")
    print(f"{'='*80}")
    
    fix_lines = [
        "-- Fix function body mismatches — apply Cloud (source) version",
        "-- Generated by compare_function_bodies_v2.py",
        ""
    ]
    
    for name, cloud_file, cloud_sql, local_sql in different:
        cloud_body = extract_body(cloud_sql)
        local_body = extract_body(local_sql)
        
        print(f"\n--- {name} (from {cloud_file}) ---")
        
        # Show the diff
        cloud_lines = cloud_body.split('\n')
        local_lines = local_body.split('\n')
        
        # Find first difference
        for i, (cl, ll) in enumerate(zip(cloud_lines, local_lines)):
            if cl.strip() != ll.strip():
                print(f"  First diff at line ~{i+1}:")
                print(f"    CLOUD: {cl.strip()[:120]}")
                print(f"    LOCAL: {ll.strip()[:120]}")
                break
        
        if len(cloud_lines) != len(local_lines):
            print(f"  Line count: Cloud={len(cloud_lines)}, Local={len(local_lines)}")
        
        fix_lines.append(f"-- Fix: {name} (from {cloud_file})")
        fix_lines.append(cloud_sql)
        fix_lines.append("")
    
    fix_path = os.path.join(OUTPUT_DIR, "20260219_fix_function_bodies.sql")
    with open(fix_path, 'w') as f:
        f.write('\n'.join(fix_lines))
    print(f"\n📝 Fix SQL saved to: {fix_path}")

if cloud_only:
    print(f"\n☁️  Cloud-only functions (missing from local):")
    for name in cloud_only:
        print(f"  - {name}")

if local_only:
    print(f"\n💻 Local-only functions ({len(local_only)}):")
    for name in local_only:
        print(f"  - {name}")
