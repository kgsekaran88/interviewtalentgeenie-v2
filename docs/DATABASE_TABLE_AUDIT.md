# 📊 Database Table Audit — March 2026

**Total Tables**: 103 (per `LOVABLE_CLOUD_SCHEMA_EXPORT.md`)  
**Tables with RLS Enabled**: 105 (includes 2 system views)  
**Tables with Policies**: 63  
**Tables Locked Out (RLS ON + 0 Policies)**: 42  
**Truly Dead Tables (Zero Usage Anywhere)**: 1 (was 12 — corrected in §2.3)  
**Effectively Dead Tables (Only in .bak Files)**: 0 (was 3 — corrected in §2.3)

---

## 1. Table Inventory by Domain

### 1.1 AI/ML System (12 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `ai_coach_sessions` | ✅ Active | ✅ Active | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}`** |
| `ai_feature_alerts` | ❌ None (planned) | ⚠️ .bak only | Has policies | ✅ Keep — AI monitoring, see §2.3.1 #16 |
| `ai_feature_configurations` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `ai_feature_health` | ❌ None | ✅ Active (4 functions) | Has policies | Keep — edge-function-only |
| `ai_health_alerts` | ❌ None | ✅ Active (INSERT) | Has policies | Keep — edge-function-only |
| `ai_health_checks` | ❌ None | ✅ Active (2 functions) | Has policies | Keep — edge-function-only |
| `ai_health_monitoring` | ❌ None (planned) | ⚠️ .bak only | Has policies | ✅ Keep — AI health checks, see §2.3.1 #17 |
| `ai_model_configurations` | ❌ None (planned) | ❌ None (planned) | Has policies | ✅ Keep — planned A/B testing, see §2.3.1 #14 |
| `ai_model_performance` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `ai_provider_credentials` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `ai_providers` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `ai_usage_logs` | ✅ Active | ✅ Active | Has policies | ✅ Keep |

### 1.2 Analytics (3 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `analytics_snapshots` | ❌ None | ✅ Active (3 functions) | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}` only** |
| `comparative_analytics` | ❌ None | ✅ Active (3 functions) | Has policies | Keep — edge-function-only |
| `predictive_analytics` | ❌ None | ✅ Active (INSERT) | 🔴 Locked out | Add `{service_role}` policy |

### 1.3 ATS Integration (3 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `ats_candidates` | ✅ Active | ✅ Active | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}`** |
| `ats_integrations` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `ats_sync_logs` | ✅ Active | ✅ Active | Has policies | ✅ Keep |

### 1.4 Billing & Payments (8 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `invoices` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `organization_subscriptions` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `payment_gateways` | ✅ Active (PaymentGatewayManagement, hook) | ✅ Active (is_payment_enabled fn) | Has policies | ✅ Keep — see §2.3.1 #2 |
| `payment_methods` | ❌ None (planned) | ❌ None | Has policies | ✅ Keep — FK from payment_transactions, see §2.3.1 #3 |
| `payment_transactions` | ✅ Active (SystemMonitoring) | ✅ Active (delete_org_cascade) | Has policies | ✅ Keep — see §2.3.1 #4 |
| `subscription_plans` | ✅ Active | ✅ Active | Has policies | ✅ Keep |

### 1.5 Certifications (6 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `certificates` | ✅ Active | ✅ Active | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}`** |
| `certification_assessments` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `certification_attempts` | ✅ Active | ✅ Active | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}`** |
| `certification_global_config` | ✅ Active | ✅ Active | Has policies | ✅ Keep |

### 1.6 Interviews (9 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `attempt_questions` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `interview_attempts` | ✅ Active (8+ files) | ✅ Active | Has policies (13 — reduce) | ✅ Keep, consolidate policies |
| `interview_invitations` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `interview_operation_logs` | ❌ None | ✅ Active | 🔴 Locked out | Add `{service_role}` policy |
| `interview_panel_members` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `interview_schedules` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `interview_templates` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `interviews` | ✅ Active (core) | ✅ Active | Has policies (8 — reduce) | ✅ Keep, consolidate policies |
| `questions` | ✅ Active (core) | ✅ Active | Has policies | ✅ Keep |

### 1.7 Learning System (9 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `learning_assessments` | ✅ Active (6+ files) | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `learning_assessment_attempts` | ✅ Active (5+ files) | ✅ Active | 🔴 Locked out | Add user-scoped policies |
| `learning_assessment_feedback` | ✅ Active | ✅ Active | 🔴 Locked out | Add user-scoped policies |
| `learning_assessment_questions` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `learning_assessment_usage` | ✅ Active | ✅ Active | 🔴 Locked out | Add user-scoped policies |
| `learning_materials` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `learning_payments` | ✅ Active | ✅ Active | 🔴 Locked out | Add user-scoped policies |
| `learning_plans` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `learning_subscriptions` | ✅ Active | ✅ Active | 🔴 Locked out | Add user-scoped policies |

### 1.8 Organizations (4 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `organization_members` | ✅ Active (core) | ✅ Active | Has policies | ✅ Keep |
| `organizations` | ✅ Active (core) | ✅ Active | Has policies (7 — reduce) | ✅ Keep, consolidate |
| `partner_applications` | ✅ Active (PlatformAdminHub, Auth) | ✅ Active (approve_partner_application_tx) | Has policies | ✅ Keep — see §2.3.1 #1 |

### 1.9 Proctoring (4 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `preinterview_check_logs` | ❌ None | ✅ Active | 🔴 Locked out | Add `{service_role}` policy |
| `proctoring_sessions` | ✅ Active | ✅ Active | Has policies (12 — reduce) | ✅ Keep, consolidate |
| `proctoring_settings` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `proctoring_violations` | ✅ Active | ✅ Active | Has policies | ✅ Keep |

### 1.10 Security & Compliance (5 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `audit_logs` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `consent_records` | ✅ Active | ✅ Active | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}`** |
| `data_deletion_requests` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `data_retention_policies` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `security_events` | ✅ Active | ✅ Active | Has policies | ✅ Keep |

### 1.11 System Infrastructure (6 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `circuit_breaker_state` | ✅ Active (SystemMonitoring) | ✅ Active (check_circuit_breaker fn) | Has policies | ✅ Keep — see §2.3.1 #7 |
| `failed_jobs` | ❌ None (system infra) | ❌ None | Has policies | ✅ Keep — job retry system, see §2.3.1 #9 |
| `idempotency_keys` | ❌ None (DB-function infra) | ✅ Active (3 DB functions + generate_invoice_tx) | Has policies | ✅ Keep — see §2.3.1 #8 |
| `platform_configurations` | ✅ Active | ✅ Active | 🔴 Locked out | Add admin-only policies |
| `rate_limit_buckets` | ❌ None (DB-function infra) | ✅ Active (cleanup_rate_limit_buckets fn) | Intentional USING(false) | ✅ Keep — see §2.3.1 #10 |
| `system_config` | ✅ Active | ✅ Active | 🔴 Locked out | Add admin-only policies |

### 1.12 Users & Roles (7 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `custom_roles` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `onboarding_progress` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `profiles` | ✅ Active (core) | ✅ Active | Has policies | ✅ Keep |
| `role_permissions` | ✅ Active | ✅ Active | 🔴 Locked out | Add admin-only policies |
| `user_badges` | ✅ Active | ✅ Active | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}`** |
| `user_custom_roles` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `user_roles` | ✅ Active (core) | ✅ Active | Has policies | ✅ Keep |

### 1.13 Other / Cross-Cutting (27 tables)

| Table | Frontend Usage | Edge Function Usage | RLS Status | Recommendation |
|-------|---------------|-------------------|------------|----------------|
| `activity_feed` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `approval_workflows` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `architecture_documents` | ❌ None | ✅ Active (3 functions) | Has policies | Keep — edge-function-only |
| `assessments` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `bias_detection_results` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `candidate_performance_index` | ✅ Active | ✅ Active | 🔴 `{public}` USING(true) | **Fix RLS → `{service_role}`** |
| `chatbot_knowledge` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `collaboration_threads` | ❌ None (planned) | ⚠️ .bak only | Has policies | ✅ Keep — planned feature, see §2.3.1 #18 |
| `documentation` | ❌ None | ❌ None | Has policies | 🗑️ DROP — superseded by platform_documentation, see §2.3.1 #15 |
| `email_logs` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `email_templates` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `generated_reports` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `notifications` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `password_setup_invitations` | ✅ Active | ✅ Active | 🔴 Locked out | Add token-scoped policies |
| `platform_documentation` | ✅ Active (Documentation.tsx, Generator) | ✅ Active (3 edge fns) | Has policies | ✅ Keep — see §2.3.1 #5 |
| `platform_documentation_versions` | ✅ Active (VersionHistory, Generator) | ❌ None | Has policies | ✅ Keep — see §2.3.1 #6 |
| `promotion_applicable_orgs` | ❌ None (promotion subsystem) | ❌ None | Has policies | ✅ Keep — FK to active promotions, see §2.3.1 #11 |
| `promotion_applicable_plans` | ❌ None (promotion subsystem) | ❌ None | Has policies | ✅ Keep — FK to active promotions, see §2.3.1 #12 |
| `promotion_usages` | ❌ None (DB-function only) | ✅ Active (generate_invoice_tx) | Has policies | ✅ Keep — see §2.3.1 #13 |
| `promotions` | ✅ Active | ✅ Active | 🔴 Locked out | Add admin-only policies |
| `report_templates` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `resume_parsing_results` | ✅ Active | ✅ Active | 🔴 Locked out | Add user-scoped policies |
| `test_results` | ❌ None | ✅ Active | 🔴 Locked out | Keep — testing infrastructure |
| `test_runs` | ❌ None | ✅ Active | 🔴 Locked out | Keep — testing infrastructure |
| `test_suites` | ❌ None | ✅ Active | 🔴 Locked out | Keep — testing infrastructure |
| `training_plans` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `training_topics` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |
| `usage_tracking` | ✅ Active | ✅ Active | Has policies | ✅ Keep |
| `user_topic_progress` | ✅ Active | ✅ Active | 🔴 Locked out | Add user-scoped policies |
| `user_training_assignments` | ✅ Active | ✅ Active | 🔴 Locked out | Add org-scoped policies |

---

## 2. Classification Summary

### 2.1 Active Tables (67) — ✅ Keep
Tables with confirmed frontend AND/OR edge function usage. These are the core of the application.

### 2.2 Edge-Function-Only Tables (7) — Keep with `{service_role}` Policies

These tables are only accessed by edge functions (which use the service role key). They need RLS policies that permit only `{service_role}` access:

1. `ai_feature_health` — health monitoring (4 edge functions)
2. `ai_health_alerts` — alert insertion
3. `ai_health_checks` — health check logging
4. `analytics_snapshots` — analytics data (3 edge functions)
5. `architecture_documents` — architecture doc generation (3 edge functions)
6. `comparative_analytics` — comparative reports (3 edge functions)
7. `predictive_analytics` — predictive analytics insertion

### 2.3 ⚠️ REVISED CLASSIFICATION — "Dead" Tables Re-Audit (March 2026)

> **Previous audit error**: The initial audit marked 15 tables as "truly dead" and 3 as "effectively dead".
> A thorough re-audit found that **only 1 table is truly dead**. The remaining 17 tables have active
> frontend code, database functions, FK dependencies, or serve as infrastructure for planned features.

---

#### 2.3.1 Table-by-Table Re-Audit Results

##### 1. `partner_applications` — ✅ **KEEP (ACTIVELY USED)**

**Previous classification**: Truly dead | **Revised**: ACTIVE — core partner onboarding flow

| Attribute | Detail |
|-----------|--------|
| **Schema** | 21 columns: org details, applicant_user_id, status workflow (pending→approved→rejected→revision_requested), reviewer fields, contact info, selected_plan_id |
| **FKs FROM this table** | → `organizations(id)` ON DELETE CASCADE, → `subscription_plans(id)`, → `auth.users(id)` |
| **FKs TO this table** | None (no child tables) |
| **Indexes** | PK only |
| **Triggers** | None |
| **DB Functions** | `approve_partner_application_tx()` — full transactional approval flow that creates orgs, subscriptions, org members, and assigns roles |
| **RLS Policies** | 4 policies: users can create/view/update own, platform_admins can manage all |
| **Frontend Usage** | `PlatformAdminHub.tsx` (4 queries: list, count pending, approve, reject), `Auth.tsx` (partner registration check) |
| **Types** | ✅ Full type definitions in types.ts |

**Why it was misclassified**: Search likely missed the PlatformAdminHub.tsx and Auth.tsx references.

---

##### 2. `payment_gateways` — ✅ **KEEP (ACTIVELY USED — Payment Infrastructure)**

**Previous classification**: Truly dead | **Revised**: ACTIVE — payment gateway configuration

| Attribute | Detail |
|-----------|--------|
| **Schema** | 16 columns: gateway_name, display_name, is_enabled, is_test_mode, encrypted test/live key pairs, webhook_secret_encrypted, supported_currencies[], config jsonb |
| **FKs FROM this table** | → `auth.users(id)` (updated_by) |
| **FKs TO this table** | None directly (but referenced by `is_payment_enabled()` function) |
| **Indexes** | PK only |
| **Triggers** | `update_payment_gateways_updated_at` |
| **DB Functions** | `is_payment_enabled(text)` — checks gateway config and key presence |
| **RLS Policies** | `Platform admins can manage payment gateways` |
| **Frontend Usage** | `PaymentGatewayManagement.tsx` (3 queries: list, update config, toggle), `usePaymentGateway.ts` hook (checks gateway status), used by `LearningPricing.tsx` |
| **Routing** | App.tsx: `<Route path="payment-gateways" element={<PaymentGatewayManagement />} />` |
| **Types** | ✅ Full type definitions in types.ts |

**Why it was misclassified**: Search missed the dedicated management page and hook.

---

##### 3. `payment_methods` — ✅ **KEEP (FK dependency + Payment Infrastructure)**

**Previous classification**: Truly dead | **Revised**: KEEP — Stripe payment method storage

| Attribute | Detail |
|-----------|--------|
| **Schema** | 11 columns: organization_id, stripe_payment_method_id, stripe_customer_id, card_brand, card_last4, card_exp_month/year, is_default |
| **FKs FROM this table** | → `organizations(id)` ON DELETE CASCADE |
| **FKs TO this table** | ← `payment_transactions(payment_method_id)` ON DELETE SET NULL |
| **Indexes** | idx_payment_methods_default, idx_payment_methods_org |
| **Triggers** | `update_payment_methods_updated_at` |
| **RLS Policies** | 3 policies: authorized users can view, org admins can manage, org-scoped policy |
| **Frontend Usage** | No direct `.from('payment_methods')` calls yet, but `payment_transactions` FK references it |
| **Types** | ✅ Full type definitions in types.ts |

**Cannot DROP**: `payment_transactions` has FK `payment_method_id → payment_methods(id)`. Dropping would break the FK or require CASCADE.

---

##### 4. `payment_transactions` — ✅ **KEEP (ACTIVELY USED)**

**Previous classification**: Truly dead | **Revised**: ACTIVE — transaction monitoring + org cleanup

| Attribute | Detail |
|-----------|--------|
| **Schema** | 13 columns: organization_id, invoice_id, stripe_charge_id, amount_cents, currency, status, payment_method_id, failure_reason, receipt_url, idempotency_key |
| **FKs FROM this table** | → `organizations(id)` CASCADE, → `invoices(id)` SET NULL, → `payment_methods(id)` SET NULL |
| **FKs TO this table** | None |
| **Indexes** | idx_payment_transactions_invoice, idx_payment_transactions_org, idx_payment_transactions_status |
| **Triggers** | `update_payment_transactions_updated_at` |
| **DB Functions** | Referenced in `delete_organization_cascade_tx()` — `DELETE FROM payment_transactions WHERE organization_id = p_organization_id` |
| **RLS Policies** | 3 policies: platform admins + org members can view, org admins can manage, org-scoped |
| **Frontend Usage** | `SystemMonitoring.tsx:210` — queries failed payment transactions for dashboard metrics |
| **Types** | ✅ Full type definitions in types.ts |

---

##### 5. `platform_documentation` — ✅ **KEEP (ACTIVELY USED — Documentation System)**

**Previous classification**: Truly dead | **Revised**: ACTIVE — AI-powered documentation platform

| Attribute | Detail |
|-----------|--------|
| **Schema** | 16 columns: title, content, category, status (draft/review/published), prompt_used, source_files jsonb, file_hashes jsonb, is_ai_generated, needs_regeneration, version_number |
| **FKs FROM this table** | → `auth.users(id)` (created_by) ON DELETE SET NULL |
| **FKs TO this table** | ← `platform_documentation_versions(document_id)` ON DELETE CASCADE |
| **Indexes** | 5 indexes: category, status, created_by, is_ai_generated, needs_regeneration |
| **Triggers** | None |
| **RLS Policies** | 4 policies: platform admins can create/view/update/delete |
| **Frontend Usage** | `Documentation.tsx` (5 queries: select, insert, update, upsert), `DocumentationGenerator.tsx` (4 queries) |
| **Edge Functions** | `generate-documentation-from-code`, `generate-documentation`, `improve-documentation-format` (3 edge functions support this table) |
| **Types** | ✅ Full type definitions in types.ts |

**Why it was misclassified**: Catastrophic miss — this is an entire feature with a dedicated page, 3 edge functions, and 9+ queries.

---

##### 6. `platform_documentation_versions` — ✅ **KEEP (ACTIVELY USED — Version History)**

**Previous classification**: Truly dead | **Revised**: ACTIVE — documentation version tracking

| Attribute | Detail |
|-----------|--------|
| **Schema** | 9 columns: document_id, version_number, title, content, category, changes_summary, created_by, created_at |
| **FKs FROM this table** | → `platform_documentation(id)` ON DELETE CASCADE, → `auth.users(id)` |
| **FKs TO this table** | None |
| **Indexes** | idx_doc_versions_created_at (DESC), idx_doc_versions_document_id |
| **RLS Policies** | 2 policies: platform admins can create versions, platform admins can view all versions |
| **Frontend Usage** | `DocumentVersionHistory.tsx:54`, `DocumentationGenerator.tsx:192` |
| **Types** | ✅ Full type definitions in types.ts |

---

##### 7. `circuit_breaker_state` — ✅ **KEEP (ACTIVELY USED — System Monitoring)**

**Previous classification**: Truly dead | **Revised**: ACTIVE — resilience pattern infrastructure

| Attribute | Detail |
|-----------|--------|
| **Schema** | 14 columns: service_name, state (closed/open/half_open), failure_count, success_count, failure/success thresholds, timeout_seconds, timestamp fields |
| **FKs FROM this table** | None |
| **FKs TO this table** | None |
| **Indexes** | idx_circuit_breaker_service |
| **Triggers** | `update_circuit_breaker_updated_at` |
| **DB Functions** | `check_circuit_breaker(text)` — full circuit breaker state machine (closed→open→half_open transitions) |
| **RLS Policies** | `Platform admins can manage circuit breaker state` |
| **Frontend Usage** | `SystemMonitoring.tsx:332` — `.from('circuit_breaker_state')` |
| **Types** | ✅ Full type definitions in types.ts |

---

##### 8. `idempotency_keys` — ✅ **KEEP (DB Function Infrastructure — Invoice Safety)**

**Previous classification**: Truly dead | **Revised**: KEEP — critical idempotency infrastructure

| Attribute | Detail |
|-----------|--------|
| **Schema** | 10 columns: key, operation_type, resource_id, request_hash, response jsonb, status (pending/completed/failed), expires_at (24h default), completed_at |
| **FKs FROM this table** | None |
| **FKs TO this table** | None |
| **Indexes** | idx_idempotency_keys_expires (partial: status=pending), idx_idempotency_keys_key, idx_idempotency_keys_operation |
| **Triggers** | None |
| **DB Functions** | 3 functions: `acquire_idempotency_lock(text,text,text)`, `complete_idempotency(uuid,uuid,jsonb,boolean)`, `cleanup_expired_idempotency_keys()`. Also referenced by `generate_invoice_tx()` (idempotency_key parameter) |
| **RLS Policies** | `Platform admins can manage idempotency keys` |
| **Frontend Usage** | None directly (DB-function-only infrastructure) |
| **Supabase Types** | ✅ Types + `cleanup_expired_idempotency_keys` function type |

**Business purpose**: Prevents duplicate invoice generation and other critical operations. The `generate_invoice_tx()` function uses idempotency keys to prevent double-billing. Dropping this table would break invoice safety.

---

##### 9. `failed_jobs` — ✅ **KEEP (System Infrastructure — Job Retry System)**

**Previous classification**: Truly dead | **Revised**: KEEP — job failure tracking and retry system

| Attribute | Detail |
|-----------|--------|
| **Schema** | 18 columns: job_type, job_id, payload jsonb, error_message, error_stack, error_code, attempt_count, max_attempts, status, next_retry_at, organization_id, user_id, source_function, correlation_id |
| **FKs FROM this table** | → `organizations(id)` ON DELETE SET NULL |
| **FKs TO this table** | None |
| **Indexes** | 5 indexes: created_at DESC, job_type, next_retry_at (partial: status=failed), organization_id, status |
| **Triggers** | `update_failed_jobs_updated_at` |
| **RLS Policies** | `Platform admins can manage failed jobs` |
| **Frontend Usage** | None directly (system infrastructure) |
| **Types** | ✅ Full type definitions in types.ts |

**Business purpose**: Standard job failure tracking pattern. The rich schema (retry logic, correlation IDs, source function tracking) indicates a well-designed system for background job monitoring. Needed for edge function failure recovery.

---

##### 10. `rate_limit_buckets` — ✅ **KEEP (DB Function Infrastructure — API Rate Limiting)**

**Previous classification**: Truly dead | **Revised**: KEEP — rate limiting infrastructure

| Attribute | Detail |
|-----------|--------|
| **Schema** | 8 columns: identifier, endpoint, window_start, request_count, max_requests (default 60), window_seconds (default 60) |
| **FKs FROM this table** | None |
| **FKs TO this table** | None |
| **Indexes** | idx_rate_limit_cleanup (window_start), idx_rate_limit_lookup (identifier, endpoint) |
| **Triggers** | None |
| **DB Functions** | `cleanup_rate_limit_buckets()` — deletes expired windows (>1 hour old) |
| **RLS Policies** | `Service role only for rate limits` — USING(false) WITH CHECK(false), meaning only service_role can access |
| **Supabase Types** | ✅ Types + `cleanup_rate_limit_buckets` function type |

**Business purpose**: Server-side rate limiting at the database level. The `USING(false)` policy is intentional — only service_role (edge functions) should write to this. Dropping would remove the rate limiting infrastructure.

---

##### 11. `promotion_applicable_orgs` — ✅ **KEEP (Promotions Subsystem — FK to Active Parent)**

**Previous classification**: Truly dead | **Revised**: KEEP — join table for org-scoped promotions

| Attribute | Detail |
|-----------|--------|
| **Schema** | 4 columns: id, promotion_id, organization_id, created_at |
| **FKs FROM this table** | → `promotions(id)` ON DELETE CASCADE, → `organizations(id)` ON DELETE CASCADE |
| **FKs TO this table** | None |
| **Constraints** | UNIQUE(promotion_id, organization_id) |
| **RLS Policies** | 3 policies: org members can view, platform admins can manage |

**Business purpose**: The `promotions` table is actively used in `PromotionManagement.tsx`. This is the join table that scopes promotions to specific organizations (e.g., "partner_specific" promotion type). Dropping would break the promotions feature's org-scoping capability.

---

##### 12. `promotion_applicable_plans` — ✅ **KEEP (Promotions Subsystem — FK to Active Parent)**

**Previous classification**: Truly dead | **Revised**: KEEP — join table for plan-scoped promotions

| Attribute | Detail |
|-----------|--------|
| **Schema** | 4 columns: id, promotion_id, plan_id, created_at |
| **FKs FROM this table** | → `promotions(id)` ON DELETE CASCADE, → `subscription_plans(id)` ON DELETE CASCADE |
| **FKs TO this table** | None |
| **Constraints** | UNIQUE(promotion_id, plan_id) |
| **RLS Policies** | 2 policies: anyone can view, platform admins can manage |

**Business purpose**: Scopes promotions to specific subscription plans. Part of the active promotions subsystem.

---

##### 13. `promotion_usages` — ✅ **KEEP (ACTIVELY USED in DB Functions)**

**Previous classification**: Truly dead | **Revised**: ACTIVE — promotion tracking, used by invoice generation

| Attribute | Detail |
|-----------|--------|
| **Schema** | 8 columns: promotion_id, organization_id, subscription_id, applied_at, discount_applied_cents, original_amount_cents, final_amount_cents |
| **FKs FROM this table** | → `promotions(id)` CASCADE, → `organizations(id)` CASCADE, → `organization_subscriptions(id)` |
| **FKs TO this table** | None |
| **Indexes** | idx_promotion_usages_org, idx_promotion_usages_promotion |
| **DB Functions** | Written to by `generate_invoice_tx()` (both overloads) — records promotion usage when invoice is generated. Cleaned up by `delete_organization_cascade_tx()` |
| **RLS Policies** | 3 policies: org members can view, platform admins can manage, service role can insert |

**Business purpose**: Tracks promotion redemptions and discount amounts. Critical for billing accuracy — the `generate_invoice_tx()` function INSERT INTO promotion_usages on every discounted invoice.

---

##### 14. `ai_model_configurations` — ✅ **KEEP (Planned Feature — AI Model A/B Testing)**

**Previous classification**: Truly dead | **Revised**: KEEP — planned AI model management feature

| Attribute | Detail |
|-----------|--------|
| **Schema** | 14 columns: feature_name, edge_function, primary_model, fallback_model, is_ab_testing, ab_test_split_percentage (0-100 constraint), ab_test_model, max_retries, retry_delay_ms, timeout_ms, enabled |
| **FKs FROM this table** | None |
| **FKs TO this table** | None |
| **Indexes** | idx_ai_model_configurations_enabled, idx_ai_model_configurations_feature |
| **Triggers** | `update_ai_model_configurations_updated_at` |
| **RLS Policies** | 3 policies: platform admins can manage/view, admin policy |
| **Frontend Usage** | None yet |
| **Types** | ✅ Full type definitions in types.ts |

**Business purpose**: Well-designed A/B testing infrastructure for AI models. Complements the active `ai_feature_configurations` and `ai_model_performance` tables. Schema is production-ready with proper constraints, indexes, triggers, and RLS. This is a planned feature awaiting frontend implementation.

---

##### 15. `documentation` — 🗑️ **SAFE TO DROP (Superseded by `platform_documentation`)**

**Previous classification**: Truly dead | **Revised**: SAFE TO DROP — replaced by platform_documentation

| Attribute | Detail |
|-----------|--------|
| **Schema** | 8 columns: title, description, category, file_path, version (default '1.0'), created_by |
| **FKs FROM this table** | → `auth.users(id)` (created_by) |
| **FKs TO this table** | None |
| **Indexes** | PK only |
| **Triggers** | None |
| **RLS Policies** | 2 policies: admins can manage, anonymous denied |
| **Frontend Usage** | ❌ None (no `.from('documentation')` calls) |
| **Edge Functions** | ❌ None |
| **Storage Bucket** | A `documentation` storage bucket exists but it stores PDFs — unrelated to this table |

**Why SAFE TO DROP**: `platform_documentation` is the actively used successor with 16 columns (vs 8), AI generation support, versioning, and 9+ frontend queries. The `documentation` table is a simpler prototype that was superseded. No FK dependencies prevent dropping.

---

##### 16. `ai_feature_alerts` — ✅ **KEEP (AI Monitoring — Has RLS + Indexes)**

**Previous classification**: Effectively dead (.bak only) | **Revised**: KEEP — AI alerting infrastructure

| Attribute | Detail |
|-----------|--------|
| **Schema** | 8 columns: feature_name, alert_type (failure/degraded_performance/recovery), severity (critical/warning/info), message, notified_admins uuid[], resolved_at |
| **FKs** | None in either direction |
| **Indexes** | 4 indexes: created_at, feature_name, resolved_at (partial: NULL), severity |
| **RLS Policies** | 3 policies: platform admins can manage/view alerts, admin policy |
| **Frontend Usage** | None in active code (referenced in .bak cleanup function) |
| **Types** | ✅ Full type definitions in types.ts |

**Business purpose**: Companion to the active `ai_feature_health` and `ai_health_alerts` tables. The 4 optimized indexes and 3 RLS policies show this was carefully designed. It's the alerting layer for the AI monitoring system — which is actively used via edge functions. Restoring the .bak file would activate frontend monitoring dashboards.

---

##### 17. `ai_health_monitoring` — ✅ **KEEP (AI Monitoring — Has RLS + Indexes)**

**Previous classification**: Effectively dead (.bak only) | **Revised**: KEEP — AI health check logging

| Attribute | Detail |
|-----------|--------|
| **Schema** | 8 columns: feature_name, edge_function, status (healthy/degraded/failed), response_time_ms, error_message, checked_at |
| **FKs** | None in either direction |
| **Indexes** | 4 indexes: checked_at, checked_at DESC, feature_name, status |
| **RLS Policies** | 2 policies: platform admins can view, admin policy |
| **Frontend Usage** | None in active code (referenced in .bak cleanup function) |
| **Types** | ✅ Full type definitions in types.ts |

**Business purpose**: Time-series health check data for AI features. The dual checked_at indexes (ASC and DESC) suggest it was designed for both recent-first dashboards and cleanup queries. Complements the active `ai_health_checks` table.

---

##### 18. `collaboration_threads` — ✅ **KEEP (Planned Feature — Threaded Discussion System)**

**Previous classification**: Effectively dead (.bak only) | **Revised**: KEEP — planned collaboration feature

| Attribute | Detail |
|-----------|--------|
| **Schema** | 11 columns: entity_type, entity_id (polymorphic), parent_id (self-referencing for thread nesting), author_id, content, mentions uuid[], is_resolved, attachments jsonb |
| **FKs FROM this table** | → `auth.users(id)` (author_id), → `collaboration_threads(id)` (parent_id — self-referencing for nested replies) |
| **FKs TO this table** | ← Self-reference from parent_id |
| **Indexes** | idx_threads_entity (entity_type, entity_id) |
| **RLS Policies** | `Platform admins and org members can collaborate` — policy checks interview ownership |
| **Frontend Usage** | None in active code (referenced in .bak cleanup function) |
| **Types** | ✅ Full type definitions with FK relationships in types.ts |

**Business purpose**: A threaded discussion system designed to attach to any entity (interviews, candidates, etc.) via polymorphic entity_type/entity_id. The self-referencing parent_id enables nested replies. Mentions array enables @-mentions. This is a well-designed planned feature for collaborative hiring workflows.

---

#### 2.3.2 Revised Classification Summary

| # | Table | Previous | Revised | Reason |
|---|-------|----------|---------|--------|
| 1 | `partner_applications` | 🗑️ DROP | ✅ **ACTIVE** | 4 queries in PlatformAdminHub + Auth.tsx + DB function |
| 2 | `payment_gateways` | 🗑️ DROP | ✅ **ACTIVE** | Management page + hook + DB function + App.tsx route |
| 3 | `payment_methods` | 🗑️ DROP | ✅ **KEEP (FK dep)** | FK from payment_transactions + RLS policies |
| 4 | `payment_transactions` | 🗑️ DROP | ✅ **ACTIVE** | SystemMonitoring.tsx + delete_organization_cascade_tx |
| 5 | `platform_documentation` | 🗑️ DROP | ✅ **ACTIVE** | Documentation.tsx (5 queries) + DocumentationGenerator.tsx (4 queries) + 3 edge functions |
| 6 | `platform_documentation_versions` | 🗑️ DROP | ✅ **ACTIVE** | DocumentVersionHistory.tsx + DocumentationGenerator.tsx + FK to platform_documentation |
| 7 | `circuit_breaker_state` | 🗑️ DROP | ✅ **ACTIVE** | SystemMonitoring.tsx + check_circuit_breaker() DB function |
| 8 | `idempotency_keys` | 🗑️ DROP | ✅ **KEEP (infra)** | 3 DB functions + used by generate_invoice_tx() |
| 9 | `failed_jobs` | 🗑️ DROP | ✅ **KEEP (infra)** | Trigger + 5 indexes + RLS + FK to organizations |
| 10 | `rate_limit_buckets` | 🗑️ DROP | ✅ **KEEP (infra)** | DB cleanup function + intentional USING(false) policy |
| 11 | `promotion_applicable_orgs` | 🗑️ DROP | ✅ **KEEP (FK)** | FK to active promotions + organizations + RLS policies |
| 12 | `promotion_applicable_plans` | 🗑️ DROP | ✅ **KEEP (FK)** | FK to active promotions + subscription_plans + RLS policies |
| 13 | `promotion_usages` | 🗑️ DROP | ✅ **ACTIVE** | Written by generate_invoice_tx() + cleaned by delete_org cascade |
| 14 | `ai_model_configurations` | 🗑️ DROP | ✅ **KEEP (planned)** | A/B testing infra with trigger + indexes + 3 RLS policies |
| 15 | `documentation` | 🗑️ DROP | 🗑️ **SAFE TO DROP** | Superseded by platform_documentation — no usage, no FK deps |
| 16 | `ai_feature_alerts` | 🗑️ DROP | ✅ **KEEP (planned)** | 4 indexes + 3 RLS policies + part of AI monitoring system |
| 17 | `ai_health_monitoring` | 🗑️ DROP | ✅ **KEEP (planned)** | 4 indexes + 2 RLS policies + AI health check logging |
| 18 | `collaboration_threads` | 🗑️ DROP | ✅ **KEEP (planned)** | Self-referencing FK + polymorphic design + RLS policy |

**Score: Previous audit was wrong on 17 of 18 tables.** Only `documentation` is truly safe to drop.

#### 2.3.3 Root Cause of Misclassification

The original audit failed because:
1. **Incomplete grep**: Did not search `PlatformAdminHub.tsx`, `PaymentGatewayManagement.tsx`, `Documentation.tsx`, `DocumentationGenerator.tsx`, `DocumentVersionHistory.tsx`, `SystemMonitoring.tsx`, `LearningPricing.tsx`, `Auth.tsx`
2. **Ignored DB functions**: Did not check `approve_partner_application_tx()`, `is_payment_enabled()`, `check_circuit_breaker()`, `acquire_idempotency_lock()`, `generate_invoice_tx()`, `cleanup_rate_limit_buckets()`
3. **Ignored FK relationships**: Did not check that `payment_transactions` → `payment_methods`, `platform_documentation_versions` → `platform_documentation`, promotion tables → `promotions` + `organizations`
4. **Dismissed .bak as dead**: The .bak file is a cleanup utility, not the only usage — the tables have full RLS policies, indexes, and type definitions indicating planned feature status

**⚠️ Pre-DROP Checklist** (for `documentation` table only):
1. Run `SELECT count(*) FROM documentation` on production
2. Verify no data exists worth preserving
3. DROP in a migration with `IF EXISTS`

---

## 3. Locked-Out Tables — Full List (42)

These tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` but zero `CREATE POLICY` statements. This means **no user can access them via the Supabase REST API** — queries silently return empty results.

### Learning System (11)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 1 | `learning_assessments` | Org members can SELECT; org_admin/hiring_manager can INSERT/UPDATE/DELETE |
| 2 | `learning_assessment_attempts` | User can SELECT/INSERT own; org_admin can SELECT all in org |
| 3 | `learning_assessment_feedback` | User can SELECT own; evaluator can INSERT; org_admin full |
| 4 | `learning_assessment_questions` | Org members can SELECT; org_admin can manage |
| 5 | `learning_assessment_usage` | User can SELECT/INSERT own; org_admin can SELECT all |
| 6 | `learning_materials` | Org members can SELECT; org_admin can manage |
| 7 | `learning_payments` | User can SELECT own; billing_admin can manage |
| 8 | `learning_plans` | Org members can SELECT; org_admin can manage |
| 9 | `learning_subscriptions` | User can SELECT own; billing_admin can manage |
| 10 | `training_plans` | Org members can SELECT; org_admin can manage |
| 11 | `training_topics` | Org members can SELECT; org_admin can manage |

### Interview Panel System (3)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 12 | `interview_panel_members` | Panel members can SELECT own; org_admin can manage |
| 13 | `panel_consensus` | Panel members can SELECT/INSERT; org_admin full |
| 14 | `panel_evaluations` | Panel members can SELECT/INSERT own; org_admin full |

### Payments & Billing (3)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 15 | `organization_subscriptions` | Org members can SELECT; billing_admin can manage |
| 16 | `payment_gateways` | ✅ Has policies — platform_admin can manage (see §2.3.1 #2) |
| 17 | `payment_methods` | ✅ Has policies — org admin + billing_contact can manage |
| 18 | `payment_transactions` | ✅ Has policies — platform/org admins can manage |

### Platform Admin Only (5)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 19 | `platform_configurations` | platform_admin can SELECT/UPDATE |
| 20 | `platform_documentation` | ✅ Has policies — actively used (see §2.3.1 #5) |
| 21 | `platform_documentation_versions` | ✅ Has policies — actively used (see §2.3.1 #6) |
| 22 | `system_config` | platform_admin can SELECT/UPDATE |
| 23 | `role_permissions` | platform_admin can manage; all authenticated can SELECT |

### Promotions System (4)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 24 | `promotions` | platform_admin can manage; all authenticated can SELECT active |
| 25 | `promotion_applicable_orgs` | ✅ Has policies — promotion subsystem (see §2.3.1 #11) |
| 26 | `promotion_applicable_plans` | ✅ Has policies — promotion subsystem (see §2.3.1 #12) |
| 27 | `promotion_usages` | ✅ Has policies — used by generate_invoice_tx (see §2.3.1 #13) |

### User Training & Progress (3)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 28 | `user_custom_roles` | User can SELECT own; org_admin can manage |
| 29 | `user_topic_progress` | User can SELECT/UPDATE own; org_admin can SELECT all |
| 30 | `user_training_assignments` | User can SELECT own; org_admin can manage |

### Operations & Monitoring (4)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 31 | `interview_operation_logs` | service_role only (edge function writes) |
| 32 | `predictive_analytics` | service_role only (edge function writes) |
| 33 | `preinterview_check_logs` | service_role only (edge function writes) |
| 34 | `rate_limit_buckets` | ✅ Intentional USING(false) — service_role only (see §2.3.1 #10) |

### Other (8)
| # | Table | Recommended Policy Pattern |
|---|-------|---------------------------|
| 35 | `partner_applications` | ✅ Has policies — actively used (see §2.3.1 #1) |
| 36 | `password_setup_invitations` | service_role can manage; token-based SELECT for setup flow |
| 37 | `report_templates` | Org members can SELECT; org_admin can manage |
| 38 | `resume_parsing_results` | User can SELECT own; org_admin can SELECT all in org |
| 39 | `test_results` | service_role only (testing infrastructure) |
| 40 | `test_runs` | service_role only (testing infrastructure) |
| 41 | `test_suites` | service_role only (testing infrastructure) |
| 42 | `email_verification_tokens` | Has policies (may have been added in later migration) |

---

## 4. Action Items

| Priority | Action | Count | Effort |
|----------|--------|-------|--------|
| 🔴 P0 | Fix 8 `{public}` USING(true) policies | 8 tables | 1 hour |
| 🔴 P0 | Fix 12 open INSERT on `{public}` | 12 policies | 2 hours |
| 🟠 P1 | Add policies for locked-out tables (non-dead) | ~27 tables | 1–2 days |
| 🟠 P1 | Remove 58 duplicate policies | 58 policies | 4 hours |
| 🟡 P2 | DROP 1 dead table (`documentation`) | 1 table | 30 min |
| 🟡 P2 | Change 68 `{public}` → `{authenticated}` | 68 policies | 4 hours |
| 🟢 P3 | Add `{service_role}` policies for 7 edge-function-only tables | 7 tables | 1 hour |

*Total estimated effort: 3–4 days for full database security remediation.*
