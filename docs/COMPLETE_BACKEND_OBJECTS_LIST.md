# Complete Backend Objects List - Lovable Cloud

> **Purpose**: Complete inventory of ALL backend objects for production migration
> **Generated**: 2024-12-27
> **Database**: Lovable Cloud (vtztavcqjmirktkjdprm)

---

## SUMMARY

| Category | Count | Need Migration |
|----------|-------|----------------|
| **ENUM Types (public)** | 1 | ✅ In baseline |
| **Tables** | 105 | ⏳ Verify columns |
| **Functions** | 109 | ⏳ ~94 missing |
| **RLS Policies** | 320+ | ⏳ Verify |
| **Indexes** | 200+ | ⏳ Verify |
| **Storage Buckets** | 4 | ⏳ Add |
| **Storage Policies** | 15 | ⏳ Add |
| **Foreign Keys** | 50+ | ⏳ Verify |
| **Triggers** | 0 (DB says) | ⏳ Need to add |

---

## 1. ENUM TYPES

### Public Schema (Need to migrate)

| # | Type Name | Values | Status |
|---|-----------|--------|--------|
| 1 | `app_role` | admin, hr, interviewer, contributor, candidate, guest, platform_admin, partner_admin, hr_recruiter, ta_creator, billing_contact, tech_spoc | ✅ In baseline |

### System Schemas (DO NOT migrate - Supabase manages)

| Schema | Type Name | Note |
|--------|-----------|------|
| auth | aal_level | Supabase internal |
| auth | code_challenge_method | Supabase internal |
| auth | factor_status | Supabase internal |
| auth | factor_type | Supabase internal |
| auth | oauth_* | Supabase internal |
| auth | one_time_token_type | Supabase internal |
| net | request_status | Supabase internal |
| pgsodium | key_status | Supabase internal |
| pgsodium | key_type | Supabase internal |
| realtime | action | Supabase internal |
| realtime | equality_op | Supabase internal |
| storage | buckettype | Supabase internal |

---

## 2. TABLES (105 total)

| # | Table Name | Cols | RLS | Policies | Status |
|---|------------|------|-----|----------|--------|
| 1 | activity_feed | 8 | ✅ | 1 | ⏳ |
| 2 | ai_coach_sessions | 10 | ✅ | 4 | ⏳ |
| 3 | ai_feature_alerts | 8 | ✅ | 3 | ⏳ |
| 4 | ai_feature_configurations | 14 | ✅ | 1 | ⏳ |
| 5 | ai_feature_health | 22 | ✅ | 2 | ⏳ |
| 6 | ai_health_alerts | 10 | ✅ | 2 | ⏳ |
| 7 | ai_health_checks | 8 | ✅ | 1 | ⏳ |
| 8 | ai_health_monitoring | 8 | ✅ | 2 | ⏳ |
| 9 | ai_model_configurations | 14 | ✅ | 3 | ⏳ |
| 10 | ai_model_performance | 13 | ✅ | 2 | ⏳ |
| 11 | ai_provider_credentials | 12 | ✅ | 1 | ⏳ |
| 12 | ai_providers | 10 | ✅ | 1 | ⏳ |
| 13 | ai_usage_logs | 15 | ✅ | 3 | ⏳ |
| 14 | analytics_snapshots | 11 | ✅ | 3 | ⏳ |
| 15 | approval_workflows | 13 | ✅ | 1 | ⏳ |
| 16 | architecture_documents | 13 | ✅ | 2 | ⏳ |
| 17 | assessments | 10 | ✅ | 5 | ⏳ |
| 18 | ats_candidates | 20 | ✅ | 3 | ⏳ |
| 19 | ats_integrations | 13 | ✅ | 3 | ⏳ |
| 20 | ats_sync_logs | 10 | ✅ | 2 | ⏳ |
| 21 | attempt_questions | 5 | ✅ | 4 | ⏳ |
| 22 | audit_logs | 9 | ✅ | 5 | ⏳ |
| 23 | bias_detection_results | 11 | ✅ | 2 | ⏳ |
| 24 | candidate_performance_index | 22 | ✅ | 5 | ⏳ |
| 25 | certificate_badges | 9 | ✅ | 4 | ⏳ |
| 26 | certificates | 15 | ✅ | 7 | ⏳ |
| 27 | certification_assessments | 12 | ✅ | 2 | ⏳ |
| 28 | certification_attempts | 15 | ✅ | 5 | ⏳ |
| 29 | certification_global_config | 5 | ✅ | 3 | ⏳ |
| 30 | certification_topics | 15 | ✅ | 4 | ⏳ |
| 31 | chatbot_knowledge | 12 | ✅ | 2 | ⏳ |
| 32 | circuit_breaker_state | 14 | ✅ | 1 | ⏳ |
| 33 | collaboration_threads | 11 | ✅ | 1 | ⏳ |
| 34 | comparative_analytics | 10 | ✅ | 1 | ⏳ |
| 35 | consent_records | 10 | ✅ | 3 | ⏳ |
| 36 | custom_roles | 9 | ✅ | 5 | ⏳ |
| 37 | data_deletion_requests | 10 | ✅ | 3 | ⏳ |
| 38 | data_retention_policies | 8 | ✅ | 2 | ⏳ |
| 39 | documentation | 9 | ✅ | 2 | ⏳ |
| 40 | email_logs | 16 | ✅ | 2 | ⏳ |
| 41 | email_templates | 12 | ✅ | 3 | ⏳ |
| 42 | failed_jobs | 19 | ✅ | 1 | ⏳ |
| 43 | generated_reports | 11 | ✅ | 1 | ⏳ |
| 44 | idempotency_keys | 10 | ✅ | 1 | ⏳ |
| 45 | interview_attempts | 11 | ✅ | 14 | ⏳ |
| 46 | interview_invitations | 15 | ✅ | 8 | ⏳ |
| 47 | interview_operation_logs | 17 | ✅ | 3 | ⏳ |
| 48 | interview_panel_members | 6 | ✅ | 3 | ⏳ |
| 49 | interview_schedules | 16 | ✅ | 1 | ⏳ |
| 50 | interview_templates | 18 | ✅ | 2 | ⏳ |
| 51 | interviews | 32 | ✅ | 8 | ⏳ |
| 52 | invoices | 21 | ✅ | 2 | ⏳ |
| 53 | learning_assessment_attempts | 9 | ✅ | 6 | ⏳ |
| 54 | learning_assessment_feedback | 12 | ✅ | 3 | ⏳ |
| 55 | learning_assessment_questions | 12 | ✅ | 2 | ⏳ |
| 56 | learning_assessment_usage | 8 | ✅ | 5 | ⏳ |
| 57 | learning_assessments | 21 | ✅ | 4 | ⏳ |
| 58 | learning_materials | 8 | ✅ | 2 | ⏳ |
| 59 | learning_payments | 12 | ✅ | 3 | ⏳ |
| 60 | learning_plans | 13 | ✅ | 2 | ⏳ |
| 61 | learning_subscriptions | 12 | ✅ | 3 | ⏳ |
| 62 | notifications | 11 | ✅ | 4 | ⏳ |
| 63 | onboarding_progress | 9 | ✅ | 3 | ⏳ |
| 64 | organization_members | 7 | ✅ | 5 | ⏳ |
| 65 | organization_subscriptions | 10 | ✅ | 2 | ⏳ |
| 66 | organizations | 15 | ✅ | 4 | ⏳ |
| 67 | panel_consensus | 9 | ✅ | 3 | ⏳ |
| 68 | panel_evaluations | 12 | ✅ | 3 | ⏳ |
| 69 | partner_applications | 20 | ✅ | 4 | ⏳ |
| 70 | password_setup_invitations | 9 | ✅ | 2 | ⏳ |
| 71 | payment_gateways | 16 | ✅ | 1 | ⏳ |
| 72 | payment_methods | 11 | ✅ | 3 | ⏳ |
| 73 | payment_transactions | 13 | ✅ | 3 | ⏳ |
| 74 | platform_configurations | - | ✅ | 3 | ⏳ |
| 75 | platform_documentation | - | ✅ | 4 | ⏳ |
| 76 | platform_documentation_versions | - | ✅ | 2 | ⏳ |
| 77 | predictive_analytics | - | ✅ | 1 | ⏳ |
| 78 | preinterview_check_logs | - | ✅ | 3 | ⏳ |
| 79 | proctoring_sessions | - | ✅ | 12 | ⏳ |
| 80 | proctoring_settings | - | ✅ | 3 | ⏳ |
| 81 | proctoring_violations | - | ✅ | 3 | ⏳ |
| 82 | profiles | 10 | ✅ | 7 | ⏳ |
| 83 | promotion_applicable_orgs | - | ✅ | 2 | ⏳ |
| 84 | promotion_applicable_plans | - | ✅ | 2 | ⏳ |
| 85 | promotion_usages | - | ✅ | 3 | ⏳ |
| 86 | promotions | - | ✅ | 2 | ⏳ |
| 87 | questions | - | ✅ | 9 | ⏳ |
| 88 | rate_limit_buckets | - | ✅ | 1 | ⏳ |
| 89 | report_templates | - | ✅ | 1 | ⏳ |
| 90 | resume_parsing_results | - | ✅ | 2 | ⏳ |
| 91 | role_permissions | - | ✅ | 1 | ⏳ |
| 92 | security_events | - | ✅ | 3 | ⏳ |
| 93 | subscription_plans | - | ✅ | 5 | ⏳ |
| 94 | system_config | - | ✅ | 1 | ⏳ |
| 95 | test_results | - | ✅ | 2 | ⏳ |
| 96 | test_runs | - | ✅ | 2 | ⏳ |
| 97 | test_suites | - | ✅ | 2 | ⏳ |
| 98 | training_plans | - | ✅ | 2 | ⏳ |
| 99 | training_topics | - | ✅ | 3 | ⏳ |
| 100 | usage_tracking | - | ✅ | 2 | ⏳ |
| 101 | user_badges | - | ✅ | 4 | ⏳ |
| 102 | user_custom_roles | - | ✅ | 2 | ⏳ |
| 103 | user_roles | 5 | ✅ | 6 | ⏳ |
| 104 | user_topic_progress | - | ✅ | 3 | ⏳ |
| 105 | user_training_assignments | - | ✅ | 2 | ⏳ |

**Total RLS Policies: ~320**

---

## 3. FUNCTIONS (109 total)

| # | Function Name | Security | Category |
|---|---------------|----------|----------|
| 1 | acquire_idempotency_lock | DEFINER | Idempotency |
| 2 | approve_partner_application_tx | DEFINER | Transaction |
| 3 | assign_guest_role_on_signup | DEFINER | Trigger |
| 4 | auto_close_expired_proctoring_sessions | DEFINER | Cleanup |
| 5 | auto_close_proctoring_on_submission | DEFINER | Trigger |
| 6 | auto_evaluate_interview | DEFINER | Trigger |
| 7 | auto_set_interview_organization | DEFINER | Trigger |
| 8 | calculate_cpi_score | INVOKER | Utility |
| 9 | can_access_interview | DEFINER | Permission |
| 10 | can_access_org_data | DEFINER | Permission |
| 11 | can_user_retake_certification | DEFINER | Business |
| 12 | can_view_interview_attempts | DEFINER | Permission |
| 13 | check_and_award_badges | DEFINER | Business |
| 14 | check_architecture_docs_status | DEFINER | Utility |
| 15 | check_circuit_breaker | DEFINER | Circuit |
| 16 | check_daily_free_assessment_limit | DEFINER | Business |
| 17 | check_multi_org_membership | DEFINER | Trigger |
| 18 | check_rate_limit | DEFINER | RateLimit |
| 19 | check_rls_enabled | DEFINER | Utility |
| 20 | check_user_exists | DEFINER | Utility |
| 21 | cleanup_expired_idempotency_keys | DEFINER | Cleanup |
| 22 | cleanup_old_proctoring_recordings | DEFINER | Cleanup |
| 23 | cleanup_rate_limit_buckets | DEFINER | Cleanup |
| 24 | complete_idempotency | DEFINER | Idempotency |
| 25 | complete_invitation_on_submission | DEFINER | Trigger |
| 26 | create_interview_attempt | DEFINER | Interview |
| 27 | create_interview_attempt_with_invitation | DEFINER | Interview |
| 28 | create_notification | DEFINER | Utility |
| 29 | decrypt_api_key | DEFINER | Encryption |
| 30 | delete_interview_tx | DEFINER | Transaction |
| 31 | delete_organization_tx | DEFINER | Transaction |
| 32 | delete_user_cascade_tx | DEFINER | Transaction |
| 33 | encrypt_api_key | DEFINER | Encryption |
| 34 | encrypt_api_key_trigger | DEFINER | Trigger |
| 35 | enqueue_failed_job | DEFINER | FailedJobs |
| 36 | execute_data_retention_cleanup | DEFINER | Cleanup |
| 37 | finalize_proctored_submission | DEFINER | Interview |
| 38 | generate_certificate_number | INVOKER | Utility |
| 39 | generate_invoice_number | DEFINER | Utility |
| 40 | generate_invoice_tx | DEFINER | Transaction |
| 41 | generate_session_token | DEFINER | Utility |
| 42 | generate_share_token | DEFINER | Utility |
| 43 | generate_slug | INVOKER | Utility |
| 44 | generate_verification_code | INVOKER | Utility |
| 45 | get_active_learning_subscription | DEFINER | Business |
| 46 | get_assessment_questions_for_attempt | DEFINER | Interview |
| 47 | get_attempt_by_session | DEFINER | Interview |
| 48 | get_custom_role_permissions | DEFINER | Permission |
| 49 | get_failed_job_stats | DEFINER | FailedJobs |
| 50 | get_interview_for_candidate | DEFINER | Interview |
| 51 | get_questions_for_attempt | DEFINER | Interview |
| 52 | get_random_questions_for_attempt | DEFINER | Interview |
| 53 | get_retryable_jobs | DEFINER | FailedJobs |
| 54 | get_tech_spocs_for_org | DEFINER | Permission |
| 55 | get_user_roles | DEFINER | Permission |
| 56 | handle_new_user | DEFINER | Trigger |
| 57 | has_action_permission | DEFINER | Permission |
| 58 | has_any_role | DEFINER | Permission |
| 59 | has_any_role_with_hierarchy | DEFINER | Permission |
| 60 | has_custom_role | DEFINER | Permission |
| 61 | has_role | DEFINER | Permission |
| 62 | has_role_in_org | DEFINER | Permission |
| 63 | increment_interview_usage | DEFINER | Billing |
| 64 | increment_interviews_used | DEFINER | Billing |
| 65 | increment_question_selection_counts | DEFINER | Business |
| 66 | initialize_onboarding_progress | DEFINER | Business |
| 67 | is_global_tech_spoc | DEFINER | Permission |
| 68 | is_payment_enabled | DEFINER | Billing |
| 69 | is_role_org_scoped | INVOKER | Permission |
| 70 | log_assessment_changes | DEFINER | Trigger |
| 71 | mark_architecture_docs_outdated | DEFINER | Trigger |
| 72 | mark_job_recovered | DEFINER | FailedJobs |
| 73 | mark_job_retry_failed | DEFINER | FailedJobs |
| 74 | mark_job_retrying | DEFINER | FailedJobs |
| 75 | optimistic_update | DEFINER | Utility |
| 76 | prepare_question_regeneration_tx | DEFINER | Transaction |
| 77 | record_circuit_failure | DEFINER | Circuit |
| 78 | record_circuit_success | DEFINER | Circuit |
| 79 | save_certification_evaluation_tx | DEFINER | Transaction |
| 80 | save_interview_evaluation_tx | DEFINER | Transaction |
| 81 | set_interview_slug | DEFINER | Trigger |
| 82 | set_organization_slug | DEFINER | Trigger |
| 83 | set_session_token | DEFINER | Utility |
| 84 | setup_user_tx | DEFINER | Transaction |
| 85 | soft_delete | DEFINER | Utility |
| 86 | soft_restore | DEFINER | Utility |
| 87 | terminate_attempt_with_session | DEFINER | Interview |
| 88 | toggle_violation_ignored | DEFINER | Proctoring |
| 89 | track_ai_usage | DEFINER | AI |
| 90 | trigger_auto_evaluate | DEFINER | Trigger |
| 91 | update_ai_config_updated_at | INVOKER | UpdatedAt |
| 92 | update_ai_health_updated_at | INVOKER | UpdatedAt |
| 93 | update_ai_model_config_updated_at | INVOKER | UpdatedAt |
| 94 | update_attempt_with_session | DEFINER | Interview |
| 95 | update_certification_topics_updated_at | INVOKER | UpdatedAt |
| 96 | update_chatbot_knowledge_updated_at | INVOKER | UpdatedAt |
| 97 | update_invoice_updated_at | INVOKER | UpdatedAt |
| 98 | update_platform_config_updated_at | INVOKER | UpdatedAt |
| 99 | update_proctoring_sessions_updated_at | INVOKER | UpdatedAt |
| 100 | update_role_permissions_updated_at | INVOKER | UpdatedAt |
| 101 | update_subscription_interview_usage | DEFINER | Billing |
| 102 | update_test_suites_updated_at | INVOKER | UpdatedAt |
| 103 | update_updated_at_column | INVOKER | UpdatedAt |
| 104 | update_usage_tracking | DEFINER | Billing |
| 105 | user_is_org_admin | DEFINER | Permission |
| 106 | user_is_org_member | DEFINER | Permission |
| 107 | verify_certificate_by_code | DEFINER | Business |

**Note**: Some functions may have duplicate entries with different signatures.

---

## 4. STORAGE BUCKETS (4 total)

| # | Bucket ID | Name | Public | Size Limit | Allowed Types |
|---|-----------|------|--------|------------|---------------|
| 1 | certificates | certificates | ✅ Yes | 10MB | PDF, PNG, JPEG |
| 2 | consent-documents | consent-documents | ❌ No | 10MB | PDF, PNG, JPEG |
| 3 | documentation | documentation | ❌ No | 10MB | PDF |
| 4 | proctoring-recordings | proctoring-recordings | ❌ No | - | - |

---

## 5. STORAGE POLICIES (15 total)

| # | Bucket | Policy Name | Command |
|---|--------|-------------|---------|
| 1 | certificates | certificates_public_read | SELECT |
| 2 | certificates | certificates_admin_write | INSERT |
| 3 | consent-documents | consent_documents_admin_read | SELECT |
| 4 | consent-documents | consent_documents_admin_write | INSERT |
| 5 | documentation | Admins can view documentation | SELECT |
| 6 | documentation | Admins can upload documentation | INSERT |
| 7 | documentation | Admins can update documentation | UPDATE |
| 8 | documentation | Admins can delete documentation | DELETE |
| 9 | proctoring-recordings | Staff can view proctoring recordings | SELECT |
| 10 | proctoring-recordings | Interview creators can view proctoring recordings | SELECT |
| 11 | proctoring-recordings | Interview creators can view their recordings | SELECT |
| 12 | proctoring-recordings | Only service role can upload proctoring recordings | INSERT |
| 13 | proctoring-recordings | Service role can upload proctoring recordings | INSERT |
| 14 | proctoring-recordings | Service role can update proctoring recordings | UPDATE |
| 15 | proctoring-recordings | Staff can delete proctoring recordings | DELETE |

---

## 6. INDEXES (200+ total)

Key indexes include:
- Primary keys (105 tables)
- Foreign key indexes
- Performance indexes on frequently queried columns
- Partial indexes for filtered queries

---

## Migration Execution Order

```
1. ENUM Types         → Already in baseline ✅
2. Helper Functions   → Add ~15 core functions
3. Tables             → Verify all 105 tables
4. Permission Funcs   → Add ~20 permission functions  
5. Business Funcs     → Add ~30 business functions
6. Transaction Funcs  → Add ~10 transaction functions
7. Trigger Funcs      → Add ~15 trigger functions
8. Utility Funcs      → Add ~20 utility functions
9. Triggers           → Create triggers that call functions
10. Indexes           → Add custom indexes
11. RLS Policies      → Verify all 320+ policies
12. Storage Buckets   → Add 4 buckets
13. Storage Policies  → Add 15 policies
```

---

## What's Next?

Would you like me to start creating migrations for:
1. **Functions by category** (one migration per category)
2. **Table verification** (compare columns one by one)
3. **Storage buckets** (quick win - 4 buckets + 15 policies)
