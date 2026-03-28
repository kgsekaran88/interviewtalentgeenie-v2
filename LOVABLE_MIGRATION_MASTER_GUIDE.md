# Lovable → Self-Hosted Infrastructure: Complete Migration Master Guide

**Project:** InterviewTalentGeenie  
**Migration Window:** January – February 2026  
**Source:** Lovable Cloud + Supabase Cloud (`ztixorqvwqlwbesihtkr.supabase.co`)  
**Target:** Fully self-managed Docker stack + self-hosted Supabase  
**Purpose of this document:** Serve as the authoritative, step-by-step reference for building an automated Lovable migration tool (Vercel-like CI/CD pipeline from source to target).

---

## Table of Contents

1. [Big Picture: What We Were Migrating](#1-big-picture-what-we-were-migrating)
2. [Pre-Migration Audit: Know Before You Touch Anything](#2-pre-migration-audit-know-before-you-touch-anything)
3. [Complete Lovable Dependency Map (Every Location)](#3-complete-lovable-dependency-map-every-location)
4. [Migration Strategy Decision](#4-migration-strategy-decision)
5. [Phase 0 — Clean Repository Init (Remove Lovable Artifacts)](#5-phase-0--clean-repository-init-remove-lovable-artifacts)
6. [Phase 1 — Self-Hosted Supabase Infrastructure (Docker)](#6-phase-1--self-hosted-supabase-infrastructure-docker)
7. [Phase 2 — Edge Functions Runtime (Deno)](#7-phase-2--edge-functions-runtime-deno)
8. [Phase 3 — Frontend Environment Wiring](#8-phase-3--frontend-environment-wiring)
9. [Phase 4 — Realtime Service Configuration](#9-phase-4--realtime-service-configuration)
10. [Phase 5 — Storage Buckets](#10-phase-5--storage-buckets)
11. [Phase 6 — Deployment Configuration (Docker, K8s, Helm)](#11-phase-6--deployment-configuration-docker-k8s-helm)
12. [Phase 7 — CI/CD Pipelines](#12-phase-7--cicd-pipelines)
13. [Phase 8 — Data Migration Pipeline](#13-phase-8--data-migration-pipeline)
14. [AI Gateway Replacement (Lovable → Google Gemini)](#14-ai-gateway-replacement-lovable--google-gemini)
15. [Docker Boot Debugging: All Issues and Fixes](#15-docker-boot-debugging-all-issues-and-fixes)
16. [Post-Migration Work Completed](#16-post-migration-work-completed)
17. [Database Schema Migration Strategy](#17-database-schema-migration-strategy)
18. [Environment Variables: Complete Reference](#18-environment-variables-complete-reference)
19. [Developer Workflow (Makefile Commands)](#19-developer-workflow-makefile-commands)
20. [Verification Checklist](#20-verification-checklist)
21. [Troubleshooting Reference](#21-troubleshooting-reference)
22. [Patterns for the Automation Tool](#22-patterns-for-the-automation-tool)
23. [Lessons Learned](#23-lessons-learned)
24. [Commit History (Ordered)](#24-commit-history-ordered)

---

## 1. Big Picture: What We Were Migrating

### Application Summary

InterviewTalentGeenie is a full-stack AI-powered hiring/assessment platform with:

| Component | Scale |
|-----------|-------|
| Frontend pages | 93 |
| React components | 129 |
| Custom hooks | 25 |
| React contexts | 3 |
| Lib utilities | 37 |
| Routes | 102 |
| Database tables | 121 |
| Database functions (RPC) | 85 |
| Supabase Edge Functions (Deno) | 105 + 10 shared utils |
| Database migrations | 72 files (18,599 lines) |
| Type definitions | 7,304 lines |
| RLS policies | 330+ |
| Triggers | 62 |
| Supabase call sites in frontend | 323 |
| User roles | 6 system roles + org-scoped custom roles |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 |
| Bundler | Vite 5 + SWC |
| UI Library | shadcn/ui (50 components) + Radix UI |
| Styling | Tailwind CSS 3 + CSS variables (HSL, dark mode) |
| Routing | React Router DOM v6 (nested routes) |
| State | React Context (3) + TanStack React Query v5 |
| Forms | React Hook Form + Zod v4 |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL 15, GoTrue, PostgREST, Realtime, Storage, Deno Edge Functions) |
| AI | Originally Lovable AI Gateway → migrated to Google Gemini |
| Email | Resend API |
| API Gateway | Kong |
| Mobile scaffold | Capacitor (iOS + Android) |

### Architecture: Before vs After

**BEFORE (Lovable Cloud)**
```
Lovable CDN (Frontend hosting)
  └─► Lovable AI Proxy (supabase.ai.lovable.dev) → OpenAI GPT-4o
  └─► Supabase Cloud (ztixorqvwqlwbesihtkr.supabase.co)
        ├── PostgreSQL 15
        ├── GoTrue (Auth)
        ├── PostgREST (REST API)
        ├── Realtime (WebSockets)
        ├── Storage API
        ├── Kong (API Gateway)
        └── Deno Edge Runtime (106 functions)
```

**AFTER (Fully Self-Hosted)**
```
Vite Dev Server / Nginx (Frontend)  http://localhost:8080
  └─► Docker Compose Stack (11 services)  http://localhost:8000
        ├── Kong 2.8.1          :8000  API Gateway
        ├── GoTrue v2.158.1     :9999  Auth
        ├── PostgREST v12.2.0   :3000  REST API
        ├── Realtime v2.30.34   :4000  WebSockets
        ├── Storage v1.11.13    :5000  File Storage
        ├── Imgproxy v3.8.0     :5001  Image transforms
        ├── Postgres-Meta v0.84.2 :8080 Metadata API
        ├── Studio 20241029     :3001  Admin dashboard
        ├── Edge Runtime v1.70.3 :9000 Deno functions
        ├── PostgreSQL 15.8.1   :5432  Database
        └── DB-Migrations       (init-only, exits 0)

  AI: Google Gemini via OpenAI-compatible endpoint
      https://generativelanguage.googleapis.com/v1beta/openai
```

---

## 2. Pre-Migration Audit: Know Before You Touch Anything

Before writing a single line of migration code, you must audit the source project completely.

### 2.1 What to Audit

Run these against the Lovable project's source:

```bash
# Count source files
find src/ -type f | wc -l

# Count pages (route-level components)
find src/pages -type f -name "*.tsx" | wc -l

# Count edge functions
find supabase/functions -maxdepth 1 -type d | tail -n +2 | wc -l

# Count Supabase call sites in frontend
grep -r "supabase\." src/ --include="*.ts" --include="*.tsx" -l | wc -l
grep -rn "supabase\.from\|supabase\.auth\|invokeFunction\|supabase\.functions\.invoke\|\.rpc(\|\.channel(\|supabase\.storage" src/ | wc -l

# Find all Lovable references
grep -rn "lovable" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.html" -i

# Find hardcoded Supabase URLs
grep -rn "supabase\.co" . --include="*.ts" --include="*.tsx" --include="*.js"

# Find AI gateway references
grep -rn "ai\.gateway\|lovable\.dev\|LOVABLE_API_KEY" . --include="*.ts" --include="*.js"

# Find lovableproject.com references
grep -rn "lovableproject\.com" . --include="*.ts" --include="*.js" --include="*.html"
```

### 2.2 Source Project Inventory (This Project's Numbers)

| Category | Count |
|----------|-------|
| Source files (`src/`) | 322 |
| Pages/routes | 93 |
| Reusable components | 129 |
| Edge Functions | 106 (+ `_shared/` with 10 utilities) |
| Database tables (public schema) | 106 |
| Database functions/RPCs | 108 |
| RLS policies | 225 |
| Storage buckets | 4 (`certificates`, `consent-documents`, `documentation`, `proctoring-recordings`) |
| Supabase migration files | 72 |
| Type enums | 28 |

### 2.3 Supabase Call Pattern Breakdown (323 total)

| Pattern | Occurrences | Files |
|---------|-------------|-------|
| `supabase.from(` — DB queries | 94 | 12 files |
| `supabase.auth.*` — auth operations | 83 | 42 files |
| `invokeFunction(` — edge function wrapper | 102 | 49 files |
| `supabase.functions.invoke` — direct invoke | 15 | 11 files |
| `.rpc(` — DB function calls | 19 | 11 files |
| `.channel(` — realtime | 9 | 6 files |
| `supabase.storage.*` | 1 | 1 file |

**Key insight:** Because `@supabase/supabase-js` works identically with self-hosted Supabase, **zero of these 323 call sites needed to change** — only the env vars pointing to the URL.

### 2.4 PostgreSQL Extensions Required

These extensions must be available on the target PostgreSQL:

| Extension | Standard? | Notes |
|-----------|-----------|-------|
| `uuid-ossp` | ✅ Standard | UUID generation |
| `pgcrypto` | ✅ Standard | Cryptographic functions |
| `pgsodium` | ⚠️ Supabase-specific | API key encryption; included in `supabase/postgres` image |
| `pg_net` | ⚠️ Supabase-specific | HTTP from PostgreSQL; included in `supabase/postgres` image |
| `pg_graphql` | ⚠️ Supabase-specific | GraphQL; included in `supabase/postgres` image |
| `pg_stat_statements` | ✅ Standard | Query stats |
| `plpgsql` | ✅ Standard | PL/pgSQL |
| `supabase_vault` | ⚠️ Supabase-specific | Secrets storage; included in `supabase/postgres` image |

**Critical:** Use the `supabase/postgres:15.8.1.085` Docker image to get all extensions. A vanilla PostgreSQL image will be missing `pgsodium`, `pg_net`, `pg_graphql`, and `supabase_vault`.

---

## 3. Complete Lovable Dependency Map (Every Location)

This is the exhaustive list of every Lovable reference found — and where it is.

### 3.1 NPM Package (Dev Build Tool)

| File | Line | Reference | Action |
|------|------|-----------|--------|
| `package.json` | devDependencies | `"lovable-tagger": "^1.1.10"` | Remove |
| `vite.config.ts` | Import | `import { componentTagger } from "lovable-tagger"` | Remove |
| `vite.config.ts` | Plugin | `mode === "development" && componentTagger()` | Remove |

### 3.2 Lovable AI Gateway (31 Functions Affected)

The gateway at `https://ai.gateway.lovable.dev/v1/chat/completions` is Lovable's proprietary proxy to OpenAI GPT-4o. It requires Lovable authentication and is unavailable outside their platform.

**Shared utilities (3 files):**

| File | Location | Reference |
|------|----------|-----------|
| `_shared/ai-caller.ts` | L271, L434 | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| `_shared/config.ts` | L419 | `https://ai.gateway.lovable.dev/v1` (base URL) |
| `_shared/config.ts` | L21, L413–420 | `LOVABLE_API_KEY` env var, `lovable-ai` provider type |

**Direct gateway callers (9 functions — NOT using shared ai-caller):**

| File | Locations |
|------|-----------|
| `add-questions/index.ts` | L173 |
| `admin-log-analysis/index.ts` | L571, L649 |
| `analyze-proctoring-video/index.ts` | L253, L555, L920, L1076 (4 sites!) |
| `chatbot-assist/index.ts` | L33, L181 |
| `extract-skills/index.ts` | L277 |
| `generate-certification-questions/index.ts` | L28, L97 |
| `generate-job-description/index.ts` | L129 |
| `generate-schema/index.ts` | L74, L132 |
| `reconstruct-interviews/index.ts` | L103 |

**Functions via shared ai-caller (22 functions) — fixed automatically when shared module is updated.**

### 3.3 Hardcoded Lovable Project URLs (12 Locations)

| File | Line | Hardcoded Value | Action |
|------|------|-----------------|--------|
| `capacitor.config.ts` | L4 | `app.lovable.vtztavcqjmirktkjdprm` (appId) | Replace with your app ID |
| `capacitor.config.ts` | L8 | `https://vtztavcqjmirktkjdprm.lovableproject.com?forceHideBadge=true` | Replace with your domain |
| `public/proctoring-upload-sw.js` | L10 | `https://vtztavcqjmirktkjdprm.supabase.co` | Make dynamic via `postMessage` |
| `public/proctoring-upload-sw.js` | L11 | **Full Supabase anon JWT key hardcoded (243 chars)** — SECURITY RISK | Remove; receive dynamically |
| `src/lib/backgroundUploader.ts` | L391 | `https://vtztavcqjmirktkjdprm.supabase.co` (fallback) | Use `import.meta.env.VITE_SUPABASE_URL` |
| `src/pages/AIConfiguration.tsx` | L338 | `lovable: "💙"` (UI provider icon map) | Remove or replace |
| `_shared/email-helper.ts` | L70 | `https://${projectId}.lovableproject.com` (fallback) | Replace with `FRONTEND_URL` env var |
| `_shared/email-helper.ts` | L74 | `https://lovable.app` (last-resort fallback) | Replace with `FRONTEND_URL` env var |
| `approve-questions/index.ts` | L128 | `https://vtztavcqjmirktkjdprm.lovableproject.com` | Replace with `FRONTEND_URL` |
| `send-email/index.ts` | L108 | `vtztavcqjmirktkjdprm.lovableproject.com` | Replace with `FRONTEND_URL` |
| `send-password-setup/index.ts` | L67 | `vtztavcqjmirktkjdprm.lovableproject.com` | Replace with `FRONTEND_URL` |
| `send-review-request/index.ts` | L108 | `vtztavcqjmirktkjdprm.lovableproject.com` | Replace with `FRONTEND_URL` |
| `send-invitation-reminders/index.ts` | L79 | `https://interviewtalentgeenie.lovable.app` | Replace with `FRONTEND_URL` |
| `supabase/config.toml` | L1 | `project_id = "ztixorqvwqlwbesihtkr"` | Replace with new project ID |

### 3.4 `index.html` — Lovable Branding (Often Missed)

| Line | Tag | Value | Action |
|------|-----|-------|--------|
| L13 | `og:image` | `https://lovable.dev/opengraph-image-p98pqg.png` | Replace with self-hosted image |
| L15 | `twitter:site` | `@lovable_dev` | Remove or replace |
| L16 | `twitter:image` | `https://lovable.dev/opengraph-image-p98pqg.png` | Replace |
| L22 | `favicon` | `https://storage.googleapis.com/gpt-engineer-file-uploads/...` (Lovable's GCS) | Replace with local `public/favicon.ico` |

### 3.5 Other Files

| File | Issue |
|------|-------|
| `.gitignore` | `.env` NOT in gitignore — add immediately before committing secrets |
| `public/deployment-package/` | Contains scripts to revoke Lovable deploy keys/IAM roles/webhooks — move to repo root |
| `test-ai-connection/index.ts` | Has `case 'lovable':` test case — remove |
| `eslint-rules/no-duplicate-layout-wrapper.js` | Custom ESLint rule — must copy to new repo |

---

## 4. Migration Strategy Decision

### Why Self-Hosted Open-Source Supabase

The key architectural insight that made this migration feasible with **zero frontend code changes**:

> Supabase is 100% open source. The `@supabase/supabase-js` client connects to self-hosted Supabase **identically** to Supabase Cloud.

This means all 323 Supabase call sites in the frontend work unchanged — only the env vars pointing to the URL need updating.

### What Changes vs What Stays the Same

| Component | Changed? | Reason |
|-----------|----------|--------|
| All 93 pages | ❌ No | Zero changes |
| All 129 components | ❌ No | Zero changes |
| All 25 hooks | ❌ No | Zero changes |
| All 3 contexts | ❌ No | Zero changes |
| All CSS/Tailwind | ❌ No | Zero changes |
| All 102 routes | ❌ No | Zero changes |
| `src/integrations/supabase/client.ts` | ❌ No | Just change env var values |
| `src/integrations/supabase/types.ts` | ❌ No | Pure type definitions |
| `src/lib/supabaseFunctions.ts` | ❌ No | Works with self-hosted |
| All 37 lib utilities | ❌ No | (except 2 URL files) |
| Database schema | ❌ No | Same PostgreSQL |
| RLS policies | ❌ No | PostgREST applies identically |
| `package.json` | ✅ Yes | Remove `lovable-tagger` |
| `vite.config.ts` | ✅ Yes | Remove `componentTagger` |
| `capacitor.config.ts` | ✅ Yes | Update app ID, remove Lovable URL |
| `.env` / `.env.example` | ✅ Yes | Point to self-hosted URLs |
| `supabase/config.toml` | ✅ Yes | New project ID |
| Edge functions (31 of 106) | ✅ Yes | Replace Lovable AI gateway + URL fallbacks |
| `public/proctoring-upload-sw.js` | ✅ Yes | Remove hardcoded URL + anon key |
| `src/lib/backgroundUploader.ts` | ✅ Yes | Remove hardcoded fallback |
| `src/pages/AIConfiguration.tsx` | ✅ Yes | Remove Lovable icon |
| `index.html` | ✅ Yes | Remove Lovable OG images, favicon, twitter |

**Files changed: ~18 | Files unchanged: 350+**

---

## 5. Phase 0 — Clean Repository Init (Remove Lovable Artifacts)

**Git commit:** `77d3764` — "feat: Initialize interviewtalentgeenie-v2 - clean repo without Lovable artifacts"  
**Files in initial commit:** 694

### Steps

```bash
# 1. Create new git repo
mkdir interviewtalentgeenie-v2
cd interviewtalentgeenie-v2
git init

# 2. Copy everything from original project (except .git, node_modules, .env)
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env' \
  ../interviewtalentgeenie/ .

# 3. Remove lovable-tagger from package.json
# In package.json devDependencies, delete: "lovable-tagger": "^1.1.10"

# 4. Update vite.config.ts
# Remove: import { componentTagger } from "lovable-tagger"
# Remove: mode === "development" && componentTagger(),

# 5. Update capacitor.config.ts
# Change appId: "com.yourcompany.yourapp"
# Change server.url: "https://yourdomain.com"

# 6. Fix service worker (SECURITY CRITICAL)
# public/proctoring-upload-sw.js:
#   L10: Replace hardcoded supabase.co URL → read from message config
#   L11: Remove hardcoded anon key → receive via postMessage

# 7. Fix frontend fallback URL
# src/lib/backgroundUploader.ts L391:
#   Replace hardcoded fallback → import.meta.env.VITE_SUPABASE_URL

# 8. Remove Lovable AI icon from frontend
# src/pages/AIConfiguration.tsx L338:
#   Remove `lovable: "💙"` from provider icon map

# 9. Update index.html
# Remove lovable.dev OG images → replace with your own
# Remove @lovable_dev twitter tag
# Replace GCS favicon → local public/favicon.ico

# 10. Add .env to .gitignore IMMEDIATELY
echo ".env" >> .gitignore
echo ".env.supabase" >> .gitignore
echo ".env.local" >> .gitignore

# 11. Rename package.json "name" field
# "vite_react_shadcn_ts" → "your-app-name"

# 12. Update supabase/config.toml
# project_id = "your-new-project-id"

# 13. First commit
git add .
git commit -m "feat: Initialize clean repo without Lovable artifacts"
```

### Verification After Phase 0

```bash
grep -r "lovable" src/ supabase/ --include="*.ts" --include="*.tsx" --include="*.js" -i
# → Should return 0 results

grep -r "lovable-tagger" . --include="*.json" --include="*.ts"
# → Should return 0 results

grep -rn "supabase\.co" public/ src/
# → Should return 0 results (all dynamic now)
```

---

## 6. Phase 1 — Self-Hosted Supabase Infrastructure (Docker)

**Git commit:** `7aff833` — "feat: Phase 1 — Self-hosted Supabase infrastructure for local dev"

### 6.1 Files to Create

| File | Purpose | Lines |
|------|---------|-------|
| `docker-compose.supabase.yml` | Full 11-service Supabase stack | 427 |
| `docker/volumes/db/roles.sql` | PostgreSQL role password initialization | 55 |
| `docker/volumes/db/realtime.sql` | `_realtime` schema + publications for Realtime service | 57 |
| `docker/volumes/api/kong.yml` | Kong API Gateway routing config | ~200 |
| `scripts/generate-keys.sh` | JWT secret + anon/service role key generator | 136 |
| `scripts/start-dev.sh` | One-command stack startup orchestrator | 237 |
| `scripts/run-bootstrap.sh` | Database schema migration runner | 172 |
| `.env.supabase.example` | Template for required environment variables | ~50 |
| `Makefile` | Developer-friendly command shortcuts | 177 |

### 6.2 Docker Services (All 11)

```yaml
# docker-compose.supabase.yml — service definitions

services:
  db:
    image: supabase/postgres:15.8.1.085  # NOT vanilla postgres — needs Supabase extensions
    ports: ["5432:5432"]
    # CRITICAL: must add listen_addresses='*' or other services can't connect
    command: postgres -c listen_addresses='*' -c config_file=/etc/postgresql/postgresql.conf
    volumes:
      - ./docker/volumes/db/roles.sql:/docker-entrypoint-initdb.d/init-scripts/99-roles.sql
      - ./docker/volumes/db/realtime.sql:/docker-entrypoint-initdb.d/migrations/99-realtime.sql
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres

  kong:
    image: kong:2.8.1
    ports: ["8000:8000", "8443:8443"]
    # CRITICAL: kong:2.8.1 has NO envsubst — use sed-based entrypoint
    entrypoint: >
      /bin/sh -c "
        sed -i 's|$${ANON_KEY}|'\"$$ANON_KEY\"'|g;
                 s|$${SERVICE_ROLE_KEY}|'\"$$SERVICE_ROLE_KEY\"'|g'
          /var/lib/kong/kong.yml &&
        /docker-entrypoint.sh kong docker-start"
    volumes:
      - ./docker/volumes/api/kong.yml:/var/lib/kong/kong.yml
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      ANON_KEY: ${ANON_KEY}
      SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}

  auth:
    image: supabase/gotrue:v2.158.1
    ports: ["9999:9999"]
    environment:
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_JWT_EXP: 3600
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_API_EXTERNAL_URL: ${API_EXTERNAL_URL}
      GOTRUE_MAILER_AUTOCONFIRM: "false"
      GOTRUE_SMTP_HOST: ""    # configure if using SMTP directly
      API_EXTERNAL_URL: ${API_EXTERNAL_URL}

  rest:
    image: postgrest/postgrest:v12.2.0
    ports: ["3000:3000"]
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMA: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"

  realtime:
    image: supabase/realtime:v2.30.34
    ports: ["4000:4000"]
    environment:
      PORT: "4000"
      DB_HOST: db
      DB_PORT: "5432"
      DB_USER: supabase_admin
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: postgres
      DB_SSL: "false"
      API_JWT_SECRET: ${JWT_SECRET}
      FLY_ALLOC_ID: fly123          # required by Realtime internals
      FLY_APP_NAME: realtime        # required
      APP_NAME: realtime            # CRITICAL — without this, Realtime crashes
      SEED_SELF_HOST: "true"        # CRITICAL — required for self-hosting
      DB_ENC_KEY: ${DB_ENC_KEY}     # 32-byte encryption key
      SECRET_KEY_BASE: ${SECRET_KEY_BASE}  # 64-byte Phoenix secret

  storage:
    image: supabase/storage-api:v1.11.13
    ports: ["5000:5000"]
    environment:
      ANON_KEY: ${ANON_KEY}
      SERVICE_KEY: ${SERVICE_ROLE_KEY}
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub

  imgproxy:
    image: darthsim/imgproxy:v3.8.0
    ports: ["5001:5001"]
    environment:
      IMGPROXY_BIND: ":5001"
      IMGPROXY_KEY: ""
      IMGPROXY_SALT: ""
      IMGPROXY_ENABLE_WEBP_DETECTION: "true"

  meta:
    image: supabase/postgres-meta:v0.84.2
    ports: ["8080:8080"]
    environment:
      PG_META_PORT: "8080"
      PG_META_DB_HOST: db
      PG_META_DB_PORT: "5432"
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: ${POSTGRES_PASSWORD}

  studio:
    image: supabase/studio:20241029-46e1e40
    ports: ["${STUDIO_PORT:-3001}:3000"]  # use 3001 to avoid port conflicts
    environment:
      STUDIO_PG_META_URL: http://meta:8080
      SUPABASE_URL: http://kong:8000
      SUPABASE_PUBLIC_URL: ${API_EXTERNAL_URL}
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}

  functions:
    image: supabase/edge-runtime:v1.70.3
    ports: ["9000:9000"]
    volumes:
      - ./supabase/functions:/home/deno/functions:ro
    environment:
      SUPABASE_URL: http://kong:8000
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
      SUPABASE_DB_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      RESEND_API_KEY: ${RESEND_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${SITE_URL}

  db-migrations:
    image: supabase/postgres:15.8.1.085
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./migrations:/migrations:ro
      - ./scripts/run-bootstrap.sh:/run-bootstrap.sh:ro
    command: /bin/bash /run-bootstrap.sh
    environment:
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGHOST: db
      PGUSER: supabase_admin
      PGDATABASE: postgres
```

### 6.3 `docker/volumes/db/roles.sql` (Critical)

```sql
-- This file runs AFTER the Supabase postgres image's built-in init
-- It sets passwords for the service roles that Supabase services need to authenticate
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER ROLE supabase_auth_admin    WITH PASSWORD :'pgpass';
ALTER ROLE supabase_storage_admin WITH PASSWORD :'pgpass';
ALTER ROLE authenticator          WITH PASSWORD :'pgpass';
ALTER ROLE supabase_replication_admin WITH PASSWORD :'pgpass';
-- Add any other supabase_* roles your version requires
```

### 6.4 `docker/volumes/db/realtime.sql` (Critical)

```sql
-- Required by Supabase Realtime service
CREATE SCHEMA IF NOT EXISTS _realtime;
GRANT USAGE ON SCHEMA _realtime TO postgres, supabase_admin;

-- Publications for tables you want realtime on
CREATE PUBLICATION supabase_realtime FOR TABLE
  notifications,
  proctoring_sessions,
  ai_health_alerts,
  live_stream_signals;
  -- Add all tables your app needs realtime on
```

### 6.5 Key Generation Script (`scripts/generate-keys.sh`)

```bash
#!/bin/bash
# Generates JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY and writes to .env.supabase

JWT_SECRET=$(openssl rand -base64 32)
DB_ENC_KEY=$(openssl rand -hex 16)  # 32 hex chars = 16 bytes
SECRET_KEY_BASE=$(openssl rand -base64 48)  # 64 chars

# Generate ANON_KEY and SERVICE_ROLE_KEY as proper JWTs
# They must be JWTs signed with JWT_SECRET and the correct role claim
# Use a Python snippet since pure bash JWT generation is complex:

python3 -c "
import base64, json, hmac, hashlib, time

def b64url(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def make_jwt(role, secret):
    header = b64url(json.dumps({'alg':'HS256','typ':'JWT'}))
    payload = b64url(json.dumps({
        'role': role,
        'iss': 'supabase',
        'iat': int(time.time()),
        'exp': int(time.time()) + (10 * 365 * 24 * 3600)  # 10 years
    }))
    msg = f'{header}.{payload}'
    sig = b64url(hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest())
    return f'{msg}.{sig}'

print(make_jwt('anon', '$JWT_SECRET'))
print(make_jwt('service_role', '$JWT_SECRET'))
" > /tmp/jwt_keys.txt

ANON_KEY=$(head -1 /tmp/jwt_keys.txt)
SERVICE_ROLE_KEY=$(tail -1 /tmp/jwt_keys.txt)
rm /tmp/jwt_keys.txt

# Write to .env.supabase (deduplicate if run multiple times)
cat >> .env.supabase <<EOF
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
DB_ENC_KEY=$DB_ENC_KEY
SECRET_KEY_BASE=$SECRET_KEY_BASE
EOF

# Deduplicate (last-value-wins for duplicate keys)
python3 -c "
lines = open('.env.supabase').readlines()
seen = {}
for line in lines:
    if '=' in line and not line.startswith('#'):
        key = line.split('=', 1)[0]
        seen[key] = line
    else:
        seen[line] = line
open('.env.supabase', 'w').writelines(seen.values())
"
```

---

## 7. Phase 2 — Edge Functions Runtime (Deno)

**Git commit:** `3455854` — "feat: Phase 2 — Self-hosted Edge Functions via Deno runtime"

### How Edge Functions Work Self-Hosted

The `supabase/edge-runtime:v1.70.3` Docker image runs all Deno functions **unchanged** from their Lovable versions (after AI gateway replacement — see Phase 14). Functions are accessed via Kong at:

```
http://localhost:8000/functions/v1/{function-name}
```

The edge runtime reads functions from the mounted `/home/deno/functions/` directory. The directory structure must be:

```
/home/deno/functions/
├── function-name-1/
│   └── index.ts
├── function-name-2/
│   └── index.ts
└── _shared/
    ├── ai-caller.ts
    ├── config.ts
    ├── cors.ts
    └── ...
```

### Kong Routing for Edge Functions

In `docker/volumes/api/kong.yml`, add upstream and service for edge functions:

```yaml
upstreams:
  - name: functions
    targets:
      - target: functions:9000
        weight: 100

services:
  - name: functions
    url: http://functions:9000/
    routes:
      - name: functions-route
        paths:
          - /functions/
    plugins:
      - name: cors

  # Also add routing for REST, Auth, Storage, Realtime, Meta
```

### Environment Variables for Edge Functions

These are injected at container level in `docker-compose.supabase.yml`:

```
SUPABASE_URL=http://kong:8000          # Internal Docker network URL
SUPABASE_SERVICE_ROLE_KEY=<generated>  # For admin DB operations
SUPABASE_DB_URL=postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
GEMINI_API_KEY=<your-key>              # Replaces LOVABLE_API_KEY
RESEND_API_KEY=<your-key>
JWT_SECRET=<generated>
FRONTEND_URL=http://localhost:8080     # Replaces all lovableproject.com fallbacks
```

---

## 8. Phase 3 — Frontend Environment Wiring

**Git commit:** `c5894bf` — "feat: Phases 3-5 — Frontend env wiring, Realtime, Storage"

### `.env.local` (Frontend — Generated by `scripts/start-dev.sh`)

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<your-generated-anon-key>
```

**Critical notes:**
- This project uses `VITE_SUPABASE_PUBLISHABLE_KEY`, **not** `VITE_SUPABASE_ANON_KEY`. This was the original Lovable variable name — preserve it to avoid breaking the existing client code.
- The URL points to **Kong** (port 8000), not directly to any backend service.
- The Supabase client in `src/integrations/supabase/client.ts` reads these env vars and routes all requests through Kong.

### How the Frontend Supabase Client Works

```typescript
// src/integrations/supabase/client.ts (unchanged — just reads env vars)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

When pointing to `http://localhost:8000`, Kong routes:
- `/rest/v1/*` → PostgREST (port 3000)
- `/auth/v1/*` → GoTrue (port 9999)
- `/storage/v1/*` → Storage API (port 5000)
- `/realtime/v1/*` → Realtime (port 4000)
- `/functions/v1/*` → Edge Runtime (port 9000)

---

## 9. Phase 4 — Realtime Service Configuration

### Mandatory Environment Variables (Without These, Realtime Crashes)

```bash
APP_NAME=realtime          # CRITICAL — the service crashes without this exact value
SEED_SELF_HOST=true        # CRITICAL — required for self-hosted mode
FLY_ALLOC_ID=fly123        # Required by Realtime internals (any value works)
FLY_APP_NAME=realtime      # Required by Realtime internals
DB_ENC_KEY=<32-byte-hex>   # Encryption for internal state
SECRET_KEY_BASE=<64-chars> # Phoenix framework secret
```

### `_realtime` Schema (Must Exist Before Realtime Starts)

The Realtime service expects the `_realtime` schema to exist. Create it in `docker/volumes/db/realtime.sql` (executed during PostgreSQL init, before Realtime starts):

```sql
CREATE SCHEMA IF NOT EXISTS _realtime;
GRANT USAGE ON SCHEMA _realtime TO postgres, supabase_admin;
GRANT ALL ON ALL TABLES IN SCHEMA _realtime TO postgres, supabase_admin;
```

### Tables Used for Realtime in This App

| Channel Name | Table | Type | Used By |
|---|---|---|---|
| `notifications-{userId}` | `notifications` | `postgres_changes` | Notification center |
| `proctoring-updates` | `proctoring_sessions` | `postgres_changes` | Proctoring dashboard |
| `ai-health-alerts-{userId}` | `ai_health_alerts` | `postgres_changes` | AI health monitor |
| `auth-verify-{random}` | (broadcast only) | `broadcast` | Auth verification |
| `live-stream-{sessionId}` | `live_stream_signals` | `broadcast` + `postgres_changes` | WebRTC signaling |

---

## 10. Phase 5 — Storage Buckets

### Why API-Based (Not SQL-Based) Bucket Creation

The Storage API manages its own schema (`storage.buckets`) dynamically. At database init time, the Storage service hasn't set up all its internal columns yet. Direct `INSERT INTO storage.buckets` during bootstrap fails with column mismatch errors.

**Solution:** Create buckets via the Storage REST API **after** all services are healthy.

### `scripts/init-storage-buckets.sh`

```bash
#!/bin/bash
SUPABASE_URL="${API_EXTERNAL_URL:-http://localhost:8000}"
SERVICE_KEY="${SERVICE_ROLE_KEY}"

create_bucket() {
  local name=$1
  local public=$2
  curl -s -X POST \
    "$SUPABASE_URL/storage/v1/bucket" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$name\",\"name\":\"$name\",\"public\":$public}" \
    | grep -q '"name"' && echo "✅ Bucket '$name' created" || echo "⚠️ Bucket '$name' may already exist"
}

# Wait for storage to be ready
until curl -s "$SUPABASE_URL/storage/v1/status" | grep -q "ok"; do
  sleep 2
done

create_bucket "certificates"           true
create_bucket "consent-documents"      false
create_bucket "documentation"          false
create_bucket "proctoring-recordings"  false
```

### Storage Bucket Summary

| Bucket | Public | Max Size | Purpose |
|--------|--------|----------|---------|
| `certificates` | Yes | 5MB | Generated assessment certificates |
| `consent-documents` | No | 10MB | Candidate consent forms |
| `documentation` | No | 50MB | Platform documentation uploads |
| `proctoring-recordings` | No | 2GB | Video proctoring recordings (chunk-upload) |

---

## 11. Phase 6 — Deployment Configuration (Docker, K8s, Helm)

**Git commit:** `3e99ba7` — "feat: Phases 6-8 — Deployment configs, CI/CD, Data migration"

### Files Created

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production-ready compose with resource limits, restart policies |
| `Dockerfile` | Multi-stage frontend build (Node 20 build → Nginx 1.25 serve) |
| `nginx.conf` | Production Nginx with SPA routing, GZIP, security headers |
| `kubernetes/` | Raw K8s manifests (Deployments, Services, Ingress, Secrets) |
| `helm/talentgeenie/` | Helm chart with values files for staging/production |

### Dockerfile (Multi-Stage Frontend Build)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

# Stage 2: Serve
FROM nginx:1.25-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### `nginx.conf` (SPA Routing — Critical)

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # SPA routing — always serve index.html for non-file routes
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header X-XSS-Protection "1; mode=block";

  # GZIP compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
}
```

---

## 12. Phase 7 — CI/CD Pipelines

### GitHub Actions Workflows

**`.github/workflows/ci.yml`** — Runs on every PR:
```yaml
jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check   # tsc --noEmit

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test         # vitest run
```

**`.github/workflows/deploy-staging.yml`** — On push to `develop`:
```yaml
jobs:
  build-and-deploy:
    steps:
      - name: Build Docker image
        run: docker build -t registry/app:staging .
        env:
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.STAGING_ANON_KEY }}
      - name: Push to registry
        run: docker push registry/app:staging
      - name: Deploy to staging server
        run: ssh deploy@staging "docker-compose pull && docker-compose up -d"
```

**`.github/workflows/deploy-production.yml`** — On push to `main`:
- Same as staging but with production secrets
- Includes database migration step
- Manual approval gate before deploy

### For the Automation Tool (Vercel-Like Pipeline)

The CI/CD pipeline for a Lovable → self-hosted migration tool should handle:

1. **Source detection:** Detect Lovable project from `package.json` (presence of `lovable-tagger`) and `vite.config.ts` (presence of `componentTagger`)
2. **Dependency analysis:** Scan for all Lovable URLs, AI gateway references, hardcoded Supabase project IDs
3. **Automated cleanup:** Apply all transformations from Section 3 above
4. **Infrastructure provisioning:** Spin up Docker Compose or K8s stack
5. **Schema migration:** Run migrations in order
6. **Secret injection:** Generate JWT keys, inject API keys
7. **Health verification:** Poll all service health endpoints
8. **Frontend build:** `npm run build` with target env vars
9. **Deployment:** Push to target (Docker registry, K8s cluster, etc.)

---

## 13. Phase 8 — Data Migration Pipeline

**Git commit:** `effa29a` — "feat: API-based data migration from Lovable Cloud"

### The Problem

Lovable manages the Supabase project — you have:
- ❌ No direct PostgreSQL access (no `pg_dump`)
- ❌ No database password
- ✅ Only the API (anon key or service role key via Lovable secrets)

### Solution: API-Based Export via Edge Function

**Step 1: Deploy `data-export` edge function to the ORIGINAL Lovable project**

The `data-export` function provides a paginated table-by-table export API:

```typescript
// data-export/index.ts
// Deployed to: https://ztixorqvwqlwbesihtkr.supabase.co/functions/v1/data-export
// Auth: Service role key

Deno.serve(async (req) => {
  const { table, page = 1, pageSize = 1000 } = await req.json()
  const from = (page - 1) * pageSize
  const { data, count } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact' })
    .range(from, from + pageSize - 1)
  return Response.json({ data, count, page, pageSize })
})
```

**Step 2: Run the import script**

```bash
# scripts/import-from-lovable.sh (482 lines)
# Full import
make import-data

# Dry run (preview only, no writes)
make import-data-dry

# Single table
make import-table TABLE=profiles
```

The script:
1. Connects to Lovable's Supabase using the cloud service role key
2. Calls `data-export` for each table in foreign-key dependency order
3. Paginates through all rows (1000 per page)
4. Inserts into local self-hosted PostgreSQL
5. Handles conflicts (upsert on primary key)
6. Provides progress + error reporting

### Table Import Order (Foreign Key Dependencies)

```bash
# Must import in this order (parent tables before child tables):
TABLES=(
  "organizations"
  "profiles"
  "user_roles"
  "subscription_plans"
  "organization_members"
  "interviews"
  "interview_sections"
  "questions"
  "interview_attempts"
  # ... all dependent tables after their parents
)
```

### Required Credentials

```env
# In .env.supabase before running import
LOVABLE_SUPABASE_URL=https://ztixorqvwqlwbesihtkr.supabase.co
LOVABLE_SERVICE_ROLE_KEY=<your-lovable-service-role-key>
# Get this from: Lovable Dashboard → Project Settings → API Keys
```

### Current Status

| Component | Status |
|-----------|--------|
| `data-export` function (code) | ✅ Written |
| `import-from-lovable.sh` (482 lines) | ✅ Written |
| Makefile targets | ✅ Configured |
| Database schema (target) | ✅ Deployed |
| Actual data transfer | ⚠️ Not yet run (schema has data, no rows) |

---

## 14. AI Gateway Replacement (Lovable → Google Gemini)

**Git commit:** `119f9df` — "fix: Replace Lovable AI Gateway with direct Google Gemini OpenAI-compatible endpoint"

### Why This Was Needed

Lovable provides a proprietary AI proxy at `supabase.ai.lovable.dev` that routes to OpenAI GPT-4o. This proxy:
- Requires Lovable authentication
- Is not available outside their platform
- Cannot be self-hosted

### The Solution: Google Gemini's OpenAI-Compatible Endpoint

Google Gemini provides an endpoint that **accepts the exact same request format as OpenAI**:

```
Base URL:  https://generativelanguage.googleapis.com/v1beta/openai
Models:    gemini-2.5-flash (primary), gemini-2.5-flash-lite (lightweight)
Auth:      Bearer token (API key)
Format:    Identical to OpenAI Chat Completions API
```

**This means minimal code changes** — only the base URL and API key change, not the request/response format.

### Core Change: `_shared/ai-caller.ts`

```typescript
// BEFORE (Lovable proprietary proxy)
const AI_GATEWAY_URL = 'https://supabase.ai.lovable.dev/v1/chat/completions';
const AI_API_KEY = Deno.env.get('LOVABLE_API_KEY');

// AFTER (Direct Google Gemini — OpenAI-compatible)
const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL') 
  || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const AI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('AI_API_KEY');
```

### Model Name Mapping

```typescript
// BEFORE
AI_MODEL: 'gpt-4o-mini'
AI_MODEL_HEAVY: 'gpt-4o'

// AFTER (Gemini OpenAI-compatible — bare model names, no "google/" prefix!)
AI_MODEL: Deno.env.get('AI_MODEL') || 'gemini-2.5-flash'
AI_MODEL_LITE: Deno.env.get('AI_MODEL_LITE') || 'gemini-2.5-flash-lite'
```

**Critical:** The Gemini OpenAI-compatible endpoint uses bare model names like `gemini-2.5-flash`, NOT `google/gemini-2.5-flash`. Using the prefix will cause 404 errors.

### `_shared/config.ts` Changes

```typescript
// Remove:
const LOVABLE_AI_BASE = 'https://ai.gateway.lovable.dev/v1';
// type AIProvider = 'lovable-ai' | 'google' | 'openai'

// Add:
const GEMINI_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
// type AIProvider = 'google' | 'openai'
```

### All 14 Functions Modified

```
Functions updated (direct gateway calls replaced):
  chatbot-assist
  evaluate-answer
  generate-assessment
  generate-questions
  evaluate-candidate
  summarize-feedback
  analyze-test-error
  generate-interview-report
  auto-fix-issue
  debug-session-issue
  generate-improvement-report
  feedback-analytics
  get-gemini-diagnostics
  ai-health-monitor

Shared utilities modified:
  _shared/ai-caller.ts     (core URL + key change)
  _shared/config.ts        (model mapping + provider type)
  _shared/email-helper.ts  (lovableproject.com URLs → FRONTEND_URL)
```

---

## 15. Docker Boot Debugging: All Issues and Fixes

**Git commit:** `44f98c8` — "fix: Docker stack boot — DB listen_addresses, role passwords, Kong template, Realtime schema, bootstrap baseline logic"

The first boot attempt revealed 8 interconnected issues. Every single one must be fixed for the stack to come up cleanly.

### Issue 1: PostgreSQL Not Accepting Network Connections

**Symptom:** All services that connect to DB fail with "connection refused"  
**Root Cause:** PostgreSQL only listens on Unix sockets by default  
**Fix:**
```yaml
# docker-compose.supabase.yml — db service
command: postgres -c listen_addresses='*' -c config_file=/etc/postgresql/postgresql.conf
```

### Issue 2: Role Password Authentication Failures

**Symptom:** Auth (GoTrue), Storage, and REST services can't authenticate to PostgreSQL  
**Root Cause:** Supabase services connect as `supabase_auth_admin`, `supabase_storage_admin`, `authenticator` roles — all need passwords set explicitly  
**Fix:** `docker/volumes/db/roles.sql` (see Section 6.3 above) mounted to `/docker-entrypoint-initdb.d/init-scripts/99-roles.sql`

> The `99-` prefix ensures it runs AFTER the Supabase image's built-in initialization scripts.

### Issue 3: Kong API Key Template Substitution

**Symptom:** Kong rejects all API requests — anon/service_role keys don't match  
**Root Cause:** `kong:2.8.1` image does NOT have `envsubst`. Original `kong.yml` used `${ANON_KEY:?error}` Bash-style syntax that Kong can't process.  
**Fix:** Custom sed-based entrypoint (see Section 6.2 Kong service definition above)

```yaml
entrypoint: >
  /bin/sh -c "
    sed -i 's|$${ANON_KEY}|'\"$$ANON_KEY\"'|g;
             s|$${SERVICE_ROLE_KEY}|'\"$$SERVICE_ROLE_KEY\"'|g'
      /var/lib/kong/kong.yml &&
    /docker-entrypoint.sh kong docker-start"
```

### Issue 4: Realtime Service Crash Loop

**Symptom:** Realtime container restarts in a loop  
**Root Cause:** Two causes simultaneously:
  1. Missing `APP_NAME` environment variable
  2. Missing `_realtime` schema in the database

**Fix:**
1. Add `APP_NAME=realtime` to Realtime env (see Section 9)
2. Create `docker/volumes/db/realtime.sql` with `_realtime` schema (see Section 9)
3. Add all other required Realtime env vars (`SEED_SELF_HOST`, `DB_ENC_KEY`, `SECRET_KEY_BASE`)

### Issue 5: Storage Bucket Creation Failure

**Symptom:** Storage buckets couldn't be created during DB bootstrap  
**Root Cause:** Storage manages its own schema dynamically. At init time, `storage.buckets` table columns haven't been finalized by the Storage service yet. Direct SQL inserts fail.  
**Fix:** Remove SQL-based bucket creation. Use `scripts/init-storage-buckets.sh` which calls the Storage REST API **after all services are healthy** (see Section 10).

### Issue 6: Incremental Migration Conflicts

**Symptom:** `pg_net` extension errors, "already exists" errors when running incremental migrations  
**Root Cause:** The fresh-deploy migration already contains the complete schema. Running 72 incremental migrations on top tries to recreate the same objects.  
**Fix:** Bootstrap script **baselines** all incremental migrations after fresh-deploy — records them in the migration tracking table as "already applied" without executing them.

```bash
# In scripts/run-bootstrap.sh
# After running fresh-deploy/*.sql files...
for file in migrations/incremental/*.sql; do
  migration_name=$(basename "$file")
  # Record as applied without executing
  psql -c "INSERT INTO _schema_migrations (name, applied_at) VALUES ('$migration_name', NOW()) ON CONFLICT DO NOTHING"
done
```

### Issue 7: Duplicate Environment Keys

**Symptom:** `.env.supabase` had both placeholder and real values for the same keys  
**Root Cause:** Key generation script appended values without checking for existing keys  
**Fix:** Python-based deduplication (last-wins strategy) in `scripts/generate-keys.sh`:

```python
lines = open('.env.supabase').readlines()
seen = {}
for line in lines:
    if '=' in line and not line.startswith('#'):
        key = line.split('=', 1)[0]
        seen[key] = line
    else:
        seen[line] = line
open('.env.supabase', 'w').writelines(seen.values())
```

### Issue 8: Studio Port Conflict

**Symptom:** Studio can't bind to port 3000  
**Root Cause:** PostgREST or another service already using port 3000 externally  
**Fix:** `STUDIO_PORT=3001` — use port 3001 for Studio; PostgREST uses 3000 internally but doesn't need to be exposed.

---

## 16. Post-Migration Work Completed

After the infrastructure migration, several application-level improvements were made. These are documented here as they represent real work that any Lovable migration will likely require.

### 16.1 Role Consolidation

**Commit date:** 2025-11-11  
**What happened:** The app had 11 roles, consolidated to 6 core roles.

| Old Role | New Role |
|----------|----------|
| `admin` | `platform_admin` |
| `hr` | `hr_recruiter` |
| `user` | (deleted — no purpose) |
| `ta_creator`, `billing_contact`, etc. | Kept as-is |

**Impact:** 74+ frontend files updated (hooks, route guards, navigation, components). Database RLS policies updated for all tables. Data migration ran on existing users.

**Pattern for automation tool:** During migration, scan for role name mappings and generate a role migration SQL script + frontend code update list.

### 16.2 Comprehensive Security Audit

**Date:** 2025-11-14  
**Scope:** 52 edge functions audited  
**Critical vulnerabilities found and fixed: 3**

Authentication patterns established:

| Pattern | Usage |
|---------|-------|
| `authenticateRequest(authHeader, ['role1', 'role2'])` helper | 38 functions (primary pattern) |
| Manual auth + role check from `user_roles` table | 7 functions (legacy) |
| HMAC-SHA256 webhook signature verification | 1 function (`ats-webhook`) |
| Optional auth (anonymous allowed) | Chatbot function |

**Key rule:** Every edge function that modifies data MUST authenticate the request. Functions that only READ public data may allow anonymous access.

### 16.3 Navigation Audit and Route Fixes

**Date:** 2025-11-15  
**Issue:** Route paths in hub pages (`/admin/organizations`) didn't match actual App.tsx routes (`/admin/partner-management`).

**Pattern:** After migration, always run a route audit:
```bash
# Extract all routes defined in App.tsx
grep -n 'path="' src/App.tsx

# Extract all navigation links used in components
grep -rn 'to="' src/components/ src/pages/

# Compare and find mismatches
```

### 16.4 Configuration System Migration (3-Tier)

**Date:** 2025-11-17  
**What changed:** Migrated from single `platform_config` table to a 3-tier system:

| Tier | Table | Purpose |
|------|-------|---------|
| 1 | `technical_configurations` | Encrypted API keys and secrets (PGCrypto) |
| 2 | `platform_configurations` | Business rules and settings (typed values) |
| 3 | `platform_management` | Operational scoped settings (JSONB, scoped to org/user) |

**40+ configurations seeded**, 11 edge functions updated, new `PlatformConfiguration.tsx` UI page.

### 16.5 Broken Links Fixed

After navigation audit, all broken internal links were found and fixed. Key patterns:
- Hub pages referencing incorrect route paths
- Sidebar navigation items with stale paths
- Role-based conditional link rendering

---

## 17. Database Schema Migration Strategy

### Dual Migration Approach

Two complementary sets of migration files were maintained:

```
migrations/
├── fresh-deploy/   (10 files) — Consolidated schema, fastest path for new installs
│   ├── 01_enums_extensions.sql
│   ├── 02_helper_functions.sql
│   ├── 03_tables.sql
│   ├── 03c_type_alignment_patches.sql
│   ├── 04_functions.sql
│   ├── 05_rls_policies.sql
│   ├── 05b_triggers.sql
│   ├── 06_storage.sql
│   ├── 07_auth_trigger.sql
│   └── 08_indexes.sql
└── incremental/   (72 files) — Original Supabase migrations, preserved for history
    ├── 20231201000000_init.sql
    ├── 20231202000000_add_profiles.sql
    └── ... (72 total)
```

### Why Two Sets?

1. **Fresh-deploy** is the canonical, correct final schema. It runs in a predictable order. It's what you use for every new installation.

2. **Incremental** is the historical record of how the schema evolved. It's preserved for reference and for applying future incremental changes from Lovable without conflicts.

3. The bootstrap script applies `fresh-deploy/` and then **baselines** `incremental/` (marks them all as applied without running them). Future incremental migrations from Lovable will still be applied normally.

### Bootstrap Script Logic (`scripts/run-bootstrap.sh`)

```bash
#!/bin/bash
# Wait for PostgreSQL
until pg_isready -h "$PGHOST" -U "$PGUSER"; do sleep 1; done

# Create migration tracking table
psql -c "
CREATE TABLE IF NOT EXISTS _schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);"

# Check if fresh-deploy already done
FRESH_COUNT=$(psql -tAc "SELECT COUNT(*) FROM _schema_migrations WHERE name LIKE 'fresh-deploy/%'")

if [ "$FRESH_COUNT" -eq 0 ]; then
  echo "Running fresh-deploy migrations..."
  for f in /migrations/fresh-deploy/*.sql; do
    psql -f "$f"
    psql -c "INSERT INTO _schema_migrations (name) VALUES ('fresh-deploy/$(basename $f)')"
  done

  echo "Baselining incremental migrations..."
  for f in /migrations/incremental/*.sql; do
    psql -c "INSERT INTO _schema_migrations (name) VALUES ('incremental/$(basename $f)') ON CONFLICT DO NOTHING"
  done
else
  echo "Running new incremental migrations only..."
  for f in /migrations/incremental/*.sql; do
    name="incremental/$(basename $f)"
    if ! psql -tAc "SELECT 1 FROM _schema_migrations WHERE name='$name'" | grep -q 1; then
      psql -f "$f"
      psql -c "INSERT INTO _schema_migrations (name) VALUES ('$name')"
    fi
  done
fi
```

### Schema Verification Queries

```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Count functions
SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';

-- Count RLS policies
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';

-- Count enums
SELECT COUNT(*) FROM pg_type WHERE typtype = 'e';

-- Count triggers
SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Verify storage buckets
SELECT name, public FROM storage.buckets;
```

---

## 18. Environment Variables: Complete Reference

### Files (All Gitignored)

| File | Contains | Generated by |
|------|----------|-------------|
| `.env.supabase` | Full Docker stack config (keys, passwords, ports) | `scripts/generate-keys.sh` via `make up` |
| `.env.local` | Frontend Vite env vars | `scripts/start-dev.sh` |

### Complete `.env.supabase` Reference

```env
# ─── Database ────────────────────────────────────────────────────
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# ─── JWT & Auth ──────────────────────────────────────────────────
JWT_SECRET=<min-32-char-random-string>
ANON_KEY=<generated-JWT-with-role=anon>
SERVICE_ROLE_KEY=<generated-JWT-with-role=service_role>

# ─── Realtime Encryption ─────────────────────────────────────────
DB_ENC_KEY=<32-hex-chars>          # openssl rand -hex 16
SECRET_KEY_BASE=<64-base64-chars>   # openssl rand -base64 48

# ─── URLs ────────────────────────────────────────────────────────
SITE_URL=http://localhost:8080
API_EXTERNAL_URL=http://localhost:8000
STUDIO_PORT=3001

# ─── AI ──────────────────────────────────────────────────────────
GEMINI_API_KEY=<your-google-gemini-api-key>
AI_GATEWAY_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL=gemini-2.5-flash
AI_MODEL_LITE=gemini-2.5-flash-lite
# Optional alternative:
OPENAI_API_KEY=<optional-openai-key>

# ─── Email ───────────────────────────────────────────────────────
RESEND_API_KEY=<your-resend-api-key>

# ─── Data Migration (only needed during data import) ─────────────
LOVABLE_SUPABASE_URL=https://ztixorqvwqlwbesihtkr.supabase.co
LOVABLE_SERVICE_ROLE_KEY=<lovable-service-role-key>

# ─── Optional ────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=<if-using-location-features>
ZOOM_API_KEY=<if-using-zoom-video-interviews>
STRIPE_SECRET_KEY=<if-enabling-payments>
STRIPE_WEBHOOK_SECRET=<if-enabling-payments>
```

### `.env.local` (Frontend)

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<copy-ANON_KEY-from-.env.supabase>
```

> **Variable name note:** This app uses `VITE_SUPABASE_PUBLISHABLE_KEY`, not `VITE_SUPABASE_ANON_KEY`. Different Lovable projects may use different names — check `src/integrations/supabase/client.ts` to confirm.

---

## 19. Developer Workflow (Makefile Commands)

```makefile
# Makefile — 25+ commands for common operations

# Stack lifecycle
make up              # Generate keys + start all 11 Docker services + run migrations + create buckets
make down            # Stop stack (keep data volumes)
make reset           # Full wipe: stop + delete volumes + regenerate keys + start fresh

# Frontend
make frontend        # Start Vite dev server (http://localhost:8080)

# Monitoring
make logs            # Tail all service logs
make logs-db         # Tail PostgreSQL logs only
make logs-auth       # Tail GoTrue logs only
make logs-kong       # Tail Kong logs only
make status          # Show health of all services

# Database
make db-shell        # Open psql interactive shell
make db-backup       # Run backup script
make db-restore      # Run restore script

# Keys
make keys            # Regenerate JWT keys (triggers re-deploy of Auth + REST)

# Data migration
make import-data     # Import all tables from Lovable Cloud
make import-data-dry # Preview import without writing
make import-table TABLE=profiles  # Import single table

# Other
make help            # Show all available commands
```

### One-Command First-Time Setup

```bash
git clone <repo-url> interviewtalentgeenie-v2
cd interviewtalentgeenie-v2
npm install
make up        # ← Does everything: keys, Docker, migrations, buckets
make frontend  # ← Open at http://localhost:8080
```

---

## 20. Verification Checklist

Use this to confirm the migration was successful.

### Infrastructure

```bash
# All 11 services running
docker-compose -f docker-compose.supabase.yml ps

# Service health
curl http://localhost:8000/rest/v1/         # PostgREST — should return JSON with table list
curl http://localhost:8000/auth/v1/health   # GoTrue — should return {"status":"ok"}
curl http://localhost:8000/storage/v1/      # Storage
curl http://localhost:8000/functions/v1/health-check  # Edge runtime
open http://localhost:3001                  # Studio dashboard
```

### Database Schema

```bash
make db-shell
```

```sql
-- Run inside psql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';
-- Expected: 106

SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema='public';
-- Expected: 108

SELECT COUNT(*) FROM pg_policies WHERE schemaname='public';
-- Expected: 225

SELECT name, public FROM storage.buckets;
-- Expected: 4 rows (certificates, consent-documents, documentation, proctoring-recordings)
```

### Lovable Artifacts (Should All Return Zero)

```bash
grep -r "lovable" src/ supabase/ --include="*.ts" --include="*.tsx" --include="*.js" -i
grep -r "lovable-tagger" . --include="*.json" --include="*.ts"
grep -r "GPTPlugin" src/
grep -r "supabase\.ai\.lovable" .
grep -r "lovableproject\.com" .
grep -r "ai\.gateway\.lovable" .
grep -r "LOVABLE_API_KEY" supabase/functions/
```

### Frontend Connectivity

```bash
# Start frontend and check browser console for errors
npm run dev

# Specifically check:
# - No CORS errors in console
# - Auth flow works (sign up, sign in, sign out)
# - DB queries return data
# - Edge function invocations succeed
# - Realtime connection established (no WebSocket errors)
```

---

## 21. Troubleshooting Reference

### Services Won't Start

```bash
make status                    # Which services are unhealthy?
make logs-db                   # Database logs
docker logs talentgeenie-auth  # Auth service logs
docker logs talentgeenie-kong  # Kong logs
make reset                     # Nuclear option: full wipe and restart
```

### PostgreSQL Connection Errors

```bash
# Verify DB is listening on TCP (not just Unix socket)
docker exec talentgeenie-db psql -U supabase_admin -d postgres \
  -c "SHOW listen_addresses;"
# Must show '*' or '0.0.0.0'

# Verify service role passwords are set
docker exec talentgeenie-db psql -U supabase_admin -d postgres \
  -c "SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname LIKE 'supabase_%';"
```

### Kong Returning 401/403

```bash
# Verify API keys are injected into kong.yml
docker exec talentgeenie-kong cat /var/lib/kong/kong.yml | grep -A2 "consumer"

# Test with anon key
curl -H "apikey: <your-anon-key>" http://localhost:8000/rest/v1/
```

### Realtime Connection Failing

```bash
# Check Realtime logs for specific error
docker logs talentgeenie-realtime --tail 50

# Most common causes:
# 1. APP_NAME not set → "no app name" error → add APP_NAME=realtime
# 2. _realtime schema missing → add to realtime.sql
# 3. DB_ENC_KEY too short → must be exactly 32 hex chars
```

### Edge Functions Not Responding

```bash
# Check function logs
docker logs talentgeenie-functions --tail 50

# Test health check function
curl http://localhost:8000/functions/v1/health-check \
  -H "Authorization: Bearer <anon-key>"

# Verify functions are mounted
docker exec talentgeenie-functions ls /home/deno/functions/
```

### Frontend "Failed to fetch" / CORS Errors

```bash
# Verify .env.local has correct values
cat .env.local
# VITE_SUPABASE_URL must be http://localhost:8000 (not https, not port 5432)

# Test API from browser-equivalent
curl http://localhost:8000/rest/v1/ \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

### AI Features Not Working

```bash
# Test Gemini API key directly
curl https://generativelanguage.googleapis.com/v1beta/openai/chat/completions \
  -H "Authorization: Bearer $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"hello"}]}'

# Invoke AI health monitor function
curl http://localhost:8000/functions/v1/ai-health-monitor \
  -H "Authorization: Bearer <service-role-key>"
```

---

## 22. Patterns for the Automation Tool

This section is specifically for building the Vercel-like migration automation tool.

### Detection Heuristics (Is This a Lovable App?)

```javascript
// package.json
hasLovableTagger: pkg.devDependencies?.['lovable-tagger'] !== undefined

// vite.config.ts
hasComponentTagger: source.includes('componentTagger') && source.includes('lovable-tagger')

// supabase/config.toml
hasLovableProjectId: /project_id\s*=\s*"[a-z]{20}"/.test(toml)  // 20-char Supabase project ID

// _shared/ai-caller.ts
hasLovableGateway: source.includes('ai.gateway.lovable.dev')
```

### Automated Transformation Passes

The migration tool should apply these transformations in order:

#### Pass 1: Package Cleanup
```javascript
// package.json
delete pkg.devDependencies['lovable-tagger']
pkg.name = slugify(projectName)

// vite.config.ts (AST transform or regex)
removeImport('lovable-tagger')
removePluginCall('componentTagger()')
```

#### Pass 2: URL Replacements (Regex-based)
```javascript
const replacements = [
  // Supabase Cloud URL → env var
  { pattern: /https?:\/\/[a-z]{20}\.supabase\.co/g, replacement: '${SUPABASE_URL}' },
  // Lovable project URL → FRONTEND_URL
  { pattern: /https?:\/\/[a-z]{20}\.lovableproject\.com/g, replacement: '${FRONTEND_URL}' },
  // Lovable app URL → FRONTEND_URL
  { pattern: /https?:\/\/[a-zA-Z0-9-]+\.lovable\.app/g, replacement: '${FRONTEND_URL}' },
  // Lovable AI gateway → Gemini endpoint
  { pattern: /https?:\/\/ai\.gateway\.lovable\.dev\/v1/g, 
    replacement: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  // LOVABLE_API_KEY → GEMINI_API_KEY
  { pattern: /LOVABLE_API_KEY/g, replacement: 'GEMINI_API_KEY' },
]
```

#### Pass 3: index.html Social Meta Cleanup
```javascript
// Remove Lovable OG images, twitter account, GCS-hosted favicon
// Replace with:
// - og:image → /og-image.png (local asset or configurable URL)
// - twitter:site → @youraccount or remove
// - favicon → /favicon.ico (local)
```

#### Pass 4: Service Worker Hardcoded Key Removal
```javascript
// public/proctoring-upload-sw.js
// Pattern: any full JWT (eyJ... strings) hardcoded in service workers → MUST be removed
// Replace with: self.supabaseConfig = null; await a postMessage handshake
```

#### Pass 5: AI Provider Configuration
```javascript
// _shared/config.ts
// 'gpt-4o' → env var defaulting to 'gemini-2.5-flash'
// 'gpt-4o-mini' → env var defaulting to 'gemini-2.5-flash-lite'
// 'lovable-ai' provider type → 'google' or 'openai'
```

### Infrastructure Provisioning Order

```
1. Generate JWT keys (JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY)
2. Generate DB password
3. Start PostgreSQL (wait for health)
4. Run roles.sql (set service role passwords)
5. Start Kong (wait for health, using generated keys)
6. Start GoTrue/Auth (wait for health)
7. Start PostgREST (wait for health)
8. Start Realtime (wait for health — needs _realtime schema)
9. Start Storage API (wait for health)
10. Run bootstrap migrations (fresh-deploy → baseline incremental)
11. Start Edge Runtime (wait for health)
12. Create storage buckets via Storage REST API
13. Start Imgproxy, Meta, Studio
14. Verify all endpoints
15. Build and start frontend (with generated ANON_KEY)
```

### CI/CD Pipeline Structure

```yaml
# Suggested pipeline stages for the automation tool:

stages:
  - detect          # Detect Lovable project, extract dependencies
  - analyze         # Full dependency map (AI calls, URLs, hardcoded values)
  - transform       # Apply all automated code transforms
  - provision       # Spin up target infrastructure
  - migrate-schema  # Run database migrations
  - verify-infra    # Health check all services
  - build           # Build frontend Docker image
  - migrate-data    # Import data from source (if needed)
  - deploy          # Deploy to target
  - smoke-test      # Run end-to-end smoke tests
  - notify          # Report status
```

### What Requires Human Decision (Cannot Be Automated)

| Decision | Why Human Needed |
|----------|-----------------|
| AI provider choice (Gemini vs OpenAI vs other) | Cost/policy tradeoffs |
| Domain names for production | Business decision |
| SSL/TLS certificate management | Infrastructure choice |
| Data migration timing (cutover date) | Business continuity |
| Role name mappings (if roles were renamed) | Semantic understanding |
| Custom email domain configuration | DNS access required |
| Third-party integrations (Stripe, Zoom, etc.) | Account setup required |

---

## 23. Lessons Learned

### On Planning

1. **Audit first, code second.** The dependency map (Section 3) took 2 hours to build but saved 2 weeks of debugging.

2. **The frontend is the easiest part.** Because `@supabase/supabase-js` is self-host compatible, 350+ files needed zero changes. The hard work is infrastructure, not React code.

3. **Edge functions are the biggest work.** 106 functions × avg 200 lines = ~20,000 lines of Deno code. Planning the migration in priority tiers (auth first, AI features later) was essential.

4. **Self-hosted Supabase's Docker setup is finicky.** Expect 8–12 boot issues on first run. Document every fix.

### On Execution

5. **Kong's lack of `envsubst` is a trap.** The official Supabase Docker documentation often shows `${VARIABLE}` syntax in `kong.yml`, but Kong's own image can't substitute them. Always use the `sed`-based entrypoint workaround.

6. **Realtime needs three things to boot:** `APP_NAME=realtime`, `SEED_SELF_HOST=true`, and the `_realtime` schema pre-existing in the database. Miss any one and you get an endless restart loop.

7. **`listen_addresses='*'` is mandatory.** A vanilla PostgreSQL install only listens on Unix sockets. Every Docker service that connects to it needs TCP. Add it to the command line.

8. **Storage buckets cannot be created in SQL init.** The Storage API manages its own schema. Creating buckets via REST API after services are healthy is the only reliable approach.

9. **The Gemini OpenAI-compatible endpoint uses bare model names.** `gemini-2.5-flash` works. `google/gemini-2.5-flash` throws a 404. This is not obvious from the documentation.

10. **Never commit the anon key in a service worker.** The original project had a full JWT hardcoded in `public/proctoring-upload-sw.js`. This is a critical security issue — service workers are public. Always use `postMessage` to receive sensitive config dynamically.

### On Documentation

11. **Write docs as you go, not after.** Most of the documentation in this project was written during the migration, not after. This is why it's so detailed.

12. **Keep commit messages semantic and phase-numbered.** The 8 commits in `MIGRATION_DOCUMENTATION.md` section 20 tell a clear story. Each commit maps to a distinct phase.

13. **Version numbers matter for Docker images.** Pinning exact versions (`supabase/postgres:15.8.1.085`, `kong:2.8.1`) prevents future compatibility breaks.

---

## 24. Commit History (Ordered)

| # | Hash | Message | What Changed |
|---|------|---------|-------------|
| 1 | `77d3764` | feat: Initialize interviewtalentgeenie-v2 - clean repo without Lovable artifacts | 694 files — complete source copy, all Lovable cleanups |
| 2 | `7aff833` | feat: Phase 1 — Self-hosted Supabase infrastructure for local dev | Docker Compose (11 services), scripts, Makefile, migration system |
| 3 | `3455854` | feat: Phase 2 — Self-hosted Edge Functions via Deno runtime | Edge runtime config, function mounting, Kong routing |
| 4 | `c5894bf` | feat: Phases 3-5 — Frontend env wiring, Realtime, Storage | `.env.local`, Realtime env/schema config, storage buckets |
| 5 | `3e99ba7` | feat: Phases 6-8 — Deployment configs, CI/CD, Data migration | Docker prod, K8s, Helm, GitHub Actions, import scripts |
| 6 | `119f9df` | fix: Replace Lovable AI Gateway with direct Google Gemini OpenAI-compatible endpoint | 14 functions + 3 shared utilities modified |
| 7 | `effa29a` | feat: API-based data migration from Lovable Cloud | `data-export` function + `import-from-lovable.sh` (482 lines) |
| 8 | `44f98c8` | fix: Docker stack boot — DB listen_addresses, role passwords, Kong template, Realtime schema, bootstrap baseline logic | All Docker debugging fixes consolidated |

---

## Appendix A: Complete Lovable Cleanup Checklist

Use this as a definitive checklist for any Lovable project migration:

### NPM/Build
- [ ] `package.json` — Remove `lovable-tagger` from devDependencies
- [ ] `package.json` — Rename from `vite_react_shadcn_ts` to project name
- [ ] `vite.config.ts` — Remove `import { componentTagger } from "lovable-tagger"`
- [ ] `vite.config.ts` — Remove `componentTagger()` from plugins array

### Mobile/Capacitor
- [ ] `capacitor.config.ts` — Replace `app.lovable.*` appId
- [ ] `capacitor.config.ts` — Replace `lovableproject.com` server URL

### Database Config
- [ ] `supabase/config.toml` — Replace project ID

### Security-Critical Files
- [ ] `public/proctoring-upload-sw.js` or any service worker — Remove hardcoded Supabase URL
- [ ] Same file — Remove hardcoded anon JWT key (SECURITY: full JWT in public file)
- [ ] `src/lib/backgroundUploader.ts` — Remove hardcoded Supabase URL fallback
- [ ] `.gitignore` — Add `.env`, `.env.supabase`, `.env.local`

### Frontend UI
- [ ] `src/pages/AIConfiguration.tsx` — Remove `lovable: "💙"` from provider icon map

### HTML/Social Meta
- [ ] `index.html` — Replace `og:image` from `lovable.dev` to self-hosted
- [ ] `index.html` — Remove `twitter:site: @lovable_dev`
- [ ] `index.html` — Replace `twitter:image` from `lovable.dev` to self-hosted
- [ ] `index.html` — Replace favicon from GCS/gpt-engineer-file-uploads to local

### Edge Functions — AI Gateway (Replace All)
- [ ] `_shared/ai-caller.ts` — Replace gateway URL + API key env var
- [ ] `_shared/config.ts` — Remove `LOVABLE_API_KEY`, `lovable-ai` provider type; update model names
- [ ] `add-questions/index.ts` — Replace direct gateway call
- [ ] `admin-log-analysis/index.ts` — Replace direct gateway calls (×2)
- [ ] `analyze-proctoring-video/index.ts` — Replace direct gateway calls (×4)
- [ ] `chatbot-assist/index.ts` — Replace `LOVABLE_API_KEY` + gateway call
- [ ] `extract-skills/index.ts` — Replace direct gateway call
- [ ] `generate-certification-questions/index.ts` — Replace `LOVABLE_API_KEY` + gateway call
- [ ] `generate-job-description/index.ts` — Replace direct gateway call
- [ ] `generate-schema/index.ts` — Replace direct gateway calls (×2)
- [ ] `reconstruct-interviews/index.ts` — Replace direct gateway call
- [ ] `test-ai-connection/index.ts` — Remove `case 'lovable':` test case

### Edge Functions — URL Fallbacks (Replace All)
- [ ] `_shared/email-helper.ts` — Replace `lovableproject.com` + `lovable.app` fallbacks with `FRONTEND_URL`
- [ ] `approve-questions/index.ts` — Replace hardcoded `lovableproject.com` URL
- [ ] `send-email/index.ts` — Replace `lovableproject.com` fallback
- [ ] `send-password-setup/index.ts` — Replace `lovableproject.com` fallback
- [ ] `send-review-request/index.ts` — Replace `lovableproject.com` fallback
- [ ] `send-invitation-reminders/index.ts` — Replace `lovable.app` URL

### File Relocations
- [ ] Move `public/deployment-package/` contents to repo root level (CI/CD, Terraform, etc.)

### Custom Code Preservation
- [ ] Copy `eslint-rules/no-duplicate-layout-wrapper.js` custom ESLint rule to new repo
- [ ] Verify `eslint.config.js` still references the custom rule correctly

---

## Appendix B: Docker Service Version Reference

| Service | Image | Version Used | Notes |
|---------|-------|-------------|-------|
| PostgreSQL | `supabase/postgres` | `15.8.1.085` | Must use Supabase image for pgsodium, pg_net |
| Kong | `kong` | `2.8.1` | No envsubst — use sed entrypoint |
| GoTrue (Auth) | `supabase/gotrue` | `v2.158.1` | |
| PostgREST | `postgrest/postgrest` | `v12.2.0` | |
| Realtime | `supabase/realtime` | `v2.30.34` | Needs APP_NAME + _realtime schema |
| Storage API | `supabase/storage-api` | `v1.11.13` | Create buckets via API only |
| Imgproxy | `darthsim/imgproxy` | `v3.8.0` | |
| Postgres-Meta | `supabase/postgres-meta` | `v0.84.2` | |
| Studio | `supabase/studio` | `20241029-46e1e40` | Use port 3001 to avoid conflicts |
| Edge Runtime (Deno) | `supabase/edge-runtime` | `v1.70.3` | |

---

## Appendix C: Key File Inventory (Infrastructure Only)

| File | Lines | Purpose |
|------|-------|---------|
| `docker-compose.supabase.yml` | 427 | Full 11-service Supabase stack |
| `docker-compose.prod.yml` | ~300 | Production config with resource limits |
| `Dockerfile` | ~20 | Multi-stage frontend (Node 20 + Nginx) |
| `nginx.conf` | ~40 | Production SPA serving + security headers |
| `Makefile` | 177 | Developer command shortcuts (25+ targets) |
| `scripts/start-dev.sh` | 237 | Stack startup orchestrator |
| `scripts/run-bootstrap.sh` | 172 | DB migration runner with baselining |
| `scripts/generate-keys.sh` | 136 | JWT key pair generator |
| `scripts/import-from-lovable.sh` | 482 | Cloud → self-hosted data import |
| `scripts/init-storage-buckets.sh` | 98 | Storage bucket creation via REST API |
| `scripts/backup-database.sh` | ~80 | Backup utility |
| `scripts/restore-database.sh` | ~80 | Restore utility |
| `scripts/verify-backups.sh` | ~60 | Backup verification |
| `docker/volumes/db/roles.sql` | 55 | PostgreSQL service role passwords |
| `docker/volumes/db/realtime.sql` | 57 | Realtime schema + publications |
| `docker/volumes/api/kong.yml` | ~200 | Kong API gateway routing |
| `migrations/fresh-deploy/` | 10 files | Consolidated schema (all 106 tables, 108 functions, 225 RLS policies) |
| `migrations/incremental/` | 72 files | Original Supabase migration history |
| `.github/workflows/ci.yml` | ~80 | Lint + type-check + unit tests |
| `.github/workflows/deploy-staging.yml` | ~60 | Staging deployment pipeline |
| `.github/workflows/deploy-production.yml` | ~80 | Production deployment pipeline |
| `kubernetes/` | ~10 manifests | K8s Deployments, Services, Ingress, Secrets |
| `helm/talentgeenie/` | ~15 files | Helm chart for K8s deployment |

---

*This document synthesizes all migration documentation for InterviewTalentGeenie.*  
*It is intended as the authoritative reference for building an automated Lovable migration tool.*  
*Last updated: February 2026*
