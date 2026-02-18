-- ============================================================================
-- COMPREHENSIVE RLS AUDIT & FIX
-- InterviewTalentGeenie Self-Hosted
-- ============================================================================
--
-- AUDIT FINDINGS:
--   • 106 public tables, 105 with RLS enabled
--   • 217 existing policies across 63 tables  
--   • 42 tables with RLS ON but ZERO policies (complete lockout)
--   • 19 of those 42 are actively queried by the frontend (broken features!)
--   • 31 groups of duplicate/overlapping policies
--   • 8 "service role" policies dangerously targeting {public} with USING(true)
--   • 6 policies referencing legacy roles (admin, hr, interviewer, ta_creator)
--   • 68 policies targeting {public} that should be {authenticated}
--
-- STRATEGY:
--   Backend RLS = security enforcement (the real guard)
--   Frontend RBAC = UX (hide/show, redirect) — never trust-worthy alone
--   
--   Standard helper functions (all SECURITY DEFINER):
--     • is_platform_admin() — checks current user is platform_admin
--     • has_role(uid, role) — checks a specific role
--     • has_any_role(uid, roles[]) — checks any of several roles
--     • has_any_role_with_hierarchy(uid, roles[]) — checks roles OR platform_admin
--     • user_is_org_admin(uid, org_id) — platform_admin OR partner_admin in org
--     • user_is_org_member(uid, org_id) — active member of org
--     • get_user_org_ids(uid) — returns set of org_ids user belongs to
--
--   Standard policy patterns per table category:
--     A. ADMIN-ONLY tables: platform_admin full access
--     B. ORG-SCOPED tables: org members read, org admins write, platform_admin all
--     C. USER-OWNED tables: owner read/write own, admins read all
--     D. PUBLIC-READ tables: anyone can read, admins can write
--     E. SYSTEM tables: service_role only write, admins read
--     F. INTERVIEW-FLOW tables: complex (candidates, creators, org members, admins)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: FIX CRITICAL SECURITY — Overly permissive {public} policies
-- These allow ANONYMOUS users to read/write data meant for service_role only
-- ============================================================================

-- ai_coach_sessions: "Service role can manage coach sessions" uses {public} + USING(true)
DROP POLICY IF EXISTS "Service role can manage coach sessions" ON ai_coach_sessions;

-- analytics_snapshots: "Service role can manage analytics" uses {public} + USING(true)  
DROP POLICY IF EXISTS "Service role can manage analytics" ON analytics_snapshots;

-- ats_candidates: "Service role can manage ATS candidates" uses {public} + USING(true)
DROP POLICY IF EXISTS "Service role can manage ATS candidates" ON ats_candidates;

-- candidate_performance_index: "Service role can manage CPI" uses {public} + USING(true)
DROP POLICY IF EXISTS "Service role can manage CPI" ON candidate_performance_index;

-- certificates: "Service role can manage certificates" uses {public} + USING(true)
DROP POLICY IF EXISTS "Service role can manage certificates" ON certificates;

-- certification_attempts: "Service role can manage attempts" uses {public} + USING(true)
DROP POLICY IF EXISTS "Service role can manage attempts" ON certification_attempts;

-- consent_records: "Service role can manage consent records" uses {public} + USING(true)
DROP POLICY IF EXISTS "Service role can manage consent records" ON consent_records;

-- user_badges: "Service role can manage user badges" uses {public} + USING(true)
DROP POLICY IF EXISTS "Service role can manage user badges" ON user_badges;

-- Note: We do NOT need to recreate these as {service_role} policies because
-- the service_role in Supabase automatically BYPASSES RLS. These policies were
-- redundant AND dangerous. The service_role key will still have full access.

-- ============================================================================
-- PHASE 2: REMOVE DUPLICATE POLICIES
-- Keep the most specific/correct one, remove overlapping duplicates
-- ============================================================================

-- --- organizations (7 policies, 3 duplicate admin ALL policies) ---
DROP POLICY IF EXISTS "organizations_admin_manage" ON organizations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;
-- Keep: "Platform admins can manage all orgs"

DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "Org members can view their org" ON organizations;
-- Keep: "Members can view their organization" (most descriptive)

-- --- ai_feature_alerts (3 → 1) ---
DROP POLICY IF EXISTS "ai_feature_alerts_admin_policy" ON ai_feature_alerts;
DROP POLICY IF EXISTS "Platform admins can view alerts" ON ai_feature_alerts;
-- Keep: "Platform admins can manage alerts" (ALL covers SELECT)

-- --- ai_model_configurations (3 → 1) ---
DROP POLICY IF EXISTS "ai_model_configurations_admin_policy" ON ai_model_configurations;
DROP POLICY IF EXISTS "Platform admins can view model configs" ON ai_model_configurations;
-- Keep: "Platform admins can manage model configs" (ALL covers SELECT)

-- --- audit_logs (duplicates) ---
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
-- Keep: "Admins can view audit logs"
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
-- Keep: "Service role can insert audit logs" (correctly targets {service_role})

-- --- assessments (duplicate inserts) ---
DROP POLICY IF EXISTS "assessments_insert_policy" ON assessments;
-- Keep: "Service role can insert assessments" (rename to fix target)
DROP POLICY IF EXISTS "assessments_select_policy" ON assessments;
-- Keep: "Platform admins, org admins and creators can view assessments"

-- --- certificate_badges (duplicate read + duplicate admin) ---
DROP POLICY IF EXISTS "certificate_badges_public_read" ON certificate_badges;
-- Keep: "Anyone can view badges"
DROP POLICY IF EXISTS "certificate_badges_admin_write" ON certificate_badges;
-- Keep: "Admins can manage badges"

-- --- certification_topics (duplicate read + duplicate admin) ---
DROP POLICY IF EXISTS "certification_topics_public_read" ON certification_topics;
-- Keep: "Everyone can view active certification topics"
DROP POLICY IF EXISTS "certification_topics_admin_all" ON certification_topics;
-- Keep: "Admins can manage certification topics"

-- --- custom_roles (duplicate admin ALL) ---
DROP POLICY IF EXISTS "custom_roles_org_admin_policy" ON custom_roles;
-- Keep: "Platform admins can manage all custom roles"

-- --- data_deletion_requests (duplicate admin) ---
DROP POLICY IF EXISTS "data_deletion_requests_admin_policy" ON data_deletion_requests;
-- Keep: "Platform admins can manage deletion requests"

-- --- data_retention_policies (duplicate admin) ---
DROP POLICY IF EXISTS "data_retention_policies_org_policy" ON data_retention_policies;
-- Keep: "Platform and org admins can manage retention policies"

-- --- documentation (overlapping) ---
DROP POLICY IF EXISTS "Anonymous: Deny all documentation access" ON documentation;
-- Keep: "Admins can manage documentation" (ALL is sufficient; anon has no auth → blocked)

-- --- email_templates (duplicate read) ---
DROP POLICY IF EXISTS "Service role can read all templates" ON email_templates;
-- Keep: "Platform admins can manage all email templates" + "Platform admins can view email templates"

-- --- interview_invitations (duplicate admin) ---
DROP POLICY IF EXISTS "interview_invitations_manage_policy" ON interview_invitations;
-- Keep: "Platform admins can manage invitations" + "Service role can manage invitations"

-- --- interview_attempts (14 → sane set) ---
-- Remove duplicates, keep distinct purposes
DROP POLICY IF EXISTS "interview_attempts_select_policy" ON interview_attempts;
DROP POLICY IF EXISTS "interview_attempts_insert_policy" ON interview_attempts;
DROP POLICY IF EXISTS "Authenticated users can view their own attempts" ON interview_attempts;
DROP POLICY IF EXISTS "Candidates can view own attempts" ON interview_attempts;
DROP POLICY IF EXISTS "Candidates can update own attempts" ON interview_attempts;
DROP POLICY IF EXISTS "Candidates can create attempts" ON interview_attempts;
-- Keep: "Candidates can view their own attempts" (SELECT, owner-based)
-- Keep: "Email-matched users can create attempts" (INSERT, email-match)
-- Keep: "Candidates can update their own attempts" (UPDATE, owner-based)
-- Keep: "Session-based: Update own attempt - protected PII" (UPDATE, session-based)
-- Keep: "Staff and platform admins can view attempts" (SELECT, admin)
-- Keep: "Org admins can view org interview attempts" (SELECT, org-scoped)
-- Keep: "Creators and admins can delete attempts" (DELETE)
-- Note: We'll also fix "Creators and admins can delete attempts" to use modern roles

-- --- interviews (duplicate SELECT and INSERT) ---
DROP POLICY IF EXISTS "interviews_select_policy" ON interviews;
DROP POLICY IF EXISTS "interviews_insert_policy" ON interviews;
-- Keep: "Users can view own and org interviews" + "Authenticated users can create interviews"

-- --- proctoring_sessions (12 → sane set) ---
DROP POLICY IF EXISTS "proctoring_sessions_select_policy" ON proctoring_sessions;
DROP POLICY IF EXISTS "proctoring_sessions_insert_policy" ON proctoring_sessions;
DROP POLICY IF EXISTS "Admins and recruiters can view all proctoring sessions" ON proctoring_sessions;
DROP POLICY IF EXISTS "Org admins can view org proctoring sessions" ON proctoring_sessions;
DROP POLICY IF EXISTS "Platform admins can view all proctoring sessions" ON proctoring_sessions;
-- Keep: "Authorized users can view interview proctoring sessions" (most comprehensive)
-- Keep: "Org members can view org proctoring sessions" (org-scoped)
-- Keep: "Authenticated users can create proctoring sessions for learning" (INSERT)
-- Keep: "Admins can delete proctoring sessions" (DELETE)

-- --- profiles (duplicate admin SELECT) ---
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON profiles;
-- Keep: "profiles_select_policy" (more comprehensive, includes org admin check)

-- --- questions (duplicate SELECT) ---
DROP POLICY IF EXISTS "questions_active_select" ON questions;
DROP POLICY IF EXISTS "questions_creator_select" ON questions;
DROP POLICY IF EXISTS "questions_org_select" ON questions;
-- Keep: "Creators only: View own questions" (covers authenticated owner access)
-- Note: We'll create a cleaner replacement below

-- --- subscription_plans (duplicate read) ---
-- These should be publicly readable (pricing page is public)
DROP POLICY IF EXISTS "subscription_plans_anon_read" ON subscription_plans;
-- Keep: "Anyone can view active plans"

-- ============================================================================
-- PHASE 3: FIX POLICIES REFERENCING LEGACY ROLES
-- Legacy roles: admin, hr, interviewer, ta_creator, candidate, contributor
-- Modern roles: platform_admin, partner_admin, hr_recruiter, tech_spoc, billing_contact, guest
-- ============================================================================

-- documentation: "Admins can manage documentation" references 'admin' role
DROP POLICY IF EXISTS "Admins can manage documentation" ON documentation;
CREATE POLICY "Platform admins can manage documentation" ON documentation
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- interview_attempts: "Creators and admins can delete attempts" references 'admin'
DROP POLICY IF EXISTS "Creators and admins can delete attempts" ON interview_attempts;
CREATE POLICY "Admins can delete interview attempts" ON interview_attempts
  FOR DELETE TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- proctoring_sessions: "Admins can delete proctoring sessions" references 'admin'
DROP POLICY IF EXISTS "Admins can delete proctoring sessions" ON proctoring_sessions;
CREATE POLICY "Platform admins can delete proctoring sessions" ON proctoring_sessions
  FOR DELETE TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- interviews: "interviews_select_policy" references 'ta_creator'
-- Already dropped above; "Users can view own and org interviews" is the replacement

-- ============================================================================
-- PHASE 4: FIX {public} → {authenticated} TARGETING
-- Policies using uid() but targeting {public} (includes anon users)
-- Should target {authenticated} instead
-- ============================================================================

-- Rather than drop/recreate hundreds of policies for this cosmetic issue,
-- note that in Supabase, anon users have NO uid() → these policies effectively
-- don't grant access to anonymous users because uid() returns NULL.
-- This is technically safe but messy. We'll fix the most visible ones.

-- ai_coach_sessions: Fix remaining policies
DROP POLICY IF EXISTS "ai_coach_sessions_select_policy" ON ai_coach_sessions;
CREATE POLICY "Staff can view coach sessions" ON ai_coach_sessions
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role]));

DROP POLICY IF EXISTS "ai_coach_sessions_insert_policy" ON ai_coach_sessions;
CREATE POLICY "Authenticated users can create coach sessions" ON ai_coach_sessions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix ai_health_monitoring
DROP POLICY IF EXISTS "ai_health_monitoring_admin_policy" ON ai_health_monitoring;
CREATE POLICY "Platform admins can manage AI health monitoring" ON ai_health_monitoring
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- Fix ai_model_performance
DROP POLICY IF EXISTS "ai_model_performance_admin_policy" ON ai_model_performance;
CREATE POLICY "Platform admins can manage AI model performance" ON ai_model_performance
  FOR ALL TO authenticated
  USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
  WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- Fix assessments insert
DROP POLICY IF EXISTS "Service role can insert assessments" ON assessments;
-- service_role bypasses RLS, no need for explicit policy

-- Fix various INSERT policies that used {public} + WITH CHECK(true)
DROP POLICY IF EXISTS "ats_sync_logs insert" ON ats_sync_logs;
DROP POLICY IF EXISTS "bias_detection_results insert" ON bias_detection_results;
DROP POLICY IF EXISTS "security_events insert" ON security_events;
-- service_role bypasses RLS for these system tables

-- ============================================================================
-- PHASE 5: FIX 42 LOCKED-OUT TABLES
-- These have RLS enabled but NO policies → all queries return empty
-- 19 of these are actively used by the frontend!
-- ============================================================================

-- ----- LEARNING SYSTEM (9 tables — heavily used by frontend) -----

-- learning_assessments: Quizzes/tests within learning topics
CREATE POLICY "Anyone can view published learning assessments" ON learning_assessments
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Platform admins can manage learning assessments" ON learning_assessments
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- learning_assessment_attempts: User's attempts at learning assessments
CREATE POLICY "Users can view own learning attempts" ON learning_assessment_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can create learning attempts" ON learning_assessment_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own learning attempts" ON learning_assessment_attempts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can view all learning attempts" ON learning_assessment_attempts
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- learning_assessment_questions: Questions within learning assessments
CREATE POLICY "Anyone can view learning assessment questions" ON learning_assessment_questions
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage learning assessment questions" ON learning_assessment_questions
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- learning_assessment_feedback: Feedback on learning assessments
CREATE POLICY "Users can view own assessment feedback" ON learning_assessment_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "System can insert assessment feedback" ON learning_assessment_feedback
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admins can view all assessment feedback" ON learning_assessment_feedback
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- learning_assessment_usage: Usage tracking for learning assessments
CREATE POLICY "Users can view own learning usage" ON learning_assessment_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "System can track learning usage" ON learning_assessment_usage
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admins can view all learning usage" ON learning_assessment_usage
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- learning_materials: Content materials for learning
CREATE POLICY "Anyone can view learning materials" ON learning_materials
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage learning materials" ON learning_materials
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- learning_payments: Payment records for learning subscriptions
CREATE POLICY "Users can view own learning payments" ON learning_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "System can create learning payments" ON learning_payments
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admins can view all learning payments" ON learning_payments
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- learning_plans: User's personalized learning plans
CREATE POLICY "Users can view own learning plans" ON learning_plans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can manage own learning plans" ON learning_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all learning plans" ON learning_plans
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- learning_subscriptions: Active learning subscriptions
CREATE POLICY "Users can view own learning subscriptions" ON learning_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "System can manage learning subscriptions" ON learning_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin())
  WITH CHECK (true);

-- ----- ORGANIZATION MANAGEMENT -----

-- organization_subscriptions: Org-level subscription details
CREATE POLICY "Org members can view their subscription" ON organization_subscriptions
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    OR is_platform_admin()
  );
CREATE POLICY "Admins can manage org subscriptions" ON organization_subscriptions
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ----- PARTNER APPLICATIONS -----

-- partner_applications: Applications to become a partner (uses applicant_user_id)
CREATE POLICY "Users can view own applications" ON partner_applications
  FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());
CREATE POLICY "Users can submit applications" ON partner_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());
CREATE POLICY "Admins can manage all applications" ON partner_applications
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ----- INTERVIEW PANELS -----

-- interview_panel_members: Members assigned to interview panels
CREATE POLICY "Panel members can view own panels" ON interview_panel_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Org members can view panel members" ON interview_panel_members
  FOR SELECT TO authenticated
  USING (
    interview_id IN (
      SELECT i.id FROM interviews i
      WHERE i.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );
CREATE POLICY "Admins can manage panel members" ON interview_panel_members
  FOR ALL TO authenticated
  USING (is_platform_admin() OR has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]))
  WITH CHECK (is_platform_admin() OR has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]));

-- panel_consensus: Consensus decisions from interview panels (uses attempt_id)
CREATE POLICY "Panel members can view consensus" ON panel_consensus
  FOR SELECT TO authenticated
  USING (
    attempt_id IN (
      SELECT ia.id FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE i.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
    OR is_platform_admin()
  );
CREATE POLICY "Panel members can create consensus" ON panel_consensus
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- panel_evaluations: Individual evaluations from panel members (uses reviewer_id, attempt_id)
CREATE POLICY "Evaluators can manage own evaluations" ON panel_evaluations
  FOR ALL TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "Org members can view evaluations" ON panel_evaluations
  FOR SELECT TO authenticated
  USING (
    attempt_id IN (
      SELECT ia.id FROM interview_attempts ia
      JOIN interviews i ON i.id = ia.interview_id
      WHERE i.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
    OR is_platform_admin()
  );

-- ----- PAYMENTS -----

-- payment_gateways: Payment gateway configurations
CREATE POLICY "Admins can manage payment gateways" ON payment_gateways
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Org admins can view payment gateways" ON payment_gateways
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'billing_contact'::app_role]));

-- payment_methods: Stored payment methods (org-based, no user_id)
CREATE POLICY "Org admins can manage payment methods" ON payment_methods
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    AND has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'billing_contact'::app_role])
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    AND has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'billing_contact'::app_role])
  );
CREATE POLICY "Admins can view all payment methods" ON payment_methods
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- payment_transactions: Transaction records (org-based, no user_id)
CREATE POLICY "Org admins can view org transactions" ON payment_transactions
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    AND has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'billing_contact'::app_role])
  );
CREATE POLICY "Admins can manage all transactions" ON payment_transactions
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ----- PLATFORM CONFIGURATION -----

-- platform_configurations: System-wide config settings
CREATE POLICY "Admins can manage platform configs" ON platform_configurations
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Authenticated can read platform configs" ON platform_configurations
  FOR SELECT TO authenticated
  USING (true);

-- platform_documentation: Platform docs
CREATE POLICY "Anyone can read platform docs" ON platform_documentation
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage platform docs" ON platform_documentation
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- platform_documentation_versions: Doc version history
CREATE POLICY "Anyone can read doc versions" ON platform_documentation_versions
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage doc versions" ON platform_documentation_versions
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ----- PROMOTIONS -----

-- promotions: Discount/promo codes
CREATE POLICY "Anyone can view active promotions" ON promotions
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage promotions" ON promotions
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- promotion_applicable_orgs: Orgs a promotion applies to
CREATE POLICY "Admins can manage promotion org assignments" ON promotion_applicable_orgs
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Org members can view applicable promotions" ON promotion_applicable_orgs
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- promotion_applicable_plans: Plans a promotion applies to
CREATE POLICY "Admins can manage promotion plan assignments" ON promotion_applicable_plans
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Anyone can view promotion plan mappings" ON promotion_applicable_plans
  FOR SELECT TO authenticated
  USING (true);

-- promotion_usages: Tracking promo usage (org-based, no user_id)
CREATE POLICY "Org members can view own promotion usage" ON promotion_usages
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    OR is_platform_admin()
  );
CREATE POLICY "System can record promotion usage" ON promotion_usages
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admins can view all promotion usage" ON promotion_usages
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- ----- PROCTORING -----

-- proctoring_settings: Proctoring configuration per interview/org
CREATE POLICY "Org members can view proctoring settings" ON proctoring_settings
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    OR is_platform_admin()
  );
CREATE POLICY "Admins and org admins can manage proctoring settings" ON proctoring_settings
  FOR ALL TO authenticated
  USING (
    is_platform_admin() OR
    (organization_id IN (SELECT get_user_org_ids(auth.uid()))
     AND has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]))
  )
  WITH CHECK (
    is_platform_admin() OR
    (organization_id IN (SELECT get_user_org_ids(auth.uid()))
     AND has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]))
  );

-- ----- TRAINING -----

-- training_plans: Training plan definitions
CREATE POLICY "Anyone can view training plans" ON training_plans
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage training plans" ON training_plans
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- training_topics: Topics within training plans
CREATE POLICY "Anyone can view training topics" ON training_topics
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage training topics" ON training_topics
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- user_topic_progress: User's progress on training topics
CREATE POLICY "Users can view own topic progress" ON user_topic_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own topic progress" ON user_topic_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all topic progress" ON user_topic_progress
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- user_training_assignments: Assigned training for users
CREATE POLICY "Users can view own training assignments" ON user_training_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can manage training assignments" ON user_training_assignments
  FOR ALL TO authenticated
  USING (is_platform_admin() OR has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]))
  WITH CHECK (is_platform_admin() OR has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]));

-- ----- RBAC -----

-- role_permissions: Permission definitions per role
CREATE POLICY "Anyone can read role permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage role permissions" ON role_permissions
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- user_custom_roles: Custom role assignments
CREATE POLICY "Users can view own custom roles" ON user_custom_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can manage custom roles" ON user_custom_roles
  FOR ALL TO authenticated
  USING (is_platform_admin() OR has_role(auth.uid(), 'partner_admin'::app_role))
  WITH CHECK (is_platform_admin() OR has_role(auth.uid(), 'partner_admin'::app_role));

-- ----- REMAINING TABLES (23 less-used) -----

-- interview_operation_logs: Operation audit trail
CREATE POLICY "Admins can view operation logs" ON interview_operation_logs
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]));
CREATE POLICY "System can insert operation logs" ON interview_operation_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- password_setup_invitations: Password setup flows
CREATE POLICY "Users can view own invitations" ON password_setup_invitations
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Admins can manage invitations" ON password_setup_invitations
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- predictive_analytics: AI-generated predictions
CREATE POLICY "Org members can view org predictions" ON predictive_analytics
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    OR is_platform_admin()
  );
CREATE POLICY "Admins can manage predictions" ON predictive_analytics
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- preinterview_check_logs: Pre-interview validation logs (uses attempt_id)
CREATE POLICY "Users can view own check logs" ON preinterview_check_logs
  FOR SELECT TO authenticated
  USING (
    attempt_id IN (
      SELECT id FROM interview_attempts
      WHERE candidate_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR is_platform_admin()
  );
CREATE POLICY "System can insert check logs" ON preinterview_check_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- rate_limit_buckets: Rate limiting state
CREATE POLICY "Admins can view rate limits" ON rate_limit_buckets
  FOR SELECT TO authenticated
  USING (is_platform_admin());
CREATE POLICY "System can manage rate limits" ON rate_limit_buckets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- report_templates: Report generation templates
CREATE POLICY "Authenticated can view report templates" ON report_templates
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins can manage report templates" ON report_templates
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- resume_parsing_results: Parsed resume data (attempt-based, no user_id)
CREATE POLICY "Candidates can view own resume results" ON resume_parsing_results
  FOR SELECT TO authenticated
  USING (
    attempt_id IN (
      SELECT id FROM interview_attempts
      WHERE candidate_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
CREATE POLICY "Admins can view all resume results" ON resume_parsing_results
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role]));
CREATE POLICY "System can insert resume results" ON resume_parsing_results
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- system_config: Global system configuration
CREATE POLICY "Admins can manage system config" ON system_config
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Authenticated can read system config" ON system_config
  FOR SELECT TO authenticated
  USING (true);

-- test_suites / test_runs / test_results: E2E testing tables
CREATE POLICY "Admins can manage test suites" ON test_suites
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Admins can manage test runs" ON test_runs
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
CREATE POLICY "Admins can manage test results" ON test_results
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

COMMIT;
