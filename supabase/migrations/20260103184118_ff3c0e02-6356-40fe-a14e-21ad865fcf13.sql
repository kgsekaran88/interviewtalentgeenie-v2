-- Allow HR recruiters to view tech_spoc roles in their organization
CREATE POLICY "HR recruiters can view org tech spoc roles"
ON public.user_roles
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'hr_recruiter'::app_role) 
  AND role = 'tech_spoc'::app_role
  AND organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
  )
);