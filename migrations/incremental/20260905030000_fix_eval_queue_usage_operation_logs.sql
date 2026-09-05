-- Harden submit-side evaluation + usage + operation-log RLS.
-- Always enqueue evaluation_queue on submit (no pg_net required).
-- Optional pg_net HTTP kick is intentionally omitted here: local Docker images
-- often lack shared_preload_libraries=pg_net. Queue is drained by
-- auto-evaluate-trigger / process-evaluation-queue / cron.

CREATE OR REPLACE FUNCTION public.auto_evaluate_interview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_include_video_analysis BOOLEAN;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'submitted') THEN
    v_include_video_analysis := (OLD.status = 'pending_upload');

    INSERT INTO public.evaluation_queue (
      attempt_id,
      include_video_analysis,
      priority,
      status,
      created_at,
      retry_count
    ) VALUES (
      NEW.id,
      v_include_video_analysis,
      5,
      'pending',
      NOW(),
      0
    )
    ON CONFLICT (attempt_id) DO UPDATE
      SET
        status = CASE
          WHEN evaluation_queue.status IN ('pending', 'processing') THEN evaluation_queue.status
          ELSE 'pending'
        END,
        include_video_analysis = EXCLUDED.include_video_analysis,
        error_message = NULL,
        started_at = CASE
          WHEN evaluation_queue.status = 'processing' THEN evaluation_queue.started_at
          ELSE NULL
        END,
        completed_at = NULL;

    BEGIN
      INSERT INTO public.audit_logs (action, table_name, record_id, metadata)
      VALUES (
        'EVALUATE',
        'interview_attempts',
        NEW.id,
        jsonb_build_object(
          'attempt_id', NEW.id,
          'triggered_at', NOW(),
          'auto_evaluation', true,
          'include_video_analysis', v_include_video_analysis,
          'previous_status', OLD.status,
          'queue_enqueued', true
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_evaluate_interview audit log failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in auto_evaluate_interview: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Legacy second trigger: no-op to prevent double enqueue
CREATE OR REPLACE FUNCTION public.trigger_auto_evaluate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

-- Double usage increment: keep increment_interviews_used only
DROP TRIGGER IF EXISTS trigger_update_subscription_usage ON public.interview_attempts;

-- Operation logs: allow SELECT for candidate INSERT...RETURNING / duration reads
DROP POLICY IF EXISTS "Candidates can select operation logs for updates" ON public.interview_operation_logs;
CREATE POLICY "Candidates can select operation logs for updates"
  ON public.interview_operation_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);
