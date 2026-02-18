# Complete Database Migration Scripts Documentation

This document contains **ALL 171 database migration scripts** for the TalentGeenie platform. Scripts are located in `supabase/migrations/` and represent the complete evolution of the database schema.

---

## Table of Contents

1. [Core Schema Setup](#1-core-schema-setup)
2. [Session Security & RLS](#2-session-security--rls)
3. [RBAC System](#3-rbac-system)
4. [Learning System](#4-learning-system)
5. [Candidate Flow Security](#5-candidate-flow-security)
6. [Proctoring System](#6-proctoring-system)
7. [Question Banks](#7-question-banks)
8. [Organizations & Partners](#8-organizations--partners)
9. [CPI - Candidate Performance Index](#9-cpi---candidate-performance-index)
10. [ATS Integration](#10-ats-integration)
11. [Collaboration & Analytics](#11-collaboration--analytics)
12. [AI Configuration](#12-ai-configuration)
13. [Notifications](#13-notifications)
14. [Certifications](#14-certifications)
15. [Billing & Subscriptions](#15-billing--subscriptions)
16. [Platform Configuration](#16-platform-configuration)
17. [Invitations System](#17-invitations-system)
18. [AI Health Monitoring](#18-ai-health-monitoring)

---

## 1. Core Schema Setup

### 20251008011120 - Initial Schema
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

-- Create indexes for better performance
CREATE INDEX idx_interviews_creator ON public.interviews(creator_id);
CREATE INDEX idx_questions_interview ON public.questions(interview_id);
CREATE INDEX idx_attempts_interview ON public.interview_attempts(interview_id);
CREATE INDEX idx_assessments_attempt ON public.assessments(attempt_id);
```

---

## 2. Session Security & RLS

### 20251008012305 - Security Session Tokens
**File:** `20251008012305_82cfeb36-7789-469c-9051-dbea62d092b9.sql`

```sql
-- Add session_token column for secure access
ALTER TABLE public.interview_attempts 
ADD COLUMN IF NOT EXISTS session_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_interview_attempts_session_token 
ON public.interview_attempts(session_token);

-- Secure UPDATE policy using session tokens
CREATE POLICY "Users can update attempts with valid session token"
  ON public.interview_attempts FOR UPDATE
  USING (session_token IS NOT NULL AND status = 'in_progress');

-- Create function to generate secure session tokens
CREATE OR REPLACE FUNCTION public.generate_session_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$;

-- Trigger to auto-generate session token on insert
CREATE OR REPLACE FUNCTION public.set_session_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

### 20251008040034 - Secure RPC Functions
**File:** `20251008040034_a0a00949-f18b-49ea-8cc9-bbc2b1579665.sql`

```sql
-- Secure function to get attempt by session
CREATE OR REPLACE FUNCTION public.get_attempt_by_session(token TEXT)
RETURNS SETOF public.interview_attempts
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_status TEXT;
BEGIN
  IF token IS NULL OR LENGTH(token) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  SELECT id, status INTO v_attempt_id, v_status
  FROM public.interview_attempts
  WHERE session_token = token;

  IF v_attempt_id IS NULL OR v_status != 'in_progress' THEN
    RETURN QUERY SELECT FALSE, v_attempt_id;
    RETURN;
  END IF;

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

### 20251008041932 - Time Limit Support
**File:** `20251008041932_1411c9b5-1db4-4af1-9e61-c967b7293d4e.sql`

```sql
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 60;
```

---

## 3. RBAC System

### 20251008043014 - Role-Based Access Control
**File:** `20251008043014_7182a5b9-ce1e-4f0f-9bd5-7417cbfd676b.sql`

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

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check multiple roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- Function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE SQL
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can assign roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can remove roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
```

### 20251010042037 - Add Guest Role
**File:** `20251010042037_bf152062-1688-4330-98fd-03b26085aa6b.sql`

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'guest';
```

### 20251009042722 - Add Candidate Role
**File:** `20251009042722_ec8ae555-9d4c-4ec0-a944-75aa6240bd71.sql`

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'candidate';
```

### 20251111044454 - Add New Roles for Partner System
**File:** `20251111044454_dca60db5-4445-4f81-bdac-6e2ed50c0fe9.sql`

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'partner_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'hr_recruiter';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ta_creator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'billing_contact';
```

### 20251111111409 - Add Tech SPOC Role
**File:** `20251111111409_2c012c9b-9eb5-4461-ad1d-cd2a6a420d6b.sql`

```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'tech_spoc';
```

### 20251111111637 - Auto-Assign Guest Role on Signup
**File:** `20251111111637_cc5f2135-885f-4701-9447-51249510254f.sql`

```sql
CREATE OR REPLACE FUNCTION public.assign_guest_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_guest
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_guest_role_on_signup();
```

### 20251111045237 - Platform Admin Policies
**File:** `20251111045237_f543b20d-eb1d-42a8-9fbb-2f7c6ea58670.sql`

```sql
CREATE POLICY "Platform admins can view all roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Platform admins can manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Platform admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));
```

---

## 4. Learning System

### 20251010035234 - Learning & Training System
**File:** `20251010035234_4542336e-a23b-4cdf-8437-737da4fba5f3.sql`

```sql
-- Create training_plans table
CREATE TABLE public.training_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name TEXT NOT NULL,
  role_description TEXT,
  difficulty_level TEXT NOT NULL DEFAULT 'beginner',
  estimated_duration INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create training_topics table
CREATE TABLE public.training_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  subtopic TEXT,
  difficulty_level TEXT NOT NULL DEFAULT 'beginner',
  estimated_duration INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_materials table
CREATE TABLE public.learning_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_topic_id UUID NOT NULL REFERENCES public.training_topics(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL,
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
  status TEXT NOT NULL DEFAULT 'assigned',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, training_plan_id)
);

-- Create learning_assessments table
CREATE TABLE public.learning_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_plan_id UUID REFERENCES public.training_plans(id),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_count INTEGER DEFAULT 10,
  time_limit INTEGER DEFAULT 30,
  passing_score INTEGER DEFAULT 70,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_assessment_questions table
CREATE TABLE public.learning_assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT,
  options JSONB,
  correct_answer TEXT NOT NULL,
  hints TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_assessment_attempts table
CREATE TABLE public.learning_assessment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.learning_assessments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  candidate_name TEXT,
  candidate_email TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER,
  passed BOOLEAN,
  time_taken INTEGER,
  status TEXT DEFAULT 'in_progress',
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_assessment_feedback table
CREATE TABLE public.learning_assessment_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],
  detailed_feedback TEXT,
  topic_scores JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

---

## 5. Candidate Flow Security

### 20251010041543 - Fix Candidate RLS Policies
**File:** `20251010041543_81aef0c2-6342-4499-8a19-72b1eaa4c639.sql`

```sql
-- Allow anyone with a valid session token to insert their interview attempt
CREATE POLICY "Authenticated: Create attempts for active interviews" 
ON public.interview_attempts FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.interviews
    WHERE interviews.id = interview_attempts.interview_id
    AND interviews.status = 'active'
  )
);

-- Allow users to assign candidate role to themselves
CREATE POLICY "Users can self-assign candidate role" 
ON public.user_roles FOR INSERT 
WITH CHECK (auth.uid() = user_id AND role = 'candidate');
```

### 20251010060115 - Create Interview Attempt Function
**File:** `20251010060115_bc8305ec-20e8-4eed-b3a9-6475cf84e086.sql`

```sql
CREATE OR REPLACE FUNCTION public.create_interview_attempt(
  p_interview_id UUID,
  p_candidate_name TEXT,
  p_candidate_email TEXT
)
RETURNS TABLE(attempt_id UUID, session_token TEXT, success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
  v_interview_status TEXT;
  v_existing_attempt UUID;
BEGIN
  -- Validate inputs
  IF p_candidate_name IS NULL OR LENGTH(TRIM(p_candidate_name)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Name is required';
    RETURN;
  END IF;

  -- Validate interview exists and is active
  SELECT status INTO v_interview_status
  FROM public.interviews WHERE id = p_interview_id;

  IF v_interview_status IS NULL OR v_interview_status != 'active' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Interview not found or not active';
    RETURN;
  END IF;

  -- Check for existing attempt by this candidate
  SELECT id INTO v_existing_attempt
  FROM public.interview_attempts
  WHERE interview_id = p_interview_id AND candidate_email = p_candidate_email;

  IF v_existing_attempt IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'You have already taken this assessment.';
    RETURN;
  END IF;

  -- Generate session token
  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- Create attempt
  INSERT INTO public.interview_attempts (
    interview_id, candidate_name, candidate_email, status, session_token
  ) VALUES (
    p_interview_id, TRIM(p_candidate_name), TRIM(p_candidate_email), 'in_progress', v_session_token
  ) RETURNING id INTO v_attempt_id;

  RETURN QUERY SELECT v_attempt_id, v_session_token, TRUE, NULL::TEXT;
END;
$$;
```

---

## 6. Proctoring System

### 20251021054606 - Proctoring Tables
**File:** `20251021054606_7fefef10-ba11-4441-bee1-7e033706b797.sql`

```sql
-- Add proctoring settings to interviews table
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS proctoring_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS proctoring_settings JSONB DEFAULT '{
  "require_camera": true,
  "require_screen_share": true,
  "detect_multiple_persons": true,
  "detect_multiple_voices": true,
  "detect_tab_switches": true,
  "detect_multiple_monitors": true,
  "minimum_light_level": 0.3
}'::jsonb;

-- Create proctoring_sessions table
CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  learning_attempt_id UUID REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE,
  video_recording_url TEXT,
  screen_recording_url TEXT,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMP WITH TIME ZONE,
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
  integrity_score DECIMAL(5,2),
  flagged_for_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_attempt_id CHECK (
    (interview_attempt_id IS NOT NULL AND learning_attempt_id IS NULL) OR
    (interview_attempt_id IS NULL AND learning_attempt_id IS NOT NULL)
  )
);

-- Create storage bucket for proctoring recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proctoring-recordings', 'proctoring-recordings', false)
ON CONFLICT (id) DO NOTHING;
```

### 20251109012344 - Proctoring Session Enhancements
**File:** `20251109012344_cd4b8ce1-aeca-461b-8bd7-720c0ee5c9ba.sql`

```sql
ALTER TABLE proctoring_sessions 
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending' 
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'flagged')),
ADD COLUMN IF NOT EXISTS eye_movement_violations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS detailed_violations JSONB DEFAULT '[]'::jsonb;
```

### 20251108055220 - Enable Realtime for Proctoring
**File:** `20251108055220_a665cb8e-4795-4ad2-bb21-0052eb35c95e.sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_sessions;
```

---

## 7. Question Banks

### 20251021055230 - Question Bank Size
**File:** `20251021055230_4ef18638-70d3-4084-a2d6-bd34a3095b2b.sql`

```sql
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS question_bank_size INTEGER DEFAULT 1000;

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS used_in_attempts JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questions_interview_id_order 
ON public.questions(interview_id, order_index);
```

### 20251022003442 - Question Type Column
**File:** `20251022003442_33c01571-79de-4b3f-9542-0681c51f2dd2.sql`

```sql
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'descriptive' 
  CHECK (question_type IN ('mcq', 'scenario', 'coding', 'descriptive'));
```

### 20251024122328 - Get Questions for Attempt Function
**File:** `20251024122328_04312386-56f2-4de0-9a76-6b606f448f1d.sql`

```sql
-- Create table to track which questions were assigned to each attempt
CREATE TABLE IF NOT EXISTS public.attempt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id),
  UNIQUE(attempt_id, display_order)
);

-- Function to randomly select questions from the bank
CREATE OR REPLACE FUNCTION public.get_questions_for_attempt(p_attempt_id uuid)
RETURNS TABLE(
  id uuid, interview_id uuid, question_text text, topic text,
  difficulty text, question_type text, options jsonb, 
  order_index integer, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_interview_id uuid;
  v_question_count integer;
BEGIN
  SELECT ia.interview_id INTO v_interview_id
  FROM public.interview_attempts ia WHERE ia.id = p_attempt_id;

  SELECT i.question_count INTO v_question_count
  FROM public.interviews i WHERE i.id = v_interview_id;

  -- Check if questions already selected for this attempt
  IF EXISTS (SELECT 1 FROM public.attempt_questions WHERE attempt_id = p_attempt_id) THEN
    RETURN QUERY
    SELECT q.id, q.interview_id, q.question_text, q.topic, q.difficulty,
           q.question_type, q.options, aq.display_order as order_index, q.created_at
    FROM public.questions q
    INNER JOIN public.attempt_questions aq ON q.id = aq.question_id
    WHERE aq.attempt_id = p_attempt_id
    ORDER BY aq.display_order;
  ELSE
    -- Randomly select questions
    WITH selected_questions AS (
      SELECT q.id, ROW_NUMBER() OVER (ORDER BY RANDOM()) as display_order
      FROM public.questions q WHERE q.interview_id = v_interview_id
      ORDER BY RANDOM() LIMIT v_question_count
    )
    INSERT INTO public.attempt_questions (attempt_id, question_id, display_order)
    SELECT p_attempt_id, sq.id, sq.display_order FROM selected_questions sq;

    RETURN QUERY
    SELECT q.id, q.interview_id, q.question_text, q.topic, q.difficulty,
           q.question_type, q.options, aq.display_order as order_index, q.created_at
    FROM public.questions q
    INNER JOIN public.attempt_questions aq ON q.id = aq.question_id
    WHERE aq.attempt_id = p_attempt_id
    ORDER BY aq.display_order;
  END IF;
END;
$$;
```

---

## 8. Organizations & Partners

### 20251109175325 - Organizations System
**File:** `20251109175325_d27317a3-cdfb-4ae8-8b66-840786088c3c.sql`

```sql
-- Create subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('starter', 'professional', 'business', 'enterprise')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  max_users INTEGER NOT NULL DEFAULT 5,
  max_interviews INTEGER NOT NULL DEFAULT 100,
  max_ai_usage INTEGER NOT NULL DEFAULT 10000,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create organizations table
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
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create partner applications table
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL,
  organization_name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  organization_size TEXT,
  country TEXT,
  use_case TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create organization subscriptions table
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  interviews_used INTEGER DEFAULT 0,
  ai_usage_used INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- Create organization members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID,
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  interviews_conducted INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add organization_id to interviews table
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
```

### 20251109183831 - Fix Organization Members RLS
**File:** `20251109183831_7a1313c8-653f-4522-86e4-0afa4ed9db6d.sql`

```sql
-- Helper function to check org membership (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.user_is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  )
$$;
```

### 20251111140217 - Multi-Org Membership Check
**File:** `20251111140217_48d3cc5b-b341-4674-8996-b982f0f2a5f0.sql`

```sql
-- Function to check if user can join multiple organizations
CREATE OR REPLACE FUNCTION check_multi_org_membership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing_org_count INTEGER;
  is_platform_admin BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO existing_org_count
  FROM organization_members
  WHERE user_id = NEW.user_id AND status = 'active' AND organization_id != NEW.organization_id;
  
  IF existing_org_count > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = NEW.user_id AND role = 'platform_admin'
    ) INTO is_platform_admin;
    
    IF NOT is_platform_admin THEN
      RAISE EXCEPTION 'Only platform admins can be members of multiple organizations';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_org_membership
  BEFORE INSERT OR UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION check_multi_org_membership();
```

---

## 9. CPI - Candidate Performance Index

### 20251111073913 - CPI Table
**File:** `20251111073913_d3d56fc3-dcba-4253-b985-b2cf1da58c1a.sql`

```sql
CREATE TABLE IF NOT EXISTS public.candidate_performance_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  candidate_email TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  technical_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  problem_solving_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  topic_scores JSONB DEFAULT '{}',
  easy_correct INTEGER DEFAULT 0,
  easy_total INTEGER DEFAULT 0,
  medium_correct INTEGER DEFAULT 0,
  medium_total INTEGER DEFAULT 0,
  hard_correct INTEGER DEFAULT 0,
  hard_total INTEGER DEFAULT 0,
  integrity_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  violations_detected INTEGER DEFAULT 0,
  overall_cpi NUMERIC(5,2) NOT NULL DEFAULT 0,
  top_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  weak_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- UPDATED: 2025-12-27 - Allow both legacy and new hiring_recommendation values
  hiring_recommendation TEXT NOT NULL CHECK (hiring_recommendation IN 
    ('strongly_recommend', 'recommend', 'consider', 'not_recommended', 'strong_hire', 'hire', 'reject')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(attempt_id)
);

-- CPI calculation helper function
-- UPDATED: 2025-12-27 - Fixed table name and column names (key/value instead of config_key/config_value)
CREATE OR REPLACE FUNCTION public.calculate_cpi_score(
  p_technical_score NUMERIC,
  p_problem_solving_score NUMERIC,
  p_integrity_score NUMERIC
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
    (p_technical_score * v_technical_weight / 100) +
    (p_problem_solving_score * v_problem_solving_weight / 100) +
    (p_integrity_score * v_integrity_weight / 100)
  );
  RETURN ROUND(v_cpi, 2);
END;
$$;
```

---

## 10. ATS Integration

### 20251111081848 - ATS Integration Tables
**File:** `20251111081848_048cb245-9092-4396-99d1-e3eaefc69218.sql`

```sql
-- ATS Integrations table
CREATE TABLE IF NOT EXISTS public.ats_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ats_provider TEXT NOT NULL,
  api_key_encrypted TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  sync_enabled BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency INTEGER DEFAULT 3600,
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'inactive',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ATS Candidates table
CREATE TABLE IF NOT EXISTS public.ats_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ats_integrations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  resume_parsed JSONB,
  skills JSONB DEFAULT '[]'::jsonb,
  experience_years INTEGER,
  current_position TEXT,
  current_company TEXT,
  education JSONB DEFAULT '[]'::jsonb,
  source TEXT,
  applied_position TEXT,
  ats_status TEXT,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  attempt_id UUID REFERENCES public.interview_attempts(id) ON DELETE SET NULL,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(integration_id, external_id)
);

-- ATS Sync Logs
CREATE TABLE IF NOT EXISTS public.ats_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ats_integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  candidates_synced INTEGER DEFAULT 0,
  candidates_failed INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  details JSONB DEFAULT '{}'::jsonb
);

-- Bias Detection Results
CREATE TABLE IF NOT EXISTS public.bias_detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  bias_score NUMERIC NOT NULL DEFAULT 0,
  bias_indicators JSONB DEFAULT '[]'::jsonb,
  language_bias JSONB,
  cultural_bias JSONB,
  technical_bias JSONB,
  recommendations TEXT[],
  analysis_model TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Resume Parsing Results
CREATE TABLE IF NOT EXISTS public.resume_parsing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  resume_text TEXT,
  parsed_data JSONB NOT NULL,
  extracted_skills TEXT[],
  experience_years INTEGER,
  education_level TEXT,
  suggested_questions JSONB DEFAULT '[]'::jsonb,
  parsing_model TEXT NOT NULL,
  confidence_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 11. Collaboration & Analytics

### 20251111102912 - Collaboration & Analytics Tables
**File:** `20251111102912_0f93abdf-d2ee-4714-b5f6-fb62a63e3c06.sql`

```sql
-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('interview_status', 'candidate_submission', 'system_alert', 'proctoring_alert', 'report_ready')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID, p_organization_id UUID, p_type TEXT,
  p_title TEXT, p_message TEXT, p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, link, metadata)
  VALUES (p_user_id, p_organization_id, p_type, p_title, p_message, p_link, p_metadata)
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$;
```

### 20251111081848 - Interview Templates & Analytics
**File:** `20251111081848_048cb245-9092-4396-99d1-e3eaefc69218.sql`

```sql
-- Interview Templates Library
CREATE TABLE IF NOT EXISTS public.interview_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  role_type TEXT NOT NULL,
  seniority_level TEXT NOT NULL,
  question_distribution JSONB NOT NULL,
  difficulty_distribution JSONB NOT NULL,
  recommended_time_limit INTEGER NOT NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  usage_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Workflows
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  workflow_stage TEXT NOT NULL,
  current_approver UUID REFERENCES auth.users(id),
  approval_chain JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  deadline TIMESTAMPTZ,
  comments TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictive Analytics
CREATE TABLE IF NOT EXISTS public.predictive_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  model_type TEXT NOT NULL,
  analysis_period TSTZRANGE NOT NULL,
  predictions JSONB NOT NULL,
  accuracy_metrics JSONB,
  feature_importance JSONB,
  recommendations JSONB,
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comparative Analytics
CREATE TABLE IF NOT EXISTS public.comparative_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  comparison_type TEXT NOT NULL,
  entities JSONB NOT NULL,
  metrics JSONB NOT NULL,
  insights JSONB NOT NULL,
  visualization_data JSONB,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Templates
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  metrics TEXT[] NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  grouping TEXT[],
  visualization_config JSONB,
  schedule TEXT,
  recipients TEXT[],
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Reports
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.report_templates(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  report_data JSONB NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_by UUID REFERENCES auth.users(id),
  file_url TEXT,
  format TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collaboration Threads
CREATE TABLE IF NOT EXISTS public.collaboration_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES public.collaboration_threads(id),
  author_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  mentions UUID[],
  is_resolved BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Feed
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 12. AI Configuration

### 20251111143512 - AI Providers Configuration
**File:** `20251111143512_6ff63424-727d-484b-ad04-ad17e5a3ecd7.sql`

```sql
-- Table: ai_providers
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('openai', 'anthropic', 'google', 'perplexity', 'lovable')),
  base_url TEXT NOT NULL,
  supported_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: ai_provider_credentials
CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  model_preference TEXT,
  rate_limit_per_minute INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  test_status TEXT CHECK (test_status IN ('pending', 'success', 'failed')),
  test_error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: ai_feature_configurations
CREATE TABLE IF NOT EXISTS public.ai_feature_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE CHECK (feature_name IN (
    'skill_extraction', 'question_generation', 'interview_evaluation',
    'proctoring_analysis', 'resume_parsing', 'bias_detection',
    'learning_assessment_generation', 'learning_assessment_evaluation', 'code_execution'
  )),
  display_name TEXT NOT NULL,
  description TEXT,
  primary_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_provider_id UUID REFERENCES public.ai_providers(id),
  fallback_enabled BOOLEAN DEFAULT true,
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 60,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: ai_usage_logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  provider_id UUID REFERENCES public.ai_providers(id),
  model_used TEXT,
  request_tokens INTEGER,
  response_tokens INTEGER,
  total_cost_cents INTEGER,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default AI providers
INSERT INTO public.ai_providers (name, display_name, provider_type, base_url, supported_models, description) VALUES
  ('google-gemini', 'Google Gemini', 'google', 'https://generativelanguage.googleapis.com/v1', 
   '["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]'::jsonb,
   'Google Gemini AI models'),
  ('lovable-ai', 'Lovable AI Gateway', 'lovable', 'https://ai.gateway.lovable.dev/v1', 
   '["google/gemini-2.5-pro", "google/gemini-2.5-flash", "openai/gpt-5", "openai/gpt-5-mini"]'::jsonb,
   'Lovable AI Gateway - Pre-configured'),
  ('openai', 'OpenAI', 'openai', 'https://api.openai.com/v1',
   '["gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4o-mini"]'::jsonb,
   'OpenAI GPT models'),
  ('anthropic-claude', 'Anthropic Claude', 'anthropic', 'https://api.anthropic.com/v1',
   '["claude-sonnet-4-5", "claude-opus-4-1-20250805"]'::jsonb,
   'Anthropic Claude models');
```

### 20251111144808 - API Key Encryption
**File:** `20251111144808_7e57eff3-01ae-4b8f-8e83-7638cc3f92df.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pgsodium;

CREATE OR REPLACE FUNCTION public.encrypt_api_key(api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgsodium
AS $$
DECLARE
  encrypted_key TEXT;
  encryption_key_id UUID;
BEGIN
  SELECT id INTO encryption_key_id
  FROM pgsodium.valid_key WHERE name = 'api_key_encryption' LIMIT 1;
  
  IF encryption_key_id IS NULL THEN
    encryption_key_id := pgsodium.create_key(name := 'api_key_encryption');
  END IF;
  
  encrypted_key := encode(
    pgsodium.crypto_aead_det_encrypt(api_key::bytea, NULL::bytea, encryption_key_id::uuid, NULL::bytea),
    'base64'
  );
  
  RETURN encrypted_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgsodium
AS $$
DECLARE
  decrypted_key TEXT;
  encryption_key_id UUID;
BEGIN
  SELECT id INTO encryption_key_id
  FROM pgsodium.valid_key WHERE name = 'api_key_encryption' LIMIT 1;
  
  IF encryption_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  decrypted_key := convert_from(
    pgsodium.crypto_aead_det_decrypt(decode(encrypted_key, 'base64'), NULL::bytea, encryption_key_id::uuid, NULL::bytea),
    'UTF8'
  );
  
  RETURN decrypted_key;
END;
$$;

-- Trigger to auto-encrypt API keys
CREATE OR REPLACE FUNCTION public.encrypt_api_key_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.api_key_encrypted IS NOT NULL 
     AND NEW.api_key_encrypted !~ '^[A-Za-z0-9+/]+=*$' THEN
    NEW.api_key_encrypted := public.encrypt_api_key(NEW.api_key_encrypted);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_api_key_on_insert_update
  BEFORE INSERT OR UPDATE ON public.ai_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_api_key_trigger();
```

---

## 13. Notifications

### 20251111102912 - Notifications System
**File:** `20251111102912_0f93abdf-d2ee-4714-b5f6-fb62a63e3c06.sql`

```sql
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('interview_status', 'candidate_submission', 'system_alert', 'proctoring_alert', 'report_ready')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

---

## 14. Certifications

*(Full certification system migrations would be documented here - including certification_topics, certification_assessments, certification_attempts, certificates tables)*

---

## 15. Billing & Subscriptions

### 20251109192531 - Invoices Table
**File:** `20251109192531_b20b4532-0da0-4bec-8cd6-8eb835e8dd83.sql`

```sql
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled'))
);

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices WHERE invoice_number ~ '^INV-[0-9]+$';
  
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## 16. Platform Configuration

### 20251109050346 - Test Suites Table
**File:** `20251109050346_b4769e3a-9114-4e93-a872-11ca081a150f.sql`

```sql
-- Create onboarding_progress table
CREATE TABLE public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_dashboard BOOLEAN DEFAULT FALSE,
  created_interview BOOLEAN DEFAULT FALSE,
  shared_interview BOOLEAN DEFAULT FALSE,
  viewed_report BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create test management tables
CREATE TABLE public.test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('security', 'functionality', 'performance', 'integration', 'all')),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID REFERENCES public.test_suites(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  warnings INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  test_name TEXT NOT NULL,
  test_category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning', 'skipped')),
  execution_time_ms INTEGER,
  error_message TEXT,
  details JSONB,
  fix_recommendation TEXT,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 17. Invitations System

### 20251118071757 - Interview Invitations Table
**File:** `20251118071757_8435bbff-c058-4bee-96b7-3aefea777538.sql`

Creates the invitations system for controlled candidate access.

```sql
-- Create interview_invitations table
CREATE TABLE IF NOT EXISTS public.interview_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_email TEXT NOT NULL,
  candidate_name TEXT,
  share_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accessed', 'completed', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  accessed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX idx_interview_invitations_interview_id ON public.interview_invitations(interview_id);
CREATE INDEX idx_interview_invitations_share_token ON public.interview_invitations(share_token);
CREATE INDEX idx_interview_invitations_email ON public.interview_invitations(candidate_email);

-- Add invitation_id to interview_attempts
ALTER TABLE public.interview_attempts 
ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES public.interview_invitations(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interview_invitations
CREATE POLICY "Creators can view invitations" ON public.interview_invitations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
  )
);

CREATE POLICY "Creators can create invitations" ON public.interview_invitations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
  )
);

CREATE POLICY "Platform admins can manage invitations" ON public.interview_invitations
FOR ALL TO authenticated
USING (has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role]));

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    token := encode(gen_random_bytes(9), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := substring(token, 1, 12);
    
    SELECT EXISTS(SELECT 1 FROM interview_invitations WHERE share_token = token) INTO exists;
    
    IF NOT exists THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 20251118074006 - Invitation-Based Attempt Creation
**File:** `20251118074006_23e190cc-1ce6-431c-b7b6-7e88561478c2.sql`

Creates function for invitation-based attempt creation with validation.

```sql
-- Function to create attempt with invitation validation
CREATE OR REPLACE FUNCTION public.create_interview_attempt_with_invitation(
  p_invitation_id uuid,
  p_candidate_name text,
  p_candidate_email text
)
RETURNS TABLE(attempt_id uuid, session_token text, success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
  v_invitation RECORD;
  v_question_ids uuid[];
BEGIN
  -- Validate inputs
  IF p_candidate_name IS NULL OR LENGTH(TRIM(p_candidate_name)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Name is required';
    RETURN;
  END IF;

  -- Fetch and validate invitation
  SELECT * INTO v_invitation
  FROM public.interview_invitations
  WHERE id = p_invitation_id;

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Invalid invitation';
    RETURN;
  END IF;

  -- Validate email matches invitation
  IF LOWER(TRIM(p_candidate_email)) != LOWER(TRIM(v_invitation.candidate_email)) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email does not match invitation.';
    RETURN;
  END IF;

  -- Check if invitation already used
  IF v_invitation.status = 'completed' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'This invitation has already been used.';
    RETURN;
  END IF;

  -- Generate session token and create attempt
  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.interview_attempts (
    interview_id, invitation_id, candidate_name, candidate_email, status, session_token
  ) VALUES (
    v_invitation.interview_id, p_invitation_id, TRIM(p_candidate_name), TRIM(p_candidate_email), 'in_progress', v_session_token
  ) RETURNING id INTO v_attempt_id;

  -- Update invitation status
  UPDATE public.interview_invitations SET status = 'accessed', accessed_at = NOW() WHERE id = p_invitation_id;

  RETURN QUERY SELECT v_attempt_id, v_session_token, TRUE, NULL::TEXT;
END;
$$;

-- Trigger to complete invitation on submission
CREATE OR REPLACE FUNCTION public.complete_invitation_on_submission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'submitted' AND NEW.invitation_id IS NOT NULL 
     AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    UPDATE public.interview_invitations
    SET status = 'completed', completed_at = NOW()
    WHERE id = NEW.invitation_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_complete_invitation
  AFTER UPDATE ON public.interview_attempts
  FOR EACH ROW EXECUTE FUNCTION public.complete_invitation_on_submission();
```

### 20251123092818 - Delete Pending Invitations Policy
**File:** `20251123092818_3f83d87f-f773-4fae-8888-3e47fe71ec7d.sql`

```sql
-- Allow creators/org admins to delete invitations (only if status is 'pending')
CREATE POLICY "Creators can delete pending invitations" ON public.interview_invitations
FOR DELETE TO authenticated
USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_invitations.interview_id 
    AND (i.creator_id = auth.uid() OR user_is_org_admin(auth.uid(), i.organization_id))
  )
);
```

### 20251123114311 - Public Invitation SELECT Policy
**File:** `20251123114311_2075b934-0bfd-4b49-beba-6292d271fcb6.sql`

```sql
-- Allow candidates to access invitation via share_token without authentication
CREATE POLICY "Anyone can view invitation with valid share_token" ON public.interview_invitations
FOR SELECT
USING (
  share_token IS NOT NULL
  AND LENGTH(share_token) > 0
);
```

### 20251123172920 - Invitation Metadata Column
**File:** `20251123172920_92739fa8-c037-428b-ac5b-a25029b590d6.sql`

```sql
-- Add metadata column for storing selected question IDs per candidate
ALTER TABLE interview_invitations
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_interview_invitations_metadata ON interview_invitations USING gin(metadata);

COMMENT ON COLUMN interview_invitations.metadata IS 
'Stores additional invitation data including selected_question_ids array for personalized question sets per candidate';
```

---

## 18. AI Health Monitoring

### 20251112082512 - AI Health Monitoring Tables
**File:** `20251112082512_14c23b4c-8854-4cff-afc0-438a61cd402b.sql`

Creates comprehensive AI feature health monitoring system.

```sql
-- Table to store AI feature health status
CREATE TABLE IF NOT EXISTS public.ai_feature_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  current_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'failed', 'unknown')),
  last_check_at TIMESTAMPTZ DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  average_latency_ms INTEGER,
  is_enabled BOOLEAN DEFAULT true,
  auto_retry_enabled BOOLEAN DEFAULT true,
  max_retry_attempts INTEGER DEFAULT 3,
  fallback_model TEXT,
  fallback_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table to track health check history
CREATE TABLE IF NOT EXISTS public.ai_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('scheduled', 'manual', 'alert')),
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for admin alerts
CREATE TABLE IF NOT EXISTS public.ai_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('feature_down', 'high_failure_rate', 'slow_response', 'recovered')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table to track model performance for A/B testing
CREATE TABLE IF NOT EXISTS public.ai_model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  test_period_start TIMESTAMPTZ NOT NULL,
  test_period_end TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  average_latency_ms INTEGER,
  average_quality_score DECIMAL(3,2),
  cost_per_request_cents DECIMAL(10,4),
  is_active_test BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_feature_health_status ON public.ai_feature_health(status);
CREATE INDEX IF NOT EXISTS idx_ai_health_checks_feature ON public.ai_health_checks(feature_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_health_alerts_unacked ON public.ai_health_alerts(is_acknowledged, created_at DESC) WHERE NOT is_acknowledged;
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_feature ON public.ai_model_performance(feature_id, is_active_test);

-- Enable RLS
ALTER TABLE public.ai_feature_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies (platform admins only)
CREATE POLICY "Platform admins can view AI health"
  ON public.ai_feature_health FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE POLICY "Platform admins can manage AI health"
  ON public.ai_feature_health FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ai_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_feature_health_updated_at
  BEFORE UPDATE ON public.ai_feature_health
  FOR EACH ROW EXECUTE FUNCTION update_ai_health_updated_at();
```

---

## 19. Complete Migration File List

Below is the complete chronological list of all **185 migration files** (1 file may be a duplicate/empty placeholder):

| # | Date | File | Description |
|---|------|------|-------------|
| 1 | 2025-10-08 | 20251008011120_42c2e6eb-54f4-47d1-a23b-f449ec6c3b72.sql | Initial schema - profiles, interviews, questions, attempts |
| 2 | 2025-10-08 | 20251008012305_82cfeb36-7789-469c-9051-dbea62d092b9.sql | Security fix - session tokens, RLS policies |
| 3 | 2025-10-08 | 20251008012605_4a8e44fb-c357-44d2-83d8-a7790822cbf7.sql | Questions security view |
| 4 | 2025-10-08 | 20251008012629_45905748-9805-4a89-a037-a82d3c674912.sql | View security fix |
| 5 | 2025-10-08 | 20251008040034_a0a00949-f18b-49ea-8cc9-bbc2b1579665.sql | Session token validation |
| 6 | 2025-10-08 | 20251008040459_196eba76-2e31-47ad-aec1-096f11629875.sql | RLS policy updates |
| 7 | 2025-10-08 | 20251008040632_354355db-ba14-4044-b4af-98def82f4527.sql | Public interview access |
| 8 | 2025-10-08 | 20251008041932_1411c9b5-1db4-4af1-9e61-c967b7293d4e.sql | Time limit support |
| 9 | 2025-10-08 | 20251008043014_7182a5b9-ce1e-4f0f-9bd5-7417cbfd676b.sql | RBAC system |
| 10 | 2025-10-08 | 20251008043543_48aaa544-5daf-47fa-a0ce-2e567eb6be2c.sql | Documentation system |
| 11 | 2025-10-08 | 20251008044456_cda362b3-c756-42b9-b37f-4f2fa5fd4db8.sql | Profile policy fixes |
| 12 | 2025-10-08 | 20251008044643_27829ecb-56a7-4850-8160-246e060ec6e3.sql | Anonymous access blocks |
| 13 | 2025-10-08 | 20251008044745_e3b3f1e1-ef0c-4d46-8b24-41878444a467.sql | Comprehensive RLS |
| 14 | 2025-10-08 | 20251008045241_245712c3-48ad-416b-b6c8-ad2a8cdc9d35.sql | Defense-in-depth security |
| 15 | 2025-10-08 | 20251008050751_8b017f75-6912-44f8-bba1-0524a9089339.sql | Candidate interview flow |
| 16 | 2025-10-08 | 20251008051046_a71462a1-8459-4550-aaa5-0e9557098769.sql | Audit logging |
| 17 | 2025-10-08 | 20251008052430_324974f4-2450-4c51-84af-efa9e8c5ab03.sql | Final security lockdown |
| 18 | 2025-10-08 | 20251008052829_01ec3f8d-84e4-4e3a-b43f-a39d99208702.sql | Anonymous attempt creation |
| 19 | 2025-10-08 | 20251008055120_f1c2f7d8-87da-4eb8-9e9c-4f1fc8389ab4.sql | Pgcrypto extension |
| 20 | 2025-10-08 | 20251008055609_85bc669a-a5ff-4f49-b09d-1f63eee204c8.sql | Session token UUID |
| 21 | 2025-10-08 | 20251008060035_ab00a257-d9c1-47f3-8a80-e7ed7a243a74.sql | RLS policy consolidation |
| 22 | 2025-10-08 | 20251008062250_2ecfd7a5-018c-428c-904f-a8ac3d1d240d.sql | Public interview access |
| 23 | 2025-10-08 | 20251008063729_a06617a7-6784-4986-93d2-fb01fa2d2d1b.sql | Delete attempts policy |
| 24 | 2025-10-08 | 20251008071023_0f5892f2-16b6-4989-8cc0-082dff0a6aa1.sql | Assessments RLS fix |
| 25 | 2025-10-08 | 20251008073008_6b9dad55-ec12-4789-b969-40c62e6e482d.sql | Admin profile access |
| 26 | 2025-10-09 | 20251009042722_ec8ae555-9d4c-4ec0-a944-75aa6240bd71.sql | Candidate role |
| 27 | 2025-10-09 | 20251009043049_d9b05532-3a4f-41dd-8520-c4c714b3685a.sql | Public attempt view |
| 28 | 2025-10-10 | 20251010032744_3aa9a4e5-207e-443b-a648-f3834eb628b0.sql | Candidate interview policies |
| 29 | 2025-10-10 | 20251010033735_9d7ff536-2f2b-4925-9b5b-4e14a75c01e3.sql | Learning system |
| 30 | 2025-10-10 | 20251010035234_4542336e-a23b-4cdf-8437-737da4fba5f3.sql | Training plans |
| 31 | 2025-10-10 | 20251010041543_81aef0c2-6342-4499-8a19-72b1eaa4c639.sql | Fix candidate RLS policies |
| 32 | 2025-10-10 | 20251010042037_bf152062-1688-4330-98fd-03b26085aa6b.sql | Add guest role |
| 33 | 2025-10-10 | 20251010042050_1bbe4c7d-4049-4fe2-9d6c-eb1e39d5f27a.sql | Guest/candidate RLS |
| 34 | 2025-10-10 | 20251010042243_fd5d7f62-4e5d-49c1-b27d-78ef24d15305.sql | Guest vs candidate access |
| 35 | 2025-10-10 | 20251010053008_f4af1fb6-9b40-4d84-ba57-82e9b9b6b1a0.sql | Learning attempt columns |
| 36 | 2025-10-10 | 20251010053323_5a712571-3cc0-49f5-8041-e8189f70d017.sql | Public assessment access |
| 37 | 2025-10-10 | 20251010060115_bc8305ec-20e8-4eed-b3a9-6475cf84e086.sql | Create interview attempt function |
| 38 | 2025-10-10 | 20251010060441_5767ae90-2188-40c7-8424-9e42f2ee3110.sql | PII protection policies |
| 39 | 2025-10-12 | 20251012042852_189c56e6-4fb3-49df-a8f1-58a1c5de8653.sql | Update assessments status |
| 40 | 2025-10-12 | 20251012043139_e44a80d2-d8ed-4e96-831f-c19e1878d1f5.sql | Role-based assessment access |
| 41 | 2025-10-12 | 20251012053232_022bc3c6-af8f-47cd-9a5d-ca2053fea7d3.sql | Remove auth.users trigger |
| 42 | 2025-10-21 | 20251021054606_7fefef10-ba11-4441-bee1-7e033706b797.sql | Proctoring system |
| 43 | 2025-10-21 | 20251021055230_4ef18638-70d3-4084-a2d6-bd34a3095b2b.sql | Question bank size |
| 44 | 2025-10-22 | 20251022003442_33c01571-79de-4b3f-9542-0681c51f2dd2.sql | Question type column |
| 45 | 2025-10-24 | 20251024122328_04312386-56f2-4de0-9a76-6b606f448f1d.sql | Get questions for attempt |
| 46 | 2025-10-28 | 20251028092651_7cbf2e53-f4d6-4a2a-9f33-c9713ca84dbc.sql | Coding schema |
| 47 | 2025-10-29 | 20251029060827_08334ce5-a13c-4835-914c-91204563fa3b.sql | Generation status |
| 48 | 2025-11-05 | 20251105042304_c8366a8b-9026-46c5-8048-04da5245cc79.sql | Security fixes - assessment access |
| 49 | 2025-11-07 | 20251107035841_bcdb19e3-ca81-4932-af08-88ddfad22a6a.sql | Stricter policies |
| 50 | 2025-11-07 | 20251107040650_0108678a-5ba8-4da0-ab50-57666c90c719.sql | Proctoring RLS policies |
| 51 | 2025-11-07 | 20251107041116_c0c24d1f-b351-4d71-a81b-7c370e536d09.sql | Assessment score type |
| 52 | 2025-11-07 | 20251107041629_a41b9edc-46cb-48ab-86d5-35ab0fbb8d47.sql | Get interview for candidate function |
| 53 | 2025-11-08 | 20251108055220_a665cb8e-4795-4ad2-bb21-0052eb35c95e.sql | Proctoring realtime |
| 54 | 2025-11-08 | 20251108055234_6908147c-430d-4e26-8146-54eaead2dc14.sql | Proctoring replica identity |
| 55 | 2025-11-09 | 20251109012344_cd4b8ce1-aeca-461b-8bd7-720c0ee5c9ba.sql | Proctoring enhancements |
| 56 | 2025-11-09 | 20251109044106_42e89fc1-8c1a-49c3-af19-0aff6a57797a.sql | Storage policies fix |
| 57 | 2025-11-09 | 20251109050346_b4769e3a-9114-4e93-a872-11ca081a150f.sql | Onboarding & test suites |
| 58 | 2025-11-09 | 20251109052843_e256fb47-40eb-4b4b-845d-d85654c43f6e.sql | Test suite tables |
| 59 | 2025-11-09 | 20251109053131_332ed549-3bd6-466f-aa3b-d131fc7ebd3e.sql | RLS check helper |
| 60 | 2025-11-09 | 20251109175325_d27317a3-cdfb-4ae8-8b66-840786088c3c.sql | Organizations system |
| 61 | 2025-11-09 | 20251109175340_5c5e473e-db5d-44e3-9efb-39d2ac25f62a.sql | Organizations dummy migration |
| 62 | 2025-11-09 | 20251109183831_7a1313c8-653f-4522-86e4-0afa4ed9db6d.sql | Org members RLS fix |
| 63 | 2025-11-09 | 20251109192531_b20b4532-0da0-4bec-8cd6-8eb835e8dd83.sql | Invoices table |
| 64 | 2025-11-10 | 20251110155532_9e6bb018-60e0-49b9-8b4a-f7b1ff2806e7.sql | Proctoring recordings policy |
| 65 | 2025-11-11 | 20251111044454_dca60db5-4445-4f81-bdac-6e2ed50c0fe9.sql | New roles for partner system |
| 66 | 2025-11-11 | 20251111045237_f543b20d-eb1d-42a8-9fbb-2f7c6ea58670.sql | Platform admin policies |
| 67 | 2025-11-11 | 20251111051230_94ffaf76-6090-433e-88d3-6a26d2512c97.sql | Profile full_name fix |
| 68 | 2025-11-11 | 20251111060800_2ee2429e-fb2d-46e0-8671-e4a157d711c7.sql | Grant platform_admin |
| 69 | 2025-11-11 | 20251111073913_d3d56fc3-dcba-4253-b985-b2cf1da58c1a.sql | CPI table |
| 70 | 2025-11-11 | 20251111081848_048cb245-9092-4396-99d1-e3eaefc69218.sql | ATS & templates |
| 71 | 2025-11-11 | 20251111102912_0f93abdf-d2ee-4714-b5f6-fb62a63e3c06.sql | Notifications |
| 72 | 2025-11-11 | 20251111103911_d54e41dd-9909-4554-8710-f42d940a0d15.sql | Role migration |
| 73 | 2025-11-11 | 20251111111409_2c012c9b-9eb5-4461-ad1d-cd2a6a420d6b.sql | Tech SPOC role |
| 74 | 2025-11-11 | 20251111111420_31da7a5f-39f2-4f43-8a02-2288fe8ee73c.sql | ta_creator to tech_spoc |
| 75 | 2025-11-11 | 20251111111637_cc5f2135-885f-4701-9447-51249510254f.sql | Auto-assign guest role |
| 76 | 2025-11-11 | 20251111114059_fc7293ff-93c9-4060-847d-802e1527a618.sql | Partner application columns |
| 77 | 2025-11-11 | 20251111115356_75cbee63-a937-4977-87f4-2e138580b501.sql | Partner update policy |
| 78 | 2025-11-11 | 20251111120018_a3d84969-9006-4dd3-ab98-f89f3341da14.sql | Partner status constraint |
| 79 | 2025-11-11 | 20251111122949_a87f866d-b0ab-4a4b-99c0-027fa7668972.sql | Org members FK to profiles |
| 80 | 2025-11-11 | 20251111140217_48d3cc5b-b341-4674-8996-b982f0f2a5f0.sql | Multi-org check |
| 81 | 2025-11-11 | 20251111143512_6ff63424-727d-484b-ad04-ad17e5a3ecd7.sql | AI providers config |
| 82 | 2025-11-11 | 20251111144808_7e57eff3-01ae-4b8f-8e83-7638cc3f92df.sql | API key encryption |
| 83 | 2025-11-11 | 20251111150920_3ea39df9-31dc-4e62-89e1-725eacb1f9a1.sql | Interview create policy |
| 84 | 2025-11-11 | 20251111151043_0c8f4210-5873-4d26-9a63-1eb888fea5e5.sql | Interview update/delete policies |
| 85 | 2025-11-11 | 20251111155132_6207cc06-08c7-40c7-8de8-3f9a132aefdb.sql | Template is_active |
| 86 | 2025-11-11 | 20251111161205_9fbc9d36-8969-4115-91d4-3e07791a5336.sql | Auto set interview org |
| 87 | 2025-11-11 | 20251111161831_a5a4baf0-8f09-4454-836a-413fb01c3547.sql | Usage tracking column |
| 88 | 2025-11-11 | 20251111161849_5202eb8a-7eb3-4ae6-9465-81a5a0b1095d.sql | Usage tracking unique constraint |
| 89 | 2025-11-11 | 20251111165443_790206db-59ec-4afc-b6ee-5bbf928b487c.sql | Question bank size fix |
| 90 | 2025-11-11 | 20251111170736_69ff680a-6b34-4317-bd2e-f77b390d526b.sql | Proctoring sessions RLS |
| 91 | 2025-11-11 | 20251111170800_d52251c3-8605-4ba2-b555-da5cbc71c751.sql | Proctoring sessions anon insert policy |
| 92 | 2025-11-11 | 20251111171007_ef02cd41-fdd9-4fc7-9924-f699b9401075.sql | Proctoring sessions anon select/update policies |
| 93 | 2025-11-11 | 20251111173427_5918035b-5cd8-4a87-a472-22ad9edc5dfd.sql | Auto-evaluate interview function via pg_net |
| 94 | 2025-11-11 | 20251111173450_7d58943d-8a73-4269-b7fa-c2e7523f1e5d.sql | System config table for auto-evaluation |
| 95 | 2025-11-11 | 20251111173517_7c8cae55-f224-40f8-82b4-21bc23ad8c84.sql | Auto-evaluate with anon key |
| 96 | 2025-11-11 | 20251111173744_6201c09f-bef1-4698-87bb-60eff45c6c14.sql | Role permissions table |
| 97 | 2025-11-11 | 20251111181255_bc34e28e-a3c6-4c26-9e4a-11dfe8112183.sql | Auto-close expired proctoring sessions function |
| 98 | 2025-11-11 | 20251111182106_e5db1d1c-7be0-4638-9e38-f0b96a94867d.sql | Security fix - remove public upload, database trigger |
| 99 | 2025-11-11 | 20251111195047_f33c474c-61be-49db-b5d7-44d4247f6bbd.sql | Chatbot knowledge base table |
| 100 | 2025-11-12 | 20251112040414_b91b81fe-2edd-41dc-80b1-0c43edde56e3.sql | Learning assessment submission RLS fix |
| 101 | 2025-11-12 | 20251112040724_2efd9836-835f-4c46-82d9-4f9854936f08.sql | Learning assessment schema fixes |
| 102 | 2025-11-12 | 20251112044915_89028b6f-2222-4585-abe4-80a02d66b4d2.sql | Learning subscriptions & payments tables |
| 103 | 2025-11-12 | 20251112071603_55f7ba4e-473b-4e22-8fab-fe3a16247807.sql | Certificate badges & achievement system |
| 104 | 2025-11-12 | 20251112075715_c09e0a97-270e-4ac6-a67d-9760ec2c65c2.sql | Proctoring settings table |
| 105 | 2025-11-12 | 20251112081121_ad2b0757-d6ad-4756-97cd-04df171fea9e.sql | Certification attempt proctoring FK |
| 106 | 2025-11-12 | 20251112082512_14c23b4c-8854-4cff-afc0-438a61cd402b.sql | AI feature health monitoring tables |
| 107 | 2025-11-12 | 20251112094554_2eabd0cc-7f3a-4a95-8e64-ebae6fb20843.sql | Fix all SECURITY DEFINER functions |
| 108 | 2025-11-12 | 20251112133338_c1aadf37-0418-4cee-a15a-bad76d0aee86.sql | Platform documentation table |
| 109 | 2025-11-12 | 20251112141938_f1af772d-09f1-405a-9c59-7beccbfe0f71.sql | Documentation versions table |
| 110 | 2025-11-13 | 20251113055251_5a4ae670-12a2-42b4-a1b5-885088473624.sql | Subscription plans display_order |
| 111 | 2025-11-13 | 20251113055515_34b27015-2c9e-46b2-a760-130a102777c6.sql | Certification topics provider column |
| 112 | 2025-11-13 | 20251113072551_ceaadc17-2c95-407a-9ef6-81301df2df8b.sql | check_user_exists function |
| 113 | 2025-11-13 | 20251113072606_6bd54a21-7865-4f50-9037-60df30bdba0a.sql | check_user_exists search_path fix |
| 114 | 2025-11-15 | 20251115100342_8d221cb3-9c91-405f-a51e-5a0b8fc8efab.sql | Org slug, partner review_notes |
| 115 | 2025-11-15 | 20251115143136_e18ec417-211c-42c3-b32a-b51452015239.sql | Organization-based RLS policies |
| 116 | 2025-11-15 | 20251115143308_50f9f15c-2f17-48fe-84cb-7c2f3e261b10.sql | Platform admin test_suites policies |
| 117 | 2025-11-15 | 20251115144011_058fa5df-1a53-4d42-b698-8c81a9788b95.sql | Role-based test suites update |
| 118 | 2025-11-15 | 20251115153604_545fcad9-8f37-418c-8dec-475544c82028.sql | Subscription usage trigger |
| 119 | 2025-11-15 | 20251115181327_15152b26-b12d-4984-8d84-02d68f482ffe.sql | Platform config table |
| 120 | 2025-11-17 | 20251117092346_d6a8f8dc-979c-4114-98d6-6d7ec4b187be.sql | Email & password setup config |
| 121 | 2025-11-17 | 20251117095353_271847fb-cb78-4057-9023-14a8fbd628d4.sql | Default configuration values |
| 122 | 2025-11-17 | 20251117105659_6a71bcfb-d8d2-4fb3-b026-9959176d71d5.sql | platform_configurations table |
| 123 | 2025-11-17 | 20251117111053_9c7d5d1b-e0d9-4a6b-a28f-331c015dad6b.sql | Drop legacy config tables |
| 124 | 2025-11-18 | 20251118052313_431be3e3-5ec0-4ac6-995c-a2ba345518b3.sql | System organization for platform admins |
| 125 | 2025-11-18 | 20251118061414_15edf466-e66e-4a5a-aa15-4558ab0b0e04.sql | Auto-add platform admin to system org |
| 126 | 2025-11-18 | 20251118065708_7b60eff1-a149-4d19-bc79-eeb84c17d668.sql | Role hierarchy RLS implementation |
| 127 | 2025-11-18 | 20251118070316_943f9b1d-0c1c-4144-9f48-295f0a7af849.sql | Standardize all RLS to use hierarchy |
| 128 | 2025-11-18 | 20251118070424_e95cbfdd-0b0e-4352-8f6b-e09015abd05c.sql | Fix candidate access - email-based |
| 129 | 2025-11-18 | 20251118071757_8435bbff-c058-4bee-96b7-3aefea777538.sql | interview_invitations table |
| 130 | 2025-11-18 | 20251118074006_23e190cc-1ce6-431c-b7b6-7e88561478c2.sql | create_interview_attempt_with_invitation function |
| 131 | 2025-11-18 | 20251118162759_6d14f1b9-54b2-4297-9ab5-8bb0499c4832.sql | Backfill profiles for auth users |
| 132 | 2025-11-18 | 20251118165516_7b22ed49-38f5-4fb7-8376-5a9288b1f7c7.sql | Fix ATS, payment, retention policies |
| 133 | 2025-11-18 | 20251118174847_916214f8-0544-4c8c-b745-feef94eded1d.sql | Interview RLS with new role names |
| 134 | 2025-11-18 | 20251118183042_a11b4d56-2d94-4af7-8023-0c29954b6762.sql | Simplified non-recursive interview RLS |
| 135 | 2025-11-23 | 20251123092818_3f83d87f-f773-4fae-8888-3e47fe71ec7d.sql | Delete pending invitations policy |
| 136 | 2025-11-23 | 20251123114311_2075b934-0bfd-4b49-beba-6292d271fcb6.sql | Public invitation SELECT policy |
| 137 | 2025-11-23 | 20251123172920_92739fa8-c037-428b-ac5b-a25029b590d6.sql | Invitation metadata column |
| 138 | 2025-11-24 | 20251124045205_7be7d1af-61b0-4a05-b4a7-31d5737813f1.sql | Increment interviews_used trigger |
| 139 | 2025-11-24 | 20251124045648_ee848907-f299-4b6f-a8f3-462d250895e3.sql | Auto-evaluate interview trigger |
| 140 | 2025-11-24 | 20251124092503_267c0731-4c01-43ee-8d81-a1e93f429969.sql | Documentation AI generation columns |
| 141 | 2025-11-24 | 20251124122529_90698649-cd1e-46ee-be07-dc6e34f6fa82.sql | Certification assessments & attempts tables |
| 142 | 2025-11-25 | 20251125035602_a7a8372f-6412-44b9-b4f4-e3d940e9e602.sql | Remove platform admin auto-assign trigger |
| 143 | 2025-11-26 | 20251126104527_aeae098d-97e6-48ce-b0f3-f0483fe3d8ca.sql | Allow guest role trigger on signup |
| 144 | 2025-11-26 | 20251126105342_d17aab01-850d-45e9-a385-0793319454c4.sql | Audit logs FK to SET NULL |
| 145 | 2025-11-26 | 20251126140815_8cbd13e0-3936-45da-b015-52b83b29a277.sql | Remove auth.users triggers |
| 146 | 2025-11-27 | 20251127002311_82d3ad9d-72f9-4780-b02c-f3c7e66fe9f2.sql | Auto-close proctoring on submission |
| 147 | 2025-11-27 | 20251127105148_b3209f1e-61fe-49de-9202-e882a5b9a027.sql | Partner admin profile view policy |
| 148 | 2025-11-27 | 20251127115223_af8b0247-eacb-4897-b710-87c017bdb718.sql | Partner admin roles view policy |
| 149 | 2025-11-28 | 20251128002626_f6f0be72-4be3-43f1-b43f-377afd8ed3de.sql | architecture_documents table with diagrams |
| 150 | 2025-11-28 | 20251128003255_665c3043-dd40-44b7-a501-4a23f88edf15.sql | Architecture docs helper functions |
| 151 | 2025-11-30 | 20251130104142_f94e8000-5a07-4af0-83e8-8b465274e2f9.sql | Questions coding_schema column |
| 152 | 2025-12-08 | 20251208043417_ab9bddc2-c023-4faa-bc2d-9336e0bcb58c.sql | Proctoring audio_transcription column |
| 153 | 2025-12-08 | 20251208091324_375cbfd7-e645-4f68-89ec-1b84c2532c56.sql | Interview skill_domain column |
| 154 | 2025-12-08 | 20251208092112_1b0b86ea-cdff-488c-9230-4b30ed6f400c.sql | Questions allowed_languages column |
| 155 | 2025-12-09 | 20251209052900_b79f2b1b-8f0a-408d-8178-883a469d3303.sql | learning_plans table |
| 156 | 2025-12-09 | 20251209062635_1fb136cc-396e-41fb-a566-4e10f2c3f534.sql | payment_gateways table |
| 157 | 2025-12-09 | 20251209074741_86a2bc79-a7d3-46b9-93a8-d5bcee386949.sql | Slug columns and generators |
| 158 | 2025-12-09 | 20251209081819_bcdb645d-7ef4-4fe9-82a0-9a251a0ec6bb.sql | Fix remaining RLS policies |
| 159 | 2025-12-09 | 20251209082131_6ab564a9-a02a-467d-b59d-08c952a41596.sql | subscription_plans FOR ALL policy |
| 160 | 2025-12-09 | 20251209082241_49cbcab4-8853-4dd8-9109-2aaf9dd8d1d2.sql | Remove old plans policy |
| 161 | 2025-12-09 | 20251209113510_5b8127f0-249b-434a-8ffd-5a5c096d3b87.sql | Storage proctoring recordings policies |
| 162 | 2025-12-09 | 20251209114658_c1357dd8-933b-4437-966d-005c09bc153e.sql | pending_upload status + finalize function |
| 163 | 2025-12-09 | 20251209115532_c20445bf-1336-46f3-a48a-bec75f55a03c.sql | Secure proctoring session policies |
| 164 | 2025-12-09 | 20251209120442_ef9fe498-2a4a-4a7c-95b4-8e78652614b0.sql | Public proctoring session INSERT/UPDATE |
| 165 | 2025-12-09 | 20251209121429_1310bdeb-be2b-4a79-bc86-2647ddc04ad2.sql | Public proctoring session SELECT |
| 166 | 2025-12-10 | 20251210124623_c7bb2d5b-1435-4aa0-a1c4-12930b6bd3f8.sql | Periodic screenshots columns |
| 167 | 2025-12-10 | 20251210125329_7f743e2b-e35e-4689-80e1-f1e79e8174cb.sql | Auto-evaluate with video analysis flag |
| 168 | 2025-12-11 | 20251211111558_3a6610ba-e246-4d73-bdc5-783ed8b813ca.sql | terminate_attempt_with_session function |
| 169 | 2025-12-11 | 20251211164723_bb5cc3a1-df21-4d69-bcf0-92fd88a1c1ea.sql | Upload tracking columns |
| 170 | 2025-12-14 | 20251214052125_85cd6c00-1ec6-4d4a-8912-adc144e6ec42.sql | Per-violation proctoring scores |
| 171 | 2025-12-14 | 20251214055535_dd5fb084-c8e0-429e-909c-e4d325b72791.sql | Periodic screenshot timestamps column |

---

## Security Considerations

1. **All tables have Row Level Security (RLS) enabled**
2. **Sensitive data (correct_answer) is protected via secure RPC functions**
3. **Session tokens are used for candidate authentication**
4. **Platform uses defense-in-depth approach**
5. **API keys are encrypted using pgsodium**
6. **Multi-organization membership restricted to platform admins**

## Role Hierarchy

```
platform_admin > partner_admin > hr_recruiter > tech_spoc > interviewer > contributor > candidate > guest
```

## Key Security Functions

- `has_role(user_id, role)` - Check single role
- `has_any_role(user_id, roles[])` - Check multiple roles
- `has_any_role_with_hierarchy(user_id, roles[])` - Check with hierarchy
- `user_is_org_member(user_id, org_id)` - Check org membership
- `user_is_org_admin(user_id, org_id)` - Check org admin status
- `can_access_org_data(user_id, org_id)` - Check org data access
- `get_questions_for_attempt(attempt_id)` - Safe question access
- `update_attempt_with_session(token, answers, time)` - Secure submission
- `encrypt_api_key(key)` / `decrypt_api_key(encrypted)` - API key encryption

---

*Last Updated: 2025-12-21*
*Total Migrations: 171*
