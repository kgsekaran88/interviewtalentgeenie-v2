-- Create missing Cloud tables locally
-- Generated from Cloud OpenAPI spec

CREATE TABLE IF NOT EXISTS public.admin_chat_context (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  context_type text,
  context_key text,
  context_value text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.admin_chat_context ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_saved_queries (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  query_text text,
  category text,
  is_favorite boolean,
  usage_count integer,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.admin_saved_queries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chunk_upload_logs (
  id uuid DEFAULT gen_random_uuid(),
  session_id uuid,
  attempt_id uuid,
  chunk_type text,
  chunk_index integer,
  chunk_size_bytes bigint,
  upload_started_at timestamptz,
  upload_completed_at timestamptz,
  duration_ms integer,
  status text,
  retry_count integer,
  error_message text,
  storage_path text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.chunk_upload_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
  id uuid DEFAULT gen_random_uuid(),
  job_name text,
  job_schedule text,
  execution_started_at timestamptz,
  execution_completed_at timestamptz,
  duration_ms integer,
  status text,
  records_processed integer,
  records_affected integer,
  error_message text,
  error_details jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.cron_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.evaluation_queue (
  id uuid DEFAULT gen_random_uuid(),
  attempt_id uuid,
  priority integer,
  status text,
  include_video_analysis boolean,
  requested_by uuid,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer,
  max_retries integer,
  PRIMARY KEY (id)
);
ALTER TABLE public.evaluation_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.evaluation_queue_logs (
  id uuid DEFAULT gen_random_uuid(),
  queue_item_id uuid,
  attempt_id uuid,
  action text,
  queue_position integer,
  retry_attempt integer,
  processing_time_ms integer,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.evaluation_queue_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.export_job_logs (
  id uuid DEFAULT gen_random_uuid(),
  job_type text,
  entity_type text,
  entity_id uuid,
  user_id uuid,
  organization_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  status text,
  file_size_bytes bigint,
  output_url text,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.export_job_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.live_stream_signals (
  id uuid DEFAULT gen_random_uuid(),
  proctoring_session_id uuid,
  sender_type text,
  sender_id text,
  signal_type text,
  signal_data jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (id)
);
ALTER TABLE public.live_stream_signals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.merge_operation_logs (
  id uuid DEFAULT gen_random_uuid(),
  session_id uuid,
  merge_type text,
  chunks_count integer,
  total_size_bytes bigint,
  merge_started_at timestamptz,
  merge_completed_at timestamptz,
  duration_ms integer,
  status text,
  error_message text,
  output_path text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.merge_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.question_generation_logs (
  id uuid DEFAULT gen_random_uuid(),
  interview_id uuid,
  user_id uuid,
  generation_type text,
  questions_requested integer,
  questions_generated integer,
  prompt_tokens integer,
  completion_tokens integer,
  model_used text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  status text,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.question_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.realtime_connection_logs (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  channel_name text,
  event_type text,
  connection_duration_ms bigint,
  reconnect_attempt integer,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.realtime_connection_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.security_event_logs (
  id uuid DEFAULT gen_random_uuid(),
  event_type text,
  user_id uuid,
  ip_address text,
  user_agent text,
  resource_type text,
  resource_id text,
  action_attempted text,
  severity text,
  details jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.security_event_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.storage_operation_logs (
  id uuid DEFAULT gen_random_uuid(),
  operation text,
  bucket_name text,
  file_path text,
  file_size_bytes bigint,
  files_affected integer,
  bytes_freed bigint,
  triggered_by text,
  user_id uuid,
  status text,
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.storage_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_portal_preferences (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  portal_type text,
  card_order text[],
  hidden_cards text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.user_portal_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_session_logs (
  id uuid DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text,
  ip_address text,
  user_agent text,
  device_info jsonb,
  session_duration_ms bigint,
  success boolean,
  failure_reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.user_session_logs ENABLE ROW LEVEL SECURITY;
