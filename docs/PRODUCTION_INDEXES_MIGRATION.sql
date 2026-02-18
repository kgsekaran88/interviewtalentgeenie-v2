-- ============================================================================
-- PRODUCTION INDEXES MIGRATION
-- Complete indexes from dev environment
-- Generated: 2024-12-27
-- Total Custom Indexes: ~150+ (excluding primary keys and unique constraints)
-- ============================================================================

-- ============================================================================
-- SECTION 1: ACTIVITY & AI INDEXES
-- ============================================================================

-- Activity Feed
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_feed USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_org ON public.activity_feed USING btree (organization_id);

-- AI Coach Sessions
CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_attempt ON public.ai_coach_sessions USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_email ON public.ai_coach_sessions USING btree (candidate_email);
CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_interview ON public.ai_coach_sessions USING btree (interview_id);

-- AI Feature Alerts
CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_created ON public.ai_feature_alerts USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_feature ON public.ai_feature_alerts USING btree (feature_name);
CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_resolved ON public.ai_feature_alerts USING btree (resolved_at) WHERE (resolved_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_severity ON public.ai_feature_alerts USING btree (severity);

-- AI Feature Configurations
CREATE INDEX IF NOT EXISTS idx_ai_feature_configs_fallback_provider ON public.ai_feature_configurations USING btree (fallback_provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_feature_configs_primary_provider ON public.ai_feature_configurations USING btree (primary_provider_id);

-- AI Feature Health
CREATE INDEX IF NOT EXISTS idx_ai_feature_health_status ON public.ai_feature_health USING btree (status);

-- AI Health Alerts
CREATE INDEX IF NOT EXISTS idx_ai_health_alerts_unacked ON public.ai_health_alerts USING btree (is_acknowledged, created_at DESC) WHERE (NOT is_acknowledged);

-- AI Health Checks
CREATE INDEX IF NOT EXISTS idx_ai_health_checks_feature ON public.ai_health_checks USING btree (feature_id, created_at DESC);

-- AI Health Monitoring
CREATE INDEX IF NOT EXISTS idx_ai_health_monitoring_checked ON public.ai_health_monitoring USING btree (checked_at);
CREATE INDEX IF NOT EXISTS idx_ai_health_monitoring_checked_at ON public.ai_health_monitoring USING btree (checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_health_monitoring_feature ON public.ai_health_monitoring USING btree (feature_name);
CREATE INDEX IF NOT EXISTS idx_ai_health_monitoring_status ON public.ai_health_monitoring USING btree (status);

-- AI Model Configurations
CREATE INDEX IF NOT EXISTS idx_ai_model_configurations_enabled ON public.ai_model_configurations USING btree (enabled);
CREATE INDEX IF NOT EXISTS idx_ai_model_configurations_feature ON public.ai_model_configurations USING btree (feature_name);

-- AI Model Performance
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_feature ON public.ai_model_performance USING btree (feature_id, is_active_test);

-- AI Provider Credentials
CREATE INDEX IF NOT EXISTS idx_ai_provider_credentials_provider ON public.ai_provider_credentials USING btree (provider_id);

-- AI Usage Logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON public.ai_usage_logs USING btree (feature_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_interview_id ON public.ai_usage_logs USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_created ON public.ai_usage_logs USING btree (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_organization_id ON public.ai_usage_logs USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs USING btree (user_id);

-- ============================================================================
-- SECTION 2: ANALYTICS & ASSESSMENTS INDEXES
-- ============================================================================

-- Analytics Snapshots
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON public.analytics_snapshots USING btree (snapshot_date);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_org ON public.analytics_snapshots USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_org_date ON public.analytics_snapshots USING btree (organization_id, snapshot_date);

-- Predictive Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_org ON public.predictive_analytics USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON public.predictive_analytics USING btree (analysis_type);

-- Approval Workflows
CREATE INDEX IF NOT EXISTS idx_workflows_entity ON public.approval_workflows USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.approval_workflows USING btree (status);

-- Architecture Documents
CREATE INDEX IF NOT EXISTS idx_architecture_documents_section ON public.architecture_documents USING btree (section);

-- Assessments
CREATE INDEX IF NOT EXISTS idx_assessments_attempt ON public.assessments USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessments_organization_id ON public.assessments USING btree (organization_id);

-- ATS Candidates
CREATE INDEX IF NOT EXISTS idx_ats_candidates_email ON public.ats_candidates USING btree (email);
CREATE INDEX IF NOT EXISTS idx_ats_candidates_integration ON public.ats_candidates USING btree (integration_id);
CREATE INDEX IF NOT EXISTS idx_ats_candidates_interview ON public.ats_candidates USING btree (interview_id);

-- ATS Integrations
CREATE INDEX IF NOT EXISTS idx_ats_integrations_org ON public.ats_integrations USING btree (organization_id);

-- ATS Sync Logs
CREATE INDEX IF NOT EXISTS idx_ats_sync_logs_integration ON public.ats_sync_logs USING btree (integration_id);

-- Attempt Questions
CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt_id ON public.attempt_questions USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_questions_question_id ON public.attempt_questions USING btree (question_id);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);

-- Bias Detection Results
CREATE INDEX IF NOT EXISTS idx_bias_results_assessment ON public.bias_detection_results USING btree (assessment_id);

-- ============================================================================
-- SECTION 3: CANDIDATE & CERTIFICATE INDEXES
-- ============================================================================

-- Candidate Performance Index
CREATE INDEX IF NOT EXISTS idx_cpi_attempt_id ON public.candidate_performance_index USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_cpi_created_at ON public.candidate_performance_index USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpi_interview_id ON public.candidate_performance_index USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_cpi_overall_score ON public.candidate_performance_index USING btree (overall_cpi DESC);

-- Certificate Badges
CREATE INDEX IF NOT EXISTS idx_certificate_badges_category ON public.certificate_badges USING btree (category);
CREATE INDEX IF NOT EXISTS idx_certificate_badges_type ON public.certificate_badges USING btree (badge_type);

-- Certificates
CREATE INDEX IF NOT EXISTS idx_certificates_expires ON public.certificates USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_certificates_expires_at ON public.certificates USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates USING btree (certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_topic ON public.certificates USING btree (certification_topic_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_verification ON public.certificates USING btree (verification_code);
CREATE INDEX IF NOT EXISTS idx_certificates_verification_code ON public.certificates USING btree (verification_code);

-- Certification Assessments
CREATE INDEX IF NOT EXISTS idx_cert_assessments_status ON public.certification_assessments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cert_assessments_topic ON public.certification_assessments USING btree (certification_topic_id);

-- Certification Attempts
CREATE INDEX IF NOT EXISTS idx_cert_attempts_assessment ON public.certification_attempts USING btree (certification_assessment_id);
CREATE INDEX IF NOT EXISTS idx_cert_attempts_passed ON public.certification_attempts USING btree (passed);
CREATE INDEX IF NOT EXISTS idx_cert_attempts_status ON public.certification_attempts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cert_attempts_user ON public.certification_attempts USING btree (user_id);

-- Certification Topics
CREATE INDEX IF NOT EXISTS idx_cert_topics_active ON public.certification_topics USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_cert_topics_category ON public.certification_topics USING btree (category);

-- ============================================================================
-- SECTION 4: CHATBOT & CIRCUIT BREAKER INDEXES
-- ============================================================================

-- Chatbot Knowledge
CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_active ON public.chatbot_knowledge USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_category ON public.chatbot_knowledge USING btree (category);

-- Circuit Breaker State
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_service ON public.circuit_breaker_state USING btree (service_name);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state_service ON public.circuit_breaker_state USING btree (service_name);

-- Collaboration Threads
CREATE INDEX IF NOT EXISTS idx_threads_entity ON public.collaboration_threads USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_threads_resolved ON public.collaboration_threads USING btree (is_resolved);

-- Comparative Analytics
CREATE INDEX IF NOT EXISTS idx_comparative_analytics_org ON public.comparative_analytics USING btree (organization_id);

-- NOTE: custom_reports table does not exist in Production Cloud - indexes removed

-- Custom Roles
CREATE INDEX IF NOT EXISTS idx_custom_roles_active ON public.custom_roles USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_custom_roles_org ON public.custom_roles USING btree (organization_id);

-- ============================================================================
-- SECTION 5: DATA RETENTION & EMAIL INDEXES
-- ============================================================================

-- Data Retention Policies
CREATE INDEX IF NOT EXISTS idx_data_retention_org ON public.data_retention_policies USING btree (organization_id);

-- Email Logs
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_organization_id ON public.email_logs USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs USING btree (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON public.email_logs USING btree (template_key);

-- Email Templates
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_platform_default_idx ON public.email_templates USING btree (template_key) WHERE (organization_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON public.email_templates USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_template ON public.email_templates USING btree (organization_id, template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_template_key ON public.email_templates USING btree (template_key);

-- ============================================================================
-- SECTION 6: FAILED JOBS & IDEMPOTENCY INDEXES
-- ============================================================================

-- Failed Jobs
CREATE INDEX IF NOT EXISTS idx_failed_jobs_created ON public.failed_jobs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_function ON public.failed_jobs USING btree (function_name);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_lookup ON public.failed_jobs USING btree (function_name, processed, retry_count);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_next_retry ON public.failed_jobs USING btree (next_retry_at) WHERE (processed = false);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_status ON public.failed_jobs USING btree (processed);

-- Idempotency Keys
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON public.idempotency_keys USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_cleanup ON public.idempotency_keys USING btree (expires_at) WHERE (expires_at < now());
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys USING btree (key);

-- ============================================================================
-- SECTION 7: INTERVIEW INDEXES
-- ============================================================================

-- Interview Attempts
CREATE INDEX IF NOT EXISTS idx_attempts_email ON public.interview_attempts USING btree (candidate_email);
CREATE INDEX IF NOT EXISTS idx_attempts_interview ON public.interview_attempts USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_attempts_invitation ON public.interview_attempts USING btree (invitation_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.interview_attempts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_candidate_email ON public.interview_attempts USING btree (candidate_email);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_interview_id ON public.interview_attempts USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_session_token ON public.interview_attempts USING btree (session_token);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_status ON public.interview_attempts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_submitted_at ON public.interview_attempts USING btree (submitted_at);

-- Interview Invitations
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.interview_invitations USING btree (candidate_email);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON public.interview_invitations USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_interview ON public.interview_invitations USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_invitations_share_token ON public.interview_invitations USING btree (share_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.interview_invitations USING btree (status);

-- Interview Operation Logs
CREATE INDEX IF NOT EXISTS idx_interview_operation_logs_created ON public.interview_operation_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_operation_logs_interview ON public.interview_operation_logs USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_operation_logs_operation ON public.interview_operation_logs USING btree (operation);
CREATE INDEX IF NOT EXISTS idx_interview_operation_logs_status ON public.interview_operation_logs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_interview ON public.interview_operation_logs USING btree (interview_id);

-- Interview Panel Members
CREATE INDEX IF NOT EXISTS idx_panel_interview ON public.interview_panel_members USING btree (interview_id);

-- Interviews
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON public.interviews USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_creator ON public.interviews USING btree (creator_id);
CREATE INDEX IF NOT EXISTS idx_interviews_gen_status ON public.interviews USING btree (generation_status);
CREATE INDEX IF NOT EXISTS idx_interviews_organization ON public.interviews USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_interviews_organization_id ON public.interviews USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_interviews_share_link ON public.interviews USING btree (share_link);
CREATE INDEX IF NOT EXISTS idx_interviews_slug ON public.interviews USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON public.interviews USING btree (status);

-- ============================================================================
-- SECTION 8: INVOICE & FINANCIAL INDEXES
-- ============================================================================

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_created ON public.invoices USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices USING btree (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices USING btree (status);

-- Payment Methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON public.payment_methods USING btree (organization_id);

-- Payment Transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON public.payment_transactions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice ON public.payment_transactions USING btree (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_org ON public.payment_transactions USING btree (organization_id);

-- ============================================================================
-- SECTION 9: LEARNING INDEXES
-- ============================================================================

-- Learning Assessments
CREATE INDEX IF NOT EXISTS idx_learning_assessments_plan ON public.learning_assessments USING btree (learning_plan_id);
CREATE INDEX IF NOT EXISTS idx_learning_assessments_status ON public.learning_assessments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_learning_assessments_topic ON public.learning_assessments USING btree (topic_id);

-- Learning Assessment Attempts
CREATE INDEX IF NOT EXISTS idx_learning_attempts_assessment ON public.learning_assessment_attempts USING btree (assessment_id);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_status ON public.learning_assessment_attempts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_user ON public.learning_assessment_attempts USING btree (user_id);

-- Learning Assessment Questions
CREATE INDEX IF NOT EXISTS idx_learning_questions_assessment ON public.learning_assessment_questions USING btree (assessment_id);
CREATE INDEX IF NOT EXISTS idx_learning_questions_difficulty ON public.learning_assessment_questions USING btree (difficulty);
CREATE INDEX IF NOT EXISTS idx_learning_questions_topic ON public.learning_assessment_questions USING btree (topic);

-- NOTE: learning_feedback, learning_paths, learning_path_topics, learning_progress, learning_resources
-- tables do not exist in Production Cloud - these indexes have been removed

-- Learning Subscriptions
CREATE INDEX IF NOT EXISTS idx_learning_subscriptions_plan ON public.learning_subscriptions USING btree (plan_type);
CREATE INDEX IF NOT EXISTS idx_learning_subscriptions_status ON public.learning_subscriptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_learning_subscriptions_user ON public.learning_subscriptions USING btree (user_id);

-- ============================================================================
-- SECTION 10: NOTIFICATION & ORGANIZATION INDEXES
-- ============================================================================

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications USING btree (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);

-- Onboarding Progress
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org ON public.onboarding_progress USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON public.onboarding_progress USING btree (user_id);

-- Organization Members
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON public.organization_members USING btree (status);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members USING btree (user_id);

-- Organization Subscriptions
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org ON public.organization_subscriptions USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan ON public.organization_subscriptions USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON public.organization_subscriptions USING btree (status);

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations USING btree (status);

-- ============================================================================
-- SECTION 11: PANEL & PARTNER INDEXES
-- ============================================================================

-- Panel Consensus
CREATE INDEX IF NOT EXISTS idx_panel_consensus_attempt ON public.panel_consensus USING btree (attempt_id);

-- Panel Evaluations
CREATE INDEX IF NOT EXISTS idx_panel_evaluations_attempt ON public.panel_evaluations USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_panel_evaluations_evaluator ON public.panel_evaluations USING btree (evaluator_id);

-- Partner Applications
CREATE INDEX IF NOT EXISTS idx_partner_applications_org ON public.partner_applications USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON public.partner_applications USING btree (status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_user ON public.partner_applications USING btree (applicant_user_id);

-- ============================================================================
-- SECTION 12: PLATFORM CONFIG INDEXES
-- ============================================================================

-- Platform Configurations (CORRECTED table name)
CREATE INDEX IF NOT EXISTS idx_platform_configurations_category ON public.platform_configurations USING btree (category);
CREATE INDEX IF NOT EXISTS idx_platform_configurations_key ON public.platform_configurations USING btree (config_key);

-- Pre-Interview Check Logs (CORRECTED table name: preinterview_check_logs)
CREATE INDEX IF NOT EXISTS idx_preinterview_check_attempt ON public.preinterview_check_logs USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_preinterview_check_passed ON public.preinterview_check_logs USING btree (passed);

-- ============================================================================
-- SECTION 13: PROCTORING INDEXES
-- ============================================================================

-- Proctoring Sessions
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt ON public.proctoring_sessions USING btree (interview_attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_created ON public.proctoring_sessions USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_interview ON public.proctoring_sessions USING btree (interview_attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_status ON public.proctoring_sessions USING btree (status);

-- Proctoring Violations
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_session ON public.proctoring_violations USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_severity ON public.proctoring_violations USING btree (severity);
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_type ON public.proctoring_violations USING btree (violation_type);
CREATE INDEX IF NOT EXISTS idx_violations_session ON public.proctoring_violations USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON public.proctoring_violations USING btree (violation_type);

-- ============================================================================
-- SECTION 14: PROFILES & PROMOTIONS INDEXES
-- ============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
-- NOTE: idx_profiles_impersonated_by removed - column does not exist in Production Cloud

-- Promotion Usages
CREATE INDEX IF NOT EXISTS idx_promotion_usages_org ON public.promotion_usages USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion ON public.promotion_usages USING btree (promotion_id);

-- Promotions
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions USING btree (is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions USING btree (code);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON public.promotions USING btree (valid_from, valid_until);

-- ============================================================================
-- SECTION 15: QUESTIONS INDEXES
-- ============================================================================

-- NOTE: question_repository and question_review_workflow tables do not exist in Production Cloud
-- Those indexes have been removed

-- Questions
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions USING btree (difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_interview ON public.questions USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_questions_interview_id ON public.questions USING btree (interview_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions USING btree (topic);
CREATE INDEX IF NOT EXISTS idx_questions_type ON public.questions USING btree (question_type);

-- ============================================================================
-- SECTION 16: RATE LIMITING INDEXES
-- ============================================================================

-- Rate Limit Buckets
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires ON public.rate_limit_buckets USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_key ON public.rate_limit_buckets USING btree (bucket_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_lookup ON public.rate_limit_buckets USING btree (bucket_key, bucket_type);

-- ============================================================================
-- SECTION 17: SUBSCRIPTION & TEMPLATE INDEXES
-- ============================================================================

-- Subscription Plans
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON public.subscription_plans USING btree (name);
-- NOTE: idx_subscription_plans_slug removed - slug column does not exist in Production Cloud

-- NOTE: test_templates, flow_test_definitions, flow_test_runs tables do not exist in Production Cloud
-- Those indexes have been removed

-- ============================================================================
-- SECTION 18: TRAINING & TEST INDEXES
-- ============================================================================

-- Training Plans
CREATE INDEX IF NOT EXISTS idx_training_plans_assigned_to ON public.training_plans USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_training_plans_created_by ON public.training_plans USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_training_plans_org ON public.training_plans USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_status ON public.training_plans USING btree (status);

-- Test Runs
CREATE INDEX IF NOT EXISTS idx_test_runs_started_at ON public.test_runs USING btree (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON public.test_runs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON public.test_runs USING btree (suite_id);

-- Test Suites
CREATE INDEX IF NOT EXISTS idx_test_suites_active ON public.test_suites USING btree (is_active);

-- ============================================================================
-- SECTION 19: USER INDEXES
-- ============================================================================

-- User Badges
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges USING btree (badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges USING btree (user_id);

-- User Custom Roles
CREATE INDEX IF NOT EXISTS idx_user_custom_roles_org ON public.user_custom_roles USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_roles_role ON public.user_custom_roles USING btree (custom_role_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user ON public.user_custom_roles USING btree (user_id);

-- User Roles
CREATE INDEX IF NOT EXISTS idx_user_roles_org ON public.user_roles USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles USING btree (user_id, role);

-- Usage Tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_org ON public.usage_tracking USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON public.usage_tracking USING btree (period_start, period_end);

-- ============================================================================
-- COMPLETE
-- ============================================================================
