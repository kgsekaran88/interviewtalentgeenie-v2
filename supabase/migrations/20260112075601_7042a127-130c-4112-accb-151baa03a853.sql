-- Add deadline_at column to interview_attempts for server-side time enforcement
-- This stores the absolute deadline (started_at + duration) for easy querying
ALTER TABLE public.interview_attempts 
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP WITH TIME ZONE;

-- Add started_at column to track when the interview actually started
ALTER TABLE public.interview_attempts 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Create an index for efficient deadline queries
CREATE INDEX IF NOT EXISTS idx_interview_attempts_deadline 
ON public.interview_attempts (deadline_at, status) 
WHERE status = 'in_progress';

-- Create function to set deadline when interview starts
CREATE OR REPLACE FUNCTION public.set_interview_deadline()
RETURNS TRIGGER AS $$
DECLARE
  interview_duration INTEGER;
BEGIN
  -- Only set deadline when status changes to in_progress and started_at is being set
  IF NEW.status = 'in_progress' AND NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
    -- Get the interview duration
    SELECT time_limit INTO interview_duration
    FROM public.interviews
    WHERE id = NEW.interview_id;
    
    -- Set deadline if duration exists (time_limit is in minutes)
    IF interview_duration IS NOT NULL AND interview_duration > 0 THEN
      NEW.deadline_at := NEW.started_at + (interview_duration || ' minutes')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-set deadline
DROP TRIGGER IF EXISTS set_interview_deadline_trigger ON public.interview_attempts;
CREATE TRIGGER set_interview_deadline_trigger
BEFORE UPDATE ON public.interview_attempts
FOR EACH ROW
EXECUTE FUNCTION public.set_interview_deadline();

-- Also handle cases where started_at is set during INSERT
CREATE OR REPLACE FUNCTION public.set_interview_deadline_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  interview_duration INTEGER;
BEGIN
  -- Set deadline if started_at is provided and status is in_progress
  IF NEW.status = 'in_progress' AND NEW.started_at IS NOT NULL THEN
    SELECT time_limit INTO interview_duration
    FROM public.interviews
    WHERE id = NEW.interview_id;
    
    IF interview_duration IS NOT NULL AND interview_duration > 0 THEN
      NEW.deadline_at := NEW.started_at + (interview_duration || ' minutes')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_interview_deadline_on_insert_trigger ON public.interview_attempts;
CREATE TRIGGER set_interview_deadline_on_insert_trigger
BEFORE INSERT ON public.interview_attempts
FOR EACH ROW
EXECUTE FUNCTION public.set_interview_deadline_on_insert();