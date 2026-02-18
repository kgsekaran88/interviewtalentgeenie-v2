-- Allow authenticated users to read questions for interviews they are allowed to read
-- This delegates access control to the existing RLS policies on public.interviews.
CREATE POLICY "Authenticated users can view interview questions"
ON public.questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.interviews i
    WHERE i.id = questions.interview_id
  )
);