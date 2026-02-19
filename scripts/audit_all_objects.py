#!/usr/bin/env python3
"""Comprehensive audit of ALL database objects — Cloud vs Local."""

import json
import subprocess

def psql(query):
    r = subprocess.run(
        ['docker', 'exec', 'talentgeenie-db', 'psql', '-U', 'postgres', '-t', '-A', '-c', query],
        capture_output=True, text=True
    )
    return r.stdout.strip()

print('=' * 70)
print('COMPREHENSIVE BACKEND OBJECT AUDIT')
print('=' * 70)

# 1. TABLES
print('\n1. TABLES')
local_tables = [l for l in psql(
    "SELECT table_name FROM information_schema.tables "
    "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
    "ORDER BY table_name"
).split('\n') if l]

cloud_openapi = json.load(open('/tmp/cloud_openapi.json'))
cloud_tables = sorted(cloud_openapi.get('definitions', {}).keys())
print(f'   Cloud: {len(cloud_tables)} | Local: {len(local_tables)}')

missing_tables = set(cloud_tables) - set(local_tables)
extra_tables = set(local_tables) - set(cloud_tables)
if missing_tables:
    print(f'   MISSING locally: {missing_tables}')
else:
    print(f'   OK - All Cloud tables exist locally')
if extra_tables:
    print(f'   Extra local tables ({len(extra_tables)}): {sorted(extra_tables)}')

# 2. FUNCTIONS/STORED PROCEDURES
print('\n2. DATABASE FUNCTIONS')
local_funcs = [f for f in psql(
    "SELECT routine_name FROM information_schema.routines "
    "WHERE routine_schema = 'public' ORDER BY routine_name"
).split('\n') if f]
print(f'   Local functions: {len(local_funcs)}')
for fn in local_funcs:
    print(f'     - {fn}')

# 3. TRIGGERS
print('\n3. TRIGGERS')
local_triggers = [t for t in psql(
    "SELECT trigger_name || ' ON ' || event_object_table "
    "FROM information_schema.triggers "
    "WHERE trigger_schema = 'public' "
    "ORDER BY event_object_table, trigger_name"
).split('\n') if t]
print(f'   Local triggers: {len(local_triggers)}')
for tr in local_triggers:
    print(f'     - {tr}')

# 4. RLS POLICIES
print('\n4. RLS POLICIES')
local_policies = [p for p in psql(
    "SELECT tablename || '.' || policyname "
    "FROM pg_policies WHERE schemaname = 'public' "
    "ORDER BY tablename, policyname"
).split('\n') if p]
print(f'   Local RLS policies: {len(local_policies)}')

# 5. INDEXES
print('\n5. INDEXES')
local_indexes = [i for i in psql(
    "SELECT indexname FROM pg_indexes "
    "WHERE schemaname = 'public' ORDER BY indexname"
).split('\n') if i]
print(f'   Local indexes: {len(local_indexes)}')

# 6. STORAGE BUCKETS
print('\n6. STORAGE BUCKETS')
local_buckets = [b for b in psql(
    "SELECT id || ' (public=' || public || ')' FROM storage.buckets ORDER BY id"
).split('\n') if b]
print(f'   Local buckets: {len(local_buckets)}')
for b in local_buckets:
    print(f'     - {b}')

storage_files = psql('SELECT count(*) FROM storage.objects')
print(f'   Local storage files: {storage_files}')

# 7. AUTH USERS
print('\n7. AUTH USERS')
auth_count = psql('SELECT count(*) FROM auth.users')
print(f'   Local auth users: {auth_count}')

# 8. SEQUENCES
print('\n8. SEQUENCES')
local_seqs = [s for s in psql(
    "SELECT sequence_name FROM information_schema.sequences "
    "WHERE sequence_schema = 'public'"
).split('\n') if s]
print(f'   Local sequences: {len(local_seqs)}')
for s in local_seqs:
    print(f'     - {s}')

# 9. CUSTOM TYPES / ENUMS
print('\n9. CUSTOM TYPES/ENUMS')
local_types = [t for t in psql(
    "SELECT t.typname FROM pg_type t "
    "JOIN pg_namespace n ON t.typnamespace = n.oid "
    "WHERE n.nspname = 'public' AND t.typtype = 'e'"
).split('\n') if t]
print(f'   Local enums: {len(local_types)}')
for t in local_types:
    vals = psql(
        f"SELECT enumlabel FROM pg_enum "
        f"WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = '{t}') "
        f"ORDER BY enumsortorder"
    )
    print(f'     - {t}: [{vals}]')

# 10. VIEWS
print('\n10. VIEWS')
local_views = [v for v in psql(
    "SELECT table_name FROM information_schema.views "
    "WHERE table_schema = 'public'"
).split('\n') if v]
print(f'   Local views: {len(local_views)}')

# 11. EXTENSIONS
print('\n11. EXTENSIONS')
local_exts = [e for e in psql(
    "SELECT extname || ' (' || extversion || ')' FROM pg_extension ORDER BY extname"
).split('\n') if e]
print(f'   Local extensions: {len(local_exts)}')
for e in local_exts:
    print(f'     - {e}')

# 12. FOREIGN KEYS
print('\n12. FOREIGN KEY CONSTRAINTS')
fk_count = psql(
    "SELECT count(*) FROM information_schema.table_constraints "
    "WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY'"
)
print(f'   Local foreign keys: {fk_count}')

# 13. CHECK CONSTRAINTS
print('\n13. CHECK CONSTRAINTS')
ck_count = psql(
    "SELECT count(*) FROM information_schema.table_constraints "
    "WHERE constraint_schema = 'public' AND constraint_type = 'CHECK'"
)
print(f'   Local check constraints: {ck_count}')

# DATA VERIFICATION
print('\n' + '=' * 70)
print('DATA MIGRATION STATUS (28 tables with data)')
print('=' * 70)

manifest = json.load(open('/tmp/tg_full_migration/manifest.json'))
data_ok = 0
data_gap = 0
for t in sorted(manifest['tables'], key=lambda x: x['table_name']):
    if t['row_count'] == 0:
        continue
    name = t['table_name']
    local_c = int(psql(f"SELECT count(*) FROM public.{name}"))
    if local_c >= t['row_count']:
        data_ok += 1
    else:
        data_gap += 1
        print(f'  MISSING: {name}: cloud={t["row_count"]}, local={local_c}')

if data_gap == 0:
    print(f'  All {data_ok} data tables: Cloud <= Local  [OK]')
else:
    print(f'  {data_ok} OK, {data_gap} gaps')

print('\n' + '=' * 70)
print('SUMMARY')
print('=' * 70)
print(f'  Tables:           {len(local_tables)} local ({len(cloud_tables)} cloud)')
print(f'  Functions:        {len(local_funcs)}')
print(f'  Triggers:         {len(local_triggers)}')
print(f'  RLS Policies:     {len(local_policies)}')
print(f'  Indexes:          {len(local_indexes)}')
print(f'  Storage Buckets:  {len(local_buckets)}')
print(f'  Storage Files:    {storage_files}')
print(f'  Auth Users:       {auth_count}')
print(f'  Sequences:        {len(local_seqs)}')
print(f'  Enums:            {len(local_types)}')
print(f'  Views:            {len(local_views)}')
print(f'  Extensions:       {len(local_exts)}')
print(f'  Foreign Keys:     {fk_count}')
print(f'  Check Constraints:{ck_count}')
print(f'  Data Tables OK:   {data_ok}/{data_ok + data_gap}')
