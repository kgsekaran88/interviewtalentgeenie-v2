# RLS Policy Comprehensive Audit Report

**Database**: InterviewTalentGeenie (self-hosted Supabase PostgreSQL)  
**Date**: 2025-02-18  
**Auditor**: Automated Analysis

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total public tables | 106 |
| Tables with RLS enabled | 105 |
| Tables with policies | 63 |
| **Tables with RLS ON but ZERO policies (LOCKOUT)** | **42** |
| Total policies | 217 |
| Duplicate/redundant policies identified | **~58** |
| Conflicting pattern instances | **21** |
| Overly permissive policies ({public} + true) | **25** |
| Mis-labeled "Service role" on {public} | **8** |
| Policies using {public} but requiring uid() | **68** |
| Recursion-risk policies (raw org_members subquery) | **18** |

### Critical Findings

1. **42 tables are completely locked out** — RLS is ON with zero policies, meaning NO user (including the app) can read or write data through the API.
2. **8 policies labeled "Service role" are actually on `{public}`** — granting `USING(true)` / `WITH CHECK(true)` to EVERYONE including anonymous users. This is a **critical security vulnerability**.
3. **~58 duplicate/redundant policies** cause confusion, performance overhead, and make the policy set unmaintainable.
4. **4 different patterns** are used to check the same `platform_admin` role across 217 policies, creating inconsistency.
5. **68 policies** target `{public}` role but use `uid()` — they should target `{authenticated}` since `uid()` returns NULL for anonymous users (making the policy silently fail but creating semantic confusion).

---

## Role System Reference

```
app_role enum: admin, hr, interviewer, contributor, candidate, guest,
               platform_admin, partner_admin, hr_recruiter, ta_creator,
               billing_contact, tech_spoc
```

### Helper Functions (ALL are SECURITY DEFINER — bypass RLS)

| Function | Purpose | Queries |
|----------|---------|---------|
| `has_role(uid, role)` | Exact role match | `user_roles` |
| `has_any_role(uid, roles[])` | Any role in array | `user_roles` |
| `has_any_role_with_hierarchy(uid, roles[])` | Any role OR platform_admin | `user_roles` |
| `is_platform_admin()` | auth.uid() is platform_admin | `user_roles` |
| `user_is_org_admin(uid, org_id)` | platform_admin OR partner_admin in org | `user_roles` + `organization_members` |
| `user_is_org_member(uid, org_id)` | Active org membership | `organization_members` |
| `get_user_org_ids(uid)` | Returns user's org IDs | `organization_members` |
| `can_access_org_data(uid, org_id)` | org_admin OR org_member | Calls `user_is_org_admin` + `user_is_org_member` |

All functions are `SECURITY DEFINER` + `SET search_path TO 'public'` — they correctly bypass RLS on `user_roles` and `organization_members`. This is proper.

---

## 1. DUPLICATE POLICIES (58 redundant policies to remove)

### 1.1 Identical Policy Pairs

These are exact duplicates — same table, same command, same logic, just different names:

| Table | Policy A | Policy B | Command | Recommendation |
|-------|----------|----------|---------|----------------|
| `organizations` | "Admins can manage organizations" | "Platform admins can manage all orgs" | ALL | **Drop one** — identical `has_any_role_with_hierarchy(uid(), ARRAY['platform_admin'])` |
| `organizations` | "Members can view their organization" | "Org members can view their org" | SELECT | **Drop one** — identical `user_is_org_member(uid(), id) OR has_any_role_with_hierarchy(...)` |
| `certificates` | "Users can view their own certificates" | "certificates_owner_select" | SELECT | **Drop one** — both are `uid() = user_id` |
| `user_badges` | "Users can view their own badges" | "user_badges_owner_read" | SELECT | **Drop one** — both are `uid() = user_id` |
| `certificate_badges` | "Anyone can view badges" | "certificate_badges_public_read" | SELECT | **Drop one** — both are `USING(true)` |
| `certification_topics` | "Everyone can view active certification topics" | "certification_topics_public_read" | SELECT | **Drop one** — both are `is_active = true` |

### 1.2 Subset Policies (narrower policy is redundant when broader one exists)

Since PERMISSIVE policies are OR'd together, a narrower policy is redundant when a broader one covers it.

| Table | Narrow Policy (DROP) | Broader Policy (KEEP) | Command |
|-------|---------------------|-----------------------|---------|
| `interviews` | "Creators can delete interviews" (`uid() = creator_id`) | "interviews_delete_policy" (`creator_id = uid() OR has_any_role_with_hierarchy(...)`) | DELETE |
| `interviews` | "Authenticated users can create interviews" (`uid() = creator_id AND uid() IS NOT NULL`) | "interviews_insert_policy" (`uid() = creator_id OR has_any_role_with_hierarchy(...)`) | INSERT |
| `interviews` | "Creators can update interviews" (`uid() = creator_id`) | "interviews_update_policy" (`creator_id = uid() OR ... OR org_admin`) | UPDATE |
| `interviews` | "Users can view own and org interviews" | "interviews_select_policy" (superset with partner_admin/hr_recruiter/ta_creator) | SELECT |
| `organizations` | "Admins can manage organizations" | "organizations_admin_manage" (includes org_admin) | ALL |
| `organizations` | "Org admins can update their org" | "organizations_admin_manage" (ALL includes UPDATE) | UPDATE |
| `notifications` | "Users can view their own" + "Users can update their own" | "notifications_user_policy" (ALL for user_id=uid() OR platform_admin) | SELECT, UPDATE |
| `interview_invitations` | "Platform admins can manage invitations" ({authenticated}) | "interview_invitations_manage_policy" ({public}, same logic + creator access) | ALL |
| `interview_invitations` | "Creators can view invitations" ({authenticated}) | "interview_invitations_select_policy" ({public}, superset with can_access_org_data) | SELECT |
| `profiles` | "Authenticated: Update own profile only" (`uid() = id`) | "profiles_update_policy" (`uid() = id OR has_any_role_with_hierarchy(...)`) | UPDATE |
| `profiles` | "Partner admins can view org member profiles" | "profiles_select_policy" (superset) | SELECT |
| `profiles` | "Platform admins can view all profiles" | "profiles_select_policy" (includes same check) | SELECT |

### 1.3 Massive Duplication: `proctoring_sessions` SELECT (7 → should be 2)

| # | Policy | Role | Logic | Status |
|---|--------|------|-------|--------|
| 1 | "Admins and recruiters can view all" | {authenticated} | EXISTS user_roles for 4 roles | **KEEP (merge)** |
| 2 | "Authorized users can view interview" | {authenticated} | has_role(platform_admin) + own attempts | **Merge into #1** |
| 3 | "Org admins can view org" | {authenticated} | has_any_role_with_hierarchy + org check | **Merge into #1** |
| 4 | "Org members can view org" | {authenticated} | org_members join + has_role(platform_admin) | **Merge into #1** |
| 5 | "Platform admins can view all" | {authenticated} | has_role(platform_admin) | **DROP** — covered by #1 and #7 |
| 6 | "Staff can view all" | {public} | EXISTS user_roles (ANY role!) | **🚨 DROP** — overly permissive |
| 7 | "proctoring_sessions_select_policy" | {public} | has_any_role_with_hierarchy + org | **KEEP as canonical** |

**Policy #6 is DANGEROUS**: It grants SELECT to anyone with ANY role in `user_roles` — candidates, guests, everyone.

### 1.4 Massive Duplication: `interview_attempts` SELECT (6 → should be 2)

| # | Policy | Role | Logic | Status |
|---|--------|------|-------|--------|
| 1 | "Authenticated users can view their own" | {public} | profile email match | **DROP** — covered by #2 |
| 2 | "Candidates can view own attempts" | {authenticated} | profile email match | **Merge** |
| 3 | "Candidates can view their own attempts" | {authenticated} | email match + creator/org_admin | **KEEP** (superset of #2) |
| 4 | "Org admins can view org attempts" | {authenticated} | org_admin + email + creator | **Merge into #3** |
| 5 | "Staff and platform admins can view" | {public} | has_any_role_with_hierarchy + creator + hr_recruiter | **DROP** — covered by #6 |
| 6 | "interview_attempts_select_policy" | {public} | has_any_role_with_hierarchy + org + roles | **KEEP as canonical** |

### 1.5 Massive Duplication: `interview_attempts` UPDATE (4 → should be 2)

| # | Policy | Role | Logic | Status |
|---|--------|------|-------|--------|
| 1 | "Candidates can update own attempts" | {authenticated} | session_token + email match | **KEEP** |
| 2 | "Candidates can update their own attempts" | {authenticated} | email match | **DROP** — overlaps with #1 |
| 3 | "Session-based: Update own attempt - protected PII" | {public} | session_token + status check + PII protection | **KEEP** (different purpose) |
| 4 | "interview_attempts_update_policy" | {public} | has_any_role_with_hierarchy OR creator/active | **KEEP** |

### 1.6 Other Duplicates

| Table | Duplicate Policies | Command | Action |
|-------|-------------------|---------|--------|
| `custom_roles` ALL (4 policies) | "Platform admins can manage all" + "custom_roles_org_admin_policy" + "Org admins can manage" + "Partner admins can manage their org" | ALL | Consolidate to 2: platform_admin ALL + org_admin ALL |
| `certificate_badges` ALL (2) | "certificate_badges_admin_all" + "certificate_badges_admin_write" | ALL | Identical — drop one |
| `certificates` ALL (2) | "Service role can manage" + "certificates_admin_all" | ALL | "Service role" is USING(true) on {public} — **CRITICAL FIX** |
| `consent_records` ALL (2) | "Service role can manage" + "consent_records_admin_policy" | ALL | Same issue — "Service role" on {public} |
| `data_deletion_requests` ALL (2) | "Platform admins can manage" + "data_deletion_requests_admin_policy" | ALL | Identical intent, different patterns |
| `data_retention_policies` ALL (2) | Named + "data_retention_policies_org_policy" | ALL | Overlapping |
| `certification_topics` ALL (2) | "Admins can manage" ({auth}) + "certification_topics_admin_all" ({public}) | ALL | Duplicate + role mismatch |
| `questions` ALL (2) | "questions_admin_all" ({public}) | ALL | Keep one |
| `user_badges` ALL (2) | "Service role can manage" (USING true!) + "user_badges_admin_write" | ALL | **CRITICAL FIX** |
| `assessments` INSERT (2) | "Service role can insert" + "assessments_insert_policy" | INSERT | Both CHECK(true) on {public} — consolidate |
| `audit_logs` INSERT (2) | "Service role can insert" ({service_role}) + "audit_logs_insert_policy" ({public}) | INSERT | Keep {service_role}, drop {public} |
| `audit_logs` SELECT (2) | "Admins can view" ({authenticated}) + "audit_logs_select_policy" ({public}) | SELECT | Consolidate |
| `organization_members` SELECT (3) | "admins_read_all_members" + "users_read_org_members" + "users_read_own_memberships" | SELECT | OK — these serve different purposes |

---

## 2. CONFLICTING PATTERNS (4 patterns for same intent)

The same logical check "is this user a platform_admin?" is implemented 4 different ways:

| Pattern | Code | Used In (count) |
|---------|------|-----------------|
| **A** | `has_any_role_with_hierarchy(uid(), ARRAY['platform_admin'])` | 78 policies |
| **B** | `EXISTS (SELECT 1 FROM user_roles WHERE user_id = uid() AND role = 'platform_admin')` | 21 policies |
| **C** | `has_role(uid(), 'platform_admin')` | 13 policies |
| **D** | `is_platform_admin()` | 6 policies |

### Why This Matters

- **Pattern A** checks for the requested role OR `platform_admin` (hierarchy). When called with `ARRAY['platform_admin']`, it's equivalent to Pattern C but with overhead.
- **Pattern B** is a raw subquery that DOES go through RLS on `user_roles` (but currently safe since `user_roles` policies use `is_platform_admin()` which is SECURITY DEFINER).
- **Pattern C** is a clean SECURITY DEFINER function call.
- **Pattern D** is the simplest — doesn't take parameters, always uses `auth.uid()`.

### Tables Using Multiple Patterns

| Table | Patterns Used | Policies Affected |
|-------|--------------|-------------------|
| `proctoring_sessions` | A + B + C | 10 policies |
| `custom_roles` | A + B + C | 5 policies |
| `certificates` | A + B + C | 7 policies |
| `user_badges` | B + C | 6 policies |
| `security_events` | A + B | 4 policies |
| `consent_records` | A + B | 4 policies |
| `data_deletion_requests` | A + B | 4 policies |
| `data_retention_policies` | A + B | 4 policies |
| `certification_topics` | A + B | 4 policies |

### Recommendation

**Standardize on Pattern A** (`has_any_role_with_hierarchy`) as the canonical pattern for all role checks. It:
- Is SECURITY DEFINER (bypasses RLS recursion)
- Supports hierarchy (platform_admin always gets access)
- Is the most commonly used (78 policies already)
- Is flexible for multi-role checks

Use `is_platform_admin()` (Pattern D) ONLY for `user_roles` and `organization_members` policies to avoid any recursion risk.

---

## 3. ROLE MISMATCH: `{public}` vs `{authenticated}`

### 3.1 Policies on `{public}` that use `uid()` (68 policies)

In Supabase, `{public}` includes the `anon` role. When a policy uses `uid()` but targets `{public}`:
- For anonymous users, `uid()` returns `NULL`
- The policy effectively denies access to anon users anyway
- But semantically this is WRONG and creates confusion

**Tables with `{public}` + `uid()` policies** (should be `{authenticated}`):

`activity_feed`, `ai_coach_sessions`, `ai_usage_logs`, `assessments`, `ats_integrations`, `ats_sync_logs`, `audit_logs`, `bias_detection_results`, `candidate_performance_index`, `certificate_badges`, `certificates`, `certification_attempts`, `certification_global_config`, `consent_records`, `custom_roles`, `email_logs`, `interview_attempts`, `interview_invitations`, `interview_templates`, `interviews`, `invoices`, `notifications`, `organization_members`, `organizations`, `proctoring_sessions`, `proctoring_violations`, `profiles`, `questions`, `security_events`, `usage_tracking`, `user_badges`, `user_roles`

### 3.2 Mixed Role Targeting (same table, same cmd, different roles)

These tables have policies for the same command targeting both `{public}` and `{authenticated}`:

| Table | Command | {public} policies | {authenticated} policies |
|-------|---------|-------------------|-------------------------|
| `proctoring_sessions` | SELECT | 3 | 5 |
| `interview_attempts` | SELECT | 3 | 3 |
| `interview_attempts` | INSERT | 1 | 2 |
| `interview_attempts` | UPDATE | 2 | 2 |
| `certificates` | SELECT | 3 | 2 |
| `interview_invitations` | ALL | 1 | 1 |
| `interview_invitations` | SELECT | 1 | 1 |
| `custom_roles` | ALL | 3 | 1 |
| `certification_topics` | ALL | 1 | 1 |

### Recommendation

Change ALL policies using `uid()` from `{public}` to `{authenticated}`, EXCEPT:
- Policies intentionally allowing anonymous access (e.g., `certificate_badges` public read, `subscription_plans` view active plans)
- Insert policies for anonymous form submissions (e.g., `data_deletion_requests`)

---

## 4. OVERLY PERMISSIVE POLICIES (25 dangerous policies)

### 4.1 🚨 CRITICAL: "Service role" policies on `{public}` (8 policies)

These are named "Service role can manage..." but target `{public}`, meaning **ANYONE including anonymous users** gets full access:

| Table | Policy Name | Command | USING | CHECK |
|-------|-------------|---------|-------|-------|
| `ai_coach_sessions` | "Service role can manage coach sessions" | ALL | `true` | `true` |
| `analytics_snapshots` | "Service role can manage analytics" | ALL | `true` | `true` |
| `ats_candidates` | "Service role can manage ATS candidates" | ALL | `true` | `true` |
| `candidate_performance_index` | "Service role can manage CPI" | ALL | `true` | `true` |
| `certificates` | "Service role can manage certificates" | ALL | `true` | `true` |
| `certification_attempts` | "Service role can manage attempts" | ALL | `true` | `true` |
| `consent_records` | "Service role can manage consent records" | ALL | `true` | `true` |
| `user_badges` | "Service role can manage user badges" | ALL | `true` | — |

**Impact**: Any anonymous API call can read/write/delete ALL data in these 8 tables.

**Fix**: Change role from `{public}` to `{service_role}` or drop and recreate with correct role.

### 4.2 🚨 HIGH: Open INSERT policies on `{public}` (10 policies)

| Table | Policy Name | CHECK |
|-------|-------------|-------|
| `interview_attempts` | "interview_attempts_insert_policy" | `true` |
| `proctoring_sessions` | "proctoring_sessions_insert_policy" | `true` |
| `proctoring_violations` | "proctoring_violations_insert_policy" | `true` |
| `notifications` | "System can insert notifications" | `true` |
| `security_events` | "Service role can insert security events" | `true` |
| `usage_tracking` | "System can track usage" | `true` |
| `assessments` | "Service role can insert assessments" | `true` |
| `assessments` | "assessments_insert_policy" | `true` |
| `ats_sync_logs` | "Service role can insert sync logs" | `true` |
| `bias_detection_results` | "Service role can insert bias results" | `true` |
| `ai_coach_sessions` | "ai_coach_sessions_insert_policy" | `true` |
| `data_deletion_requests` | "Anyone can submit data deletion requests" | `true` |

**Impact**: Anonymous users can insert arbitrary data into these tables.

**Fix**: Change to `{service_role}` for system/service inserts, or `{authenticated}` with ownership checks.

### 4.3 ⚠️ MEDIUM: Open SELECT on `{public}` (4 policies)

| Table | Policy Name | Intentional? |
|-------|-------------|-------------|
| `certificate_badges` | "Anyone can view badges" | ✅ Probably intentional (public verification) |
| `certificates` | "certificates_public_verify" | ✅ Probably intentional (public verification) |
| `email_templates` | "Service role can read all templates" | ❌ Should be {service_role} |
| `user_badges` | "user_badges_public_verify" | ✅ Probably intentional |

### 4.4 ⚠️ "Staff can view all proctoring sessions" on `{public}`

```sql
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = uid()))
```

This allows ANY user with ANY role (including `guest` and `candidate`) to view ALL proctoring sessions. This is almost certainly unintentional.

---

## 5. LOCKOUT TABLES (42 tables — RLS ON, ZERO policies)

These tables are completely inaccessible through the Supabase API. Categorized by function and recommended policy pattern.

### 5.1 Learning System (11 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `learning_assessments` | `user_id` | Owner SELECT/UPDATE; Platform admin ALL |
| `learning_assessment_attempts` | `user_id` | Owner SELECT/INSERT/UPDATE; Admin ALL |
| `learning_assessment_feedback` | `user_id` | Owner SELECT; Admin ALL |
| `learning_assessment_questions` | — | Public SELECT (active); Admin ALL |
| `learning_assessment_usage` | `user_id` | Owner SELECT; Admin SELECT |
| `learning_materials` | — | Public SELECT (published); Admin ALL |
| `learning_payments` | `user_id` | Owner SELECT; Admin ALL |
| `learning_plans` | `user_id` | Owner SELECT/UPDATE; Admin ALL |
| `learning_subscriptions` | `user_id` | Owner SELECT; Admin ALL |
| `training_plans` | `created_by`, `organization_id` | Creator ALL; Org member SELECT; Admin ALL |
| `training_topics` | — | Authenticated SELECT; Admin ALL |

### 5.2 Interview Panel System (3 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `interview_panel_members` | `user_id` | Panel member SELECT; Creator ALL; Org admin ALL; Admin ALL |
| `panel_consensus` | — | Panel member SELECT/INSERT; Creator SELECT; Admin ALL |
| `panel_evaluations` | — | Evaluator INSERT/UPDATE; Creator SELECT; Admin ALL |

### 5.3 Payments & Billing (4 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `organization_subscriptions` | `organization_id` | Org admin ALL; Org member SELECT; Admin ALL |
| `payment_gateways` | `organization_id` | Org admin ALL; Admin ALL |
| `payment_methods` | `organization_id` | Org admin ALL; Org member SELECT; Admin ALL |
| `payment_transactions` | `organization_id` | Org admin SELECT; Org member SELECT; Admin ALL |

### 5.4 Platform Admin Only (5 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `platform_configurations` | — | Platform admin ALL |
| `platform_documentation` | `created_by` | Authenticated SELECT; Admin ALL |
| `platform_documentation_versions` | `created_by` | Authenticated SELECT; Admin ALL |
| `system_config` | — | Platform admin ALL |
| `role_permissions` | — | Platform admin ALL; Authenticated SELECT |

### 5.5 Promotions System (4 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `promotions` | `created_by` | Admin ALL; Authenticated SELECT (active) |
| `promotion_applicable_orgs` | `organization_id` | Admin ALL; Org admin SELECT |
| `promotion_applicable_plans` | — | Admin ALL; Authenticated SELECT |
| `promotion_usages` | `organization_id` | Admin ALL; Org admin SELECT |

### 5.6 User Training & Progress (3 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `user_custom_roles` | `user_id`, `organization_id` | Org admin ALL; Owner SELECT; Admin ALL |
| `user_topic_progress` | `user_id` | Owner SELECT/UPDATE; Admin ALL |
| `user_training_assignments` | `user_id` | Owner SELECT; Org admin ALL; Admin ALL |

### 5.7 Operations & Monitoring (4 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `interview_operation_logs` | — | Admin SELECT; Service role INSERT |
| `predictive_analytics` | `organization_id` | Org admin SELECT; Admin ALL |
| `preinterview_check_logs` | — | Admin SELECT; Service role INSERT |
| `rate_limit_buckets` | — | Service role ALL (no API access needed) |

### 5.8 Other (8 tables)

| Table | Ownership Column | Recommended Policies |
|-------|-----------------|---------------------|
| `partner_applications` | `organization_id` | Org admin ALL; Admin ALL |
| `password_setup_invitations` | `user_id`, `created_by` | Creator INSERT/SELECT; User SELECT; Admin ALL |
| `proctoring_settings` | `organization_id` | Org admin ALL; Org member SELECT; Admin ALL |
| `report_templates` | `organization_id`, `created_by` | Creator ALL; Org member SELECT; Admin ALL |
| `resume_parsing_results` | — | Authenticated SELECT (own); Admin ALL; Service role INSERT |
| `test_results` | — | Admin ALL; Service role INSERT |
| `test_runs` | — | Admin ALL; Service role INSERT |
| `test_suites` | `created_by` | Admin ALL; Creator SELECT |

---

## 6. RECURSION RISKS

### 6.1 Safe: SECURITY DEFINER Functions

All 8 helper functions are `SECURITY DEFINER` which means they bypass RLS when querying `user_roles` and `organization_members`. This is correct and prevents infinite recursion.

### 6.2 ⚠️ Risk: Raw Inline Subqueries to `organization_members`

**18 policies across 14 tables** do raw `SELECT ... FROM organization_members` subqueries instead of using SECURITY DEFINER functions. These subqueries ARE subject to RLS on `organization_members`.

Currently this works because `organization_members` policies use simple checks:
- `is_platform_admin()` (SECURITY DEFINER)
- `get_user_org_ids(uid())` (SECURITY DEFINER)  
- `user_id = uid()` (no sub-query)

**But if anyone adds a complex policy to `organization_members` that queries another table, it will cascade.**

| Table | Policy | Raw Subquery |
|-------|--------|-------------|
| `activity_feed` | "Organization can view activity" | `organization_members WHERE user_id = uid()` |
| `certificates` | "Org admins can view org member certificates" | `organization_members` (nested) |
| `collaboration_threads` | "Platform admins and org members can collaborate" | `organization_members ON i.organization_id` |
| `comparative_analytics` | "Organization can view comparative analytics" | `organization_members WHERE user_id = uid()` |
| `custom_roles` | "Partner admins can manage their org custom roles" | `organization_members WHERE user_id = uid()` |
| `custom_roles` | "Org members can view their org custom roles" | `organization_members WHERE user_id = uid()` |
| `email_logs` | "Partner admins can view org email logs" | `organization_members WHERE user_id = uid()` |
| `generated_reports` | "Organization can view generated reports" | `organization_members WHERE user_id = uid()` |
| `interview_schedules` | "Organization can manage schedules" | `organization_members ON i.organization_id` |
| `interview_templates` | "Platform admins and org members can manage" | `organization_members WHERE user_id = uid()` |
| `interview_templates` | "Public templates viewable by all authenticated" | `organization_members WHERE user_id = uid()` |
| `interviews` | "Users can view own and org interviews" | `organization_members WHERE user_id = uid()` |
| `proctoring_sessions` | "Authorized users can view interview" | `organization_members om WHERE om.user_id = uid()` |
| `proctoring_sessions` | "Org members can view org" | `organization_members om ON om.organization_id` |
| `profiles` | "Partner admins can view org member profiles" | `organization_members` (nested) |
| `profiles` | "profiles_select_policy" | `organization_members om` via `user_is_org_admin` call and inline |
| `usage_tracking` | "Members can view their org usage" | `organization_members WHERE user_id = uid()` |

### Recommendation

Replace all raw `organization_members` subqueries with `can_access_org_data(uid(), org_id)` or `get_user_org_ids(uid())` function calls. These are SECURITY DEFINER and bypass RLS.

**Example transformation:**
```sql
-- BEFORE (recursion risk):
organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = uid() AND status = 'active'
)

-- AFTER (safe):
organization_id IN (SELECT get_user_org_ids(uid()))
-- or:
can_access_org_data(uid(), organization_id)
```

---

## 7. TABLE-BY-TABLE ANALYSIS

### Tables with Policies (63 tables)

#### `activity_feed` (1 policy)
- ✅ "Organization can view activity" — SELECT via org_members subquery
- ⚠️ Uses raw org_members subquery
- ❌ Missing: INSERT, UPDATE, DELETE policies; platform_admin access
- **Fix**: Add admin ALL; replace raw subquery with `get_user_org_ids(uid())`

#### `ai_coach_sessions` (3 policies)
- 🚨 "Service role can manage coach sessions" — ALL USING(true) on **{public}** 
- ✅ "Candidates can view their own" — SELECT user_id = uid()
- ⚠️ "ai_coach_sessions_insert_policy" — INSERT CHECK(true) on {public}
- ❌ "ai_coach_sessions_select_policy" — SELECT USING same as candidates but on {public}
- **Fix**: Change "Service role" to {service_role}; consolidate SELECT; change INSERT to {authenticated} with ownership check

#### `ai_feature_alerts` (2 policies)
- ✅ "Platform admins can manage alerts" — ALL on {authenticated} ✓
- ⚠️ "ai_feature_alerts_admin_policy" — ALL on {public} using EXISTS user_roles
- **Fix**: Drop one (keep {authenticated} version)

#### `ai_feature_configurations` (1 policy) — ✅ Clean
#### `ai_feature_health` (1 policy) — ✅ Clean
#### `ai_health_alerts` (1 policy) — ✅ Clean  
#### `ai_health_checks` (1 policy) — ✅ Clean
#### `ai_health_monitoring` (2 policies)
- ✅ "Platform admins can manage" — ALL, admin check ✓
- ⚠️ "Platform admins can view" — SELECT, EXISTS user_roles (Pattern B)
- **Fix**: DROP the SELECT (ALL includes SELECT)

#### `ai_model_configurations` (2 policies)
- ✅ "Platform admins can manage model configs" — ALL on {authenticated}
- ⚠️ "ai_model_configurations_admin_policy" — ALL on {public} using EXISTS user_roles
- **Fix**: Drop one (keep {authenticated})

#### `ai_model_performance` (1 policy) — ✅ Clean
#### `ai_provider_credentials` (1 policy) — ✅ Clean
#### `ai_providers` (1 policy) — ✅ Clean
#### `ai_usage_logs` (3 policies)
- ✅ "Service role can insert" — INSERT on {service_role} ✓
- ✅ "Platform admins can view" — SELECT on {authenticated} ✓  
- ✅ "Org admins can view their org" — SELECT on {public} with org check
- **Fix**: Change last one to {authenticated}

#### `analytics_snapshots` (2 policies)
- 🚨 "Service role can manage analytics" — ALL USING(true) on **{public}**
- ✅ "analytics_snapshots_admin_policy" — ALL, admin check
- **Fix**: Change "Service role" to {service_role}; duplicative otherwise

#### `approval_workflows` (1 policy) — ✅ Clean (but on {public} with uid())

#### `architecture_documents` (2 policies)
- ⚠️ "Authenticated users can view" — SELECT USING(true) on {authenticated} — overly broad
- ✅ "Platform admins can manage" — ALL, admin check
- **Fix**: Consider restricting view to specific roles

#### `assessments` (5 policies)
- ⚠️ 2 INSERT policies both CHECK(true) on {public} — **anyone can insert**
- ✅ 2 SELECT policies (admin + creator/org)
- ✅ 1 UPDATE policy (admin + creator)
- **Fix**: Consolidate INSERTs; restrict to {authenticated} with ownership

#### `ats_candidates` (2 policies)
- 🚨 "Service role can manage" — ALL USING(true) on **{public}**
- ✅ "Org admins can manage" — ALL on {authenticated}
- **Fix**: Change "Service role" to {service_role}

#### `ats_integrations` (2 policies) — minor: role mismatch
#### `ats_sync_logs` (2 policies) — minor: INSERT CHECK(true) on {public}

#### `attempt_questions` (2 policies) — ✅ Clean

#### `audit_logs` (4 policies)
- ✅ "Service role can insert" — INSERT on {service_role} ✓
- 🚨 "audit_logs_insert_policy" — INSERT CHECK(true) on {public} — **duplicate + dangerous**
- Mixed: "Admins can view" ({authenticated}) + "audit_logs_select_policy" ({public})
- **Fix**: Drop {public} insert; consolidate SELECTs

#### `bias_detection_results` (2 policies) — INSERT CHECK(true) on {public}

#### `candidate_performance_index` (5 policies)
- 🚨 "Service role can manage CPI" — ALL USING(true) on {public}
- Duplicate: 3 SELECT policies
- **Fix**: Change "Service role" to {service_role}; consolidate SELECTs

#### `certificate_badges` (5 policies)
- ✅ 2 public read (intentional, but duplicates)
- ⚠️ 2 admin ALL (duplicate)
- **Fix**: Drop duplicates (keep 1 public read, 1 admin ALL)

#### `certificates` (7 policies)
- 🚨 "Service role can manage" — ALL USING(true) on {public}
- Duplicate: "Users can view own" × 2
- ⚠️ "certificates_public_verify" USING(true) — makes ALL other SELECT policies moot
- **Fix**: Critical — fix service role; remove owner duplicate; review if public verify is intended

#### `certification_assessments` (2 policies) — ✅ Clean
#### `certification_attempts` (5 policies)
- 🚨 "Service role can manage" — ALL USING(true) on {public}
- Others fine (owner + admin)
- **Fix**: Change "Service role" to {service_role}

#### `certification_global_config` (3 policies) — ✅ Clean
#### `certification_topics` (4 policies) — duplicates across {public}/{authenticated}

#### `chatbot_knowledge` (2 policies) — ✅ Clean (uses has_role)
#### `circuit_breaker_state` (1 policy) — ✅ Clean
#### `collaboration_threads` (1 policy) — ⚠️ Raw org_members subquery
#### `comparative_analytics` (1 policy) — ⚠️ Raw org_members subquery
#### `consent_records` (3 policies) — 🚨 "Service role" on {public} + duplicate admin

#### `custom_roles` (5 policies) — 4 ALL policies! Massive duplication
#### `data_deletion_requests` (3 policies) — duplicate admin; INSERT CHECK(true) likely intentional
#### `data_retention_policies` (2 policies) — duplicative
#### `documentation` (2 policies) — ⚠️ Uses `has_role(uid(), 'admin')` — the `admin` role, not `platform_admin`

#### `email_logs` (2 policies) — ✅ Clean but different patterns
#### `email_templates` (3 policies) — ⚠️ "Service role can read all" USING(true) on {public}

#### `failed_jobs` (1 policy) — ✅ Clean
#### `generated_reports` (1 policy) — ⚠️ Raw org_members subquery
#### `idempotency_keys` (1 policy) — ✅ Clean

#### `interview_attempts` (13 policies!) — 🚨 WORST offender. See §1.4 and §1.5

#### `interview_invitations` (8 policies) — Heavy duplication. See §1.3

#### `interview_schedules` (1 policy) — ⚠️ Raw org_members JOIN (recursion risk)
#### `interview_templates` (2 policies) — ⚠️ Raw org_members subquery × 2

#### `interviews` (8 policies) — Significant duplication. Every cmd has 2 policies.

#### `invoices` (2 policies) — ✅ Clean

#### `notifications` (4 policies) — Duplicate: individual SELECT/UPDATE subsumed by ALL

#### `onboarding_progress` (1 policy) — ✅ Clean

#### `organization_members` (4 policies) — ✅ CLEAN and well-structured (uses SECURITY DEFINER functions)

#### `organizations` (7 policies) — Heavy duplication (3 identical ALL, 3 SELECT)

#### `proctoring_sessions` (12 policies!) — 🚨 SECOND WORST. 7 SELECT policies. See §1.3

#### `proctoring_violations` (3 policies) — INSERT CHECK(true) on {public}

#### `profiles` (7 policies) — Moderate duplication; 3 SELECT policies

#### `questions` (8 policies) — Duplicate admin ALL; 4 SELECT policies on {public}

#### `security_events` (3 policies) — INSERT CHECK(true) on {public}; duplicate admin

#### `subscription_plans` (5 policies) — ✅ Clean pattern but uses has_role instead of has_any_role_with_hierarchy

#### `usage_tracking` (2 policies) — ✅ Clean

#### `user_badges` (6 policies) — 🚨 "Service role" USING(true) on {public}; duplicate owner SELECT

#### `user_roles` (5 policies) — ✅ CLEAN and well-structured (uses is_platform_admin())

---

## 8. RECOMMENDED ACTION PLAN

### Phase 1: CRITICAL Security Fixes (Immediate)

**8 policies to fix** — "Service role" on `{public}` with USING(true):

```sql
-- Fix each: DROP the {public} version, CREATE on {service_role}
-- Tables: ai_coach_sessions, analytics_snapshots, ats_candidates,
--         candidate_performance_index, certificates, certification_attempts,
--         consent_records, user_badges

-- Example for certificates:
DROP POLICY "Service role can manage certificates" ON certificates;
CREATE POLICY "service_role_manage_certificates" ON certificates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Phase 2: Remove Duplicates (~58 policies to drop)

Priority order:
1. Drop identical pairs (6 pairs = 6 drops)
2. Drop subset policies subsumed by broader ones (~15 drops)
3. Consolidate `proctoring_sessions` from 12 → 4 policies (drop 8)
4. Consolidate `interview_attempts` from 13 → 5 policies (drop 8)
5. Consolidate `interviews` from 8 → 4 policies (drop 4)
6. Consolidate `organizations` from 7 → 3 policies (drop 4)
7. Consolidate remaining tables (~13 drops)

### Phase 3: Standardize Patterns

1. Replace all Pattern B (raw EXISTS subquery) with Pattern A (`has_any_role_with_hierarchy`) — 21 policies
2. Replace all Pattern C (`has_role`) with Pattern A — 13 policies
3. Keep Pattern D (`is_platform_admin()`) only on `user_roles` and `organization_members`

### Phase 4: Fix Role Targeting

Change 68 policies from `{public}` to `{authenticated}` where they use `uid()`.

### Phase 5: Eliminate Recursion Risks

Replace 18 raw `organization_members` subqueries with `get_user_org_ids(uid())` or `can_access_org_data()` calls.

### Phase 6: Add Policies for 42 Lockout Tables

Create baseline policies for all 42 locked-out tables following the patterns in §5.

---

## 9. NUMERICAL SUMMARY

| Issue Category | Count | Severity |
|---------------|-------|----------|
| "Service role" on {public} USING(true) | 8 | 🚨 CRITICAL |
| INSERT CHECK(true) on {public} | 12 | 🚨 HIGH |
| Identical duplicate policies | 6 pairs (12 policies) | ⚠️ MEDIUM |
| Subset/redundant policies | ~46 policies | ⚠️ MEDIUM |
| Mixed {public}/{authenticated} per table | 9 tables | ⚠️ MEDIUM |
| Conflicting pattern usage | 21 tables | ℹ️ LOW |
| {public} policies using uid() | 68 policies | ℹ️ LOW |
| Raw org_members subqueries (recursion risk) | 18 policies in 14 tables | ⚠️ MEDIUM |
| Tables completely locked out | 42 tables | 🚨 HIGH |
| Tables with no issues | ~15 tables | ✅ OK |

### Post-Cleanup Target

| Metric | Current | Target |
|--------|---------|--------|
| Total policies | 217 | ~140 |
| Tables with policies | 63 | 105 |
| Duplicate policies | ~58 | 0 |
| Pattern variants | 4 | 1 (+ is_platform_admin for bootstrapping tables) |
| {public} policies with uid() | 68 | 0 |
| Open USING(true) on {public} | 10 | 2-3 (intentional public reads only) |
| Recursion-risk raw subqueries | 18 | 0 |
