-- Add UPDATE policy for interviews so creators can update their interviews
CREATE POLICY "Creators can update interviews"
ON public.interviews
FOR UPDATE
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);