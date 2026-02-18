-- ============================================================================
-- COMPLETE PRODUCTION MIGRATION - FRESH DATABASE
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor for fresh deployments.
-- This creates ALL 105+ tables in correct dependency order.
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase project's SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run"
-- ============================================================================

-- ============================================================================
-- PART 1: EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 2: ENUMS
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'hr',
      'interviewer',
      'contributor',
      'candidate',
      'guest',
      'platform_admin',
      'partner_admin', 
      'hr_recruiter',
      'ta_creator',
      'billing_contact',
      'tech_spoc'
    );
  END IF;
END $$;

-- ============================================================================
-- PART 3: HELPER FUNCTIONS (must exist before triggers/tables reference them)
-- ============================================================================

-- 3.1 Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.2 Generate slug function
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  random_suffix TEXT;
BEGIN
  base_slug := lower(regexp_replace(input_text, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 50);
  random_suffix := lower(substring(md5(random()::text) from 1 for 4));
  RETURN base_slug || '-' || random_suffix;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.3 Certificate number generator
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TEXT AS $$
DECLARE
  cert_number TEXT;
  year_suffix TEXT;
BEGIN
  year_suffix := TO_CHAR(NOW(), 'YY');
  cert_number := 'CERT-' || year_suffix || '-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  RETURN cert_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.4 Verification code generator
CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.5 Invoice number generator
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3.6 CPI Score Calculator
-- UPDATED: 2025-12-27 - Fixed table name and column names (key/value instead of config_key/config_value)
CREATE OR REPLACE FUNCTION public.calculate_cpi_score(
  p_technical NUMERIC,
  p_problem_solving NUMERIC,
  p_integrity NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_technical_weight NUMERIC;
  v_problem_solving_weight NUMERIC;
  v_integrity_weight NUMERIC;
  v_cpi NUMERIC;
BEGIN
  -- Get weights from platform_configurations (using correct column names: key, value)
  SELECT 
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_technical_weight'), 40),
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_problem_solving_weight'), 30),
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_integrity_weight'), 30)
  INTO v_technical_weight, v_problem_solving_weight, v_integrity_weight;
  
  v_cpi := (
    (p_technical * v_technical_weight / 100) +
    (p_problem_solving * v_problem_solving_weight / 100) +
    (p_integrity * v_integrity_weight / 100)
  );
  RETURN ROUND(v_cpi, 2);
END;
$$;

-- ============================================================================
-- PART 4: CORE TABLES (Level 0 - No Dependencies)
-- ============================================================================

-- 4.1 profiles (matches dev schema)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own_read" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- 4.2 user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Simple non-recursive policy: users can read their own roles
-- Platform admin access is added later (after has_role function is created)
CREATE POLICY "Users can view their own roles" ON public.user_roles 
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 4.3 organizations (matches dev schema)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website TEXT,
  industry TEXT,
  size TEXT,
  country TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  contact_email TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 4.4 subscription_plans (CORRECTED to match dev schema)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL,
  price_amount INTEGER NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  max_users INTEGER NOT NULL DEFAULT 5,
  max_interviews INTEGER NOT NULL DEFAULT 100,
  max_ai_usage INTEGER NOT NULL DEFAULT 10000,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  display_order INTEGER NOT NULL DEFAULT 0,
  pricing_model TEXT NOT NULL DEFAULT 'fixed',
  price_per_interview INTEGER DEFAULT 0,
  price_per_invitation INTEGER DEFAULT 0,
  price_per_completed_interview INTEGER DEFAULT 0,
  included_interviews INTEGER DEFAULT 0,
  included_invitations INTEGER DEFAULT 0,
  overage_price_per_interview INTEGER DEFAULT 0,
  overage_price_per_invitation INTEGER DEFAULT 0,
  minimum_monthly INTEGER DEFAULT 0,
  pricing_notes TEXT,
  annual_discount_percent INTEGER DEFAULT 20,
  currency TEXT NOT NULL DEFAULT 'USD'
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_plans_public_read" ON public.subscription_plans FOR SELECT USING (is_active = true);

-- 4.5 certification_topics
CREATE TABLE IF NOT EXISTS public.certification_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  provider TEXT DEFAULT 'TalentGeenie',
  difficulty_level TEXT NOT NULL,
  required_questions INTEGER DEFAULT 50,
  passing_score INTEGER DEFAULT 70,
  certificate_validity_days INTEGER DEFAULT 365,
  syllabus_topics JSONB,
  recommended_experience TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certification_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certification_topics_public_read" ON public.certification_topics FOR SELECT USING (is_active = true);

-- 4.6 certificate_badges
CREATE TABLE IF NOT EXISTS public.certificate_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  color TEXT NOT NULL,
  badge_type TEXT NOT NULL,
  category TEXT,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certificate_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificate_badges_public_read" ON public.certificate_badges FOR SELECT USING (true);

-- 4.7 ai_providers
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  description TEXT,
  supported_models JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

-- 4.8 email_templates (CORRECTED to match Production Cloud schema)
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

-- 4.9 chatbot_knowledge
CREATE TABLE IF NOT EXISTS public.chatbot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[],
  role_specific TEXT[],
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;

-- 4.10 platform_configurations
CREATE TABLE IF NOT EXISTS public.platform_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_configurations ENABLE ROW LEVEL SECURITY;

-- 4.11 role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_name TEXT NOT NULL UNIQUE,
  description TEXT,
  allowed_roles public.app_role[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 4.12 system_config
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 4.13 test_suites
CREATE TABLE IF NOT EXISTS public.test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 5: LEVEL 1 TABLES (Depend on Level 0)
-- ============================================================================

-- 5.1 organization_members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 5.2 organization_subscriptions
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5.3 partner_applications
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id UUID NOT NULL,
  organization_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  company_size TEXT,
  industry TEXT,
  country TEXT,
  website TEXT,
  use_case TEXT,
  expected_volume TEXT,
  referral_source TEXT,
  selected_plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'pending',
  organization_id UUID REFERENCES public.organizations(id),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- 5.4 interviews
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  job_description TEXT,
  skills TEXT[],
  experience_level TEXT,
  question_count INTEGER DEFAULT 10,
  time_limit INTEGER DEFAULT 60,
  status TEXT DEFAULT 'draft',
  share_link TEXT UNIQUE,
  slug TEXT UNIQUE,
  creator_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  proctoring_enabled BOOLEAN DEFAULT false,
  proctoring_settings JSONB DEFAULT '{}'::jsonb,
  generation_status TEXT DEFAULT 'pending',
  generation_error TEXT,
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- 5.5 interview_templates
CREATE TABLE IF NOT EXISTS public.interview_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  job_description TEXT,
  skills TEXT[],
  experience_level TEXT,
  question_count INTEGER DEFAULT 10,
  time_limit INTEGER DEFAULT 60,
  proctoring_enabled BOOLEAN DEFAULT false,
  proctoring_settings JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  creator_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_templates ENABLE ROW LEVEL SECURITY;

-- 5.6 invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.organization_subscriptions(id),
  invoice_number TEXT UNIQUE DEFAULT public.generate_invoice_number(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  amount_cents INTEGER NOT NULL,
  tax_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL,
  line_items JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  applied_promotion_id UUID,
  stripe_invoice_id TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5.7 promotions
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  min_amount_cents INTEGER,
  max_discount_cents INTEGER,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- 5.8 training_plans
CREATE TABLE IF NOT EXISTS public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty_level TEXT,
  estimated_duration_hours INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- 5.9 learning_subscriptions
CREATE TABLE IF NOT EXISTS public.learning_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL,
  is_unlimited BOOLEAN DEFAULT false,
  amount_spent_cents INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5.10 certification_assessments
CREATE TABLE IF NOT EXISTS public.certification_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_topic_id UUID REFERENCES public.certification_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL,
  time_limit INTEGER NOT NULL,
  min_integrity_score INTEGER DEFAULT 70,
  proctoring_settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certification_assessments ENABLE ROW LEVEL SECURITY;

-- 5.11 learning_plans
CREATE TABLE IF NOT EXISTS public.learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  focus_areas TEXT[],
  difficulty_level TEXT,
  status TEXT DEFAULT 'active',
  progress_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;

-- 5.12 ai_feature_configurations
CREATE TABLE IF NOT EXISTS public.ai_feature_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  primary_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_enabled BOOLEAN DEFAULT false,
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  is_enabled BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_feature_configurations ENABLE ROW LEVEL SECURITY;

-- 5.13 custom_roles
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- 5.14 payment_methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- 5.15 ats_integrations
CREATE TABLE IF NOT EXISTS public.ats_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ats_provider TEXT NOT NULL,
  api_key_encrypted TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active',
  sync_enabled BOOLEAN DEFAULT true,
  sync_frequency INTEGER DEFAULT 60,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ats_integrations ENABLE ROW LEVEL SECURITY;

-- 5.16 analytics_snapshots
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_interviews INTEGER DEFAULT 0,
  total_candidates INTEGER DEFAULT 0,
  avg_cpi_score NUMERIC,
  hiring_rate NUMERIC,
  avg_time_to_hire NUMERIC,
  top_performing_roles TEXT[],
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- 5.17 data_retention_policies
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  auto_delete_enabled BOOLEAN DEFAULT false,
  last_cleanup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- 5.18 payment_gateways
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  gateway_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: LEVEL 2 TABLES (Depend on Level 1)
-- ============================================================================

-- 6.1 questions
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT,
  question_type TEXT DEFAULT 'descriptive',
  options JSONB,
  correct_answer TEXT,
  hints TEXT,
  order_index INTEGER DEFAULT 0,
  approval_status TEXT DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 6.2 interview_invitations
CREATE TABLE IF NOT EXISTS public.interview_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  invitation_token TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  accessed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;

-- 6.3 interview_attempts
CREATE TABLE IF NOT EXISTS public.interview_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.interview_invitations(id),
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  session_token TEXT UNIQUE,
  status TEXT DEFAULT 'in_progress',
  answers JSONB,
  time_taken INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_attempts ENABLE ROW LEVEL SECURITY;

-- 6.4 interview_panel_members
CREATE TABLE IF NOT EXISTS public.interview_panel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID NOT NULL,
  role TEXT DEFAULT 'evaluator',
  added_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_panel_members ENABLE ROW LEVEL SECURITY;

-- 6.5 interview_schedules
CREATE TABLE IF NOT EXISTS public.interview_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_email TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'UTC',
  status TEXT DEFAULT 'scheduled',
  meeting_link TEXT,
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;

-- 6.6 interview_operation_logs
CREATE TABLE IF NOT EXISTS public.interview_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_operation_logs ENABLE ROW LEVEL SECURITY;

-- 6.7 training_topics
CREATE TABLE IF NOT EXISTS public.training_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  estimated_duration_minutes INTEGER,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_topics ENABLE ROW LEVEL SECURITY;

-- 6.8 learning_assessments
CREATE TABLE IF NOT EXISTS public.learning_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_plan_id UUID REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  difficulty_level TEXT,
  question_count INTEGER DEFAULT 10,
  time_limit_minutes INTEGER DEFAULT 30,
  passing_score INTEGER DEFAULT 70,
  is_practice BOOLEAN DEFAULT false,
  price_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;

-- 6.9 promotion_applicable_plans
CREATE TABLE IF NOT EXISTS public.promotion_applicable_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promotion_id, plan_id)
);

ALTER TABLE public.promotion_applicable_plans ENABLE ROW LEVEL SECURITY;

-- 6.10 promotion_applicable_orgs
CREATE TABLE IF NOT EXISTS public.promotion_applicable_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promotion_id, organization_id)
);

ALTER TABLE public.promotion_applicable_orgs ENABLE ROW LEVEL SECURITY;

-- 6.11 payment_transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL,
  failure_reason TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- 6.12 ats_candidates
CREATE TABLE IF NOT EXISTS public.ats_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ats_integrations(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  current_position TEXT,
  current_company TEXT,
  experience_years INTEGER,
  applied_position TEXT,
  resume_url TEXT,
  resume_parsed JSONB,
  skills JSONB,
  education JSONB,
  source TEXT,
  ats_status TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ats_candidates ENABLE ROW LEVEL SECURITY;

-- 6.13 ats_sync_logs
CREATE TABLE IF NOT EXISTS public.ats_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ats_integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  candidates_synced INTEGER DEFAULT 0,
  candidates_failed INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.ats_sync_logs ENABLE ROW LEVEL SECURITY;

-- 6.14 ai_provider_credentials
CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  model_preference TEXT,
  rate_limit_per_minute INTEGER,
  is_active BOOLEAN DEFAULT true,
  test_status TEXT,
  test_error TEXT,
  last_tested_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;

-- 6.15 user_custom_roles
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, custom_role_id, organization_id)
);

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- 6.16 user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.certificate_badges(id) ON DELETE CASCADE,
  certificate_ids UUID[],
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- 6.17 user_training_assignments
CREATE TABLE IF NOT EXISTS public.user_training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  assigned_by UUID,
  status TEXT DEFAULT 'assigned',
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_training_assignments ENABLE ROW LEVEL SECURITY;

-- 6.18 promotion_usages
CREATE TABLE IF NOT EXISTS public.promotion_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.organization_subscriptions(id),
  discount_applied_cents INTEGER NOT NULL,
  original_amount_cents INTEGER NOT NULL,
  final_amount_cents INTEGER NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.promotion_usages ENABLE ROW LEVEL SECURITY;

-- 6.19 test_runs
CREATE TABLE IF NOT EXISTS public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  skipped_tests INTEGER DEFAULT 0,
  duration_ms INTEGER,
  triggered_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 7: LEVEL 3 TABLES (Depend on Level 2)
-- ============================================================================

-- 7.1 proctoring_sessions
CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  face_verification_passed BOOLEAN,
  face_verification_data JSONB,
  video_recording_url TEXT,
  screen_recording_url TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  integrity_score INTEGER DEFAULT 100,
  violation_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;

-- 7.2 assessments
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  overall_score INTEGER NOT NULL,
  hiring_decision TEXT NOT NULL,
  strengths TEXT[],
  weaknesses TEXT[],
  topic_scores JSONB,
  detailed_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- 7.3 candidate_performance_index
CREATE TABLE IF NOT EXISTS public.candidate_performance_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  technical_score NUMERIC DEFAULT 0,
  problem_solving_score NUMERIC DEFAULT 0,
  integrity_score NUMERIC DEFAULT 100,
  overall_cpi NUMERIC DEFAULT 0,
  -- UPDATED: 2025-12-27 - Allow both legacy and new hiring_recommendation values
  hiring_recommendation TEXT NOT NULL CHECK (hiring_recommendation IN 
    ('strongly_recommend', 'recommend', 'consider', 'not_recommended', 'strong_hire', 'hire', 'reject')),
  top_skills TEXT[],
  weak_skills TEXT[],
  topic_scores JSONB,
  easy_correct INTEGER,
  easy_total INTEGER,
  medium_correct INTEGER,
  medium_total INTEGER,
  hard_correct INTEGER,
  hard_total INTEGER,
  violations_detected INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.candidate_performance_index ENABLE ROW LEVEL SECURITY;

-- 7.4 attempt_questions
CREATE TABLE IF NOT EXISTS public.attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attempt_questions ENABLE ROW LEVEL SECURITY;

-- 7.5 panel_evaluations
CREATE TABLE IF NOT EXISTS public.panel_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  overall_score INTEGER NOT NULL,
  hiring_recommendation TEXT NOT NULL,
  strengths TEXT[],
  concerns TEXT[],
  technical_feedback TEXT,
  cultural_feedback TEXT,
  detailed_notes TEXT,
  status TEXT DEFAULT 'draft',
  evaluation_date TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.panel_evaluations ENABLE ROW LEVEL SECURITY;

-- 7.6 panel_consensus
CREATE TABLE IF NOT EXISTS public.panel_consensus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  final_decision TEXT NOT NULL,
  consensus_score INTEGER NOT NULL,
  total_reviewers INTEGER NOT NULL,
  agreement_level TEXT,
  discussion_summary TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.panel_consensus ENABLE ROW LEVEL SECURITY;

-- 7.7 bias_detection_results
CREATE TABLE IF NOT EXISTS public.bias_detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  bias_score NUMERIC DEFAULT 0,
  analysis_model TEXT NOT NULL,
  bias_indicators JSONB,
  language_bias JSONB,
  cultural_bias JSONB,
  technical_bias JSONB,
  recommendations TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bias_detection_results ENABLE ROW LEVEL SECURITY;

-- 7.8 ai_coach_sessions
CREATE TABLE IF NOT EXISTS public.ai_coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  candidate_email TEXT NOT NULL,
  questions_asked INTEGER DEFAULT 0,
  hints_used INTEGER DEFAULT 0,
  hints_provided JSONB DEFAULT '[]'::jsonb,
  total_interaction_time INTEGER DEFAULT 0,
  improvement_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_coach_sessions ENABLE ROW LEVEL SECURITY;

-- 7.9 learning_materials
CREATE TABLE IF NOT EXISTS public.learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_topic_id UUID NOT NULL REFERENCES public.training_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT,
  content_url TEXT,
  duration_minutes INTEGER,
  order_index INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

-- 7.10 user_topic_progress
CREATE TABLE IF NOT EXISTS public.user_topic_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  training_topic_id UUID NOT NULL REFERENCES public.training_topics(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.user_training_assignments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started',
  progress_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, training_topic_id)
);

ALTER TABLE public.user_topic_progress ENABLE ROW LEVEL SECURITY;

-- 7.11 learning_assessment_questions
CREATE TABLE IF NOT EXISTS public.learning_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'mcq',
  topic TEXT,
  difficulty TEXT,
  options JSONB,
  correct_answer TEXT,
  hints TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_questions ENABLE ROW LEVEL SECURITY;

-- 7.12 certification_attempts
CREATE TABLE IF NOT EXISTS public.certification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  certification_assessment_id UUID REFERENCES public.certification_assessments(id) ON DELETE CASCADE,
  proctoring_session_id UUID REFERENCES public.proctoring_sessions(id),
  generated_questions JSONB,
  answers JSONB,
  status TEXT DEFAULT 'in_progress',
  score INTEGER,
  integrity_score INTEGER,
  passed BOOLEAN,
  time_taken INTEGER,
  violation_summary JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;

-- 7.13 test_results
CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  error_stack TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 8: LEVEL 4 TABLES (Depend on Level 3)
-- ============================================================================

-- 8.1 proctoring_violations
CREATE TABLE IF NOT EXISTS public.proctoring_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  evidence_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.proctoring_violations ENABLE ROW LEVEL SECURITY;

-- 8.2 learning_assessment_attempts
CREATE TABLE IF NOT EXISTS public.learning_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.learning_subscriptions(id),
  proctoring_session_id UUID REFERENCES public.proctoring_sessions(id),
  status TEXT DEFAULT 'in_progress',
  answers JSONB,
  score INTEGER,
  integrity_score INTEGER DEFAULT 100,
  passed BOOLEAN,
  time_taken_seconds INTEGER,
  feedback JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_attempts ENABLE ROW LEVEL SECURITY;

-- 8.3 certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  certification_topic_id UUID NOT NULL REFERENCES public.certification_topics(id),
  attempt_id UUID NOT NULL UNIQUE,
  certificate_number TEXT NOT NULL UNIQUE DEFAULT public.generate_certificate_number(),
  verification_code TEXT NOT NULL UNIQUE DEFAULT public.generate_verification_code(),
  score INTEGER NOT NULL,
  integrity_score INTEGER NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  pdf_url TEXT,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- 8.4 learning_assessment_usage
CREATE TABLE IF NOT EXISTS public.learning_assessment_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.learning_subscriptions(id) ON DELETE SET NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  was_free BOOLEAN DEFAULT false,
  was_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_usage ENABLE ROW LEVEL SECURITY;

-- 8.5 learning_assessment_feedback
CREATE TABLE IF NOT EXISTS public.learning_assessment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER,
  difficulty_feedback TEXT,
  content_feedback TEXT,
  suggestions TEXT,
  would_recommend BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_feedback ENABLE ROW LEVEL SECURITY;

-- 8.6 learning_payments
CREATE TABLE IF NOT EXISTS public.learning_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assessment_id UUID REFERENCES public.learning_assessments(id),
  subscription_id UUID REFERENCES public.learning_subscriptions(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_type TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.learning_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 9: REMAINING TABLES (Standalone or Misc)
-- ============================================================================

-- 9.1 audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 9.2 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  category TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 9.3 email_logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.email_templates(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 9.4 consent_records
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- 9.5 data_deletion_requests
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT NOT NULL,
  candidate_name TEXT,
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  data_export_url TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- 9.6 security_events
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- 9.7 onboarding_progress
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  completed_steps TEXT[] DEFAULT '{}',
  current_step TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- 9.8 password_setup_invitations
CREATE TABLE IF NOT EXISTS public.password_setup_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.password_setup_invitations ENABLE ROW LEVEL SECURITY;

-- 9.9 preinterview_check_logs
CREATE TABLE IF NOT EXISTS public.preinterview_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.interview_invitations(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.preinterview_check_logs ENABLE ROW LEVEL SECURITY;

-- 9.10 proctoring_settings
CREATE TABLE IF NOT EXISTS public.proctoring_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.proctoring_settings ENABLE ROW LEVEL SECURITY;

-- 9.11 architecture_documents
CREATE TABLE IF NOT EXISTS public.architecture_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  diagram_type TEXT NOT NULL,
  mermaid_code TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  analyzed_files TEXT[],
  file_hashes JSONB,
  last_generated_at TIMESTAMPTZ,
  needs_refresh BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.architecture_documents ENABLE ROW LEVEL SECURITY;

-- 9.12 approval_workflows
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  workflow_stage TEXT NOT NULL,
  approval_chain JSONB NOT NULL,
  current_approver UUID,
  status TEXT DEFAULT 'pending',
  priority TEXT,
  deadline TIMESTAMPTZ,
  comments TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

-- 9.13 collaboration_threads
CREATE TABLE IF NOT EXISTS public.collaboration_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  parent_id UUID REFERENCES public.collaboration_threads(id),
  author_id UUID,
  content TEXT NOT NULL,
  mentions TEXT[],
  attachments JSONB,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.collaboration_threads ENABLE ROW LEVEL SECURITY;

-- 9.14 comparative_analytics
CREATE TABLE IF NOT EXISTS public.comparative_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  comparison_type TEXT NOT NULL,
  entities JSONB NOT NULL,
  metrics JSONB NOT NULL,
  insights JSONB NOT NULL,
  visualization_data JSONB,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comparative_analytics ENABLE ROW LEVEL SECURITY;

-- 9.15 documentation
CREATE TABLE IF NOT EXISTS public.documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  format TEXT DEFAULT 'markdown',
  version TEXT DEFAULT '1.0',
  file_path TEXT,
  is_published BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;

-- 9.16 failed_jobs
CREATE TABLE IF NOT EXISTS public.failed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;

-- 9.17 generated_reports
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  data JSONB,
  format TEXT DEFAULT 'json',
  file_url TEXT,
  status TEXT DEFAULT 'pending',
  generated_by UUID,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- 9.18 idempotency_keys
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  request_path TEXT NOT NULL,
  request_params JSONB,
  response_status INTEGER,
  response_body JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- 9.19 platform_documentation
CREATE TABLE IF NOT EXISTS public.platform_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  parent_id UUID REFERENCES public.platform_documentation(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_documentation ENABLE ROW LEVEL SECURITY;

-- 9.20 platform_documentation_versions
CREATE TABLE IF NOT EXISTS public.platform_documentation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.platform_documentation(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_documentation_versions ENABLE ROW LEVEL SECURITY;

-- 9.21 predictive_analytics
CREATE TABLE IF NOT EXISTS public.predictive_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL,
  model_version TEXT,
  input_data JSONB NOT NULL,
  predictions JSONB NOT NULL,
  confidence_scores JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.predictive_analytics ENABLE ROW LEVEL SECURITY;

-- 9.22 report_templates
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- 9.23 resume_parsing_results
CREATE TABLE IF NOT EXISTS public.resume_parsing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT NOT NULL,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  file_url TEXT,
  parsed_data JSONB NOT NULL,
  skills_extracted TEXT[],
  experience_years NUMERIC,
  education JSONB,
  parsing_model TEXT,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.resume_parsing_results ENABLE ROW LEVEL SECURITY;

-- 9.24 usage_tracking
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- 9.25 ai_feature_alerts
CREATE TABLE IF NOT EXISTS public.ai_feature_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  notified_admins TEXT[],
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_feature_alerts ENABLE ROW LEVEL SECURITY;

-- 9.26 ai_feature_health
CREATE TABLE IF NOT EXISTS public.ai_feature_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  status TEXT DEFAULT 'unknown',
  current_model TEXT NOT NULL,
  fallback_model TEXT,
  fallback_enabled BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  auto_retry_enabled BOOLEAN DEFAULT true,
  max_retry_attempts INTEGER DEFAULT 3,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  average_latency_ms NUMERIC,
  consecutive_failures INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  last_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_feature_health ENABLE ROW LEVEL SECURITY;

-- 9.27 ai_health_alerts
CREATE TABLE IF NOT EXISTS public.ai_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_health_alerts ENABLE ROW LEVEL SECURITY;

-- 9.28 ai_health_checks
CREATE TABLE IF NOT EXISTS public.ai_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_health_checks ENABLE ROW LEVEL SECURITY;

-- 9.29 ai_health_monitoring
CREATE TABLE IF NOT EXISTS public.ai_health_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_health_monitoring ENABLE ROW LEVEL SECURITY;

-- 9.30 ai_model_configurations
CREATE TABLE IF NOT EXISTS public.ai_model_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE,
  edge_function TEXT NOT NULL,
  primary_model TEXT NOT NULL,
  fallback_model TEXT,
  is_ab_testing BOOLEAN DEFAULT false,
  ab_test_model TEXT,
  ab_test_split_percentage INTEGER DEFAULT 50,
  max_retries INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  retry_delay_ms INTEGER DEFAULT 1000,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_model_configurations ENABLE ROW LEVEL SECURITY;

-- 9.31 ai_model_performance
CREATE TABLE IF NOT EXISTS public.ai_model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  test_period_start TIMESTAMPTZ NOT NULL,
  test_period_end TIMESTAMPTZ,
  is_active_test BOOLEAN DEFAULT true,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  average_latency_ms NUMERIC,
  average_quality_score NUMERIC,
  cost_per_request_cents NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_model_performance ENABLE ROW LEVEL SECURITY;

-- 9.32 ai_usage_logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  feature_name TEXT NOT NULL,
  model_used TEXT,
  request_tokens INTEGER,
  response_tokens INTEGER,
  total_cost_cents INTEGER,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 9.33 certification_global_config
CREATE TABLE IF NOT EXISTS public.certification_global_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certification_global_config ENABLE ROW LEVEL SECURITY;

-- 9.34 circuit_breaker_state
CREATE TABLE IF NOT EXISTS public.circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  state TEXT DEFAULT 'closed',
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_threshold INTEGER DEFAULT 5,
  success_threshold INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  half_open_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.circuit_breaker_state ENABLE ROW LEVEL SECURITY;

-- 9.35 rate_limit_buckets
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  tokens INTEGER NOT NULL,
  last_refill_at TIMESTAMPTZ DEFAULT now(),
  max_tokens INTEGER NOT NULL,
  refill_rate INTEGER NOT NULL,
  refill_interval_seconds INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 10: ADD FOREIGN KEY FOR certificates -> learning_assessment_attempts
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'certificates_attempt_id_fkey' AND table_name = 'certificates'
  ) THEN
    ALTER TABLE public.certificates 
      ADD CONSTRAINT certificates_attempt_id_fkey 
      FOREIGN KEY (attempt_id) REFERENCES public.learning_assessment_attempts(id);
  END IF;
END $$;

-- ============================================================================
-- PART 11: ADDITIONAL HELPER FUNCTIONS
-- ============================================================================

-- 11.1 User is org member
CREATE OR REPLACE FUNCTION public.user_is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  );
$$;

-- 11.2 User is org admin
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'platform_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    JOIN public.user_roles ur ON ur.user_id = om.user_id
    WHERE om.user_id = _user_id 
      AND om.organization_id = _org_id
      AND om.status = 'active'
      AND ur.role = 'partner_admin'
  );
$$;

-- 11.3 Can access org data
CREATE OR REPLACE FUNCTION public.can_access_org_data(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_is_org_admin(_user_id, _org_id) OR public.user_is_org_member(_user_id, _org_id);
$$;

-- 11.4 Has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 11.5 Has any role
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;
-- 11.6 Get user roles
-- IMPORTANT: Must DROP first if changing return type from app_role[] to SETOF app_role
DROP FUNCTION IF EXISTS public.get_user_roles(uuid);

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 11.7 Check and award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Placeholder for badge awarding logic
  NULL;
END;
$$;

-- ============================================================================
-- PART 12: TRIGGERS
-- ============================================================================

-- Create triggers for updated_at columns
DO $$
DECLARE
  tbl TEXT;
  tables_with_updated_at TEXT[] := ARRAY[
    'profiles', 'organizations', 'subscription_plans', 'certification_topics',
    'interviews', 'interview_templates', 'invoices', 'promotions', 'training_plans',
    'learning_subscriptions', 'certification_assessments', 'learning_plans',
    'ai_feature_configurations', 'custom_roles', 'payment_methods', 'ats_integrations',
    'data_retention_policies', 'payment_gateways', 'organization_subscriptions',
    'partner_applications', 'interview_attempts', 'interview_schedules',
    'training_topics', 'learning_assessments', 'payment_transactions',
    'user_training_assignments', 'proctoring_sessions', 'candidate_performance_index',
    'user_topic_progress', 'certification_attempts', 'learning_assessment_attempts',
    'onboarding_progress', 'proctoring_settings', 'architecture_documents',
    'approval_workflows', 'collaboration_threads', 'documentation', 'platform_documentation',
    'report_templates', 'ai_feature_health', 'ai_model_configurations', 'ai_model_performance',
    'certification_global_config', 'circuit_breaker_state', 'rate_limit_buckets',
    'ai_provider_credentials', 'email_templates', 'chatbot_knowledge', 'platform_configurations',
    'system_config', 'test_suites'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_with_updated_at
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER update_%s_updated_at 
         BEFORE UPDATE ON public.%I 
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        replace(tbl, '-', '_'), tbl
      );
    EXCEPTION WHEN duplicate_object THEN
      -- Trigger already exists, skip
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PART 13: ORGANIZATION SLUG TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_organization_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_organization_slug_trigger') THEN
    CREATE TRIGGER set_organization_slug_trigger
      BEFORE INSERT ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION public.set_organization_slug();
  END IF;
END $$;

-- ============================================================================
-- PART 14: INTERVIEW SLUG TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_interview_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_interview_slug_trigger') THEN
    CREATE TRIGGER set_interview_slug_trigger
      BEFORE INSERT ON public.interviews
      FOR EACH ROW EXECUTE FUNCTION public.set_interview_slug();
  END IF;
END $$;

-- ============================================================================
-- PART 15: FIX USER_ROLES RLS (add platform admin access after has_role exists)
-- ============================================================================

-- Now that has_role() function exists, add platform admin read-all policy
CREATE POLICY "Platform admins can view all roles" ON public.user_roles 
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Platform admins can manage roles
CREATE POLICY "Platform admins can manage roles" ON public.user_roles 
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- ============================================================================
-- PART 16: SUBSCRIPTION_PLANS RLS (platform admin access)
-- ============================================================================

-- Platform admins can view ALL plans (including inactive)
CREATE POLICY "Platform admins can view all plans" ON public.subscription_plans 
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Platform admins can insert plans
CREATE POLICY "Platform admins can insert plans" ON public.subscription_plans 
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Platform admins can update plans
CREATE POLICY "Platform admins can update plans" ON public.subscription_plans 
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Platform admins can delete plans
CREATE POLICY "Platform admins can delete plans" ON public.subscription_plans 
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- ============================================================================
-- DONE! Your database now has all 105+ tables with proper RLS.
-- ============================================================================
SELECT 'Migration complete! All tables created successfully.' as status;
