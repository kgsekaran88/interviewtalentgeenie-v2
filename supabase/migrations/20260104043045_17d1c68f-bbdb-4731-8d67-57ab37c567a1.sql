-- Make creator_id nullable to support untagging on user deletion
ALTER TABLE public.interviews 
ALTER COLUMN creator_id DROP NOT NULL;

-- Add comment explaining why nullable
COMMENT ON COLUMN public.interviews.creator_id IS 'Creator user ID. Can be null if original creator account was deleted.';

-- Update RLS policies to handle null creator_id
DROP POLICY IF EXISTS "Users can view their own interviews" ON public.interviews;
CREATE POLICY "Users can view their own interviews" 
ON public.interviews 
FOR SELECT 
USING (
  creator_id = auth.uid() 
  OR (organization_id IS NOT NULL AND can_access_org_data(auth.uid(), organization_id))
  OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
);

-- Ensure orphaned interviews (null creator) are still accessible to org members
DROP POLICY IF EXISTS "Org members can view org interviews" ON public.interviews;
CREATE POLICY "Org members can view org interviews" 
ON public.interviews 
FOR SELECT 
USING (
  organization_id IS NOT NULL AND can_access_org_data(auth.uid(), organization_id)
);