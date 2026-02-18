-- Add unique constraint on attempt_id for the evaluation_queue table
-- This allows upsert operations to work correctly when checking for existing queue items
ALTER TABLE public.evaluation_queue 
ADD CONSTRAINT evaluation_queue_attempt_id_key UNIQUE (attempt_id);