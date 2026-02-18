-- ============================================================================
-- FRESH DEPLOYMENT: 05b - TRIGGERS
-- Run AFTER functions (04_functions.sql) and RLS policies (05_rls_policies.sql)
-- Total Triggers: 62
-- Auto-generated from Production Cloud schema on 2024-12-27
-- ============================================================================

-- ============================================================================
-- AI_FEATURE_CONFIGURATIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_ai_feature_configurations_updated_at ON public.ai_feature_configurations;
CREATE TRIGGER update_ai_feature_configurations_updated_at 
  BEFORE UPDATE ON public.ai_feature_configurations 
  FOR EACH ROW EXECUTE FUNCTION update_ai_config_updated_at();

-- ============================================================================
-- AI_FEATURE_HEALTH TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_ai_feature_health_updated_at ON public.ai_feature_health;
CREATE TRIGGER update_ai_feature_health_updated_at 
  BEFORE UPDATE ON public.ai_feature_health 
  FOR EACH ROW EXECUTE FUNCTION update_ai_health_updated_at();

-- ============================================================================
-- AI_MODEL_CONFIGURATIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_ai_model_configurations_updated_at ON public.ai_model_configurations;
CREATE TRIGGER update_ai_model_configurations_updated_at 
  BEFORE UPDATE ON public.ai_model_configurations 
  FOR EACH ROW EXECUTE FUNCTION update_ai_model_config_updated_at();

-- ============================================================================
-- AI_MODEL_PERFORMANCE TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_ai_model_performance_updated_at ON public.ai_model_performance;
CREATE TRIGGER update_ai_model_performance_updated_at 
  BEFORE UPDATE ON public.ai_model_performance 
  FOR EACH ROW EXECUTE FUNCTION update_ai_health_updated_at();

-- ============================================================================
-- AI_PROVIDER_CREDENTIALS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS encrypt_api_key_on_insert_update ON public.ai_provider_credentials;
CREATE TRIGGER encrypt_api_key_on_insert_update 
  BEFORE INSERT OR UPDATE ON public.ai_provider_credentials 
  FOR EACH ROW EXECUTE FUNCTION encrypt_api_key_trigger();

DROP TRIGGER IF EXISTS update_ai_provider_credentials_updated_at ON public.ai_provider_credentials;
CREATE TRIGGER update_ai_provider_credentials_updated_at 
  BEFORE UPDATE ON public.ai_provider_credentials 
  FOR EACH ROW EXECUTE FUNCTION update_ai_config_updated_at();

-- ============================================================================
-- AI_PROVIDERS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_ai_providers_updated_at ON public.ai_providers;
CREATE TRIGGER update_ai_providers_updated_at 
  BEFORE UPDATE ON public.ai_providers 
  FOR EACH ROW EXECUTE FUNCTION update_ai_config_updated_at();

-- ============================================================================
-- AI_USAGE_LOGS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS track_ai_tokens ON public.ai_usage_logs;
CREATE TRIGGER track_ai_tokens 
  AFTER INSERT ON public.ai_usage_logs 
  FOR EACH ROW EXECUTE FUNCTION track_ai_usage();

-- ============================================================================
-- APPROVAL_WORKFLOWS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_approval_workflows_updated_at ON public.approval_workflows;
CREATE TRIGGER update_approval_workflows_updated_at 
  BEFORE UPDATE ON public.approval_workflows 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ARCHITECTURE_DOCUMENTS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_architecture_documents_updated_at ON public.architecture_documents;
CREATE TRIGGER update_architecture_documents_updated_at 
  BEFORE UPDATE ON public.architecture_documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ASSESSMENTS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS log_assessments_changes ON public.assessments;
CREATE TRIGGER log_assessments_changes 
  AFTER INSERT OR DELETE OR UPDATE ON public.assessments 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

-- ============================================================================
-- ATS_INTEGRATIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_ats_integrations_updated_at ON public.ats_integrations;
CREATE TRIGGER update_ats_integrations_updated_at 
  BEFORE UPDATE ON public.ats_integrations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CANDIDATE_PERFORMANCE_INDEX TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_candidate_performance_index_updated_at ON public.candidate_performance_index;
CREATE TRIGGER update_candidate_performance_index_updated_at 
  BEFORE UPDATE ON public.candidate_performance_index 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CERTIFICATION_TOPICS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_certification_topics_timestamp ON public.certification_topics;
CREATE TRIGGER update_certification_topics_timestamp 
  BEFORE UPDATE ON public.certification_topics 
  FOR EACH ROW EXECUTE FUNCTION update_certification_topics_updated_at();

DROP TRIGGER IF EXISTS update_certification_topics_updated_at_trigger ON public.certification_topics;
CREATE TRIGGER update_certification_topics_updated_at_trigger 
  BEFORE UPDATE ON public.certification_topics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CHATBOT_KNOWLEDGE TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_chatbot_knowledge_updated_at ON public.chatbot_knowledge;
CREATE TRIGGER update_chatbot_knowledge_updated_at 
  BEFORE UPDATE ON public.chatbot_knowledge 
  FOR EACH ROW EXECUTE FUNCTION update_chatbot_knowledge_updated_at();

-- ============================================================================
-- CIRCUIT_BREAKER_STATE TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_circuit_breaker_updated_at ON public.circuit_breaker_state;
CREATE TRIGGER update_circuit_breaker_updated_at 
  BEFORE UPDATE ON public.circuit_breaker_state 
  FOR EACH ROW EXECUTE FUNCTION update_ai_health_updated_at();

-- ============================================================================
-- COLLABORATION_THREADS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_collaboration_threads_updated_at ON public.collaboration_threads;
CREATE TRIGGER update_collaboration_threads_updated_at 
  BEFORE UPDATE ON public.collaboration_threads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CUSTOM_ROLES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON public.custom_roles;
CREATE TRIGGER update_custom_roles_updated_at 
  BEFORE UPDATE ON public.custom_roles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DATA_RETENTION_POLICIES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_data_retention_policies_updated_at ON public.data_retention_policies;
CREATE TRIGGER update_data_retention_policies_updated_at 
  BEFORE UPDATE ON public.data_retention_policies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DOCUMENTATION TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_documentation_updated_at ON public.documentation;
CREATE TRIGGER update_documentation_updated_at 
  BEFORE UPDATE ON public.documentation 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EMAIL_TEMPLATES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at 
  BEFORE UPDATE ON public.email_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FAILED_JOBS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_failed_jobs_updated_at ON public.failed_jobs;
CREATE TRIGGER update_failed_jobs_updated_at 
  BEFORE UPDATE ON public.failed_jobs 
  FOR EACH ROW EXECUTE FUNCTION update_ai_health_updated_at();

-- ============================================================================
-- INTERVIEW_ATTEMPTS TRIGGERS (8 triggers)
-- ============================================================================
DROP TRIGGER IF EXISTS auto_evaluate_on_submit ON public.interview_attempts;
CREATE TRIGGER auto_evaluate_on_submit 
  AFTER UPDATE ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION trigger_auto_evaluate();

DROP TRIGGER IF EXISTS log_interview_attempts_changes ON public.interview_attempts;
CREATE TRIGGER log_interview_attempts_changes 
  AFTER INSERT OR DELETE OR UPDATE ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

DROP TRIGGER IF EXISTS set_session_token_trigger ON public.interview_attempts;
CREATE TRIGGER set_session_token_trigger 
  BEFORE INSERT ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION set_session_token();

DROP TRIGGER IF EXISTS trigger_auto_close_proctoring ON public.interview_attempts;
CREATE TRIGGER trigger_auto_close_proctoring 
  AFTER UPDATE ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION auto_close_proctoring_on_submission();

DROP TRIGGER IF EXISTS trigger_auto_evaluate_interview ON public.interview_attempts;
CREATE TRIGGER trigger_auto_evaluate_interview 
  AFTER UPDATE OF status ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION auto_evaluate_interview();

DROP TRIGGER IF EXISTS trigger_complete_invitation ON public.interview_attempts;
CREATE TRIGGER trigger_complete_invitation 
  AFTER UPDATE ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION complete_invitation_on_submission();

DROP TRIGGER IF EXISTS trigger_increment_interviews_used ON public.interview_attempts;
CREATE TRIGGER trigger_increment_interviews_used 
  AFTER INSERT OR UPDATE OF status ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION increment_interviews_used();

DROP TRIGGER IF EXISTS trigger_update_subscription_usage ON public.interview_attempts;
CREATE TRIGGER trigger_update_subscription_usage 
  AFTER UPDATE ON public.interview_attempts 
  FOR EACH ROW EXECUTE FUNCTION update_subscription_interview_usage();

-- ============================================================================
-- INTERVIEW_SCHEDULES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_interview_schedules_updated_at ON public.interview_schedules;
CREATE TRIGGER update_interview_schedules_updated_at 
  BEFORE UPDATE ON public.interview_schedules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INTERVIEW_TEMPLATES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_interview_templates_updated_at ON public.interview_templates;
CREATE TRIGGER update_interview_templates_updated_at 
  BEFORE UPDATE ON public.interview_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INTERVIEWS TRIGGERS (5 triggers)
-- ============================================================================
DROP TRIGGER IF EXISTS set_interview_organization_trigger ON public.interviews;
CREATE TRIGGER set_interview_organization_trigger 
  BEFORE INSERT ON public.interviews 
  FOR EACH ROW EXECUTE FUNCTION auto_set_interview_organization();

DROP TRIGGER IF EXISTS track_interview_usage_delete ON public.interviews;
CREATE TRIGGER track_interview_usage_delete 
  AFTER DELETE ON public.interviews 
  FOR EACH ROW EXECUTE FUNCTION update_usage_tracking();

DROP TRIGGER IF EXISTS track_interview_usage_insert ON public.interviews;
CREATE TRIGGER track_interview_usage_insert 
  AFTER INSERT ON public.interviews 
  FOR EACH ROW EXECUTE FUNCTION update_usage_tracking();

DROP TRIGGER IF EXISTS trigger_set_interview_slug ON public.interviews;
CREATE TRIGGER trigger_set_interview_slug 
  BEFORE INSERT ON public.interviews 
  FOR EACH ROW EXECUTE FUNCTION set_interview_slug();

DROP TRIGGER IF EXISTS update_interviews_updated_at ON public.interviews;
CREATE TRIGGER update_interviews_updated_at 
  BEFORE UPDATE ON public.interviews 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INVOICES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at 
  BEFORE UPDATE ON public.invoices 
  FOR EACH ROW EXECUTE FUNCTION update_invoice_updated_at();

-- ============================================================================
-- LEARNING_ASSESSMENT_ATTEMPTS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS audit_learning_assessment_attempts ON public.learning_assessment_attempts;
CREATE TRIGGER audit_learning_assessment_attempts 
  AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_attempts 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

DROP TRIGGER IF EXISTS log_learning_assessment_attempts_changes ON public.learning_assessment_attempts;
CREATE TRIGGER log_learning_assessment_attempts_changes 
  AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_attempts 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

-- ============================================================================
-- LEARNING_ASSESSMENT_FEEDBACK TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS audit_learning_assessment_feedback ON public.learning_assessment_feedback;
CREATE TRIGGER audit_learning_assessment_feedback 
  AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_feedback 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

DROP TRIGGER IF EXISTS log_learning_assessment_feedback_changes ON public.learning_assessment_feedback;
CREATE TRIGGER log_learning_assessment_feedback_changes 
  AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_feedback 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

-- ============================================================================
-- LEARNING_ASSESSMENTS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS audit_learning_assessments ON public.learning_assessments;
CREATE TRIGGER audit_learning_assessments 
  AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessments 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

DROP TRIGGER IF EXISTS log_learning_assessments_changes ON public.learning_assessments;
CREATE TRIGGER log_learning_assessments_changes 
  AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessments 
  FOR EACH ROW EXECUTE FUNCTION log_assessment_changes();

DROP TRIGGER IF EXISTS update_learning_assessments_updated_at ON public.learning_assessments;
CREATE TRIGGER update_learning_assessments_updated_at 
  BEFORE UPDATE ON public.learning_assessments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- LEARNING_PLANS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_learning_plans_updated_at ON public.learning_plans;
CREATE TRIGGER update_learning_plans_updated_at 
  BEFORE UPDATE ON public.learning_plans 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ONBOARDING_PROGRESS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_onboarding_progress_updated_at ON public.onboarding_progress;
CREATE TRIGGER update_onboarding_progress_updated_at 
  BEFORE UPDATE ON public.onboarding_progress 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORGANIZATION_MEMBERS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS enforce_single_org_membership ON public.organization_members;
CREATE TRIGGER enforce_single_org_membership 
  BEFORE INSERT OR UPDATE ON public.organization_members 
  FOR EACH ROW EXECUTE FUNCTION check_multi_org_membership();

-- ============================================================================
-- ORGANIZATIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_set_organization_slug ON public.organizations;
CREATE TRIGGER trigger_set_organization_slug 
  BEFORE INSERT ON public.organizations 
  FOR EACH ROW EXECUTE FUNCTION set_organization_slug();

-- ============================================================================
-- PAYMENT_GATEWAYS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_payment_gateways_updated_at ON public.payment_gateways;
CREATE TRIGGER update_payment_gateways_updated_at 
  BEFORE UPDATE ON public.payment_gateways 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PAYMENT_METHODS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at 
  BEFORE UPDATE ON public.payment_methods 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PAYMENT_TRANSACTIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON public.payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at 
  BEFORE UPDATE ON public.payment_transactions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PLATFORM_CONFIGURATIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_platform_configurations_updated_at ON public.platform_configurations;
CREATE TRIGGER update_platform_configurations_updated_at 
  BEFORE UPDATE ON public.platform_configurations 
  FOR EACH ROW EXECUTE FUNCTION update_platform_config_updated_at();

-- ============================================================================
-- PLATFORM_DOCUMENTATION TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_platform_documentation_updated_at ON public.platform_documentation;
CREATE TRIGGER update_platform_documentation_updated_at 
  BEFORE UPDATE ON public.platform_documentation 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PREINTERVIEW_CHECK_LOGS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_preinterview_check_logs_updated_at ON public.preinterview_check_logs;
CREATE TRIGGER update_preinterview_check_logs_updated_at 
  BEFORE UPDATE ON public.preinterview_check_logs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PROCTORING_SESSIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_proctoring_sessions_updated_at ON public.proctoring_sessions;
CREATE TRIGGER update_proctoring_sessions_updated_at 
  BEFORE UPDATE ON public.proctoring_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_proctoring_sessions_updated_at();

-- ============================================================================
-- PROCTORING_SETTINGS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_proctoring_settings_updated_at ON public.proctoring_settings;
CREATE TRIGGER update_proctoring_settings_updated_at 
  BEFORE UPDATE ON public.proctoring_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- REPORT_TEMPLATES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_report_templates_updated_at ON public.report_templates;
CREATE TRIGGER update_report_templates_updated_at 
  BEFORE UPDATE ON public.report_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROLE_PERMISSIONS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER trigger_update_role_permissions_updated_at 
  BEFORE UPDATE ON public.role_permissions 
  FOR EACH ROW EXECUTE FUNCTION update_role_permissions_updated_at();

-- ============================================================================
-- TEST_SUITES TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_test_suites_updated_at_trigger ON public.test_suites;
CREATE TRIGGER update_test_suites_updated_at_trigger 
  BEFORE UPDATE ON public.test_suites 
  FOR EACH ROW EXECUTE FUNCTION update_test_suites_updated_at();

-- ============================================================================
-- TRAINING_PLANS TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_training_plans_updated_at ON public.training_plans;
CREATE TRIGGER update_training_plans_updated_at 
  BEFORE UPDATE ON public.training_plans 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE - Run 06_storage.sql next
-- ============================================================================
