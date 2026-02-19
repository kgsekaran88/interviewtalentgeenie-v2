-- =============================================================================
-- Missing RLS Policies from Cloud Project
-- Generated: 2026-02-18
-- Total policies: 144
-- Strategy: DROP IF EXISTS + CREATE POLICY for each missing policy
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: public.ai_coach_sessions (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage coach sessions" ON public.ai_coach_sessions;
CREATE POLICY "Service role can manage coach sessions" ON public.ai_coach_sessions USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.ai_feature_alerts (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view alerts" ON public.ai_feature_alerts;
CREATE POLICY "Platform admins can view alerts" ON public.ai_feature_alerts FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.ai_model_configurations (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view model configs" ON public.ai_model_configurations;
CREATE POLICY "Platform admins can view model configs" ON public.ai_model_configurations FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.analytics_snapshots (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage analytics" ON public.analytics_snapshots;
CREATE POLICY "Service role can manage analytics" ON public.analytics_snapshots USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.assessments (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can insert assessments" ON public.assessments;
CREATE POLICY "Service role can insert assessments" ON public.assessments FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.ats_candidates (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage ATS candidates" ON public.ats_candidates;
CREATE POLICY "Service role can manage ATS candidates" ON public.ats_candidates USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.candidate_performance_index (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260106165008_e5868987-5ea8-47d5-b59b-be04db82050a.sql
DROP POLICY IF EXISTS "Authorized users can insert CPI" ON public.candidate_performance_index;
CREATE POLICY "Authorized users can insert CPI" ON public.candidate_performance_index
FOR INSERT
WITH CHECK (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_id
    AND (
      i.creator_id = auth.uid()
      OR has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
    )
  )
);

-- Source: 20260106165008_e5868987-5ea8-47d5-b59b-be04db82050a.sql
DROP POLICY IF EXISTS "Authorized users can update CPI" ON public.candidate_performance_index;
CREATE POLICY "Authorized users can update CPI" ON public.candidate_performance_index
FOR UPDATE
USING (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_id
    AND (
      i.creator_id = auth.uid()
      OR has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
    )
  )
)
WITH CHECK (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_id
    AND (
      i.creator_id = auth.uid()
      OR has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
    )
  )
);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage CPI" ON public.candidate_performance_index;
CREATE POLICY "Service role can manage CPI" ON public.candidate_performance_index USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.certificates (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage certificates" ON public.certificates;
CREATE POLICY "Service role can manage certificates" ON public.certificates USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.certification_attempts (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage attempts" ON public.certification_attempts;
CREATE POLICY "Service role can manage attempts" ON public.certification_attempts USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.consent_records (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage consent records" ON public.consent_records;
CREATE POLICY "Service role can manage consent records" ON public.consent_records USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.documentation (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can manage documentation" ON public.documentation;
CREATE POLICY "Admins can manage documentation" ON public.documentation TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Anonymous: Deny all documentation access" ON public.documentation;
CREATE POLICY "Anonymous: Deny all documentation access" ON public.documentation TO anon USING (false);

-- ---------------------------------------------------------------------------
-- Table: public.email_templates (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260106170431_069ab6d4-0581-471f-b278-2f7c651c7b2f.sql
DROP POLICY IF EXISTS "Partner admins and HR can view templates" ON public.email_templates;
CREATE POLICY "Partner admins and HR can view templates" ON public.email_templates
FOR SELECT
USING (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role])
);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can read all templates" ON public.email_templates;
CREATE POLICY "Service role can read all templates" ON public.email_templates FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Table: public.interview_attempts (5 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Authenticated users can view their own attempts" ON public.interview_attempts;
CREATE POLICY "Authenticated users can view their own attempts" ON public.interview_attempts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.email = interview_attempts.candidate_email)))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Candidates can create attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can create attempts" ON public.interview_attempts FOR INSERT TO authenticated WITH CHECK (((invitation_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.interview_invitations inv
     JOIN public.profiles p ON ((p.email = inv.candidate_email)))
  WHERE ((inv.id = interview_attempts.invitation_id) AND (p.id = auth.uid()) AND (inv.status <> 'expired'::text) AND (inv.expires_at > now()))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Candidates can update own attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can update own attempts" ON public.interview_attempts FOR UPDATE TO authenticated USING (((session_token IS NOT NULL) AND (length(session_token) > 0) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.email = interview_attempts.candidate_email)))))) WITH CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text])));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Candidates can view own attempts" ON public.interview_attempts;
CREATE POLICY "Candidates can view own attempts" ON public.interview_attempts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.email = interview_attempts.candidate_email)))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Creators and admins can delete attempts" ON public.interview_attempts;
CREATE POLICY "Creators and admins can delete attempts" ON public.interview_attempts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));

-- ---------------------------------------------------------------------------
-- Table: public.interview_invitations (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260103182533_cbd764ad-c3dc-4a51-99a5-f61e57427c8c.sql
DROP POLICY IF EXISTS "interview_invitations_update_policy" ON public.interview_invitations;
CREATE POLICY "interview_invitations_update_policy" ON public.interview_invitations
FOR UPDATE
USING (
  -- Platform admin has full access
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  -- Creator can update invitations for their interviews
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id
    AND i.creator_id = auth.uid()
  )
  -- Org admin can update invitations in their org
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id
    AND i.organization_id IS NOT NULL
    AND user_is_org_admin(auth.uid(), i.organization_id)
  )
  -- HR recruiter can update invitations in their org
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id
    AND i.organization_id IS NOT NULL
    AND user_is_org_member(auth.uid(), i.organization_id)
    AND has_any_role(auth.uid(), ARRAY['hr_recruiter'::app_role, 'partner_admin'::app_role])
  )
);

-- ---------------------------------------------------------------------------
-- Table: public.interview_operation_logs (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Anyone can create operation logs" ON public.interview_operation_logs;
CREATE POLICY "Anyone can create operation logs" ON public.interview_operation_logs FOR INSERT WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Anyone can update operation logs" ON public.interview_operation_logs;
CREATE POLICY "Anyone can update operation logs" ON public.interview_operation_logs FOR UPDATE USING (true) WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Staff can view operation logs" ON public.interview_operation_logs;
CREATE POLICY "Staff can view operation logs" ON public.interview_operation_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role, 'tech_spoc'::public.app_role]))))));

-- ---------------------------------------------------------------------------
-- Table: public.interview_panel_members (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Interview creators and admins can manage panel" ON public.interview_panel_members;
CREATE POLICY "Interview creators and admins can manage panel" ON public.interview_panel_members USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_panel_members.interview_id) AND ((i.creator_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Panel members can view their assignments" ON public.interview_panel_members;
CREATE POLICY "Panel members can view their assignments" ON public.interview_panel_members FOR SELECT USING ((user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Table: public.interviews (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260105153204_095132b9-a187-4f18-9b53-b1debca0f13b.sql
DROP POLICY IF EXISTS "interviews_insert_policy" ON public.interviews;
CREATE POLICY "interviews_insert_policy" ON public.interviews
FOR INSERT WITH CHECK (
  -- Platform admins can create for any org
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR
  -- User must be the creator
  (auth.uid() = creator_id AND auth.uid() IS NOT NULL)
);

-- Source: 20260105153204_095132b9-a187-4f18-9b53-b1debca0f13b.sql
DROP POLICY IF EXISTS "interviews_select_policy" ON public.interviews;
CREATE POLICY "interviews_select_policy" ON public.interviews
FOR SELECT USING (
  -- Platform admins can see everything
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR
  -- Creator can see their own interviews
  (creator_id = auth.uid())
  OR
  -- Org members can see their org's interviews
  (organization_id IS NOT NULL AND user_is_org_member(auth.uid(), organization_id))
);

-- ---------------------------------------------------------------------------
-- Table: public.learning_assessment_attempts (6 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Creators and platform admins can view assessment attempts" ON public.learning_assessment_attempts;
CREATE POLICY "Creators and platform admins can view assessment attempts" ON public.learning_assessment_attempts FOR SELECT USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.learning_assessments la
  WHERE ((la.id = learning_assessment_attempts.assessment_id) AND (la.user_id = auth.uid()))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Org admins can view org member assessment attempts" ON public.learning_assessment_attempts;
CREATE POLICY "Org admins can view org member assessment attempts" ON public.learning_assessment_attempts FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (public.has_any_role(auth.uid(), ARRAY['partner_admin'::public.app_role]) AND (user_id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text)))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can delete assessment attempts" ON public.learning_assessment_attempts;
CREATE POLICY "Platform admins can delete assessment attempts" ON public.learning_assessment_attempts FOR DELETE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can create their own assessment attempts" ON public.learning_assessment_attempts;
CREATE POLICY "Users can create their own assessment attempts" ON public.learning_assessment_attempts FOR INSERT WITH CHECK ((auth.uid() = user_id));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can update their own attempts" ON public.learning_assessment_attempts;
CREATE POLICY "Users can update their own attempts" ON public.learning_assessment_attempts FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'evaluated'::text]))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own assessment attempts" ON public.learning_assessment_attempts;
CREATE POLICY "Users can view their own assessment attempts" ON public.learning_assessment_attempts FOR SELECT USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Table: public.learning_assessment_feedback (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Creators and admins can view feedback" ON public.learning_assessment_feedback;
CREATE POLICY "Creators and admins can view feedback" ON public.learning_assessment_feedback FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.learning_assessment_attempts laa
     JOIN public.learning_assessments la ON ((la.id = laa.assessment_id)))
  WHERE ((laa.id = learning_assessment_feedback.attempt_id) AND ((laa.user_id = auth.uid()) OR (la.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can insert feedback" ON public.learning_assessment_feedback;
CREATE POLICY "Service role can insert feedback" ON public.learning_assessment_feedback FOR INSERT WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own assessment feedback" ON public.learning_assessment_feedback;
CREATE POLICY "Users can view their own assessment feedback" ON public.learning_assessment_feedback FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.learning_assessment_attempts laa
  WHERE ((laa.id = learning_assessment_feedback.attempt_id) AND (laa.user_id = auth.uid())))));

-- ---------------------------------------------------------------------------
-- Table: public.learning_assessment_questions (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Creators and admins can view questions with answers" ON public.learning_assessment_questions;
CREATE POLICY "Creators and admins can view questions with answers" ON public.learning_assessment_questions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.learning_assessments la
  WHERE ((la.id = learning_assessment_questions.assessment_id) AND ((la.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can insert questions" ON public.learning_assessment_questions;
CREATE POLICY "Service role can insert questions" ON public.learning_assessment_questions FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.learning_assessment_usage (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can view assessment usage" ON public.learning_assessment_usage;
CREATE POLICY "Admins can view assessment usage" ON public.learning_assessment_usage FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage assessment usage" ON public.learning_assessment_usage;
CREATE POLICY "Service role can manage assessment usage" ON public.learning_assessment_usage USING (true) WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own assessment usage" ON public.learning_assessment_usage;
CREATE POLICY "Users can view their own assessment usage" ON public.learning_assessment_usage FOR SELECT USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Table: public.learning_assessments (4 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Creators and admins can update assessments" ON public.learning_assessments;
CREATE POLICY "Creators and admins can update assessments" ON public.learning_assessments FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]))) WITH CHECK (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role])));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Creators and admins can view assessments" ON public.learning_assessments;
CREATE POLICY "Creators and admins can view assessments" ON public.learning_assessments FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role])));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Creators can create assessments" ON public.learning_assessments;
CREATE POLICY "Creators can create assessments" ON public.learning_assessments FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can delete assessments" ON public.learning_assessments;
CREATE POLICY "Platform admins can delete assessments" ON public.learning_assessments FOR DELETE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.learning_materials (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can manage materials" ON public.learning_materials;
CREATE POLICY "Admins can manage materials" ON public.learning_materials TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Everyone can view materials" ON public.learning_materials;
CREATE POLICY "Everyone can view materials" ON public.learning_materials FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Table: public.learning_payments (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all learning payments" ON public.learning_payments;
CREATE POLICY "Platform admins can view all learning payments" ON public.learning_payments FOR SELECT USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage learning payments" ON public.learning_payments;
CREATE POLICY "Service role can manage learning payments" ON public.learning_payments USING (true) WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own learning payments" ON public.learning_payments;
CREATE POLICY "Users can view their own learning payments" ON public.learning_payments FOR SELECT USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Table: public.learning_plans (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Everyone can view active learning plans" ON public.learning_plans;
CREATE POLICY "Everyone can view active learning plans" ON public.learning_plans FOR SELECT USING ((is_active = true));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage learning plans" ON public.learning_plans;
CREATE POLICY "Platform admins can manage learning plans" ON public.learning_plans USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.learning_subscriptions (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all learning subscriptions" ON public.learning_subscriptions;
CREATE POLICY "Platform admins can view all learning subscriptions" ON public.learning_subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage learning subscriptions" ON public.learning_subscriptions;
CREATE POLICY "Service role can manage learning subscriptions" ON public.learning_subscriptions USING (true) WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own learning subscriptions" ON public.learning_subscriptions;
CREATE POLICY "Users can view their own learning subscriptions" ON public.learning_subscriptions FOR SELECT USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Table: public.onboarding_progress (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can insert their own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users can insert their own onboarding progress" ON public.onboarding_progress FOR INSERT WITH CHECK ((auth.uid() = user_id));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can update their own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users can update their own onboarding progress" ON public.onboarding_progress FOR UPDATE USING ((auth.uid() = user_id));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users can view their own onboarding progress" ON public.onboarding_progress FOR SELECT USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Table: public.organization_members (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;
CREATE POLICY "Admins can manage members" ON public.organization_members TO authenticated USING (public.user_is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.user_is_org_admin(auth.uid(), organization_id));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view members in their organizations" ON public.organization_members;
CREATE POLICY "Users can view members in their organizations" ON public.organization_members FOR SELECT USING ((public.user_is_org_member(auth.uid(), organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own membership" ON public.organization_members;
CREATE POLICY "Users can view their own membership" ON public.organization_members FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Table: public.organization_subscriptions (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins and org members can view subscriptions" ON public.organization_subscriptions;
CREATE POLICY "Platform admins and org members can view subscriptions" ON public.organization_subscriptions FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.can_access_org_data(auth.uid(), organization_id)));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform and org admins can manage subscriptions" ON public.organization_subscriptions;
CREATE POLICY "Platform and org admins can manage subscriptions" ON public.organization_subscriptions USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id))) WITH CHECK ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id)));

-- ---------------------------------------------------------------------------
-- Table: public.organizations (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organizations;
CREATE POLICY "Admins can manage organizations" ON public.organizations TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.panel_consensus (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins and authorized users can view consensus" ON public.panel_consensus;
CREATE POLICY "Platform admins and authorized users can view consensus" ON public.panel_consensus FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = panel_consensus.attempt_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id)))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage consensus" ON public.panel_consensus;
CREATE POLICY "Service role can manage consensus" ON public.panel_consensus USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.panel_evaluations (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Interview creators can view all panel evaluations" ON public.panel_evaluations;
CREATE POLICY "Interview creators can view all panel evaluations" ON public.panel_evaluations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = panel_evaluations.attempt_id) AND ((i.creator_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Reviewers can manage their own evaluations" ON public.panel_evaluations;
CREATE POLICY "Reviewers can manage their own evaluations" ON public.panel_evaluations USING ((reviewer_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Table: public.partner_applications (4 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage applications" ON public.partner_applications;
CREATE POLICY "Platform admins can manage applications" ON public.partner_applications USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can create applications" ON public.partner_applications;
CREATE POLICY "Users can create applications" ON public.partner_applications FOR INSERT WITH CHECK ((applicant_user_id = auth.uid()));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can update their revision_requested applications" ON public.partner_applications;
CREATE POLICY "Users can update their revision_requested applications" ON public.partner_applications FOR UPDATE USING (((applicant_user_id = auth.uid()) AND (status = 'revision_requested'::text))) WITH CHECK ((applicant_user_id = auth.uid()));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own applications" ON public.partner_applications;
CREATE POLICY "Users can view their own applications" ON public.partner_applications FOR SELECT USING (((applicant_user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));

-- ---------------------------------------------------------------------------
-- Table: public.password_setup_invitations (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can create password setup invitations" ON public.password_setup_invitations;
CREATE POLICY "Admins can create password setup invitations" ON public.password_setup_invitations FOR INSERT TO authenticated WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view password setup invitations" ON public.password_setup_invitations;
CREATE POLICY "Platform admins can view password setup invitations" ON public.password_setup_invitations FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.payment_gateways (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage payment gateways" ON public.payment_gateways;
CREATE POLICY "Platform admins can manage payment gateways" ON public.payment_gateways USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));

-- ---------------------------------------------------------------------------
-- Table: public.payment_methods (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Authorized users can view payment methods" ON public.payment_methods;
CREATE POLICY "Authorized users can view payment methods" ON public.payment_methods FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id) OR public.has_any_role(auth.uid(), ARRAY['billing_contact'::public.app_role])));

-- ---------------------------------------------------------------------------
-- Table: public.payment_transactions (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins and org members can view transactions" ON public.payment_transactions;
CREATE POLICY "Platform admins and org members can view transactions" ON public.payment_transactions FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.can_access_org_data(auth.uid(), organization_id)));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform and org admins can manage transactions" ON public.payment_transactions;
CREATE POLICY "Platform and org admins can manage transactions" ON public.payment_transactions USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id))) WITH CHECK ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id)));

-- ---------------------------------------------------------------------------
-- Table: public.platform_configurations (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can insert configurations" ON public.platform_configurations;
CREATE POLICY "Platform admins can insert configurations" ON public.platform_configurations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can read configurations" ON public.platform_configurations;
CREATE POLICY "Platform admins can read configurations" ON public.platform_configurations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can update configurations" ON public.platform_configurations;
CREATE POLICY "Platform admins can update configurations" ON public.platform_configurations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));

-- ---------------------------------------------------------------------------
-- Table: public.platform_documentation (4 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can create documentation" ON public.platform_documentation;
CREATE POLICY "Platform admins can create documentation" ON public.platform_documentation FOR INSERT TO authenticated WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can delete documentation" ON public.platform_documentation;
CREATE POLICY "Platform admins can delete documentation" ON public.platform_documentation FOR DELETE TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can update documentation" ON public.platform_documentation;
CREATE POLICY "Platform admins can update documentation" ON public.platform_documentation FOR UPDATE TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all documentation" ON public.platform_documentation;
CREATE POLICY "Platform admins can view all documentation" ON public.platform_documentation FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.platform_documentation_versions (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can create versions" ON public.platform_documentation_versions;
CREATE POLICY "Platform admins can create versions" ON public.platform_documentation_versions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all versions" ON public.platform_documentation_versions;
CREATE POLICY "Platform admins can view all versions" ON public.platform_documentation_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));

-- ---------------------------------------------------------------------------
-- Table: public.predictive_analytics (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Organization can view analytics" ON public.predictive_analytics;
CREATE POLICY "Organization can view analytics" ON public.predictive_analytics FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));

-- ---------------------------------------------------------------------------
-- Table: public.preinterview_check_logs (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Anyone can create preinterview check logs" ON public.preinterview_check_logs;
CREATE POLICY "Anyone can create preinterview check logs" ON public.preinterview_check_logs FOR INSERT WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Anyone can update their own preinterview check logs" ON public.preinterview_check_logs;
CREATE POLICY "Anyone can update their own preinterview check logs" ON public.preinterview_check_logs FOR UPDATE USING (true) WITH CHECK (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Staff can view preinterview check logs" ON public.preinterview_check_logs;
CREATE POLICY "Staff can view preinterview check logs" ON public.preinterview_check_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))));

-- ---------------------------------------------------------------------------
-- Table: public.proctoring_sessions (4 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins and recruiters can view all proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Admins and recruiters can view all proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role, 'interviewer'::public.app_role]))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can delete proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Admins can delete proctoring sessions" ON public.proctoring_sessions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Org admins can view org proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Org admins can view org proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR ((interview_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = proctoring_sessions.interview_attempt_id) AND (public.user_is_org_admin(auth.uid(), i.organization_id) OR (i.creator_id = auth.uid())))))) OR ((learning_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.learning_assessment_attempts laa
  WHERE ((laa.id = proctoring_sessions.learning_attempt_id) AND (laa.user_id = auth.uid())))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Platform admins can view all proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Table: public.proctoring_settings (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins can manage their settings" ON public.proctoring_settings;
CREATE POLICY "Admins can manage their settings" ON public.proctoring_settings USING (((auth.uid() IS NOT NULL) AND ((organization_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Only admins can view proctoring settings" ON public.proctoring_settings;
CREATE POLICY "Only admins can view proctoring settings" ON public.proctoring_settings FOR SELECT USING ((public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_any_role(auth.uid(), ARRAY['partner_admin'::public.app_role, 'hr_recruiter'::public.app_role])));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage all settings" ON public.proctoring_settings;
CREATE POLICY "Platform admins can manage all settings" ON public.proctoring_settings USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));

-- ---------------------------------------------------------------------------
-- Table: public.profiles (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON public.profiles;
CREATE POLICY "Platform admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.promotion_applicable_orgs (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Org members can view their promotion orgs" ON public.promotion_applicable_orgs;
CREATE POLICY "Org members can view their promotion orgs" ON public.promotion_applicable_orgs FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.can_access_org_data(auth.uid(), organization_id)));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage promotion orgs" ON public.promotion_applicable_orgs;
CREATE POLICY "Platform admins can manage promotion orgs" ON public.promotion_applicable_orgs USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.promotion_applicable_plans (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Anyone can view promotion plans" ON public.promotion_applicable_plans;
CREATE POLICY "Anyone can view promotion plans" ON public.promotion_applicable_plans FOR SELECT USING (true);

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage promotion plans" ON public.promotion_applicable_plans;
CREATE POLICY "Platform admins can manage promotion plans" ON public.promotion_applicable_plans USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.promotion_usages (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Org members can view their promotion usages" ON public.promotion_usages;
CREATE POLICY "Org members can view their promotion usages" ON public.promotion_usages FOR SELECT TO authenticated USING (public.can_access_org_data(auth.uid(), organization_id));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage promotion usages" ON public.promotion_usages;
CREATE POLICY "Platform admins can manage promotion usages" ON public.promotion_usages TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can insert promotion usages" ON public.promotion_usages;
CREATE POLICY "Service role can insert promotion usages" ON public.promotion_usages FOR INSERT TO authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.promotions (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Authenticated users can view active promotions" ON public.promotions;
CREATE POLICY "Authenticated users can view active promotions" ON public.promotions FOR SELECT TO authenticated USING (((is_active = true) AND ((valid_until IS NULL) OR (valid_until > now()))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage promotions" ON public.promotions;
CREATE POLICY "Platform admins can manage promotions" ON public.promotions TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.questions (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260103182533_cbd764ad-c3dc-4a51-99a5-f61e57427c8c.sql
DROP POLICY IF EXISTS "questions_update_policy" ON public.questions;
CREATE POLICY "questions_update_policy" ON public.questions
FOR UPDATE
USING (
  -- Platform admin has full access
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  -- Creator can update their own questions
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = questions.interview_id
    AND i.creator_id = auth.uid()
  )
  -- HR recruiter and Tech SPOC can update questions in their org
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = questions.interview_id
    AND i.organization_id IS NOT NULL
    AND user_is_org_member(auth.uid(), i.organization_id)
    AND has_any_role(auth.uid(), ARRAY['hr_recruiter'::app_role, 'tech_spoc'::app_role, 'partner_admin'::app_role])
  )
);

-- ---------------------------------------------------------------------------
-- Table: public.rate_limit_buckets (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role only for rate limits" ON public.rate_limit_buckets;
CREATE POLICY "Service role only for rate limits" ON public.rate_limit_buckets USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Table: public.report_templates (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Organization can manage report templates" ON public.report_templates;
CREATE POLICY "Organization can manage report templates" ON public.report_templates USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));

-- ---------------------------------------------------------------------------
-- Table: public.resume_parsing_results (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Authorized staff can view resume parsing" ON public.resume_parsing_results;
CREATE POLICY "Authorized staff can view resume parsing" ON public.resume_parsing_results FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role, 'interviewer'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can insert resume parsing" ON public.resume_parsing_results;
CREATE POLICY "Service role can insert resume parsing" ON public.resume_parsing_results FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table: public.role_permissions (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Platform admins can manage role permissions" ON public.role_permissions USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Table: public.system_config (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role only" ON public.system_config;
CREATE POLICY "Service role only" ON public.system_config USING ((auth.role() = 'service_role'::text));

-- ---------------------------------------------------------------------------
-- Table: public.test_results (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage test results" ON public.test_results;
CREATE POLICY "Platform admins can manage test results" ON public.test_results USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view test results from their runs" ON public.test_results;
CREATE POLICY "Users can view test results from their runs" ON public.test_results FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.test_runs
  WHERE ((test_runs.id = test_results.run_id) AND ((test_runs.initiated_by = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]))))));

-- ---------------------------------------------------------------------------
-- Table: public.test_runs (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage test runs" ON public.test_runs;
CREATE POLICY "Platform admins can manage test runs" ON public.test_runs USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own test runs" ON public.test_runs;
CREATE POLICY "Users can view their own test runs" ON public.test_runs FOR SELECT USING (((initiated_by = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));

-- ---------------------------------------------------------------------------
-- Table: public.test_suites (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage test suites" ON public.test_suites;
CREATE POLICY "Platform admins can manage test suites" ON public.test_suites TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view test suites" ON public.test_suites;
CREATE POLICY "Platform admins can view test suites" ON public.test_suites FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.training_plans (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Everyone can view active training plans" ON public.training_plans;
CREATE POLICY "Everyone can view active training plans" ON public.training_plans FOR SELECT USING ((is_active = true));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage training plans" ON public.training_plans;
CREATE POLICY "Platform admins can manage training plans" ON public.training_plans USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.training_topics (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Everyone can view topics of active plans" ON public.training_topics;
CREATE POLICY "Everyone can view topics of active plans" ON public.training_topics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.training_plans
  WHERE ((training_plans.id = training_topics.training_plan_id) AND (training_plans.is_active = true)))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage topics" ON public.training_topics;
CREATE POLICY "Platform admins can manage topics" ON public.training_topics USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- ---------------------------------------------------------------------------
-- Table: public.user_badges (1 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Service role can manage user badges" ON public.user_badges;
CREATE POLICY "Service role can manage user badges" ON public.user_badges USING (true);

-- ---------------------------------------------------------------------------
-- Table: public.user_custom_roles (3 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Org admins can manage custom role assignments" ON public.user_custom_roles;
CREATE POLICY "Org admins can manage custom role assignments" ON public.user_custom_roles TO authenticated USING (public.user_is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.user_is_org_admin(auth.uid(), organization_id));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage all custom role assignments" ON public.user_custom_roles;
CREATE POLICY "Platform admins can manage all custom role assignments" ON public.user_custom_roles USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own custom roles" ON public.user_custom_roles;
CREATE POLICY "Users can view their own custom roles" ON public.user_custom_roles FOR SELECT USING (((user_id = auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role])));

-- ---------------------------------------------------------------------------
-- Table: public.user_roles (9 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Allow system trigger to assign guest role on signup" ON public.user_roles;
CREATE POLICY "Allow system trigger to assign guest role on signup" ON public.user_roles FOR INSERT WITH CHECK (((auth.uid() IS NULL) AND (role = 'guest'::public.app_role)));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Partner admins can view org member roles" ON public.user_roles;
CREATE POLICY "Partner admins can view org member roles" ON public.user_roles FOR SELECT USING ((public.has_role(auth.uid(), 'partner_admin'::public.app_role) AND (user_id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can assign roles" ON public.user_roles;
CREATE POLICY "Platform admins can assign roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage all roles" ON public.user_roles;
CREATE POLICY "Platform admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can remove roles" ON public.user_roles;
CREATE POLICY "Platform admins can remove roles" ON public.user_roles FOR DELETE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all roles" ON public.user_roles;
CREATE POLICY "Platform admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can view all user roles" ON public.user_roles;
CREATE POLICY "Platform admins can view all user roles" ON public.user_roles FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can self-assign candidate or guest role" ON public.user_roles;
CREATE POLICY "Users can self-assign candidate or guest role" ON public.user_roles FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (role = ANY (ARRAY['candidate'::public.app_role, 'guest'::public.app_role]))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Table: public.user_topic_progress (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Admins and org admins can view progress" ON public.user_topic_progress;
CREATE POLICY "Admins and org admins can view progress" ON public.user_topic_progress FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::public.app_role]) AND (user_id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text)))))));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.user_topic_progress;
CREATE POLICY "Users can manage their own progress" ON public.user_topic_progress USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Table: public.user_training_assignments (2 policies)
-- ---------------------------------------------------------------------------

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Platform admins can manage assignments" ON public.user_training_assignments;
CREATE POLICY "Platform admins can manage assignments" ON public.user_training_assignments USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));

-- Source: 20260102083322_remix_migration_from_pg_dump.sql
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.user_training_assignments;
CREATE POLICY "Users can view their own assignments" ON public.user_training_assignments FOR SELECT USING ((auth.uid() = user_id));

-- (end of policies)
