# 🛤️ Remediation Roadmap — March 2026

**Based on**: Security Audit 2026, Database Table Audit, Edge Function Audit, Code Quality Audit  
**Total Issues**: 10 Critical, 60 High, 76 Medium, 80 Low  
**Estimated Total Effort**: 4–6 weeks (phased)

---

## Phase Overview

| Phase | Timeline | Focus | Issues Resolved |
|-------|----------|-------|-----------------|
| **P0 — Critical** | Days 1–3 | Fix exploitable vulnerabilities | 10 Critical |
| **P1 — High** | Week 1–2 | Secure edge functions, add missing RLS | 60 High |
| **P2 — Medium** | Week 3–4 | RLS canonical rewrite, type safety, XSS | 76 Medium |
| **P3 — Low** | Ongoing | Performance, code quality, prevention | 80 Low |

---

## P0 — CRITICAL (Days 1–3)

> **Goal**: Eliminate all exploitable vulnerabilities that allow anonymous access to sensitive data.

### P0.1 — Fix 8 `{public}` USING(true) RLS Policies

**Effort**: 1 hour  
**Risk if delayed**: Anonymous users have full read/write/delete access to 8 tables

Create a single Supabase migration:

```sql
-- Migration: fix_critical_rls_public_policies

-- 1. ai_coach_sessions
DROP POLICY IF EXISTS "Service role can manage coach sessions" ON ai_coach_sessions;
CREATE POLICY "Service role can manage coach sessions" ON ai_coach_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. analytics_snapshots  
DROP POLICY IF EXISTS "Service role can manage analytics" ON analytics_snapshots;
CREATE POLICY "Service role can manage analytics" ON analytics_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. ats_candidates
DROP POLICY IF EXISTS "Service role can manage ATS candidates" ON ats_candidates;
CREATE POLICY "Service role can manage ATS candidates" ON ats_candidates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. candidate_performance_index
DROP POLICY IF EXISTS "Service role can manage CPI" ON candidate_performance_index;
CREATE POLICY "Service role can manage CPI" ON candidate_performance_index
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. certificates
DROP POLICY IF EXISTS "Service role can manage certificates" ON certificates;
CREATE POLICY "Service role can manage certificates" ON certificates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. certification_attempts
DROP POLICY IF EXISTS "Service role can manage attempts" ON certification_attempts;
CREATE POLICY "Service role can manage attempts" ON certification_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. consent_records
DROP POLICY IF EXISTS "Service role can manage consent records" ON consent_records;
CREATE POLICY "Service role can manage consent records" ON consent_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. user_badges
DROP POLICY IF EXISTS "Service role can manage user badges" ON user_badges;
CREATE POLICY "Service role can manage user badges" ON user_badges
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### P0.2 — Fix 12 Open INSERT Policies on `{public}`

**Effort**: 2 hours  
**Risk if delayed**: Anonymous users can insert arbitrary data into 12 tables

For each of the 12 tables, change the policy target from `{public}` to `{authenticated}` and add ownership checks where appropriate. Example pattern:

```sql
-- Before (vulnerable):
CREATE POLICY "Anyone can insert" ON interview_attempts
  FOR INSERT TO public WITH CHECK (true);

-- After (secure):
CREATE POLICY "Authenticated users can insert own attempts" ON interview_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = candidate_id);
```

Tables requiring this fix:
1. `interview_attempts` — restrict to session-token-based insert
2. `proctoring_sessions` — restrict to authenticated + attempt owner
3. `proctoring_violations` — restrict to service_role only
4. `notifications` — restrict to authenticated + self-insert
5. `security_events` — restrict to service_role only
6. `usage_tracking` — restrict to authenticated + self-tracking
7. `assessments` (×2 policies) — restrict to authenticated + org member
8. `ats_sync_logs` — restrict to service_role only
9. `bias_detection_results` — restrict to service_role only
10. `ai_coach_sessions` — restrict to authenticated + self
11. `data_deletion_requests` — restrict to authenticated + self

### P0.3 — Install DOMPurify + Fix 3 Critical XSS Vectors

**Effort**: 2 hours  
**Risk if delayed**: XSS attacks via server response injection

```bash
npm install dompurify @types/dompurify
```

Fix the 3 highest-severity vectors:

1. **`src/pages/CertificationsPage.tsx` line 82**:
```typescript
import DOMPurify from 'dompurify';
// Before: tempDiv.innerHTML = data.html;
// After:
tempDiv.innerHTML = DOMPurify.sanitize(data.html);
```

2. **`src/components/architecture/MermaidDiagram.tsx` line 336**:
```typescript
import DOMPurify from 'dompurify';
// Before: dangerouslySetInnerHTML={{ __html: svg }}
// After:
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } }) }}
```

3. **`src/components/ui/chart.tsx`**:
```typescript
import DOMPurify from 'dompurify';
// Sanitize tooltip content before rendering
```

### P0.4 — Add Auth to `generate-invoice` Edge Function

**Effort**: 30 minutes  
**Risk if delayed**: Anyone can generate invoices for any organization

```typescript
// Add to generate-invoice/index.ts:
import { authenticateUser } from '../_shared/auth-utils.ts';

const { user, role, error } = await authenticateUser(req);
if (error || !user) return new Response('Unauthorized', { status: 401 });
if (!['platform_admin', 'org_admin', 'billing_admin'].includes(role)) {
  return new Response('Forbidden', { status: 403 });
}
```

### ~~P0.5 — Add Auth to `send-invitation-email` Edge Function~~

> **❌ REMOVED**: Re-audit confirmed `send-invitation-email` does not exist in `supabase/functions/`. No action needed.

---

## P1 — HIGH (Week 1–2)

> **Goal**: Secure all edge functions and establish production environment safety.

### P1.1 — Add Scheduled-Secret Auth to 4 Cron Functions

**Effort**: 2 hours  
**Functions**: `cleanup-stuck-generations`, `enforce-interview-deadlines`, `send-invitation-reminders`, `process-evaluation-queue`

Apply the 3-tier auth pattern from `cleanup-proctoring-chunks/index.ts`:

```typescript
const authHeader = req.headers.get('Authorization');
const scheduledSecret = req.headers.get('x-scheduled-secret');

if (authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
  // Tier 1: Service role key — proceed
} else if (authHeader?.startsWith('Bearer ')) {
  // Tier 2: JWT + platform_admin role check
  const { user, error } = await authenticateUser(req);
  if (error || !user) return new Response('Unauthorized', { status: 401 });
  const { data: roles } = await serviceClient.from('user_roles').select('role')
    .eq('user_id', user.id).eq('role', 'platform_admin').single();
  if (!roles) return new Response('Forbidden', { status: 403 });
} else if (scheduledSecret === Deno.env.get('SCHEDULED_CLEANUP_SECRET')) {
  // Tier 3: Scheduled secret — proceed
} else {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
```

### P1.2 — Add Admin Auth to 8 Admin Functions

**Effort**: 1.5 hours  
**Functions**: ~~`manage-ai-models`~~ (❌ doesn't exist), `scan-ai-features`, `scan-platform-features`, ~~`manage-scheduled-jobs`~~ (✅ already secured), ~~`cleanup-all-except-admins`~~ (✅ already secured), `ai-health-monitor`, `auto-fix-issue` (if not already secured), `admin-log-analysis` (verify)

> **Corrected**: Only ~4 functions actually need admin auth added. `manage-ai-models` doesn't exist, `manage-scheduled-jobs` and `cleanup-all-except-admins` already have manual JWT + role checks.

Pattern: `authenticateUser()` + `platform_admin` role check.

### P1.3 — Add Org-Scoped Auth to 10 Functions

**Effort**: 3 hours  
**Functions**: ~~`regenerate-questions`~~ (✅ already secured), `reassign-invitation-questions`, `reassign-questions`, ~~`update-invitation-status`~~ (❌ doesn't exist), `generate-training-plan`, `generate-learning-questions`, `sync-ats-candidates`, `generate-comparative-report`, `generate-predictive-analytics`, ~~`enhance-content-with-ai`~~ (✅ already secured)

> **Corrected**: Only ~7 functions actually need org-scoped auth. `regenerate-questions` and `enhance-content-with-ai` have `authenticateRequest`, `update-invitation-status` doesn't exist.

Pattern: `authenticateUser()` + verify org membership via `organization_members` table.

### P1.4 — Add Session-Token Auth to 4 Proctoring Functions

**Effort**: 1.5 hours  
**Functions**: `log-proctoring-violation` (⚠️ partial — has session-token), `update-proctoring-session` (⚠️ partial — has session-token), `auto-evaluate-interview`, ~~`evaluate-learning-assessment`~~ (✅ already secured)

> **Corrected**: `log-proctoring-violation` and `update-proctoring-session` already validate session tokens — they need JWT auth added on top. `evaluate-learning-assessment` has `authenticateRequest` and doesn't need changes.

Pattern: Validate `x-session-token` header against `interview_attempts.session_token`.

### P1.5 — Set Production Environment Variables

**Effort**: 30 minutes  
**Checklist**:
- [ ] Set `FRONTEND_URL` to actual production domain (prevent CORS `*` fallback)
- [ ] Set `FUNCTIONS_VERIFY_JWT=true` in production
- [ ] Set `SCHEDULED_CLEANUP_SECRET` to a strong random 256-bit string
- [ ] Verify all edge functions have access to required env vars
- [ ] Enable leaked password protection in Supabase Auth dashboard

---

## P2 — MEDIUM (Week 3–4)

> **Goal**: Canonical RLS rewrite, dead table cleanup, type safety.

### P2.1 — Canonical RLS Rewrite

**Effort**: 2–3 days  
**Why rewrite instead of incremental?**:
- 58 duplicate policies make incremental fixes riskier
- 42 locked-out tables need new policies regardless
- 4 inconsistent admin-check patterns need standardization
- Current 217 policies → target ~140 policies

**Approach**:

1. **Create `rls_canonical.sql`** spec file (not a migration yet):
   - One section per table
   - Standardize all policies on `has_any_role_with_hierarchy()`
   - Cover all 105 RLS-enabled tables
   - Target ~140 total policies

2. **Review spec** against `RLS_AUDIT_REPORT.md` recommendations table-by-table

3. **Create single migration**:
   ```sql
   -- Step 1: Drop ALL existing policies
   DROP POLICY IF EXISTS "policy_name" ON table_name;
   -- (repeat for all 217 existing policies)
   
   -- Step 2: Create canonical policies
   CREATE POLICY "table_select_own" ON table_name
     FOR SELECT TO authenticated
     USING (auth.uid() = user_id OR has_any_role_with_hierarchy(...));
   -- (repeat for all ~140 new policies)
   ```

4. **Test** against existing E2E test suite

**Policy Pattern Templates**:

| Pattern | Use Case | Example |
|---------|----------|---------|
| User-owned | User can manage own data | `USING (auth.uid() = user_id)` |
| Org-scoped | Org members can access org data | `USING (user_is_org_member(auth.uid(), org_id))` |
| Admin-only | Platform admin access | `USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin']))` |
| Service-only | Edge function access only | `FOR ALL TO service_role USING (true)` |
| Public-read | Publicly visible data | `FOR SELECT TO authenticated USING (true)` |

### P2.2 — DROP 1 Dead Table

> **⚠️ Re-Audit Correction**: Original audit recommended dropping 15 tables. Deep re-audit found **14 of 15 are actively used or serve critical infrastructure roles**. Only `documentation` is safe to drop.
> See `docs/DATABASE_TABLE_AUDIT.md` §2.3 for the full 18-table re-audit with evidence.

**Effort**: 30 minutes  
**Pre-requisites**: 
1. Run `SELECT count(*) FROM documentation` on production
2. Verify no foreign key references (confirmed: none except → `auth.users`)
3. Verify no data worth preserving

**Table to DROP** (the only truly dead table):

```sql
-- Migration: drop_dead_documentation_table
-- Reason: Superseded by platform_documentation (16 cols vs 8, AI generation, versioning, 9+ frontend queries)

DROP TABLE IF EXISTS documentation CASCADE;
```

**Tables Previously Marked for Deletion — Now KEPT**:
| Table | Why KEPT |
|-------|---------|
| `partner_applications` | 4 queries in PlatformAdminHub + Auth.tsx + DB function |
| `payment_gateways` | Management page + hook + DB function + App.tsx route |
| `payment_methods` | FK from payment_transactions + RLS policies |
| `payment_transactions` | SystemMonitoring.tsx + delete_organization_cascade_tx |
| `platform_documentation` | Documentation.tsx (5 queries) + DocumentationGenerator.tsx (4 queries) |
| `platform_documentation_versions` | DocumentVersionHistory.tsx + FK to platform_documentation |
| `circuit_breaker_state` | SystemMonitoring.tsx + check_circuit_breaker() DB function |
| `idempotency_keys` | 3 DB functions + generate_invoice_tx() |
| `failed_jobs` | Trigger + 5 indexes + RLS + FK to organizations |
| `rate_limit_buckets` | DB cleanup function + intentional USING(false) policy |
| `promotion_applicable_orgs` | FK to active promotions + organizations + RLS |
| `promotion_applicable_plans` | FK to active promotions + subscription_plans + RLS |
| `promotion_usages` | Written by generate_invoice_tx() + cleaned by delete_org cascade |
| `ai_model_configurations` | A/B testing infra with trigger + indexes + 3 RLS policies |

### P2.3 — Fix `any` Type Usage (Top 50%)

**Effort**: 3 days  
**Target**: Reduce from 732 to <200 instances

1. Regenerate Supabase types: `npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
2. Fix top 5 pages: `interviews/take/TakeInterviewPage.tsx`, `InterviewCreationPage.tsx`, `InterviewResultsPage.tsx`, `TrainingPage.tsx`, `PromotionsPage.tsx`
3. Fix top hook: `useInterviewCreation.ts`
4. Replace all `catch (error: any)` with `catch (error: unknown)` + type guards

### P2.4 — Fix Remaining 4 XSS Vectors (Email Template Editor)

**Effort**: 1 hour  
**File**: `src/components/admin/email/EmailTemplateEditor.tsx` (lines 267, 283, 315, 326)

> **Re-Audit Note**: These are `innerHTML` **reads** from contenteditable iframes, not XSS writes. Severity downgraded from MEDIUM to LOW. Still worth sanitizing for defense-in-depth.

### P2.5 — Change 68 `{public}` Policies to `{authenticated}`

**Effort**: 4 hours  
**Note**: This is handled as part of P2.1 (canonical RLS rewrite). If rewrite is delayed, do this as a standalone migration.

### P2.6 — Reconcile Client-Side Permissions with RLS

**Effort**: 1 day  
**Files**: `src/lib/permissions.ts` ↔ canonical RLS policies

1. Document every permission from `permissions.ts` 
2. Map each to the corresponding RLS policy
3. Identify mismatches
4. Update either the client-side permissions or the RLS policies to align

---

## P3 — LOW (Ongoing)

> **Goal**: Long-term code quality, performance, and prevention measures.

### P3.1 — Decompose 5 Largest Monolith Components

**Effort**: 1 week  
**Target files**:
1. `interviews/take/TakeInterviewPage.tsx` (~3,466 lines) → 6 components
2. `InterviewCreationPage.tsx` (~2,500 lines) → 5 components
3. `InterviewResultsPage.tsx` (~2,000 lines) → 5 components
4. `LandingPage.tsx` (~1,500 lines) → 6 components
5. `TrainingPage.tsx` (~1,000 lines) → 4 components

### P3.2 — Add `React.memo` to Frequently Re-Rendered Components

**Effort**: 2 days  
Focus on dashboard cards, table rows, sidebar navigation, modal content.

### P3.3 — Add Security ESLint Plugins

**Effort**: 2 hours

```bash
npm install -D eslint-plugin-security eslint-plugin-no-unsanitized
```

Update `eslint.config.js`:
```javascript
rules: {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': 'warn',
  'no-unsanitized/method': 'error',
  'no-unsanitized/property': 'error',
}
```

### P3.4 — Replace CSP `'unsafe-inline'` with Nonces

**Effort**: 1 day  
Update `nginx.conf` and Vite build to generate CSP nonces for inline styles.

### P3.5 — Remove Legacy Roles from `app_role` Enum

**Effort**: 2 hours  
After verifying no users have legacy roles (`admin`, `hr`, `interviewer`, `contributor`):
```sql
-- Verify no users have legacy roles
SELECT role, count(*) FROM user_roles 
WHERE role IN ('admin', 'hr', 'interviewer', 'contributor') 
GROUP BY role;

-- If count is 0 for all, remove from enum
ALTER TYPE app_role RENAME TO app_role_old;
CREATE TYPE app_role AS ENUM ('platform_admin', 'org_admin', 'hiring_manager', 'ta_creator', 'billing_admin', 'candidate', 'viewer');
-- Migrate column types...
DROP TYPE app_role_old;
```

### P3.6 — Migrate Remaining Manual Fetches to TanStack Query

**Effort**: 3 days  

> **⚠️ Re-Audit Correction**: TanStack Query v5.83.0 **IS already installed and actively used** (101 occurrences of `useQuery`/`useMutation`). This is NOT a new adoption — it's a consistency migration.

Convert remaining `useEffect` + `useState` data fetching patterns to TanStack Query `useQuery`/`useMutation` hooks for:
- Consistent caching behavior across all pages
- Background refresh (stale-while-revalidate)
- Optimistic updates
- Deduplication of parallel requests

### P3.7 — Enable `noImplicitAny` in TypeScript Config

**Effort**: 1 hour (config) + ongoing fixes  
After P2.3 reduces `any` count below 100:
```json
// tsconfig.json
{
  "compilerOptions": {
    "noImplicitAny": true
  }
}
```

### P3.8 — Add Comprehensive Audit Logging

**Effort**: 2 days  
Ensure all sensitive operations (role changes, data deletions, invoice generation, user management) are logged to the `audit_logs` table with:
- Actor (user ID + role)
- Action (CRUD operation)
- Target (table + record ID)
- Timestamp
- Before/after values for UPDATE operations

---

## Effort Summary

| Phase | Effort | Issues Resolved | Risk Reduction |
|-------|--------|-----------------|----------------|
| P0 Critical | 1–2 days | 10 Critical | 🔴 → 🟡 |
| P1 High | 3–5 days | 60 High | 🟠 → 🟢 |
| P2 Medium | 5–8 days | 76 Medium | 🟡 → 🟢 |
| P3 Low | 2–3 weeks | 80 Low | 🟢 → ✅ |
| **TOTAL** | **4–6 weeks** | **226 issues** | **Production-Ready** |

---

## Success Criteria

| Metric | Current | After P0 | After P1 | After P2 | After P3 |
|--------|---------|----------|----------|----------|----------|
| Critical RLS issues | 20 | 0 | 0 | 0 | 0 |
| Unauthenticated edge functions | ~16 | ~15 | 0 | 0 | 0 |
| XSS vectors | 7 | 4 | 4 | 0 | 0 |
| Locked-out tables | 42 | 42 | 42 | 0 | 0 |
| Dead tables | 1 | 1 | 1 | 0 | 0 |
| `any` type instances | 732 | 732 | 732 | <200 | <50 |
| Duplicate RLS policies | 58 | 58 | 58 | 0 | 0 |
| Total RLS policies | 217 | 197 | 197 | ~140 | ~140 |
| Monolith components | 12 | 12 | 12 | 12 | 5 |

---

## Dependencies & Prerequisites

```
P0.1 (RLS fix) ──→ P2.1 (RLS rewrite) ──→ P2.5 (public→authenticated)
P0.3 (DOMPurify) ──→ P2.4 (email editor XSS)
P0.4-P0.5 (edge auth) ──→ P1.1-P1.4 (all edge functions)
P2.3 (fix any types) ──→ P3.7 (noImplicitAny)
P2.1 (RLS rewrite) ──→ P2.6 (reconcile permissions)
P2.2 (drop tables) ──→ P2.1 (RLS rewrite covers remaining)
```

---

## Validation Plan

After each phase, run:

1. **Supabase RLS Tests**: Query each table as anonymous, authenticated, and admin — verify expected access
2. **Edge Function Tests**: Call each secured function without auth — verify 401 response
3. **XSS Tests**: Attempt to inject `<script>alert(1)</script>` in all sanitized fields
4. **E2E Tests**: Run existing Playwright test suite to verify no regressions
5. **TypeScript**: Run `npx tsc --noEmit` to verify no new type errors
6. **ESLint**: Run `npx eslint src/` to verify no new violations

---

*This roadmap should be reviewed and updated after each phase completion. Priorities may shift based on new findings during implementation.*
