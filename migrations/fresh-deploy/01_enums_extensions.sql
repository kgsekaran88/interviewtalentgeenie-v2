-- ============================================================================
-- FRESH DEPLOYMENT: 01 - EXTENSIONS & ENUMS
-- Run this FIRST on a fresh Supabase project
-- Auto-generated from Production Cloud schema on 2024-12-27
-- ============================================================================

-- Extensions (only user-installable ones)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- App Role Enum
-- Contains all 12 roles from production (including legacy roles for compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      -- Legacy roles (kept for compatibility)
      'admin',
      'hr',
      'interviewer',
      'contributor',
      'candidate',
      'guest',
      -- Current active roles
      'platform_admin',
      'partner_admin',
      'hr_recruiter',
      'ta_creator',
      'billing_contact',
      'tech_spoc'
    );
  END IF;
END $$;

-- ============================================================================
-- DONE - Run 02_helper_functions.sql next
-- ============================================================================
