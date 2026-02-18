-- Add experience level and years tracking to interviews
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS experience_level text,
ADD COLUMN IF NOT EXISTS min_years_experience integer;

-- Add comments for documentation
COMMENT ON COLUMN public.interviews.experience_level IS 'Experience level: intern, junior, mid, senior, lead, principal';
COMMENT ON COLUMN public.interviews.min_years_experience IS 'Minimum years of experience required for the role';

-- Create index for filtering by experience level
CREATE INDEX IF NOT EXISTS idx_interviews_experience_level ON public.interviews(experience_level) WHERE experience_level IS NOT NULL;