# Complete Migration Checklist - Lovable Cloud to Production

> **Purpose**: Track every database object to ensure exact replica migration
> **Generated**: 2024-12-27
> **Status**: ✅ = In baseline, ⏳ = Need to add, ❌ = Missing

---

## Summary

| Component | Total Count | In Baseline | Need to Add |
|-----------|-------------|-------------|-------------|
| ENUM Types | 1 | ✅ 1 | 0 |
| Tables | 105 | ⏳ Verify | TBD |
| Functions | 109 | ~15 | ~94 |
| RLS Policies | 300+ | Partial | TBD |
| Storage Buckets | 4 | 0 | 4 |
| Triggers | ~50 | Partial | TBD |

---

## 1. ENUM TYPES (1 total)

| # | Type Name | Values | Status |
|---|-----------|--------|--------|
| 1 | `app_role` | admin, hr, interviewer, contributor, candidate, guest, platform_admin, partner_admin, hr_recruiter, ta_creator, billing_contact, tech_spoc | ✅ In baseline |

---

## 2. TABLES (105 total)

| # | Table Name | Columns | RLS | Status |
|---|------------|---------|-----|--------|
| 1 | activity_feed | 8 | ✅ | ⏳ Verify |
| 2 | ai_coach_sessions | 10 | ✅ | ⏳ Verify |
| 3 | ai_feature_alerts | 8 | ✅ | ⏳ Verify |
| 4 | ai_feature_configurations | 14 | ✅ | ⏳ Verify |
| 5 | ai_feature_health | 22 | ✅ | ⏳ Verify |
| 6 | ai_health_alerts | 10 | ✅ | ⏳ Verify |
| 7 | ai_health_checks | 8 | ✅ | ⏳ Verify |
| 8 | ai_health_monitoring | 8 | ✅ | ⏳ Verify |
| 9 | ai_model_configurations | 14 | ✅ | ⏳ Verify |
| 10 | ai_model_performance | 13 | ✅ | ⏳ Verify |
| 11 | ai_provider_credentials | 12 | ✅ | ⏳ Verify |
| 12 | ai_providers | 10 | ✅ | ⏳ Verify |
| 13 | ai_usage_logs | 15 | ✅ | ⏳ Verify |
| 14 | analytics_snapshots | 11 | ✅ | ⏳ Verify |
| 15 | approval_workflows | 13 | ✅ | ⏳ Verify |
| 16 | architecture_documents | 13 | ✅ | ⏳ Verify |
| 17 | assessments | 10 | ✅ | ⏳ Verify |
| 18 | ats_candidates | 20 | ✅ | ⏳ Verify |
| 19 | ats_integrations | 13 | ✅ | ⏳ Verify |
| 20 | ats_sync_logs | 10 | ✅ | ⏳ Verify |
| 21 | attempt_questions | 5 | ✅ | ⏳ Verify |
| 22 | audit_logs | 9 | ✅ | ⏳ Verify |
| 23 | bias_detection_results | 11 | ✅ | ⏳ Verify |
| 24 | candidate_performance_index | 22 | ✅ | ⏳ Verify |
| 25 | certificate_badges | 9 | ✅ | ⏳ Verify |
| 26 | certificates | 15 | ✅ | ⏳ Verify |
| 27 | certification_assessments | 12 | ✅ | ⏳ Verify |
| 28 | certification_attempts | 15 | ✅ | ⏳ Verify |
| 29 | certification_global_config | 5 | ✅ | ⏳ Verify |
| 30 | certification_topics | 15 | ✅ | ⏳ Verify |
| 31 | chatbot_knowledge | 12 | ✅ | ⏳ Verify |
| 32 | circuit_breaker_state | 14 | ✅ | ⏳ Verify |
| 33 | collaboration_threads | 11 | ✅ | ⏳ Verify |
| 34 | comparative_analytics | 10 | ✅ | ⏳ Verify |
| 35 | consent_records | 10 | ✅ | ⏳ Verify |
| 36 | custom_roles | 9 | ✅ | ⏳ Verify |
| 37 | data_deletion_requests | 10 | ✅ | ⏳ Verify |
| 38 | data_retention_policies | 8 | ✅ | ⏳ Verify |
| 39 | documentation | 9 | ✅ | ⏳ Verify |
| 40 | email_logs | 16 | ✅ | ⏳ Verify |
| 41 | email_templates | 12 | ✅ | ⏳ Verify |
| 42 | failed_jobs | 19 | ✅ | ⏳ Verify |
| 43 | generated_reports | 11 | ✅ | ⏳ Verify |
| 44 | idempotency_keys | 10 | ✅ | ⏳ Verify |
| 45 | interview_attempts | 11 | ✅ | ⏳ Verify |
| 46 | interview_invitations | 15 | ✅ | ⏳ Verify |
| 47 | interview_operation_logs | 17 | ✅ | ⏳ Verify |
| 48 | interview_panel_members | 6 | ✅ | ⏳ Verify |
| 49 | interview_schedules | 16 | ✅ | ⏳ Verify |
| 50 | interview_templates | 18 | ✅ | ⏳ Verify |
| 51 | interviews | 32 | ✅ | ⏳ Verify |
| 52 | invoices | 21 | ✅ | ⏳ Verify |
| 53 | learning_assessment_attempts | 9 | ✅ | ⏳ Verify |
| 54 | learning_assessment_feedback | 12 | ✅ | ⏳ Verify |
| 55 | learning_assessment_questions | 12 | ✅ | ⏳ Verify |
| 56 | learning_assessment_usage | 8 | ✅ | ⏳ Verify |
| 57 | learning_assessments | 21 | ✅ | ⏳ Verify |
| 58 | learning_materials | 8 | ✅ | ⏳ Verify |
| 59 | learning_payments | 12 | ✅ | ⏳ Verify |
| 60 | learning_plans | 13 | ✅ | ⏳ Verify |
| 61 | learning_subscriptions | 12 | ✅ | ⏳ Verify |
| 62 | notifications | 11 | ✅ | ⏳ Verify |
| 63 | onboarding_progress | 9 | ✅ | ⏳ Verify |
| 64 | organization_members | 7 | ✅ | ⏳ Verify |
| 65 | organization_subscriptions | 10 | ✅ | ⏳ Verify |
| 66 | organizations | 15 | ✅ | ⏳ Verify |
| 67 | panel_consensus | 9 | ✅ | ⏳ Verify |
| 68 | panel_evaluations | 12 | ✅ | ⏳ Verify |
| 69 | partner_applications | 20 | ✅ | ⏳ Verify |
| 70 | password_setup_invitations | 9 | ✅ | ⏳ Verify |
| 71 | payment_gateways | 16 | ✅ | ⏳ Verify |
| 72 | payment_methods | 11 | ✅ | ⏳ Verify |
| 73 | payment_transactions | 13 | ✅ | ⏳ Verify |
| 74 | platform_configurations | ? | ✅ | ⏳ Verify |
| 75 | platform_documentation | ? | ✅ | ⏳ Verify |
| 76 | platform_documentation_versions | ? | ✅ | ⏳ Verify |
| 77 | predictive_analytics | ? | ✅ | ⏳ Verify |
| 78 | preinterview_check_logs | ? | ✅ | ⏳ Verify |
| 79 | proctoring_sessions | ? | ✅ | ⏳ Verify |
| 80 | proctoring_settings | ? | ✅ | ⏳ Verify |
| 81 | proctoring_violations | ? | ✅ | ⏳ Verify |
| 82 | profiles | 10 | ✅ | ⏳ Verify |
| 83 | promotion_applicable_orgs | ? | ✅ | ⏳ Verify |
| 84 | promotion_applicable_plans | ? | ✅ | ⏳ Verify |
| 85 | promotion_usages | ? | ✅ | ⏳ Verify |
| 86 | promotions | ? | ✅ | ⏳ Verify |
| 87 | questions | ? | ✅ | ⏳ Verify |
| 88 | rate_limit_buckets | ? | ✅ | ⏳ Verify |
| 89 | report_templates | ? | ✅ | ⏳ Verify |
| 90 | resume_parsing_results | ? | ✅ | ⏳ Verify |
| 91 | role_permissions | ? | ✅ | ⏳ Verify |
| 92 | security_events | ? | ✅ | ⏳ Verify |
| 93 | subscription_plans | ? | ✅ | ⏳ Verify |
| 94 | system_config | ? | ✅ | ⏳ Verify |
| 95 | test_results | ? | ✅ | ⏳ Verify |
| 96 | test_runs | ? | ✅ | ⏳ Verify |
| 97 | test_suites | ? | ✅ | ⏳ Verify |
| 98 | training_plans | ? | ✅ | ⏳ Verify |
| 99 | training_topics | ? | ✅ | ⏳ Verify |
| 100 | usage_tracking | ? | ✅ | ⏳ Verify |
| 101 | user_badges | ? | ✅ | ⏳ Verify |
| 102 | user_custom_roles | ? | ✅ | ⏳ Verify |
| 103 | user_roles | 5 | ✅ | ⏳ Verify |
| 104 | user_topic_progress | ? | ✅ | ⏳ Verify |
| 105 | user_training_assignments | ? | ✅ | ⏳ Verify |

---

## 3. FUNCTIONS (109 total)

### 3.1 Core Helper Functions (In Baseline ✅)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 1 | update_updated_at_column | - | INVOKER | ✅ |
| 2 | generate_slug | input_text | INVOKER | ✅ |
| 3 | generate_certificate_number | - | INVOKER | ✅ |
| 4 | generate_verification_code | - | INVOKER | ✅ |
| 5 | generate_invoice_number | - | DEFINER | ✅ |
| 6 | calculate_cpi_score | 3 params | INVOKER | ✅ |
| 7 | has_role | user_id, role | DEFINER | ✅ |
| 8 | has_any_role | user_id, roles[] | DEFINER | ✅ |
| 9 | get_user_roles | user_id | DEFINER | ✅ |
| 10 | check_and_award_badges | user_id | DEFINER | ✅ |
| 11 | set_organization_slug | trigger | DEFINER | ✅ |
| 12 | set_interview_slug | trigger | DEFINER | ✅ |

### 3.2 Role/Permission Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 13 | has_any_role_with_hierarchy | user_id, roles[] | DEFINER | ⏳ |
| 14 | has_role_in_org | user_id, role, org_id | DEFINER | ⏳ |
| 15 | has_custom_role | user_id, role_name, org_id | DEFINER | ⏳ |
| 16 | is_role_org_scoped | role | INVOKER | ⏳ |
| 17 | is_global_tech_spoc | user_id | DEFINER | ⏳ |
| 18 | get_tech_spocs_for_org | org_id | DEFINER | ⏳ |
| 19 | get_custom_role_permissions | user_id, org_id | DEFINER | ⏳ |
| 20 | user_is_org_admin | user_id, org_id | DEFINER | ⏳ |
| 21 | user_is_org_member | user_id, org_id | DEFINER | ⏳ |
| 22 | can_access_org_data | user_id, org_id | DEFINER | ⏳ |
| 23 | can_access_interview | user_id, interview_id | DEFINER | ⏳ |
| 24 | can_view_interview_attempts | attempt_id | DEFINER | ⏳ |
| 25 | has_action_permission | ? | DEFINER | ⏳ |

### 3.3 Interview/Assessment Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 26 | create_interview_attempt | interview_id, name, email | DEFINER | ⏳ |
| 27 | create_interview_attempt_with_invitation | invitation_id, name, email | DEFINER | ⏳ |
| 28 | get_interview_for_candidate | share_link | DEFINER | ⏳ |
| 29 | get_questions_for_attempt | attempt_id | DEFINER | ⏳ |
| 30 | get_random_questions_for_attempt | interview_id, attempt_id, count | DEFINER | ⏳ |
| 31 | get_assessment_questions_for_attempt | attempt_id | DEFINER | ⏳ |
| 32 | update_attempt_with_session | token, answers, time | DEFINER | ⏳ |
| 33 | terminate_attempt_with_session | token, answers, time | DEFINER | ⏳ |
| 34 | finalize_proctored_submission | session_token | DEFINER | ⏳ |
| 35 | get_attempt_by_session | ? | DEFINER | ⏳ |

### 3.4 Transaction Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 36 | approve_partner_application_tx | app_id, reviewer_id | DEFINER | ⏳ |
| 37 | delete_organization_tx | org_id | DEFINER | ⏳ |
| 38 | delete_interview_tx | interview_id | DEFINER | ⏳ |
| 39 | delete_user_cascade_tx | user_id, admin_id | DEFINER | ⏳ |
| 40 | setup_user_tx | user_id, email, name, role, org_id | DEFINER | ⏳ |
| 41 | prepare_question_regeneration_tx | interview_id | DEFINER | ⏳ |
| 42 | save_interview_evaluation_tx | 15+ params | DEFINER | ⏳ |
| 43 | save_certification_evaluation_tx | 6 params | DEFINER | ⏳ |
| 44 | generate_invoice_tx | 10 params | DEFINER | ⏳ |

### 3.5 Trigger Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 45 | assign_guest_role_on_signup | trigger | DEFINER | ⏳ |
| 46 | auto_evaluate_interview | trigger | DEFINER | ⏳ |
| 47 | auto_set_interview_organization | trigger | DEFINER | ⏳ |
| 48 | auto_close_proctoring_on_submission | trigger | DEFINER | ⏳ |
| 49 | complete_invitation_on_submission | trigger | DEFINER | ⏳ |
| 50 | encrypt_api_key_trigger | trigger | DEFINER | ⏳ |
| 51 | check_multi_org_membership | trigger | DEFINER | ⏳ |
| 52 | log_assessment_changes | trigger | DEFINER | ⏳ |
| 53 | mark_architecture_docs_outdated | trigger | DEFINER | ⏳ |
| 54 | trigger_auto_evaluate | trigger | DEFINER | ⏳ |

### 3.6 Utility Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 55 | check_rls_enabled | table_name | DEFINER | ⏳ |
| 56 | check_user_exists | email | DEFINER | ⏳ |
| 57 | generate_session_token | ? | DEFINER | ⏳ |
| 58 | generate_share_token | ? | DEFINER | ⏳ |
| 59 | create_notification | 7 params | DEFINER | ⏳ |
| 60 | encrypt_api_key | api_key | DEFINER | ⏳ |
| 61 | decrypt_api_key | encrypted_key | DEFINER | ⏳ |
| 62 | verify_certificate_by_code | ? | DEFINER | ⏳ |
| 63 | can_user_retake_certification | user_id, topic_id | DEFINER | ⏳ |
| 64 | get_active_learning_subscription | user_id | DEFINER | ⏳ |
| 65 | check_daily_free_assessment_limit | user_id | DEFINER | ⏳ |
| 66 | check_architecture_docs_status | - | DEFINER | ⏳ |

### 3.7 Rate Limiting & Circuit Breaker Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 67 | check_rate_limit | identifier, endpoint, max, window | DEFINER | ⏳ |
| 68 | cleanup_rate_limit_buckets | - | DEFINER | ⏳ |
| 69 | check_circuit_breaker | service_name | DEFINER | ⏳ |
| 70 | record_circuit_failure | ? | DEFINER | ⏳ |
| 71 | record_circuit_success | ? | DEFINER | ⏳ |

### 3.8 Idempotency Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 72 | acquire_idempotency_lock | key, type, hash | DEFINER | ⏳ |
| 73 | complete_idempotency | lock_id, resource_id, response, success | DEFINER | ⏳ |
| 74 | cleanup_expired_idempotency_keys | - | DEFINER | ⏳ |

### 3.9 Failed Jobs Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 75 | enqueue_failed_job | 10 params | DEFINER | ⏳ |
| 76 | get_retryable_jobs | ? | DEFINER | ⏳ |
| 77 | get_failed_job_stats | ? | DEFINER | ⏳ |
| 78 | mark_job_retrying | ? | DEFINER | ⏳ |
| 79 | mark_job_recovered | ? | DEFINER | ⏳ |
| 80 | mark_job_retry_failed | ? | DEFINER | ⏳ |

### 3.10 Cleanup Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 81 | execute_data_retention_cleanup | - | DEFINER | ⏳ |
| 82 | cleanup_old_proctoring_recordings | - | DEFINER | ⏳ |
| 83 | auto_close_expired_proctoring_sessions | - | DEFINER | ⏳ |

### 3.11 Billing/Subscription Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 84 | is_payment_enabled | ? | DEFINER | ⏳ |
| 85 | increment_interview_usage | ? | DEFINER | ⏳ |
| 86 | increment_interviews_used | ? | DEFINER | ⏳ |
| 87 | update_subscription_interview_usage | ? | DEFINER | ⏳ |
| 88 | update_usage_tracking | ? | DEFINER | ⏳ |

### 3.12 Optimistic Update Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 89 | optimistic_update | ? | DEFINER | ⏳ |
| 90 | soft_delete | ? | DEFINER | ⏳ |
| 91 | soft_restore | ? | DEFINER | ⏳ |

### 3.13 Proctoring Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 92 | toggle_violation_ignored | ? | DEFINER | ⏳ |
| 93 | increment_question_selection_counts | ? | DEFINER | ⏳ |

### 3.14 User Lifecycle Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 94 | handle_new_user | trigger | DEFINER | ⏳ |
| 95 | initialize_onboarding_progress | ? | DEFINER | ⏳ |

### 3.15 Updated_at Trigger Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 96 | update_proctoring_sessions_updated_at | trigger | INVOKER | ⏳ |
| 97 | update_ai_health_updated_at | trigger | INVOKER | ⏳ |
| 98 | update_ai_model_config_updated_at | trigger | INVOKER | ⏳ |
| 99 | update_platform_config_updated_at | trigger | INVOKER | ⏳ |
| 100 | update_certification_topics_updated_at | trigger | INVOKER | ⏳ |
| 101 | update_ai_config_updated_at | trigger | INVOKER | ⏳ |
| 102 | update_test_suites_updated_at | trigger | INVOKER | ⏳ |
| 103 | update_chatbot_knowledge_updated_at | trigger | INVOKER | ⏳ |
| 104 | update_invoice_updated_at | trigger | INVOKER | ⏳ |
| 105 | update_role_permissions_updated_at | trigger | INVOKER | ⏳ |

### 3.16 AI Tracking Functions (Need to Add ⏳)

| # | Function Name | Parameters | Security | Status |
|---|---------------|------------|----------|--------|
| 106 | track_ai_usage | ? | DEFINER | ⏳ |

---

## 4. STORAGE BUCKETS (4 total)

| # | Bucket ID | Name | Public | Size Limit | Allowed Types | Status |
|---|-----------|------|--------|------------|---------------|--------|
| 1 | certificates | certificates | ✅ Yes | 10MB | PDF, PNG, JPEG | ⏳ Need to add |
| 2 | consent-documents | consent-documents | ❌ No | 10MB | PDF, PNG, JPEG | ⏳ Need to add |
| 3 | documentation | documentation | ❌ No | 10MB | PDF | ⏳ Need to add |
| 4 | proctoring-recordings | proctoring-recordings | ❌ No | - | - | ⏳ Need to add |

---

## 5. RLS POLICIES (300+ total)

Will be tracked per-table as we verify each table.

---

## Migration Execution Plan

### Phase 1: ✅ COMPLETE - Core Baseline
- File: `20251226124621_complete_baseline.sql`
- Contains: ENUMs, ~15 functions, 105 tables, basic RLS, triggers

### Phase 2: Functions - Split into migrations
- `migration_2a_role_permission_functions.sql` (13 functions)
- `migration_2b_interview_functions.sql` (10 functions)  
- `migration_2c_transaction_functions.sql` (9 functions)
- `migration_2d_trigger_functions.sql` (10 functions)
- `migration_2e_utility_functions.sql` (12 functions)
- `migration_2f_ratelimit_circuit_functions.sql` (5 functions)
- `migration_2g_idempotency_functions.sql` (3 functions)
- `migration_2h_failed_jobs_functions.sql` (6 functions)
- `migration_2i_cleanup_functions.sql` (3 functions)
- `migration_2j_billing_functions.sql` (5 functions)
- `migration_2k_misc_functions.sql` (remaining)

### Phase 3: Storage Buckets
- `migration_3_storage_buckets.sql`

### Phase 4: Enhanced RLS Policies
- Per-table verification and enhancement

---

## Next Steps

1. **Verify baseline tables** - Compare each table column by column
2. **Add missing functions** - One category at a time
3. **Add storage buckets** - With proper RLS
4. **Verify RLS policies** - Compare with Lovable Cloud

Would you like me to start with any specific section?
