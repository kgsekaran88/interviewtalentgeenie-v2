-- SUMMARY: 19 tables need 113 new columns

-- ============================================
-- Schema alignment: Cloud -> Local
-- Auto-generated from OpenAPI spec comparison
-- ============================================
BEGIN;

-- === assessments === (1 missing columns)
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS question_scores jsonb;

-- === email_templates === (4 missing columns)
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS available_variables text[] DEFAULT '{}';
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS updated_by uuid;

-- WARNING: Table 'email_verification_tokens' exists in Cloud but not locally!
-- === interview_attempts === (2 missing columns)
ALTER TABLE public.interview_attempts ADD COLUMN IF NOT EXISTS deadline_at timestamptz;
ALTER TABLE public.interview_attempts ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- === interview_invitations === (15 missing columns)
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS candidate_phone text;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS candidate_timezone text;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS max_reminders_reached boolean DEFAULT false;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS resume_url text;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS sent_by uuid;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS share_token text;
ALTER TABLE public.interview_invitations ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- === interview_operation_logs === (10 missing columns)
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS attempt_id uuid;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS candidate_email text;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS error_details text;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS invitation_id uuid;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.interview_operation_logs ADD COLUMN IF NOT EXISTS user_id uuid;

-- === interview_templates === (9 missing columns)
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS avg_rating numeric;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS difficulty_distribution jsonb;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS question_distribution jsonb;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS recommended_time_limit integer DEFAULT 0;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS role_type text;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS seniority_level text;
ALTER TABLE public.interview_templates ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- === interviews === (7 missing columns)
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS coding_topic_distribution jsonb;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS experience_level text;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS extracted_skills text[] DEFAULT '{}';
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS last_reviewed_by uuid;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS min_years_experience integer DEFAULT 0;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS review_feedback text;

-- === learning_plans === (8 missing columns)
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS billing_period text;
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS features jsonb;
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS max_ai_usage integer DEFAULT 0;
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS max_assessments integer DEFAULT 0;
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS max_certifications integer DEFAULT 0;
ALTER TABLE public.learning_plans ADD COLUMN IF NOT EXISTS price numeric;

-- === onboarding_progress === (4 missing columns)
ALTER TABLE public.onboarding_progress ADD COLUMN IF NOT EXISTS created_interview boolean DEFAULT false;
ALTER TABLE public.onboarding_progress ADD COLUMN IF NOT EXISTS shared_interview boolean DEFAULT false;
ALTER TABLE public.onboarding_progress ADD COLUMN IF NOT EXISTS viewed_dashboard boolean DEFAULT false;
ALTER TABLE public.onboarding_progress ADD COLUMN IF NOT EXISTS viewed_report boolean DEFAULT false;

-- === organizations === (6 missing columns)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS business_address text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS business_phone text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS business_registration_number text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS legal_business_name text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS year_established integer DEFAULT 0;

-- === partner_applications === (3 missing columns)
ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS organization_size text;
ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS review_notes text;

-- === password_setup_invitations === (2 missing columns)
ALTER TABLE public.password_setup_invitations ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE public.password_setup_invitations ADD COLUMN IF NOT EXISTS organization_id uuid;

-- === platform_configurations === (3 missing columns)
ALTER TABLE public.platform_configurations ADD COLUMN IF NOT EXISTS data_type text;
ALTER TABLE public.platform_configurations ADD COLUMN IF NOT EXISTS is_sensitive boolean DEFAULT false;
ALTER TABLE public.platform_configurations ADD COLUMN IF NOT EXISTS validation_rules jsonb;

-- === platform_documentation === (9 missing columns)
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS file_hashes jsonb;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS generation_prompt text;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS is_ai_generated boolean DEFAULT false;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS last_generated_at timestamptz;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS needs_regeneration boolean DEFAULT false;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS prompt_used text;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS source_files jsonb;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.platform_documentation ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 0;

-- === profiles === (1 missing columns)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- === subscription_plans === (18 missing columns)
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS annual_discount_percent integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS billing_period text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS included_interviews integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS included_invitations integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_ai_usage integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_interviews integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS minimum_monthly integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS overage_price_per_interview integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS overage_price_per_invitation integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS plan_type text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_amount integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_per_completed_interview integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_per_interview integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_per_invitation integer DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS pricing_model text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS pricing_notes text;

-- === test_suites === (2 missing columns)
ALTER TABLE public.test_suites ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.test_suites ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT false;

-- === usage_tracking === (6 missing columns)
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS active_users integer DEFAULT 0;
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS ai_tokens_used integer DEFAULT 0;
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS interviews_conducted integer DEFAULT 0;
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS period_end timestamptz;
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS period_start timestamptz;
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- === user_roles === (3 missing columns)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS assigned_by uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_by_role text;

-- === email_verification_tokens (create if not exists) ===
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    verified_at timestamptz,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

COMMIT;
