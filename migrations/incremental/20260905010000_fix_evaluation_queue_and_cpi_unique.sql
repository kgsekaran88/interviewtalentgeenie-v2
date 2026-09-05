-- Ensure evaluation queue upsert + save RPC work on local/fresh deploys
-- (these exist in remix incremental history but were missing on this DB)

ALTER TABLE public.evaluation_queue
  ADD CONSTRAINT evaluation_queue_attempt_id_key UNIQUE (attempt_id);

DO $$
BEGIN
  IF to_regclass('public.candidate_performance_index') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'candidate_performance_index_attempt_id_key'
     ) THEN
    ALTER TABLE public.candidate_performance_index
      ADD CONSTRAINT candidate_performance_index_attempt_id_key UNIQUE (attempt_id);
  END IF;
END $$;
