-- ============================================================================
-- PRODUCTION COMPLETE SCHEMA EXPORT
-- Generated from Production Cloud Database on 2024-12-26
-- Run this script in your production Supabase SQL Editor
-- Contains: 105 tables, 109 functions, 1 ENUM type
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENUM TYPES
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM (
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
-- SECTION 2: HELPER FUNCTIONS (Must be created before tables that use them)
-- ============================================================================

-- Generate slug function
CREATE OR REPLACE FUNCTION public.generate_slug(input_text text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;

-- Has role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Has any role function
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- Has any role with hierarchy function
CREATE OR REPLACE FUNCTION public.has_any_role_with_hierarchy(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- User is org member function
CREATE OR REPLACE FUNCTION public.user_is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  );
$$;

-- User is org admin function
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

-- Can access org data function
CREATE OR REPLACE FUNCTION public.can_access_org_data(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.user_is_org_admin(_user_id, _org_id) OR public.user_is_org_member(_user_id, _org_id);
$$;

-- Generate certificate number
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  cert_number TEXT;
  year_suffix TEXT;
BEGIN
  year_suffix := TO_CHAR(NOW(), 'YY');
  cert_number := 'CERT-' || year_suffix || '-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  RETURN cert_number;
END;
$$;

-- Generate verification code
CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
END;
$$;

-- Generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- ============================================================================
-- SECTION 3: CORE TABLES
-- Note: Tables are ordered by dependencies
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  contact_email TEXT,
  status TEXT DEFAULT 'active',
  industry TEXT,
  size TEXT,
  country TEXT,
  website TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  pricing_model TEXT DEFAULT 'fixed',
  price_per_interview_cents INTEGER DEFAULT 0,
  price_per_invitation_cents INTEGER DEFAULT 0,
  price_per_completion_cents INTEGER DEFAULT 0,
  pricing_notes TEXT,
  assessment_limit INTEGER,
  assessment_count INTEGER DEFAULT 0,
  can_create_assessments BOOLEAN DEFAULT true
);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  is_active BOOLEAN DEFAULT true,
  location TEXT,
  timezone TEXT,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(user_id, role)
);

-- Organization members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  invited_by UUID,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly',
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  max_interviews INTEGER,
  max_users INTEGER,
  max_organizations INTEGER,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  pricing_model TEXT DEFAULT 'fixed',
  price_per_interview_cents INTEGER DEFAULT 0,
  price_per_invitation_cents INTEGER DEFAULT 0,
  price_per_completion_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization subscriptions table
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interviews table
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  title TEXT NOT NULL,
  job_description TEXT,
  role_name TEXT,
  experience_level TEXT,
  question_count INTEGER DEFAULT 10,
  time_limit INTEGER DEFAULT 60,
  status TEXT DEFAULT 'draft',
  generation_status TEXT DEFAULT 'pending',
  generation_error TEXT,
  share_link TEXT UNIQUE,
  slug TEXT,
  proctoring_enabled BOOLEAN DEFAULT false,
  proctoring_settings JSONB DEFAULT '{}'::jsonb,
  topics JSONB DEFAULT '[]'::jsonb,
  difficulty_distribution JSONB DEFAULT '{"easy": 30, "medium": 50, "hard": 20}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  passing_score INTEGER DEFAULT 70,
  is_template BOOLEAN DEFAULT false,
  template_name TEXT,
  template_description TEXT
);

-- Interview invitations table
CREATE TABLE IF NOT EXISTS public.interview_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  share_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  accessed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interview attempts table
CREATE TABLE IF NOT EXISTS public.interview_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.interview_invitations(id),
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  session_token TEXT UNIQUE,
  answers JSONB DEFAULT '{}'::jsonb,
  time_taken INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT DEFAULT 'medium',
  question_type TEXT DEFAULT 'mcq',
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  order_index INTEGER DEFAULT 0,
  points INTEGER DEFAULT 1,
  time_limit INTEGER,
  code_template TEXT,
  test_cases JSONB,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Attempt questions junction table
CREATE TABLE IF NOT EXISTS public.attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assessments table
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID UNIQUE NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  overall_score INTEGER NOT NULL,
  hiring_decision TEXT NOT NULL,
  strengths TEXT[],
  weaknesses TEXT[],
  topic_scores JSONB,
  detailed_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Candidate performance index table
CREATE TABLE IF NOT EXISTS public.candidate_performance_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID UNIQUE NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  technical_score NUMERIC DEFAULT 0,
  problem_solving_score NUMERIC DEFAULT 0,
  integrity_score NUMERIC DEFAULT 100,
  overall_cpi NUMERIC DEFAULT 0,
  hiring_recommendation TEXT NOT NULL,
  top_skills TEXT[],
  weak_skills TEXT[],
  topic_scores JSONB,
  violations_detected INTEGER DEFAULT 0,
  easy_correct INTEGER,
  easy_total INTEGER,
  medium_correct INTEGER,
  medium_total INTEGER,
  hard_correct INTEGER,
  hard_total INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Proctoring sessions table
CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES public.interviews(id),
  candidate_email TEXT,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  video_recording_url TEXT,
  screen_recording_url TEXT,
  face_match_score NUMERIC,
  integrity_score NUMERIC DEFAULT 100,
  violation_count INTEGER DEFAULT 0,
  session_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Proctoring violations table
CREATE TABLE IF NOT EXISTS public.proctoring_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  timestamp TIMESTAMPTZ DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb,
  screenshot_url TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Proctoring settings table
CREATE TABLE IF NOT EXISTS public.proctoring_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  enable_face_detection BOOLEAN DEFAULT true,
  enable_audio_monitoring BOOLEAN DEFAULT true,
  enable_screen_recording BOOLEAN DEFAULT true,
  enable_browser_lockdown BOOLEAN DEFAULT false,
  violation_threshold INTEGER DEFAULT 5,
  auto_terminate_on_violations BOOLEAN DEFAULT false,
  require_id_verification BOOLEAN DEFAULT false,
  allow_breaks BOOLEAN DEFAULT false,
  break_duration_minutes INTEGER DEFAULT 5,
  max_breaks INTEGER DEFAULT 1,
  custom_rules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  template_name TEXT,
  status TEXT DEFAULT 'pending',
  provider TEXT,
  provider_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.organization_subscriptions(id),
  invoice_number TEXT UNIQUE NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  line_items JSONB DEFAULT '[]'::jsonb,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  pdf_url TEXT,
  applied_promotion_id UUID,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_id UUID,
  entity_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  cost_cents INTEGER DEFAULT 0,
  billed BOOLEAN DEFAULT false,
  billed_at TIMESTAMPTZ,
  invoice_id UUID REFERENCES public.invoices(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner applications table
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id UUID NOT NULL REFERENCES auth.users(id),
  organization_name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  industry TEXT,
  company_size TEXT,
  expected_usage TEXT,
  use_case TEXT,
  selected_plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Custom roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User custom roles table
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, custom_role_id, organization_id)
);

-- Password setup invitations table
CREATE TABLE IF NOT EXISTS public.password_setup_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  role app_role NOT NULL DEFAULT 'guest',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI providers table
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  description TEXT,
  supported_models JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI feature configurations table
CREATE TABLE IF NOT EXISTS public.ai_feature_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  primary_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_enabled BOOLEAN DEFAULT true,
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 60,
  is_enabled BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI feature health table
CREATE TABLE IF NOT EXISTS public.ai_feature_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  current_model TEXT DEFAULT 'gpt-4o-mini',
  fallback_model TEXT,
  status TEXT DEFAULT 'healthy',
  is_enabled BOOLEAN DEFAULT true,
  fallback_enabled BOOLEAN DEFAULT true,
  auto_retry_enabled BOOLEAN DEFAULT true,
  max_retry_attempts INTEGER DEFAULT 3,
  consecutive_failures INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  average_latency_ms INTEGER,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  last_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI model configurations table
CREATE TABLE IF NOT EXISTS public.ai_model_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT UNIQUE NOT NULL,
  edge_function TEXT NOT NULL,
  primary_model TEXT NOT NULL,
  fallback_model TEXT,
  enabled BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  retry_delay_ms INTEGER DEFAULT 1000,
  is_ab_testing BOOLEAN DEFAULT false,
  ab_test_model TEXT,
  ab_test_split_percentage INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Certification topics table
CREATE TABLE IF NOT EXISTS public.certification_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT DEFAULT 'platform',
  description TEXT,
  difficulty_level TEXT NOT NULL,
  required_questions INTEGER DEFAULT 50,
  passing_score INTEGER DEFAULT 70,
  certificate_validity_days INTEGER DEFAULT 365,
  is_active BOOLEAN DEFAULT true,
  recommended_experience TEXT,
  syllabus_topics JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Certification assessments table
CREATE TABLE IF NOT EXISTS public.certification_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_topic_id UUID REFERENCES public.certification_topics(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  time_limit INTEGER NOT NULL,
  passing_score INTEGER NOT NULL,
  min_integrity_score INTEGER DEFAULT 80,
  proctoring_settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Certification attempts table
CREATE TABLE IF NOT EXISTS public.certification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_assessment_id UUID REFERENCES public.certification_assessments(id) ON DELETE CASCADE,
  proctoring_session_id UUID REFERENCES public.proctoring_sessions(id),
  status TEXT DEFAULT 'in_progress',
  score INTEGER,
  integrity_score INTEGER,
  passed BOOLEAN,
  time_taken INTEGER,
  answers JSONB,
  generated_questions JSONB,
  violation_summary JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id UUID UNIQUE NOT NULL REFERENCES public.learning_assessment_attempts(id),
  certification_topic_id UUID NOT NULL REFERENCES public.certification_topics(id),
  score INTEGER NOT NULL,
  integrity_score INTEGER NOT NULL,
  certificate_number TEXT UNIQUE NOT NULL,
  verification_code TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Learning assessments table
CREATE TABLE IF NOT EXISTS public.learning_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL,
  difficulty TEXT DEFAULT 'intermediate',
  question_count INTEGER DEFAULT 20,
  time_limit INTEGER DEFAULT 30,
  passing_score INTEGER DEFAULT 70,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Learning assessment questions table
CREATE TABLE IF NOT EXISTS public.learning_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'mcq',
  topic TEXT,
  difficulty TEXT DEFAULT 'medium',
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  hints TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Learning assessment attempts table
CREATE TABLE IF NOT EXISTS public.learning_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'in_progress',
  score INTEGER,
  passed BOOLEAN,
  time_taken INTEGER,
  answers JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Learning subscriptions table
CREATE TABLE IF NOT EXISTS public.learning_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  is_unlimited BOOLEAN DEFAULT false,
  amount_spent_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity feed table
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 4: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feature_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feature_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_performance_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_setup_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 5: STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('certificates', 'certificates', true, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('consent-documents', 'consent-documents', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('documentation', 'documentation', false, 10485760, ARRAY['application/pdf']),
  ('proctoring-recordings', 'proctoring-recordings', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 6: KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_interviews_org ON public.interviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_interviews_creator ON public.interviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON public.interviews(status);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_interview ON public.interview_attempts(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_email ON public.interview_attempts(candidate_email);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_status ON public.interview_attempts(status);
CREATE INDEX IF NOT EXISTS idx_interview_invitations_interview ON public.interview_invitations(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_invitations_email ON public.interview_invitations(candidate_email);
CREATE INDEX IF NOT EXISTS idx_questions_interview ON public.questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt ON public.proctoring_sessions(interview_attempt_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ============================================================================
-- SECTION 7: ESSENTIAL RLS POLICIES
-- ============================================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Platform admins can view all profiles" ON public.profiles;
CREATE POLICY "Platform admins can view all profiles" ON public.profiles FOR SELECT 
USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- User roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Platform admins can manage all roles" ON public.user_roles;
CREATE POLICY "Platform admins can manage all roles" ON public.user_roles FOR ALL 
USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- Organizations policies
DROP POLICY IF EXISTS "Org members can view their organizations" ON public.organizations;
CREATE POLICY "Org members can view their organizations" ON public.organizations FOR SELECT 
USING (
  id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()) OR
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
);

-- Interviews policies
DROP POLICY IF EXISTS "Creators and org members can view interviews" ON public.interviews;
CREATE POLICY "Creators and org members can view interviews" ON public.interviews FOR SELECT 
USING (
  creator_id = auth.uid() OR
  can_access_org_data(auth.uid(), organization_id) OR
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
);

DROP POLICY IF EXISTS "Creators can manage their interviews" ON public.interviews;
CREATE POLICY "Creators can manage their interviews" ON public.interviews FOR ALL 
USING (
  creator_id = auth.uid() OR
  user_is_org_admin(auth.uid(), organization_id) OR
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
);

-- Interview attempts policies
DROP POLICY IF EXISTS "Authorized users can view attempts" ON public.interview_attempts;
CREATE POLICY "Authorized users can view attempts" ON public.interview_attempts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.interviews i 
    WHERE i.id = interview_id AND (
      i.creator_id = auth.uid() OR
      can_access_org_data(auth.uid(), i.organization_id)
    )
  ) OR
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
);

DROP POLICY IF EXISTS "Anyone can insert attempts" ON public.interview_attempts;
CREATE POLICY "Anyone can insert attempts" ON public.interview_attempts FOR INSERT WITH CHECK (true);

-- Subscription plans policies
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins can manage plans" ON public.subscription_plans;
CREATE POLICY "Platform admins can manage plans" ON public.subscription_plans FOR ALL 
USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Audit logs policies
DROP POLICY IF EXISTS "Platform admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Platform admins can view audit logs" ON public.audit_logs FOR SELECT 
USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ============================================================================
-- SECTION 8: TRIGGERS
-- ============================================================================

-- Set organization slug trigger
CREATE OR REPLACE FUNCTION public.set_organization_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organization_slug_trigger ON public.organizations;
CREATE TRIGGER set_organization_slug_trigger
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_slug();

-- Set interview slug trigger
CREATE OR REPLACE FUNCTION public.set_interview_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_interview_slug_trigger ON public.interviews;
CREATE TRIGGER set_interview_slug_trigger
  BEFORE INSERT ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_interview_slug();

-- ============================================================================
-- DONE! Verify the import by running:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- ============================================================================
