-- =============================================================================
-- TalentGeenie — Additional Database Roles & Grants
-- =============================================================================
-- This script runs AFTER the supabase/postgres image initializes.
-- The image already creates: postgres, anon, authenticated, service_role,
-- supabase_admin, supabase_auth_admin, supabase_storage_admin, etc.
--
-- We add any extra grants our application needs.
-- =============================================================================

-- Ensure the authenticator role can switch to our application roles
-- (supabase/postgres already sets this up, but we ensure it explicitly)
DO $$
BEGIN
  -- Grant anon and authenticated to authenticator (PostgREST connection role)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'GRANT anon TO authenticator';
    EXECUTE 'GRANT authenticated TO authenticator';
    EXECUTE 'GRANT service_role TO authenticator';
  END IF;
END $$;

-- Grant schema usage to API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Ensure extensions schema is accessible
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Realtime needs publication for change data capture
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- =============================================================================
-- DONE — Database roles configured for TalentGeenie
-- =============================================================================
