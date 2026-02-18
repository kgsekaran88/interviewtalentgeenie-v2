-- ============================================================================
-- FRESH DEPLOYMENT: 08 - INDEXES
-- Run AFTER tables and RLS policies
-- Auto-generated from Production Cloud schema on 2024-12-27
-- ============================================================================

-- Note: Primary key indexes (xxx_pkey) and unique constraint indexes are created
-- automatically when tables are created. This file contains additional indexes
-- for performance optimization.

-- ============================================================================
-- HELPER FUNCTIONS: Create indexes only if table/column exists
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.create_index_if_column_exists(
  p_table_name text,
  p_column_name text,
  p_index_sql text
) RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    EXECUTE p_index_sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.create_index_if_table_exists(
  p_table_name text,
  p_index_sql text
) RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = p_table_name
  ) THEN
    EXECUTE p_index_sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ACTIVITY_FEED INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('activity_feed', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_feed USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('activity_feed', 'actor_id',
  'CREATE INDEX IF NOT EXISTS idx_activity_feed_actor ON public.activity_feed USING btree (actor_id)');
SELECT pg_temp.create_index_if_column_exists('activity_feed', 'entity_type',
  'CREATE INDEX IF NOT EXISTS idx_activity_feed_entity ON public.activity_feed USING btree (entity_type, entity_id)');
SELECT pg_temp.create_index_if_column_exists('activity_feed', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_activity_feed_org ON public.activity_feed USING btree (organization_id)');

-- ============================================================================
-- AI_COACH_SESSIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_coach_sessions', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_attempt ON public.ai_coach_sessions USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('ai_coach_sessions', 'candidate_email',
  'CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_email ON public.ai_coach_sessions USING btree (candidate_email)');
SELECT pg_temp.create_index_if_column_exists('ai_coach_sessions', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_interview ON public.ai_coach_sessions USING btree (interview_id)');

-- ============================================================================
-- AI_FEATURE_ALERTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_feature_alerts', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_created ON public.ai_feature_alerts USING btree (created_at)');
SELECT pg_temp.create_index_if_column_exists('ai_feature_alerts', 'feature_name',
  'CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_feature ON public.ai_feature_alerts USING btree (feature_name)');
SELECT pg_temp.create_index_if_column_exists('ai_feature_alerts', 'resolved_at',
  'CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_resolved ON public.ai_feature_alerts USING btree (resolved_at) WHERE (resolved_at IS NULL)');
SELECT pg_temp.create_index_if_column_exists('ai_feature_alerts', 'severity',
  'CREATE INDEX IF NOT EXISTS idx_ai_feature_alerts_severity ON public.ai_feature_alerts USING btree (severity)');

-- ============================================================================
-- AI_FEATURE_CONFIGURATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_feature_configurations', 'fallback_provider_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_feature_configs_fallback_provider ON public.ai_feature_configurations USING btree (fallback_provider_id)');
SELECT pg_temp.create_index_if_column_exists('ai_feature_configurations', 'primary_provider_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_feature_configs_primary_provider ON public.ai_feature_configurations USING btree (primary_provider_id)');

-- ============================================================================
-- AI_FEATURE_HEALTH INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_feature_health', 'status',
  'CREATE INDEX IF NOT EXISTS idx_ai_feature_health_status ON public.ai_feature_health USING btree (status)');

-- ============================================================================
-- AI_HEALTH_ALERTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_health_alerts', 'is_acknowledged',
  'CREATE INDEX IF NOT EXISTS idx_ai_health_alerts_unacked ON public.ai_health_alerts USING btree (is_acknowledged, created_at DESC) WHERE (NOT is_acknowledged)');

-- ============================================================================
-- AI_HEALTH_CHECKS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_health_checks', 'feature_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_health_checks_feature ON public.ai_health_checks USING btree (feature_id, created_at DESC)');

-- ============================================================================
-- AI_HEALTH_MONITORING INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_health_monitoring', 'checked_at',
  'CREATE INDEX IF NOT EXISTS idx_ai_health_monitoring_checked ON public.ai_health_monitoring USING btree (checked_at)');
SELECT pg_temp.create_index_if_column_exists('ai_health_monitoring', 'feature_name',
  'CREATE INDEX IF NOT EXISTS idx_ai_health_monitoring_feature ON public.ai_health_monitoring USING btree (feature_name)');
SELECT pg_temp.create_index_if_column_exists('ai_health_monitoring', 'status',
  'CREATE INDEX IF NOT EXISTS idx_ai_health_monitoring_status ON public.ai_health_monitoring USING btree (status)');

-- ============================================================================
-- AI_MODEL_CONFIGURATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_model_configurations', 'enabled',
  'CREATE INDEX IF NOT EXISTS idx_ai_model_configurations_enabled ON public.ai_model_configurations USING btree (enabled)');
SELECT pg_temp.create_index_if_column_exists('ai_model_configurations', 'feature_name',
  'CREATE INDEX IF NOT EXISTS idx_ai_model_configurations_feature ON public.ai_model_configurations USING btree (feature_name)');

-- ============================================================================
-- AI_MODEL_PERFORMANCE INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_model_performance', 'feature_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_model_performance_feature ON public.ai_model_performance USING btree (feature_id, is_active_test)');

-- ============================================================================
-- AI_PROVIDER_CREDENTIALS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_provider_credentials', 'provider_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_provider_credentials_provider ON public.ai_provider_credentials USING btree (provider_id)');

-- ============================================================================
-- AI_USAGE_LOGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ai_usage_logs', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('ai_usage_logs', 'feature_name',
  'CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON public.ai_usage_logs USING btree (feature_name)');
SELECT pg_temp.create_index_if_column_exists('ai_usage_logs', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_interview_id ON public.ai_usage_logs USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('ai_usage_logs', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_created ON public.ai_usage_logs USING btree (organization_id, created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('ai_usage_logs', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs USING btree (user_id)');

-- ============================================================================
-- ANALYTICS_SNAPSHOTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('analytics_snapshots', 'snapshot_date',
  'CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON public.analytics_snapshots USING btree (snapshot_date)');
SELECT pg_temp.create_index_if_column_exists('analytics_snapshots', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_org ON public.analytics_snapshots USING btree (organization_id)');

-- ============================================================================
-- APPROVAL_WORKFLOWS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('approval_workflows', 'entity_type',
  'CREATE INDEX IF NOT EXISTS idx_workflows_entity ON public.approval_workflows USING btree (entity_type, entity_id)');
SELECT pg_temp.create_index_if_column_exists('approval_workflows', 'status',
  'CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.approval_workflows USING btree (status)');

-- ============================================================================
-- ARCHITECTURE_DOCUMENTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('architecture_documents', 'section',
  'CREATE INDEX IF NOT EXISTS idx_architecture_documents_section ON public.architecture_documents USING btree (section)');

-- ============================================================================
-- ASSESSMENTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('assessments', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_assessments_attempt ON public.assessments USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('assessments', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_assessments_organization_id ON public.assessments USING btree (organization_id)');

-- ============================================================================
-- ATS_CANDIDATES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ats_candidates', 'email',
  'CREATE INDEX IF NOT EXISTS idx_ats_candidates_email ON public.ats_candidates USING btree (email)');
SELECT pg_temp.create_index_if_column_exists('ats_candidates', 'integration_id',
  'CREATE INDEX IF NOT EXISTS idx_ats_candidates_integration ON public.ats_candidates USING btree (integration_id)');
SELECT pg_temp.create_index_if_column_exists('ats_candidates', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_ats_candidates_interview ON public.ats_candidates USING btree (interview_id)');

-- ============================================================================
-- ATS_INTEGRATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ats_integrations', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_ats_integrations_org ON public.ats_integrations USING btree (organization_id)');

-- ============================================================================
-- ATS_SYNC_LOGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('ats_sync_logs', 'integration_id',
  'CREATE INDEX IF NOT EXISTS idx_ats_sync_logs_integration ON public.ats_sync_logs USING btree (integration_id)');

-- ============================================================================
-- ATTEMPT_QUESTIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('attempt_questions', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt_id ON public.attempt_questions USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('attempt_questions', 'question_id',
  'CREATE INDEX IF NOT EXISTS idx_attempt_questions_question_id ON public.attempt_questions USING btree (question_id)');

-- ============================================================================
-- AUDIT_LOGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('audit_logs', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('audit_logs', 'table_name',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs USING btree (table_name)');
SELECT pg_temp.create_index_if_column_exists('audit_logs', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id)');

-- ============================================================================
-- BIAS_DETECTION_RESULTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('bias_detection_results', 'assessment_id',
  'CREATE INDEX IF NOT EXISTS idx_bias_results_assessment ON public.bias_detection_results USING btree (assessment_id)');

-- ============================================================================
-- CANDIDATE_PERFORMANCE_INDEX INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('candidate_performance_index', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_cpi_attempt_id ON public.candidate_performance_index USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('candidate_performance_index', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_cpi_created_at ON public.candidate_performance_index USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('candidate_performance_index', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_cpi_interview_id ON public.candidate_performance_index USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('candidate_performance_index', 'overall_cpi',
  'CREATE INDEX IF NOT EXISTS idx_cpi_overall_score ON public.candidate_performance_index USING btree (overall_cpi DESC)');

-- ============================================================================
-- CERTIFICATE_BADGES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('certificate_badges', 'category',
  'CREATE INDEX IF NOT EXISTS idx_certificate_badges_category ON public.certificate_badges USING btree (category)');
SELECT pg_temp.create_index_if_column_exists('certificate_badges', 'badge_type',
  'CREATE INDEX IF NOT EXISTS idx_certificate_badges_type ON public.certificate_badges USING btree (badge_type)');

-- ============================================================================
-- CERTIFICATES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('certificates', 'expires_at',
  'CREATE INDEX IF NOT EXISTS idx_certificates_expires ON public.certificates USING btree (expires_at)');
SELECT pg_temp.create_index_if_column_exists('certificates', 'certificate_number',
  'CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates USING btree (certificate_number)');
SELECT pg_temp.create_index_if_column_exists('certificates', 'certification_topic_id',
  'CREATE INDEX IF NOT EXISTS idx_certificates_topic ON public.certificates USING btree (certification_topic_id)');
SELECT pg_temp.create_index_if_column_exists('certificates', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates USING btree (user_id)');
SELECT pg_temp.create_index_if_column_exists('certificates', 'verification_code',
  'CREATE INDEX IF NOT EXISTS idx_certificates_verification ON public.certificates USING btree (verification_code)');

-- ============================================================================
-- CERTIFICATION_ASSESSMENTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('certification_assessments', 'certification_topic_id',
  'CREATE INDEX IF NOT EXISTS idx_certification_assessments_topic ON public.certification_assessments USING btree (certification_topic_id)');

-- ============================================================================
-- CERTIFICATION_ATTEMPTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('certification_attempts', 'certification_assessment_id',
  'CREATE INDEX IF NOT EXISTS idx_certification_attempts_assessment ON public.certification_attempts USING btree (certification_assessment_id)');
SELECT pg_temp.create_index_if_column_exists('certification_attempts', 'status',
  'CREATE INDEX IF NOT EXISTS idx_certification_attempts_status ON public.certification_attempts USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('certification_attempts', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_certification_attempts_user ON public.certification_attempts USING btree (user_id)');

-- ============================================================================
-- CERTIFICATION_TOPICS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('certification_topics', 'category',
  'CREATE INDEX IF NOT EXISTS idx_certification_topics_category ON public.certification_topics USING btree (category)');

-- ============================================================================
-- CHATBOT_KNOWLEDGE INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('chatbot_knowledge', 'is_active',
  'CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_active ON public.chatbot_knowledge USING btree (is_active)');
SELECT pg_temp.create_index_if_column_exists('chatbot_knowledge', 'category',
  'CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_category ON public.chatbot_knowledge USING btree (category)');

-- ============================================================================
-- CIRCUIT_BREAKER_STATE INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('circuit_breaker_state', 'state',
  'CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state ON public.circuit_breaker_state USING btree (state)');

-- ============================================================================
-- COLLABORATION_THREADS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('collaboration_threads', 'entity_type',
  'CREATE INDEX IF NOT EXISTS idx_threads_entity ON public.collaboration_threads USING btree (entity_type, entity_id)');

-- ============================================================================
-- COMPARATIVE_ANALYTICS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('comparative_analytics', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_comparative_analytics_interview ON public.comparative_analytics USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('comparative_analytics', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_comparative_analytics_org ON public.comparative_analytics USING btree (organization_id)');

-- ============================================================================
-- CONSENT_RECORDS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('consent_records', 'candidate_email',
  'CREATE INDEX IF NOT EXISTS idx_consent_records_email ON public.consent_records USING btree (candidate_email)');
SELECT pg_temp.create_index_if_column_exists('consent_records', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_consent_records_interview ON public.consent_records USING btree (interview_id)');

-- ============================================================================
-- CUSTOM_ROLES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('custom_roles', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_custom_roles_org ON public.custom_roles USING btree (organization_id)');

-- ============================================================================
-- DATA_DELETION_REQUESTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('data_deletion_requests', 'candidate_email',
  'CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_email ON public.data_deletion_requests USING btree (candidate_email)');
SELECT pg_temp.create_index_if_column_exists('data_deletion_requests', 'status',
  'CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON public.data_deletion_requests USING btree (status)');

-- ============================================================================
-- DATA_RETENTION_POLICIES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('data_retention_policies', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_data_retention_policies_org ON public.data_retention_policies USING btree (organization_id)');

-- ============================================================================
-- DOCUMENTATION INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('documentation', 'category',
  'CREATE INDEX IF NOT EXISTS idx_documentation_category ON public.documentation USING btree (category)');

-- ============================================================================
-- EMAIL_LOGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('email_logs', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('email_logs', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_email_logs_organization ON public.email_logs USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('email_logs', 'recipient_email',
  'CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs USING btree (recipient_email)');
SELECT pg_temp.create_index_if_column_exists('email_logs', 'sent',
  'CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON public.email_logs USING btree (sent)');
SELECT pg_temp.create_index_if_column_exists('email_logs', 'template',
  'CREATE INDEX IF NOT EXISTS idx_email_logs_template ON public.email_logs USING btree (template)');

-- ============================================================================
-- EMAIL_TEMPLATES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('email_templates', 'template_key',
  'CREATE INDEX IF NOT EXISTS idx_email_templates_org_key ON public.email_templates USING btree (organization_id, template_key)');

-- ============================================================================
-- FAILED_JOBS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('failed_jobs', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_failed_jobs_created ON public.failed_jobs USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('failed_jobs', 'job_type',
  'CREATE INDEX IF NOT EXISTS idx_failed_jobs_job_type ON public.failed_jobs USING btree (job_type)');
SELECT pg_temp.create_index_if_column_exists('failed_jobs', 'status',
  'CREATE INDEX IF NOT EXISTS idx_failed_jobs_status ON public.failed_jobs USING btree (status)');

-- ============================================================================
-- GENERATED_REPORTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('generated_reports', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_generated_reports_org ON public.generated_reports USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('generated_reports', 'status',
  'CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON public.generated_reports USING btree (status)');

-- ============================================================================
-- IDEMPOTENCY_KEYS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('idempotency_keys', 'expires_at',
  'CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON public.idempotency_keys USING btree (expires_at)');
SELECT pg_temp.create_index_if_column_exists('idempotency_keys', 'key',
  'CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys USING btree (key)');
SELECT pg_temp.create_index_if_column_exists('idempotency_keys', 'status',
  'CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status ON public.idempotency_keys USING btree (status)');

-- ============================================================================
-- INTERVIEW_ATTEMPTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('interview_attempts', 'candidate_email',
  'CREATE INDEX IF NOT EXISTS idx_interview_attempts_candidate_email ON public.interview_attempts USING btree (candidate_email)');
SELECT pg_temp.create_index_if_column_exists('interview_attempts', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_interview_attempts_created_at ON public.interview_attempts USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('interview_attempts', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_attempts_interview_id ON public.interview_attempts USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('interview_attempts', 'invitation_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_attempts_invitation ON public.interview_attempts USING btree (invitation_id)');
SELECT pg_temp.create_index_if_column_exists('interview_attempts', 'session_token',
  'CREATE INDEX IF NOT EXISTS idx_interview_attempts_session_token ON public.interview_attempts USING btree (session_token)');
SELECT pg_temp.create_index_if_column_exists('interview_attempts', 'status',
  'CREATE INDEX IF NOT EXISTS idx_interview_attempts_status ON public.interview_attempts USING btree (status)');

-- ============================================================================
-- INTERVIEW_INVITATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('interview_invitations', 'candidate_email',
  'CREATE INDEX IF NOT EXISTS idx_interview_invitations_candidate ON public.interview_invitations USING btree (candidate_email)');
SELECT pg_temp.create_index_if_column_exists('interview_invitations', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_invitations_interview ON public.interview_invitations USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('interview_invitations', 'status',
  'CREATE INDEX IF NOT EXISTS idx_interview_invitations_status ON public.interview_invitations USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('interview_invitations', 'invitation_token',
  'CREATE INDEX IF NOT EXISTS idx_interview_invitations_token ON public.interview_invitations USING btree (invitation_token)');

-- ============================================================================
-- INTERVIEW_OPERATION_LOGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('interview_operation_logs', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_operation_logs_interview ON public.interview_operation_logs USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('interview_operation_logs', 'operation',
  'CREATE INDEX IF NOT EXISTS idx_interview_operation_logs_operation ON public.interview_operation_logs USING btree (operation)');

-- ============================================================================
-- INTERVIEW_PANEL_MEMBERS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('interview_panel_members', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_panel_members_interview ON public.interview_panel_members USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('interview_panel_members', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_panel_members_user ON public.interview_panel_members USING btree (user_id)');

-- ============================================================================
-- INTERVIEW_SCHEDULES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('interview_schedules', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_schedules_interview ON public.interview_schedules USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('interview_schedules', 'scheduled_at',
  'CREATE INDEX IF NOT EXISTS idx_interview_schedules_scheduled ON public.interview_schedules USING btree (scheduled_at)');

-- ============================================================================
-- INTERVIEW_TEMPLATES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('interview_templates', 'category',
  'CREATE INDEX IF NOT EXISTS idx_interview_templates_category ON public.interview_templates USING btree (category)');
SELECT pg_temp.create_index_if_column_exists('interview_templates', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_interview_templates_org ON public.interview_templates USING btree (organization_id)');

-- ============================================================================
-- INTERVIEWS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('interviews', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON public.interviews USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('interviews', 'creator_id',
  'CREATE INDEX IF NOT EXISTS idx_interviews_creator ON public.interviews USING btree (creator_id)');
SELECT pg_temp.create_index_if_column_exists('interviews', 'generation_status',
  'CREATE INDEX IF NOT EXISTS idx_interviews_generation_status ON public.interviews USING btree (generation_status)');
SELECT pg_temp.create_index_if_column_exists('interviews', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_interviews_org ON public.interviews USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('interviews', 'share_link',
  'CREATE INDEX IF NOT EXISTS idx_interviews_share_link ON public.interviews USING btree (share_link)');
SELECT pg_temp.create_index_if_column_exists('interviews', 'slug',
  'CREATE INDEX IF NOT EXISTS idx_interviews_slug ON public.interviews USING btree (slug)');
SELECT pg_temp.create_index_if_column_exists('interviews', 'status',
  'CREATE INDEX IF NOT EXISTS idx_interviews_status ON public.interviews USING btree (status)');

-- ============================================================================
-- INVOICES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('invoices', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('invoices', 'status',
  'CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('invoices', 'subscription_id',
  'CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices USING btree (subscription_id)');

-- ============================================================================
-- LEARNING_ASSESSMENT_ATTEMPTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_assessment_attempts', 'assessment_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_attempts_assessment ON public.learning_assessment_attempts USING btree (assessment_id)');
SELECT pg_temp.create_index_if_column_exists('learning_assessment_attempts', 'status',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_attempts_status ON public.learning_assessment_attempts USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('learning_assessment_attempts', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_attempts_user ON public.learning_assessment_attempts USING btree (user_id)');

-- ============================================================================
-- LEARNING_ASSESSMENT_FEEDBACK INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_assessment_feedback', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_feedback_attempt ON public.learning_assessment_feedback USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('learning_assessment_feedback', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_feedback_user ON public.learning_assessment_feedback USING btree (user_id)');

-- ============================================================================
-- LEARNING_ASSESSMENT_QUESTIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_assessment_questions', 'assessment_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_questions_assessment ON public.learning_assessment_questions USING btree (assessment_id)');

-- ============================================================================
-- LEARNING_ASSESSMENT_USAGE INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_assessment_usage', 'usage_date',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_usage_date ON public.learning_assessment_usage USING btree (usage_date)');
SELECT pg_temp.create_index_if_column_exists('learning_assessment_usage', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessment_usage_user ON public.learning_assessment_usage USING btree (user_id)');

-- ============================================================================
-- LEARNING_ASSESSMENTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_assessments', 'learning_plan_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessments_plan ON public.learning_assessments USING btree (learning_plan_id)');
SELECT pg_temp.create_index_if_column_exists('learning_assessments', 'status',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessments_status ON public.learning_assessments USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('learning_assessments', 'topic',
  'CREATE INDEX IF NOT EXISTS idx_learning_assessments_topic ON public.learning_assessments USING btree (topic)');

-- ============================================================================
-- LEARNING_MATERIALS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_materials', 'training_topic_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_materials_topic ON public.learning_materials USING btree (training_topic_id)');

-- ============================================================================
-- LEARNING_PAYMENTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_payments', 'assessment_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_payments_assessment ON public.learning_payments USING btree (assessment_id)');
SELECT pg_temp.create_index_if_column_exists('learning_payments', 'status',
  'CREATE INDEX IF NOT EXISTS idx_learning_payments_status ON public.learning_payments USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('learning_payments', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_payments_user ON public.learning_payments USING btree (user_id)');

-- ============================================================================
-- LEARNING_PLANS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_plans', 'status',
  'CREATE INDEX IF NOT EXISTS idx_learning_plans_status ON public.learning_plans USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('learning_plans', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_plans_user ON public.learning_plans USING btree (user_id)');

-- ============================================================================
-- LEARNING_SUBSCRIPTIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('learning_subscriptions', 'status',
  'CREATE INDEX IF NOT EXISTS idx_learning_subscriptions_status ON public.learning_subscriptions USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('learning_subscriptions', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_learning_subscriptions_user ON public.learning_subscriptions USING btree (user_id)');

-- ============================================================================
-- NOTIFICATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('notifications', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('notifications', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('notifications', 'is_read',
  'CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications USING btree (is_read)');
SELECT pg_temp.create_index_if_column_exists('notifications', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id)');

-- ============================================================================
-- ONBOARDING_PROGRESS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('onboarding_progress', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON public.onboarding_progress USING btree (user_id)');

-- ============================================================================
-- ORGANIZATION_MEMBERS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('organization_members', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('organization_members', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members USING btree (user_id)');

-- ============================================================================
-- ORGANIZATION_SUBSCRIPTIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('organization_subscriptions', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_org ON public.organization_subscriptions USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('organization_subscriptions', 'plan_id',
  'CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan ON public.organization_subscriptions USING btree (plan_id)');
SELECT pg_temp.create_index_if_column_exists('organization_subscriptions', 'status',
  'CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_status ON public.organization_subscriptions USING btree (status)');

-- ============================================================================
-- ORGANIZATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('organizations', 'slug',
  'CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations USING btree (slug)');
SELECT pg_temp.create_index_if_column_exists('organizations', 'status',
  'CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations USING btree (status)');

-- ============================================================================
-- PANEL_CONSENSUS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('panel_consensus', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_panel_consensus_attempt ON public.panel_consensus USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('panel_consensus', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_panel_consensus_interview ON public.panel_consensus USING btree (interview_id)');

-- ============================================================================
-- PANEL_EVALUATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('panel_evaluations', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_panel_evaluations_attempt ON public.panel_evaluations USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('panel_evaluations', 'evaluator_id',
  'CREATE INDEX IF NOT EXISTS idx_panel_evaluations_evaluator ON public.panel_evaluations USING btree (evaluator_id)');
SELECT pg_temp.create_index_if_column_exists('panel_evaluations', 'reviewer_id',
  'CREATE INDEX IF NOT EXISTS idx_panel_evaluations_reviewer ON public.panel_evaluations USING btree (reviewer_id)');

-- ============================================================================
-- PARTNER_APPLICATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('partner_applications', 'applicant_user_id',
  'CREATE INDEX IF NOT EXISTS idx_partner_applications_applicant ON public.partner_applications USING btree (applicant_user_id)');
SELECT pg_temp.create_index_if_column_exists('partner_applications', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_partner_applications_org ON public.partner_applications USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('partner_applications', 'status',
  'CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON public.partner_applications USING btree (status)');

-- ============================================================================
-- PASSWORD_SETUP_INVITATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('password_setup_invitations', 'email',
  'CREATE INDEX IF NOT EXISTS idx_password_setup_invitations_email ON public.password_setup_invitations USING btree (email)');
SELECT pg_temp.create_index_if_column_exists('password_setup_invitations', 'status',
  'CREATE INDEX IF NOT EXISTS idx_password_setup_invitations_status ON public.password_setup_invitations USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('password_setup_invitations', 'token',
  'CREATE INDEX IF NOT EXISTS idx_password_setup_invitations_token ON public.password_setup_invitations USING btree (token)');

-- ============================================================================
-- PAYMENT_GATEWAYS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('payment_gateways', 'is_active',
  'CREATE INDEX IF NOT EXISTS idx_payment_gateways_active ON public.payment_gateways USING btree (is_active)');
SELECT pg_temp.create_index_if_column_exists('payment_gateways', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_payment_gateways_org ON public.payment_gateways USING btree (organization_id)');

-- ============================================================================
-- PAYMENT_METHODS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('payment_methods', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON public.payment_methods USING btree (organization_id)');

-- ============================================================================
-- PAYMENT_TRANSACTIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('payment_transactions', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_payment_transactions_org ON public.payment_transactions USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('payment_transactions', 'status',
  'CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions USING btree (status)');

-- ============================================================================
-- PLATFORM_CONFIGURATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('platform_configurations', 'category',
  'CREATE INDEX IF NOT EXISTS idx_platform_configurations_category ON public.platform_configurations USING btree (category)');
SELECT pg_temp.create_index_if_column_exists('platform_configurations', 'key',
  'CREATE INDEX IF NOT EXISTS idx_platform_configurations_key ON public.platform_configurations USING btree (key)');

-- ============================================================================
-- PLATFORM_DOCUMENTATION INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('platform_documentation', 'category',
  'CREATE INDEX IF NOT EXISTS idx_platform_documentation_category ON public.platform_documentation USING btree (category)');
SELECT pg_temp.create_index_if_column_exists('platform_documentation', 'parent_id',
  'CREATE INDEX IF NOT EXISTS idx_platform_documentation_parent ON public.platform_documentation USING btree (parent_id)');
SELECT pg_temp.create_index_if_column_exists('platform_documentation', 'is_published',
  'CREATE INDEX IF NOT EXISTS idx_platform_documentation_published ON public.platform_documentation USING btree (is_published)');

-- ============================================================================
-- PLATFORM_DOCUMENTATION_VERSIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('platform_documentation_versions', 'doc_id',
  'CREATE INDEX IF NOT EXISTS idx_platform_documentation_versions_doc ON public.platform_documentation_versions USING btree (doc_id)');

-- ============================================================================
-- PREDICTIVE_ANALYTICS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('predictive_analytics', 'entity_type',
  'CREATE INDEX IF NOT EXISTS idx_predictive_analytics_entity ON public.predictive_analytics USING btree (entity_type, entity_id)');
SELECT pg_temp.create_index_if_column_exists('predictive_analytics', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_predictive_analytics_org ON public.predictive_analytics USING btree (organization_id)');

-- ============================================================================
-- PREINTERVIEW_CHECK_LOGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('preinterview_check_logs', 'attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_preinterview_check_logs_attempt ON public.preinterview_check_logs USING btree (attempt_id)');
SELECT pg_temp.create_index_if_column_exists('preinterview_check_logs', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_preinterview_check_logs_created ON public.preinterview_check_logs USING btree (created_at DESC)');

-- ============================================================================
-- PROCTORING_SESSIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'interview_attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt ON public.proctoring_sessions USING btree (interview_attempt_id)');
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'certification_attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_certification ON public.proctoring_sessions USING btree (certification_attempt_id)');
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_created ON public.proctoring_sessions USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'flagged_for_review',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_flagged ON public.proctoring_sessions USING btree (flagged_for_review)');
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'learning_attempt_id',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_learning ON public.proctoring_sessions USING btree (learning_attempt_id)');
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_org ON public.proctoring_sessions USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'review_status',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_review_status ON public.proctoring_sessions USING btree (review_status)');
SELECT pg_temp.create_index_if_column_exists('proctoring_sessions', 'upload_status',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_upload_status ON public.proctoring_sessions USING btree (upload_status)');

-- ============================================================================
-- PROCTORING_SETTINGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('proctoring_settings', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_settings_org ON public.proctoring_settings USING btree (organization_id)');

-- ============================================================================
-- PROCTORING_VIOLATIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('proctoring_violations', 'session_id',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_violations_session ON public.proctoring_violations USING btree (session_id)');
SELECT pg_temp.create_index_if_column_exists('proctoring_violations', 'severity',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_violations_severity ON public.proctoring_violations USING btree (severity)');
SELECT pg_temp.create_index_if_column_exists('proctoring_violations', 'violation_type',
  'CREATE INDEX IF NOT EXISTS idx_proctoring_violations_type ON public.proctoring_violations USING btree (violation_type)');

-- ============================================================================
-- PROFILES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('profiles', 'email',
  'CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email)');

-- ============================================================================
-- PROMOTION_APPLICABLE_ORGS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('promotion_applicable_orgs', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_promotion_applicable_orgs_org ON public.promotion_applicable_orgs USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('promotion_applicable_orgs', 'promotion_id',
  'CREATE INDEX IF NOT EXISTS idx_promotion_applicable_orgs_promotion ON public.promotion_applicable_orgs USING btree (promotion_id)');

-- ============================================================================
-- PROMOTION_APPLICABLE_PLANS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('promotion_applicable_plans', 'plan_id',
  'CREATE INDEX IF NOT EXISTS idx_promotion_applicable_plans_plan ON public.promotion_applicable_plans USING btree (plan_id)');
SELECT pg_temp.create_index_if_column_exists('promotion_applicable_plans', 'promotion_id',
  'CREATE INDEX IF NOT EXISTS idx_promotion_applicable_plans_promotion ON public.promotion_applicable_plans USING btree (promotion_id)');

-- ============================================================================
-- PROMOTION_USAGES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('promotion_usages', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_promotion_usages_org ON public.promotion_usages USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('promotion_usages', 'promotion_id',
  'CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion ON public.promotion_usages USING btree (promotion_id)');

-- ============================================================================
-- PROMOTIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('promotions', 'is_active',
  'CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions USING btree (is_active)');
SELECT pg_temp.create_index_if_column_exists('promotions', 'code',
  'CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions USING btree (code)');
SELECT pg_temp.create_index_if_column_exists('promotions', 'valid_from',
  'CREATE INDEX IF NOT EXISTS idx_promotions_valid_dates ON public.promotions USING btree (valid_from, valid_until)');

-- ============================================================================
-- QUESTIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('questions', 'difficulty',
  'CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions USING btree (difficulty)');
SELECT pg_temp.create_index_if_column_exists('questions', 'interview_id',
  'CREATE INDEX IF NOT EXISTS idx_questions_interview ON public.questions USING btree (interview_id)');
SELECT pg_temp.create_index_if_column_exists('questions', 'topic',
  'CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions USING btree (topic)');
SELECT pg_temp.create_index_if_column_exists('questions', 'question_type',
  'CREATE INDEX IF NOT EXISTS idx_questions_type ON public.questions USING btree (question_type)');

-- ============================================================================
-- REPORT_TEMPLATES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('report_templates', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_report_templates_org ON public.report_templates USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('report_templates', 'report_type',
  'CREATE INDEX IF NOT EXISTS idx_report_templates_type ON public.report_templates USING btree (report_type)');

-- ============================================================================
-- RESUME_PARSING_RESULTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('resume_parsing_results', 'candidate_email',
  'CREATE INDEX IF NOT EXISTS idx_resume_parsing_results_email ON public.resume_parsing_results USING btree (candidate_email)');

-- ============================================================================
-- ROLE_PERMISSIONS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('role_permissions', 'action_name',
  'CREATE INDEX IF NOT EXISTS idx_role_permissions_action ON public.role_permissions USING btree (action_name)');

-- ============================================================================
-- SECURITY_EVENTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('security_events', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('security_events', 'severity',
  'CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events USING btree (severity)');
SELECT pg_temp.create_index_if_column_exists('security_events', 'event_type',
  'CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events USING btree (event_type)');
SELECT pg_temp.create_index_if_column_exists('security_events', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events USING btree (user_id)');

-- ============================================================================
-- SUBSCRIPTION_PLANS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('subscription_plans', 'is_active',
  'CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans USING btree (is_active)');

-- ============================================================================
-- TEST_RESULTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('test_results', 'run_id',
  'CREATE INDEX IF NOT EXISTS idx_test_results_run ON public.test_results USING btree (run_id)');
SELECT pg_temp.create_index_if_column_exists('test_results', 'status',
  'CREATE INDEX IF NOT EXISTS idx_test_results_status ON public.test_results USING btree (status)');

-- ============================================================================
-- TEST_RUNS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('test_runs', 'status',
  'CREATE INDEX IF NOT EXISTS idx_test_runs_status ON public.test_runs USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('test_runs', 'suite_id',
  'CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON public.test_runs USING btree (suite_id)');

-- ============================================================================
-- TEST_SUITES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('test_suites', 'is_active',
  'CREATE INDEX IF NOT EXISTS idx_test_suites_active ON public.test_suites USING btree (is_active)');
SELECT pg_temp.create_index_if_column_exists('test_suites', 'test_type',
  'CREATE INDEX IF NOT EXISTS idx_test_suites_type ON public.test_suites USING btree (test_type)');

-- ============================================================================
-- TRAINING_PLANS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('training_plans', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_training_plans_org ON public.training_plans USING btree (organization_id)');

-- ============================================================================
-- TRAINING_TOPICS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('training_topics', 'training_plan_id',
  'CREATE INDEX IF NOT EXISTS idx_training_topics_plan ON public.training_topics USING btree (training_plan_id)');

-- ============================================================================
-- USAGE_TRACKING INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('usage_tracking', 'action_type',
  'CREATE INDEX IF NOT EXISTS idx_usage_tracking_action ON public.usage_tracking USING btree (action_type)');
SELECT pg_temp.create_index_if_column_exists('usage_tracking', 'created_at',
  'CREATE INDEX IF NOT EXISTS idx_usage_tracking_created ON public.usage_tracking USING btree (created_at DESC)');
SELECT pg_temp.create_index_if_column_exists('usage_tracking', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_usage_tracking_org ON public.usage_tracking USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('usage_tracking', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON public.usage_tracking USING btree (user_id)');

-- ============================================================================
-- USER_BADGES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('user_badges', 'badge_id',
  'CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges USING btree (badge_id)');
SELECT pg_temp.create_index_if_column_exists('user_badges', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges USING btree (user_id)');

-- ============================================================================
-- USER_CUSTOM_ROLES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('user_custom_roles', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_user_custom_roles_org ON public.user_custom_roles USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('user_custom_roles', 'custom_role_id',
  'CREATE INDEX IF NOT EXISTS idx_user_custom_roles_role ON public.user_custom_roles USING btree (custom_role_id)');
SELECT pg_temp.create_index_if_column_exists('user_custom_roles', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user ON public.user_custom_roles USING btree (user_id)');

-- ============================================================================
-- USER_ROLES INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('user_roles', 'organization_id',
  'CREATE INDEX IF NOT EXISTS idx_user_roles_org ON public.user_roles USING btree (organization_id)');
SELECT pg_temp.create_index_if_column_exists('user_roles', 'role',
  'CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles USING btree (role)');
SELECT pg_temp.create_index_if_column_exists('user_roles', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles USING btree (user_id)');

-- ============================================================================
-- USER_TOPIC_PROGRESS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('user_topic_progress', 'assignment_id',
  'CREATE INDEX IF NOT EXISTS idx_user_topic_progress_assignment ON public.user_topic_progress USING btree (assignment_id)');
SELECT pg_temp.create_index_if_column_exists('user_topic_progress', 'training_topic_id',
  'CREATE INDEX IF NOT EXISTS idx_user_topic_progress_topic ON public.user_topic_progress USING btree (training_topic_id)');
SELECT pg_temp.create_index_if_column_exists('user_topic_progress', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_user_topic_progress_user ON public.user_topic_progress USING btree (user_id)');

-- ============================================================================
-- USER_TRAINING_ASSIGNMENTS INDEXES
-- ============================================================================
SELECT pg_temp.create_index_if_column_exists('user_training_assignments', 'training_plan_id',
  'CREATE INDEX IF NOT EXISTS idx_user_training_assignments_plan ON public.user_training_assignments USING btree (training_plan_id)');
SELECT pg_temp.create_index_if_column_exists('user_training_assignments', 'status',
  'CREATE INDEX IF NOT EXISTS idx_user_training_assignments_status ON public.user_training_assignments USING btree (status)');
SELECT pg_temp.create_index_if_column_exists('user_training_assignments', 'user_id',
  'CREATE INDEX IF NOT EXISTS idx_user_training_assignments_user ON public.user_training_assignments USING btree (user_id)');

-- ============================================================================
-- DONE - All indexes wrapped with column existence checks
-- ============================================================================
