-- Drop the old constraint and add updated one with new statuses
ALTER TABLE interview_attempts DROP CONSTRAINT interview_attempts_status_check;

ALTER TABLE interview_attempts ADD CONSTRAINT interview_attempts_status_check 
CHECK (status = ANY (ARRAY['in_progress'::text, 'pending_upload'::text, 'submitted'::text, 'evaluated'::text, 'abandoned'::text, 'upload_failed'::text]));