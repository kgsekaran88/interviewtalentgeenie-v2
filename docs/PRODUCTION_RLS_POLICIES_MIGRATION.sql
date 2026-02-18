-- =====================================================
-- PRODUCTION RLS POLICIES MIGRATION
-- =====================================================
-- This file contains ALL 330 Row Level Security policies
-- Run AFTER tables and functions are created
-- =====================================================

-- =====================================================
-- TABLE: activity_feed
-- =====================================================
DROP POLICY IF EXISTS "Organization can view activity" ON public.activity_feed;
CREATE POLICY "Organization can view activity" ON public.activity_feed
  FOR SELECT USING (organization_id IN (
    SELECT organization_members.organization_id FROM organization_members
    WHERE organization_members.user_id = auth.uid()
  ));

-- =====================================================
-- TABLE: ai_coach_sessions
-- =====================================================
DROP POLICY IF EXISTS "Candidates can view their own coach sessions" ON public.ai_coach_sessions;
CREATE POLICY "Candidates can view their own coach sessions" ON public.ai_coach_sessions
  FOR SELECT USING (candidate_email = (
    SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
  ));

DROP POLICY IF EXISTS "Service role can manage coach sessions" ON public.ai_coach_sessions;
CREATE POLICY "Service role can manage coach sessions" ON public.ai_coach_sessions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ai_coach_sessions_insert_policy" ON public.ai_coach_sessions;
CREATE POLICY "ai_coach_sessions_insert_policy" ON public.ai_coach_sessions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ai_coach_sessions_select_policy" ON public.ai_coach_sessions;
CREATE POLICY "ai_coach_sessions_select_policy" ON public.ai_coach_sessions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role])
  ));

-- =====================================================
-- TABLE: ai_feature_alerts
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage alerts" ON public.ai_feature_alerts;
CREATE POLICY "Platform admins can manage alerts" ON public.ai_feature_alerts
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can view alerts" ON public.ai_feature_alerts;
CREATE POLICY "Platform admins can view alerts" ON public.ai_feature_alerts
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "ai_feature_alerts_admin_policy" ON public.ai_feature_alerts;
CREATE POLICY "ai_feature_alerts_admin_policy" ON public.ai_feature_alerts
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: ai_feature_configurations
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage ai_feature_configurations" ON public.ai_feature_configurations;
CREATE POLICY "Platform admins can manage ai_feature_configurations" ON public.ai_feature_configurations
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: ai_feature_health
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage AI health" ON public.ai_feature_health;
CREATE POLICY "Platform admins can manage AI health" ON public.ai_feature_health
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can view AI health" ON public.ai_feature_health;
CREATE POLICY "Platform admins can view AI health" ON public.ai_feature_health
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: ai_health_alerts
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage alerts" ON public.ai_health_alerts;
CREATE POLICY "Platform admins can manage alerts" ON public.ai_health_alerts
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

DROP POLICY IF EXISTS "Platform admins can view alerts" ON public.ai_health_alerts;
CREATE POLICY "Platform admins can view alerts" ON public.ai_health_alerts
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: ai_health_checks
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can view health checks" ON public.ai_health_checks;
CREATE POLICY "Platform admins can view health checks" ON public.ai_health_checks
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: ai_health_monitoring
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can view health monitoring" ON public.ai_health_monitoring;
CREATE POLICY "Platform admins can view health monitoring" ON public.ai_health_monitoring
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "ai_health_monitoring_admin_policy" ON public.ai_health_monitoring;
CREATE POLICY "ai_health_monitoring_admin_policy" ON public.ai_health_monitoring
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: ai_model_configurations
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage model configs" ON public.ai_model_configurations;
CREATE POLICY "Platform admins can manage model configs" ON public.ai_model_configurations
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can view model configs" ON public.ai_model_configurations;
CREATE POLICY "Platform admins can view model configs" ON public.ai_model_configurations
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "ai_model_configurations_admin_policy" ON public.ai_model_configurations;
CREATE POLICY "ai_model_configurations_admin_policy" ON public.ai_model_configurations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: ai_model_performance
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage model performance" ON public.ai_model_performance;
CREATE POLICY "Platform admins can manage model performance" ON public.ai_model_performance
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can view model performance" ON public.ai_model_performance;
CREATE POLICY "Platform admins can view model performance" ON public.ai_model_performance
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: ai_provider_credentials
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage ai_provider_credentials" ON public.ai_provider_credentials;
CREATE POLICY "Platform admins can manage ai_provider_credentials" ON public.ai_provider_credentials
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: ai_providers
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage ai_providers" ON public.ai_providers;
CREATE POLICY "Platform admins can manage ai_providers" ON public.ai_providers
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: ai_usage_logs
-- =====================================================
DROP POLICY IF EXISTS "Org admins can view their org AI usage" ON public.ai_usage_logs;
CREATE POLICY "Org admins can view their org AI usage" ON public.ai_usage_logs
  FOR SELECT USING (
    (organization_id IS NOT NULL) AND 
    (user_is_org_admin(auth.uid(), organization_id) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  );

DROP POLICY IF EXISTS "Platform admins can view ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Platform admins can view ai_usage_logs" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Service role can insert ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Service role can insert ai_usage_logs" ON public.ai_usage_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- =====================================================
-- TABLE: analytics_snapshots
-- =====================================================
DROP POLICY IF EXISTS "Org members can view analytics" ON public.analytics_snapshots;
CREATE POLICY "Org members can view analytics" ON public.analytics_snapshots
  FOR SELECT TO authenticated
  USING ((organization_id IS NULL) OR can_access_org_data(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Service role can manage analytics" ON public.analytics_snapshots;
CREATE POLICY "Service role can manage analytics" ON public.analytics_snapshots
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "analytics_snapshots_org_policy" ON public.analytics_snapshots;
CREATE POLICY "analytics_snapshots_org_policy" ON public.analytics_snapshots
  FOR ALL USING (can_access_org_data(auth.uid(), organization_id));

-- =====================================================
-- TABLE: approval_workflows
-- =====================================================
DROP POLICY IF EXISTS "Organization can access workflows" ON public.approval_workflows;
CREATE POLICY "Organization can access workflows" ON public.approval_workflows
  FOR ALL USING (entity_id::uuid IN (
    SELECT i.id FROM interviews i
    JOIN organization_members om ON om.organization_id = i.organization_id
    WHERE om.user_id = auth.uid()
  ));

-- =====================================================
-- TABLE: architecture_documents
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view architecture docs" ON public.architecture_documents;
CREATE POLICY "Authenticated users can view architecture docs" ON public.architecture_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Platform admins can manage architecture docs" ON public.architecture_documents;
CREATE POLICY "Platform admins can manage architecture docs" ON public.architecture_documents
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: assessments
-- =====================================================
DROP POLICY IF EXISTS "Platform admins, org admins and creators can view assessments" ON public.assessments;
CREATE POLICY "Platform admins, org admins and creators can view assessments" ON public.assessments
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ia.id = assessments.attempt_id 
      AND (user_is_org_admin(auth.uid(), i.organization_id) OR i.creator_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['hr_recruiter'::app_role]))
    )
  );

DROP POLICY IF EXISTS "Service role can insert assessments" ON public.assessments;
CREATE POLICY "Service role can insert assessments" ON public.assessments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "assessments_insert_policy" ON public.assessments;
CREATE POLICY "assessments_insert_policy" ON public.assessments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "assessments_select_policy" ON public.assessments;
CREATE POLICY "assessments_select_policy" ON public.assessments
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ia.id = assessments.attempt_id 
      AND (i.creator_id = auth.uid() OR (i.organization_id IS NOT NULL AND can_access_org_data(auth.uid(), i.organization_id)))
    )
  );

DROP POLICY IF EXISTS "assessments_update_policy" ON public.assessments;
CREATE POLICY "assessments_update_policy" ON public.assessments
  FOR UPDATE USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: ats_candidates
-- =====================================================
DROP POLICY IF EXISTS "Org admins can manage ATS candidates" ON public.ats_candidates;
CREATE POLICY "Org admins can manage ATS candidates" ON public.ats_candidates
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ats_integrations ai
    WHERE ai.id = ats_candidates.integration_id AND user_is_org_admin(auth.uid(), ai.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM ats_integrations ai
    WHERE ai.id = ats_candidates.integration_id AND user_is_org_admin(auth.uid(), ai.organization_id)
  ));

DROP POLICY IF EXISTS "Org members can view ATS candidates" ON public.ats_candidates;
CREATE POLICY "Org members can view ATS candidates" ON public.ats_candidates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ats_integrations ai
    WHERE ai.id = ats_candidates.integration_id AND can_access_org_data(auth.uid(), ai.organization_id)
  ));

DROP POLICY IF EXISTS "Service role can manage ATS candidates" ON public.ats_candidates;
CREATE POLICY "Service role can manage ATS candidates" ON public.ats_candidates
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLE: ats_integrations
-- =====================================================
DROP POLICY IF EXISTS "Org admins can manage ATS integrations" ON public.ats_integrations;
CREATE POLICY "Org admins can manage ATS integrations" ON public.ats_integrations
  FOR ALL USING (
    user_is_org_admin(auth.uid(), organization_id) OR 
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

DROP POLICY IF EXISTS "Org members can view ATS integrations" ON public.ats_integrations;
CREATE POLICY "Org members can view ATS integrations" ON public.ats_integrations
  FOR SELECT TO authenticated
  USING (can_access_org_data(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org members can view their ATS integrations" ON public.ats_integrations;
CREATE POLICY "Org members can view their ATS integrations" ON public.ats_integrations
  FOR SELECT USING (
    user_is_org_member(auth.uid(), organization_id) OR 
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

-- =====================================================
-- TABLE: ats_sync_logs
-- =====================================================
DROP POLICY IF EXISTS "Org members can view sync logs" ON public.ats_sync_logs;
CREATE POLICY "Org members can view sync logs" ON public.ats_sync_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM ats_integrations ai
    WHERE ai.id = ats_sync_logs.integration_id 
    AND (user_is_org_member(auth.uid(), ai.organization_id) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  ));

DROP POLICY IF EXISTS "Service role can insert sync logs" ON public.ats_sync_logs;
CREATE POLICY "Service role can insert sync logs" ON public.ats_sync_logs
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: attempt_questions
-- =====================================================
DROP POLICY IF EXISTS "Admins can delete attempt questions" ON public.attempt_questions;
CREATE POLICY "Admins can delete attempt questions" ON public.attempt_questions
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM interview_attempts ia
    JOIN interviews i ON i.id = ia.interview_id
    WHERE ia.id = attempt_questions.attempt_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  ));

DROP POLICY IF EXISTS "Candidates can view their own attempt questions" ON public.attempt_questions;
CREATE POLICY "Candidates can view their own attempt questions" ON public.attempt_questions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM interview_attempts ia
      JOIN profiles p ON p.email = ia.candidate_email
      WHERE ia.id = attempt_questions.attempt_id AND p.id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ia.id = attempt_questions.attempt_id 
      AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id) OR user_is_org_member(auth.uid(), i.organization_id))
    )
  );

DROP POLICY IF EXISTS "Platform admins can view all attempt questions" ON public.attempt_questions;
CREATE POLICY "Platform admins can view all attempt questions" ON public.attempt_questions
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "System can insert attempt questions" ON public.attempt_questions;
CREATE POLICY "System can insert attempt questions" ON public.attempt_questions
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM interviews i
    JOIN questions q ON q.interview_id = i.id
    WHERE q.id = attempt_questions.question_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  ));

-- =====================================================
-- TABLE: audit_logs
-- =====================================================
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role, 'partner_admin'::app_role]));

DROP POLICY IF EXISTS "Anonymous: Deny all audit log access" ON public.audit_logs;
CREATE POLICY "Anonymous: Deny all audit log access" ON public.audit_logs
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: bias_detection_results
-- =====================================================
DROP POLICY IF EXISTS "Authorized users can view bias results" ON public.bias_detection_results;
CREATE POLICY "Authorized users can view bias results" ON public.bias_detection_results
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM interview_attempts ia
    JOIN interviews i ON i.id = ia.interview_id
    WHERE ia.id = bias_detection_results.attempt_id 
    AND (i.creator_id = auth.uid() OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role]))
  ));

DROP POLICY IF EXISTS "Service role can insert bias results" ON public.bias_detection_results;
CREATE POLICY "Service role can insert bias results" ON public.bias_detection_results
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: candidate_performance_index
-- =====================================================
DROP POLICY IF EXISTS "Creators and admins can view CPI" ON public.candidate_performance_index;
CREATE POLICY "Creators and admins can view CPI" ON public.candidate_performance_index
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = candidate_performance_index.interview_id 
    AND (i.creator_id = auth.uid() OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role]))
  ));

DROP POLICY IF EXISTS "Org admins can view org CPI" ON public.candidate_performance_index;
CREATE POLICY "Org admins can view org CPI" ON public.candidate_performance_index
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = candidate_performance_index.interview_id 
    AND (user_is_org_admin(auth.uid(), i.organization_id) OR i.creator_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Service role can manage CPI" ON public.candidate_performance_index;
CREATE POLICY "Service role can manage CPI" ON public.candidate_performance_index
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "candidate_performance_index_manage_policy" ON public.candidate_performance_index;
CREATE POLICY "candidate_performance_index_manage_policy" ON public.candidate_performance_index
  FOR ALL USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "candidate_performance_index_select_policy" ON public.candidate_performance_index;
CREATE POLICY "candidate_performance_index_select_policy" ON public.candidate_performance_index
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = candidate_performance_index.interview_id 
      AND (i.creator_id = auth.uid() OR (i.organization_id IS NOT NULL AND can_access_org_data(auth.uid(), i.organization_id)))
    )
  );

-- =====================================================
-- TABLE: certificate_badges
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage badges" ON public.certificate_badges;
CREATE POLICY "Admins can manage badges" ON public.certificate_badges
  FOR ALL USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view badges" ON public.certificate_badges;
CREATE POLICY "Anyone can view badges" ON public.certificate_badges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "certificate_badges_admin_write" ON public.certificate_badges;
CREATE POLICY "certificate_badges_admin_write" ON public.certificate_badges
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

DROP POLICY IF EXISTS "certificate_badges_public_read" ON public.certificate_badges;
CREATE POLICY "certificate_badges_public_read" ON public.certificate_badges
  FOR SELECT USING (true);

-- =====================================================
-- TABLE: certificates
-- =====================================================
DROP POLICY IF EXISTS "Org admins can view org member certificates" ON public.certificates;
CREATE POLICY "Org admins can view org member certificates" ON public.certificates
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR 
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    (has_any_role(auth.uid(), ARRAY['partner_admin'::app_role]) AND user_id IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id IN (
        SELECT organization_members.organization_id FROM organization_members
        WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
      ) AND om.status = 'active'
    ))
  );

DROP POLICY IF EXISTS "Platform admins can view all certificates" ON public.certificates;
CREATE POLICY "Platform admins can view all certificates" ON public.certificates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Service role can manage certificates" ON public.certificates;
CREATE POLICY "Service role can manage certificates" ON public.certificates
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own certificates" ON public.certificates;
CREATE POLICY "Users can view their own certificates" ON public.certificates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "certificates_admin_all" ON public.certificates;
CREATE POLICY "certificates_admin_all" ON public.certificates
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

DROP POLICY IF EXISTS "certificates_owner_select" ON public.certificates;
CREATE POLICY "certificates_owner_select" ON public.certificates
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "certificates_public_verify" ON public.certificates;
CREATE POLICY "certificates_public_verify" ON public.certificates
  FOR SELECT USING (true);

-- =====================================================
-- TABLE: certification_assessments
-- =====================================================
DROP POLICY IF EXISTS "Everyone can view published assessments" ON public.certification_assessments;
CREATE POLICY "Everyone can view published assessments" ON public.certification_assessments
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Platform admins can manage assessments" ON public.certification_assessments;
CREATE POLICY "Platform admins can manage assessments" ON public.certification_assessments
  FOR ALL
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: certification_attempts
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can view all attempts" ON public.certification_attempts;
CREATE POLICY "Platform admins can view all attempts" ON public.certification_attempts
  FOR SELECT USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Service role can manage attempts" ON public.certification_attempts;
CREATE POLICY "Service role can manage attempts" ON public.certification_attempts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can create their own attempts" ON public.certification_attempts;
CREATE POLICY "Users can create their own attempts" ON public.certification_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own attempts" ON public.certification_attempts;
CREATE POLICY "Users can update their own attempts" ON public.certification_attempts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own attempts" ON public.certification_attempts;
CREATE POLICY "Users can view their own attempts" ON public.certification_attempts
  FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- TABLE: certification_global_config
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can insert config" ON public.certification_global_config;
CREATE POLICY "Platform admins can insert config" ON public.certification_global_config
  FOR INSERT WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can update config" ON public.certification_global_config;
CREATE POLICY "Platform admins can update config" ON public.certification_global_config
  FOR UPDATE
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can view config" ON public.certification_global_config;
CREATE POLICY "Platform admins can view config" ON public.certification_global_config
  FOR SELECT USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: certification_topics
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage certification topics" ON public.certification_topics;
CREATE POLICY "Admins can manage certification topics" ON public.certification_topics
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Everyone can view active certification topics" ON public.certification_topics;
CREATE POLICY "Everyone can view active certification topics" ON public.certification_topics
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "certification_topics_admin_all" ON public.certification_topics;
CREATE POLICY "certification_topics_admin_all" ON public.certification_topics
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

DROP POLICY IF EXISTS "certification_topics_public_read" ON public.certification_topics;
CREATE POLICY "certification_topics_public_read" ON public.certification_topics
  FOR SELECT USING (is_active = true);

-- =====================================================
-- TABLE: chatbot_knowledge
-- =====================================================
DROP POLICY IF EXISTS "All authenticated users can view active knowledge" ON public.chatbot_knowledge;
CREATE POLICY "All authenticated users can view active knowledge" ON public.chatbot_knowledge
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins can manage chatbot knowledge" ON public.chatbot_knowledge;
CREATE POLICY "Platform admins can manage chatbot knowledge" ON public.chatbot_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- =====================================================
-- TABLE: circuit_breaker_state
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage circuit breaker state" ON public.circuit_breaker_state;
CREATE POLICY "Platform admins can manage circuit breaker state" ON public.circuit_breaker_state
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: collaboration_threads
-- =====================================================
DROP POLICY IF EXISTS "Platform admins and org members can collaborate" ON public.collaboration_threads;
CREATE POLICY "Platform admins and org members can collaborate" ON public.collaboration_threads
  FOR ALL USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    entity_id IN (
      SELECT i.id FROM interviews i
      JOIN organization_members om ON om.organization_id = i.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- =====================================================
-- TABLE: comparative_analytics
-- =====================================================
DROP POLICY IF EXISTS "Organization can view comparative analytics" ON public.comparative_analytics;
CREATE POLICY "Organization can view comparative analytics" ON public.comparative_analytics
  FOR SELECT TO authenticated USING (
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    ) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

-- =====================================================
-- TABLE: custom_roles
-- =====================================================
DROP POLICY IF EXISTS "Org admins can manage custom roles" ON public.custom_roles;
CREATE POLICY "Org admins can manage custom roles" ON public.custom_roles
  FOR ALL TO authenticated
  USING (
    (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id)) OR
    (organization_id IS NULL AND has_any_role(auth.uid(), ARRAY['platform_admin'::app_role]))
  )
  WITH CHECK (
    (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id)) OR
    (organization_id IS NULL AND has_any_role(auth.uid(), ARRAY['platform_admin'::app_role]))
  );

DROP POLICY IF EXISTS "Org members can view their org custom roles" ON public.custom_roles;
CREATE POLICY "Org members can view their org custom roles" ON public.custom_roles
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    ) OR organization_id IS NULL OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

DROP POLICY IF EXISTS "Partner admins can manage their org custom roles" ON public.custom_roles;
CREATE POLICY "Partner admins can manage their org custom roles" ON public.custom_roles
  FOR ALL
  USING (
    has_role(auth.uid(), 'partner_admin'::app_role) AND
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'partner_admin'::app_role) AND
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Platform admins can manage all custom roles" ON public.custom_roles;
CREATE POLICY "Platform admins can manage all custom roles" ON public.custom_roles
  FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "custom_roles_org_admin_policy" ON public.custom_roles;
CREATE POLICY "custom_roles_org_admin_policy" ON public.custom_roles
  FOR ALL USING (
    user_is_org_admin(auth.uid(), organization_id) OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role)
  );

-- =====================================================
-- TABLE: documentation
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage documentation" ON public.documentation;
CREATE POLICY "Admins can manage documentation" ON public.documentation
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anonymous: Deny all documentation access" ON public.documentation;
CREATE POLICY "Anonymous: Deny all documentation access" ON public.documentation
  FOR ALL TO anon USING (false);

-- =====================================================
-- TABLE: email_logs
-- =====================================================
DROP POLICY IF EXISTS "Partner admins can view org email logs" ON public.email_logs;
CREATE POLICY "Partner admins can view org email logs" ON public.email_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    ) AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
    )
  );

DROP POLICY IF EXISTS "Platform admins can view all email logs" ON public.email_logs;
CREATE POLICY "Platform admins can view all email logs" ON public.email_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: email_templates
-- =====================================================
DROP POLICY IF EXISTS "Org admins can manage org templates" ON public.email_templates;
CREATE POLICY "Org admins can manage org templates" ON public.email_templates
  FOR ALL
  USING (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Platform admins can manage all templates" ON public.email_templates;
CREATE POLICY "Platform admins can manage all templates" ON public.email_templates
  FOR ALL
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Service role can read all templates" ON public.email_templates;
CREATE POLICY "Service role can read all templates" ON public.email_templates
  FOR SELECT USING (true);

-- =====================================================
-- TABLE: failed_jobs
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage failed jobs" ON public.failed_jobs;
CREATE POLICY "Platform admins can manage failed jobs" ON public.failed_jobs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: idempotency_keys
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can manage idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Platform admins can manage idempotency keys" ON public.idempotency_keys
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: interview_attempts
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view their own attempts" ON public.interview_attempts;
CREATE POLICY "Authenticated users can view their own attempts" ON public.interview_attempts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.email = interview_attempts.candidate_email
  ));

DROP POLICY IF EXISTS "Candidates can create attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can create attempts" ON public.interview_attempts
  FOR INSERT TO authenticated WITH CHECK (
    invitation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM interview_invitations inv
      JOIN profiles p ON p.email = inv.candidate_email
      WHERE inv.id = interview_attempts.invitation_id 
      AND p.id = auth.uid() 
      AND inv.status <> 'expired' 
      AND inv.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Candidates can update own attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can update own attempts" ON public.interview_attempts
  FOR UPDATE TO authenticated
  USING (
    session_token IS NOT NULL AND length(session_token) > 0 AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.email = interview_attempts.candidate_email)
  )
  WITH CHECK (status = ANY (ARRAY['in_progress', 'submitted']));

DROP POLICY IF EXISTS "Candidates can update their own attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can update their own attempts" ON public.interview_attempts
  FOR UPDATE TO authenticated
  USING (candidate_email IN (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (candidate_email IN (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS "Candidates can view own attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can view own attempts" ON public.interview_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.email = interview_attempts.candidate_email));

DROP POLICY IF EXISTS "Candidates can view their own attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can view their own attempts" ON public.interview_attempts
  FOR SELECT TO authenticated USING (
    candidate_email IN (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_attempts.interview_id 
      AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
    )
  );

DROP POLICY IF EXISTS "Creators and admins can delete attempts" ON public.interview_attempts;
CREATE POLICY "Creators and admins can delete attempts" ON public.interview_attempts
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_attempts.interview_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Email-matched users can create attempts" ON public.interview_attempts;
CREATE POLICY "Email-matched users can create attempts" ON public.interview_attempts
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM interviews i
    JOIN profiles p ON p.id = auth.uid()
    WHERE i.id = interview_attempts.interview_id AND i.status = 'active' AND p.email = interview_attempts.candidate_email
  ));

DROP POLICY IF EXISTS "Org admins can view org interview attempts" ON public.interview_attempts;
CREATE POLICY "Org admins can view org interview attempts" ON public.interview_attempts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_attempts.interview_id AND user_is_org_admin(auth.uid(), i.organization_id)
    ) OR
    candidate_email IN (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_attempts.interview_id AND i.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Session-based: Update own attempt - protected PII" ON public.interview_attempts;
CREATE POLICY "Session-based: Update own attempt - protected PII" ON public.interview_attempts
  FOR UPDATE
  USING (session_token IS NOT NULL AND length(session_token) > 0 AND status = 'in_progress')
  WITH CHECK (
    status = ANY (ARRAY['in_progress', 'submitted']) AND
    candidate_email = (SELECT ia.candidate_email FROM interview_attempts ia WHERE ia.id = interview_attempts.id) AND
    candidate_name = (SELECT ia.candidate_name FROM interview_attempts ia WHERE ia.id = interview_attempts.id)
  );

DROP POLICY IF EXISTS "Staff and platform admins can view attempts" ON public.interview_attempts;
CREATE POLICY "Staff and platform admins can view attempts" ON public.interview_attempts
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (SELECT 1 FROM interviews i WHERE i.id = interview_attempts.interview_id AND i.creator_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM interviews i
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE i.id = interview_attempts.interview_id AND ur.role = 'hr_recruiter'::app_role AND ur.organization_id = i.organization_id
    )
  );

DROP POLICY IF EXISTS "interview_attempts_insert_policy" ON public.interview_attempts;
CREATE POLICY "interview_attempts_insert_policy" ON public.interview_attempts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "interview_attempts_select_policy" ON public.interview_attempts;
CREATE POLICY "interview_attempts_select_policy" ON public.interview_attempts
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_attempts.interview_id 
      AND (i.creator_id = auth.uid() OR (i.organization_id IS NOT NULL AND can_access_org_data(auth.uid(), i.organization_id)))
    ) OR
    has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
  );

DROP POLICY IF EXISTS "interview_attempts_update_policy" ON public.interview_attempts;
CREATE POLICY "interview_attempts_update_policy" ON public.interview_attempts
  FOR UPDATE USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_attempts.interview_id AND (i.creator_id = auth.uid() OR i.status = 'active')
    )
  );

-- =====================================================
-- TABLE: interview_invitations
-- =====================================================
DROP POLICY IF EXISTS "Creators can create invitations" ON public.interview_invitations;
CREATE POLICY "Creators can create invitations" ON public.interview_invitations
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
  ));

DROP POLICY IF EXISTS "Creators can delete non-completed invitations" ON public.interview_invitations;
CREATE POLICY "Creators can delete non-completed invitations" ON public.interview_invitations
  FOR DELETE USING (
    status <> 'completed' AND EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_invitations.interview_id 
      AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
    )
  );

DROP POLICY IF EXISTS "Creators can update invitations" ON public.interview_invitations;
CREATE POLICY "Creators can update invitations" ON public.interview_invitations
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
  ));

DROP POLICY IF EXISTS "Creators can view invitations" ON public.interview_invitations;
CREATE POLICY "Creators can view invitations" ON public.interview_invitations
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
  ));

DROP POLICY IF EXISTS "Platform admins can manage invitations" ON public.interview_invitations;
CREATE POLICY "Platform admins can manage invitations" ON public.interview_invitations
  FOR ALL TO authenticated USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Service role can manage invitations" ON public.interview_invitations;
CREATE POLICY "Service role can manage invitations" ON public.interview_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "interview_invitations_manage_policy" ON public.interview_invitations;
CREATE POLICY "interview_invitations_manage_policy" ON public.interview_invitations
  FOR ALL USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_invitations.interview_id 
      AND (i.creator_id = auth.uid() OR (i.organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), i.organization_id)))
    )
  );

DROP POLICY IF EXISTS "interview_invitations_select_policy" ON public.interview_invitations;
CREATE POLICY "interview_invitations_select_policy" ON public.interview_invitations
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = interview_invitations.interview_id 
      AND (i.creator_id = auth.uid() OR (i.organization_id IS NOT NULL AND can_access_org_data(auth.uid(), i.organization_id)))
    )
  );

-- =====================================================
-- TABLE: interview_schedules
-- =====================================================
DROP POLICY IF EXISTS "Organization can manage schedules" ON public.interview_schedules;
CREATE POLICY "Organization can manage schedules" ON public.interview_schedules
  FOR ALL USING (interview_id IN (
    SELECT i.id FROM interviews i
    JOIN organization_members om ON om.organization_id = i.organization_id
    WHERE om.user_id = auth.uid()
  ));

-- =====================================================
-- TABLE: interview_templates
-- =====================================================
DROP POLICY IF EXISTS "Platform admins and org members can manage templates" ON public.interview_templates;
CREATE POLICY "Platform admins and org members can manage templates" ON public.interview_templates
  FOR ALL USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    organization_id IN (SELECT organization_members.organization_id FROM organization_members WHERE organization_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public templates viewable by all authenticated" ON public.interview_templates;
CREATE POLICY "Public templates viewable by all authenticated" ON public.interview_templates
  FOR SELECT USING (
    is_public = true OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    organization_id IN (SELECT organization_members.organization_id FROM organization_members WHERE organization_members.user_id = auth.uid())
  );

-- =====================================================
-- TABLE: interviews
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can create interviews" ON public.interviews;
CREATE POLICY "Authenticated users can create interviews" ON public.interviews
  FOR INSERT WITH CHECK (auth.uid() = creator_id AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creators can delete interviews" ON public.interviews;
CREATE POLICY "Creators can delete interviews" ON public.interviews
  FOR DELETE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update interviews" ON public.interviews;
CREATE POLICY "Creators can update interviews" ON public.interviews
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can view own and org interviews" ON public.interviews;
CREATE POLICY "Users can view own and org interviews" ON public.interviews
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    auth.uid() = creator_id OR
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "interviews_delete_policy" ON public.interviews;
CREATE POLICY "interviews_delete_policy" ON public.interviews
  FOR DELETE USING (creator_id = auth.uid() OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "interviews_insert_policy" ON public.interviews;
CREATE POLICY "interviews_insert_policy" ON public.interviews
  FOR INSERT WITH CHECK (auth.uid() = creator_id OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "interviews_select_policy" ON public.interviews;
CREATE POLICY "interviews_select_policy" ON public.interviews
  FOR SELECT USING (
    creator_id = auth.uid() OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    (organization_id IS NOT NULL AND can_access_org_data(auth.uid(), organization_id)) OR
    has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role, 'ta_creator'::app_role])
  );

DROP POLICY IF EXISTS "interviews_update_policy" ON public.interviews;
CREATE POLICY "interviews_update_policy" ON public.interviews
  FOR UPDATE USING (
    creator_id = auth.uid() OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id))
  );

-- =====================================================
-- TABLE: invoices
-- =====================================================
DROP POLICY IF EXISTS "Platform admins and org members can view invoices" ON public.invoices;
CREATE POLICY "Platform admins and org members can view invoices" ON public.invoices
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    can_access_org_data(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Platform and org admins can manage invoices" ON public.invoices;
CREATE POLICY "Platform and org admins can manage invoices" ON public.invoices
  FOR ALL
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR user_is_org_admin(auth.uid(), organization_id));

-- =====================================================
-- TABLE: consent_records
-- =====================================================
DROP POLICY IF EXISTS "Admins can view consent records" ON public.consent_records;
CREATE POLICY "Admins can view consent records" ON public.consent_records
  FOR SELECT USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role]));

DROP POLICY IF EXISTS "Service role can manage consent records" ON public.consent_records;
CREATE POLICY "Service role can manage consent records" ON public.consent_records
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "consent_records_admin_policy" ON public.consent_records;
CREATE POLICY "consent_records_admin_policy" ON public.consent_records
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role])
  ));

-- =====================================================
-- TABLE: data_deletion_requests
-- =====================================================
DROP POLICY IF EXISTS "Anyone can submit data deletion requests" ON public.data_deletion_requests;
CREATE POLICY "Anyone can submit data deletion requests" ON public.data_deletion_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins can manage deletion requests" ON public.data_deletion_requests;
CREATE POLICY "Platform admins can manage deletion requests" ON public.data_deletion_requests
  FOR ALL USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "data_deletion_requests_admin_policy" ON public.data_deletion_requests;
CREATE POLICY "data_deletion_requests_admin_policy" ON public.data_deletion_requests
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

-- =====================================================
-- TABLE: data_retention_policies
-- =====================================================
DROP POLICY IF EXISTS "Platform and org admins can manage retention policies" ON public.data_retention_policies;
CREATE POLICY "Platform and org admins can manage retention policies" ON public.data_retention_policies
  FOR ALL
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR organization_id IS NULL OR user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR organization_id IS NULL OR user_is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "data_retention_policies_org_policy" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_org_policy" ON public.data_retention_policies
  FOR ALL USING (
    user_is_org_admin(auth.uid(), organization_id) OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role)
  );

-- =====================================================
-- TABLE: generated_reports
-- =====================================================
DROP POLICY IF EXISTS "Organization can view generated reports" ON public.generated_reports;
CREATE POLICY "Organization can view generated reports" ON public.generated_reports
  FOR SELECT TO authenticated USING (
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    ) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

-- =====================================================
-- TABLE: notifications
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_user_policy" ON public.notifications;
CREATE POLICY "notifications_user_policy" ON public.notifications
  FOR ALL USING (
    user_id = auth.uid() OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

-- =====================================================
-- TABLE: onboarding_progress
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own onboarding" ON public.onboarding_progress;
CREATE POLICY "Users can manage their own onboarding" ON public.onboarding_progress
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================
-- TABLE: operation_logs
-- =====================================================
DROP POLICY IF EXISTS "Platform admins can view operation logs" ON public.operation_logs;
CREATE POLICY "Platform admins can view operation logs" ON public.operation_logs
  FOR SELECT USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Service role can insert operation logs" ON public.operation_logs;
CREATE POLICY "Service role can insert operation logs" ON public.operation_logs
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: organization_members
-- =====================================================
DROP POLICY IF EXISTS "Org admins can manage members" ON public.organization_members;
CREATE POLICY "Org admins can manage members" ON public.organization_members
  FOR ALL
  USING (user_is_org_admin(auth.uid(), organization_id) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Org members can view their org members" ON public.organization_members;
CREATE POLICY "Org members can view their org members" ON public.organization_members
  FOR SELECT USING (
    user_is_org_member(auth.uid(), organization_id) OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

DROP POLICY IF EXISTS "Users can view their own memberships" ON public.organization_members;
CREATE POLICY "Users can view their own memberships" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view members in their organizations" ON public.organization_members;
CREATE POLICY "Users can view members in their organizations" ON public.organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_members.organization_id FROM organization_members
      WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "organization_members_admin_manage" ON public.organization_members;
CREATE POLICY "organization_members_admin_manage" ON public.organization_members
  FOR ALL USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    user_is_org_admin(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
CREATE POLICY "organization_members_select_policy" ON public.organization_members
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    user_id = auth.uid() OR
    user_is_org_admin(auth.uid(), organization_id) OR
    user_is_org_member(auth.uid(), organization_id)
  );

-- =====================================================
-- TABLE: organizations
-- =====================================================
DROP POLICY IF EXISTS "Org admins can update their org" ON public.organizations;
CREATE POLICY "Org admins can update their org" ON public.organizations
  FOR UPDATE USING (user_is_org_admin(auth.uid(), id) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Org members can view their org" ON public.organizations;
CREATE POLICY "Org members can view their org" ON public.organizations
  FOR SELECT USING (
    user_is_org_member(auth.uid(), id) OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

DROP POLICY IF EXISTS "Platform admins can manage all orgs" ON public.organizations;
CREATE POLICY "Platform admins can manage all orgs" ON public.organizations
  FOR ALL USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organizations;
CREATE POLICY "Admins can manage organizations" ON public.organizations
  FOR ALL USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization" ON public.organizations
  FOR SELECT USING (
    user_is_org_member(auth.uid(), id) OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

DROP POLICY IF EXISTS "organizations_admin_manage" ON public.organizations;
CREATE POLICY "organizations_admin_manage" ON public.organizations
  FOR ALL USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    user_is_org_admin(auth.uid(), id)
  );

DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
CREATE POLICY "organizations_select_policy" ON public.organizations
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    user_is_org_member(auth.uid(), id) OR
    user_is_org_admin(auth.uid(), id)
  );

-- =====================================================
-- TABLE: profiles
-- =====================================================
DROP POLICY IF EXISTS "Anonymous: Deny all profile access" ON public.profiles;
CREATE POLICY "Anonymous: Deny all profile access" ON public.profiles
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Authenticated: Update own profile only" ON public.profiles;
CREATE POLICY "Authenticated: Update own profile only" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Partner admins can view org member profiles" ON public.profiles;
CREATE POLICY "Partner admins can view org member profiles" ON public.profiles
  FOR SELECT USING (
    has_role(auth.uid(), 'partner_admin'::app_role) AND
    id IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id IN (
        SELECT organization_members.organization_id FROM organization_members
        WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
      ) AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Platform admins can view all profiles" ON public.profiles;
CREATE POLICY "Platform admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = profiles.id AND user_is_org_admin(auth.uid(), om.organization_id)
    )
  );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- =====================================================
-- TABLE: proctoring_sessions
-- =====================================================
DROP POLICY IF EXISTS "Admins and recruiters can view all proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Admins and recruiters can view all proctoring sessions" ON public.proctoring_sessions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role, 'interviewer'::app_role])
  ));

DROP POLICY IF EXISTS "Admins can delete proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Admins can delete proctoring sessions" ON public.proctoring_sessions
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role
  ));

DROP POLICY IF EXISTS "Authenticated users can create proctoring sessions for learning" ON public.proctoring_sessions;
CREATE POLICY "Authenticated users can create proctoring sessions for learning" ON public.proctoring_sessions
  FOR INSERT TO authenticated WITH CHECK (
    (learning_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM learning_assessment_attempts laa
      WHERE laa.id = proctoring_sessions.learning_attempt_id AND laa.user_id = auth.uid()
    )) OR
    (certification_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM certification_attempts ca
      WHERE ca.id = proctoring_sessions.certification_attempt_id AND ca.user_id = auth.uid()
    )) OR
    interview_attempt_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Authorized users can view interview proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Authorized users can view interview proctoring sessions" ON public.proctoring_sessions
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'platform_admin'::app_role) OR
    (learning_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM learning_assessment_attempts laa
      WHERE laa.id = proctoring_sessions.learning_attempt_id AND laa.user_id = auth.uid()
    )) OR
    (certification_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM certification_attempts ca
      WHERE ca.id = proctoring_sessions.certification_attempt_id AND ca.user_id = auth.uid()
    )) OR
    (interview_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ia.id = proctoring_sessions.interview_attempt_id AND (
        i.creator_id = auth.uid() OR
        user_is_org_admin(auth.uid(), i.organization_id) OR
        EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = i.organization_id AND om.user_id = auth.uid() AND om.status = 'active') OR
        has_any_role(auth.uid(), ARRAY['hr_recruiter'::app_role, 'partner_admin'::app_role, 'interviewer'::app_role])
      )
    ))
  );

DROP POLICY IF EXISTS "Org admins can view org proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Org admins can view org proctoring sessions" ON public.proctoring_sessions
  FOR SELECT TO authenticated USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    (interview_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ia.id = proctoring_sessions.interview_attempt_id AND (
        user_is_org_admin(auth.uid(), i.organization_id) OR i.creator_id = auth.uid()
      )
    )) OR
    (learning_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM learning_assessment_attempts laa
      WHERE laa.id = proctoring_sessions.learning_attempt_id AND laa.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Org members can view org proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Org members can view org proctoring sessions" ON public.proctoring_sessions
  FOR SELECT TO authenticated USING (
    interview_attempt_id IN (
      SELECT ia.id FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      JOIN organization_members om ON om.organization_id = i.organization_id
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    ) OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

DROP POLICY IF EXISTS "Platform admins can view all proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Platform admins can view all proctoring sessions" ON public.proctoring_sessions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Staff can view all proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Staff can view all proctoring sessions" ON public.proctoring_sessions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update their learning/certification proctoring sessio" ON public.proctoring_sessions;
CREATE POLICY "Users can update their learning/certification proctoring sessio" ON public.proctoring_sessions
  FOR UPDATE TO authenticated USING (
    (learning_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM learning_assessment_attempts laa
      WHERE laa.id = proctoring_sessions.learning_attempt_id AND laa.user_id = auth.uid()
    )) OR
    (certification_attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM certification_attempts ca
      WHERE ca.id = proctoring_sessions.certification_attempt_id AND ca.user_id = auth.uid()
    )) OR
    interview_attempt_id IS NOT NULL
  );

DROP POLICY IF EXISTS "proctoring_sessions_insert_policy" ON public.proctoring_sessions;
CREATE POLICY "proctoring_sessions_insert_policy" ON public.proctoring_sessions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "proctoring_sessions_select_policy" ON public.proctoring_sessions;
CREATE POLICY "proctoring_sessions_select_policy" ON public.proctoring_sessions
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ia.id = proctoring_sessions.interview_attempt_id 
      AND (i.creator_id = auth.uid() OR (i.organization_id IS NOT NULL AND can_access_org_data(auth.uid(), i.organization_id)))
    )
  );

DROP POLICY IF EXISTS "proctoring_sessions_update_policy" ON public.proctoring_sessions;
CREATE POLICY "proctoring_sessions_update_policy" ON public.proctoring_sessions
  FOR UPDATE USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (SELECT 1 FROM interview_attempts ia WHERE ia.id = proctoring_sessions.interview_attempt_id)
  );

-- =====================================================
-- TABLE: proctoring_violations
-- =====================================================
DROP POLICY IF EXISTS "proctoring_violations_insert_policy" ON public.proctoring_violations;
CREATE POLICY "proctoring_violations_insert_policy" ON public.proctoring_violations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "proctoring_violations_select_policy" ON public.proctoring_violations;
CREATE POLICY "proctoring_violations_select_policy" ON public.proctoring_violations
  FOR SELECT USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM proctoring_sessions ps
      JOIN interview_attempts ia ON ia.id = ps.interview_attempt_id
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ps.id = proctoring_violations.session_id 
      AND (i.creator_id = auth.uid() OR (i.organization_id IS NOT NULL AND can_access_org_data(auth.uid(), i.organization_id)))
    )
  );

DROP POLICY IF EXISTS "proctoring_violations_update_policy" ON public.proctoring_violations;
CREATE POLICY "proctoring_violations_update_policy" ON public.proctoring_violations
  FOR UPDATE USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    EXISTS (
      SELECT 1 FROM proctoring_sessions ps
      JOIN interview_attempts ia ON ia.id = ps.interview_attempt_id
      JOIN interviews i ON i.id = ia.interview_id
      WHERE ps.id = proctoring_violations.session_id 
      AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
    )
  );

-- =====================================================
-- TABLE: questions
-- =====================================================
DROP POLICY IF EXISTS "Anonymous: Deny ALL question access" ON public.questions;
CREATE POLICY "Anonymous: Deny ALL question access" ON public.questions
  FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Creators only: Delete own questions" ON public.questions;
CREATE POLICY "Creators only: Delete own questions" ON public.questions
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM interviews WHERE interviews.id = questions.interview_id AND interviews.creator_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Creators only: Insert own questions" ON public.questions;
CREATE POLICY "Creators only: Insert own questions" ON public.questions
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM interviews WHERE interviews.id = questions.interview_id AND interviews.creator_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Creators only: Update own questions" ON public.questions;
CREATE POLICY "Creators only: Update own questions" ON public.questions
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM interviews WHERE interviews.id = questions.interview_id AND interviews.creator_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Creators only: View own questions" ON public.questions;
CREATE POLICY "Creators only: View own questions" ON public.questions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM interviews WHERE interviews.id = questions.interview_id AND interviews.creator_id = auth.uid()
  ));

DROP POLICY IF EXISTS "questions_active_select" ON public.questions;
CREATE POLICY "questions_active_select" ON public.questions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM interviews i WHERE i.id = questions.interview_id AND i.status = 'active'
  ));

DROP POLICY IF EXISTS "questions_admin_all" ON public.questions;
CREATE POLICY "questions_admin_all" ON public.questions
  FOR ALL USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "questions_creator_select" ON public.questions;
CREATE POLICY "questions_creator_select" ON public.questions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM interviews i WHERE i.id = questions.interview_id AND i.creator_id = auth.uid()
  ));

DROP POLICY IF EXISTS "questions_org_select" ON public.questions;
CREATE POLICY "questions_org_select" ON public.questions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = questions.interview_id AND i.organization_id IS NOT NULL AND can_access_org_data(auth.uid(), i.organization_id)
  ));

-- =====================================================
-- TABLE: subscription_plans
-- =====================================================
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Everyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins can delete plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can delete plans" ON public.subscription_plans
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins can insert plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can insert plans" ON public.subscription_plans
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins can update plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can update plans" ON public.subscription_plans
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins can view all plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can view all plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- =====================================================
-- TABLE: usage_tracking
-- =====================================================
DROP POLICY IF EXISTS "Members can view their org usage" ON public.usage_tracking;
CREATE POLICY "Members can view their org usage" ON public.usage_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = usage_tracking.organization_id 
      AND organization_members.user_id = auth.uid() 
      AND organization_members.status = 'active'
    ) OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  );

DROP POLICY IF EXISTS "System can track usage" ON public.usage_tracking;
CREATE POLICY "System can track usage" ON public.usage_tracking
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- TABLE: user_badges
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all badges" ON public.user_badges;
CREATE POLICY "Admins can view all badges" ON public.user_badges
  FOR SELECT USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Service role can manage user badges" ON public.user_badges;
CREATE POLICY "Service role can manage user badges" ON public.user_badges
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;
CREATE POLICY "Users can view their own badges" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_badges_admin_write" ON public.user_badges;
CREATE POLICY "user_badges_admin_write" ON public.user_badges
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'platform_admin'::app_role
  ));

DROP POLICY IF EXISTS "user_badges_owner_read" ON public.user_badges;
CREATE POLICY "user_badges_owner_read" ON public.user_badges
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_badges_public_verify" ON public.user_badges;
CREATE POLICY "user_badges_public_verify" ON public.user_badges
  FOR SELECT USING (true);

-- =====================================================
-- TABLE: user_roles
-- =====================================================
DROP POLICY IF EXISTS "Allow system trigger to assign guest role on signup" ON public.user_roles;
CREATE POLICY "Allow system trigger to assign guest role on signup" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() IS NULL AND role = 'guest'::app_role);

DROP POLICY IF EXISTS "Partner admins can view org member roles" ON public.user_roles;
CREATE POLICY "Partner admins can view org member roles" ON public.user_roles
  FOR SELECT USING (
    has_role(auth.uid(), 'partner_admin'::app_role) AND
    user_id IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id IN (
        SELECT organization_members.organization_id FROM organization_members
        WHERE organization_members.user_id = auth.uid() AND organization_members.status = 'active'
      ) AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Platform admins can assign roles" ON public.user_roles;
CREATE POLICY "Platform admins can assign roles" ON public.user_roles
  FOR INSERT WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can manage all roles" ON public.user_roles;
CREATE POLICY "Platform admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins can remove roles" ON public.user_roles;
CREATE POLICY "Platform admins can remove roles" ON public.user_roles
  FOR DELETE USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Platform admins can view all roles" ON public.user_roles;
CREATE POLICY "Platform admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins can view all user roles" ON public.user_roles;
CREATE POLICY "Platform admins can view all user roles" ON public.user_roles
  FOR SELECT USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "Users can self-assign candidate or guest role" ON public.user_roles;
CREATE POLICY "Users can self-assign candidate or guest role" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id AND role = ANY (ARRAY['candidate'::app_role, 'guest'::app_role]));

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL USING (
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id))
  );

DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT USING (
    user_id = auth.uid() OR
    has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]) OR
    (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id))
  );

-- =====================================================
-- END OF RLS POLICIES MIGRATION
-- =====================================================
-- Total: 330 RLS policies matching Production Cloud
-- =====================================================
