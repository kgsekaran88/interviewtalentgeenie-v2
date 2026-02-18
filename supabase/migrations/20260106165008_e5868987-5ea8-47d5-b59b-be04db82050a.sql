-- Drop overly permissive policies on candidate_performance_index
DROP POLICY IF EXISTS "Authenticated users can view candidate performance" ON public.candidate_performance_index;
DROP POLICY IF EXISTS "Authenticated users can insert candidate performance" ON public.candidate_performance_index;
DROP POLICY IF EXISTS "Authenticated users can update candidate performance" ON public.candidate_performance_index;

-- The remaining policies are properly scoped:
-- 1. "Creators and admins can view CPI" - checks interview ownership/roles
-- 2. "Org admins can view org CPI" - checks org membership
-- 3. "candidate_performance_index_select_policy" - checks platform_admin or interview access
-- 4. "candidate_performance_index_manage_policy" - platform_admin only for ALL operations
-- 5. "Service role can manage CPI" - service role bypass (needed for edge functions)

-- Add INSERT policy for authorized users only (interview creators and admins)
CREATE POLICY "Authorized users can insert CPI" ON public.candidate_performance_index
FOR INSERT
WITH CHECK (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_id
    AND (
      i.creator_id = auth.uid()
      OR has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
    )
  )
);

-- Add UPDATE policy for authorized users only
CREATE POLICY "Authorized users can update CPI" ON public.candidate_performance_index
FOR UPDATE
USING (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_id
    AND (
      i.creator_id = auth.uid()
      OR has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
    )
  )
)
WITH CHECK (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.id = interview_id
    AND (
      i.creator_id = auth.uid()
      OR has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role])
    )
  )
);