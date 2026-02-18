# FINAL GAP ANALYSIS: Lovable Cloud vs Migration Files

## Generated: 2024-12-27

---

## EXECUTIVE SUMMARY

| Category | Lovable Cloud | Migration Files | Status | Gap |
|----------|---------------|-----------------|--------|-----|
| **Tables** | 105 | 105 | ✅ MATCH | 0 |
| **Functions** | 109 | ❌ **FILE MISSING** | ⚠️ CRITICAL | Functions file not created |
| **RLS Policies** | 330 | 305 (stated in file) | ⚠️ MISMATCH | 25 policies missing |
| **Indexes** | 377 | ~120 (valid only) | ✅ OK | Primary keys auto-created |
| **Triggers** | 60+ | 60+ | ✅ MATCH | 0 |
| **Storage Buckets** | 4 | 4 | ✅ MATCH | 0 |
| **Storage Policies** | 15 | 15 | ✅ MATCH | 0 |
| **Enums** | 1 (app_role, 12 values) | 1 | ✅ MATCH | 0 |

---

## CRITICAL GAPS FOUND

### 1. ⚠️ MISSING FILE: `PRODUCTION_FUNCTIONS_MIGRATION.sql`
**Status:** NOT CREATED
**Impact:** Cannot replicate database without functions
**Functions needed (109 total):**

1. acquire_idempotency_lock
2. approve_partner_application_tx
3. assign_guest_role_on_signup
4. auto_close_expired_proctoring_sessions
5. auto_close_proctoring_on_submission
6. auto_evaluate_interview
7. auto_set_interview_organization
8. calculate_cpi_score
9. can_access_interview
10. can_access_org_data
11. can_user_retake_certification
12. can_view_interview_attempts
13. check_and_award_badges
14. check_architecture_docs_status
15. check_circuit_breaker
16. check_daily_free_assessment_limit
17. check_multi_org_membership
18. check_rate_limit
19. check_rls_enabled
20. check_user_exists
21. cleanup_expired_idempotency_keys
22. cleanup_old_proctoring_recordings
23. cleanup_rate_limit_buckets
24. complete_idempotency
25. complete_invitation_on_submission
26. create_interview_attempt
27. create_interview_attempt_with_invitation
28. create_notification
29. decrypt_api_key
30. delete_interview_tx
31. delete_organization_tx
32. delete_user_cascade_tx (2 versions)
33. encrypt_api_key
34. encrypt_api_key_trigger
35. enqueue_failed_job
36. execute_data_retention_cleanup
37. finalize_proctored_submission
38. generate_certificate_number
39. generate_invoice_number
40. generate_invoice_tx (2 versions)
41. generate_session_token
42. generate_share_token
43. generate_slug
44. generate_verification_code
45. get_active_learning_subscription
46. get_assessment_questions_for_attempt
47. get_attempt_by_session
48. get_custom_role_permissions
49. get_failed_job_stats
50. get_interview_for_candidate
51. get_questions_for_attempt
52. get_random_questions_for_attempt
53. get_retryable_jobs
54. get_tech_spocs_for_org
55. get_user_roles
56. handle_new_user
57. has_action_permission
58. has_any_role
59. has_any_role_with_hierarchy
60. has_custom_role
61. has_role
62. has_role_in_org
63. increment_interview_usage
64. increment_interviews_used
65. increment_question_selection_counts
66. initialize_onboarding_progress
67. is_global_tech_spoc
68. is_payment_enabled
69. is_role_org_scoped
70. log_assessment_changes
71. mark_architecture_docs_outdated
72. mark_job_recovered
73. mark_job_retry_failed
74. mark_job_retrying
75. optimistic_update
76. prepare_question_regeneration_tx
77. record_circuit_failure
78. record_circuit_success
79. save_certification_evaluation_tx
80. save_interview_evaluation_tx
81. set_interview_slug
82. set_organization_slug
83. set_session_token
84. setup_user_tx
85. soft_delete
86. soft_restore
87. terminate_attempt_with_session
88. toggle_violation_ignored
89. track_ai_usage
90. trigger_auto_evaluate
91. update_ai_config_updated_at
92. update_ai_health_updated_at
93. update_ai_model_config_updated_at
94. update_attempt_with_session
95. update_certification_topics_updated_at
96. update_chatbot_knowledge_updated_at
97. update_invoice_updated_at
98. update_platform_config_updated_at
99. update_proctoring_sessions_updated_at
100. update_role_permissions_updated_at
101. update_subscription_interview_usage
102. update_test_suites_updated_at
103. update_updated_at_column
104. update_usage_tracking
105. user_is_org_admin
106. user_is_org_member
107. verify_certificate_by_code

### 2. ⚠️ RLS POLICY MISMATCH
**Lovable Cloud:** 330 policies
**Migration file states:** 305 policies
**Gap:** 25 policies missing

### 3. 📁 MIGRATION FILES LOCATION
**Current location:** `docs/` folder
**Expected location:** `supabase/migrations/` folder for db push

The `supabase/migrations/` folder only contains:
- 20251226124621_complete_baseline.sql
- 20251226152139_939dc4e7-dbcc-4c17-9aff-a966ea19585b.sql
- 20251226152247_0016a87a-dca0-410a-8a04-9a10940b243b.sql
- 20251226152341_2b51cd22-29e5-4584-aa08-e6d63f8c16e8.sql

---

## TABLES VERIFIED (105 total - COMPLETE)

All 105 tables from Lovable Cloud are present in migrations:

| # | Table Name | Status |
|---|------------|--------|
| 1 | activity_feed | ✅ |
| 2 | ai_coach_sessions | ✅ |
| 3 | ai_feature_alerts | ✅ |
| 4 | ai_feature_configurations | ✅ |
| 5 | ai_feature_health | ✅ |
| 6 | ai_health_alerts | ✅ |
| 7 | ai_health_checks | ✅ |
| 8 | ai_health_monitoring | ✅ |
| 9 | ai_model_configurations | ✅ |
| 10 | ai_model_performance | ✅ |
| 11 | ai_provider_credentials | ✅ |
| 12 | ai_providers | ✅ |
| 13 | ai_usage_logs | ✅ |
| 14 | analytics_snapshots | ✅ |
| 15 | approval_workflows | ✅ |
| 16 | architecture_documents | ✅ |
| 17 | assessments | ✅ |
| 18 | ats_candidates | ✅ |
| 19 | ats_integrations | ✅ |
| 20 | ats_sync_logs | ✅ |
| 21 | attempt_questions | ✅ |
| 22 | audit_logs | ✅ |
| 23 | bias_detection_results | ✅ |
| 24 | candidate_performance_index | ✅ |
| 25 | certificate_badges | ✅ |
| 26 | certificates | ✅ |
| 27 | certification_assessments | ✅ |
| 28 | certification_attempts | ✅ |
| 29 | certification_global_config | ✅ |
| 30 | certification_topics | ✅ |
| 31 | chatbot_knowledge | ✅ |
| 32 | circuit_breaker_state | ✅ |
| 33 | collaboration_threads | ✅ |
| 34 | comparative_analytics | ✅ |
| 35 | consent_records | ✅ |
| 36 | custom_roles | ✅ |
| 37 | data_deletion_requests | ✅ |
| 38 | data_retention_policies | ✅ |
| 39 | documentation | ✅ |
| 40 | email_logs | ✅ |
| 41 | email_templates | ✅ |
| 42 | failed_jobs | ✅ |
| 43 | generated_reports | ✅ |
| 44 | idempotency_keys | ✅ |
| 45 | interview_attempts | ✅ |
| 46 | interview_invitations | ✅ |
| 47 | interview_operation_logs | ✅ |
| 48 | interview_panel_members | ✅ |
| 49 | interview_schedules | ✅ |
| 50 | interview_templates | ✅ |
| 51 | interviews | ✅ |
| 52 | invoices | ✅ |
| 53 | learning_assessment_attempts | ✅ |
| 54 | learning_assessment_feedback | ✅ |
| 55 | learning_assessment_questions | ✅ |
| 56 | learning_assessment_usage | ✅ |
| 57 | learning_assessments | ✅ |
| 58 | learning_materials | ✅ |
| 59 | learning_payments | ✅ |
| 60 | learning_plans | ✅ |
| 61 | learning_subscriptions | ✅ |
| 62 | notifications | ✅ |
| 63 | onboarding_progress | ✅ |
| 64 | organization_members | ✅ |
| 65 | organization_subscriptions | ✅ |
| 66 | organizations | ✅ |
| 67 | panel_consensus | ✅ |
| 68 | panel_evaluations | ✅ |
| 69 | partner_applications | ✅ |
| 70 | password_setup_invitations | ✅ |
| 71 | payment_gateways | ✅ |
| 72 | payment_methods | ✅ |
| 73 | payment_transactions | ✅ |
| 74 | platform_configurations | ✅ |
| 75 | platform_documentation | ✅ |
| 76 | platform_documentation_versions | ✅ |
| 77 | predictive_analytics | ✅ |
| 78 | preinterview_check_logs | ✅ |
| 79 | proctoring_sessions | ✅ |
| 80 | proctoring_settings | ✅ |
| 81 | proctoring_violations | ✅ |
| 82 | profiles | ✅ |
| 83 | promotion_applicable_orgs | ✅ |
| 84 | promotion_applicable_plans | ✅ |
| 85 | promotion_usages | ✅ |
| 86 | promotions | ✅ |
| 87 | questions | ✅ |
| 88 | rate_limit_buckets | ✅ |
| 89 | report_templates | ✅ |
| 90 | resume_parsing_results | ✅ |
| 91 | role_permissions | ✅ |
| 92 | security_events | ✅ |
| 93 | subscription_plans | ✅ |
| 94 | system_config | ✅ |
| 95 | test_results | ✅ |
| 96 | test_runs | ✅ |
| 97 | test_suites | ✅ |
| 98 | training_plans | ✅ |
| 99 | training_topics | ✅ |
| 100 | usage_tracking | ✅ |
| 101 | user_badges | ✅ |
| 102 | user_custom_roles | ✅ |
| 103 | user_roles | ✅ |
| 104 | user_topic_progress | ✅ |
| 105 | user_training_assignments | ✅ |

---

## RLS POLICY COUNT BY TABLE (330 total)

| Table | Policy Count |
|-------|-------------|
| interview_attempts | 14 |
| proctoring_sessions | 12 |
| user_roles | 11 |
| questions | 9 |
| interviews | 8 |
| interview_invitations | 8 |
| certificates | 7 |
| profiles | 7 |
| user_badges | 6 |
| learning_assessment_attempts | 6 |
| certification_attempts | 5 |
| learning_assessment_usage | 5 |
| custom_roles | 5 |
| assessments | 5 |
| subscription_plans | 5 |
| organization_members | 5 |
| audit_logs | 5 |
| candidate_performance_index | 5 |
| certificate_badges | 4 |
| ai_coach_sessions | 4 |
| attempt_questions | 4 |
| learning_assessments | 4 |
| notifications | 4 |
| user_custom_roles | 4 |
| partner_applications | 4 |
| organizations | 4 |
| certification_topics | 4 |
| platform_documentation | 4 |
| security_events | 3 |
| ai_feature_alerts | 3 |
| ai_model_configurations | 3 |
| ai_usage_logs | 3 |
| analytics_snapshots | 3 |
| ats_candidates | 3 |
| ats_integrations | 3 |
| certification_global_config | 3 |
| consent_records | 3 |
| data_deletion_requests | 3 |
| email_templates | 3 |
| interview_operation_logs | 3 |
| interview_panel_members | 3 |
| learning_assessment_feedback | 3 |
| learning_payments | 3 |
| learning_subscriptions | 3 |
| onboarding_progress | 3 |
| panel_consensus | 3 |
| panel_evaluations | 3 |
| payment_methods | 3 |
| payment_transactions | 3 |
| platform_configurations | 3 |
| preinterview_check_logs | 3 |
| proctoring_settings | 3 |
| proctoring_violations | 3 |
| promotion_usages | 3 |
| training_topics | 3 |
| ai_health_monitoring | 2 |
| organization_subscriptions | 2 |
| documentation | 2 |
| email_logs | 2 |
| architecture_documents | 2 |
| test_runs | 2 |
| test_suites | 2 |
| certification_assessments | 2 |
| data_retention_policies | 2 |
| password_setup_invitations | 2 |
| resume_parsing_results | 2 |
| learning_plans | 2 |
| chatbot_knowledge | 2 |
| interview_templates | 2 |
| training_plans | 2 |
| invoices | 2 |
| user_training_assignments | 2 |
| usage_tracking | 2 |
| learning_assessment_questions | 2 |
| learning_materials | 2 |
| platform_documentation_versions | 2 |
| bias_detection_results | 2 |
| ai_health_alerts | 2 |
| test_results | 2 |
| ai_feature_health | 2 |
| ats_sync_logs | 2 |
| ai_model_performance | 2 |
| promotion_applicable_orgs | 2 |
| promotion_applicable_plans | 2 |
| user_topic_progress | 2 |
| promotions | 2 |
| interview_schedules | 1 |
| ai_health_checks | 1 |
| system_config | 1 |
| approval_workflows | 1 |
| payment_gateways | 1 |
| ai_providers | 1 |
| predictive_analytics | 1 |
| ai_provider_credentials | 1 |
| ai_feature_configurations | 1 |
| rate_limit_buckets | 1 |
| report_templates | 1 |
| failed_jobs | 1 |
| generated_reports | 1 |
| idempotency_keys | 1 |
| activity_feed | 1 |
| circuit_breaker_state | 1 |
| collaboration_threads | 1 |
| comparative_analytics | 1 |
| role_permissions | 1 |

---

## STORAGE CONFIGURATION (COMPLETE)

### Buckets (4)
1. certificates (public)
2. consent-documents (private)
3. documentation (private)
4. proctoring-recordings (private)

### Storage Policies (15)
All 15 storage policies are included in PRODUCTION_STORAGE_MIGRATION.sql

---

## ENUM TYPES (COMPLETE)

### app_role (12 values)
1. admin
2. hr
3. interviewer
4. contributor
5. candidate
6. guest
7. platform_admin
8. partner_admin
9. hr_recruiter
10. ta_creator
11. billing_contact
12. tech_spoc

---

## REQUIRED ACTIONS

1. **CREATE** `docs/PRODUCTION_FUNCTIONS_MIGRATION.sql` with all 109 functions
2. **UPDATE** `docs/PRODUCTION_RLS_POLICIES_MIGRATION.sql` to include all 330 policies
3. **DECIDE** if migration files should be in `supabase/migrations/` or `docs/`

---

## FILES IN DOCS FOLDER

| File | Purpose |
|------|---------|
| PRODUCTION_COMPLETE_MIGRATION.sql | Tables, enums, basic functions |
| PRODUCTION_FUNCTIONS_MIGRATION.sql | ❌ MISSING - All database functions |
| PRODUCTION_INDEXES_MIGRATION.sql | All indexes |
| PRODUCTION_RLS_POLICIES_MIGRATION.sql | ⚠️ Only has 305 of 330 policies |
| PRODUCTION_TRIGGERS_MIGRATION.sql | All triggers |
| PRODUCTION_STORAGE_MIGRATION.sql | Storage buckets and policies |

---

## EXECUTION ORDER (When all files are complete)

```bash
# 1. Core tables and basic functions
psql -f docs/PRODUCTION_COMPLETE_MIGRATION.sql

# 2. All database functions
psql -f docs/PRODUCTION_FUNCTIONS_MIGRATION.sql

# 3. All indexes
psql -f docs/PRODUCTION_INDEXES_MIGRATION.sql

# 4. All RLS policies (330)
psql -f docs/PRODUCTION_RLS_POLICIES_MIGRATION.sql

# 5. All triggers
psql -f docs/PRODUCTION_TRIGGERS_MIGRATION.sql

# 6. Storage buckets and policies
psql -f docs/PRODUCTION_STORAGE_MIGRATION.sql
```
