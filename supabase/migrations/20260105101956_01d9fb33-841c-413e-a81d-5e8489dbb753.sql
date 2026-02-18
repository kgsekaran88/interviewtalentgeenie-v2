-- Fix RLS for email_templates table
-- Drop existing permissive policies if any
DROP POLICY IF EXISTS "Email templates are viewable by everyone" ON public.email_templates;
DROP POLICY IF EXISTS "Anyone can view email templates" ON public.email_templates;

-- Create proper RLS policies for email_templates
CREATE POLICY "Authenticated users can view email templates"
ON public.email_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage email templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix RLS for candidate_performance_index table
-- Drop existing permissive policies if any
DROP POLICY IF EXISTS "Anyone can view candidate performance" ON public.candidate_performance_index;
DROP POLICY IF EXISTS "Candidate performance is publicly viewable" ON public.candidate_performance_index;
DROP POLICY IF EXISTS "Public read access for candidate_performance_index" ON public.candidate_performance_index;

-- Create proper RLS policies for candidate_performance_index
-- Only authenticated users can view candidate data
CREATE POLICY "Authenticated users can view candidate performance"
ON public.candidate_performance_index
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert candidate performance"
ON public.candidate_performance_index
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update candidate performance"
ON public.candidate_performance_index
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);