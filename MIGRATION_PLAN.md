# InterviewTalentGeenie — Complete Migration Plan

## From Lovable + Supabase Cloud → Self-Managed Infrastructure

**Date:** 18 February 2026  
**Status:** Plan Only — No Implementation Started

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Audit](#2-current-architecture-audit)
3. [Lovable/Supabase Dependency Map](#3-lovablesupabase-dependency-map)
4. [Migration Strategy Recommendation](#4-migration-strategy-recommendation)
5. [Phase-Wise Migration Plan](#5-phase-wise-migration-plan)
6. [New Repository Structure](#6-new-repository-structure)
7. [Risk Register](#7-risk-register)
8. [Effort Estimates](#8-effort-estimates)

---

## 1. Executive Summary

InterviewTalentGeenie is an AI-powered interview and talent assessment platform currently hosted on **Lovable** (frontend hosting + AI gateway) with **Supabase Cloud** (database, auth, edge functions, storage, realtime).

### Goal
Migrate to a **self-managed infrastructure** with an **exact replica** — zero UI changes, zero spelling changes, zero behavioral differences. Create a new standalone git repository free of all Lovable/Supabase Cloud dependencies.

### Scale of the Project

| Component | Count |
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
| Supabase calls in frontend | 323 call sites across all patterns |

---

## 2. Current Architecture Audit

### 2.1 Frontend Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Bundler | Vite 5 + SWC |
| UI Library | shadcn/ui (50 components) + Radix UI |
| Styling | Tailwind CSS 3 + CSS variables (HSL, dark mode) |
| Routing | React Router DOM v6 (nested routes) |
| State Management | React Context (3) + TanStack React Query v5 |
| Forms | React Hook Form + Zod v4 |
| Charts | Recharts |
| Code Editor | Monaco Editor |
| Diagrams | Mermaid |
| Export | jspdf, docx, exceljs, html2canvas |
| Mobile (scaffold) | Capacitor (iOS + Android) |

### 2.2 Backend (Supabase Cloud)

| Service | Usage |
|---------|-------|
| **PostgreSQL** | 121 tables, 85 RPC functions, 330+ RLS policies, 62 triggers |
| **Auth (GoTrue)** | Email/password, JWT tokens, session management, password reset, email verification |
| **Edge Functions** | 105 Deno functions + 10 shared utility files |
| **Storage** | 1 bucket (`proctoring-recordings`) — video up to 2GB, screenshots up to 5MB |
| **Realtime** | 5 named channels + 4 dynamic WebRTC channels |

### 2.3 AI Architecture

All AI calls route through edge functions — the frontend **never** calls AI providers directly.

| AI Pathway | Functions | Target |
|------------|-----------|--------|
| Via shared `_shared/ai-caller.ts` | 22 functions | Lovable AI Gateway → Gemini/OpenAI |
| Direct Lovable AI Gateway calls | 9 functions | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| **Total AI-touching functions** | **31** | |

### 2.4 Roles & Multi-Tenancy

**6 system roles:** `platform_admin`, `partner_admin`, `hr_recruiter`, `tech_spoc`, `billing_contact`, `guest`  
**Custom roles:** Organization-scoped via `custom_roles` + `user_custom_roles` tables  
**Multi-tenancy:** Organization-scoped data with impersonation for platform admins

### 2.5 External Services

| Service | Used By | Purpose |
|---------|---------|---------|
| **Resend** | 3 edge functions (`send-email`, `send-verification-email`, `auth-email-hook`) | Email delivery |
| **Google Gemini** | Via AI gateway/caller | AI completions (primary) |
| **OpenAI** | Via AI gateway/caller | AI completions (secondary) |
| **Stripe** | Config keys defined, no active implementation | Payment (future) |

---

## 3. Lovable/Supabase Dependency Map

### 3.1 Lovable-Specific Dependencies (MUST REMOVE)

#### A. NPM Package
| File | Dependency | Purpose |
|------|-----------|---------|
| `package.json` L93 | `lovable-tagger: ^1.1.10` | Dev tool for Lovable component tagging |
| `vite.config.ts` L4 | `import { componentTagger } from "lovable-tagger"` | Vite plugin (dev only) |
| `vite.config.ts` L13 | `mode === "development" && componentTagger()` | Conditional plugin usage |

#### B. Lovable AI Gateway (31 functions affected)
| Location | URL/Reference |
|----------|--------------|
| `_shared/ai-caller.ts` L271, L434 | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| `_shared/config.ts` L419 | `https://ai.gateway.lovable.dev/v1` (base URL) |
| `_shared/config.ts` L21, L413-420 | `LOVABLE_API_KEY` env var, `lovable-ai` provider type |
| `add-questions/index.ts` L173 | Direct gateway call |
| `admin-log-analysis/index.ts` L571, L649 | Direct gateway calls |
| `analyze-proctoring-video/index.ts` L253, L555, L920, L1076 | Direct gateway calls (4 locations) |
| `chatbot-assist/index.ts` L33, L181 | `LOVABLE_API_KEY` + direct gateway call |
| `extract-skills/index.ts` L277 | Direct gateway call |
| `generate-certification-questions/index.ts` L28, L97 | `LOVABLE_API_KEY` + direct gateway call |
| `generate-job-description/index.ts` L129 | Direct gateway call |
| `generate-schema/index.ts` L74, L132 | Direct gateway calls (2 locations) |
| `reconstruct-interviews/index.ts` L103 | Direct gateway call |
| `test-ai-connection/index.ts` L126 | `case 'lovable':` test case |

#### C. Lovable Project URLs (Hardcoded Fallbacks)
| Location | URL |
|----------|-----|
| `capacitor.config.ts` L4 | `app.lovable.vtztavcqjmirktkjdprm` (app ID) |
| `capacitor.config.ts` L8 | `https://vtztavcqjmirktkjdprm.lovableproject.com?forceHideBadge=true` |
| `public/proctoring-upload-sw.js` L10 | `https://vtztavcqjmirktkjdprm.supabase.co` (hardcoded) |
| `public/proctoring-upload-sw.js` L11 | **HARDCODED SUPABASE ANON KEY** (full JWT, 243 chars) — SECURITY RISK |
| `src/lib/backgroundUploader.ts` L391 | `https://vtztavcqjmirktkjdprm.supabase.co` (fallback) |
| `src/pages/AIConfiguration.tsx` L338 | `lovable: "💙"` (UI icon mapping) |
| `_shared/email-helper.ts` L70 | `https://${projectId}.lovableproject.com` (fallback) |
| `_shared/email-helper.ts` L74 | `https://lovable.app` (last resort fallback) |

#### D. Lovable References in index.html (CRITICAL — MISSED PREVIOUSLY)
| Location | Content | Impact |
|----------|---------|--------|
| `index.html` L13 | `og:image` → `https://lovable.dev/opengraph-image-p98pqg.png` | Lovable branding in social shares |
| `index.html` L15 | `twitter:site` → `@lovable_dev` | Links to Lovable Twitter |
| `index.html` L16 | `twitter:image` → `https://lovable.dev/opengraph-image-p98pqg.png` | Lovable branding |
| `index.html` L22 | `favicon` → `https://storage.googleapis.com/gpt-engineer-file-uploads/...` | Favicon hosted on Lovable's GCS bucket |

#### E. Deployment Package — Lovable-Specific Scripts
| Location | Content |
|----------|--------|
| `public/deployment-package/scripts/revoke_lovable_access.sh` | Script to revoke Lovable deploy keys, IAM roles, webhooks |
| `approve-questions/index.ts` L128 | `https://vtztavcqjmirktkjdprm.lovableproject.com` (hardcoded!) |
| `send-email/index.ts` L108 | `vtztavcqjmirktkjdprm.lovableproject.com` (fallback) |
| `send-password-setup/index.ts` L67 | `vtztavcqjmirktkjdprm.lovableproject.com` (fallback) |
| `send-review-request/index.ts` L108 | `vtztavcqjmirktkjdprm.lovableproject.com` (fallback) |
| `send-invitation-reminders/index.ts` L79 | `https://interviewtalentgeenie.lovable.app` (hardcoded) |
| `supabase/config.toml` L1 | `project_id = "ztixorqvwqlwbesihtkr"` |

### 3.2 Supabase Client Dependencies (Frontend — 323 Call Sites)

| Pattern | Occurrences | Files Affected |
|---------|-------------|----------------|
| `supabase.from(` (DB queries) | 94 | 12 files |
| `supabase.auth.*` (authentication) | 83 | 42 files |
| `invokeFunction(` (edge function wrapper) | 102 | 49 files |
| `supabase.functions.invoke` (direct) | 15 | 11 files |
| `.rpc(` (DB function calls) | 19 | 11 files |
| `.channel(` (realtime) | 9 | 6 files |
| `supabase.storage.*` | 1 | 1 file |
| **TOTAL** | **323** | |

### 3.3 Supabase Extensions Required

From the base migration, these PostgreSQL extensions must be available:
- `uuid-ossp` — UUID generation
- `pgcrypto` — Cryptographic functions
- `pgsodium` — Encryption (used for API key encryption triggers)
- `pg_net` — HTTP requests from PostgreSQL
- `pg_graphql` — GraphQL (used by Supabase, may not be needed)
- `pg_stat_statements` — Query statistics
- `plpgsql` — PL/pgSQL (standard)
- `supabase_vault` — Secrets storage

---

## 4. Migration Strategy Recommendation

### Strategy: Self-Host Open-Source Supabase Stack

**Why this approach:**
- Supabase is **100% open source** — every component can be self-hosted
- The `@supabase/supabase-js` client works with self-hosted Supabase identically
- This means **ZERO changes** to all 323 frontend Supabase call sites
- All 121 tables, 85 RPC functions, 330+ RLS policies work as-is
- Auth, Storage, Realtime — all keep the same client API
- Only the edge functions need porting (Deno runtime must be replaced)

### What Changes vs What Stays the Same

| Component | Changes? | Details |
|-----------|----------|---------|
| All 93 pages | ❌ NO | Zero changes |
| All 129 components | ❌ NO | Zero changes |
| All 25 hooks | ❌ NO | Zero changes |
| All 3 contexts | ❌ NO | Zero changes |
| All CSS/Tailwind styling | ❌ NO | Zero changes |
| All 102 routes | ❌ NO | Zero changes |
| `src/integrations/supabase/client.ts` | ❌ NO | Just change env var values |
| `src/integrations/supabase/types.ts` | ❌ NO | Zero changes |
| `src/lib/supabaseFunctions.ts` | ❌ NO | Works with self-hosted Supabase |
| All 37 lib utilities | ❌ NO | Zero changes |
| Database schema (121 tables) | ❌ NO | Exact same PostgreSQL |
| RLS policies (330+) | ❌ NO | PostgREST handles them identically |
| DB functions (85) | ❌ NO | Standard PostgreSQL |
| `package.json` | ✅ YES | Remove `lovable-tagger` |
| `vite.config.ts` | ✅ YES | Remove `componentTagger` import/usage |
| `capacitor.config.ts` | ✅ YES | Update appId, remove lovable URL |
| `.env` / `.env.example` | ✅ YES | Point to self-hosted URLs |
| `supabase/config.toml` | ✅ YES | New project ID |
| Edge functions (105) | ✅ YES | Port from Deno to Node.js/Express |
| `_shared/` utilities (10) | ✅ YES | Port from Deno to Node.js |
| AI Gateway references (31 functions) | ✅ YES | Replace Lovable gateway with direct API |
| Lovable URL fallbacks (12 locations) | ✅ YES | Replace with your domain |
| `public/proctoring-upload-sw.js` | ✅ YES | Replace hardcoded Supabase URL |
| `src/lib/backgroundUploader.ts` | ✅ YES | Replace hardcoded fallback URL |
| `src/pages/AIConfiguration.tsx` | ✅ YES | Remove "lovable" from provider icon map |

---

## 5. Phase-Wise Migration Plan

### Phase 0: New Repository Setup (Day 1)

**Goal:** Create a clean new git repository with the exact frontend codebase.

**Tasks:**
1. Create new git repository `interviewtalentgeenie-v2` (or your preferred name)
2. Copy the entire project (excluding `node_modules/`, `.git/`, Lovable lockfiles)
3. Remove Lovable-specific artifacts:
   - Remove `lovable-tagger` from `package.json` devDependencies
   - Remove `componentTagger` import and usage from `vite.config.ts`
   - Update `capacitor.config.ts` — new appId, remove lovableproject.com URL
   - Update `package.json` name from `vite_react_shadcn_ts` to `interviewtalentgeenie`
4. Replace all hardcoded Lovable URLs with environment variable references:
   - `public/proctoring-upload-sw.js` — use dynamic URL
   - `src/lib/backgroundUploader.ts` — remove hardcoded supabase.co fallback
   - `src/pages/AIConfiguration.tsx` — remove `lovable` from provider icon map
5. Update `.env.example` with self-hosted variable templates
6. Commit initial clean state

**Files changed: ~6 files | No functional changes | No UI changes**

---

### Phase 1: Self-Hosted Supabase Infrastructure (Week 1–2)

**Goal:** Deploy self-hosted Supabase stack that the existing frontend can connect to.

#### 1A. Docker Compose for Self-Hosted Supabase

Deploy these open-source Supabase components:

| Component | Image | Purpose |
|-----------|-------|---------|
| **PostgreSQL 15** | `supabase/postgres:15` | Database (same as Supabase Cloud) |
| **PostgREST** | `postgrest/postgrest` | REST API → keeps `supabase.from()` working |
| **GoTrue** | `supabase/gotrue` | Auth → keeps `supabase.auth.*` working |
| **Realtime** | `supabase/realtime` | WebSocket → keeps `.channel()` working |
| **Storage API** | `supabase/storage-api` | S3-compatible → keeps `.storage.*` working |
| **Kong / API Gateway** | `kong` | Routes requests to correct service |
| **Supabase Studio** | `supabase/studio` | Admin dashboard (optional) |

#### 1B. Database Migration

1. Run the fresh-deploy migration scripts in order:
   ```
   migrations/fresh-deploy/01_enums_extensions.sql
   migrations/fresh-deploy/02_helper_functions.sql
   migrations/fresh-deploy/03_tables.sql
   migrations/fresh-deploy/03c_type_alignment_patches.sql
   migrations/fresh-deploy/04_functions.sql
   migrations/fresh-deploy/05_rls_policies.sql
   migrations/fresh-deploy/05b_triggers.sql
   migrations/fresh-deploy/06_storage.sql
   migrations/fresh-deploy/07_auth_trigger.sql
   migrations/fresh-deploy/08_indexes.sql
   ```
2. OR run the base migration + all 72 incremental migrations from `supabase/migrations/`
3. Verify all 121 tables, 85 functions, 330+ RLS policies, 62 triggers exist
4. Create the `proctoring-recordings` storage bucket

#### 1C. Extensions

Ensure these PostgreSQL extensions are installed:
- `uuid-ossp` ✅ (standard)
- `pgcrypto` ✅ (standard)
- `pgsodium` ⚠️ (requires Supabase postgres image or manual install)
- `pg_net` ⚠️ (Supabase-specific, may need alternative)
- `plpgsql` ✅ (standard)

Note: `pg_graphql` and `supabase_vault` are Supabase-specific. If using `supabase/postgres` Docker image, they are included. Otherwise, they may need alternatives.

#### 1D. Environment Configuration

```env
# Self-hosted Supabase
VITE_SUPABASE_URL=https://api.yourdomain.com
VITE_SUPABASE_PUBLISHABLE_KEY=<your-generated-anon-key>

# Backend
SUPABASE_SERVICE_ROLE_KEY=<your-generated-service-role-key>
JWT_SECRET=<your-jwt-secret>
DATABASE_URL=postgresql://postgres:password@db:5432/postgres

# Frontend URL (replaces all lovableproject.com fallbacks)
FRONTEND_URL=https://yourdomain.com
```

**Validation:** Run the existing frontend against self-hosted Supabase. Auth, DB queries, storage, realtime should all work with just env var changes.

---

### Phase 2: Edge Function Migration — API Server (Week 2–5)

**Goal:** Port all 105 Supabase Edge Functions from Deno to a Node.js/Express API server.

This is the **largest workload** because:
- Edge functions run on **Deno** (Supabase's runtime)
- Self-hosted Supabase does NOT include edge function hosting
- All 105 functions must be ported to a self-hosted API server

#### 2A. API Server Scaffold

Create a Node.js + Express (or Fastify) server with:
- TypeScript
- Route per edge function (preserve exact function names as URL paths)
- JWT auth middleware (validate Supabase JWTs)
- Supabase admin client (service role key for DB operations)
- Shared utility modules (port from `_shared/`)

#### 2B. Port Shared Utilities First (10 files)

| Shared File | Lines | Priority | Key Changes |
|-------------|-------|----------|-------------|
| `cors.ts` | 4 | P0 | Express CORS middleware |
| `auth-utils.ts` | 142 | P0 | Replace `Deno.env.get()` → `process.env` |
| `logger.ts` | 73 | P0 | Replace Deno console → Winston/Pino |
| `config.ts` | 539 | P0 | Replace `Deno.env.get()` → `process.env`, update AI gateway URLs |
| `ai-caller.ts` | 535 | P0 | **Replace Lovable AI Gateway → direct Gemini/OpenAI APIs** |
| `ai-retry.ts` | 188 | P0 | Replace `Deno.env.get()` → `process.env` |
| `email-helper.ts` | 405 | P1 | Replace lovableproject.com fallbacks → `FRONTEND_URL` |
| `email-sanitizer.ts` | 85 | P1 | Minimal changes (pure functions) |
| `proctoring-config.ts` | 392 | P1 | Replace Deno → Node.js |
| `system-logger.ts` | 381 | P2 | Replace Deno → Node.js |

#### 2C. AI Gateway Replacement (Critical)

The `ai-caller.ts` shared module and 9 direct-calling functions must replace:

| Current | Replacement |
|---------|------------|
| `https://ai.gateway.lovable.dev/v1/chat/completions` | Direct Google Gemini API: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| `LOVABLE_API_KEY` env var | `GOOGLE_GEMINI_API_KEY` and/or `OPENAI_API_KEY` |
| `lovable-ai` provider type | `google-gemini` provider type |

**Functions requiring direct AI gateway replacement (9):**
1. `add-questions/index.ts`
2. `admin-log-analysis/index.ts`
3. `analyze-proctoring-video/index.ts` (4 call sites — most complex)
4. `chatbot-assist/index.ts`
5. `extract-skills/index.ts`
6. `generate-certification-questions/index.ts`
7. `generate-job-description/index.ts`
8. `generate-schema/index.ts` (2 call sites)
9. `reconstruct-interviews/index.ts`

**Functions using shared ai-caller (22) — fixed automatically when shared module is ported.**

#### 2D. Edge Function Porting by Priority

**P0 — Auth & Core (Week 2) — 7 functions**
| Function | Complexity | Notes |
|----------|-----------|-------|
| `complete-user-signup` | Medium | Profile + role creation on signup |
| `complete-password-setup` | Medium | Invitation token verification + password set |
| `verify-email-token` | Low | Token verification |
| `admin-user-management` | Medium | CRUD for users |
| `approve-partner-application` | Medium | Uses transactional DB function |
| `manage-organization-user` | Medium | Org membership management |
| `auth-email-hook` | Medium | Custom email hook (uses Resend) |

**P0 — Interview Core (Week 2–3) — 20 functions**
| Function | Complexity | Notes |
|----------|-----------|-------|
| `generate-questions` | High | AI question generation, uses shared ai-caller |
| `evaluate-interview` | High | AI evaluation engine, saves via transaction |
| `resolve-invitation` | Medium | Creates attempt from share token |
| `resolve-slug-invitation` | Medium | Slug-based invitation resolution |
| `send-interview-invitations` | Medium | Email sending |
| `create-from-template` | Medium | Template → interview creation |
| `delete-interview` | Low | Transactional delete |
| `approve-questions` | Medium | Tech SPOC workflow — **has hardcoded lovable URL** |
| `submit-for-review` | Low | Workflow status update |
| `send-review-request` | Medium | Notification email — **has lovable URL fallback** |
| `add-questions` | Medium | **Direct Lovable AI Gateway call** |
| `regenerate-questions` | Medium | Role-restricted regeneration |
| `regenerate-single-question` | Medium | Uses shared ai-caller |
| `batch-regenerate-questions` | Medium | Batch operation |
| `bulk-approve-questions` | Low | Bulk status update |
| `get-approved-questions` | Low | Query only |
| `reassign-all-invitation-questions` | Low | Question reassignment |
| `reassign-invitation-questions` | Low | Per-invitation reassignment |
| `schedule-interview` | Medium | Calendar integration |
| `calculate-cpi` | Medium | Scoring algorithm |

**P1 — Proctoring (Week 3–4) — 13 functions**
| Function | Complexity | Notes |
|----------|-----------|-------|
| `init-proctoring-session` | Medium | Session initialization |
| `update-proctoring-session` | Medium | Session data update |
| `log-proctoring-violation` | Medium | Violation tracking |
| `get-proctoring-upload-url` | Medium | Signed URL generation → **needs S3/MinIO equivalent** |
| `get-chunk-upload-url` | Medium | Chunk signed URLs |
| `upload-proctoring-recording` | High | Up to 2GB video upload |
| `upload-proctoring-screenshot` | Medium | Up to 5MB screenshot |
| `confirm-proctoring-upload` | Low | Storage verification |
| `merge-proctoring-chunks` | High | Download + merge + re-upload (150MB batches) |
| `repair-webm-metadata` | High | WebM file manipulation |
| `analyze-proctoring-video` | Very High | **4 direct Lovable AI Gateway calls**, vision AI |
| `cleanup-proctoring-chunks` | Low | Storage cleanup |
| `cleanup-stale-proctoring` | Low | Scheduled cleanup |

**P1 — Email (Week 3) — 5 functions**
| Function | Complexity | Notes |
|----------|-----------|-------|
| `send-email` | Medium | Core email sender (Resend) — **has lovable URL fallback** |
| `resend-email` | Low | Retry by email log ID |
| `send-notification` | Low | In-app notification creation |
| `send-password-setup` | Medium | Token email — **has lovable URL fallback** |
| `send-verification-email` | Medium | Email verification (Resend direct) |

**P2 — AI Features (Week 4) — 22 functions using shared ai-caller**
All use the shared `callAI()` / `callAIWithTools()` — once the shared module is ported, these only need `Deno.env.get()` → `process.env` changes.

| Functions |
|-----------|
| `evaluate-learning-assessment`, `parse-resume`, `refine-assessment-feedback`, `enhance-email-content`, `detect-bias`, `improve-documentation-format`, `generate-comparative-report`, `update-architecture-diagram`, `generate-documentation`, `suggest-jd-content`, `analyze-test-error`, `analyze-violations`, `generate-learning-questions`, `enhance-content-with-ai`, `generate-documentation-from-code`, `generate-training-plan`, `enhance-job-description`, `generate-predictive-analytics`, `generate-certificate-pdf`, `generate-certification-questions`, `chatbot-assist`, `extract-skills` |

**P2 — Learning & Certification (Week 4) — 6 functions**
`evaluate-certification`, `evaluate-learning-assessment`, `generate-learning-questions`, `generate-certification-questions`, `generate-certificate-pdf`, `check-assessment-limit`

**P3 — Admin & System (Week 5) — remaining ~30 functions**
Cleanup jobs, test runners, monitoring, ATS integration, deployment tools, etc.

#### 2E. Scheduled Jobs

Port these cron functions to a job scheduler (node-cron, BullMQ, or pg_cron):

| Function | Schedule | Purpose |
|----------|----------|---------|
| `enforce-interview-deadlines` | Every 2 min | Terminate expired attempts |
| `cleanup-stale-proctoring` | Every hour | Clean stale proctoring data |
| `send-invitation-reminders` | Scheduled | Send email reminders (max 3) |
| `scheduled-data-cleanup` | Scheduled | Data retention enforcement |
| `auto-close-sessions` | Scheduled | Close expired proctoring sessions |
| `ai-health-monitor` | Scheduled | AI feature health checks |
| `cleanup-proctoring-chunks` | Scheduled | Clean processed chunk files |

---

### Phase 3: Frontend Adjustments (Week 3 — Parallel with Phase 2)

**Goal:** Remove Lovable artifacts from frontend, point to self-hosted services.

#### 3A. Remove Lovable Dependencies

| File | Change |
|------|--------|
| `package.json` | Remove `"lovable-tagger": "^1.1.10"` from devDependencies |
| `package.json` | Change name from `"vite_react_shadcn_ts"` to `"interviewtalentgeenie"` |
| `vite.config.ts` | Remove `import { componentTagger } from "lovable-tagger"` and `componentTagger()` usage |

#### 3B. Update Hardcoded URLs

| File | Current | New |
|------|---------|-----|
| `capacitor.config.ts` L4 | `app.lovable.vtztavcqjmirktkjdprm` | `com.interviewtalentgeenie.app` |
| `capacitor.config.ts` L8 | `https://vtztavcqjmirktkjdprm.lovableproject.com?forceHideBadge=true` | `https://yourdomain.com` |
| `public/proctoring-upload-sw.js` L10 | `https://vtztavcqjmirktkjdprm.supabase.co` | Read from message/config (dynamic) |
| `src/lib/backgroundUploader.ts` L391 | `https://vtztavcqjmirktkjdprm.supabase.co` | `import.meta.env.VITE_SUPABASE_URL` (already primary, remove hardcoded fallback) |
| `src/pages/AIConfiguration.tsx` L338 | `lovable: "💙"` | Remove or replace with `gemini: "🤖"` |

#### 3C. Update Environment Templates

| File | Changes |
|------|---------|
| `.env.example` | Add `FRONTEND_URL`, `DATABASE_URL`, `JWT_SECRET`; remove Lovable-specific comments |
| `supabase/config.toml` | Update `project_id` to new self-hosted project |

#### 3D. Zero-Touch Files (NO changes needed)

These files work as-is when pointed to self-hosted Supabase:
- `src/integrations/supabase/client.ts` — reads from env vars
- `src/integrations/supabase/types.ts` — pure type definitions
- `src/lib/supabaseFunctions.ts` — generic `invoke()` wrapper
- All 93 pages, 129 components, 25 hooks, 3 contexts, 37 lib files
- All CSS, Tailwind config, index.html
- All shadcn/ui components

---

### Phase 4: Realtime & WebRTC (Week 4)

**Goal:** Ensure realtime channels and WebRTC signaling work with self-hosted Supabase.

Self-hosted Supabase Realtime server supports the same API, so these should work out of the box:

| Channel | Location | Type |
|---------|----------|------|
| `notifications-{userId}` | NotificationCenter.tsx, Notifications.tsx | postgres_changes |
| `proctoring-updates` | ProctoringDashboard.tsx | postgres_changes |
| `ai-health-alerts-{userId}` | useAIHealthMonitoring.ts | postgres_changes |
| `auth-verify-{random}` | Auth.tsx | Broadcast |
| `live-stream-{sessionId}` (×4) | liveStreamWebRTC.ts | Broadcast + postgres_changes |

**Tasks:**
1. Deploy self-hosted Supabase Realtime server
2. Configure Realtime to listen to relevant tables
3. Test notification delivery, proctoring live stream, AI health alerts
4. Verify WebRTC signaling for live proctoring

---

### Phase 5: Storage Migration (Week 4)

**Goal:** Migrate the `proctoring-recordings` bucket.

**Tasks:**
1. Self-hosted Supabase Storage API handles this — same client API
2. Create the `proctoring-recordings` bucket on the self-hosted instance
3. Configure storage policies (matching current RLS)
4. Update `public/proctoring-upload-sw.js` to use dynamic URL instead of hardcoded
5. Test: upload recording chunk, merge, download, signed URL generation

---

### Phase 6: Deployment Configuration (Week 5)

**Goal:** Production-ready deployment config.

The project already has deployment scaffolding — update it for self-hosted:

#### 6A. Docker Compose (update existing)

Update `docker-compose.prod.yml` to include:
- Self-hosted Supabase components (PostgREST, GoTrue, Realtime, Storage API)
- API server (new — Node.js service for ported edge functions)
- Kong API gateway
- PostgreSQL 15 (already present)
- Redis 7 (already present)

#### 6B. Kubernetes / Helm (update existing)

Update `helm/talentgeenie/` chart to include:
- API server deployment + service
- Supabase component deployments
- Updated secrets template
- Network policies for new services

#### 6C. CI/CD Pipeline

Create GitHub Actions (or GitLab CI) for:
- Frontend build + Docker image
- API server build + Docker image
- Database migration runner
- Automated testing

---

### Phase 7: Testing & Validation (Week 5–6)

**Goal:** Verify the exact replica behaves identically.

#### 7A. Schema Validation
- Diff self-hosted DB schema against Supabase Cloud export
- Verify all 121 tables, 85 functions, 330+ RLS policies, 62 triggers

#### 7B. Auth Flow Testing
- Sign up, login, logout
- Password reset
- Email verification
- Role assignment on signup
- Session refresh

#### 7C. API Parity Testing
- Every ported edge function endpoint returns identical responses
- AI evaluation produces same-format results
- Email delivery works via Resend
- Proctoring upload/download/merge cycle

#### 7D. Frontend Integration Testing
- All 102 routes load correctly
- DB queries return expected data
- Role-based access controls work
- Realtime notifications appear
- Proctoring recording and playback

#### 7E. Use Built-In Test Infrastructure
The platform has built-in test capabilities:
- `run-tests` edge function
- `run-flow-tests` edge function
- `run-comprehensive-flow-test` edge function
- `PerformanceBenchmark` page
- `TestingHub` page

---

### Phase 8: Data Migration (Week 6)

**Goal:** Migrate production data from Supabase Cloud to self-hosted.

**Tasks:**
1. Export data from Supabase Cloud using `pg_dump`
2. Export storage files from `proctoring-recordings` bucket
3. Import data into self-hosted PostgreSQL
4. Import storage files into self-hosted storage
5. Verify data integrity
6. DNS cutover plan

---

## 6. New Repository Structure

```
interviewtalentgeenie/
├── frontend/                    # React app (exact copy, Lovable refs removed)
│   ├── src/
│   │   ├── components/          # 129 components (UNCHANGED)
│   │   ├── contexts/            # 3 contexts (UNCHANGED)
│   │   ├── hooks/               # 25 hooks (UNCHANGED)
│   │   ├── integrations/
│   │   │   └── supabase/
│   │   │       ├── client.ts    # UNCHANGED (reads env vars)
│   │   │       └── types.ts     # UNCHANGED (7,304 lines)
│   │   ├── lib/                 # 37 utilities (2 files updated for hardcoded URLs)
│   │   ├── pages/               # 93 pages (1 file minor icon change)
│   │   └── types/
│   ├── public/                  # Static assets (1 service worker updated)
│   ├── package.json             # Updated (lovable-tagger removed)
│   ├── vite.config.ts           # Updated (componentTagger removed)
│   ├── tailwind.config.ts       # UNCHANGED
│   ├── index.html               # UNCHANGED
│   └── Dockerfile               # UNCHANGED (or minimal updates)
│
├── api/                         # NEW — Ported Edge Functions
│   ├── src/
│   │   ├── shared/              # Ported from supabase/functions/_shared/
│   │   │   ├── ai-caller.ts     # Lovable gateway → direct Gemini/OpenAI
│   │   │   ├── ai-retry.ts
│   │   │   ├── auth-utils.ts
│   │   │   ├── config.ts
│   │   │   ├── cors.ts
│   │   │   ├── email-helper.ts  # lovableproject.com → FRONTEND_URL
│   │   │   ├── email-sanitizer.ts
│   │   │   ├── logger.ts
│   │   │   ├── proctoring-config.ts
│   │   │   └── system-logger.ts
│   │   ├── routes/              # One file per edge function
│   │   │   ├── auth/            # 7 functions
│   │   │   ├── interview/       # 20 functions
│   │   │   ├── proctoring/      # 13 functions
│   │   │   ├── email/           # 5 functions
│   │   │   ├── ai/              # 22 functions
│   │   │   ├── learning/        # 6 functions
│   │   │   ├── admin/           # ~30 functions
│   │   │   └── ats/             # 2 functions
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT validation
│   │   │   └── rate-limit.ts
│   │   ├── jobs/                # Scheduled jobs (ported cron functions)
│   │   └── server.ts            # Express/Fastify entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── database/
│   ├── migrations/              # All SQL migrations
│   │   ├── fresh-deploy/        # Ordered bootstrap scripts
│   │   └── incremental/         # 72 incremental migrations
│   └── seed/                    # Test data scripts
│
├── infrastructure/
│   ├── docker-compose.yml       # Dev environment
│   ├── docker-compose.prod.yml  # Production (all services)
│   ├── kubernetes/              # Raw K8s manifests
│   └── helm/                    # Helm chart
│
├── .env.example
├── .gitignore
├── README.md
└── Makefile                     # Common commands
```

---

## 7. Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | `pgsodium` extension not available on non-Supabase PostgreSQL | 🔴 High — API key encryption breaks | Medium | Use `supabase/postgres` Docker image which includes it |
| 2 | `pg_net` extension unavailable | 🟡 Medium — HTTP calls from DB fail | Medium | Review if any triggers/functions use it; may need alternative |
| 3 | Edge function Deno APIs not portable to Node.js | 🟠 Medium — porting effort increases | Low | Most use standard fetch + JSON, few Deno-specific APIs |
| 4 | Lovable AI Gateway provides special model access | 🔴 High — AI features break | Low | Direct Gemini/OpenAI APIs provide same models |
| 5 | RLS policies behave differently without PostgREST | 🔴 High — security gap | Low | Self-hosted PostgREST applies RLS identically |
| 6 | Realtime channel configuration differences | 🟡 Medium — notifications fail | Low | Self-hosted Realtime server uses same protocol |
| 7 | Storage signed URL format differences | 🟠 Medium — uploads fail | Low | Self-hosted Storage API generates compatible URLs |
| 8 | Missing scheduled job infrastructure | 🟡 Medium — cleanup jobs don't run | Medium | Use node-cron, BullMQ, or pg_cron for scheduling |
| 9 | Data migration data loss | 🔴 High | Low | Use `pg_dump`/`pg_restore`, verify row counts |
| 10 | Service worker hardcoded URL breaks uploads | 🟠 Medium | High | Must update `public/proctoring-upload-sw.js` — flagged in Phase 3 |

---

## 8. Effort Estimates

### Option A: Self-Hosted Supabase (Recommended)

| Phase | Duration | Team | Notes |
|-------|----------|------|-------|
| Phase 0: Repo setup | 1 day | 1 dev | Remove Lovable artifacts |
| Phase 1: Infrastructure | 1–2 weeks | 1 DevOps | Self-hosted Supabase stack |
| Phase 2: Edge functions → API | 3–4 weeks | 2 backend devs | 105 functions + 10 shared |
| Phase 3: Frontend adjustments | 2–3 days | 1 frontend dev | ~6 files changed |
| Phase 4: Realtime/WebRTC | 3–5 days | 1 backend dev | Mostly configuration |
| Phase 5: Storage | 1–2 days | 1 DevOps | Bucket + policies |
| Phase 6: Deployment config | 3–5 days | 1 DevOps | Update Docker/K8s/Helm |
| Phase 7: Testing | 1–2 weeks | Full team | Comprehensive validation |
| Phase 8: Data migration | 2–3 days | 1 DevOps + 1 dev | Export/import/verify |
| **TOTAL** | **8–11 weeks** | **3–4 engineers** | |

### Timeline Summary

```
Week 1–2:  Infrastructure setup (Phase 0 + 1)
Week 2–5:  Edge function porting (Phase 2) — biggest workload
Week 3:    Frontend cleanup (Phase 3) — parallel
Week 4:    Realtime + Storage (Phase 4 + 5) — parallel
Week 5:    Deployment config (Phase 6)
Week 5–6:  Testing + Data migration (Phase 7 + 8)
```

### Key Metrics

| What | Count |
|------|-------|
| Total files to CREATE (new API server) | ~120 (105 routes + 10 shared + configs) |
| Total files to MODIFY (Lovable cleanup) | ~18 (6 frontend + 12 edge function URL fixes) |
| Total files UNCHANGED | ~350+ (all pages, components, hooks, styles, types) |
| Lines of Deno code to port | ~25,000+ |
| Frontend code changes | < 50 lines |

---

## Appendix A-0: Additional Gaps Found in Final Audit

### Gap 1: `index.html` has Lovable Branding (CRITICAL)
- OpenGraph image: `https://lovable.dev/opengraph-image-p98pqg.png`
- Twitter card: `@lovable_dev`
- Favicon: hosted on `storage.googleapis.com/gpt-engineer-file-uploads/` (Lovable's GCS bucket)
- **Action:** Replace OG images with self-hosted assets, replace favicon with local `public/favicon.ico` or self-hosted URL, remove `@lovable_dev` twitter reference

### Gap 2: Service Worker Has HARDCODED Supabase Anon Key (SECURITY)
- `public/proctoring-upload-sw.js` L11 contains the full Supabase anon JWT key as a hardcoded string
- **Action:** Service worker must receive the key dynamically via `postMessage` from the main app, not hardcoded

### Gap 3: No Unit/Integration Tests Exist
- `vitest.config.ts` exists but **zero test files** found in `src/`
- Only Playwright smoke tests in `public/deployment-package/test-suite/`
- **Action:** During migration, write tests for critical paths (auth, API calls, proctoring)

### Gap 4: Logo Asset is External
- `src/assets/talentgeenie-logo.jpg` exists locally (good)
- But `index.html` favicon points to external GCS URL
- **Action:** Use local asset or self-hosted CDN

### Gap 5: `.gitignore` Does NOT Exclude `.env`
- The `.env` file with real Supabase keys is NOT in `.gitignore`
- **Action:** Add `.env` to `.gitignore` in new repository immediately

### Gap 6: Deployment Package Contains Full CI/CD + Terraform
- `public/deployment-package/` has:
  - `.github/workflows/` — 3 GitHub Actions (plan, apply, rollback)
  - `infra/terraform/` — Full AWS Terraform (VPC, ALB, ECS, RDS, S3, DNS, monitoring, certs)
  - `monitoring/` — Prometheus config, Grafana dashboard, alert rules
  - `test-suite/` — Playwright smoke tests
  - `scripts/` — Migration import/export + Lovable access revocation
- **Action:** These should be moved to repo root (not `public/`) in new repository

### Gap 7: Custom ESLint Rule Must Be Carried Over
- `eslint-rules/no-duplicate-layout-wrapper.js` — Custom rule preventing nested layouts
- Referenced in `eslint.config.js`
- **Action:** Copy to new repository exactly as-is

---

## Appendix A: Complete Lovable Reference Removal Checklist

- [ ] `package.json` — Remove `lovable-tagger` devDependency
- [ ] `package.json` — Rename from `vite_react_shadcn_ts`
- [ ] `vite.config.ts` — Remove `componentTagger` import and usage
- [ ] `capacitor.config.ts` — Replace `app.lovable.*` appId
- [ ] `capacitor.config.ts` — Replace `lovableproject.com` server URL
- [ ] `supabase/config.toml` — Replace project ID
- [ ] `public/proctoring-upload-sw.js` — Replace hardcoded Supabase URL
- [ ] `src/lib/backgroundUploader.ts` — Remove hardcoded supabase.co fallback
- [ ] `src/pages/AIConfiguration.tsx` — Remove `lovable` provider icon
- [ ] `_shared/ai-caller.ts` — Replace Lovable AI Gateway with direct API
- [ ] `_shared/config.ts` — Remove `LOVABLE_API_KEY`, `lovable-ai` provider type
- [ ] `_shared/email-helper.ts` — Replace lovableproject.com fallbacks
- [ ] `approve-questions/index.ts` — Replace hardcoded lovableproject.com URL
- [ ] `send-email/index.ts` — Replace lovableproject.com fallback
- [ ] `send-password-setup/index.ts` — Replace lovableproject.com fallback
- [ ] `send-review-request/index.ts` — Replace lovableproject.com fallback
- [ ] `send-invitation-reminders/index.ts` — Replace lovable.app URL
- [ ] `add-questions/index.ts` — Replace direct Lovable AI Gateway call
- [ ] `admin-log-analysis/index.ts` — Replace direct Lovable AI Gateway calls (×2)
- [ ] `analyze-proctoring-video/index.ts` — Replace direct Lovable AI Gateway calls (×4)
- [ ] `chatbot-assist/index.ts` — Replace LOVABLE_API_KEY + gateway call
- [ ] `extract-skills/index.ts` — Replace direct Lovable AI Gateway call
- [ ] `generate-certification-questions/index.ts` — Replace LOVABLE_API_KEY + gateway call
- [ ] `generate-job-description/index.ts` — Replace direct Lovable AI Gateway call
- [ ] `generate-schema/index.ts` — Replace direct Lovable AI Gateway calls (×2)
- [ ] `reconstruct-interviews/index.ts` — Replace direct Lovable AI Gateway call
- [ ] `test-ai-connection/index.ts` — Replace `lovable` test case
- [ ] `index.html` L13 — Replace `og:image` from lovable.dev to self-hosted
- [ ] `index.html` L15 — Remove `twitter:site` `@lovable_dev`
- [ ] `index.html` L16 — Replace `twitter:image` from lovable.dev to self-hosted
- [ ] `index.html` L22 — Replace favicon from GCS/gpt-engineer-file-uploads to local/self-hosted
- [ ] `public/proctoring-upload-sw.js` L11 — Remove hardcoded Supabase anon key, receive dynamically
- [ ] `.gitignore` — Add `.env` to prevent committing secrets
- [ ] Move `public/deployment-package/` contents to repo root level

## Appendix B: Environment Variables for Self-Hosted

```env
# Frontend (build-time)
VITE_SUPABASE_URL=https://api.yourdomain.com
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-jwt-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# API Server (runtime)
SUPABASE_URL=https://api.yourdomain.com
SUPABASE_SERVICE_ROLE_KEY=your-service-role-jwt-key
SUPABASE_ANON_KEY=your-anon-jwt-key
JWT_SECRET=your-jwt-secret-min-32-chars
DATABASE_URL=postgresql://postgres:password@db:5432/postgres

# AI Providers (replace Lovable gateway)
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# Email
RESEND_API_KEY=your-resend-api-key

# Application
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
```
