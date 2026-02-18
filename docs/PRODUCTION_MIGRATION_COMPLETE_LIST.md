# Complete Production Migration List

> **Generated:** 2025-12-27
> **Purpose:** Exact replica of Lovable Cloud (Dev) → Production

---

## Summary

| Object Type | Count | Status |
|------------|-------|--------|
| ENUM Types | 1 | ⏳ Need migration |
| Tables | 105 | ⏳ Need migration |
| Functions | 109 | ⏳ Need migration |
| RLS Policies | ~320 | ⏳ Need migration |
| Indexes | ~230 | ⏳ Need migration |
| Triggers | 15 | ⏳ Need migration |
| Storage Buckets | 4 | ⏳ Need migration |
| Storage Policies | 23 | ⏳ Need migration |

---

## 1. ENUM TYPES (1 total)

| # | Enum Name | Values |
|---|-----------|--------|
| 1 | `app_role` | admin, hr, interviewer, contributor, candidate, guest, platform_admin, partner_admin, hr_recruiter, ta_creator, billing_contact, tech_spoc |

---

## 2. TABLES (105 total)

| # | Table Name | Columns | RLS |
|---|------------|---------|-----|
| 1 | activity_feed | 8 | ✅ |
| 2 | ai_coach_sessions | 10 | ✅ |
| 3 | ai_feature_alerts | 8 | ✅ |
| 4 | ai_feature_configurations | 14 | ✅ |
| 5 | ai_feature_health | 22 | ✅ |
| 6 | ai_health_alerts | 10 | ✅ |
| 7 | ai_health_checks | 8 | ✅ |
| 8 | ai_health_monitoring | 8 | ✅ |
| 9 | ai_model_configurations | 14 | ✅ |
| 10 | ai_model_performance | 13 | ✅ |
| 11 | ai_provider_credentials | 12 | ✅ |
| 12 | ai_providers | 10 | ✅ |
| 13 | ai_usage_logs | 15 | ✅ |
| 14 | analytics_snapshots | 11 | ✅ |
| 15 | approval_workflows | 13 | ✅ |
| 16 | architecture_documents | 12 | ✅ |
| 17 | assessments | 10 | ✅ |
| 18 | ats_candidates | 21 | ✅ |
| 19 | ats_integrations | 13 | ✅ |
| 20 | ats_sync_logs | 11 | ✅ |
| 21 | attempt_questions | 5 | ✅ |
| 22 | audit_logs | 9 | ✅ |
| 23 | bias_detection_results | 11 | ✅ |
| 24 | candidate_performance_index | 21 | ✅ |
| 25 | certificate_badges | 9 | ✅ |
| 26 | certificates | 14 | ✅ |
| 27 | certification_assessments | 13 | ✅ |
| 28 | certification_attempts | 13 | ✅ |
| 29 | certification_global_config | 5 | ✅ |
| 30 | certification_topics | 15 | ✅ |
| 31 | chatbot_knowledge | 12 | ✅ |
| 32 | circuit_breaker_state | 14 | ✅ |
| 33 | collaboration_threads | 12 | ✅ |
| 34 | comparative_analytics | 10 | ✅ |
| 35 | consent_records | 10 | ✅ |
| 36 | custom_roles | 9 | ✅ |
| 37 | data_deletion_requests | 10 | ✅ |
| 38 | data_retention_policies | 8 | ✅ |
| 39 | documentation | 8 | ✅ |
| 40 | email_logs | 17 | ✅ |
| 41 | email_templates | 10 | ✅ |
| 42 | failed_jobs | 12 | ✅ |
| 43 | idempotency_keys | 9 | ✅ |
| 44 | interview_attempts | 15 | ✅ |
| 45 | interview_invitations | 17 | ✅ |
| 46 | interview_operation_logs | 7 | ✅ |
| 47 | interview_panel_members | 7 | ✅ |
| 48 | interviews | 21 | ✅ |
| 49 | invoices | 15 | ✅ |
| 50 | job_descriptions | 15 | ✅ |
| 51 | learning_assessment_attempts | 14 | ✅ |
| 52 | learning_assessment_questions | 11 | ✅ |
| 53 | learning_assessments | 14 | ✅ |
| 54 | learning_plan_modules | 11 | ✅ |
| 55 | learning_plans | 12 | ✅ |
| 56 | learning_subscriptions | 9 | ✅ |
| 57 | learning_user_progress | 9 | ✅ |
| 58 | notifications | 11 | ✅ |
| 59 | onboarding_progress | 9 | ✅ |
| 60 | optimistic_updates | 10 | ✅ |
| 61 | organization_branding | 9 | ✅ |
| 62 | organization_members | 6 | ✅ |
| 63 | organization_subscriptions | 10 | ✅ |
| 64 | organizations | 15 | ✅ |
| 65 | panel_consensus | 7 | ✅ |
| 66 | panel_evaluations | 10 | ✅ |
| 67 | partner_applications | 16 | ✅ |
| 68 | payment_gateways | 9 | ✅ |
| 69 | payment_transactions | 13 | ✅ |
| 70 | platform_config | 6 | ✅ |
| 71 | proctoring_sessions | 16 | ✅ |
| 72 | proctoring_violations | 12 | ✅ |
| 73 | profiles | 9 | ✅ |
| 74 | promotion_usages | 8 | ✅ |
| 75 | promotions | 15 | ✅ |
| 76 | question_bank | 14 | ✅ |
| 77 | question_reviews | 8 | ✅ |
| 78 | questions | 13 | ✅ |
| 79 | rate_limit_state | 8 | ✅ |
| 80 | report_configurations | 12 | ✅ |
| 81 | report_schedules | 9 | ✅ |
| 82 | scheduled_reports | 11 | ✅ |
| 83 | skill_assessments | 9 | ✅ |
| 84 | subscription_plans | 14 | ✅ |
| 85 | support_tickets | 13 | ✅ |
| 86 | system_health | 7 | ✅ |
| 87 | talent_pools | 10 | ✅ |
| 88 | talent_pools_candidates | 7 | ✅ |
| 89 | templates | 12 | ✅ |
| 90 | test_cases | 13 | ✅ |
| 91 | test_run_results | 12 | ✅ |
| 92 | test_runs | 9 | ✅ |
| 93 | test_suites | 10 | ✅ |
| 94 | topic_weights | 6 | ✅ |
| 95 | usage_tracking | 9 | ✅ |
| 96 | user_badges | 5 | ✅ |
| 97 | user_custom_roles | 6 | ✅ |
| 98 | user_interview_settings | 8 | ✅ |
| 99 | user_preferences | 8 | ✅ |
| 100 | user_roles | 5 | ✅ |
| 101 | user_settings | 6 | ✅ |
| 102 | violation_thresholds | 7 | ✅ |
| 103 | webhook_configs | 10 | ✅ |
| 104 | webhook_deliveries | 10 | ✅ |
| 105 | workflow_steps | 12 | ✅ |

---

## 3. FUNCTIONS (109 total)

### 3.1 Idempotency Functions (3)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `acquire_idempotency_lock(p_key, p_operation_type, p_request_hash)` | TABLE | DEFINER |
| 2 | `complete_idempotent_operation(p_lock_id, p_response, p_resource_id)` | boolean | DEFINER |
| 3 | `release_idempotency_lock(p_lock_id)` | void | DEFINER |

### 3.2 Transaction Functions (9)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `approve_partner_application_tx(p_application_id, p_reviewer_id)` | jsonb | DEFINER |
| 2 | `delete_interview_tx(p_interview_id)` | jsonb | DEFINER |
| 3 | `delete_organization_tx(p_organization_id)` | jsonb | DEFINER |
| 4 | `generate_invoice_tx(...)` | jsonb | DEFINER |
| 5 | `prepare_question_regeneration_tx(p_interview_id)` | jsonb | DEFINER |
| 6 | `save_certification_evaluation_tx(...)` | jsonb | DEFINER |
| 7 | `save_interview_evaluation_tx(...)` | jsonb | DEFINER |
| 8 | `setup_user_tx(p_user_id, p_email, p_full_name, p_role, p_organization_id)` | jsonb | DEFINER |
| 9 | `process_subscription_renewal_tx(p_subscription_id, p_amount_cents)` | jsonb | DEFINER |

### 3.3 Trigger Functions (15)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `assign_guest_role_on_signup()` | trigger | DEFINER |
| 2 | `auto_close_proctoring_on_submission()` | trigger | DEFINER |
| 3 | `auto_evaluate_interview()` | trigger | DEFINER |
| 4 | `auto_set_interview_organization()` | trigger | DEFINER |
| 5 | `set_interview_slug()` | trigger | DEFINER |
| 6 | `set_organization_slug()` | trigger | DEFINER |
| 7 | `update_ai_config_updated_at()` | trigger | INVOKER |
| 8 | `update_ai_health_updated_at()` | trigger | INVOKER |
| 9 | `update_ai_model_config_updated_at()` | trigger | INVOKER |
| 10 | `update_certification_topics_updated_at()` | trigger | INVOKER |
| 11 | `update_platform_config_updated_at()` | trigger | INVOKER |
| 12 | `update_proctoring_sessions_updated_at()` | trigger | INVOKER |
| 13 | `update_test_suites_updated_at()` | trigger | INVOKER |
| 14 | `update_updated_at_column()` | trigger | INVOKER |
| 15 | `handle_new_user()` | trigger | DEFINER |

### 3.4 Role/Permission Functions (14)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `can_access_interview(user_id, interview_uuid)` | boolean | DEFINER |
| 2 | `can_access_org_data(_user_id, _org_id)` | boolean | DEFINER |
| 3 | `can_view_interview_attempts(attempt_id)` | boolean | DEFINER |
| 4 | `get_custom_role_permissions(_user_id, _org_id)` | jsonb | DEFINER |
| 5 | `get_tech_spocs_for_org(_org_id)` | TABLE | DEFINER |
| 6 | `has_any_role(_user_id, _roles)` | boolean | DEFINER |
| 7 | `has_any_role_with_hierarchy(_user_id, _roles)` | boolean | DEFINER |
| 8 | `has_custom_role(_user_id, _role_name, _org_id)` | boolean | DEFINER |
| 9 | `has_role(_user_id, _role)` | boolean | DEFINER |
| 10 | `has_role_in_org(_user_id, _role, _org_id)` | boolean | DEFINER |
| 11 | `is_global_tech_spoc(_user_id)` | boolean | DEFINER |
| 12 | `is_role_org_scoped(check_role)` | boolean | INVOKER |
| 13 | `user_is_org_admin(_user_id, _org_id)` | boolean | DEFINER |
| 14 | `user_is_org_member(_user_id, _org_id)` | boolean | DEFINER |

### 3.5 Interview/Assessment Functions (14)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `calculate_cpi_score(p_technical_score, p_problem_solving_score, p_integrity_score)` | numeric | INVOKER |
| 2 | `can_user_retake_certification(p_user_id, p_certification_topic_id)` | boolean | DEFINER |
| 3 | `create_interview_attempt(p_interview_id, p_candidate_name, p_candidate_email)` | TABLE | DEFINER |
| 4 | `create_interview_attempt_with_invitation(p_invitation_id, p_candidate_name, p_candidate_email)` | TABLE | DEFINER |
| 5 | `finalize_proctored_submission(p_session_token)` | TABLE | DEFINER |
| 6 | `get_assessment_questions_for_attempt(p_attempt_id)` | TABLE | DEFINER |
| 7 | `get_interview_for_candidate(share_link_param)` | TABLE | DEFINER |
| 8 | `get_questions_for_attempt(p_attempt_id)` | TABLE | DEFINER |
| 9 | `get_random_questions_for_attempt(interview_uuid, attempt_uuid, num_questions)` | TABLE | DEFINER |
| 10 | `terminate_attempt_with_session(token, attempt_answers, seconds_taken)` | boolean | DEFINER |
| 11 | `update_attempt_with_session(token, attempt_answers, seconds_taken)` | TABLE | DEFINER |
| 12 | `check_and_award_badges(p_user_id)` | void | DEFINER |
| 13 | `get_active_learning_subscription(p_user_id)` | TABLE | DEFINER |
| 14 | `can_take_learning_assessment(p_user_id, p_assessment_id)` | boolean | DEFINER |

### 3.6 Rate Limiting & Circuit Breaker Functions (6)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `check_circuit_breaker(p_service_name)` | TABLE | DEFINER |
| 2 | `check_rate_limit(p_user_id, p_operation, p_limit, p_window_seconds)` | boolean | DEFINER |
| 3 | `get_circuit_breaker_state(p_service_name)` | TABLE | DEFINER |
| 4 | `record_circuit_breaker_failure(p_service_name)` | void | DEFINER |
| 5 | `record_circuit_breaker_success(p_service_name)` | void | DEFINER |
| 6 | `reset_rate_limit(p_user_id, p_operation)` | void | DEFINER |

### 3.7 Failed Jobs Functions (6)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `cleanup_old_failed_jobs()` | integer | DEFINER |
| 2 | `get_failed_jobs(p_limit)` | TABLE | DEFINER |
| 3 | `get_retryable_jobs()` | TABLE | DEFINER |
| 4 | `mark_job_for_retry(p_job_id)` | boolean | DEFINER |
| 5 | `record_failed_job(p_job_type, p_payload, p_error_message, p_max_retries)` | uuid | DEFINER |
| 6 | `resolve_failed_job(p_job_id, p_resolution)` | void | DEFINER |

### 3.8 Cleanup Functions (4)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `auto_close_expired_proctoring_sessions()` | integer | DEFINER |
| 2 | `cleanup_old_proctoring_recordings()` | void | DEFINER |
| 3 | `execute_data_retention_cleanup()` | jsonb | DEFINER |
| 4 | `cleanup_expired_idempotency_keys()` | integer | DEFINER |

### 3.9 Slug/Generation Functions (4)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `generate_certificate_number()` | text | INVOKER |
| 2 | `generate_invoice_number()` | text | DEFINER |
| 3 | `generate_slug(input_text)` | text | INVOKER |
| 4 | `generate_verification_code()` | text | INVOKER |

### 3.10 Optimistic Update Functions (4)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `cleanup_old_optimistic_updates()` | integer | DEFINER |
| 2 | `confirm_optimistic_update(p_update_id, p_server_data)` | boolean | DEFINER |
| 3 | `create_optimistic_update(p_table_name, p_record_id, p_optimistic_data)` | uuid | DEFINER |
| 4 | `rollback_optimistic_update(p_update_id)` | jsonb | DEFINER |

### 3.11 Subscription/Billing Functions (5)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `check_subscription_limits(p_org_id, p_feature)` | boolean | DEFINER |
| 2 | `get_subscription_usage(p_org_id)` | jsonb | DEFINER |
| 3 | `increment_subscription_usage(p_org_id, p_feature, p_amount)` | void | DEFINER |
| 4 | `process_subscription_payment_tx(p_subscription_id, p_amount_cents, p_payment_method)` | jsonb | DEFINER |
| 5 | `reset_monthly_subscription_usage()` | void | DEFINER |

### 3.12 Utility/Helper Functions (24)
| # | Function Name | Returns | Security |
|---|--------------|---------|----------|
| 1 | `check_architecture_docs_status()` | jsonb | DEFINER |
| 2 | `check_proctoring_session_for_attempt(p_attempt_id)` | TABLE | DEFINER |
| 3 | `check_rls_enabled(table_name)` | boolean | DEFINER |
| 4 | `get_interview_by_invitation(p_invitation_id)` | TABLE | DEFINER |
| 5 | `get_interview_by_share_link(p_share_link)` | TABLE | DEFINER |
| 6 | `get_interview_by_slug(p_slug)` | TABLE | DEFINER |
| 7 | `get_proctoring_session_by_token(p_session_token)` | TABLE | DEFINER |
| 8 | `get_user_dashboard_stats(p_user_id)` | jsonb | DEFINER |
| 9 | `get_user_organizations(p_user_id)` | TABLE | DEFINER |
| 10 | `get_user_roles_list(p_user_id)` | TABLE | DEFINER |
| 11 | `init_proctoring_for_attempt(p_attempt_id)` | uuid | DEFINER |
| 12 | `log_proctoring_violation(p_session_id, p_violation_type, p_severity, p_description, p_metadata)` | uuid | DEFINER |
| 13 | `resolve_invitation_by_id(p_invitation_id)` | TABLE | DEFINER |
| 14 | `resolve_invitation_by_token(p_token)` | TABLE | DEFINER |
| 15 | `search_candidates(p_query, p_org_id, p_limit)` | TABLE | DEFINER |
| 16 | `search_interviews(p_query, p_org_id, p_status, p_limit)` | TABLE | DEFINER |
| 17 | `update_proctoring_session_recording(p_session_id, p_video_url, p_screen_url)` | boolean | DEFINER |
| 18 | `validate_invitation_token(p_token)` | TABLE | DEFINER |
| 19 | `verify_certificate_authenticity(p_verification_code)` | TABLE | DEFINER |
| 20 | `create_or_update_proctoring_session(p_attempt_id, p_candidate_email)` | uuid | DEFINER |
| 21 | `get_platform_config_value(p_key)` | text | DEFINER |
| 22 | `set_platform_config_value(p_key, p_value)` | void | DEFINER |
| 23 | `track_ai_usage(p_feature_name, p_tokens_used, p_latency_ms, p_success)` | void | DEFINER |
| 24 | `update_ai_feature_health_status(p_feature_id, p_status, p_latency_ms, p_error_message)` | void | DEFINER |

---

## 4. TRIGGERS (15 total)

| # | Trigger Name | Table | Event | Function |
|---|-------------|-------|-------|----------|
| 1 | `set_organization_slug_trigger` | organizations | BEFORE INSERT | set_organization_slug() |
| 2 | `set_interview_slug_trigger` | interviews | BEFORE INSERT | set_interview_slug() |
| 3 | `auto_set_interview_organization_trigger` | interviews | BEFORE INSERT | auto_set_interview_organization() |
| 4 | `auto_evaluate_interview_trigger` | interview_attempts | AFTER UPDATE | auto_evaluate_interview() |
| 5 | `auto_close_proctoring_trigger` | interview_attempts | AFTER UPDATE | auto_close_proctoring_on_submission() |
| 6 | `update_proctoring_sessions_updated_at_trigger` | proctoring_sessions | BEFORE UPDATE | update_proctoring_sessions_updated_at() |
| 7 | `update_ai_feature_health_updated_at_trigger` | ai_feature_health | BEFORE UPDATE | update_ai_health_updated_at() |
| 8 | `update_ai_model_configurations_updated_at_trigger` | ai_model_configurations | BEFORE UPDATE | update_ai_model_config_updated_at() |
| 9 | `update_platform_config_updated_at_trigger` | platform_config | BEFORE UPDATE | update_platform_config_updated_at() |
| 10 | `update_certification_topics_updated_at_trigger` | certification_topics | BEFORE UPDATE | update_certification_topics_updated_at() |
| 11 | `update_test_suites_updated_at_trigger` | test_suites | BEFORE UPDATE | update_test_suites_updated_at() |
| 12 | `update_ai_feature_configurations_updated_at` | ai_feature_configurations | BEFORE UPDATE | update_ai_config_updated_at() |
| 13 | `on_auth_user_created` | auth.users | AFTER INSERT | handle_new_user() |
| 14 | `assign_guest_role_trigger` | auth.users | AFTER INSERT | assign_guest_role_on_signup() |
| 15 | `update_updated_at_trigger` | (multiple tables) | BEFORE UPDATE | update_updated_at_column() |

---

## 5. STORAGE BUCKETS (4 total)

| # | Bucket Name | Public | Size Limit | Allowed Types |
|---|------------|--------|------------|---------------|
| 1 | `certificates` | ✅ Yes | 10MB | PDF, PNG, JPEG |
| 2 | `consent-documents` | ❌ No | 10MB | PDF, PNG, JPEG |
| 3 | `documentation` | ❌ No | 10MB | PDF |
| 4 | `proctoring-recordings` | ❌ No | None | All |

---

## 6. STORAGE POLICIES (23 total)

| # | Policy Name | Bucket | Command | Description |
|---|------------|--------|---------|-------------|
| 1 | `certificates_public_read` | certificates | SELECT | Anyone can read certificates |
| 2 | `certificates_admin_write` | certificates | INSERT | Platform admins can upload |
| 3 | `consent_documents_admin_read` | consent-documents | SELECT | Admins can read consent docs |
| 4 | `consent_documents_owner_read` | consent-documents | SELECT | Users can read their own |
| 5 | `consent_documents_admin_write` | consent-documents | INSERT | Admins can upload |
| 6 | `Admins can delete documentation` | documentation | DELETE | Admin delete access |
| 7 | `Admins can update documentation` | documentation | UPDATE | Admin update access |
| 8 | `Admins can upload documentation` | documentation | INSERT | Admin insert access |
| 9 | `Admins can view documentation` | documentation | SELECT | Admin read access |
| 10 | `Interview creators can view proctoring recordings` | proctoring-recordings | SELECT | Creator access |
| 11 | `Interview creators can view their recordings` | proctoring-recordings | SELECT | Creator access |
| 12 | `Only service role can upload proctoring recordings` | proctoring-recordings | INSERT | Service role only |
| 13 | `Service role can update proctoring recordings` | proctoring-recordings | UPDATE | Service role |
| 14 | `Service role can upload proctoring recordings` | proctoring-recordings | INSERT | Service role |
| 15 | `Staff can delete proctoring recordings` | proctoring-recordings | DELETE | Staff delete |
| 16 | `Staff can view proctoring recordings` | proctoring-recordings | SELECT | Staff read |
| 17-23 | (Additional proctoring & consent policies) | various | various | Role-based access |

---

## 7. RLS POLICIES (~320 total)

> Listed by table with policy count

| # | Table Name | Policy Count | Key Policies |
|---|------------|-------------|--------------|
| 1 | activity_feed | 1 | Org members can view |
| 2 | ai_coach_sessions | 4 | Candidate view, service role manage |
| 3 | ai_feature_alerts | 3 | Platform admin manage/view |
| 4 | ai_feature_configurations | 1 | Platform admin manage |
| 5 | ai_feature_health | 2 | Platform admin manage/view |
| 6 | ai_health_alerts | 2 | Platform admin manage/view |
| 7 | ai_health_checks | 1 | Platform admin view |
| 8 | ai_health_monitoring | 2 | Platform admin access |
| 9 | ai_model_configurations | 3 | Platform admin manage |
| 10 | ai_model_performance | 2 | Platform admin manage/view |
| 11 | ai_provider_credentials | 1 | Platform admin manage |
| 12 | ai_providers | 1 | Platform admin manage |
| 13 | ai_usage_logs | 3 | Org admin view, service role insert |
| 14 | analytics_snapshots | 3 | Org members view, service manage |
| 15 | approval_workflows | 1 | Org access workflows |
| 16 | architecture_documents | 2 | Authenticated view, admin manage |
| 17 | assessments | 5 | Creator/admin view, service insert |
| 18 | ats_candidates | 3 | Org admin manage, member view |
| 19 | ats_integrations | 3 | Org admin manage, member view |
| 20 | ats_sync_logs | 2 | Org member view, service insert |
| 21 | attempt_questions | 4 | Candidate view own, admin delete |
| 22 | audit_logs | 5 | Admin view, service insert |
| 23 | bias_detection_results | 2 | Authorized view, service insert |
| 24 | candidate_performance_index | 5 | Creator/admin view |
| 25 | certificate_badges | 4 | Public read, admin write |
| 26 | certificates | 7 | Owner view, admin manage |
| 27 | certification_assessments | 2 | Public view published, admin manage |
| 28 | certification_attempts | 4 | User create/view own, admin view all |
| 29 | certification_global_config | 2 | Admin manage |
| 30 | certification_topics | 2 | Public view active, admin manage |
| 31 | chatbot_knowledge | 2 | Public view, admin manage |
| 32 | circuit_breaker_state | 1 | Service role access |
| 33 | collaboration_threads | 3 | Author/participant access |
| 34 | comparative_analytics | 2 | Org member view |
| 35 | consent_records | 3 | Candidate view own, admin view all |
| 36 | custom_roles | 3 | Org admin manage |
| 37 | data_deletion_requests | 2 | Admin manage |
| 38 | data_retention_policies | 2 | Admin manage |
| 39 | documentation | 2 | Authenticated view, admin manage |
| 40 | email_logs | 3 | Admin view, service insert |
| 41 | email_templates | 2 | Admin manage |
| 42 | failed_jobs | 2 | Admin access |
| 43 | idempotency_keys | 1 | Service role access |
| 44 | interview_attempts | 6 | Creator/candidate access |
| 45 | interview_invitations | 5 | Creator manage, candidate view |
| 46 | interview_operation_logs | 2 | Admin view |
| 47 | interview_panel_members | 3 | Panel member access |
| 48 | interviews | 8 | Creator/org access |
| 49 | invoices | 3 | Org admin view |
| 50 | job_descriptions | 3 | Creator/org access |
| 51 | learning_assessment_attempts | 4 | User manage own |
| 52 | learning_assessment_questions | 2 | Authenticated access |
| 53 | learning_assessments | 2 | Admin manage, public view |
| 54 | learning_plan_modules | 2 | Admin manage |
| 55 | learning_plans | 3 | Admin manage, user view assigned |
| 56 | learning_subscriptions | 3 | User view own |
| 57 | learning_user_progress | 2 | User manage own |
| 58 | notifications | 4 | User view/manage own |
| 59 | onboarding_progress | 2 | User manage own |
| 60 | optimistic_updates | 1 | Service role access |
| 61 | organization_branding | 2 | Org admin manage |
| 62 | organization_members | 4 | Org access |
| 63 | organization_subscriptions | 3 | Org admin view |
| 64 | organizations | 5 | Member/admin access |
| 65 | panel_consensus | 2 | Panel access |
| 66 | panel_evaluations | 3 | Panel member access |
| 67 | partner_applications | 4 | Applicant/admin access |
| 68 | payment_gateways | 2 | Admin manage |
| 69 | payment_transactions | 3 | Org admin view |
| 70 | platform_config | 2 | Admin manage |
| 71 | proctoring_sessions | 5 | Candidate/staff access |
| 72 | proctoring_violations | 4 | Staff access |
| 73 | profiles | 4 | User view/update own |
| 74 | promotion_usages | 2 | Org view own |
| 75 | promotions | 2 | Admin manage, public view active |
| 76 | question_bank | 3 | Admin/creator access |
| 77 | question_reviews | 3 | Reviewer access |
| 78 | questions | 5 | Creator/org access |
| 79 | rate_limit_state | 1 | Service role access |
| 80 | report_configurations | 2 | Org access |
| 81 | report_schedules | 2 | Org admin manage |
| 82 | scheduled_reports | 2 | Org access |
| 83 | skill_assessments | 2 | User access own |
| 84 | subscription_plans | 2 | Public view, admin manage |
| 85 | support_tickets | 3 | User manage own |
| 86 | system_health | 2 | Admin access |
| 87 | talent_pools | 3 | Org access |
| 88 | talent_pools_candidates | 2 | Org access |
| 89 | templates | 4 | Creator/org access |
| 90 | test_cases | 3 | Admin manage |
| 91 | test_run_results | 2 | Admin access |
| 92 | test_runs | 3 | Admin access |
| 93 | test_suites | 3 | Admin access |
| 94 | topic_weights | 2 | Admin manage |
| 95 | usage_tracking | 2 | Org view |
| 96 | user_badges | 3 | User view own |
| 97 | user_custom_roles | 3 | Admin manage |
| 98 | user_interview_settings | 2 | User manage own |
| 99 | user_preferences | 2 | User manage own |
| 100 | user_roles | 4 | Admin manage, user view own |
| 101 | user_settings | 2 | User manage own |
| 102 | violation_thresholds | 2 | Admin manage |
| 103 | webhook_configs | 2 | Org admin manage |
| 104 | webhook_deliveries | 2 | Org admin view |
| 105 | workflow_steps | 2 | Org access |

---

## 8. INDEXES (~230 total)

> Performance indexes grouped by table category

### Core Tables Indexes
- `interviews`: 8 indexes (pkey, org_id, creator_id, status, slug, share_link, created_at)
- `interview_attempts`: 7 indexes (pkey, interview_id, candidate_email, status, session_token)
- `questions`: 5 indexes (pkey, interview_id, topic, difficulty, type)
- `profiles`: 4 indexes (pkey, email, user_id)
- `organizations`: 5 indexes (pkey, slug, status, name)
- `user_roles`: 4 indexes (pkey, user_id, role, organization_id)

### AI/ML Tables Indexes
- `ai_usage_logs`: 6 indexes
- `ai_feature_health`: 4 indexes
- `ai_model_configurations`: 3 indexes

### Proctoring Tables Indexes
- `proctoring_sessions`: 5 indexes
- `proctoring_violations`: 4 indexes

### All Other Tables: Primary key + relevant foreign key indexes

---

## Migration Execution Order

1. **ENUM Types** (1)
2. **Tables** (105) - In dependency order
3. **Functions** (109) - Core helpers first, then triggers
4. **Triggers** (15)
5. **RLS Policies** (~320)
6. **Indexes** (~230)
7. **Storage Buckets** (4)
8. **Storage Policies** (23)

---

## Next Steps

**Ready to start one-by-one migration?**

Start with:
1. ☐ ENUM type: `app_role`
2. ☐ Tables one by one
3. ☐ Functions one by one  
4. ☐ RLS Policies per table
5. ☐ Triggers
6. ☐ Storage buckets + policies

Let me know which object to migrate first!
