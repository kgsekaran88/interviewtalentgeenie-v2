-- ============================================================================
-- PRODUCTION SCHEMA CORRECTIONS
-- Fixes schema differences between migration files and Production Cloud
-- Generated: 2024-12-27
-- ============================================================================
-- This file corrects the discrepancies found in the gap analysis.
-- Run AFTER PRODUCTION_COMPLETE_MIGRATION.sql if tables already exist,
-- OR update PRODUCTION_COMPLETE_MIGRATION.sql directly with these corrections.
-- ============================================================================

-- ============================================================================
-- CORRECTION 1: email_templates table
-- ============================================================================
-- The migration file has incorrect columns. Here's the CORRECT schema:

-- DROP the incorrect table if it exists with wrong schema
DROP TABLE IF EXISTS public.email_templates CASCADE;

-- Create with CORRECT schema matching Production Cloud
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  description TEXT,
  available_variables TEXT[] DEFAULT '{}'::text[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Platform admins can manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

CREATE POLICY "Org admins can manage org email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members can view org email templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR can_access_org_data(auth.uid(), organization_id));

-- Indexes for email_templates
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_platform_default_idx 
  ON public.email_templates USING btree (template_key) 
  WHERE (organization_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON public.email_templates USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_org_template ON public.email_templates USING btree (organization_id, template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_template_key ON public.email_templates USING btree (template_key);

-- ============================================================================
-- NOTE: The following items in the index migration reference NON-EXISTENT columns/tables
-- These should be REMOVED from PRODUCTION_INDEXES_MIGRATION.sql
-- ============================================================================

-- REMOVE THESE INDEXES (tables don't exist):
-- - idx_custom_reports_org ON public.custom_reports
-- - idx_custom_reports_type ON public.custom_reports
-- - idx_learning_feedback_attempt ON public.learning_feedback
-- - idx_learning_feedback_rating ON public.learning_feedback
-- - idx_learning_feedback_user ON public.learning_feedback
-- - idx_learning_paths_active ON public.learning_paths
-- - idx_learning_paths_difficulty ON public.learning_paths
-- - idx_learning_paths_slug ON public.learning_paths
-- - idx_learning_path_topics_path ON public.learning_path_topics
-- - idx_learning_path_topics_topic ON public.learning_path_topics
-- - idx_learning_progress_plan ON public.learning_progress
-- - idx_learning_progress_user ON public.learning_progress
-- - idx_learning_resources_plan ON public.learning_resources
-- - idx_learning_resources_type ON public.learning_resources
-- - idx_question_repository_approved ON public.question_repository
-- - idx_question_repository_org ON public.question_repository
-- - idx_question_repository_topic ON public.question_repository
-- - idx_question_repository_type ON public.question_repository
-- - idx_question_review_question ON public.question_review_workflow
-- - idx_question_review_reviewer ON public.question_review_workflow
-- - idx_question_review_status ON public.question_review_workflow
-- - idx_test_templates_category ON public.test_templates
-- - idx_test_templates_is_global ON public.test_templates
-- - idx_test_templates_org ON public.test_templates
-- - idx_flow_test_definitions_active ON public.flow_test_definitions
-- - idx_flow_test_definitions_category ON public.flow_test_definitions
-- - idx_flow_test_runs_definition ON public.flow_test_runs
-- - idx_flow_test_runs_started ON public.flow_test_runs
-- - idx_flow_test_runs_status ON public.flow_test_runs

-- REMOVE THESE INDEXES (columns don't exist):
-- - idx_profiles_impersonated_by ON public.profiles (impersonated_by column doesn't exist)
-- - idx_subscription_plans_slug ON public.subscription_plans (slug column doesn't exist)
-- - idx_platform_config_category ON public.platform_configuration (table name is platform_configurations)
-- - idx_platform_config_key ON public.platform_configuration (table name is platform_configurations)

-- CORRECT INDEX for platform_configurations:
CREATE INDEX IF NOT EXISTS idx_platform_configurations_category ON public.platform_configurations USING btree (category);
CREATE INDEX IF NOT EXISTS idx_platform_configurations_key ON public.platform_configurations USING btree (config_key);

-- ============================================================================
-- END CORRECTIONS
-- ============================================================================
