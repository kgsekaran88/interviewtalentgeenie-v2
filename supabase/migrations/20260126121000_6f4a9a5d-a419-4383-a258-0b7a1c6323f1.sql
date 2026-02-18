-- Add 'needs_changes' to the questions_status constraint
ALTER TABLE public.interviews 
DROP CONSTRAINT IF EXISTS interviews_questions_status_check;

ALTER TABLE public.interviews 
ADD CONSTRAINT interviews_questions_status_check 
CHECK (questions_status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'needs_changes'::text]));

-- Add a column to store Tech SPOC feedback when rejecting
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS review_feedback TEXT;

-- Add a column to track who last reviewed
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS last_reviewed_by UUID REFERENCES auth.users(id);

ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.interviews.questions_status IS 'draft = editable, pending_review = awaiting Tech SPOC, approved = locked, needs_changes = Tech SPOC requested changes';
COMMENT ON COLUMN public.interviews.review_feedback IS 'Feedback from Tech SPOC when requesting changes';