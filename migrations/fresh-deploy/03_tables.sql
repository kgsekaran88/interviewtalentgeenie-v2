-- ============================================================================
-- FRESH DEPLOYMENT: 03 - ALL TABLES
-- Matches EXACT Production Cloud schema - verified against production
-- IMPORTANT: entity_id columns are UUID (not TEXT) to avoid type mismatches
-- ============================================================================

-- ============================================================================
-- LEVEL 0: Core Tables (No Dependencies)
-- ============================================================================

-- profiles (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- organizations (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
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
  slug TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER NOT NULL,
  price_yearly_cents INTEGER,
  features JSONB DEFAULT '{}'::jsonb,
  max_interviews_per_month INTEGER,
  max_users INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- certification_topics
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

-- certificate_badges
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

-- ai_providers
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

-- email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  organization_id UUID,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- chatbot_knowledge
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

-- platform_configurations
CREATE TABLE IF NOT EXISTS public.platform_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.platform_configurations ENABLE ROW LEVEL SECURITY;

-- role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_name TEXT NOT NULL UNIQUE,
  description TEXT,
  allowed_roles public.app_role[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- system_config
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- test_suites
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

-- activity_feed
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- LEVEL 1: Tables with Organization Dependencies
-- ============================================================================

-- organization_members (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID,
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- organization_subscriptions
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

-- partner_applications
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

-- interviews (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  job_description TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 10,
  difficulty_distribution JSONB DEFAULT '{"easy": 30, "hard": 20, "medium": 50}'::jsonb,
  topic_distribution JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft',
  share_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  time_limit INTEGER,
  proctoring_enabled BOOLEAN DEFAULT false,
  proctoring_settings JSONB DEFAULT '{"require_camera": true, "detect_tab_switches": true, "minimum_light_level": 0.3, "require_screen_share": true, "detect_multiple_voices": true, "detect_multiple_persons": true, "detect_multiple_monitors": true}'::jsonb,
  question_bank_size INTEGER,
  coding_schema JSONB,
  generation_status TEXT DEFAULT 'pending',
  generation_error TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  proctoring_settings_id UUID,
  skill_domain TEXT,
  slug TEXT,
  questions_status TEXT DEFAULT 'draft',
  tech_spoc_reviewer_id UUID,
  review_requested_at TIMESTAMPTZ,
  questions_approved_at TIMESTAMPTZ,
  review_notes TEXT,
  category_difficulty_distribution JSONB,
  question_type_distribution JSONB,
  required_question_rules JSONB DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- interview_templates
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

-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.organization_subscriptions(id),
  invoice_number TEXT UNIQUE,
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

-- promotions
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

-- training_plans
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

-- learning_subscriptions
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

-- certification_assessments
CREATE TABLE IF NOT EXISTS public.certification_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_topic_id UUID REFERENCES public.certification_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL,
  time_limit INTEGER NOT NULL,
  min_integrity_score INTEGER DEFAULT 70,
  proctoring_settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'published',
  published_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.certification_assessments ENABLE ROW LEVEL SECURITY;

-- learning_plans
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

-- ai_feature_configurations
CREATE TABLE IF NOT EXISTS public.ai_feature_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  primary_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_enabled BOOLEAN DEFAULT true,
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 60,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_feature_configurations ENABLE ROW LEVEL SECURITY;

-- custom_roles
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

-- payment_methods
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

-- ats_integrations
CREATE TABLE IF NOT EXISTS public.ats_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ats_provider TEXT NOT NULL,
  api_key_encrypted TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'inactive',
  sync_enabled BOOLEAN DEFAULT false,
  sync_frequency INTEGER DEFAULT 3600,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ats_integrations ENABLE ROW LEVEL SECURITY;

-- analytics_snapshots
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_interviews INTEGER DEFAULT 0,
  total_candidates INTEGER DEFAULT 0,
  avg_cpi_score NUMERIC,
  hiring_rate NUMERIC,
  avg_time_to_hire INTEGER,
  top_performing_roles TEXT[],
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- data_retention_policies
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

-- payment_gateways
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
-- LEVEL 2: Tables with Interview Dependencies
-- ============================================================================

-- questions (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  correct_answer TEXT,
  options JSONB,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_in_attempts JSONB DEFAULT '[]'::jsonb,
  question_type TEXT DEFAULT 'descriptive',
  coding_schema JSONB,
  allowed_languages TEXT[],
  selection_count INTEGER DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  organization_id UUID REFERENCES public.organizations(id)
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- interview_invitations
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

-- interview_attempts (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.interview_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_taken INTEGER,
  status TEXT DEFAULT 'in_progress',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  session_token TEXT,
  invitation_id UUID REFERENCES public.interview_invitations(id)
);
ALTER TABLE public.interview_attempts ENABLE ROW LEVEL SECURITY;

-- interview_panel_members
CREATE TABLE IF NOT EXISTS public.interview_panel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID NOT NULL,
  role TEXT DEFAULT 'evaluator',
  added_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.interview_panel_members ENABLE ROW LEVEL SECURITY;

-- interview_schedules
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

-- interview_operation_logs
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

-- training_topics
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

-- learning_assessments
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
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;

-- promotion_applicable_plans
CREATE TABLE IF NOT EXISTS public.promotion_applicable_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promotion_id, plan_id)
);
ALTER TABLE public.promotion_applicable_plans ENABLE ROW LEVEL SECURITY;

-- promotion_applicable_orgs
CREATE TABLE IF NOT EXISTS public.promotion_applicable_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promotion_id, organization_id)
);
ALTER TABLE public.promotion_applicable_orgs ENABLE ROW LEVEL SECURITY;

-- payment_transactions
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

-- ats_candidates
CREATE TABLE IF NOT EXISTS public.ats_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ats_integrations(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  attempt_id UUID,
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
  skills JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  source TEXT,
  ats_status TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ats_candidates ENABLE ROW LEVEL SECURITY;

-- ats_sync_logs
CREATE TABLE IF NOT EXISTS public.ats_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ats_integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  candidates_synced INTEGER DEFAULT 0,
  candidates_failed INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.ats_sync_logs ENABLE ROW LEVEL SECURITY;

-- ai_provider_credentials
CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  model_preference TEXT,
  rate_limit_per_minute INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  test_status TEXT,
  test_error TEXT,
  last_tested_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;

-- user_custom_roles
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

-- user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.certificate_badges(id) ON DELETE CASCADE,
  certificate_ids UUID[],
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- user_training_assignments
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

-- promotion_usages
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

-- test_runs
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
-- LEVEL 3: Tables with Interview Attempt Dependencies
-- ============================================================================

-- proctoring_sessions (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  learning_attempt_id UUID,
  video_recording_url TEXT,
  screen_recording_url TEXT,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  camera_check_passed BOOLEAN DEFAULT false,
  microphone_check_passed BOOLEAN DEFAULT false,
  screen_share_check_passed BOOLEAN DEFAULT false,
  lighting_check_passed BOOLEAN DEFAULT false,
  violations JSONB DEFAULT '[]'::jsonb,
  multiple_person_detections INTEGER DEFAULT 0,
  multiple_voice_detections INTEGER DEFAULT 0,
  tab_switch_count INTEGER DEFAULT 0,
  look_away_count INTEGER DEFAULT 0,
  copy_attempt_count INTEGER DEFAULT 0,
  integrity_score NUMERIC,
  flagged_for_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  review_status TEXT DEFAULT 'pending',
  eye_movement_violations JSONB DEFAULT '[]'::jsonb,
  detailed_violations JSONB DEFAULT '[]'::jsonb,
  certification_attempt_id UUID,
  audio_transcription TEXT,
  periodic_screenshots TEXT[] DEFAULT '{}'::text[],
  facial_analysis_results JSONB DEFAULT '{}'::jsonb,
  upload_status TEXT DEFAULT 'pending',
  upload_error TEXT,
  upload_started_at TIMESTAMPTZ,
  upload_completed_at TIMESTAMPTZ,
  periodic_screenshot_timestamps INTEGER[] DEFAULT '{}'::integer[],
  ignored_violations JSONB DEFAULT '[]'::jsonb,
  screen_periodic_screenshots TEXT[] DEFAULT '{}'::text[],
  screen_periodic_screenshot_timestamps INTEGER[] DEFAULT '{}'::integer[],
  organization_id UUID REFERENCES public.organizations(id)
);
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;

-- assessments
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  overall_score INTEGER NOT NULL,
  hiring_decision TEXT NOT NULL,
  strengths TEXT[],
  weaknesses TEXT[],
  topic_scores JSONB DEFAULT '{}'::jsonb,
  detailed_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- candidate_performance_index
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
  hiring_recommendation TEXT NOT NULL,
  top_skills TEXT[] DEFAULT ARRAY[]::text[],
  weak_skills TEXT[] DEFAULT ARRAY[]::text[],
  topic_scores JSONB DEFAULT '{}'::jsonb,
  easy_correct INTEGER DEFAULT 0,
  easy_total INTEGER DEFAULT 0,
  medium_correct INTEGER DEFAULT 0,
  medium_total INTEGER DEFAULT 0,
  hard_correct INTEGER DEFAULT 0,
  hard_total INTEGER DEFAULT 0,
  violations_detected INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.candidate_performance_index ENABLE ROW LEVEL SECURITY;

-- attempt_questions
CREATE TABLE IF NOT EXISTS public.attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.attempt_questions ENABLE ROW LEVEL SECURITY;

-- panel_evaluations
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

-- panel_consensus
CREATE TABLE IF NOT EXISTS public.panel_consensus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  final_decision TEXT NOT NULL,
  consensus_score INTEGER NOT NULL,
  discussion_summary TEXT,
  dissenting_opinions TEXT[],
  decided_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.panel_consensus ENABLE ROW LEVEL SECURITY;

-- bias_detection_results
CREATE TABLE IF NOT EXISTS public.bias_detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  analysis_model TEXT NOT NULL,
  bias_score NUMERIC DEFAULT 0,
  bias_indicators JSONB DEFAULT '[]'::jsonb,
  language_bias JSONB,
  cultural_bias JSONB,
  technical_bias JSONB,
  recommendations TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.bias_detection_results ENABLE ROW LEVEL SECURITY;

-- resume_parsing_results
CREATE TABLE IF NOT EXISTS public.resume_parsing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  ats_candidate_id UUID REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  original_file_url TEXT NOT NULL,
  parsed_data JSONB NOT NULL,
  skills_extracted TEXT[],
  experience_summary TEXT,
  education_summary TEXT,
  parsing_model TEXT,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.resume_parsing_results ENABLE ROW LEVEL SECURITY;

-- ai_coach_sessions
CREATE TABLE IF NOT EXISTS public.ai_coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT NOT NULL,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  hints_provided JSONB DEFAULT '[]'::jsonb,
  questions_asked INTEGER DEFAULT 0,
  hints_used INTEGER DEFAULT 0,
  total_interaction_time INTEGER,
  improvement_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_coach_sessions ENABLE ROW LEVEL SECURITY;

-- learning_materials
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

-- user_topic_progress
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

-- learning_assessment_questions
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

-- certification_attempts
CREATE TABLE IF NOT EXISTS public.certification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  certification_assessment_id UUID REFERENCES public.certification_assessments(id) ON DELETE CASCADE,
  proctoring_session_id UUID,
  generated_questions JSONB DEFAULT '[]'::jsonb,
  answers JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'in_progress',
  score INTEGER,
  integrity_score INTEGER,
  passed BOOLEAN DEFAULT false,
  time_taken INTEGER,
  violation_summary JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;

-- test_results
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
-- LEVEL 4: Tables with Proctoring Session Dependencies
-- ============================================================================

-- proctoring_violations
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

-- learning_assessment_attempts (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.learning_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_taken INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress',
  score INTEGER,
  passed BOOLEAN,
  integrity_score INTEGER DEFAULT 100,
  proctoring_session_id UUID,
  subscription_id UUID REFERENCES public.learning_subscriptions(id),
  feedback JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.learning_assessment_attempts ENABLE ROW LEVEL SECURITY;

-- certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  certification_topic_id UUID NOT NULL REFERENCES public.certification_topics(id),
  attempt_id UUID NOT NULL UNIQUE,
  certificate_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
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

-- learning_assessment_usage
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

-- learning_assessment_feedback
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

-- learning_payments
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
-- STANDALONE TABLES (No complex dependencies)
-- ============================================================================

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- notifications (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- email_logs (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  message_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  organization_id UUID,
  user_id UUID,
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_resend_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT DEFAULT 'resend'
);
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- consent_records
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_text TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- data_deletion_requests (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT NOT NULL,
  candidate_name TEXT,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  data_export_url TEXT,
  notes TEXT
);
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- security_events (matches Production Cloud - resource_id is UUID)
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- onboarding_progress
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

-- password_setup_invitations
CREATE TABLE IF NOT EXISTS public.password_setup_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  user_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.password_setup_invitations ENABLE ROW LEVEL SECURITY;

-- preinterview_check_logs
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

-- proctoring_settings
CREATE TABLE IF NOT EXISTS public.proctoring_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.proctoring_settings ENABLE ROW LEVEL SECURITY;

-- architecture_documents
CREATE TABLE IF NOT EXISTS public.architecture_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  diagram_type TEXT NOT NULL,
  mermaid_code TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  analyzed_files TEXT[] DEFAULT '{}'::text[],
  file_hashes JSONB DEFAULT '{}'::jsonb,
  last_generated_at TIMESTAMPTZ DEFAULT now(),
  needs_refresh BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.architecture_documents ENABLE ROW LEVEL SECURITY;

-- approval_workflows (entity_id is UUID)
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  workflow_stage TEXT NOT NULL,
  approval_chain JSONB NOT NULL,
  current_approver UUID,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  deadline TIMESTAMPTZ,
  comments TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

-- collaboration_threads (entity_id is UUID, matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.collaboration_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES public.collaboration_threads(id),
  author_id UUID,
  content TEXT NOT NULL,
  mentions TEXT[],
  is_resolved BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.collaboration_threads ENABLE ROW LEVEL SECURITY;

-- comparative_analytics
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

-- documentation
CREATE TABLE IF NOT EXISTS public.documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  version TEXT DEFAULT '1.0',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;

-- failed_jobs (matches Production Cloud exactly)
CREATE TABLE IF NOT EXISTS public.failed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  job_id TEXT,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'failed',
  next_retry_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID,
  user_id UUID,
  source_function TEXT,
  correlation_id TEXT
);
ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;

-- generated_reports
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

-- idempotency_keys
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

-- platform_documentation
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

-- platform_documentation_versions
CREATE TABLE IF NOT EXISTS public.platform_documentation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES public.platform_documentation(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.platform_documentation_versions ENABLE ROW LEVEL SECURITY;

-- predictive_analytics
CREATE TABLE IF NOT EXISTS public.predictive_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  predictions JSONB NOT NULL,
  confidence_score NUMERIC,
  factors JSONB,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.predictive_analytics ENABLE ROW LEVEL SECURITY;

-- rate_limit_buckets
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL UNIQUE,
  tokens INTEGER NOT NULL,
  last_refill TIMESTAMPTZ DEFAULT now(),
  max_tokens INTEGER NOT NULL,
  refill_rate INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- circuit_breaker_state
CREATE TABLE IF NOT EXISTS public.circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  state TEXT DEFAULT 'closed',
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  half_open_at TIMESTAMPTZ,
  failure_threshold INTEGER DEFAULT 5,
  success_threshold INTEGER DEFAULT 2,
  timeout_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.circuit_breaker_state ENABLE ROW LEVEL SECURITY;

-- report_templates
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  template_config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- usage_tracking
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- ai_feature_alerts
CREATE TABLE IF NOT EXISTS public.ai_feature_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  notified_admins UUID[] DEFAULT ARRAY[]::uuid[],
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_feature_alerts ENABLE ROW LEVEL SECURITY;

-- ai_feature_health
CREATE TABLE IF NOT EXISTS public.ai_feature_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  current_model TEXT DEFAULT 'google/gemini-2.5-flash',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  fallback_enabled BOOLEAN DEFAULT false,
  max_retry_attempts INTEGER DEFAULT 3,
  auto_retry_enabled BOOLEAN DEFAULT true,
  is_enabled BOOLEAN DEFAULT true,
  average_latency_ms INTEGER,
  failed_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unknown',
  last_error_message TEXT,
  fallback_model TEXT,
  last_error_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_feature_health ENABLE ROW LEVEL SECURITY;

-- ai_health_alerts
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

-- ai_health_checks
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

-- ai_health_monitoring
CREATE TABLE IF NOT EXISTS public.ai_health_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  status TEXT NOT NULL,
  checked_at TIMESTAMPTZ DEFAULT now(),
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_health_monitoring ENABLE ROW LEVEL SECURITY;

-- ai_model_configurations
CREATE TABLE IF NOT EXISTS public.ai_model_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE,
  edge_function TEXT NOT NULL,
  primary_model TEXT NOT NULL,
  fallback_model TEXT,
  ab_test_model TEXT,
  ab_test_split_percentage INTEGER DEFAULT 50,
  is_ab_testing BOOLEAN DEFAULT false,
  max_retries INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 1000,
  timeout_ms INTEGER DEFAULT 30000,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_model_configurations ENABLE ROW LEVEL SECURITY;

-- ai_model_performance
CREATE TABLE IF NOT EXISTS public.ai_model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  test_period_start TIMESTAMPTZ NOT NULL,
  test_period_end TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  average_latency_ms INTEGER,
  average_quality_score NUMERIC,
  cost_per_request_cents NUMERIC,
  is_active_test BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_model_performance ENABLE ROW LEVEL SECURITY;

-- ai_usage_logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id),
  interview_id UUID REFERENCES public.interviews(id),
  provider_id UUID REFERENCES public.ai_providers(id),
  model_used TEXT,
  request_tokens INTEGER,
  response_tokens INTEGER,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT false,
  total_cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- certification_global_config
CREATE TABLE IF NOT EXISTS public.certification_global_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.certification_global_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Add Missing Columns and Foreign Key References (deferred to avoid circular dependencies)
-- ============================================================================

-- Ensure certification_attempt_id column exists on proctoring_sessions before adding FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'proctoring_sessions' 
    AND column_name = 'certification_attempt_id'
  ) THEN
    ALTER TABLE public.proctoring_sessions ADD COLUMN certification_attempt_id UUID;
  END IF;
END $$;

-- Ensure learning_attempt_id column exists on proctoring_sessions before adding FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'proctoring_sessions' 
    AND column_name = 'learning_attempt_id'
  ) THEN
    ALTER TABLE public.proctoring_sessions ADD COLUMN learning_attempt_id UUID;
  END IF;
END $$;

-- Ensure proctoring_session_id column exists on certification_attempts before adding FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'certification_attempts' 
    AND column_name = 'proctoring_session_id'
  ) THEN
    ALTER TABLE public.certification_attempts ADD COLUMN proctoring_session_id UUID;
  END IF;
END $$;

-- Ensure proctoring_session_id column exists on learning_assessment_attempts before adding FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'learning_assessment_attempts' 
    AND column_name = 'proctoring_session_id'
  ) THEN
    ALTER TABLE public.learning_assessment_attempts ADD COLUMN proctoring_session_id UUID;
  END IF;
END $$;

-- Add FK for proctoring_sessions -> certification_attempts after both tables and columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'proctoring_sessions_certification_attempt_id_fkey'
  ) THEN
    ALTER TABLE public.proctoring_sessions 
    ADD CONSTRAINT proctoring_sessions_certification_attempt_id_fkey 
    FOREIGN KEY (certification_attempt_id) REFERENCES public.certification_attempts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK for proctoring_sessions -> learning_assessment_attempts after both tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'proctoring_sessions_learning_attempt_id_fkey'
  ) THEN
    ALTER TABLE public.proctoring_sessions 
    ADD CONSTRAINT proctoring_sessions_learning_attempt_id_fkey 
    FOREIGN KEY (learning_attempt_id) REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK for certification_attempts -> proctoring_sessions after both tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'certification_attempts_proctoring_session_id_fkey'
  ) THEN
    ALTER TABLE public.certification_attempts 
    ADD CONSTRAINT certification_attempts_proctoring_session_id_fkey 
    FOREIGN KEY (proctoring_session_id) REFERENCES public.proctoring_sessions(id);
  END IF;
END $$;

-- Add FK for learning_assessment_attempts -> proctoring_sessions after both tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'learning_assessment_attempts_proctoring_session_id_fkey'
  ) THEN
    ALTER TABLE public.learning_assessment_attempts 
    ADD CONSTRAINT learning_assessment_attempts_proctoring_session_id_fkey 
    FOREIGN KEY (proctoring_session_id) REFERENCES public.proctoring_sessions(id);
  END IF;
END $$;
