-- Add question_scores column to assessments table for storing per-question evaluation results
ALTER TABLE public.assessments 
ADD COLUMN IF NOT EXISTS question_scores jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.assessments.question_scores IS 'Stores per-question scores with reasoning. Format: { "question_id": { "score": 0-1, "maxScore": 1, "reasoning": "...", "isCorrect": bool } }';