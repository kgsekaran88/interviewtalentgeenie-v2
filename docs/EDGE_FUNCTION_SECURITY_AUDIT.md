# 🔒 Edge Function Security Audit — March 2026

**Total Edge Functions**: 108 (+ `_shared` utilities)  
**Properly Secured**: ~77 functions (✅)  
**Unauthenticated / Partially Secured**: ~22 functions (🚨/⚠️)  
**Intentionally Public**: ~7 functions (ℹ️)  
**Non-Existent (Removed from audit)**: 5 functions (❌)

> **⚠️ Re-Audit Correction (March 2026)**: Original audit claimed ~32 unauthenticated functions. Re-verification found:
> - **5 functions DON'T EXIST** in `supabase/functions/`: `send-invitation-email`, `update-invitation-status`, `manage-ai-models`, `learning-assessment-feedback`, `analyze-code`
> - **5 functions are actually SECURED** (have `authenticateRequest`/manual JWT+role): `regenerate-questions`, `evaluate-learning-assessment`, `manage-scheduled-jobs`, `enhance-content-with-ai`, `cleanup-all-except-admins`
> - **2 functions are PARTIAL** (session-token validation): `log-proctoring-violation`, `update-proctoring-session`

---

## 1. Gold Standard Auth Pattern

**Reference Implementation**: `supabase/functions/cleanup-proctoring-chunks/index.ts`

This function implements a 3-tier authentication pattern that ALL edge functions should follow:

```
Tier 1: Service role key in Authorization header
        → Grants access if the caller is another edge function or admin tool
        
Tier 2: JWT auth + platform_admin role check via user_roles table
        → Grants access to authenticated platform admins
        
Tier 3: x-scheduled-secret header vs SCHEDULED_CLEANUP_SECRET env var
        → Grants access to cron/scheduled invocations
        
Fallback: 401 Unauthorized
```

**Shared Utility**: `supabase/functions/_shared/auth-utils.ts`
- `authenticateUser()` — JWT-based auth with role checking
- Dual-client pattern: user auth client + service role client
- `platform_admin` always has full access ("god mode")
- Role checking uses service role client to bypass RLS

---

## 2. Complete Function Catalog

### Legend
- ✅ **Secured** — Has proper authentication (JWT + role check or equivalent)
- 🚨 **OPEN** — No authentication of any kind
- ⚠️ **Partial** — Has some auth but incomplete (e.g., token-based only, missing role check)
- ℹ️ **Intentionally Public** — Designed for unauthenticated access (with justification)

---

### 2.1 🚨 CRITICAL — Completely Open Functions (No Auth)

These functions accept any HTTP request without any authentication check. They use the service role key internally to bypass RLS.

| # | Function | Risk | Impact | Fix |
|---|----------|------|--------|-----|
| 1 | `generate-invoice` | 🔴 CRITICAL | Can generate invoices for any org | Add `authenticateUser()` + `billing_admin` or `org_admin` role |
| 2 | ~~`send-invitation-email`~~ | ❌ REMOVED | **Does not exist** in `supabase/functions/` | N/A |
| 3 | `send-invitation-reminders` | 🟠 HIGH | Triggers reminders to all pending invitations | Add scheduled-secret check (Tier 3) |
| 4 | `enforce-interview-deadlines` | 🟠 HIGH | Force-submits overdue attempts | Add scheduled-secret check (Tier 3) |
| 5 | `process-evaluation-queue` | 🟠 HIGH | Triggers AI evaluations (cost implications) | Add scheduled-secret check (Tier 3) |
| 6 | `cleanup-stuck-generations` | 🟡 MEDIUM | Cleanup function using service role | Add scheduled-secret check (Tier 3) |
| 7 | `log-proctoring-violation` | ⚠️ PARTIAL | Has session-token validation — not fully open | Add JWT auth layer on top of session-token |
| 8 | `update-proctoring-session` | ⚠️ PARTIAL | Has session-token validation — not fully open | Add JWT auth layer on top of session-token |
| 9 | ~~`regenerate-questions`~~ | ✅ SECURED | **Has `authenticateRequest`** — moved to §2.4 | N/A |
| 10 | `reassign-invitation-questions` | 🟠 HIGH | Can reassign all invitation questions | Add `authenticateUser()` + `hiring_manager` role |
| 11 | `reassign-questions` | 🟠 HIGH | Can reassign questions | Add `authenticateUser()` + `hiring_manager` role |
| 12 | ~~`update-invitation-status`~~ | ❌ REMOVED | **Does not exist** in `supabase/functions/` | N/A |
| 13 | ~~`manage-ai-models`~~ | ❌ REMOVED | **Does not exist** in `supabase/functions/` | N/A |
| 14 | `scan-ai-features` | 🟠 HIGH | Platform reconnaissance | Add `authenticateUser()` + `platform_admin` role |
| 15 | `scan-platform-features` | 🟠 HIGH | Platform reconnaissance | Add `authenticateUser()` + `platform_admin` role |
| 16 | `generate-training-plan` | 🟠 HIGH | AI generation (cost) | Add `authenticateUser()` + org role |
| 17 | `generate-learning-questions` | 🟠 HIGH | AI question generation (cost) | Add `authenticateUser()` + org role |
| 18 | `sync-ats-candidates` | 🟠 HIGH | Can sync candidate data | Add `authenticateUser()` + `org_admin` role |
| 19 | `ai-health-monitor` | 🟡 MEDIUM | Health monitoring using service role | Add scheduled-secret or admin-only |
| 20 | ~~`evaluate-learning-assessment`~~ | ✅ SECURED | **Has `authenticateRequest`** — moved to §2.4 | N/A |
| 21 | ~~`learning-assessment-feedback`~~ | ❌ REMOVED | **Does not exist** in `supabase/functions/` | N/A |
| 22 | ~~`manage-scheduled-jobs`~~ | ✅ SECURED | **Has manual JWT + `platform_admin` role check** — moved to §2.4 | N/A |
| 23 | ~~`analyze-code`~~ | ❌ REMOVED | **Does not exist** in `supabase/functions/` | N/A |
| 24 | `auto-evaluate-interview` | 🟡 MEDIUM | Internal trigger | Add service-role-only or scheduled-secret |
| 25 | ~~`cleanup-all-except-admins`~~ | ✅ SECURED | **Has manual auth check + disabled flag** — moved to §2.4 | N/A |
| 26 | `generate-comparative-report` | 🟡 MEDIUM | Report generation | Add `authenticateUser()` + org role |
| 27 | `generate-predictive-analytics` | 🟡 MEDIUM | Analytics generation | Add `authenticateUser()` + org role |
| 28 | ~~`enhance-content-with-ai`~~ | ✅ SECURED | **Has `authenticateRequest`** — moved to §2.4 | N/A |

### 2.2 ⚠️ Partially Secured Functions

| # | Function | Auth Present | Missing | Fix |
|---|----------|-------------|---------|-----|
| 29 | `chatbot-assist` | Intentionally public | Rate limiting | Add rate limiting per IP/session |
| 30 | `complete-password-setup` | Token-based validation | JWT auth | Acceptable — token-based flow |
| 31 | `send-password-setup` | None visible | Full auth | Add internal-only or admin-only check |
| 32 | `ats-webhook` | Webhook signature | JWT | Acceptable — webhook pattern |

### 2.3 ℹ️ Intentionally Public Functions

| # | Function | Justification |
|---|----------|---------------|
| 33 | `resolve-interview-share` | Resolves share links for anonymous candidates |
| 34 | `verify-email` | Email verification flow — token-based |
| 35 | `complete-user-signup` | Supabase Auth hook — called by infrastructure |
| 36 | `chatbot-assist` | Public-facing chatbot (needs rate limiting) |
| 37 | `complete-password-setup` | Password setup flow — token-based |

### 2.4 ✅ Properly Secured Functions (~70)

These functions use `authenticateUser()` from `_shared/auth-utils.ts` or equivalent JWT + role checks:

| # | Function | Auth Pattern |
|---|----------|-------------|
| 38 | `admin-log-analysis` | JWT + platform_admin |
| 39 | `admin-user-management` | JWT + platform_admin |
| 40 | `analyze-proctoring-video` | JWT + role check |
| 41 | `analyze-violations` | JWT + role check |
| 42 | `approve-partner-application` | JWT + platform_admin |
| 43 | `auto-close-sessions` | JWT + role check |
| 44 | `auto-fix-issue` | JWT + platform_admin |
| 45 | `bulk-generate-questions` | JWT + hiring_manager |
| 46 | `check-file-changes` | JWT + role check |
| 47 | `cleanup-proctoring-chunks` | 3-tier (gold standard) |
| 48 | `configure-ai-provider` | JWT + platform_admin |
| 49 | `create-interview` | JWT + hiring_manager |
| 50 | `create-organization` | JWT + authenticated |
| 51 | `detect-bias` | JWT + role check |
| 52 | `evaluate-certification` | JWT + role check |
| 53 | `evaluate-interview` | JWT + role check |
| 54 | `extract-skills` | JWT + role check |
| 55 | `generate-architecture-docs` | JWT + role check |
| 56 | `generate-certificate-pdf` | JWT + role check |
| 57 | `generate-custom-report` | JWT + role check |
| 58 | `generate-documentation` | JWT + role check |
| 59 | `generate-questions` | JWT + dual-client |
| 60 | `generate-schema` | JWT + role check |
| 61 | `merge-proctoring-chunks` | JWT + role check |
| 62 | `process-resume` | JWT + role check |
| 63 | `restore-deleted` | JWT + platform_admin |
| 64 | `run-comprehensive-flow-test` | JWT + platform_admin |
| 65 | `run-flow-tests` | JWT + platform_admin |
| 66 | `run-tests` | JWT + platform_admin |
| 67 | `scheduled-data-cleanup` | Scheduled-secret |
| 68 | `send-notification` | JWT + role check |
| 69 | `send-review-request` | JWT + role check |
| 70 | `submit-for-review` | JWT + role check |
| 71 | `test-configuration` | JWT + platform_admin |
| 72 | `upload-proctoring-recording` | JWT + session auth |
| 73 | `upload-proctoring-screenshot` | JWT + session auth |
| — | *(~35 more functions with proper auth)* | Various JWT + role patterns |

---

## 3. Fix Patterns by Category

### 3.1 Cron/Scheduled Functions (4 functions)

**Functions**: `cleanup-stuck-generations`, `enforce-interview-deadlines`, `send-invitation-reminders`, `process-evaluation-queue`

**Fix Pattern** (from `cleanup-proctoring-chunks/index.ts`):

```typescript
// Add at the top of the handler, after CORS check:
const authHeader = req.headers.get('Authorization');
const scheduledSecret = req.headers.get('x-scheduled-secret');

// Tier 1: Service role key
if (authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
  // proceed
}
// Tier 2: JWT + platform_admin
else if (authHeader?.startsWith('Bearer ')) {
  const { user, error } = await authenticateUser(req);
  if (error || !user) return new Response('Unauthorized', { status: 401 });
  // Check platform_admin role...
}
// Tier 3: Scheduled secret
else if (scheduledSecret === Deno.env.get('SCHEDULED_CLEANUP_SECRET')) {
  // proceed
}
else {
  return new Response('Unauthorized', { status: 401 });
}
```

### 3.2 Admin-Only Functions (8 functions)

**Functions**: ~~`manage-ai-models`~~ (doesn't exist), `scan-ai-features`, `scan-platform-features`, ~~`manage-scheduled-jobs`~~ (already secured), ~~`cleanup-all-except-admins`~~ (already secured), `ai-health-monitor`, etc.

**Fix Pattern**:
```typescript
import { authenticateUser } from '../_shared/auth-utils.ts';

// At handler start:
const { user, role, error } = await authenticateUser(req);
if (error || !user) return new Response('Unauthorized', { status: 401 });
if (role !== 'platform_admin') return new Response('Forbidden', { status: 403 });
```

### 3.3 Org-Scoped Functions (10 functions)

**Functions**: `generate-invoice`, ~~`regenerate-questions`~~ (already secured), `reassign-invitation-questions`, ~~`update-invitation-status`~~ (doesn't exist), `generate-training-plan`, etc.

**Fix Pattern**:
```typescript
const { user, role, error } = await authenticateUser(req);
if (error || !user) return new Response('Unauthorized', { status: 401 });
// Verify user belongs to the target organization:
const { data: membership } = await serviceClient
  .from('organization_members')
  .select('role')
  .eq('user_id', user.id)
  .eq('organization_id', targetOrgId)
  .single();
if (!membership) return new Response('Forbidden', { status: 403 });
```

### 3.4 Proctoring/Candidate Functions (4 functions)

**Functions**: `log-proctoring-violation` (partial), `update-proctoring-session` (partial), `auto-evaluate-interview`, ~~`evaluate-learning-assessment`~~ (already secured)

**Fix Pattern**: Session-token-based auth (candidate doesn't have a JWT, but has a session token):
```typescript
const sessionToken = req.headers.get('x-session-token');
const attemptId = body.attempt_id;
// Validate session token against the attempt:
const { data: attempt } = await serviceClient
  .from('interview_attempts')
  .select('id')
  .eq('id', attemptId)
  .eq('session_token', sessionToken)
  .single();
if (!attempt) return new Response('Unauthorized', { status: 401 });
```

---

## 4. Environment Variables Required

These environment variables must be set in production for edge function security:

| Variable | Purpose | Current Status |
|----------|---------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role operations | ✅ Set (Supabase auto-provides) |
| `SUPABASE_URL` | Supabase project URL | ✅ Set (Supabase auto-provides) |
| `FRONTEND_URL` | CORS origin restriction | ⚠️ Must verify in production |
| `SCHEDULED_CLEANUP_SECRET` | Cron function authentication | ⚠️ Must be strong random string |
| `FUNCTIONS_VERIFY_JWT` | Global JWT verification | ⚠️ Must be `true` in production |
| `OPENAI_API_KEY` | AI function operations | ✅ Set per function |

---

## 5. Priority Actions

| Priority | Action | Functions Affected | Effort |
|----------|--------|-------------------|--------|
| 🔴 P0 | Add auth to `generate-invoice` | 1 | 30 min |
| ~~🔴 P0~~ | ~~Add auth to `send-invitation-email`~~ | ~~1~~ | **REMOVED — function doesn't exist** |
| 🟠 P1 | Add scheduled-secret to 4 cron functions | 4 | 2 hours |
| 🟠 P1 | Add admin auth to ~4 admin functions | ~4 | 1.5 hours |
| 🟠 P1 | Add org-scoped auth to ~7 functions | ~7 | 3 hours |
| 🟡 P2 | Strengthen session-token auth on 2 partial + 1 open proctoring functions | 3 | 1.5 hours |
| 🟡 P2 | Add rate limiting to `chatbot-assist` | 1 | 1 hour |
| 🟡 P2 | Verify `FRONTEND_URL` and `FUNCTIONS_VERIFY_JWT` in prod | — | 30 min |

*Total estimated effort: 1.5–2 days for full edge function security remediation.*
