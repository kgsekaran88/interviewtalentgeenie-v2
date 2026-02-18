-- Drop and recreate the interviews UPDATE policy without ta_creator (legacy role)

DROP POLICY IF EXISTS "interviews_update_policy" ON public.interviews;

CREATE POLICY "interviews_update_policy" ON public.interviews
FOR UPDATE
USING (
  -- Creator can always update their own interviews
  (creator_id = auth.uid())
  -- Platform admin has full access
  OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  -- Org admin can update org interviews
  OR ((organization_id IS NOT NULL) AND user_is_org_admin(auth.uid(), organization_id))
  -- HR recruiter can update interviews in their org
  OR (
    (organization_id IS NOT NULL) 
    AND user_is_org_member(auth.uid(), organization_id)
    AND has_any_role(auth.uid(), ARRAY['hr_recruiter'::app_role, 'partner_admin'::app_role])
  )
);