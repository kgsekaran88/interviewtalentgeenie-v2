# Production Migration Gap Analysis - FINAL AUDIT

## Generated: 2024-12-27 (Deep Scan Complete)

---

## ⚠️ CRITICAL GAPS IDENTIFIED

| Category | Lovable Cloud (Actual) | Migration Files | Status | Gap Details |
|----------|----------------------|-----------------|--------|-------------|
| **Tables** | 105 | 105 | ✅ COMPLETE | All tables present |
| **Functions** | 109 | **❌ FILE MISSING** | 🔴 CRITICAL | `PRODUCTION_FUNCTIONS_MIGRATION.sql` not created |
| **RLS Policies** | 330 | 305 (stated in file) | 🟠 MISMATCH | 25 policies missing |
| **Indexes** | 377 (incl PKs) | ~120 custom | ✅ OK | Primary key indexes auto-created |
| **Triggers** | 60+ | 60+ | ✅ COMPLETE | All triggers present |
| **Storage Buckets** | 4 | 4 | ✅ COMPLETE | All buckets defined |
| **Storage Policies** | 15 | 15 | ✅ COMPLETE | All storage policies defined |
| **Enums** | 1 (app_role) | 1 | ✅ COMPLETE | All 12 values present |

---

## 🔴 CRITICAL GAP #1: Missing Functions Migration

**File:** `docs/PRODUCTION_FUNCTIONS_MIGRATION.sql`
**Status:** NOT CREATED
**Impact:** Database will be missing all 109 business logic functions

### Functions Required (109 total):

**Idempotency & Resilience:**
- acquire_idempotency_lock, complete_idempotency, cleanup_expired_idempotency_keys
- check_circuit_breaker, record_circuit_failure, record_circuit_success
- check_rate_limit, cleanup_rate_limit_buckets
- enqueue_failed_job, get_retryable_jobs, mark_job_recovered, mark_job_retry_failed, mark_job_retrying, get_failed_job_stats

**Authentication & Roles:**
- assign_guest_role_on_signup, handle_new_user
- has_role, has_any_role, has_any_role_with_hierarchy, has_role_in_org, has_custom_role, has_action_permission
- get_user_roles, get_custom_role_permissions, is_global_tech_spoc, is_role_org_scoped
- user_is_org_admin, user_is_org_member, can_access_org_data, get_tech_spocs_for_org
- check_user_exists, check_multi_org_membership

**Interview & Assessment:**
- create_interview_attempt, create_interview_attempt_with_invitation
- get_questions_for_attempt, get_random_questions_for_attempt, get_interview_for_candidate, get_attempt_by_session
- update_attempt_with_session, terminate_attempt_with_session, finalize_proctored_submission
- auto_evaluate_interview, trigger_auto_evaluate, save_interview_evaluation_tx
- prepare_question_regeneration_tx, increment_question_selection_counts
- can_access_interview, can_view_interview_attempts
- delete_interview_tx

**Certification:**
- save_certification_evaluation_tx, can_user_retake_certification
- check_and_award_badges, check_daily_free_assessment_limit
- get_active_learning_subscription, get_assessment_questions_for_attempt
- verify_certificate_by_code

**Organization & Billing:**
- approve_partner_application_tx, delete_organization_tx, setup_user_tx, delete_user_cascade_tx (2 versions)
- generate_invoice_number, generate_invoice_tx (2 versions)
- is_payment_enabled, increment_interview_usage, increment_interviews_used
- update_subscription_interview_usage, update_usage_tracking

**Proctoring:**
- auto_close_proctoring_on_submission, auto_close_expired_proctoring_sessions
- complete_invitation_on_submission, toggle_violation_ignored
- cleanup_old_proctoring_recordings

**Utilities:**
- generate_slug, generate_certificate_number, generate_verification_code
- generate_session_token, generate_share_token
- calculate_cpi_score, create_notification
- encrypt_api_key, decrypt_api_key, encrypt_api_key_trigger
- soft_delete, soft_restore, optimistic_update
- check_rls_enabled, execute_data_retention_cleanup

**AI & Architecture:**
- track_ai_usage, log_assessment_changes
- check_architecture_docs_status, mark_architecture_docs_outdated
- initialize_onboarding_progress

**Triggers:**
- update_updated_at_column, update_ai_config_updated_at, update_ai_health_updated_at
- update_ai_model_config_updated_at, update_platform_config_updated_at
- update_certification_topics_updated_at, update_chatbot_knowledge_updated_at
- update_invoice_updated_at, update_proctoring_sessions_updated_at
- update_role_permissions_updated_at, update_test_suites_updated_at
- auto_set_interview_organization, set_interview_slug, set_organization_slug

---

## 🟠 CRITICAL GAP #2: RLS Policy Count Mismatch

**File:** `docs/PRODUCTION_RLS_POLICIES_MIGRATION.sql`
**File Header States:** 305 policies
**Lovable Cloud Actual:** 330 policies
**Gap:** 25 policies missing

### Tables with Most Policies (need verification):
| Table | Actual Count |
|-------|-------------|
| interview_attempts | 14 |
| proctoring_sessions | 12 |
| user_roles | 11 |
| questions | 9 |
| interviews | 8 |
| interview_invitations | 8 |
| certificates | 7 |
| profiles | 7 |

---

## 📁 FILE LOCATION ISSUE

**Current Location:** All production migration files are in `docs/` folder
**Expected for DB Push:** Files should be in `supabase/migrations/` folder

### Files in docs/ folder:
- ✅ PRODUCTION_COMPLETE_MIGRATION.sql (Tables, Enums, Basic Functions)
- ❌ PRODUCTION_FUNCTIONS_MIGRATION.sql (MISSING - All 109 functions)
- ✅ PRODUCTION_INDEXES_MIGRATION.sql (All indexes)
- ⚠️ PRODUCTION_RLS_POLICIES_MIGRATION.sql (305 of 330 policies)
- ✅ PRODUCTION_TRIGGERS_MIGRATION.sql (All triggers)
- ✅ PRODUCTION_STORAGE_MIGRATION.sql (4 buckets, 15 policies)

### Files in supabase/migrations/ folder:
- 20251226124621_complete_baseline.sql
- 20251226152139_*.sql
- 20251226152247_*.sql
- 20251226152341_*.sql

---

## 📋 ACTION ITEMS TO ACHIEVE 100% PARITY

### Priority 1 - BLOCKING:
1. **CREATE** `docs/PRODUCTION_FUNCTIONS_MIGRATION.sql` with all 109 functions from Lovable Cloud
2. **UPDATE** `docs/PRODUCTION_RLS_POLICIES_MIGRATION.sql` to include all 330 policies (currently 305)

### Priority 2 - CLARIFICATION NEEDED:
3. **DECIDE** migration file location strategy:
   - Option A: Keep in `docs/` for manual deployment to external Supabase
   - Option B: Convert to proper `supabase/migrations/` format for `supabase db push`

---

## ✅ VERIFIED COMPLETE SECTIONS

### Tables (105/105) ✅
All tables verified present in PRODUCTION_COMPLETE_MIGRATION.sql

### Enum Types (1/1) ✅
- `app_role`: admin, hr, interviewer, contributor, candidate, guest, platform_admin, partner_admin, hr_recruiter, ta_creator, billing_contact, tech_spoc

### Storage Buckets (4/4) ✅
- certificates (public)
- consent-documents (private)
- documentation (private)
- proctoring-recordings (private)

### Storage Policies (15/15) ✅
All storage policies defined in PRODUCTION_STORAGE_MIGRATION.sql

### Triggers (60+/60+) ✅
All triggers defined in PRODUCTION_TRIGGERS_MIGRATION.sql

---

## EXECUTION ORDER (When Complete)

```bash
# 1. Tables, Enums, Basic Functions
psql -f docs/PRODUCTION_COMPLETE_MIGRATION.sql

# 2. All Database Functions (NEEDS CREATION)
psql -f docs/PRODUCTION_FUNCTIONS_MIGRATION.sql

# 3. All Indexes
psql -f docs/PRODUCTION_INDEXES_MIGRATION.sql

# 4. All RLS Policies (NEEDS UPDATE - 330 policies)
psql -f docs/PRODUCTION_RLS_POLICIES_MIGRATION.sql

# 5. All Triggers
psql -f docs/PRODUCTION_TRIGGERS_MIGRATION.sql

# 6. Storage Buckets and Policies
psql -f docs/PRODUCTION_STORAGE_MIGRATION.sql
```

---

## VERIFICATION QUERIES

After running all migrations, verify with:

```sql
-- Tables (should be 105)
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Functions (should be 109)
SELECT COUNT(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- RLS Policies (should be 330)
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';

-- Indexes (should be ~377)
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';

-- Storage Buckets (should be 4)
SELECT COUNT(*) FROM storage.buckets;

-- Storage Policies (should be 15)
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage';
```
