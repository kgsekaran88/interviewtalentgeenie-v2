-- Remove overly permissive policies on email_templates
DROP POLICY IF EXISTS "Authenticated users can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;

-- Keep existing good policies:
-- "Platform admins can manage all templates" - already exists (ALL access)
-- "Org admins can manage org templates" - already exists (for org-specific templates)
-- "Service role can read all templates" - already exists

-- Add SELECT policy for Partner admins and HR recruiters
CREATE POLICY "Partner admins and HR can view templates" ON public.email_templates
FOR SELECT
USING (
  has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role, 'partner_admin'::app_role, 'hr_recruiter'::app_role])
);