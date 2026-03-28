# 🔐 Comprehensive Security Audit Report — March 2026

**Application**: InterviewTalentGeenie v2  
**Audit Date**: 3 March 2026  
**Scope**: Full-stack — Frontend, Backend (Supabase Edge Functions), Database (103 tables), RLS Policies (217), Secrets, Dependencies, Auth/RBAC  
**Status**: ⚠️ **MULTIPLE ISSUES IDENTIFIED — ACTION REQUIRED**

---

## 📊 Executive Summary

| Category              | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low |
|-----------------------|-------------|---------|-----------|--------|
| RLS / Database        | 8           | 42      | 58        | 68     |
| Edge Functions        | 1           | 7       | 5         | 3      |
| Frontend Security     | 1           | 2       | 3         | 2      |
| Secrets / Config      | 0           | 1       | 2         | 1      |
| Dependencies          | 0           | 0       | 1         | 2      |
| Auth / RBAC           | 0           | 0       | 2         | 1      |
| **TOTALS**            | **10**      | **52**  | **71**    | **77** |

**Overall Risk Rating**: 🔴 **HIGH** — The application has strong architectural foundations (Supabase Auth, Zod validation, error boundaries, nginx headers) but critical RLS misconfigurations and unauthenticated edge functions create exploitable attack surface.

---

## 1. 🚨 RLS Policy Issues (CRITICAL)

### 1.1 Eight `{public}` USING(true) Policies — Anonymous Full Access

**Severity**: 🔴 CRITICAL  
**Impact**: Any unauthenticated user can read, write, and delete data in these tables via the Supabase REST API.

| Table | Policy Name | Operations |
|-------|-------------|------------|
| `ai_coach_sessions` | "Service role can manage coach sessions" | ALL |
| `analytics_snapshots` | "Service role can manage analytics" | ALL |
| `ats_candidates` | "Service role can manage ATS candidates" | ALL |
| `candidate_performance_index` | "Service role can manage CPI" | ALL |
| `certificates` | "Service role can manage certificates" | ALL |
| `certification_attempts` | "Service role can manage attempts" | ALL |
| `consent_records` | "Service role can manage consent records" | ALL |
| `user_badges` | "Service role can manage user badges" | ALL |

**Root Cause**: Policies intended for `service_role` were created targeting `{public}` (all users including anonymous). Since `USING(true)`, the policy always permits access.

**Fix**: Change target role from `{public}` to `{service_role}` for all 8 policies. See `docs/REMEDIATION_ROADMAP.md` §P0.

### 1.2 Twelve Open INSERT Policies on `{public}`

**Severity**: 🔴 CRITICAL  
**Impact**: Anonymous users can insert arbitrary data.

Affected tables: `interview_attempts`, `proctoring_sessions`, `proctoring_violations`, `notifications`, `security_events`, `usage_tracking`, `assessments` (×2), `ats_sync_logs`, `bias_detection_results`, `ai_coach_sessions`, `data_deletion_requests`.

**Fix**: Restrict to `{authenticated}` with ownership checks (`auth.uid()` matching a user column).

### 1.3 Forty-Two Tables Locked Out (RLS ON + Zero Policies)

**Severity**: 🟠 HIGH  
**Impact**: No user (including the application) can access these tables through the Supabase REST API. Frontend queries silently return empty results.

Full list of 42 tables documented in `docs/DATABASE_TABLE_AUDIT.md` §3.

**Fix**: Add appropriate RLS policies as part of the canonical RLS rewrite. See `docs/REMEDIATION_ROADMAP.md` §P2.

### 1.4 Fifty-Eight Duplicate/Redundant Policies

**Severity**: 🟡 MEDIUM  
**Impact**: Maintenance complexity, confusion, potential policy conflicts.

Worst offenders:
- `interview_attempts`: **13 policies** (should be ~5)
- `proctoring_sessions`: **12 policies** (should be ~4)
- `interviews`: **8 policies** (should be ~4)
- `organizations`: **7 policies** (should be ~3)

### 1.5 Sixty-Eight Policies Target `{public}` but Use `uid()`

**Severity**: 🟡 MEDIUM  
**Impact**: Policies functionally correct (anonymous users get `uid()` = NULL, so no access) but semantically wrong. Should target `{authenticated}` for clarity and to avoid accidental exposure if Supabase changes anonymous handling.

### 1.6 Eighteen Recursion-Risk Raw Subqueries

**Severity**: 🟡 MEDIUM  
**Impact**: 18 policies across 14 tables query `organization_members` directly in `USING` clauses instead of calling SECURITY DEFINER helper functions. This risks infinite recursion if `organization_members` itself has policies that reference these tables.

### 1.7 Four Inconsistent Admin-Check Patterns

**Severity**: 🟢 LOW  
**Impact**: 217 policies use 4 different patterns to check platform_admin role. Inconsistency makes auditing difficult and increases risk of logic errors.

Patterns found:
1. `has_role(auth.uid(), 'platform_admin')` — legacy single-role check
2. `has_any_role(auth.uid(), ARRAY['platform_admin'])` — array-based check
3. `has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'])` — hierarchy-aware (preferred)
4. Raw subquery on `user_roles` table — inline check

**Recommendation**: Standardize all to `has_any_role_with_hierarchy()`.

---

## 2. 🚨 Edge Function Security

### 2.1 ~16 Unauthenticated Edge Functions (Corrected from 32)

**Severity**: 🔴 CRITICAL (1) / 🟠 HIGH (7) / 🟡 MEDIUM (5) / 🟢 LOW (3)

> **⚠️ Re-Audit Correction (March 2026)**: Original audit claimed 32 unauthenticated functions. Re-verification found:
> - **5 functions DON'T EXIST**: `send-invitation-email`, `update-invitation-status`, `manage-ai-models`, `learning-assessment-feedback`, `analyze-code`
> - **5 functions are SECURED** (have `authenticateRequest` or manual JWT+role): `regenerate-questions`, `evaluate-learning-assessment`, `manage-scheduled-jobs`, `enhance-content-with-ai`, `cleanup-all-except-admins`
> - **2 functions are PARTIAL** (session-token validation, not fully open): `log-proctoring-violation`, `update-proctoring-session`
> - **Actual truly OPEN: ~16 functions**

Full catalog in `docs/EDGE_FUNCTION_SECURITY_AUDIT.md`.

**Critical highlights**:

| Function | Risk | Issue |
|----------|------|-------|
| `generate-invoice` | 🔴 CRITICAL | No auth — can generate invoices for any organization using service role |
| ~~`send-invitation-email`~~ | ~~🟠 HIGH~~ | **REMOVED — function does not exist** |
| `send-invitation-reminders` | 🟠 HIGH | No auth — triggers reminder emails to all pending invitations |
| `log-proctoring-violation` | � PARTIAL | Has session-token validation (not fully open, but missing JWT auth) |
| `update-proctoring-session` | 🟡 PARTIAL | Has session-token validation (not fully open, but missing JWT auth) |
| ~~`regenerate-questions`~~ | ~~🟠 HIGH~~ | **RECLASSIFIED — has `authenticateRequest` (SECURED)** |
| `reassign-invitation-questions` | 🟠 HIGH | No auth — can reassign all invitation questions |
| `enforce-interview-deadlines` | 🟠 HIGH | No auth — force-submits overdue attempts |
| `process-evaluation-queue` | 🟠 HIGH | No auth — triggers AI evaluations (cost implications) |
| ~~`manage-ai-models`~~ | ~~🟠 HIGH~~ | **REMOVED — function does not exist** |
| `sync-ats-candidates` | 🟠 HIGH | No auth — uses service role to sync candidates |

### 2.2 Four Completely Open Cron Functions

These functions have zero authentication of any kind:

1. `cleanup-stuck-generations`
2. `enforce-interview-deadlines`
3. `send-invitation-reminders`
4. `process-evaluation-queue`

**Gold standard pattern** (from `cleanup-proctoring-chunks/index.ts`):
```
1. Service role key in Authorization header
2. JWT auth + platform_admin role check
3. x-scheduled-secret header vs SCHEDULED_CLEANUP_SECRET env var
Falls through to 401 Unauthorized if none match.
```

### 2.3 Previously Fixed Functions (Verified ✅)

- `detect-bias` — was missing authentication; now fixed
- `evaluate-interview` — was missing authentication; now fixed
- `evaluate-certification` — was missing authentication; now fixed
- `generate-schema` — fixed with role-based auth
- `extract-skills` — fixed with role-based auth
- `generate-questions` — fixed with dual-client pattern

---

## 3. 🚨 Frontend Security

### 3.1 XSS Vulnerabilities (7 vectors)

| # | File | Line | Vector | Severity |
|---|------|------|--------|----------|
| 1 | `src/pages/CertificationsPage.tsx` | L82 | `tempDiv.innerHTML = data.html` — server response rendered directly | 🔴 CRITICAL |
| 2 | `src/components/architecture/MermaidDiagram.tsx` | L336 | `dangerouslySetInnerHTML={{ __html: svg }}` — Mermaid SVG from user data | 🟠 HIGH |
| 3 | `src/components/ui/chart.tsx` | — | `dangerouslySetInnerHTML` — chart tooltip CSS injection | 🟠 HIGH |
| 4 | `src/components/admin/email/EmailTemplateEditor.tsx` | L267 | `innerHTML` — **READ from contenteditable iframe** (lower risk) | 🟢 LOW |
| 5 | `src/components/admin/email/EmailTemplateEditor.tsx` | L283 | `innerHTML` — **READ from contenteditable iframe** (lower risk) | 🟢 LOW |
| 6 | `src/components/admin/email/EmailTemplateEditor.tsx` | L315 | `innerHTML` — **READ from contenteditable iframe** (lower risk) | 🟢 LOW |
| 7 | `src/components/admin/email/EmailTemplateEditor.tsx` | L326 | `innerHTML` — **READ from contenteditable iframe** (lower risk) | 🟢 LOW |

**Root Cause**: No HTML sanitization library installed. `DOMPurify` is not in `package.json`.

**Fix**: Install `DOMPurify` + `@types/dompurify`, sanitize all 7 vectors.

### 3.2 No HTML Sanitization Library

**Severity**: 🟡 MEDIUM  
The project has **no HTML sanitization library** (`DOMPurify`, `sanitize-html`, etc.) in `package.json`. Only basic filename sanitization exists in `src/utils/sanitization.ts` and email validation in `src/utils/emailValidator.ts`.

### 3.3 Anon Key as Bearer Token

**Severity**: 🟡 MEDIUM  
**File**: `src/pages/TakeInterviewPage.tsx`  
The anon key is used as an Authorization bearer token for the `terminate_attempt_with_session` RPC call. This means the request runs as an unauthenticated user rather than with the candidate's session.

---

## 4. ✅ Frontend Security — Positive Findings

### 4.1 Strong Input Validation
**File**: `src/lib/validationSchemas.ts`  
Comprehensive Zod-based validation:
- Email: max length, format validation
- Password: min 8 chars, uppercase, lowercase, number required
- Name: only letters, spaces, hyphens, apostrophes (prevents injection)
- 12 separate schemas covering all auth and profile operations

### 4.2 Error Message Sanitization
**File**: `src/lib/error-handler.ts`  
Properly masks PostgreSQL error codes, RLS policy details, and technical error structures from user-facing messages.

### 4.3 Protected Routes
**File**: `src/components/ProtectedRoute.tsx`  
- Authentication requirement (redirects to `/auth` if not logged in)
- Role-based access control via `allowedRoles` prop
- Email verification enforcement
- Public route bypass for verification pages

### 4.4 Error Boundaries
**File**: `src/components/ErrorBoundary.tsx`  
Proper React error boundary class wrapping the entire app AND section-specific boundaries for dashboard routes. Unit tested.

---

## 5. Secrets & Configuration

### 5.1 ✅ No Hardcoded Secrets in Source Code
No hardcoded API keys, JWT tokens, or service role keys found in `src/`. All sensitive values use `import.meta.env.VITE_*` environment variables. `.gitignore` properly excludes `.env`, `.env.local`, `.env.production`.

### 5.2 ✅ Client Uses Only Publishable Key
`src/integrations/supabase/client.ts` uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) — the service role key is never exposed to the frontend.

### 5.3 ⚠️ CORS Wildcard Fallback in Edge Functions
**Severity**: 🟡 MEDIUM  
Multiple edge functions fall back to `*` when `FRONTEND_URL` is not set:
```typescript
const allowedOrigin = Deno.env.get('FRONTEND_URL') || '*';
```
If `FRONTEND_URL` is not configured in production, all origins are allowed.

### 5.4 ⚠️ Dev Secrets in Example Files
**Severity**: 🟡 MEDIUM  
`supabase/.env.example` contains:
- `FUNCTIONS_VERIFY_JWT=false` — disabling JWT verification for edge functions
- `SCHEDULED_CLEANUP_SECRET=local-dev-secret` — weak placeholder

Copying these directly to production would create security issues.

### 5.5 No Security ESLint Plugins
**Severity**: 🟢 LOW  
**File**: `eslint.config.js`  
No `eslint-plugin-security` or `eslint-plugin-no-unsanitized` installed. The config also disables `@typescript-eslint/no-unused-vars` which could mask dead code.

---

## 6. Security Headers & Infrastructure

### 6.1 ✅ Strong Nginx Security Headers
**File**: `nginx.conf` (lines 42–48)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Content Security Policy with restrictive defaults

### 6.2 ⚠️ CSP Allows `'unsafe-inline'` for Styles
**Severity**: 🟢 LOW  
The CSP includes `style-src 'self' 'unsafe-inline'` — common for React apps but weakens XSS protection for style injection attacks. Consider CSP nonces in the future.

### 6.3 ⚠️ Static Asset Cache Block May Drop Security Headers
**Severity**: 🟢 LOW  
Nginx's static asset cache block adds `Cache-Control` but nginx `add_header` in nested blocks replaces parent headers — security headers may not apply to static assets.

### 6.4 ✅ Hidden File Protection
`.` files blocked via `location ~ /\.` deny rule.

---

## 7. Authentication & Authorization

### 7.1 Auth Architecture (✅ Solid)
**File**: `src/contexts/AuthContext.tsx`
- Uses Supabase Auth with `onAuthStateChange` listener
- Session persistence in localStorage
- Auto-refresh tokens enabled
- Deferred role fetching to avoid auth deadlocks

### 7.2 Role System
6 primary roles defined in `app_role` enum:

| Role | Access Level |
|------|-------------|
| `platform_admin` | Full system access (god mode) |
| `org_admin` | Organization management |
| `hiring_manager` | Interview/assessment management |
| `ta_creator` | Technical interview creation |
| `billing_admin` | Billing only |
| `candidate` / `viewer` | Minimal access |

### 7.3 ⚠️ Client-Side Permissions Not Reconciled with Server-Side RLS
**Severity**: 🟡 MEDIUM  
**File**: `src/lib/permissions.ts`  
35 granular permissions defined client-side with role-to-permission mappings. If these diverge from RLS policy logic, authorization mismatches occur (UI shows access but DB denies, or vice versa).

### 7.4 ⚠️ Legacy Roles in Schema
**Severity**: 🟡 MEDIUM  
The `app_role` enum includes both old roles (`admin`, `hr`, `interviewer`, `contributor`) and new roles (`platform_admin`, `org_admin`, etc.). The TypeScript `AppRole` type only includes the new roles — potential mismatch if any user still has legacy roles.

### 7.5 SECURITY DEFINER Functions (✅ Properly Secured)
All 8 helper functions (`has_role`, `has_any_role`, `has_any_role_with_hierarchy`, `user_is_org_member`, `user_is_org_admin`, `can_access_org_data`, `generate_slug`, etc.) use `SECURITY DEFINER` with `SET search_path TO 'public'` — correct, prevents search path injection.

### 7.6 Session Token Security (✅ Strong)
- Cryptographically secure tokens: 32 bytes (256 bits entropy), base64 encoded
- Token validation via SECURITY DEFINER functions
- PII protection: candidate email/name immutable after creation
- One attempt per email per interview

---

## 8. Package Dependencies

### 8.1 Key Dependencies
| Category | Package | Version | Notes |
|----------|---------|---------|-------|
| Framework | React | 18.3.1 | Current |
| Build | Vite | 5.4.19 | Current |
| TypeScript | | 5.8.3 | Current |
| Supabase | @supabase/supabase-js | ^2.74.0 | Current |
| Validation | zod | ^4.1.12 | ✅ Strong |
| Error Tracking | @sentry/react | ^10.39.0 | ✅ Good |
| Rich Text | react-markdown | ^10.1.0 | ⚠️ Check XSS with custom components |
| Diagrams | mermaid | ^11.12.1 | ⚠️ SVG injection risk (see §3.1) |

### 8.2 ⚠️ Missing Security Libraries
- **No `DOMPurify`** — needed for HTML sanitization
- **No `eslint-plugin-security`** — static analysis for security anti-patterns
- **No `eslint-plugin-no-unsanitized`** — catches unsafe DOM manipulation

---

## 9. Reconciliation with Previous Security Reports

| Report | Date | Key Claims | Current Status |
|--------|------|-----------|----------------|
| `SECURITY_AUDIT_COMPLETE.md` | 2025-11-14 | "100% secure, production ready" | ⚠️ Contradicted by RLS audit |
| `SECURITY_COMPREHENSIVE.md` | 2025-11-14 | 3 critical edge function vulns | ✅ All 3 fixed |
| `RLS_AUDIT_REPORT.md` | 2025-02-18 | 8 critical RLS, 42 lockouts | 🔴 **NOT FIXED** |
| `SECURITY.md` | 2025-10-08 | Core tables well-protected | ✅ Core interview flow solid |
| `SECURITY_FIXES.md` | 2025 | Answer leaks & session token fixed | ✅ Verified fixed |

**⚠️ KEY FINDING**: The `RLS_AUDIT_REPORT.md` identifies 8 critical `{public}` USING(true) policies and 42 locked-out tables. The `SECURITY_AUDIT_COMPLETE.md` (written later) claims "100% secure" but only audited edge functions, not RLS policies. **The RLS issues remain unfixed.**

---

## 10. Summary

### What's Right ✅
1. **Auth architecture** — Supabase Auth with proper session management, `onAuthStateChange`, auto-refresh
2. **Input validation** — Comprehensive Zod schemas for all auth/profile operations
3. **Error handling** — Error boundaries, sanitized error messages, Sentry integration
4. **Nginx security headers** — HSTS, X-Frame-Options, CSP, Permissions-Policy
5. **SECURITY DEFINER functions** — Properly secured with `SET search_path`
6. **Session tokens** — 256-bit entropy, cryptographically secure
7. **No hardcoded secrets** — All environment variables, proper `.gitignore`
8. **Edge function auth pattern** — `_shared/auth-utils.ts` dual-client pattern is solid
9. **Protected routes** — Role-based, email verification enforced
10. **Clean codebase** — Zero TODO/FIXME markers, 1 eslint-disable, proper logger abstraction

### What Needs to Change 🔴
1. **8 RLS policies grant anonymous full access** — Change target to `{service_role}`
2. **12 RLS policies allow anonymous INSERTs** — Restrict to `{authenticated}`
3. **42 tables completely locked out** — Add policies or remove tables
4. **~16 edge functions lack authentication** — Add auth checks (5 originally listed don't exist, 5 already secured, 2 partial)
5. **7 XSS vectors with no sanitization** — Install DOMPurify
6. **732 `any` type usages across 301 files** — Replace with proper TypeScript types
7. **`FRONTEND_URL` not enforced** — Set in production to prevent CORS wildcard

### What Can Be Improved 🟡
1. **Standardize 217 RLS policies** to ~140 using canonical rewrite
2. **Eliminate 58 duplicate policies**
3. **Change 68 `{public}` policies to `{authenticated}`**
4. **Replace 18 raw subqueries** with SECURITY DEFINER function calls
5. **Decompose 12 monolith components** (>300 lines each)
6. **Add `React.memo`** to frequently re-rendered components
7. **Add security ESLint plugins** for static analysis
8. **Reconcile client-side permissions** with server-side RLS
9. **Replace CSP `'unsafe-inline'`** with nonces

### What Should Be Removed 🗑️
1. **1 truly dead database table** — `documentation` (superseded by `platform_documentation`)
2. ~~**3 effectively dead tables**~~ — **CORRECTED: All reclassified as KEEP** (AI monitoring + collaboration planned features with full schema)
3. **58 duplicate RLS policies** — Consolidate during canonical rewrite
4. **Legacy roles** in `app_role` enum — Remove after migration verification
5. **Dev-only settings** from example env files — Separate dev/prod examples

---

*Full details: See companion documents `DATABASE_TABLE_AUDIT.md`, `EDGE_FUNCTION_SECURITY_AUDIT.md`, `CODE_QUALITY_AUDIT.md`, and `REMEDIATION_ROADMAP.md`.*
