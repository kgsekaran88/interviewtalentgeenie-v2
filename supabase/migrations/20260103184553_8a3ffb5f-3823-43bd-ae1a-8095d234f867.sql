-- Allow HR recruiters to view profiles of users in their organizations
CREATE POLICY "HR recruiters can view org member profiles"
ON public.profiles
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'hr_recruiter'::app_role)
  AND id IN (
    SELECT om.user_id
    FROM organization_members om
    WHERE om.organization_id IN (
      SELECT organization_members.organization_id
      FROM organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
    AND om.status = 'active'
  )
);
