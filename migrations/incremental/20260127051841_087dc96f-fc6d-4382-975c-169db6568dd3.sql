-- =============================================
-- COMPREHENSIVE LOGGING INFRASTRUCTURE
-- =============================================

-- 1. Chunk Upload Logs - Track individual chunk uploads and merge operations
CREATE TABLE IF NOT EXISTS public.chunk_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  attempt_id UUID,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN ('video', 'screen')),
  chunk_index INTEGER NOT NULL,
  chunk_size_bytes BIGINT,
  upload_started_at TIMESTAMPTZ DEFAULT now(),
  upload_completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'completed', 'failed', 'retrying')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Merge Operation Logs - Track video merge operations
CREATE TABLE IF NOT EXISTS public.merge_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  merge_type TEXT NOT NULL CHECK (merge_type IN ('video', 'screen')),
  chunks_count INTEGER,
  total_size_bytes BIGINT,
  merge_started_at TIMESTAMPTZ DEFAULT now(),
  merge_completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  output_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Evaluation Queue Logs - Track queue processing
CREATE TABLE IF NOT EXISTS public.evaluation_queue_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id UUID,
  attempt_id UUID,
  action TEXT NOT NULL CHECK (action IN ('enqueued', 'started', 'completed', 'failed', 'retrying', 'stuck_detected', 'manually_requeued')),
  queue_position INTEGER,
  retry_attempt INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Question Generation Logs - Track AI question generation
CREATE TABLE IF NOT EXISTS public.question_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID,
  user_id UUID,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('bulk', 'single', 'regenerate', 'from_template')),
  questions_requested INTEGER,
  questions_generated INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  model_used TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'partial', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Export Job Logs - Track PDF/report generation
CREATE TABLE IF NOT EXISTS public.export_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('pdf_report', 'excel_export', 'certificate', 'bulk_export', 'analytics_report')),
  entity_type TEXT,
  entity_id UUID,
  user_id UUID,
  organization_id UUID,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  file_size_bytes BIGINT,
  output_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Storage Operation Logs - Track file operations
CREATE TABLE IF NOT EXISTS public.storage_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL CHECK (operation IN ('upload', 'delete', 'cleanup', 'orphan_detected', 'orphan_removed', 'retention_applied')),
  bucket_name TEXT NOT NULL,
  file_path TEXT,
  file_size_bytes BIGINT,
  files_affected INTEGER DEFAULT 1,
  bytes_freed BIGINT,
  triggered_by TEXT CHECK (triggered_by IN ('user', 'system', 'cron', 'retention_policy')),
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. User Session Logs - Track authentication events
CREATE TABLE IF NOT EXISTS public.user_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'logout', 'session_refresh', 'session_expired', 'password_reset', 'mfa_challenge', 'mfa_verified')),
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  session_duration_ms BIGINT,
  success BOOLEAN DEFAULT true,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Realtime Connection Logs - Track WebSocket events
CREATE TABLE IF NOT EXISTS public.realtime_connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  channel_name TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('connected', 'disconnected', 'reconnecting', 'reconnected', 'error', 'subscription_created', 'subscription_removed')),
  connection_duration_ms BIGINT,
  reconnect_attempt INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Cron Job Execution Logs - Track scheduled tasks
CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  job_schedule TEXT,
  execution_started_at TIMESTAMPTZ DEFAULT now(),
  execution_completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  records_processed INTEGER,
  records_affected INTEGER,
  error_message TEXT,
  error_details JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Security Event Logs - Track RLS denials and security events
CREATE TABLE IF NOT EXISTS public.security_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('rls_denial', 'unauthorized_access', 'rate_limit_exceeded', 'suspicious_activity', 'brute_force_detected', 'token_expired', 'invalid_token')),
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,
  resource_id TEXT,
  action_attempted TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chunk_upload_logs_session ON public.chunk_upload_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chunk_upload_logs_status ON public.chunk_upload_logs(status);
CREATE INDEX IF NOT EXISTS idx_chunk_upload_logs_created ON public.chunk_upload_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_merge_operation_logs_session ON public.merge_operation_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_merge_operation_logs_created ON public.merge_operation_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_evaluation_queue_logs_attempt ON public.evaluation_queue_logs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_queue_logs_action ON public.evaluation_queue_logs(action);
CREATE INDEX IF NOT EXISTS idx_evaluation_queue_logs_created ON public.evaluation_queue_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_question_generation_logs_interview ON public.question_generation_logs(interview_id);
CREATE INDEX IF NOT EXISTS idx_question_generation_logs_created ON public.question_generation_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_export_job_logs_user ON public.export_job_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_job_logs_created ON public.export_job_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_storage_operation_logs_bucket ON public.storage_operation_logs(bucket_name);
CREATE INDEX IF NOT EXISTS idx_storage_operation_logs_operation ON public.storage_operation_logs(operation);
CREATE INDEX IF NOT EXISTS idx_storage_operation_logs_created ON public.storage_operation_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_session_logs_user ON public.user_session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_session_logs_event ON public.user_session_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_user_session_logs_created ON public.user_session_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_realtime_connection_logs_user ON public.realtime_connection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_connection_logs_created ON public.realtime_connection_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_job ON public.cron_execution_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_status ON public.cron_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_created ON public.cron_execution_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_security_event_logs_type ON public.security_event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_event_logs_severity ON public.security_event_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_event_logs_user ON public.security_event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_event_logs_created ON public.security_event_logs(created_at);

-- Enable RLS on all log tables
ALTER TABLE public.chunk_upload_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merge_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_queue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_event_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Platform admins can view all logs
CREATE POLICY "Platform admins can view chunk_upload_logs"
  ON public.chunk_upload_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view merge_operation_logs"
  ON public.merge_operation_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view evaluation_queue_logs"
  ON public.evaluation_queue_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view question_generation_logs"
  ON public.question_generation_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view export_job_logs"
  ON public.export_job_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view storage_operation_logs"
  ON public.storage_operation_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view user_session_logs"
  ON public.user_session_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view realtime_connection_logs"
  ON public.realtime_connection_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view cron_execution_logs"
  ON public.cron_execution_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can view security_event_logs"
  ON public.security_event_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- Insert policies for authenticated users (edge functions use service role)
CREATE POLICY "Authenticated can insert chunk_upload_logs"
  ON public.chunk_upload_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert merge_operation_logs"
  ON public.merge_operation_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert evaluation_queue_logs"
  ON public.evaluation_queue_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert question_generation_logs"
  ON public.question_generation_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert export_job_logs"
  ON public.export_job_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert storage_operation_logs"
  ON public.storage_operation_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert user_session_logs"
  ON public.user_session_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert realtime_connection_logs"
  ON public.realtime_connection_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert cron_execution_logs"
  ON public.cron_execution_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert security_event_logs"
  ON public.security_event_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Update policies for completing logs
CREATE POLICY "Authenticated can update chunk_upload_logs"
  ON public.chunk_upload_logs FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update merge_operation_logs"
  ON public.merge_operation_logs FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update evaluation_queue_logs"
  ON public.evaluation_queue_logs FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update question_generation_logs"
  ON public.question_generation_logs FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update export_job_logs"
  ON public.export_job_logs FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update cron_execution_logs"
  ON public.cron_execution_logs FOR UPDATE TO authenticated
  USING (true);