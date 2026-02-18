-- Add upload_diagnostics column to proctoring_sessions for debugging failed uploads
ALTER TABLE public.proctoring_sessions
ADD COLUMN IF NOT EXISTS upload_diagnostics JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.proctoring_sessions.upload_diagnostics IS 'Diagnostic data captured during upload attempt - helps debug failed uploads';