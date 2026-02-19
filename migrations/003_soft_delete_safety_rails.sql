-- ============================================================================
-- Migration 003: Soft Delete Safety Rails
-- ============================================================================
-- Purpose: Convert all destructive DELETE operations to soft-delete (SET deleted_at)
-- This prevents catastrophic data loss like the IntraEdge incident.
--
-- What this migration does:
-- 1. Adds deleted_at columns to tables that lack them
-- 2. Adds RESTRICTIVE RLS policies to hide soft-deleted records from normal queries
-- 3. Creates soft_delete_*_tx transaction functions (replace hard-delete versions)
-- 4. Creates restore_*_tx functions to undo deletions
-- 5. Creates purge_soft_deleted() for permanent removal after retention period
-- ============================================================================

BEGIN;

-- ============================================
-- 1. Add deleted_at columns to key tables
-- ============================================
-- Tables that ALREADY have deleted_at: organizations, interviews, questions, interview_invitations
-- Tables that NEED deleted_at:

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE learning_assessments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE learning_assessment_attempts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE attempt_questions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Partial indexes for efficient soft-delete queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_members_deleted_at
  ON organization_members (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_deleted_at
  ON user_roles (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interview_attempts_deleted_at
  ON interview_attempts (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_deleted_at
  ON assessments (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_deleted_at
  ON certificates (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_assessments_deleted_at
  ON learning_assessments (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_assessment_attempts_deleted_at
  ON learning_assessment_attempts (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attempt_questions_deleted_at
  ON attempt_questions (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================
-- 2. RESTRICTIVE RLS policies to hide soft-deleted records
-- ============================================
-- These automatically filter out deleted records for ALL authenticated queries.
-- Service role (used by edge functions for admin restore) bypasses RLS entirely.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles', 'organization_members', 'user_roles',
    'interview_attempts', 'assessments', 'certificates',
    'learning_assessments', 'learning_assessment_attempts',
    'attempt_questions', 'interviews', 'questions',
    'interview_invitations', 'organizations'
  ])
  LOOP
    -- Drop existing policy if it exists (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS exclude_soft_deleted ON %I', t);
    -- Create RESTRICTIVE policy - this ANDs with existing PERMISSIVE policies
    EXECUTE format(
      'CREATE POLICY exclude_soft_deleted ON %I AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL)',
      t
    );
  END LOOP;
END;
$$;

-- ============================================
-- 3. Soft Delete Transaction Functions
-- ============================================

-- ------------------------------------
-- Soft Delete Organization (replaces delete_organization_tx for normal use)
-- ------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_organization_tx(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org RECORD;
  v_counts jsonb := '{}'::jsonb;
  v_interview_ids uuid[];
  v_attempt_ids uuid[];
  v_count integer;
BEGIN
  -- Find org (bypass RLS via SECURITY DEFINER)
  SELECT * INTO v_org FROM organizations WHERE id = p_organization_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found or already deleted';
  END IF;

  -- Collect interview IDs for this org
  SELECT array_agg(id) INTO v_interview_ids
    FROM interviews WHERE organization_id = p_organization_id AND deleted_at IS NULL;

  IF v_interview_ids IS NOT NULL THEN
    -- Collect attempt IDs
    SELECT array_agg(id) INTO v_attempt_ids
      FROM interview_attempts WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NULL;

    IF v_attempt_ids IS NOT NULL THEN
      -- Soft-delete assessments
      UPDATE assessments SET deleted_at = now()
        WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NULL;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_counts := v_counts || jsonb_build_object('assessments', v_count);

      -- Soft-delete attempt_questions
      UPDATE attempt_questions SET deleted_at = now()
        WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NULL;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_counts := v_counts || jsonb_build_object('attempt_questions', v_count);
    END IF;

    -- Soft-delete interview_attempts
    UPDATE interview_attempts SET deleted_at = now()
      WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('interview_attempts', v_count);

    -- Soft-delete interview_invitations
    UPDATE interview_invitations SET deleted_at = now()
      WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('interview_invitations', v_count);

    -- Soft-delete questions
    UPDATE questions SET deleted_at = now()
      WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('questions', v_count);

    -- Soft-delete interviews
    UPDATE interviews SET deleted_at = now()
      WHERE id = ANY(v_interview_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('interviews', v_count);
  END IF;

  -- Soft-delete user_roles for this org
  UPDATE user_roles SET deleted_at = now()
    WHERE organization_id = p_organization_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('user_roles', v_count);

  -- Soft-delete organization_members
  UPDATE organization_members SET deleted_at = now()
    WHERE organization_id = p_organization_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('organization_members', v_count);

  -- Soft-delete the organization itself
  UPDATE organizations SET deleted_at = now() WHERE id = p_organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_name', v_org.name,
    'soft_deleted_counts', v_counts,
    'can_restore', true,
    'restore_before', (now() + interval '30 days')::text
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Organization soft-delete failed: %', SQLERRM;
END;
$function$;

-- ------------------------------------
-- Soft Delete Interview (replaces delete_interview_tx for normal use)
-- ------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_interview_tx(p_interview_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_interview RECORD;
  v_attempt_ids uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id AND deleted_at IS NULL;
  IF v_interview IS NULL THEN
    RAISE EXCEPTION 'Interview not found or already deleted';
  END IF;

  -- Collect attempt IDs
  SELECT array_agg(id) INTO v_attempt_ids
    FROM interview_attempts WHERE interview_id = p_interview_id AND deleted_at IS NULL;

  IF v_attempt_ids IS NOT NULL THEN
    UPDATE assessments SET deleted_at = now()
      WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('assessments', v_count);

    UPDATE attempt_questions SET deleted_at = now()
      WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('attempt_questions', v_count);

    UPDATE interview_attempts SET deleted_at = now()
      WHERE interview_id = p_interview_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('interview_attempts', v_count);
  END IF;

  UPDATE interview_invitations SET deleted_at = now()
    WHERE interview_id = p_interview_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('invitations', v_count);

  UPDATE questions SET deleted_at = now()
    WHERE interview_id = p_interview_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('questions', v_count);

  -- Soft-delete the interview itself
  UPDATE interviews SET deleted_at = now() WHERE id = p_interview_id;

  RETURN jsonb_build_object(
    'success', true,
    'interview_title', v_interview.title,
    'soft_deleted_counts', v_counts,
    'can_restore', true
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Interview soft-delete failed: %', SQLERRM;
END;
$function$;

-- ------------------------------------
-- Soft Delete User (replaces delete_user_cascade_tx for normal use)
-- ------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_user_tx(p_user_id uuid, p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_org RECORD;
  v_elevations jsonb := '[]'::jsonb;
  v_earliest_member RECORD;
  v_is_partner_admin boolean := false;
BEGIN
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id AND deleted_at IS NULL;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found or already deleted';
  END IF;

  -- Check if user is a partner_admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'partner_admin' AND deleted_at IS NULL
  ) INTO v_is_partner_admin;

  -- Handle partner admin elevation before soft-deleting
  FOR v_org IN
    SELECT om.organization_id, o.name as org_name
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id AND om.status = 'active' AND om.deleted_at IS NULL
  LOOP
    IF v_is_partner_admin THEN
      -- Check if this is the only partner_admin for this org
      IF NOT EXISTS (
        SELECT 1 FROM organization_members om
        JOIN user_roles ur ON ur.user_id = om.user_id
        WHERE om.organization_id = v_org.organization_id
          AND om.status = 'active' AND om.deleted_at IS NULL
          AND om.user_id != p_user_id
          AND ur.role = 'partner_admin' AND ur.deleted_at IS NULL
      ) THEN
        -- Elevate the earliest active member
        SELECT om.user_id, p.email, p.full_name
        INTO v_earliest_member
        FROM organization_members om
        JOIN profiles p ON p.id = om.user_id
        WHERE om.organization_id = v_org.organization_id
          AND om.status = 'active' AND om.deleted_at IS NULL
          AND om.user_id != p_user_id
        ORDER BY om.joined_at ASC
        LIMIT 1;

        IF v_earliest_member.user_id IS NOT NULL THEN
          INSERT INTO user_roles (user_id, role, organization_id)
          VALUES (v_earliest_member.user_id, 'partner_admin', v_org.organization_id)
          ON CONFLICT (user_id, role) DO NOTHING;

          v_elevations := v_elevations || jsonb_build_object(
            'org_id', v_org.organization_id,
            'org_name', v_org.org_name,
            'new_admin_id', v_earliest_member.user_id,
            'new_admin_email', v_earliest_member.email
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Soft-delete user records (NOT hard delete)
  UPDATE user_roles SET deleted_at = now()
    WHERE user_id = p_user_id AND deleted_at IS NULL;
  UPDATE organization_members SET deleted_at = now()
    WHERE user_id = p_user_id AND deleted_at IS NULL;
  UPDATE profiles SET deleted_at = now()
    WHERE id = p_user_id;

  -- Audit log
  INSERT INTO audit_logs (action, table_name, record_id, user_id, metadata)
  VALUES (
    'USER_SOFT_DELETE',
    'profiles',
    p_user_id::text,
    p_admin_user_id,
    jsonb_build_object(
      'elevations', v_elevations,
      'can_restore', true,
      'user_email', v_user.email,
      'restore_before', (now() + interval '30 days')::text
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'user_email', v_user.email,
    'elevations', v_elevations,
    'can_restore', true,
    'restore_before', (now() + interval '30 days')::text
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'User soft-delete failed: %', SQLERRM;
END;
$function$;

-- ============================================
-- 4. Restore Transaction Functions
-- ============================================

-- Restore Organization
CREATE OR REPLACE FUNCTION public.restore_organization_tx(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org RECORD;
  v_restored jsonb := '{}'::jsonb;
  v_interview_ids uuid[];
  v_attempt_ids uuid[];
  v_count integer;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_organization_id AND deleted_at IS NOT NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found or not deleted';
  END IF;

  -- Restore organization
  UPDATE organizations SET deleted_at = NULL WHERE id = p_organization_id;

  -- Restore members and roles
  UPDATE organization_members SET deleted_at = NULL
    WHERE organization_id = p_organization_id AND deleted_at IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_restored := v_restored || jsonb_build_object('organization_members', v_count);

  UPDATE user_roles SET deleted_at = NULL
    WHERE organization_id = p_organization_id AND deleted_at IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_restored := v_restored || jsonb_build_object('user_roles', v_count);

  -- Restore interviews and children
  SELECT array_agg(id) INTO v_interview_ids
    FROM interviews WHERE organization_id = p_organization_id AND deleted_at IS NOT NULL;

  IF v_interview_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_attempt_ids
      FROM interview_attempts WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NOT NULL;

    IF v_attempt_ids IS NOT NULL THEN
      UPDATE assessments SET deleted_at = NULL
        WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NOT NULL;
      UPDATE attempt_questions SET deleted_at = NULL
        WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NOT NULL;
      UPDATE interview_attempts SET deleted_at = NULL
        WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NOT NULL;
    END IF;

    UPDATE interview_invitations SET deleted_at = NULL
      WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NOT NULL;
    UPDATE questions SET deleted_at = NULL
      WHERE interview_id = ANY(v_interview_ids) AND deleted_at IS NOT NULL;
    UPDATE interviews SET deleted_at = NULL
      WHERE id = ANY(v_interview_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_restored := v_restored || jsonb_build_object('interviews', v_count);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_name', v_org.name,
    'restored_counts', v_restored
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Organization restore failed: %', SQLERRM;
END;
$function$;

-- Restore Interview
CREATE OR REPLACE FUNCTION public.restore_interview_tx(p_interview_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_interview RECORD;
  v_attempt_ids uuid[];
  v_restored jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id AND deleted_at IS NOT NULL;
  IF v_interview IS NULL THEN
    RAISE EXCEPTION 'Interview not found or not deleted';
  END IF;

  -- Restore children
  SELECT array_agg(id) INTO v_attempt_ids
    FROM interview_attempts WHERE interview_id = p_interview_id AND deleted_at IS NOT NULL;

  IF v_attempt_ids IS NOT NULL THEN
    UPDATE assessments SET deleted_at = NULL
      WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NOT NULL;
    UPDATE attempt_questions SET deleted_at = NULL
      WHERE attempt_id = ANY(v_attempt_ids) AND deleted_at IS NOT NULL;
    UPDATE interview_attempts SET deleted_at = NULL
      WHERE interview_id = p_interview_id AND deleted_at IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_restored := v_restored || jsonb_build_object('interview_attempts', v_count);
  END IF;

  UPDATE interview_invitations SET deleted_at = NULL
    WHERE interview_id = p_interview_id AND deleted_at IS NOT NULL;
  UPDATE questions SET deleted_at = NULL
    WHERE interview_id = p_interview_id AND deleted_at IS NOT NULL;
  UPDATE interviews SET deleted_at = NULL WHERE id = p_interview_id;

  RETURN jsonb_build_object(
    'success', true,
    'interview_title', v_interview.title,
    'restored_counts', v_restored
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Interview restore failed: %', SQLERRM;
END;
$function$;

-- Restore User
CREATE OR REPLACE FUNCTION public.restore_user_tx(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id AND deleted_at IS NOT NULL;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found or not deleted';
  END IF;

  UPDATE profiles SET deleted_at = NULL WHERE id = p_user_id;
  UPDATE user_roles SET deleted_at = NULL WHERE user_id = p_user_id AND deleted_at IS NOT NULL;
  UPDATE organization_members SET deleted_at = NULL WHERE user_id = p_user_id AND deleted_at IS NOT NULL;

  RETURN jsonb_build_object(
    'success', true,
    'user_email', v_user.email,
    'user_id', p_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'User restore failed: %', SQLERRM;
END;
$function$;

-- ============================================
-- 5. Purge Function (permanent hard-delete after retention period)
-- ============================================
CREATE OR REPLACE FUNCTION public.purge_soft_deleted(p_retention_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz;
  v_purged jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  v_cutoff := now() - (p_retention_days || ' days')::interval;

  -- Purge in dependency order (children first)
  DELETE FROM assessments WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('assessments', v_count);

  DELETE FROM attempt_questions WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('attempt_questions', v_count);

  DELETE FROM interview_attempts WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('interview_attempts', v_count);

  DELETE FROM interview_invitations WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('interview_invitations', v_count);

  DELETE FROM questions WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('questions', v_count);

  DELETE FROM interviews WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('interviews', v_count);

  DELETE FROM user_roles WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('user_roles', v_count);

  DELETE FROM organization_members WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('organization_members', v_count);

  DELETE FROM profiles WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('profiles', v_count);

  DELETE FROM organizations WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('organizations', v_count);

  DELETE FROM certificates WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('certificates', v_count);

  DELETE FROM learning_assessments WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('learning_assessments', v_count);

  DELETE FROM learning_assessment_attempts WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_purged := v_purged || jsonb_build_object('learning_assessment_attempts', v_count);

  RETURN jsonb_build_object(
    'success', true,
    'cutoff_date', v_cutoff::text,
    'retention_days', p_retention_days,
    'purged_counts', v_purged
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Purge failed: %', SQLERRM;
END;
$function$;

-- ============================================
-- 6. List soft-deleted records (for admin restore UI)
-- ============================================
CREATE OR REPLACE FUNCTION public.list_soft_deleted(p_entity_type text DEFAULT 'all')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF p_entity_type IN ('all', 'organizations') THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'deleted_at', deleted_at
    )) INTO v_result
    FROM organizations WHERE deleted_at IS NOT NULL;
    v_result := jsonb_build_object('organizations', COALESCE(v_result, '[]'::jsonb));
  END IF;

  IF p_entity_type IN ('all', 'interviews') THEN
    v_result := v_result || jsonb_build_object('interviews', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'deleted_at', deleted_at
      )) FROM interviews WHERE deleted_at IS NOT NULL),
      '[]'::jsonb
    ));
  END IF;

  IF p_entity_type IN ('all', 'users') THEN
    v_result := v_result || jsonb_build_object('users', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'full_name', full_name, 'deleted_at', deleted_at
      )) FROM profiles WHERE deleted_at IS NOT NULL),
      '[]'::jsonb
    ));
  END IF;

  RETURN v_result;
END;
$function$;

COMMIT;
