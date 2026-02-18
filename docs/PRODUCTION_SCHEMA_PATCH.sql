-- ============================================================================
-- PRODUCTION SCHEMA PATCH - COMPREHENSIVE
-- ============================================================================
-- Run this on existing production databases to sync with development schema.
-- Safe to run multiple times (uses IF NOT EXISTS / DROP IF EXISTS).
-- 
-- Created: 2025-12-26
-- Updated: 2025-12-26 - Full application audit
-- ============================================================================

-- ============================================================================
-- PART 1: CORE HELPER FUNCTIONS (Must exist before RLS policies)
-- ============================================================================

-- 1.1 has_role function (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 1.2 has_any_role function
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- 1.3 has_any_role_with_hierarchy function (platform_admin bypasses all)
CREATE OR REPLACE FUNCTION public.has_any_role_with_hierarchy(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'platform_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- 1.4 user_is_org_member function
CREATE OR REPLACE FUNCTION public.user_is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id 
      AND organization_id = _org_id 
      AND status = 'active'
  )
$$;

-- 1.5 user_is_org_admin function
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id 
      AND organization_id = _org_id 
      AND status = 'active'
      AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND organization_id = _org_id
      AND role = 'partner_admin'
  )
$$;

-- 1.6 can_access_org_data function
CREATE OR REPLACE FUNCTION public.can_access_org_data(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org_id IS NULL OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'platform_admin'
  )
$$;

-- ============================================================================
-- PART 2: subscription_plans - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS annual_discount_percent INTEGER DEFAULT 20;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'fixed';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_amount INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly';
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_interviews INTEGER DEFAULT 100;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_ai_usage INTEGER DEFAULT 10000;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_per_interview INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_per_invitation INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_per_completed_interview INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS included_interviews INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS included_invitations INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS overage_price_per_interview INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS overage_price_per_invitation INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS minimum_monthly INTEGER DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS pricing_notes TEXT;

-- ============================================================================
-- PART 3: organizations - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- PART 4: profiles - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- ============================================================================
-- PART 5: user_roles - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS assigned_by UUID;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_by_role TEXT DEFAULT 'platform_admin';

-- ============================================================================
-- PART 6: interviews - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS skill_domain TEXT;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS questions_status TEXT DEFAULT 'draft';
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS tech_spoc_reviewer_id UUID;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS questions_approved_at TIMESTAMPTZ;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS category_difficulty_distribution JSONB;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS question_type_distribution JSONB;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS required_question_rules JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- PART 7: interview_invitations - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- PART 8: questions - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS selection_count INTEGER DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS last_selected_at TIMESTAMPTZ;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS must_include BOOLEAN DEFAULT false;

-- ============================================================================
-- PART 9: proctoring_sessions - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.proctoring_sessions ADD COLUMN IF NOT EXISTS certification_attempt_id UUID;
ALTER TABLE public.proctoring_sessions ADD COLUMN IF NOT EXISTS learning_attempt_id UUID;
ALTER TABLE public.proctoring_sessions ADD COLUMN IF NOT EXISTS screen_recording_url TEXT;
ALTER TABLE public.proctoring_sessions ADD COLUMN IF NOT EXISTS screenshots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.proctoring_sessions ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

-- ============================================================================
-- PART 10: notifications - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ============================================================================
-- PART 11: organization_members - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS invited_by UUID;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- ============================================================================
-- PART 12: email_logs - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'resend';
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ;

-- ============================================================================
-- PART 13: learning_assessment_attempts - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.learning_assessment_attempts ADD COLUMN IF NOT EXISTS integrity_score INTEGER;
ALTER TABLE public.learning_assessment_attempts ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT false;
ALTER TABLE public.learning_assessment_attempts ADD COLUMN IF NOT EXISTS proctoring_session_id UUID;

-- ============================================================================
-- PART 14: certification_attempts - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.certification_attempts ADD COLUMN IF NOT EXISTS violation_summary JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- PART 15: ai_feature_health - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.ai_feature_health ADD COLUMN IF NOT EXISTS auto_retry_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.ai_feature_health ADD COLUMN IF NOT EXISTS max_retry_attempts INTEGER DEFAULT 3;
ALTER TABLE public.ai_feature_health ADD COLUMN IF NOT EXISTS fallback_model TEXT;
ALTER TABLE public.ai_feature_health ADD COLUMN IF NOT EXISTS fallback_enabled BOOLEAN DEFAULT false;

-- ============================================================================
-- PART 16: ai_model_configurations - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.ai_model_configurations ADD COLUMN IF NOT EXISTS is_ab_testing BOOLEAN DEFAULT false;
ALTER TABLE public.ai_model_configurations ADD COLUMN IF NOT EXISTS ab_test_split_percentage INTEGER DEFAULT 50;
ALTER TABLE public.ai_model_configurations ADD COLUMN IF NOT EXISTS ab_test_model TEXT;
ALTER TABLE public.ai_model_configurations ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE public.ai_model_configurations ADD COLUMN IF NOT EXISTS retry_delay_ms INTEGER DEFAULT 1000;
ALTER TABLE public.ai_model_configurations ADD COLUMN IF NOT EXISTS timeout_ms INTEGER DEFAULT 30000;

-- ============================================================================
-- PART 17: proctoring_settings - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.proctoring_settings ADD COLUMN IF NOT EXISTS detect_phone_usage BOOLEAN DEFAULT true;
ALTER TABLE public.proctoring_settings ADD COLUMN IF NOT EXISTS detect_eye_movement BOOLEAN DEFAULT true;
ALTER TABLE public.proctoring_settings ADD COLUMN IF NOT EXISTS auto_terminate_on_violations BOOLEAN DEFAULT false;
ALTER TABLE public.proctoring_settings ADD COLUMN IF NOT EXISTS max_violations_before_terminate INTEGER DEFAULT 5;

-- ============================================================================
-- PART 18: custom_roles - Add ALL missing columns  
-- ============================================================================

ALTER TABLE public.custom_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================================================
-- PART 19: partner_applications - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;
ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- PART 20: password_setup_invitations - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.password_setup_invitations ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
ALTER TABLE public.password_setup_invitations ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMPTZ;

-- ============================================================================
-- PART 21: invoices - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount INTEGER DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- PART 22: usage_tracking - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS interview_id UUID;
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- PART 23: assessments - Add ALL missing columns
-- ============================================================================

ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS organization_id UUID;

-- ============================================================================
-- PART 24: Fix user_roles RLS policies
-- ============================================================================

-- Drop problematic recursive policies
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view all org member roles" ON public.user_roles;

-- Basic policy: users can read their own roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles 
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Platform admins can view all (uses SECURITY DEFINER function)
DROP POLICY IF EXISTS "Platform admins can view all roles" ON public.user_roles;
CREATE POLICY "Platform admins can view all roles" ON public.user_roles 
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- Platform admins can manage roles
DROP POLICY IF EXISTS "Platform admins can manage roles" ON public.user_roles;
CREATE POLICY "Platform admins can manage roles" ON public.user_roles 
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- Partner admins can view roles in their org
DROP POLICY IF EXISTS "Partner admins can view org roles" ON public.user_roles;
CREATE POLICY "Partner admins can view org roles" ON public.user_roles 
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'partner_admin'::public.app_role) 
  AND organization_id IN (
    SELECT om.organization_id FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- ============================================================================
-- PART 25: Fix subscription_plans RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Platform admins can manage plans" ON public.subscription_plans;

DROP POLICY IF EXISTS "Platform admins can view all plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can view all plans" ON public.subscription_plans 
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

DROP POLICY IF EXISTS "Platform admins can insert plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can insert plans" ON public.subscription_plans 
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

DROP POLICY IF EXISTS "Platform admins can update plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can update plans" ON public.subscription_plans 
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

DROP POLICY IF EXISTS "Platform admins can delete plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can delete plans" ON public.subscription_plans 
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));

-- ============================================================================
-- PART 26: Ensure storage buckets exist
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('consent-documents', 'consent-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentation', 'documentation', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring-recordings', 'proctoring-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 27: Fix indexes that may be missing
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_interviews_creator ON public.interviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_interviews_org ON public.interviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON public.interviews(status);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_interview ON public.interview_attempts(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_email ON public.interview_attempts(candidate_email);
CREATE INDEX IF NOT EXISTS idx_interview_invitations_interview ON public.interview_invitations(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_invitations_email ON public.interview_invitations(candidate_email);
CREATE INDEX IF NOT EXISTS idx_questions_interview ON public.questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt ON public.proctoring_sessions(interview_attempt_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org ON public.user_roles(organization_id);

-- ============================================================================
-- DONE! Comprehensive schema patch complete.
-- ============================================================================
SELECT 'Comprehensive schema patch applied successfully!' as status;
