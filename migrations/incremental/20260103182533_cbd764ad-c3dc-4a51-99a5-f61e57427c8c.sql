-- Update RLS policies to align with frontend expectations for HR Recruiter and Tech SPOC

-- 1. QUESTIONS: Allow hr_recruiter and tech_spoc to update questions in their org
DROP POLICY IF EXISTS "Creators only: Update own questions" ON public.questions;
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

-- 2. INTERVIEW_INVITATIONS: Allow hr_recruiter to update invitations in their org
DROP POLICY IF EXISTS "Creators can update invitations" ON public.interview_invitations;
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

-- 3. INTERVIEW_ATTEMPTS: Allow hr_recruiter to update attempts in their org
DROP POLICY IF EXISTS "interview_attempts_update_policy" ON public.interview_attempts;

CREATE POLICY "interview_attempts_update_policy" ON public.interview_attempts
FOR UPDATE
USING (
  -- Platform admin has full access
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  -- Creator can update attempts for their interviews
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_attempts.interview_id
    AND i.creator_id = auth.uid()
  )
  -- HR recruiter can update attempts in their org
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_attempts.interview_id
    AND i.organization_id IS NOT NULL
    AND user_is_org_member(auth.uid(), i.organization_id)
    AND has_any_role(auth.uid(), ARRAY['hr_recruiter'::app_role, 'partner_admin'::app_role])
  )
  -- Candidate updating their own attempt (existing behavior)
  OR (session_token IS NOT NULL AND status = 'in_progress')
);

-- 4. ASSESSMENTS: Allow hr_recruiter to update assessments in their org
DROP POLICY IF EXISTS "assessments_update_policy" ON public.assessments;

CREATE POLICY "assessments_update_policy" ON public.assessments
FOR UPDATE
USING (
  -- Platform admin has full access
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  -- HR recruiter can update assessments in their org
  OR EXISTS (
    SELECT 1 FROM interview_attempts ia
    JOIN interviews i ON i.id = ia.interview_id
    WHERE ia.id = assessments.attempt_id
    AND i.organization_id IS NOT NULL
    AND user_is_org_member(auth.uid(), i.organization_id)
    AND has_any_role(auth.uid(), ARRAY['hr_recruiter'::app_role, 'partner_admin'::app_role])
  )
  -- Creator can update assessments for their interviews
  OR EXISTS (
    SELECT 1 FROM interview_attempts ia
    JOIN interviews i ON i.id = ia.interview_id
    WHERE ia.id = assessments.attempt_id
    AND i.creator_id = auth.uid()
  )
);