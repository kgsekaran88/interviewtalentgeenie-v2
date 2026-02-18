-- Add partial unique index to prevent duplicate active proctoring sessions for same attempt
-- This ensures only one active (non-ended) session can exist per attempt

-- For interview attempts
CREATE UNIQUE INDEX IF NOT EXISTS idx_proctoring_sessions_interview_active 
ON proctoring_sessions (interview_attempt_id) 
WHERE interview_attempt_id IS NOT NULL AND ended_at IS NULL;

-- For learning attempts
CREATE UNIQUE INDEX IF NOT EXISTS idx_proctoring_sessions_learning_active 
ON proctoring_sessions (learning_attempt_id) 
WHERE learning_attempt_id IS NOT NULL AND ended_at IS NULL;

-- For certification attempts
CREATE UNIQUE INDEX IF NOT EXISTS idx_proctoring_sessions_certification_active 
ON proctoring_sessions (certification_attempt_id) 
WHERE certification_attempt_id IS NOT NULL AND ended_at IS NULL;