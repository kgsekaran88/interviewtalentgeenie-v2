# Production Migration Checklist

## CRITICAL: Pre-Migration Verification

Before deploying to production, verify ALL of the following:

---

## 1. Database Objects Audit

### Tables (100 total required)
Run this query to verify all tables exist:
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Expected: 100
```

<details>
<summary>Complete Table List (100 tables)</summary>

```
activity_feed, ai_coach_sessions, ai_feature_alerts, ai_feature_configurations,
ai_feature_health, ai_health_alerts, ai_health_checks, ai_health_monitoring,
ai_model_configurations, ai_model_performance, ai_provider_credentials, ai_providers,
ai_usage_logs, analytics_snapshots, approval_workflows, architecture_documents,
assessments, ats_candidates, ats_integrations, ats_sync_logs, attempt_questions,
audit_logs, bias_detection_results, candidate_performance_index, certificate_badges,
certificates, certification_assessments, certification_attempts, certification_global_config,
certification_topics, chatbot_knowledge, collaboration_threads, comparative_analytics,
consent_records, custom_roles, data_deletion_requests, data_retention_policies,
documentation, email_logs, email_templates, generated_reports, interview_attempts,
interview_invitations, interview_operation_logs, interview_panel_members, interview_schedules,
interview_templates, interviews, invoices, learning_assessment_attempts,
learning_assessment_feedback, learning_assessment_questions, learning_assessment_usage,
learning_assessments, learning_materials, learning_payments, learning_plans,
learning_subscriptions, notifications, onboarding_progress, organization_members,
organization_subscriptions, organizations, panel_consensus, panel_evaluations,
partner_applications, password_setup_invitations, payment_gateways, payment_methods,
payment_transactions, platform_configurations, platform_documentation,
platform_documentation_versions, predictive_analytics, preinterview_check_logs,
proctoring_sessions, proctoring_settings, profiles, promotion_applicable_orgs,
promotion_applicable_plans, promotion_usages, promotions, questions, report_templates,
resume_parsing_results, role_permissions, security_events, subscription_plans,
system_config, test_results, test_runs, test_suites, training_plans, training_topics,
usage_tracking, user_badges, user_custom_roles, user_roles, user_topic_progress,
user_training_assignments
```
</details>

### Functions (75+ required)
```sql
SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';
-- Expected: 75+
```

### Triggers (64 required)
```sql
SELECT COUNT(*) FROM pg_trigger t 
JOIN pg_class c ON t.tgrelid = c.oid 
JOIN pg_namespace n ON c.relnamespace = n.oid 
WHERE n.nspname = 'public' AND NOT t.tgisinternal;
-- Expected: 64
```

### Enums
```sql
SELECT unnest(enum_range(NULL::app_role))::text;
-- Expected: 12 values (admin, hr, interviewer, contributor, candidate, guest, 
--   platform_admin, partner_admin, hr_recruiter, ta_creator, billing_contact, tech_spoc)
```

---

## 2. Storage Buckets (4 required)

```sql
SELECT id, name, public FROM storage.buckets ORDER BY name;
```

| Bucket | Public | Purpose |
|--------|--------|---------|
| `certificates` | ✅ Yes | Certificate PDFs (public verification) |
| `consent-documents` | ❌ No | Candidate consent forms |
| `documentation` | ❌ No | Platform documentation |
| `proctoring-recordings` | ❌ No | Interview recordings |

---

## 3. RLS Policies Verification

```sql
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Expected: 150+
```

---

## 4. Critical Functions Check

These functions MUST exist for the application to work:

| Function | Purpose |
|----------|---------|
| `has_role` | Role checking |
| `has_any_role` | Multiple role checking |
| `has_any_role_with_hierarchy` | Hierarchical role checking |
| `user_is_org_admin` | Organization admin check |
| `user_is_org_member` | Organization member check |
| `can_access_org_data` | Organization data access |
| `create_interview_attempt` | Create interview attempts |
| `get_attempt_by_session` | Session-based attempt retrieval |
| `update_attempt_with_session` | Session-based updates |
| `generate_certificate_number` | Certificate number generation |
| `generate_verification_code` | Verification code generation |
| `encrypt_api_key` | API key encryption |
| `decrypt_api_key` | API key decryption |

---

## 5. Migration Order

For a **FRESH** production database, run migrations in this order:

1. **Existing migrations** in `supabase/migrations/` (chronological order)
2. **Baseline file** `docs/BASELINE_MIGRATION_COMPLETE.sql`

For an **EXISTING** database migration:
1. Only run `docs/BASELINE_MIGRATION_COMPLETE.sql` if tables are missing

---

## 6. Post-Migration Verification

### Quick Health Check
```sql
-- Check all tables have RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'pg_%'
  AND rowsecurity = false;
-- Expected: Empty (all tables should have RLS)

-- Check storage buckets
SELECT id, name, public FROM storage.buckets;
-- Expected: 4 buckets

-- Check enum values
SELECT unnest(enum_range(NULL::app_role))::text;
-- Expected: 12 values
```

---

## 7. Known Issues to Watch

1. **Storage bucket policies**: If INSERT policies fail, check if `auth.uid()` returns null for service role operations
2. **Trigger ordering**: Some triggers depend on functions - ensure functions are created first
3. **Foreign key constraints**: `certificates` table has deferred FK to `learning_assessment_attempts`

---

## 8. Rollback Plan

If migration fails:
1. Note the exact error and which statement caused it
2. Check if partial objects were created
3. Use targeted DROP statements (in reverse order of creation)
4. Never use `DROP SCHEMA public CASCADE` in production!

---

## 9. Security Verification

```sql
-- Verify no tables are publicly accessible without RLS
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false 
  AND tablename NOT IN ('spatial_ref_sys');
-- Expected: Empty

-- Verify storage policies exist
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage';
-- Expected: 10+
```

---

## Sign-off Checklist

- [ ] All 100 tables exist
- [ ] All 75+ functions exist  
- [ ] All 64 triggers exist
- [ ] All 4 storage buckets exist
- [ ] All storage policies in place
- [ ] RLS enabled on all tables
- [ ] app_role enum has 12 values
- [ ] Test user login works
- [ ] Test interview creation works
- [ ] Test file uploads work (all buckets)

**Reviewed by:** _______________  
**Date:** _______________
