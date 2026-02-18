-- ============================================================================
-- FRESH DEPLOYMENT: 07 - AUTH TRIGGERS
-- Run LAST after all other scripts
-- NOTE: These triggers attach to auth.users which is a Supabase-managed table
-- ============================================================================

-- ============================================================================
-- IMPORTANT: These triggers should be created via Supabase Dashboard or 
-- through the Supabase CLI with proper permissions. The auth schema is
-- managed by Supabase and requires special handling.
-- ============================================================================

-- Trigger: Create profile when new user signs up
-- This creates a profile entry in public.profiles when a user registers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Assign guest role on signup
-- This gives new users the 'guest' role by default
DROP TRIGGER IF EXISTS assign_guest_role_trigger ON auth.users;
CREATE TRIGGER assign_guest_role_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_guest_role_on_signup();

-- Trigger: Initialize onboarding progress
-- This creates an onboarding_progress entry for new users
DROP TRIGGER IF EXISTS init_onboarding_trigger ON auth.users;
CREATE TRIGGER init_onboarding_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_onboarding_progress();

-- ============================================================================
-- ALTERNATIVE: If you cannot create triggers on auth.users directly,
-- use Supabase Auth Hooks or Database Webhooks instead.
-- 
-- Option 1: Use Supabase Dashboard > Authentication > Hooks
-- Option 2: Use pg_net to call an edge function on user signup
-- ============================================================================

-- ============================================================================
-- COMPLETE DEPLOYMENT SEQUENCE
-- ============================================================================
-- 
-- Execute in order:
-- 1. 01_enums_extensions.sql     - Extensions and app_role enum
-- 2. 02_helper_functions.sql     - Basic helper functions (already exists)
-- 3. 03_tables.sql               - All 105+ tables
-- 4. 04_functions.sql            - All 107+ database functions
-- 5. 05_rls_policies.sql         - All 330+ RLS policies
-- 6. 05b_triggers.sql            - All 60+ triggers
-- 7. 05c_indexes.sql             - All 150+ indexes
-- 8. 06_storage.sql              - Storage buckets and policies
-- 9. 07_auth_trigger.sql         - Auth triggers (this file)
--
-- ============================================================================
