-- Add RLS policy for tech_spoc to view profile of users who requested reviews from them
CREATE POLICY "Tech SPOC can view profiles of review requesters"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tech_spoc'::app_role) AND (
    id IN (
      SELECT interviews.creator_id
      FROM interviews
      WHERE interviews.tech_spoc_reviewer_id = auth.uid()
    )
  )
);