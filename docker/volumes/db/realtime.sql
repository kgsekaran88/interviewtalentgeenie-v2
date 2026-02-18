-- =============================================================================
-- TalentGeenie — Realtime Publication Configuration
-- =============================================================================
-- Adds application tables to the supabase_realtime publication so that
-- postgres_changes subscriptions work with the self-hosted Realtime service.
--
-- Tables subscribed to from the frontend:
--   1. notifications         — NotificationCenter, Notifications page
--   2. proctoring_sessions   — ProctoringDashboard
--   3. ai_health_alerts      — useAIHealthMonitoring hook
--   4. live_stream_signals   — liveStreamWebRTC (WebRTC signaling)
-- =============================================================================

-- Ensure the publication exists (created in roles.sql, but be safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to the realtime publication
-- Using ALTER PUBLICATION ... ADD TABLE (idempotent-safe with IF NOT EXISTS check)
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['notifications', 'proctoring_sessions', 'ai_health_alerts', 'live_stream_signals'];
BEGIN
  FOREACH tbl IN ARRAY tbls
  LOOP
    -- Only add if table exists and isn't already in the publication
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        RAISE NOTICE 'Added table % to supabase_realtime publication', tbl;
      ELSE
        RAISE NOTICE 'Table % already in supabase_realtime publication (skipping)', tbl;
      END IF;
    ELSE
      RAISE NOTICE 'Table % does not exist yet (skipping)', tbl;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- DONE — Realtime configured for 4 tables
-- =============================================================================
