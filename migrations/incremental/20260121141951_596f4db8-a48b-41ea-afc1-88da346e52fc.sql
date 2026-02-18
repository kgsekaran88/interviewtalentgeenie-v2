-- Update assessments table to allow both old and new hiring decision values
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_hiring_decision_check;

ALTER TABLE public.assessments ADD CONSTRAINT assessments_hiring_decision_check 
CHECK (hiring_decision IN (
  -- New standardized values
  'strongly_recommend', 'recommend', 'consider', 'not_recommended',
  -- Legacy values for backward compatibility
  'strong_hire', 'hire', 'reject'
));

-- Update existing records to use new standardized values
UPDATE public.assessments 
SET hiring_decision = CASE hiring_decision
  WHEN 'strong_hire' THEN 'strongly_recommend'
  WHEN 'hire' THEN 'recommend'
  WHEN 'reject' THEN 'not_recommended'
  ELSE hiring_decision
END
WHERE hiring_decision IN ('strong_hire', 'hire', 'reject');