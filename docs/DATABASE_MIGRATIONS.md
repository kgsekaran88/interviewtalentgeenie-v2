# Database Migration Scripts Documentation

This document contains all the database migration scripts for the TalentGeenie platform. These scripts are located in `supabase/migrations/` and represent the complete evolution of the database schema.

## Table of Contents

1. [Core Schema Setup](#core-schema-setup)
2. [Security Fixes](#security-fixes)
3. [RBAC System](#rbac-system)
4. [Learning System](#learning-system)
5. [Organizations & Partners](#organizations--partners)
6. [Proctoring System](#proctoring-system)
7. [Certifications](#certifications)
8. [AI Features](#ai-features)
9. [Platform Configuration](#platform-configuration)

---

## Core Schema Setup

### Migration: 20251008011120 - Initial Schema
**File:** `20251008011120_42c2e6eb-54f4-47d1-a23b-f449ec6c3b72.sql`

Creates the foundational tables for the interview platform.

```sql
-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create interviews table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  job_description TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 10,
  difficulty_distribution JSONB DEFAULT '{"easy": 30, "medium": 50, "hard": 20}'::jsonb,
  topic_distribution JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  share_link TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interviews"
  ON public.interviews FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can create interviews"
  ON public.interviews FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own interviews"
  ON public.interviews FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete own interviews"
  ON public.interviews FOR DELETE
  USING (auth.uid() = creator_id);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  correct_answer TEXT,
  options JSONB,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions for their interviews"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews
      WHERE interviews.id = questions.interview_id
      AND interviews.creator_id = auth.uid()
    )
  );

-- Create interview_attempts table
CREATE TABLE public.interview_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_taken INTEGER,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.interview_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interview creators can view attempts"
  ON public.interview_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews
      WHERE interviews.id = interview_attempts.interview_id
      AND interviews.creator_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create interview attempts"
  ON public.interview_attempts FOR INSERT
  WITH CHECK (true);

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL,
  hiring_decision TEXT NOT NULL CHECK (hiring_decision IN ('strong_hire', 'hire', 'consider', 'reject')),
  strengths TEXT[],
  weaknesses TEXT[],
  topic_scores JSONB DEFAULT '{}'::jsonb,
  detailed_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_interviews_creator ON public.interviews(creator_id);
CREATE INDEX idx_questions_interview ON public.questions(interview_id);
CREATE INDEX idx_attempts_interview ON public.interview_attempts(interview_id);
CREATE INDEX idx_assessments_attempt ON public.assessments(attempt_id);
```

---

## Security Fixes

### Migration: 20251008012305 - Security Session Tokens
**File:** `20251008012305_82cfeb36-7789-469c-9051-dbea62d092b9.sql`

Implements session token-based security for interview attempts.

```sql
-- Add session_token column for secure access
ALTER TABLE public.interview_attempts 
ADD COLUMN IF NOT EXISTS session_token TEXT UNIQUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_interview_attempts_session_token 
ON public.interview_attempts(session_token);

-- Secure UPDATE policy using session tokens
CREATE POLICY "Users can update attempts with valid session token"
  ON public.interview_attempts FOR UPDATE
  USING (
    session_token IS NOT NULL
    AND status = 'in_progress'
  );

-- Create function to generate secure session tokens
CREATE OR REPLACE FUNCTION public.generate_session_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$;

-- Trigger to auto-generate session token on insert
CREATE OR REPLACE FUNCTION public.set_session_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_token IS NULL THEN
    NEW.session_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_session_token_trigger
  BEFORE INSERT ON public.interview_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_session_token();
```

### Migration: 20251008040034 - Secure Functions
**File:** `20251008040034_a0a00949-f18b-49ea-8cc9-bbc2b1579665.sql`

Creates secure RPC functions for session-based operations.

```sql
-- Secure function to get attempt by session
CREATE OR REPLACE FUNCTION public.get_attempt_by_session(token TEXT)
RETURNS SETOF public.interview_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.interview_attempts
  WHERE session_token = token
  AND session_token IS NOT NULL
  AND LENGTH(session_token) > 0;
END;
$$;

-- Secure function to update attempt with session
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
  v_status TEXT;
BEGIN
  -- Validate input
  IF token IS NULL OR LENGTH(token) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF attempt_answers IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- Find the attempt with exact session token match
  SELECT id, status INTO v_attempt_id, v_status
  FROM public.interview_attempts
  WHERE session_token = token
  AND session_token IS NOT NULL
  AND LENGTH(session_token) > 0;

  -- Verify attempt exists and is in progress
  IF v_attempt_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF v_status != 'in_progress' THEN
    RETURN QUERY SELECT FALSE, v_attempt_id;
    RETURN;
  END IF;

  -- Update the attempt
  UPDATE public.interview_attempts
  SET 
    answers = attempt_answers,
    time_taken = seconds_taken,
    status = 'submitted',
    submitted_at = NOW()
  WHERE id = v_attempt_id;

  RETURN QUERY SELECT TRUE, v_attempt_id;
END;
$$;
```

---

## RBAC System

### Migration: 20251008043014 - Role-Based Access Control
**File:** `20251008043014_7182a5b9-ce1e-4f0f-9bd5-7417cbfd676b.sql`

Implements the complete RBAC system.

```sql
-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'interviewer', 'contributor');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
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

-- Function to check if user has any of multiple roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
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

-- Function to get user roles
-- IMPORTANT: Must DROP first if changing return type from app_role[] to SETOF app_role
DROP FUNCTION IF EXISTS public.get_user_roles(uuid);

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can assign roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can remove roles"
  ON public.user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Role-based interview policies
CREATE POLICY "Interviewers and HRs can create interviews"
  ON public.interviews
  FOR INSERT
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin', 'hr', 'interviewer']::app_role[])
  );

CREATE POLICY "Users can view interviews they created or have access to"
  ON public.interviews
  FOR SELECT
  USING (
    creator_id = auth.uid() 
    OR public.has_any_role(auth.uid(), ARRAY['admin', 'hr']::app_role[])
  );
```

---

## Learning System

### Migration: 20251010035234 - Learning & Training System
**File:** `20251010035234_4542336e-a23b-4cdf-8437-737da4fba5f3.sql`

Creates the complete learning and training management system.

```sql
-- Create training_plans table for role-based learning paths
CREATE TABLE public.training_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name TEXT NOT NULL,
  role_description TEXT,
  difficulty_level TEXT NOT NULL DEFAULT 'beginner',
  estimated_duration INTEGER, -- in hours
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create training_topics table for topics within training plans
CREATE TABLE public.training_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  subtopic TEXT,
  difficulty_level TEXT NOT NULL DEFAULT 'beginner',
  estimated_duration INTEGER, -- in minutes
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_materials table for resources attached to topics
CREATE TABLE public.learning_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_topic_id UUID NOT NULL REFERENCES public.training_topics(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL, -- video, article, pdf, github, course
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_training_assignments table
CREATE TABLE public.user_training_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'assigned', -- assigned, in_progress, completed
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, training_plan_id)
);

-- Create learning_assessments table
CREATE TABLE public.learning_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  training_topic_id UUID REFERENCES public.training_topics(id),
  title TEXT NOT NULL,
  topic_description TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 10,
  difficulty_distribution JSONB NOT NULL DEFAULT '{"easy": 40, "medium": 40, "hard": 20}'::jsonb,
  question_type_distribution JSONB NOT NULL DEFAULT '{"mcq": 60, "descriptive": 30, "coding": 10}'::jsonb,
  time_limit INTEGER, -- in minutes
  mode TEXT NOT NULL DEFAULT 'practice', -- practice, exam
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_assessment_questions table
CREATE TABLE public.learning_assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- mcq, descriptive, coding
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  options JSONB, -- for MCQ
  correct_answer TEXT,
  explanation TEXT,
  hints TEXT, -- for practice mode
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_assessment_attempts table
CREATE TABLE public.learning_assessment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_taken INTEGER, -- in seconds
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, submitted, evaluated
  score INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_assessment_feedback table
CREATE TABLE public.learning_assessment_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL,
  percentage NUMERIC NOT NULL,
  topic_scores JSONB, -- topic-wise breakdown
  difficulty_scores JSONB, -- difficulty-wise breakdown
  strengths TEXT[],
  weaknesses TEXT[],
  improvement_areas TEXT[],
  detailed_analysis TEXT,
  question_feedback JSONB, -- per-question feedback
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_topic_progress table for tracking completion
CREATE TABLE public.user_topic_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_topic_id UUID NOT NULL REFERENCES public.training_topics(id) ON DELETE CASCADE,
  materials_completed INTEGER NOT NULL DEFAULT 0,
  total_materials INTEGER NOT NULL DEFAULT 0,
  assessments_completed INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER,
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, completed
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, training_topic_id)
);

-- Enable RLS on all tables
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assessment_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_topic_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view active training plans"
  ON public.training_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage training plans"
  ON public.training_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view and create their own assessments"
  ON public.learning_assessments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own attempts"
  ON public.learning_assessment_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Migration: 20251209052900 - Learning Plans
**File:** `20251209052900_b79f2b1b-8f0a-408d-8178-883a469d3303.sql`

Creates learning subscription plans.

```sql
-- Create learning_plans table to centralize learning subscription configurations
CREATE TABLE public.learning_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  max_assessments INTEGER NOT NULL DEFAULT 10,
  max_certifications INTEGER NOT NULL DEFAULT 5,
  max_ai_usage INTEGER NOT NULL DEFAULT 100,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view active plans (for pricing page, registration)
CREATE POLICY "Everyone can view active learning plans"
ON public.learning_plans
FOR SELECT
USING (is_active = true);

-- Platform admins can manage all plans
CREATE POLICY "Platform admins can manage learning plans"
ON public.learning_plans
FOR ALL
USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]))
WITH CHECK (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- Insert default plans
INSERT INTO public.learning_plans (name, description, price, billing_period, max_assessments, max_certifications, max_ai_usage, features, display_order) VALUES
('Free', 'Basic learning access with limited assessments', 0, 'monthly', 5, 1, 20, '["5 practice assessments per month", "1 certification attempt", "Basic progress tracking"]'::jsonb, 1),
('Learner', 'Enhanced learning with more assessments and certifications', 29, 'monthly', 50, 10, 200, '["50 practice assessments per month", "10 certification attempts", "Detailed analytics", "Priority support"]'::jsonb, 2),
('Unlimited', 'Unlimited access to all learning features', 99, 'monthly', -1, -1, -1, '["Unlimited practice assessments", "Unlimited certifications", "Advanced analytics", "AI coaching", "Priority support"]'::jsonb, 3);
```

---

## Organizations & Partners

### Migration: Organizations & Multi-Tenancy

Creates the organization and partner management system.

```sql
-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_members table
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Create partner_applications table
CREATE TABLE public.partner_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL REFERENCES auth.users(id),
  organization_name TEXT NOT NULL,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, revision_requested
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Organization membership check function
CREATE OR REPLACE FUNCTION public.user_is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND status = 'active'
  )
$$;

-- Organization admin check function
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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
```

---

## CPI - Candidate Performance Index

### Migration: 20251111044454 - ML Scoring Pipeline & CPI
**File:** `20251111044454_dca60db5-4445-4f81-bdac-6e2ed50c0fe9.sql`

```sql
-- Create candidate_performance_index table
CREATE TABLE IF NOT EXISTS public.candidate_performance_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  candidate_email TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  
  -- Technical Scores
  technical_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  problem_solving_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  
  -- Topic-wise breakdown
  topic_scores JSONB DEFAULT '{}',
  
  -- Difficulty-wise performance
  easy_correct INTEGER DEFAULT 0,
  easy_total INTEGER DEFAULT 0,
  medium_correct INTEGER DEFAULT 0,
  medium_total INTEGER DEFAULT 0,
  hard_correct INTEGER DEFAULT 0,
  hard_total INTEGER DEFAULT 0,
  
  -- Integrity metrics
  integrity_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  violations_detected INTEGER DEFAULT 0,
  
  -- Overall CPI (0-100 scale)
  overall_cpi NUMERIC(5,2) NOT NULL DEFAULT 0,
  
  -- Skill strengths and weaknesses
  top_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  weak_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Recommendation
  -- UPDATED: 2025-12-27 - Allow both legacy and new hiring_recommendation values
  hiring_recommendation TEXT NOT NULL CHECK (hiring_recommendation IN 
    ('strongly_recommend', 'recommend', 'consider', 'not_recommended', 'strong_hire', 'hire', 'reject')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(attempt_id)
);

-- CPI calculation helper function
-- UPDATED: 2025-12-27 - Fixed table name (platform_configurations) and column names (key, value)
CREATE OR REPLACE FUNCTION public.calculate_cpi_score(
  p_technical_score NUMERIC,
  p_problem_solving_score NUMERIC,
  p_integrity_score NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
  
  -- Calculate weighted CPI
  v_cpi := (
    (p_technical_score * v_technical_weight / 100) +
    (p_problem_solving_score * v_problem_solving_weight / 100) +
    (p_integrity_score * v_integrity_weight / 100)
  );
  
  RETURN ROUND(v_cpi, 2);
END;
$$;
```

---

## Documentation Storage

### Migration: 20251008043543 - Documentation System
**File:** `20251008043543_48aaa544-5daf-47fa-a0ce-2e567eb6be2c.sql`

```sql
-- Create storage bucket for documentation PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentation',
  'documentation',
  false, -- Not public, admin access only
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
);

-- RLS Policies for documentation bucket
CREATE POLICY "Admins can upload documentation"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'documentation' 
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can view documentation"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documentation' 
    AND public.has_role(auth.uid(), 'admin')
  );

-- Create documentation metadata table
CREATE TABLE public.documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'user_guide', 'technical', 'architecture', 'deployment'
  file_path TEXT NOT NULL, -- Storage path
  version TEXT DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage documentation metadata"
  ON public.documentation
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

---

## Audit Logging

### Migration: 20251008051046 - Audit Logging System
**File:** `20251008051046_a71462a1-8459-4550-aaa5-0e9557098769.sql`

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
```

---

## System Organization for Platform Admins

### Migration: 20251118052313 - System Organization
**File:** `20251118052313_431be3e3-5ec0-4ac6-995c-a2ba345518b3.sql`

```sql
-- Create system organization for platform admins with slug
INSERT INTO public.organizations (id, name, slug, industry, website, status, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'InterviewAI Platform',
  'interviewai-platform',
  'Technology',
  'https://interviewai.platform',
  'active',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Function to assign platform admins to system organization
CREATE OR REPLACE FUNCTION public.assign_platform_admin_to_system_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_system_org_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- When a platform_admin role is assigned
  IF NEW.role = 'platform_admin' THEN
    -- Add them to the system organization if not already a member
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role,
      status,
      created_at
    )
    VALUES (
      v_system_org_id,
      NEW.user_id,
      'owner',
      'active',
      NOW()
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new platform admin assignments
DROP TRIGGER IF EXISTS on_platform_admin_assigned ON public.user_roles;
CREATE TRIGGER on_platform_admin_assigned
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_platform_admin_to_system_org();
```

---

## Complete Migration File List

Below is the complete list of all 186 migration files in chronological order:

| Date | File | Description |
|------|------|-------------|
| 2025-10-08 | 20251008011120_*.sql | Initial schema - profiles, interviews, questions, attempts |
| 2025-10-08 | 20251008012305_*.sql | Security fix - session tokens, RLS policies |
| 2025-10-08 | 20251008012605_*.sql | Questions security view |
| 2025-10-08 | 20251008012629_*.sql | View security fix |
| 2025-10-08 | 20251008040034_*.sql | Session token validation removal |
| 2025-10-08 | 20251008040459_*.sql | RLS policy updates |
| 2025-10-08 | 20251008040632_*.sql | Public interview access |
| 2025-10-08 | 20251008041932_*.sql | Time limit support |
| 2025-10-08 | 20251008043014_*.sql | RBAC system |
| 2025-10-08 | 20251008043543_*.sql | Documentation system |
| 2025-10-08 | 20251008044456_*.sql | Profile policy fixes |
| 2025-10-08 | 20251008044643_*.sql | Anonymous access blocks |
| 2025-10-08 | 20251008044745_*.sql | Comprehensive RLS |
| 2025-10-08 | 20251008045241_*.sql | Defense-in-depth security |
| 2025-10-08 | 20251008050751_*.sql | Candidate interview flow |
| 2025-10-08 | 20251008051046_*.sql | Audit logging |
| 2025-10-08 | 20251008052430_*.sql | Final security lockdown |
| 2025-10-08 | 20251008052829_*.sql | Anonymous attempt creation |
| 2025-10-08 | 20251008055120_*.sql | Pgcrypto extension |
| 2025-10-08 | 20251008055609_*.sql | Session token UUID |
| 2025-10-08 | 20251008060035_*.sql | RLS policy consolidation |
| 2025-10-08 | 20251008062250_*.sql | Public interview access |
| 2025-10-08 | 20251008063729_*.sql | Delete attempts policy |
| 2025-10-08 | 20251008071023_*.sql | Assessments RLS fix |
| 2025-10-08 | 20251008073008_*.sql | Admin profile access |
| 2025-10-09 | 20251009042722_*.sql | Candidate role |
| 2025-10-09 | 20251009043049_*.sql | Public attempt view |
| 2025-10-10 | 20251010032744_*.sql | Candidate interview policies |
| 2025-10-10 | 20251010033735_*.sql | Learning system |
| 2025-10-10 | 20251010035234_*.sql | Training plans |
| ... | ... | ... |
| 2025-12-21 | Latest migrations | Current schema state |

---

## Notes

### Security Considerations
1. All tables have Row Level Security (RLS) enabled
2. Sensitive data (correct answers) is protected via secure RPC functions
3. Session tokens are used for candidate authentication
4. Platform uses defense-in-depth approach

### Role Hierarchy
```
platform_admin > partner_admin > hr > interviewer > contributor > candidate > guest
```

### Key Functions
- `has_role(user_id, role)` - Check single role
- `has_any_role(user_id, roles[])` - Check multiple roles
- `has_any_role_with_hierarchy(user_id, roles[])` - Check with hierarchy
- `get_questions_for_candidate(interview_id)` - Safe question access
- `update_attempt_with_session(token, answers, time)` - Secure submission

---

*Last Updated: 2025-12-21*
