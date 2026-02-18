-- Create evaluation queue table
CREATE TABLE public.evaluation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  include_video_analysis BOOLEAN DEFAULT false,
  requested_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  UNIQUE(attempt_id, status) -- Prevent duplicate pending/processing for same attempt
);

-- Create partial unique index to allow only one pending/processing per attempt
DROP INDEX IF EXISTS idx_evaluation_queue_unique_active;
ALTER TABLE public.evaluation_queue DROP CONSTRAINT IF EXISTS evaluation_queue_attempt_id_status_key;

CREATE UNIQUE INDEX idx_evaluation_queue_unique_active 
ON public.evaluation_queue (attempt_id) 
WHERE status IN ('pending', 'processing');

-- Index for queue processing
CREATE INDEX idx_evaluation_queue_pending ON public.evaluation_queue (status, priority, created_at) 
WHERE status = 'pending';

-- Index for cleanup
CREATE INDEX idx_evaluation_queue_status ON public.evaluation_queue (status, created_at);

-- Enable RLS
ALTER TABLE public.evaluation_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view queue status
CREATE POLICY "Users can view evaluation queue"
ON public.evaluation_queue FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Service role can manage queue"
ON public.evaluation_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add realtime for queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluation_queue;