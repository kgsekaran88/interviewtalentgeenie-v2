
-- Drop all existing interviews policies to consolidate
DROP POLICY IF EXISTS "Creators can delete interviews" ON public.interviews;
DROP POLICY IF EXISTS "interviews_delete_policy" ON public.interviews;
DROP POLICY IF EXISTS "Authenticated users can create interviews" ON public.interviews;
DROP POLICY IF EXISTS "interviews_insert_policy" ON public.interviews;
DROP POLICY IF EXISTS "Org members can view org interviews" ON public.interviews;
DROP POLICY IF EXISTS "Users can view own and org interviews" ON public.interviews;
DROP POLICY IF EXISTS "Users can view their own interviews" ON public.interviews;
DROP POLICY IF EXISTS "interviews_select_policy" ON public.interviews;
DROP POLICY IF EXISTS "Creators can update interviews" ON public.interviews;
DROP POLICY IF EXISTS "interviews_update_policy" ON public.interviews;

-- SELECT: Users can view interviews they created, from their org, or if platform_admin
CREATE POLICY "interviews_select_policy" ON public.interviews
FOR SELECT USING (
  -- Platform admins can see everything
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR
  -- Creator can see their own interviews
  (creator_id = auth.uid())
  OR
  -- Org members can see their org's interviews
  (organization_id IS NOT NULL AND user_is_org_member(auth.uid(), organization_id))
);

-- INSERT: Users can create interviews for themselves or their org
CREATE POLICY "interviews_insert_policy" ON public.interviews
FOR INSERT WITH CHECK (
  -- Platform admins can create for any org
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR
  -- User must be the creator
  (auth.uid() = creator_id AND auth.uid() IS NOT NULL)
);

-- UPDATE: Creator, org members with roles, or platform_admin can update
CREATE POLICY "interviews_update_policy" ON public.interviews
FOR UPDATE USING (
  -- Platform admins can update everything
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR
  -- Creator can update their own
  (creator_id = auth.uid())
  OR
  -- Org members with appropriate roles can update their org's interviews
  (
    organization_id IS NOT NULL 
    AND user_is_org_member(auth.uid(), organization_id)
    AND has_any_role(auth.uid(), ARRAY['partner_admin'::app_role, 'hr_recruiter'::app_role, 'ta_creator'::app_role])
  )
);

-- DELETE: Creator or platform_admin can delete
CREATE POLICY "interviews_delete_policy" ON public.interviews
FOR DELETE USING (
  -- Platform admins can delete everything
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
  OR
  -- Creator can delete their own
  (creator_id = auth.uid())
  OR
  -- Org admins can delete their org's interviews
  (organization_id IS NOT NULL AND user_is_org_admin(auth.uid(), organization_id))
);
