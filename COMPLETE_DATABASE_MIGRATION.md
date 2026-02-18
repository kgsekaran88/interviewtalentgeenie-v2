# Complete Database Migration Scripts for TalentGeenie Platform

This document contains ALL SQL scripts needed to recreate the entire database schema in a new Supabase project.

**Run these scripts in ORDER in your Supabase SQL Editor.**

---

## Table of Contents
1. [Prerequisites & Extensions](#1-prerequisites--extensions)
2. [Enums](#2-enums)
3. [Core Tables](#3-core-tables)
4. [Security Functions](#4-security-functions)
5. [RLS Policies](#5-rls-policies)
6. [Application Functions](#6-application-functions)
7. [Triggers](#7-triggers)
8. [Storage Buckets](#8-storage-buckets)
9. [Seed Data](#9-seed-data)
10. [Verification](#10-verification)

---

## 1. Prerequisites & Extensions

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## 2. Enums

```sql
-- Create app_role enum for role-based access control
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
```

---

## 3. Core Tables

### 3.1 Profiles Table

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### 3.2 User Roles Table (CRITICAL - Separate from profiles for security)

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
```

### 3.3 Organizations Table

```sql
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  website TEXT,
  industry TEXT,
  size TEXT,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Pricing columns for usage-based billing
  pricing_model TEXT DEFAULT 'subscription',
  price_per_interview_cents INTEGER DEFAULT 0,
  price_per_invitation_cents INTEGER DEFAULT 0,
  price_per_completed_cents INTEGER DEFAULT 500,
  pricing_notes TEXT,
  pricing_tier_id UUID
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_organizations_slug ON public.organizations(slug);
```

### 3.4 Organization Members Table

```sql
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
```

### 3.5 Interviews Table

```sql
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  job_title TEXT,
  job_description TEXT,
  status TEXT DEFAULT 'draft',
  question_count INTEGER DEFAULT 10,
  time_limit INTEGER DEFAULT 30,
  share_link TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  skills TEXT[],
  difficulty_distribution JSONB DEFAULT '{"easy": 30, "medium": 50, "hard": 20}',
  question_type_distribution JSONB DEFAULT '{"mcq": 40, "short_answer": 30, "code": 30}',
  proctoring_enabled BOOLEAN DEFAULT false,
  proctoring_settings JSONB DEFAULT '{}',
  max_tab_switches INTEGER DEFAULT 3,
  max_look_aways INTEGER DEFAULT 5,
  min_integrity_score INTEGER DEFAULT 70,
  allow_multiple_persons BOOLEAN DEFAULT false,
  generation_status TEXT DEFAULT 'pending',
  generation_progress INTEGER DEFAULT 0,
  generation_error TEXT,
  expires_at TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_interviews_created_by ON public.interviews(created_by);
CREATE INDEX idx_interviews_org ON public.interviews(organization_id);
CREATE INDEX idx_interviews_share_link ON public.interviews(share_link);
CREATE INDEX idx_interviews_status ON public.interviews(status);
```

### 3.6 Questions Table

```sql
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  topic TEXT,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  hints TEXT,
  code_template TEXT,
  test_cases JSONB,
  order_index INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  selection_count INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2),
  average_time_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_questions_interview ON public.questions(interview_id);
CREATE INDEX idx_questions_type ON public.questions(question_type);
CREATE INDEX idx_questions_difficulty ON public.questions(difficulty);
```

### 3.7 Interview Invitations Table

```sql
CREATE TABLE public.interview_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_email TEXT NOT NULL,
  candidate_name TEXT,
  share_token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accessed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_invitations_interview ON public.interview_invitations(interview_id);
CREATE INDEX idx_invitations_token ON public.interview_invitations(share_token);
CREATE INDEX idx_invitations_email ON public.interview_invitations(candidate_email);
```

### 3.8 Interview Attempts Table

```sql
CREATE TABLE public.interview_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.interview_invitations(id),
  candidate_email TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  session_token TEXT UNIQUE,
  answers JSONB DEFAULT '{}',
  status TEXT DEFAULT 'in_progress',
  time_taken INTEGER,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attempts_interview ON public.interview_attempts(interview_id);
CREATE INDEX idx_attempts_session ON public.interview_attempts(session_token);
CREATE INDEX idx_attempts_status ON public.interview_attempts(status);
```

### 3.9 Attempt Questions Junction Table

```sql
CREATE TABLE public.attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attempt_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attempt_questions_attempt ON public.attempt_questions(attempt_id);
```

### 3.10 Assessments Table (Interview Results)

```sql
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  overall_score NUMERIC NOT NULL,
  hiring_decision TEXT NOT NULL,
  strengths TEXT[],
  weaknesses TEXT[],
  topic_scores JSONB,
  detailed_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_assessments_attempt ON public.assessments(attempt_id);
```

### 3.11 Proctoring Sessions Table

```sql
CREATE TABLE public.proctoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  learning_attempt_id UUID,
  certification_attempt_id UUID,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  camera_check_passed BOOLEAN,
  microphone_check_passed BOOLEAN,
  lighting_check_passed BOOLEAN,
  screen_share_check_passed BOOLEAN,
  tab_switch_count INTEGER DEFAULT 0,
  look_away_count INTEGER DEFAULT 0,
  copy_attempt_count INTEGER DEFAULT 0,
  multiple_person_detections INTEGER DEFAULT 0,
  multiple_voice_detections INTEGER DEFAULT 0,
  integrity_score INTEGER DEFAULT 100,
  violations JSONB DEFAULT '[]',
  detailed_violations JSONB DEFAULT '[]',
  ignored_violations JSONB DEFAULT '[]',
  eye_movement_violations JSONB DEFAULT '[]',
  facial_analysis_results JSONB DEFAULT '{}',
  audio_transcription TEXT,
  video_recording_url TEXT,
  screen_recording_url TEXT,
  periodic_screenshots TEXT[],
  periodic_screenshot_timestamps INTEGER[],
  screen_periodic_screenshots TEXT[],
  screen_periodic_screenshot_timestamps INTEGER[],
  flagged_for_review BOOLEAN DEFAULT false,
  review_status TEXT DEFAULT 'pending',
  reviewer_notes TEXT,
  upload_status TEXT DEFAULT 'pending',
  upload_started_at TIMESTAMPTZ,
  upload_completed_at TIMESTAMPTZ,
  upload_error TEXT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_proctoring_attempt ON public.proctoring_sessions(interview_attempt_id);
CREATE INDEX idx_proctoring_review ON public.proctoring_sessions(review_status);
```

### 3.12 Notifications Table

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
```

### 3.13 Audit Logs Table

```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
```

### 3.14 Custom Roles Table

```sql
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_custom_roles_org ON public.custom_roles(organization_id);
```

### 3.15 User Custom Roles Junction Table

```sql
CREATE TABLE public.user_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_custom_roles_user ON public.user_custom_roles(user_id);
```

### 3.16 Role Permissions Table

```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_name TEXT NOT NULL,
  allowed_roles TEXT[] NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(action_name)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
```

### 3.17 Subscription Plans Table

```sql
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly',
  max_interviews INTEGER DEFAULT 10,
  max_users INTEGER DEFAULT 5,
  max_ai_usage INTEGER DEFAULT 1000,
  features JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
```

### 3.18 Organization Subscriptions Table

```sql
CREATE TABLE public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'active',
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  interviews_used INTEGER DEFAULT 0,
  ai_usage_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_org_subs_org ON public.organization_subscriptions(organization_id);
CREATE INDEX idx_org_subs_status ON public.organization_subscriptions(status);
```

### 3.19 Invoices Table

```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.organization_subscriptions(id),
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'draft',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  subtotal_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  total_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  usage_details JSONB DEFAULT '{}',
  line_items JSONB DEFAULT '[]',
  notes TEXT,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
```

### 3.20 Usage Tracking Table

```sql
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  interviews_conducted INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_usage_org ON public.usage_tracking(organization_id);
```

### 3.21 Payment Gateways Table

```sql
CREATE TABLE public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  is_test_mode BOOLEAN DEFAULT true,
  test_public_key_encrypted TEXT,
  test_secret_key_encrypted TEXT,
  live_public_key_encrypted TEXT,
  live_secret_key_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  supported_currencies TEXT[] DEFAULT ARRAY['USD'],
  config JSONB DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
```

### 3.22 Payment Methods Table

```sql
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_payment_methods_org ON public.payment_methods(organization_id);
```

### 3.23 Payment Transactions Table

```sql
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
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

CREATE INDEX idx_payment_trans_org ON public.payment_transactions(organization_id);
```

### 3.24 Certification Topics Table

```sql
CREATE TABLE public.certification_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  difficulty_level TEXT NOT NULL,
  passing_score INTEGER DEFAULT 70,
  required_questions INTEGER DEFAULT 50,
  certificate_validity_days INTEGER DEFAULT 365,
  syllabus_topics JSONB,
  provider TEXT DEFAULT 'TalentGeenie',
  recommended_experience TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certification_topics ENABLE ROW LEVEL SECURITY;
```

### 3.25 Certification Attempts Table

```sql
CREATE TABLE public.certification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_topic_id UUID NOT NULL REFERENCES public.certification_topics(id),
  status TEXT DEFAULT 'in_progress',
  score INTEGER,
  passed BOOLEAN,
  time_taken INTEGER,
  answers JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  proctoring_session_id UUID
);

ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cert_attempts_user ON public.certification_attempts(user_id);
CREATE INDEX idx_cert_attempts_topic ON public.certification_attempts(certification_topic_id);
```

### 3.26 Certification Questions Table

```sql
CREATE TABLE public.certification_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_topic_id UUID NOT NULL REFERENCES public.certification_topics(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  topic TEXT,
  subtopic TEXT,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certification_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cert_questions_topic ON public.certification_questions(certification_topic_id);
```

### 3.27 User Certificates Table

```sql
CREATE TABLE public.user_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_topic_id UUID NOT NULL REFERENCES public.certification_topics(id),
  attempt_id UUID REFERENCES public.certification_attempts(id),
  certificate_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  candidate_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  integrity_score INTEGER DEFAULT 100,
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  pdf_url TEXT,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.user_certificates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_certs_user ON public.user_certificates(user_id);
CREATE INDEX idx_user_certs_verify ON public.user_certificates(verification_code);
```

### 3.28 Learning Plans Table

```sql
CREATE TABLE public.learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly',
  max_assessments INTEGER DEFAULT 5,
  max_certifications INTEGER DEFAULT 3,
  max_ai_usage INTEGER DEFAULT 100,
  features JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;
```

### 3.29 Learning Subscriptions Table

```sql
CREATE TABLE public.learning_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.learning_plans(id),
  plan_type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  stripe_subscription_id TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_unlimited BOOLEAN DEFAULT false,
  amount_spent_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_learning_subs_user ON public.learning_subscriptions(user_id);
```

### 3.30 Learning Assessments Table

```sql
CREATE TABLE public.learning_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  topic_description TEXT NOT NULL,
  mode TEXT DEFAULT 'practice',
  question_count INTEGER DEFAULT 10,
  time_limit INTEGER,
  status TEXT DEFAULT 'draft',
  difficulty_distribution JSONB DEFAULT '{"easy": 30, "medium": 50, "hard": 20}',
  question_type_distribution JSONB DEFAULT '{"mcq": 60, "short_answer": 40}',
  training_topic_id UUID,
  certification_topic_id UUID,
  is_certification BOOLEAN DEFAULT false,
  proctoring_enabled BOOLEAN DEFAULT false,
  proctoring_settings JSONB DEFAULT '{}',
  max_tab_switches INTEGER DEFAULT 3,
  max_look_aways INTEGER DEFAULT 5,
  min_integrity_score INTEGER DEFAULT 70,
  allow_multiple_persons BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_learning_assess_user ON public.learning_assessments(user_id);
```

### 3.31 Learning Assessment Questions Table

```sql
CREATE TABLE public.learning_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  topic TEXT,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  hints TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_learning_questions_assess ON public.learning_assessment_questions(assessment_id);
```

### 3.32 Learning Assessment Attempts Table

```sql
CREATE TABLE public.learning_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  answers JSONB DEFAULT '{}',
  status TEXT DEFAULT 'in_progress',
  score INTEGER,
  time_taken INTEGER,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_learning_attempts_assess ON public.learning_assessment_attempts(assessment_id);
CREATE INDEX idx_learning_attempts_user ON public.learning_assessment_attempts(user_id);
```

### 3.33 Learning Assessment Feedback Table

```sql
CREATE TABLE public.learning_assessment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  strengths TEXT[],
  weaknesses TEXT[],
  improvement_areas TEXT[],
  topic_scores JSONB,
  difficulty_scores JSONB,
  question_feedback JSONB,
  detailed_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_learning_feedback_attempt ON public.learning_assessment_feedback(attempt_id);
```

### 3.34 Learning Assessment Usage Table

```sql
CREATE TABLE public.learning_assessment_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id),
  subscription_id UUID REFERENCES public.learning_subscriptions(id),
  usage_date DATE DEFAULT CURRENT_DATE,
  was_free BOOLEAN DEFAULT false,
  was_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assessment_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_learning_usage_user ON public.learning_assessment_usage(user_id, usage_date);
```

### 3.35 Training Plans Table

```sql
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL,
  role_description TEXT,
  difficulty_level TEXT DEFAULT 'intermediate',
  estimated_duration INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
```

### 3.36 Training Topics Table

```sql
CREATE TABLE public.training_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  subtopic TEXT,
  difficulty_level TEXT DEFAULT 'intermediate',
  estimated_duration INTEGER,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_topics ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_training_topics_plan ON public.training_topics(training_plan_id);
```

### 3.37 Learning Materials Table

```sql
CREATE TABLE public.learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_topic_id UUID NOT NULL REFERENCES public.training_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT NOT NULL,
  url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_learning_materials_topic ON public.learning_materials(training_topic_id);
```

### 3.38 User Training Assignments Table

```sql
CREATE TABLE public.user_training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'assigned',
  progress_percentage INTEGER DEFAULT 0,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_training_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_training_assignments_user ON public.user_training_assignments(user_id);
```

### 3.39 User Topic Progress Table

```sql
CREATE TABLE public.user_topic_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_topic_id UUID NOT NULL REFERENCES public.training_topics(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started',
  materials_completed INTEGER DEFAULT 0,
  total_materials INTEGER DEFAULT 0,
  assessments_completed INTEGER DEFAULT 0,
  best_score INTEGER,
  last_accessed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.user_topic_progress ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_topic_progress_user ON public.user_topic_progress(user_id);
```

### 3.40 AI Feature Configurations Table

```sql
CREATE TABLE public.ai_feature_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  primary_provider_id UUID,
  fallback_provider_id UUID,
  fallback_enabled BOOLEAN DEFAULT true,
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_feature_configurations ENABLE ROW LEVEL SECURITY;
```

### 3.41 AI Providers Table

```sql
CREATE TABLE public.ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  description TEXT,
  supported_models JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
```

### 3.42 AI Provider Credentials Table

```sql
CREATE TABLE public.ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  model_preference TEXT,
  rate_limit_per_minute INTEGER,
  is_active BOOLEAN DEFAULT true,
  test_status TEXT,
  test_error TEXT,
  last_tested_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;
```

### 3.43 AI Model Configurations Table

```sql
CREATE TABLE public.ai_model_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE,
  edge_function TEXT NOT NULL,
  primary_model TEXT NOT NULL,
  fallback_model TEXT,
  is_ab_testing BOOLEAN DEFAULT false,
  ab_test_model TEXT,
  ab_test_split_percentage INTEGER DEFAULT 50,
  max_retries INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 1000,
  timeout_ms INTEGER DEFAULT 30000,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_model_configurations ENABLE ROW LEVEL SECURITY;
```

### 3.44 AI Feature Health Table

```sql
CREATE TABLE public.ai_feature_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  status TEXT DEFAULT 'healthy',
  current_model TEXT NOT NULL,
  fallback_model TEXT,
  fallback_enabled BOOLEAN DEFAULT true,
  auto_retry_enabled BOOLEAN DEFAULT true,
  max_retry_attempts INTEGER DEFAULT 3,
  is_enabled BOOLEAN DEFAULT true,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  average_latency_ms INTEGER,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  last_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_feature_health ENABLE ROW LEVEL SECURITY;
```

### 3.45 AI Health Monitoring Table

```sql
CREATE TABLE public.ai_health_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_health_monitoring ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_health_feature ON public.ai_health_monitoring(feature_name);
CREATE INDEX idx_ai_health_checked ON public.ai_health_monitoring(checked_at DESC);
```

### 3.46 AI Usage Logs Table

```sql
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  provider_id UUID REFERENCES public.ai_providers(id),
  model_used TEXT,
  success BOOLEAN NOT NULL,
  latency_ms INTEGER,
  request_tokens INTEGER,
  response_tokens INTEGER,
  total_cost_cents INTEGER,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_usage_feature ON public.ai_usage_logs(feature_name);
CREATE INDEX idx_ai_usage_created ON public.ai_usage_logs(created_at DESC);
```

### 3.47 Platform Configurations Table

```sql
CREATE TABLE public.platform_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  data_type TEXT DEFAULT 'string',
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  validation_rules JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_configurations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_platform_config_category ON public.platform_configurations(category);
```

### 3.48 System Config Table

```sql
CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
```

### 3.49 Documentation Table

```sql
CREATE TABLE public.documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;
```

### 3.50 Chatbot Knowledge Table

```sql
CREATE TABLE public.chatbot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  role_specific TEXT[],
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chatbot_category ON public.chatbot_knowledge(category);
CREATE INDEX idx_chatbot_active ON public.chatbot_knowledge(is_active);
```

### 3.51 ATS Integrations Table

```sql
CREATE TABLE public.ats_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ats_provider TEXT NOT NULL,
  api_key_encrypted TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'inactive',
  sync_enabled BOOLEAN DEFAULT false,
  sync_frequency INTEGER DEFAULT 60,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ats_integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ats_org ON public.ats_integrations(organization_id);
```

### 3.52 ATS Candidates Table

```sql
CREATE TABLE public.ats_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ats_integrations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  resume_parsed JSONB,
  skills JSONB,
  education JSONB,
  experience_years INTEGER,
  current_position TEXT,
  current_company TEXT,
  applied_position TEXT,
  ats_status TEXT,
  source TEXT,
  interview_id UUID REFERENCES public.interviews(id),
  attempt_id UUID REFERENCES public.interview_attempts(id),
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ats_candidates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ats_candidates_integration ON public.ats_candidates(integration_id);
CREATE INDEX idx_ats_candidates_email ON public.ats_candidates(email);
```

### 3.53 Preinterview Check Logs Table

```sql
CREATE TABLE public.preinterview_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id),
  invitation_id UUID REFERENCES public.interview_invitations(id),
  candidate_email TEXT NOT NULL,
  candidate_name TEXT,
  camera_status TEXT DEFAULT 'pending',
  camera_error TEXT,
  microphone_status TEXT DEFAULT 'pending',
  microphone_error TEXT,
  network_status TEXT DEFAULT 'pending',
  network_error TEXT,
  network_speed_mbps NUMERIC,
  lighting_status TEXT DEFAULT 'pending',
  lighting_error TEXT,
  person_visible_status TEXT DEFAULT 'pending',
  person_visible_error TEXT,
  screen_share_attempted BOOLEAN DEFAULT false,
  screen_share_error TEXT,
  browser_info JSONB,
  user_agent TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.preinterview_check_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_precheck_interview ON public.preinterview_check_logs(interview_id);
CREATE INDEX idx_precheck_candidate ON public.preinterview_check_logs(candidate_email);
```

### 3.54 Candidate Performance Index Table

```sql
CREATE TABLE public.candidate_performance_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES public.interviews(id),
  organization_id UUID REFERENCES public.organizations(id),
  cpi_score NUMERIC(5,2),
  integrity_score NUMERIC(5,2),
  technical_score NUMERIC(5,2),
  problem_solving_score NUMERIC(5,2),
  communication_score NUMERIC(5,2),
  time_efficiency_score NUMERIC(5,2),
  dimension_breakdown JSONB DEFAULT '{}',
  benchmark_percentile INTEGER,
  recommendations TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.candidate_performance_index ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cpi_attempt ON public.candidate_performance_index(attempt_id);
CREATE INDEX idx_cpi_org ON public.candidate_performance_index(organization_id);
```

### 3.55 Test Suites Table

```sql
CREATE TABLE public.test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;
```

### 3.56 Test Runs Table

```sql
CREATE TABLE public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID REFERENCES public.test_suites(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  warnings INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  summary TEXT,
  initiated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
```

### 3.57 Test Results Table

```sql
CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_category TEXT NOT NULL,
  status TEXT NOT NULL,
  execution_time_ms INTEGER,
  error_message TEXT,
  fix_recommendation TEXT,
  severity TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_test_results_run ON public.test_results(run_id);
```

### 3.58 Onboarding Progress Table

```sql
CREATE TABLE public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  steps_completed JSONB DEFAULT '{}',
  current_step TEXT,
  is_complete BOOLEAN DEFAULT false,
  skipped_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
```

### 3.59 Activity Feed Table

```sql
CREATE TABLE public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_activity_org ON public.activity_feed(organization_id);
CREATE INDEX idx_activity_actor ON public.activity_feed(actor_id);
CREATE INDEX idx_activity_created ON public.activity_feed(created_at DESC);
```

### 3.60 Security Events Table

```sql
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_security_events_user ON public.security_events(user_id);
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_created ON public.security_events(created_at DESC);
```

---

## 4. Security Functions

```sql
-- Function to check if user has a specific role (CRITICAL for RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
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

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
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

-- Function to get user's roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS public.app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(role)
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Function to check organization membership
CREATE OR REPLACE FUNCTION public.user_is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND is_active = true
  )
$$;

-- Function to check organization admin status
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('admin', 'owner')
      AND is_active = true
  )
$$;

-- Function to check if user can access org data
CREATE OR REPLACE FUNCTION public.can_access_org_data(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_any_role(_user_id, ARRAY['platform_admin', 'admin']::public.app_role[])
    OR public.user_is_org_member(_user_id, _org_id)
$$;

-- Function to check interview access
CREATE OR REPLACE FUNCTION public.can_access_interview(interview_uuid UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = interview_uuid
    AND (
      i.created_by = user_id
      OR public.has_any_role(user_id, ARRAY['platform_admin', 'admin']::public.app_role[])
      OR public.user_is_org_member(user_id, i.organization_id)
    )
  )
$$;

-- Function to check action permission
CREATE OR REPLACE FUNCTION public.has_action_permission(_user_id UUID, _action_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_roles_arr public.app_role[];
  allowed_roles_arr TEXT[];
BEGIN
  -- Get user's roles
  SELECT ARRAY_AGG(role) INTO user_roles_arr
  FROM public.user_roles
  WHERE user_id = _user_id;
  
  -- Get allowed roles for action
  SELECT allowed_roles INTO allowed_roles_arr
  FROM public.role_permissions
  WHERE action_name = _action_name AND is_active = true;
  
  -- Check if any user role is in allowed roles
  IF user_roles_arr IS NULL OR allowed_roles_arr IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN user_roles_arr::TEXT[] && allowed_roles_arr;
END;
$$;

-- Encryption functions for sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_api_key(api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(encrypt(api_key::bytea, 'talentgeenie_encryption_key'::bytea, 'aes'), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN convert_from(decrypt(decode(encrypted_key, 'base64'), 'talentgeenie_encryption_key'::bytea, 'aes'), 'UTF8');
END;
$$;
```

---

## 5. RLS Policies

```sql
-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['platform_admin', 'admin']::public.app_role[]));

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Platform admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- Organizations policies
CREATE POLICY "Org members can view their organizations"
  ON public.organizations FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['platform_admin', 'admin']::public.app_role[])
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Platform admins can manage organizations"
  ON public.organizations FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Partner admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (public.user_is_org_admin(auth.uid(), id));

-- Organization members policies
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  USING (public.user_is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can manage members"
  ON public.organization_members FOR ALL
  USING (public.user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Platform admins can manage all members"
  ON public.organization_members FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- Interviews policies
CREATE POLICY "Users can view interviews they have access to"
  ON public.interviews FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['platform_admin', 'admin']::public.app_role[])
    OR public.user_is_org_member(auth.uid(), organization_id)
    OR is_public = true
  );

CREATE POLICY "Users can create interviews"
  ON public.interviews FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their interviews"
  ON public.interviews FOR UPDATE
  USING (
    created_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['platform_admin', 'admin']::public.app_role[])
    OR public.user_is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "Users can delete their interviews"
  ON public.interviews FOR DELETE
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'platform_admin')
  );

-- Questions policies
CREATE POLICY "Users can view questions for accessible interviews"
  ON public.questions FOR SELECT
  USING (
    interview_id IN (
      SELECT id FROM public.interviews
      WHERE created_by = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['platform_admin', 'admin']::public.app_role[])
        OR public.user_is_org_member(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can manage questions for their interviews"
  ON public.questions FOR ALL
  USING (
    interview_id IN (
      SELECT id FROM public.interviews WHERE created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'platform_admin')
  );

-- Interview invitations policies (public access for candidates)
CREATE POLICY "Anyone can view invitations by token"
  ON public.interview_invitations FOR SELECT
  USING (true);

CREATE POLICY "Users can manage invitations for their interviews"
  ON public.interview_invitations FOR ALL
  USING (
    interview_id IN (
      SELECT id FROM public.interviews WHERE created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'platform_admin')
  );

-- Interview attempts policies (candidates need access)
CREATE POLICY "Candidates can view their own attempts"
  ON public.interview_attempts FOR SELECT
  USING (true);

CREATE POLICY "Candidates can create attempts"
  ON public.interview_attempts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Candidates can update their attempts via session token"
  ON public.interview_attempts FOR UPDATE
  USING (true);

-- Assessments policies
CREATE POLICY "Users can view assessments for accessible interviews"
  ON public.assessments FOR SELECT
  USING (
    attempt_id IN (
      SELECT ia.id FROM public.interview_attempts ia
      JOIN public.interviews i ON ia.interview_id = i.id
      WHERE i.created_by = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['platform_admin', 'admin']::public.app_role[])
        OR public.user_is_org_member(auth.uid(), i.organization_id)
    )
  );

-- Proctoring sessions policies
CREATE POLICY "Candidates can view their proctoring sessions"
  ON public.proctoring_sessions FOR SELECT
  USING (true);

CREATE POLICY "Candidates can create proctoring sessions"
  ON public.proctoring_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Candidates can update proctoring sessions"
  ON public.proctoring_sessions FOR UPDATE
  USING (true);

-- Notifications policies
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Audit logs policies
CREATE POLICY "Platform admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Subscription plans policies (public read)
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform admins can manage plans"
  ON public.subscription_plans FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- Certification topics policies (public read)
CREATE POLICY "Anyone can view active certifications"
  ON public.certification_topics FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform admins can manage certifications"
  ON public.certification_topics FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- User certificates policies
CREATE POLICY "Users can view their certificates"
  ON public.user_certificates FOR SELECT
  USING (auth.uid() = user_id OR true); -- Public for verification

CREATE POLICY "System can create certificates"
  ON public.user_certificates FOR INSERT
  WITH CHECK (true);

-- Platform configurations policies
CREATE POLICY "Platform admins can manage configurations"
  ON public.platform_configurations FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- Chatbot knowledge policies (public read)
CREATE POLICY "Anyone can view active knowledge"
  ON public.chatbot_knowledge FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform admins can manage knowledge"
  ON public.chatbot_knowledge FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- System config policies
CREATE POLICY "Platform admins can manage system config"
  ON public.system_config FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'));
```

---

## 6. Application Functions

```sql
-- Generate share token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT encode(gen_random_bytes(16), 'hex')
$$;

-- Generate session token
CREATE OR REPLACE FUNCTION public.generate_session_token()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT encode(gen_random_bytes(32), 'hex')
$$;

-- Generate verification code
CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT upper(encode(gen_random_bytes(4), 'hex'))
$$;

-- Generate certificate number
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'TG-CERT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(encode(gen_random_bytes(4), 'hex'))
$$;

-- Generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(encode(gen_random_bytes(4), 'hex'))
$$;

-- Generate slug
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(input_text, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$;

-- Create interview attempt with session token
CREATE OR REPLACE FUNCTION public.create_interview_attempt(
  p_interview_id UUID,
  p_candidate_email TEXT,
  p_candidate_name TEXT
)
RETURNS TABLE(success BOOLEAN, attempt_id UUID, session_token TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
BEGIN
  v_session_token := public.generate_session_token();
  
  INSERT INTO public.interview_attempts (
    interview_id, candidate_email, candidate_name, session_token, status
  ) VALUES (
    p_interview_id, p_candidate_email, p_candidate_name, v_session_token, 'in_progress'
  )
  RETURNING id INTO v_attempt_id;
  
  RETURN QUERY SELECT true, v_attempt_id, v_session_token, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, SQLERRM;
END;
$$;

-- Create interview attempt with invitation
CREATE OR REPLACE FUNCTION public.create_interview_attempt_with_invitation(
  p_invitation_id UUID,
  p_candidate_email TEXT,
  p_candidate_name TEXT
)
RETURNS TABLE(success BOOLEAN, attempt_id UUID, session_token TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
  v_interview_id UUID;
BEGIN
  SELECT interview_id INTO v_interview_id
  FROM public.interview_invitations
  WHERE id = p_invitation_id;
  
  IF v_interview_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Invalid invitation'::TEXT;
    RETURN;
  END IF;
  
  v_session_token := public.generate_session_token();
  
  INSERT INTO public.interview_attempts (
    interview_id, invitation_id, candidate_email, candidate_name, session_token, status
  ) VALUES (
    v_interview_id, p_invitation_id, p_candidate_email, p_candidate_name, v_session_token, 'in_progress'
  )
  RETURNING id INTO v_attempt_id;
  
  -- Update invitation status
  UPDATE public.interview_invitations
  SET status = 'accessed', accessed_at = now()
  WHERE id = p_invitation_id AND status = 'pending';
  
  RETURN QUERY SELECT true, v_attempt_id, v_session_token, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, SQLERRM;
END;
$$;

-- Get attempt by session token
CREATE OR REPLACE FUNCTION public.get_attempt_by_session(token TEXT)
RETURNS SETOF public.interview_attempts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.interview_attempts WHERE session_token = token
$$;

-- Update attempt with session token
CREATE OR REPLACE FUNCTION public.update_attempt_with_session(
  token TEXT,
  attempt_answers JSONB,
  seconds_taken INTEGER
)
RETURNS TABLE(success BOOLEAN, attempt_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  UPDATE public.interview_attempts
  SET answers = attempt_answers, time_taken = seconds_taken
  WHERE session_token = token
  RETURNING id INTO v_attempt_id;
  
  RETURN QUERY SELECT v_attempt_id IS NOT NULL, v_attempt_id;
END;
$$;

-- Terminate attempt with session token
CREATE OR REPLACE FUNCTION public.terminate_attempt_with_session(
  token TEXT,
  attempt_answers TEXT,
  seconds_taken INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.interview_attempts
  SET 
    answers = attempt_answers::JSONB,
    time_taken = seconds_taken,
    status = 'completed',
    submitted_at = now()
  WHERE session_token = token;
  
  RETURN FOUND;
END;
$$;

-- Calculate CPI score
CREATE OR REPLACE FUNCTION public.calculate_cpi_score(
  p_integrity_score NUMERIC,
  p_technical_score NUMERIC,
  p_problem_solving_score NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
AS $$
  SELECT ROUND(
    (COALESCE(p_integrity_score, 0) * 0.3) +
    (COALESCE(p_technical_score, 0) * 0.4) +
    (COALESCE(p_problem_solving_score, 0) * 0.3)
  , 2)
$$;

-- Check daily free assessment limit
CREATE OR REPLACE FUNCTION public.check_daily_free_assessment_limit(p_user_id UUID)
RETURNS TABLE(can_take_free BOOLEAN, free_count INTEGER, free_limit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_count INTEGER;
  v_free_limit INTEGER := 1;
BEGIN
  SELECT COUNT(*) INTO v_free_count
  FROM public.learning_assessment_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE
    AND was_free = true;
  
  RETURN QUERY SELECT v_free_count < v_free_limit, v_free_count, v_free_limit;
END;
$$;

-- Verify certificate by code
CREATE OR REPLACE FUNCTION public.verify_certificate_by_code(p_verification_code TEXT)
RETURNS TABLE(
  certificate_number TEXT,
  verification_code TEXT,
  candidate_name TEXT,
  certification_name TEXT,
  category TEXT,
  difficulty_level TEXT,
  score INTEGER,
  integrity_score INTEGER,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN,
  revoked_reason TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    uc.certificate_number,
    uc.verification_code,
    uc.candidate_name,
    ct.display_name,
    ct.category,
    ct.difficulty_level,
    uc.score,
    uc.integrity_score,
    uc.issued_at,
    uc.expires_at,
    uc.is_revoked,
    uc.revoked_reason
  FROM public.user_certificates uc
  JOIN public.certification_topics ct ON uc.certification_topic_id = ct.id
  WHERE uc.verification_code = p_verification_code
$$;

-- Create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_organization_id UUID DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, organization_id, link, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_organization_id, p_link, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Check if payment is enabled
CREATE OR REPLACE FUNCTION public.is_payment_enabled(p_gateway_name TEXT DEFAULT NULL)
RETURNS TABLE(gateway_name TEXT, enabled BOOLEAN, is_test_mode BOOLEAN, has_keys BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pg.gateway_name,
    pg.is_enabled,
    pg.is_test_mode,
    CASE 
      WHEN pg.is_test_mode THEN pg.test_secret_key_encrypted IS NOT NULL
      ELSE pg.live_secret_key_encrypted IS NOT NULL
    END
  FROM public.payment_gateways pg
  WHERE p_gateway_name IS NULL OR pg.gateway_name = p_gateway_name
$$;

-- Auto close expired proctoring sessions
CREATE OR REPLACE FUNCTION public.auto_close_expired_proctoring_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.proctoring_sessions
    SET ended_at = now(), updated_at = now()
    WHERE ended_at IS NULL
      AND created_at < now() - interval '4 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO closed_count FROM updated;
  
  RETURN closed_count;
END;
$$;

-- Toggle violation ignored
CREATE OR REPLACE FUNCTION public.toggle_violation_ignored(
  p_session_id UUID,
  p_violation_id TEXT,
  p_ignore BOOLEAN
)
RETURNS TABLE(success BOOLEAN, new_integrity_score INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_violations JSONB;
  v_ignored_violations JSONB;
  v_new_integrity_score INTEGER;
BEGIN
  SELECT violations, ignored_violations INTO v_violations, v_ignored_violations
  FROM public.proctoring_sessions
  WHERE id = p_session_id;
  
  IF p_ignore THEN
    v_ignored_violations := COALESCE(v_ignored_violations, '[]'::JSONB) || to_jsonb(p_violation_id);
  ELSE
    v_ignored_violations := (
      SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
      FROM jsonb_array_elements(COALESCE(v_ignored_violations, '[]'::JSONB)) elem
      WHERE elem::TEXT != to_jsonb(p_violation_id)::TEXT
    );
  END IF;
  
  -- Recalculate integrity score
  v_new_integrity_score := 100 - (
    SELECT COUNT(*)::INTEGER * 5
    FROM jsonb_array_elements(COALESCE(v_violations, '[]'::JSONB)) v
    WHERE NOT v_ignored_violations @> to_jsonb(v->>'id')
  );
  v_new_integrity_score := GREATEST(0, v_new_integrity_score);
  
  UPDATE public.proctoring_sessions
  SET ignored_violations = v_ignored_violations,
      integrity_score = v_new_integrity_score,
      updated_at = now()
  WHERE id = p_session_id;
  
  RETURN QUERY SELECT true, v_new_integrity_score;
END;
$$;
```

---

## 7. Triggers

```sql
-- Profile auto-creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proctoring_sessions_updated_at
  BEFORE UPDATE ON public.proctoring_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate share link on interview creation
CREATE OR REPLACE FUNCTION public.generate_interview_share_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.share_link IS NULL THEN
    NEW.share_link := public.generate_share_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_interview_share_link
  BEFORE INSERT ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.generate_interview_share_link();

-- Generate share token on invitation creation
CREATE OR REPLACE FUNCTION public.generate_invitation_share_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.share_token IS NULL THEN
    NEW.share_token := public.generate_share_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invitation_share_token
  BEFORE INSERT ON public.interview_invitations
  FOR EACH ROW EXECUTE FUNCTION public.generate_invitation_share_token();
```

---

## 8. Storage Buckets

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('documentation', 'documentation', false, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('organization-logos', 'organization-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('proctoring-recordings', 'proctoring-recordings', false, 524288000, ARRAY['video/webm', 'video/mp4']),
  ('proctoring-screenshots', 'proctoring-screenshots', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('certificates', 'certificates', false, 10485760, ARRAY['application/pdf', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars (public)
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for proctoring recordings
CREATE POLICY "Authenticated users can upload proctoring recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proctoring-recordings');

CREATE POLICY "Authenticated users can view proctoring recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proctoring-recordings');

-- Storage policies for proctoring screenshots
CREATE POLICY "Authenticated users can upload proctoring screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proctoring-screenshots');

CREATE POLICY "Authenticated users can view proctoring screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proctoring-screenshots');

-- Storage policies for certificates
CREATE POLICY "Users can view certificates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');

CREATE POLICY "System can create certificates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'certificates');
```

---

## 9. Seed Data

```sql
-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, plan_type, description, price_cents, max_interviews, max_users, max_ai_usage, display_order, features)
VALUES
  ('Free', 'free', 'Get started with basic features', 0, 5, 2, 100, 1, '{"basic_interviews": true}'),
  ('Starter', 'starter', 'For small teams', 4900, 25, 5, 500, 2, '{"basic_interviews": true, "proctoring": true}'),
  ('Professional', 'professional', 'For growing organizations', 14900, 100, 20, 2000, 3, '{"basic_interviews": true, "proctoring": true, "analytics": true}'),
  ('Enterprise', 'enterprise', 'Custom solutions for large teams', 0, -1, -1, -1, 4, '{"unlimited": true}')
ON CONFLICT DO NOTHING;

-- Insert default learning plans
INSERT INTO public.learning_plans (name, description, price, max_assessments, max_certifications, max_ai_usage, display_order)
VALUES
  ('Free', 'Try learning with limited features', 0, 1, 0, 10, 1),
  ('Basic', 'Essential learning features', 999, 10, 3, 100, 2),
  ('Premium', 'Full access to all learning features', 2999, -1, -1, -1, 3)
ON CONFLICT DO NOTHING;

-- Insert default AI providers
INSERT INTO public.ai_providers (name, display_name, provider_type, base_url, supported_models)
VALUES
  ('lovable', 'Lovable AI', 'lovable', 'https://api.lovable.dev', '["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-5-mini"]'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- Insert default role permissions
INSERT INTO public.role_permissions (action_name, allowed_roles, category, description)
VALUES
  ('view_dashboard', ARRAY['platform_admin', 'admin', 'partner_admin', 'hr', 'hr_recruiter', 'interviewer'], 'dashboard', 'View main dashboard'),
  ('create_interview', ARRAY['platform_admin', 'admin', 'partner_admin', 'hr', 'hr_recruiter', 'ta_creator'], 'interviews', 'Create new interviews'),
  ('manage_users', ARRAY['platform_admin', 'admin', 'partner_admin'], 'users', 'Manage user accounts'),
  ('view_billing', ARRAY['platform_admin', 'admin', 'partner_admin', 'billing_contact'], 'billing', 'View billing information'),
  ('manage_settings', ARRAY['platform_admin', 'admin'], 'settings', 'Manage platform settings'),
  ('view_analytics', ARRAY['platform_admin', 'admin', 'partner_admin', 'hr'], 'analytics', 'View analytics and reports'),
  ('manage_certifications', ARRAY['platform_admin', 'admin'], 'certifications', 'Manage certifications'),
  ('review_proctoring', ARRAY['platform_admin', 'admin', 'partner_admin', 'hr', 'interviewer'], 'proctoring', 'Review proctoring sessions')
ON CONFLICT (action_name) DO NOTHING;

-- Insert default platform configurations
INSERT INTO public.platform_configurations (key, value, category, data_type, description)
VALUES
  ('max_video_upload_size_mb', '500', 'proctoring', 'number', 'Maximum video upload size in MB'),
  ('screenshot_interval_seconds', '30', 'proctoring', 'number', 'Interval between periodic screenshots'),
  ('default_time_limit_minutes', '30', 'interviews', 'number', 'Default interview time limit'),
  ('max_questions_per_interview', '50', 'interviews', 'number', 'Maximum questions per interview'),
  ('data_retention_days', '365', 'compliance', 'number', 'Days to retain interview data'),
  ('chatbot_enabled', 'true', 'features', 'boolean', 'Enable chatbot assistance')
ON CONFLICT (key) DO NOTHING;
```

---

## 10. Verification

Run these queries to verify the migration completed successfully:

```sql
-- Check all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check all functions were created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';

-- Check storage buckets
SELECT id, name, public FROM storage.buckets;

-- Check enum types
SELECT typname, enumlabel 
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE typname = 'app_role';

-- Verify seed data
SELECT COUNT(*) AS subscription_plans FROM public.subscription_plans;
SELECT COUNT(*) AS learning_plans FROM public.learning_plans;
SELECT COUNT(*) AS role_permissions FROM public.role_permissions;
SELECT COUNT(*) AS platform_configs FROM public.platform_configurations;
```

---

## Post-Migration Steps

1. **Create Admin User**: After running migrations, create your first admin user through Supabase Auth, then manually assign the platform_admin role:

```sql
-- Replace 'YOUR_ADMIN_USER_ID' with the actual user ID from auth.users
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_ADMIN_USER_ID', 'platform_admin');
```

2. **Update Environment Variables**: In your new Supabase project, update:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Configure Edge Functions**: Deploy all edge functions from the `supabase/functions` directory.

4. **Set Up Secrets**: Add required secrets in Supabase:
   - `LOVABLE_API_KEY` - For AI features
   - `RESEND_API_KEY` - **Required** for auth-email-hook (email verification, password reset, etc.)
   - `GOOGLE_GEMINI_API_KEY` - For AI evaluations
   - Any other API keys used

5. **Auth Email Templates**: The migration includes 5 auth email templates in the `email_templates` table:
   - `auth_email_verification` - Email verification on signup
   - `auth_password_recovery` - Password reset emails
   - `auth_magic_link` - Magic link login
   - `auth_invite` - User invitations
   - `auth_email_change` - Email change confirmation
   
   These are used by the `auth-email-hook` edge function to send branded authentication emails.

5. **Enable Realtime** (if needed):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_sessions;
```

---

## Notes

- All tables have RLS enabled - ensure policies match your security requirements
- The encryption key in `encrypt_api_key` should be changed to a secure value in production
- Storage bucket policies are configured for basic access - adjust as needed
- This migration assumes a fresh database - test in a staging environment first
