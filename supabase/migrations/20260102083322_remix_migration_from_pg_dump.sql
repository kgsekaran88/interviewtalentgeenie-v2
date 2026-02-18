CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgsodium";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'hr',
    'interviewer',
    'contributor',
    'candidate',
    'guest',
    'platform_admin',
    'partner_admin',
    'hr_recruiter',
    'ta_creator',
    'billing_contact',
    'tech_spoc'
);


--
-- Name: acquire_idempotency_lock(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acquire_idempotency_lock(p_key text, p_operation_type text, p_request_hash text DEFAULT NULL::text) RETURNS TABLE(acquired boolean, existing_response jsonb, existing_resource_id uuid, lock_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_existing RECORD;
  v_new_id UUID;
BEGIN
  -- Check for existing key
  SELECT * INTO v_existing
  FROM idempotency_keys
  WHERE key = p_key;
  
  IF v_existing IS NOT NULL THEN
    -- Key exists - check status
    IF v_existing.status = 'completed' THEN
      -- Return cached response (idempotent replay)
      RETURN QUERY SELECT 
        FALSE::BOOLEAN,
        v_existing.response,
        v_existing.resource_id,
        v_existing.id;
      RETURN;
    ELSIF v_existing.status = 'pending' AND v_existing.created_at > (now() - interval '5 minutes') THEN
      -- Still processing - reject to prevent race condition
      RAISE EXCEPTION 'Operation in progress for key: %', p_key;
    ELSE
      -- Stale pending or failed - allow retry by updating
      UPDATE idempotency_keys 
      SET status = 'pending', 
          created_at = now(),
          request_hash = COALESCE(p_request_hash, request_hash),
          response = NULL,
          resource_id = NULL,
          completed_at = NULL
      WHERE id = v_existing.id
      RETURNING id INTO v_new_id;
      
      RETURN QUERY SELECT TRUE::BOOLEAN, NULL::JSONB, NULL::UUID, v_new_id;
      RETURN;
    END IF;
  END IF;
  
  -- Create new lock
  INSERT INTO idempotency_keys (key, operation_type, request_hash, status)
  VALUES (p_key, p_operation_type, p_request_hash, 'pending')
  RETURNING id INTO v_new_id;
  
  RETURN QUERY SELECT TRUE::BOOLEAN, NULL::JSONB, NULL::UUID, v_new_id;
END;
$$;


--
-- Name: approve_partner_application_tx(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_partner_application_tx(p_application_id uuid, p_reviewer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_application RECORD;
  v_org_id uuid;
  v_slug text;
  v_counter integer := 1;
  v_base_slug text;
  v_result jsonb;
BEGIN
  -- Fetch application
  SELECT * INTO v_application
  FROM partner_applications
  WHERE id = p_application_id;

  IF v_application IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_application.status != 'pending' THEN
    RAISE EXCEPTION 'Application already processed';
  END IF;

  -- Check if org already exists
  IF v_application.organization_id IS NOT NULL THEN
    v_org_id := v_application.organization_id;
  ELSE
    -- Generate unique slug
    v_base_slug := lower(regexp_replace(v_application.organization_name, '[^a-z0-9]+', '-', 'gi'));
    v_slug := v_base_slug;
    
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
      v_slug := v_base_slug || '-' || v_counter;
      v_counter := v_counter + 1;
    END LOOP;

    -- Create organization
    INSERT INTO organizations (name, slug, contact_email, status, industry, size, country)
    VALUES (
      v_application.organization_name,
      v_slug,
      v_application.contact_email,
      'active',
      v_application.industry,
      v_application.company_size,
      v_application.country
    )
    RETURNING id INTO v_org_id;

    -- Link org to application
    UPDATE partner_applications SET organization_id = v_org_id WHERE id = p_application_id;
  END IF;

  -- Create subscription if not exists
  IF NOT EXISTS (SELECT 1 FROM organization_subscriptions WHERE organization_id = v_org_id) THEN
    INSERT INTO organization_subscriptions (organization_id, plan_id, status)
    VALUES (v_org_id, v_application.selected_plan_id, 'active');
  END IF;

  -- Ensure profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_application.applicant_user_id) THEN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
      v_application.applicant_user_id,
      v_application.contact_email,
      COALESCE(v_application.contact_name, split_part(v_application.contact_email, '@', 1))
    );
  END IF;

  -- Add as organization member if not exists
  IF NOT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = v_application.applicant_user_id AND organization_id = v_org_id
  ) THEN
    INSERT INTO organization_members (organization_id, user_id, status)
    VALUES (v_org_id, v_application.applicant_user_id, 'active');
  END IF;

  -- Remove guest role
  DELETE FROM user_roles 
  WHERE user_id = v_application.applicant_user_id AND role = 'guest';

  -- Add partner_admin role if not exists
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = v_application.applicant_user_id AND role = 'partner_admin'
  ) THEN
    INSERT INTO user_roles (user_id, role, organization_id)
    VALUES (v_application.applicant_user_id, 'partner_admin', v_org_id);
  END IF;

  -- Update application status
  UPDATE partner_applications
  SET 
    status = 'approved',
    organization_id = v_org_id,
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;

  v_result := jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'organization_name', v_application.organization_name,
    'applicant_email', v_application.contact_email,
    'applicant_name', v_application.contact_name
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Partner approval failed: %', SQLERRM;
END;
$$;


--
-- Name: assign_guest_role_on_signup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_guest_role_on_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: auto_close_expired_proctoring_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_close_expired_proctoring_sessions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE closed_count INTEGER;
BEGIN
  UPDATE public.proctoring_sessions SET ended_at = NOW(), updated_at = NOW()
  WHERE ended_at IS NULL AND created_at < NOW() - INTERVAL '4 hours';
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END; $$;


--
-- Name: auto_close_proctoring_on_submission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_close_proctoring_on_submission() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (NEW.status IN ('submitted', 'evaluated') AND 
      (OLD.status IS NULL OR OLD.status NOT IN ('submitted', 'evaluated'))) THEN
    UPDATE public.proctoring_sessions
    SET 
      ended_at = COALESCE(ended_at, NOW()),
      updated_at = NOW()
    WHERE interview_attempt_id = NEW.id
      AND ended_at IS NULL;
    RAISE NOTICE 'Auto-closed proctoring session for attempt: %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: auto_evaluate_interview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_evaluate_interview() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_include_video_analysis BOOLEAN;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    v_supabase_url := 'https://aiwekrfwhdwvbnrkuurh.supabase.co';
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpd2VrcmZ3aGR3dmJucmt1dXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4Njg1NjMsImV4cCI6MjA3NTQ0NDU2M30.jF_mXJNn30Gbxm8lPPCfRb19FXpq9eca4wDpo8xmu3o';
    v_include_video_analysis := (OLD.status = 'pending_upload');
    
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/auto-evaluate-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
      ),
      body := jsonb_build_object(
        'attemptId', NEW.id,
        'includeVideoAnalysis', v_include_video_analysis
      )
    );
    
    INSERT INTO public.audit_logs (
      action, table_name, record_id, metadata
    ) VALUES (
      'EVALUATE', 'interview_attempts', NEW.id,
      jsonb_build_object(
        'attempt_id', NEW.id,
        'triggered_at', NOW(),
        'auto_evaluation', true,
        'include_video_analysis', v_include_video_analysis,
        'previous_status', OLD.status
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in auto_evaluate_interview: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: auto_set_interview_organization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_set_interview_organization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM organization_members
    WHERE user_id = NEW.creator_id 
      AND status = 'active'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: calculate_cpi_score(numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_cpi_score(p_technical_score numeric, p_problem_solving_score numeric, p_integrity_score numeric) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_technical_weight NUMERIC;
  v_problem_solving_weight NUMERIC;
  v_integrity_weight NUMERIC;
  v_cpi NUMERIC;
BEGIN
  SELECT 
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_technical_weight'), 40),
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_problem_solving_weight'), 30),
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_integrity_weight'), 30)
  INTO v_technical_weight, v_problem_solving_weight, v_integrity_weight;

  v_cpi := (
    (p_technical_score * v_technical_weight / 100) +
    (p_problem_solving_score * v_problem_solving_weight / 100) +
    (p_integrity_score * v_integrity_weight / 100)
  );
  RETURN ROUND(v_cpi, 2);
END;
$$;


--
-- Name: can_access_interview(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_interview(user_id uuid, interview_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM interviews i
    LEFT JOIN user_roles ur ON ur.user_id = can_access_interview.user_id
    WHERE i.id = can_access_interview.interview_uuid
    AND (
      i.creator_id = can_access_interview.user_id OR
      ur.role IN ('admin', 'hr')
    )
  );
$$;


--
-- Name: can_access_org_data(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_org_data(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.user_is_org_admin(_user_id, _org_id) OR public.user_is_org_member(_user_id, _org_id);
$$;


--
-- Name: can_user_retake_certification(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_user_retake_certification(p_user_id uuid, p_certification_topic_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_last_attempt_date timestamptz;
  v_attempt_count integer;
  v_config jsonb;
  v_cooldown_days integer;
  v_max_retakes integer;
BEGIN
  SELECT config->'retake_settings' INTO v_config
  FROM certification_global_config
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  v_cooldown_days := COALESCE((v_config->>'retake_cooldown_days')::integer, 30);
  v_max_retakes := COALESCE((v_config->>'max_retakes')::integer, 3);
  
  IF NOT COALESCE((v_config->>'allow_retake')::boolean, true) THEN
    RETURN false;
  END IF;
  
  SELECT MAX(ca.created_at), COUNT(*)
  INTO v_last_attempt_date, v_attempt_count
  FROM certification_attempts ca
  JOIN certification_assessments cas ON cas.id = ca.certification_assessment_id
  WHERE ca.user_id = p_user_id
    AND cas.certification_topic_id = p_certification_topic_id;
  
  IF v_attempt_count = 0 THEN
    RETURN true;
  END IF;
  
  IF v_attempt_count >= v_max_retakes THEN
    RETURN false;
  END IF;
  
  IF v_last_attempt_date + (v_cooldown_days || ' days')::interval > now() THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;


--
-- Name: can_view_interview_attempts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_interview_attempts(attempt_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_interview_id uuid;
  v_creator_id uuid;
BEGIN
  SELECT ia.interview_id, i.creator_id
  INTO v_interview_id, v_creator_id
  FROM interview_attempts ia
  JOIN interviews i ON i.id = ia.interview_id
  WHERE ia.id = attempt_id;
  
  RETURN (
    v_creator_id = auth.uid() OR 
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'hr'::app_role])
  );
END;
$$;


--
-- Name: check_and_award_badges(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_award_badges(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cert_count INTEGER;
  v_provider_count INTEGER;
  v_category TEXT;
  v_provider TEXT;
  v_category_count INTEGER;
  v_badge RECORD;
  v_user_certs UUID[];
BEGIN
  SELECT ARRAY_AGG(c.id) INTO v_user_certs
  FROM public.certificates c
  WHERE c.user_id = p_user_id 
    AND c.is_revoked = FALSE 
    AND c.expires_at > NOW();

  v_cert_count := COALESCE(array_length(v_user_certs, 1), 0);

  SELECT COUNT(DISTINCT ct.provider) INTO v_provider_count
  FROM public.certificates c
  JOIN public.certification_topics ct ON ct.id = c.certification_topic_id
  WHERE c.user_id = p_user_id 
    AND c.is_revoked = FALSE 
    AND c.expires_at > NOW();

  FOR v_badge IN SELECT * FROM public.certificate_badges LOOP
    
    IF v_badge.badge_type = 'category_master' THEN
      SELECT COUNT(*) INTO v_category_count
      FROM public.certificates c
      JOIN public.certification_topics ct ON ct.id = c.certification_topic_id
      WHERE c.user_id = p_user_id 
        AND ct.provider = v_badge.category
        AND c.is_revoked = FALSE 
        AND c.expires_at > NOW();
      
      IF v_category_count >= (v_badge.requirements->>'min_certs')::INTEGER THEN
        INSERT INTO public.user_badges (user_id, badge_id, certificate_ids)
        VALUES (p_user_id, v_badge.id, v_user_certs)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    
    ELSIF v_badge.badge_type = 'multi_cert' THEN
      IF v_badge.requirements ? 'min_providers' THEN
        IF v_provider_count >= (v_badge.requirements->>'min_providers')::INTEGER THEN
          INSERT INTO public.user_badges (user_id, badge_id, certificate_ids)
          VALUES (p_user_id, v_badge.id, v_user_certs)
          ON CONFLICT (user_id, badge_id) DO NOTHING;
        END IF;
      ELSIF v_badge.requirements ? 'min_certs' THEN
        IF v_cert_count >= (v_badge.requirements->>'min_certs')::INTEGER THEN
          INSERT INTO public.user_badges (user_id, badge_id, certificate_ids)
          VALUES (p_user_id, v_badge.id, v_user_certs)
          ON CONFLICT (user_id, badge_id) DO NOTHING;
        END IF;
      END IF;
    
    ELSIF v_badge.badge_type = 'perfect_score' THEN
      IF EXISTS (
        SELECT 1 FROM public.certificates
        WHERE user_id = p_user_id 
          AND score >= (v_badge.requirements->>'min_score')::INTEGER
          AND is_revoked = FALSE
      ) THEN
        INSERT INTO public.user_badges (user_id, badge_id, certificate_ids)
        VALUES (p_user_id, v_badge.id, v_user_certs)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: check_architecture_docs_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_architecture_docs_status() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_docs', COUNT(*),
    'last_refresh', MAX(last_generated_at),
    'docs_needing_refresh', COUNT(*) FILTER (WHERE needs_refresh = true),
    'has_file_changes', COUNT(*) FILTER (WHERE file_hashes IS NOT NULL AND needs_refresh = true)
  ) INTO result
  FROM architecture_documents;
  
  RETURN result;
END;
$$;


--
-- Name: check_circuit_breaker(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_circuit_breaker(p_service_name text) RETURNS TABLE(is_open boolean, current_state text, can_attempt boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_state RECORD;
  v_should_try_half_open BOOLEAN;
BEGIN
  -- Get or create circuit breaker state
  SELECT * INTO v_state
  FROM circuit_breaker_state
  WHERE service_name = p_service_name;
  
  IF v_state IS NULL THEN
    -- Create new circuit breaker in closed state
    INSERT INTO circuit_breaker_state (service_name, state)
    VALUES (p_service_name, 'closed')
    RETURNING * INTO v_state;
  END IF;
  
  -- Check if we should transition from open to half-open
  IF v_state.state = 'open' THEN
    v_should_try_half_open := v_state.opened_at + (v_state.timeout_seconds || ' seconds')::interval < now();
    
    IF v_should_try_half_open THEN
      -- Transition to half-open
      UPDATE circuit_breaker_state
      SET state = 'half_open', half_open_at = now()
      WHERE service_name = p_service_name;
      
      RETURN QUERY SELECT FALSE, 'half_open'::TEXT, TRUE;
      RETURN;
    ELSE
      -- Still open, don't allow attempts
      RETURN QUERY SELECT TRUE, 'open'::TEXT, FALSE;
      RETURN;
    END IF;
  END IF;
  
  -- Closed or half-open - allow attempts
  RETURN QUERY SELECT FALSE, v_state.state, TRUE;
END;
$$;


--
-- Name: check_daily_free_assessment_limit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_daily_free_assessment_limit(p_user_id uuid) RETURNS TABLE(can_take_free boolean, free_count integer, free_limit integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_today_count INTEGER;
  v_free_limit INTEGER := 2;
BEGIN
  SELECT COUNT(*)
  INTO v_today_count
  FROM learning_assessment_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE
    AND was_free = true;
  
  RETURN QUERY SELECT 
    v_today_count < v_free_limit AS can_take_free,
    v_today_count AS free_count,
    v_free_limit AS free_limit;
END;
$$;


--
-- Name: check_multi_org_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_multi_org_membership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  existing_org_count INTEGER;
  is_platform_admin BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO existing_org_count
  FROM organization_members
  WHERE user_id = NEW.user_id 
    AND status = 'active'
    AND organization_id != NEW.organization_id;
  
  IF existing_org_count > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.user_id 
        AND role = 'platform_admin'
    ) INTO is_platform_admin;
    
    IF NOT is_platform_admin THEN
      RAISE EXCEPTION 'Only platform admins can be members of multiple organizations';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_rate_limit(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text, p_max_requests integer DEFAULT 60, p_window_seconds integer DEFAULT 60) RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_bucket RECORD;
  v_window_end TIMESTAMPTZ;
  v_remaining INTEGER;
BEGIN
  -- Try to get existing bucket
  SELECT * INTO v_bucket
  FROM rate_limit_buckets
  WHERE identifier = p_identifier AND endpoint = p_endpoint
  FOR UPDATE;
  
  IF v_bucket IS NULL THEN
    -- Create new bucket
    INSERT INTO rate_limit_buckets (identifier, endpoint, max_requests, window_seconds)
    VALUES (p_identifier, p_endpoint, p_max_requests, p_window_seconds);
    
    v_remaining := p_max_requests - 1;
    RETURN QUERY SELECT TRUE, v_remaining, now() + (p_window_seconds || ' seconds')::interval;
    RETURN;
  END IF;
  
  v_window_end := v_bucket.window_start + (v_bucket.window_seconds || ' seconds')::interval;
  
  -- Check if window has expired
  IF now() > v_window_end THEN
    -- Reset the window
    UPDATE rate_limit_buckets
    SET window_start = now(), request_count = 1
    WHERE id = v_bucket.id;
    
    v_remaining := p_max_requests - 1;
    RETURN QUERY SELECT TRUE, v_remaining, now() + (p_window_seconds || ' seconds')::interval;
    RETURN;
  END IF;
  
  -- Check if limit exceeded
  IF v_bucket.request_count >= v_bucket.max_requests THEN
    v_remaining := 0;
    RETURN QUERY SELECT FALSE, v_remaining, v_window_end;
    RETURN;
  END IF;
  
  -- Increment counter
  UPDATE rate_limit_buckets
  SET request_count = request_count + 1
  WHERE id = v_bucket.id;
  
  v_remaining := v_bucket.max_requests - v_bucket.request_count - 1;
  RETURN QUERY SELECT TRUE, v_remaining, v_window_end;
END;
$$;


--
-- Name: check_rls_enabled(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rls_enabled(table_name text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT relrowsecurity FROM pg_class WHERE relname = table_name AND relnamespace = 'public'::regnamespace;
$$;


--
-- Name: check_user_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_exists(user_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Check if user exists in auth.users
  SELECT COUNT(*) INTO user_count
  FROM auth.users
  WHERE email = user_email;
  
  RETURN user_count > 0;
END;
$$;


--
-- Name: cleanup_expired_idempotency_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_idempotency_keys() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM idempotency_keys
  WHERE expires_at < now()
    AND status != 'pending';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


--
-- Name: cleanup_old_proctoring_recordings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_proctoring_recordings() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'storage'
    AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'proctoring-recordings'
  AND created_at < NOW() - INTERVAL '90 days';
  
  INSERT INTO audit_logs (
    action,
    table_name,
    metadata
  ) VALUES (
    'DELETE',
    'storage.objects',
    jsonb_build_object(
      'bucket', 'proctoring-recordings',
      'cleanup_date', NOW(),
      'retention_days', 90
    )
  );
END;
$$;


--
-- Name: cleanup_rate_limit_buckets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_rate_limit_buckets() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_buckets
  WHERE window_start < now() - interval '1 hour';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


--
-- Name: complete_idempotency(uuid, uuid, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_idempotency(p_lock_id uuid, p_resource_id uuid, p_response jsonb, p_success boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE idempotency_keys
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    resource_id = p_resource_id,
    response = p_response,
    completed_at = now()
  WHERE id = p_lock_id;
END;
$$;


--
-- Name: complete_invitation_on_submission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_invitation_on_submission() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'submitted' AND NEW.invitation_id IS NOT NULL 
     AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    UPDATE public.interview_invitations
    SET 
      status = 'completed',
      completed_at = NOW()
    WHERE id = NEW.invitation_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: create_interview_attempt(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_interview_attempt(p_interview_id uuid, p_candidate_name text, p_candidate_email text) RETURNS TABLE(attempt_id uuid, session_token text, success boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
  v_interview_status TEXT;
  v_existing_attempt UUID;
BEGIN
  IF p_candidate_name IS NULL OR LENGTH(TRIM(p_candidate_name)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Name is required';
    RETURN;
  END IF;

  IF p_candidate_email IS NULL OR LENGTH(TRIM(p_candidate_email)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email is required';
    RETURN;
  END IF;

  SELECT status INTO v_interview_status
  FROM public.interviews
  WHERE id = p_interview_id;

  IF v_interview_status IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Interview not found';
    RETURN;
  END IF;

  IF v_interview_status != 'active' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Interview is not active';
    RETURN;
  END IF;

  SELECT id INTO v_existing_attempt
  FROM public.interview_attempts
  WHERE interview_id = p_interview_id
  AND candidate_email = p_candidate_email;

  IF v_existing_attempt IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'You have already taken this assessment. Each candidate can only attempt once.';
    RETURN;
  END IF;

  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.interview_attempts (
    interview_id,
    candidate_name,
    candidate_email,
    status,
    session_token
  ) VALUES (
    p_interview_id,
    TRIM(p_candidate_name),
    TRIM(p_candidate_email),
    'in_progress',
    v_session_token
  )
  RETURNING id INTO v_attempt_id;

  RETURN QUERY SELECT v_attempt_id, v_session_token, TRUE, NULL::TEXT;
END;
$$;


--
-- Name: create_interview_attempt_with_invitation(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_interview_attempt_with_invitation(p_invitation_id uuid, p_candidate_name text, p_candidate_email text) RETURNS TABLE(attempt_id uuid, session_token text, success boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
  v_invitation RECORD;
  v_question_ids uuid[];
BEGIN
  -- Validate inputs
  IF p_candidate_name IS NULL OR LENGTH(TRIM(p_candidate_name)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Name is required';
    RETURN;
  END IF;

  IF p_candidate_email IS NULL OR LENGTH(TRIM(p_candidate_email)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email is required';
    RETURN;
  END IF;

  -- Fetch and validate invitation
  SELECT * INTO v_invitation
  FROM public.interview_invitations
  WHERE id = p_invitation_id;

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Invalid invitation';
    RETURN;
  END IF;

  -- Check if invitation has expired
  IF v_invitation.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Invitation has expired';
    RETURN;
  END IF;

  -- Validate email matches invitation
  IF LOWER(TRIM(p_candidate_email)) != LOWER(TRIM(v_invitation.candidate_email)) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email does not match invitation. Please use the email address that received this invitation.';
    RETURN;
  END IF;

  -- Check if invitation already used
  IF v_invitation.status = 'completed' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'This invitation has already been used. Each candidate can only attempt once.';
    RETURN;
  END IF;

  -- Check if interview is active
  IF NOT EXISTS (
    SELECT 1 FROM public.interviews 
    WHERE id = v_invitation.interview_id 
    AND status = 'active'
  ) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Interview is not active';
    RETURN;
  END IF;

  -- Generate session token
  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- Create interview attempt with invitation link
  INSERT INTO public.interview_attempts (
    interview_id,
    invitation_id,
    candidate_name,
    candidate_email,
    status,
    session_token
  ) VALUES (
    v_invitation.interview_id,
    p_invitation_id,
    TRIM(p_candidate_name),
    TRIM(p_candidate_email),
    'in_progress',
    v_session_token
  )
  RETURNING id INTO v_attempt_id;

  -- Update invitation status to 'accessed'
  UPDATE public.interview_invitations
  SET 
    status = 'accessed',
    accessed_at = NOW()
  WHERE id = p_invitation_id;

  -- Extract selected question IDs from invitation metadata
  v_question_ids := ARRAY(
    SELECT jsonb_array_elements_text(v_invitation.metadata->'selected_question_ids')::uuid
  );

  -- Populate attempt_questions with pre-selected questions
  INSERT INTO public.attempt_questions (attempt_id, question_id, display_order)
  SELECT 
    v_attempt_id,
    unnest(v_question_ids),
    generate_series(0, array_length(v_question_ids, 1) - 1);

  RETURN QUERY SELECT v_attempt_id, v_session_token, TRUE, NULL::TEXT;
END;
$$;


--
-- Name: create_notification(uuid, uuid, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_organization_id uuid, p_type text, p_title text, p_message text, p_link text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    organization_id,
    type,
    title,
    message,
    link,
    metadata
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_type,
    p_title,
    p_message,
    p_link,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;


--
-- Name: decrypt_api_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrypt_api_key(encrypted_key text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  decrypted_key TEXT;
  encryption_key_id UUID;
BEGIN
  SELECT id INTO encryption_key_id
  FROM pgsodium.valid_key
  WHERE name = 'api_key_encryption'
  LIMIT 1;
  
  IF encryption_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  decrypted_key := convert_from(
    pgsodium.crypto_aead_det_decrypt(
      decode(encrypted_key, 'base64'),
      NULL::bytea,
      encryption_key_id::uuid,
      NULL::bytea
    ),
    'UTF8'
  );
  
  RETURN decrypted_key;
END;
$$;


--
-- Name: delete_interview_tx(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_interview_tx(p_interview_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_interview RECORD;
  v_attempt_ids uuid[];
  v_session_ids uuid[];
  v_deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Verify interview exists
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id;
  IF v_interview IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  -- Collect attempt IDs
  SELECT array_agg(id) INTO v_attempt_ids FROM interview_attempts WHERE interview_id = p_interview_id;

  IF v_attempt_ids IS NOT NULL THEN
    -- Get session IDs
    SELECT array_agg(id) INTO v_session_ids FROM proctoring_sessions WHERE interview_attempt_id = ANY(v_attempt_ids);

    -- Delete proctoring data
    IF v_session_ids IS NOT NULL THEN
      DELETE FROM proctoring_violations WHERE session_id = ANY(v_session_ids);
      DELETE FROM proctoring_sessions WHERE id = ANY(v_session_ids);
    END IF;

    -- Delete attempt-related data
    DELETE FROM assessments WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM candidate_performance_index WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM bias_detection_results WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM panel_evaluations WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM panel_consensus WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM attempt_questions WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM ai_coach_sessions WHERE attempt_id = ANY(v_attempt_ids);

    -- Delete attempts
    DELETE FROM interview_attempts WHERE interview_id = p_interview_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('attempts', v_count);
  END IF;

  -- Delete invitations
  DELETE FROM interview_invitations WHERE interview_id = p_interview_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('invitations', v_count);

  -- Delete questions
  DELETE FROM questions WHERE interview_id = p_interview_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('questions', v_count);

  -- Delete interview panel members
  DELETE FROM interview_panel_members WHERE interview_id = p_interview_id;

  -- Delete operation logs
  DELETE FROM interview_operation_logs WHERE interview_id = p_interview_id;

  -- Delete collaboration threads
  DELETE FROM collaboration_threads WHERE entity_type = 'interview' AND entity_id = p_interview_id;

  -- Finally delete interview
  DELETE FROM interviews WHERE id = p_interview_id;

  RETURN jsonb_build_object(
    'success', true,
    'interview_title', v_interview.title,
    'deleted_counts', v_deleted_counts
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Interview deletion failed: %', SQLERRM;
END;
$$;


--
-- Name: delete_organization_tx(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_organization_tx(p_organization_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org RECORD;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_interview_ids uuid[];
  v_attempt_ids uuid[];
  v_session_ids uuid[];
  v_count integer;
BEGIN
  -- Verify organization exists
  SELECT * INTO v_org FROM organizations WHERE id = p_organization_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Collect IDs for cascading deletes
  SELECT array_agg(id) INTO v_interview_ids FROM interviews WHERE organization_id = p_organization_id;
  
  IF v_interview_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_attempt_ids FROM interview_attempts WHERE interview_id = ANY(v_interview_ids);
    
    IF v_attempt_ids IS NOT NULL THEN
      SELECT array_agg(id) INTO v_session_ids FROM proctoring_sessions WHERE interview_attempt_id = ANY(v_attempt_ids);
      
      -- Delete proctoring violations
      IF v_session_ids IS NOT NULL THEN
        DELETE FROM proctoring_violations WHERE session_id = ANY(v_session_ids);
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('proctoring_violations', v_count);
      END IF;
      
      -- Delete proctoring sessions
      DELETE FROM proctoring_sessions WHERE interview_attempt_id = ANY(v_attempt_ids);
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_deleted_counts := v_deleted_counts || jsonb_build_object('proctoring_sessions', v_count);
      
      -- Delete assessments and related
      DELETE FROM bias_detection_results WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM candidate_performance_index WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM assessments WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM panel_evaluations WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM panel_consensus WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM attempt_questions WHERE attempt_id = ANY(v_attempt_ids);
    END IF;
    
    -- Delete interview attempts
    DELETE FROM interview_attempts WHERE interview_id = ANY(v_interview_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('interview_attempts', v_count);
    
    -- Delete invitations
    DELETE FROM interview_invitations WHERE interview_id = ANY(v_interview_ids);
    
    -- Delete questions
    DELETE FROM questions WHERE interview_id = ANY(v_interview_ids);
    
    -- Delete interviews
    DELETE FROM interviews WHERE id = ANY(v_interview_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('interviews', v_count);
  END IF;

  -- Delete ATS data
  DELETE FROM ats_sync_logs WHERE integration_id IN (SELECT id FROM ats_integrations WHERE organization_id = p_organization_id);
  DELETE FROM ats_candidates WHERE integration_id IN (SELECT id FROM ats_integrations WHERE organization_id = p_organization_id);
  DELETE FROM ats_integrations WHERE organization_id = p_organization_id;

  -- Delete billing data
  DELETE FROM invoices WHERE organization_id = p_organization_id;
  DELETE FROM payment_transactions WHERE organization_id = p_organization_id;
  DELETE FROM promotion_usages WHERE organization_id = p_organization_id;
  DELETE FROM organization_subscriptions WHERE organization_id = p_organization_id;

  -- Delete user associations
  DELETE FROM user_roles WHERE organization_id = p_organization_id;
  DELETE FROM organization_members WHERE organization_id = p_organization_id;

  -- Delete analytics and logs
  DELETE FROM analytics_snapshots WHERE organization_id = p_organization_id;
  DELETE FROM comparative_analytics WHERE organization_id = p_organization_id;
  DELETE FROM usage_tracking WHERE organization_id = p_organization_id;
  DELETE FROM data_retention_policies WHERE organization_id = p_organization_id;
  DELETE FROM activity_feed WHERE organization_id = p_organization_id;
  DELETE FROM notifications WHERE organization_id = p_organization_id;

  -- Finally delete organization
  DELETE FROM organizations WHERE id = p_organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_name', v_org.name,
    'deleted_counts', v_deleted_counts
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Organization deletion failed: %', SQLERRM;
END;
$$;


--
-- Name: delete_user_cascade_tx(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_cascade_tx(p_user_id uuid, p_elevate_admins boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user RECORD;
  v_org RECORD;
  v_new_admin_id uuid;
  v_elevated_orgs text[] := '{}';
BEGIN
  -- Verify user exists
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Handle organizations where user is sole partner_admin
  IF p_elevate_admins THEN
    FOR v_org IN 
      SELECT DISTINCT om.organization_id, o.name as org_name
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      JOIN user_roles ur ON ur.user_id = om.user_id AND ur.role = 'partner_admin'
      WHERE om.user_id = p_user_id AND om.status = 'active'
    LOOP
      -- Check if sole admin
      IF (SELECT COUNT(*) FROM user_roles WHERE organization_id = v_org.organization_id AND role = 'partner_admin') = 1 THEN
        -- Find earliest other active member to elevate
        SELECT om.user_id INTO v_new_admin_id
        FROM organization_members om
        WHERE om.organization_id = v_org.organization_id
          AND om.user_id != p_user_id
          AND om.status = 'active'
        ORDER BY om.joined_at ASC
        LIMIT 1;

        IF v_new_admin_id IS NOT NULL THEN
          -- Elevate to partner_admin
          INSERT INTO user_roles (user_id, role, organization_id)
          VALUES (v_new_admin_id, 'partner_admin', v_org.organization_id)
          ON CONFLICT (user_id, role) DO NOTHING;
          
          v_elevated_orgs := array_append(v_elevated_orgs, v_org.org_name);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Delete user's roles
  DELETE FROM user_roles WHERE user_id = p_user_id;

  -- Delete organization memberships
  DELETE FROM organization_members WHERE user_id = p_user_id;

  -- Delete notifications
  DELETE FROM notifications WHERE user_id = p_user_id;

  -- Delete onboarding progress
  DELETE FROM onboarding_progress WHERE user_id = p_user_id;

  -- Delete learning data
  DELETE FROM learning_subscriptions WHERE user_id = p_user_id;
  DELETE FROM learning_assessment_usage WHERE user_id = p_user_id;

  -- Delete custom role assignments
  DELETE FROM user_custom_roles WHERE user_id = p_user_id;

  -- Delete user badges
  DELETE FROM user_badges WHERE user_id = p_user_id;

  -- Finally delete profile
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_email', v_user.email,
    'elevated_orgs', v_elevated_orgs
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'User deletion failed: %', SQLERRM;
END;
$$;


--
-- Name: delete_user_cascade_tx(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_cascade_tx(p_user_id uuid, p_admin_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_memberships RECORD;
  v_user_roles RECORD;
  v_is_partner_admin BOOLEAN := false;
  v_elevations jsonb := '[]'::jsonb;
  v_earliest_member RECORD;
  v_data_dependencies text[] := '{}';
  v_cleanup_count integer;
BEGIN
  -- Check if user has partner_admin role
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'partner_admin'
  ) INTO v_is_partner_admin;

  -- Process each active organization membership
  FOR v_memberships IN 
    SELECT om.organization_id, o.name as org_name
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id AND om.status = 'active'
  LOOP
    -- If user is partner_admin, check if we need to elevate someone
    IF v_is_partner_admin THEN
      -- Check if there are other partner_admins in this org
      IF NOT EXISTS (
        SELECT 1 FROM organization_members om
        JOIN user_roles ur ON ur.user_id = om.user_id
        WHERE om.organization_id = v_memberships.organization_id
          AND om.status = 'active'
          AND om.user_id != p_user_id
          AND ur.role = 'partner_admin'
      ) THEN
        -- Find earliest joined member to elevate
        SELECT om.user_id, p.email, p.full_name
        INTO v_earliest_member
        FROM organization_members om
        JOIN profiles p ON p.id = om.user_id
        WHERE om.organization_id = v_memberships.organization_id
          AND om.status = 'active'
          AND om.user_id != p_user_id
        ORDER BY om.joined_at ASC
        LIMIT 1;

        IF v_earliest_member.user_id IS NOT NULL THEN
          -- Elevate this user to partner_admin
          INSERT INTO user_roles (user_id, role, organization_id)
          VALUES (v_earliest_member.user_id, 'partner_admin', v_memberships.organization_id)
          ON CONFLICT (user_id, role) DO NOTHING;

          v_elevations := v_elevations || jsonb_build_object(
            'org_id', v_memberships.organization_id,
            'org_name', v_memberships.org_name,
            'new_admin_id', v_earliest_member.user_id,
            'new_admin_email', v_earliest_member.email
          );
        END IF;
      END IF;
    END IF;

    -- Mark membership as inactive
    UPDATE organization_members
    SET status = 'inactive'
    WHERE user_id = p_user_id AND organization_id = v_memberships.organization_id;
  END LOOP;

  -- Check for data dependencies that prevent deletion
  IF EXISTS (SELECT 1 FROM interviews WHERE creator_id = p_user_id LIMIT 1) THEN
    v_data_dependencies := array_append(v_data_dependencies, 'interviews created by user');
  END IF;

  IF EXISTS (SELECT 1 FROM learning_assessments WHERE user_id = p_user_id LIMIT 1) THEN
    v_data_dependencies := array_append(v_data_dependencies, 'learning assessments');
  END IF;

  IF EXISTS (SELECT 1 FROM certificates WHERE user_id = p_user_id LIMIT 1) THEN
    v_data_dependencies := array_append(v_data_dependencies, 'certificates');
  END IF;

  IF EXISTS (SELECT 1 FROM learning_assessment_attempts WHERE user_id = p_user_id LIMIT 1) THEN
    v_data_dependencies := array_append(v_data_dependencies, 'assessment attempts');
  END IF;

  IF array_length(v_data_dependencies, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot delete user: has existing data: %', array_to_string(v_data_dependencies, ', ');
  END IF;

  -- Clean up user data from all related tables
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM user_custom_roles WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM onboarding_progress WHERE user_id = p_user_id;
  DELETE FROM security_events WHERE user_id = p_user_id;
  DELETE FROM user_topic_progress WHERE user_id = p_user_id;
  DELETE FROM user_badges WHERE user_id = p_user_id;
  DELETE FROM learning_payments WHERE user_id = p_user_id;
  DELETE FROM learning_subscriptions WHERE user_id = p_user_id;
  DELETE FROM learning_assessment_usage WHERE user_id = p_user_id;
  DELETE FROM password_setup_invitations WHERE user_id = p_user_id;

  -- Delete all organization memberships (now inactive)
  DELETE FROM organization_members WHERE user_id = p_user_id;

  -- Delete profile
  DELETE FROM profiles WHERE id = p_user_id;

  -- Log audit
  INSERT INTO audit_logs (action, table_name, record_id, user_id, metadata)
  VALUES (
    'USER_CASCADE_DELETE',
    'profiles',
    p_user_id::text,
    p_admin_user_id,
    jsonb_build_object('elevations', v_elevations)
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'elevations', v_elevations
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'User cascade deletion failed: %', SQLERRM;
END;
$$;


--
-- Name: encrypt_api_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_api_key(api_key text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  encrypted_key TEXT;
  encryption_key_id UUID;
BEGIN
  SELECT id INTO encryption_key_id
  FROM pgsodium.valid_key
  WHERE name = 'api_key_encryption'
  LIMIT 1;
  
  IF encryption_key_id IS NULL THEN
    encryption_key_id := pgsodium.create_key(name := 'api_key_encryption');
  END IF;
  
  encrypted_key := encode(
    pgsodium.crypto_aead_det_encrypt(
      api_key::bytea,
      NULL::bytea,
      encryption_key_id::uuid,
      NULL::bytea
    ),
    'base64'
  );
  
  RETURN encrypted_key;
END;
$$;


--
-- Name: encrypt_api_key_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_api_key_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
BEGIN
  IF NEW.api_key_encrypted IS NOT NULL 
     AND NEW.api_key_encrypted !~ '^[A-Za-z0-9+/]+=*$' THEN
    NEW.api_key_encrypted := public.encrypt_api_key(NEW.api_key_encrypted);
  END IF;
  RETURN NEW;
END;
$_$;


--
-- Name: enqueue_failed_job(text, text, jsonb, text, text, text, uuid, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_failed_job(p_job_type text, p_job_id text, p_payload jsonb, p_error_message text, p_error_stack text DEFAULT NULL::text, p_source_function text DEFAULT NULL::text, p_organization_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_correlation_id text DEFAULT NULL::text, p_max_attempts integer DEFAULT 3) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_job_id UUID;
  v_next_retry TIMESTAMPTZ;
BEGIN
  -- Calculate next retry time (exponential: 5min, 15min, 45min)
  v_next_retry := now() + (interval '5 minutes' * power(3, 0));
  
  INSERT INTO failed_jobs (
    job_type, job_id, payload, error_message, error_stack,
    source_function, organization_id, user_id, correlation_id,
    max_attempts, next_retry_at
  )
  VALUES (
    p_job_type, p_job_id, p_payload, p_error_message, p_error_stack,
    p_source_function, p_organization_id, p_user_id, p_correlation_id,
    p_max_attempts, v_next_retry
  )
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;


--
-- Name: execute_data_retention_cleanup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_data_retention_cleanup() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'storage'
    AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_proctoring_deleted integer := 0;
  v_audit_deleted integer := 0;
  v_email_deleted integer := 0;
  v_notifications_deleted integer := 0;
  v_policy RECORD;
  v_cutoff_date timestamptz;
BEGIN
  -- Process each active retention policy
  FOR v_policy IN 
    SELECT data_type, retention_days 
    FROM data_retention_policies 
    WHERE auto_delete_enabled = true 
      AND organization_id IS NULL  -- Global policies only
  LOOP
    v_cutoff_date := NOW() - (v_policy.retention_days || ' days')::interval;
    
    CASE v_policy.data_type
      -- Proctoring recordings (storage bucket cleanup)
      WHEN 'proctoring_recordings' THEN
        DELETE FROM storage.objects
        WHERE bucket_id = 'proctoring-recordings'
          AND created_at < v_cutoff_date;
        GET DIAGNOSTICS v_proctoring_deleted = ROW_COUNT;
        
        -- Also update proctoring_sessions to clear URLs for deleted recordings
        UPDATE proctoring_sessions
        SET 
          video_recording_url = NULL,
          screen_recording_url = NULL
        WHERE created_at < v_cutoff_date
          AND (video_recording_url IS NOT NULL OR screen_recording_url IS NOT NULL);
      
      -- Audit logs cleanup
      WHEN 'audit_logs' THEN
        DELETE FROM audit_logs
        WHERE created_at < v_cutoff_date;
        GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;
      
      -- Email logs cleanup
      WHEN 'email_logs' THEN
        DELETE FROM email_logs
        WHERE created_at < v_cutoff_date;
        GET DIAGNOSTICS v_email_deleted = ROW_COUNT;
      
      -- Notifications cleanup
      WHEN 'notifications' THEN
        DELETE FROM notifications
        WHERE created_at < v_cutoff_date
          AND is_read = true;  -- Only delete read notifications
        GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;
      
      ELSE
        -- Unknown data type, skip
        CONTINUE;
    END CASE;
    
    -- Update last_cleanup_at for this policy
    UPDATE data_retention_policies
    SET last_cleanup_at = NOW()
    WHERE data_type = v_policy.data_type
      AND organization_id IS NULL;
  END LOOP;
  
  -- Build result summary
  v_result := jsonb_build_object(
    'executed_at', NOW(),
    'proctoring_recordings_deleted', v_proctoring_deleted,
    'audit_logs_deleted', v_audit_deleted,
    'email_logs_deleted', v_email_deleted,
    'notifications_deleted', v_notifications_deleted,
    'total_deleted', v_proctoring_deleted + v_audit_deleted + v_email_deleted + v_notifications_deleted
  );
  
  -- Log the cleanup operation to audit_logs (meta-logging)
  INSERT INTO audit_logs (
    action,
    table_name,
    metadata
  ) VALUES (
    'DATA_RETENTION_CLEANUP',
    'multiple',
    v_result
  );
  
  RETURN v_result;
END;
$$;


--
-- Name: finalize_proctored_submission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_proctored_submission(p_session_token text) RETURNS TABLE(success boolean, attempt_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt_id UUID;
  v_status TEXT;
BEGIN
  IF p_session_token IS NULL OR LENGTH(p_session_token) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- Get attempt by session token
  SELECT id, status INTO v_attempt_id, v_status
  FROM public.interview_attempts
  WHERE session_token = p_session_token
  AND session_token IS NOT NULL
  AND LENGTH(session_token) > 0;

  IF v_attempt_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- Only finalize if currently in pending_upload status
  IF v_status != 'pending_upload' THEN
    -- If already submitted/evaluated, return success (idempotent)
    IF v_status IN ('submitted', 'evaluated') THEN
      RETURN QUERY SELECT TRUE, v_attempt_id;
      RETURN;
    END IF;
    RETURN QUERY SELECT FALSE, v_attempt_id;
    RETURN;
  END IF;

  -- Move to submitted - this triggers the evaluation
  UPDATE public.interview_attempts
  SET status = 'submitted'
  WHERE id = v_attempt_id;

  RETURN QUERY SELECT TRUE, v_attempt_id;
END;
$$;


--
-- Name: generate_certificate_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_certificate_number() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  cert_number TEXT;
  year_suffix TEXT;
BEGIN
  year_suffix := TO_CHAR(NOW(), 'YY');
  cert_number := 'CERT-' || year_suffix || '-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  RETURN cert_number;
END;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  next_number INTEGER;
  invoice_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  RETURN invoice_num;
EXCEPTION WHEN undefined_table THEN
  RETURN 'INV-000001';
END;
$_$;


--
-- Name: generate_invoice_tx(uuid, uuid, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_tx(p_organization_id uuid, p_subscription_id uuid, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_line_items jsonb, p_amount_cents integer, p_tax_cents integer DEFAULT 0, p_notes text DEFAULT NULL::text, p_promotion_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invoice_number text;
  v_invoice_id uuid;
  v_total_cents integer;
  v_discount_cents integer := 0;
BEGIN
  -- Generate invoice number
  v_invoice_number := generate_invoice_number();
  v_total_cents := p_amount_cents + p_tax_cents;

  -- Apply promotion if provided
  IF p_promotion_id IS NOT NULL THEN
    -- Calculate discount (simplified - could be more complex)
    SELECT COALESCE(
      CASE 
        WHEN discount_type = 'percentage' THEN (p_amount_cents * discount_value / 100)::integer
        ELSE discount_value::integer
      END, 0
    ) INTO v_discount_cents
    FROM promotions WHERE id = p_promotion_id AND is_active = true;
    
    v_total_cents := GREATEST(0, v_total_cents - v_discount_cents);
  END IF;

  -- Create invoice
  INSERT INTO invoices (
    organization_id, subscription_id, invoice_number,
    period_start, period_end, amount_cents, tax_cents, total_cents,
    line_items, due_date, status, notes, applied_promotion_id
  )
  VALUES (
    p_organization_id, p_subscription_id, v_invoice_number,
    p_period_start, p_period_end, p_amount_cents, p_tax_cents, v_total_cents,
    p_line_items, p_period_end + interval '30 days', 'pending', p_notes, p_promotion_id
  )
  RETURNING id INTO v_invoice_id;

  -- Record promotion usage if applied
  IF p_promotion_id IS NOT NULL AND v_discount_cents > 0 THEN
    INSERT INTO promotion_usages (
      promotion_id, organization_id, subscription_id,
      discount_applied_cents, original_amount_cents, final_amount_cents
    )
    VALUES (
      p_promotion_id, p_organization_id, p_subscription_id,
      v_discount_cents, p_amount_cents + p_tax_cents, v_total_cents
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total_cents', v_total_cents,
    'discount_applied', v_discount_cents
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Invoice generation failed: %', SQLERRM;
END;
$$;


--
-- Name: generate_invoice_tx(uuid, uuid, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_tx(p_organization_id uuid, p_subscription_id uuid, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_line_items jsonb, p_amount_cents integer, p_tax_cents integer DEFAULT 0, p_notes text DEFAULT NULL::text, p_promotion_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invoice_number TEXT;
  v_invoice_id UUID;
  v_total_cents INTEGER;
  v_discount_cents INTEGER := 0;
  v_existing_invoice RECORD;
BEGIN
  -- Check for existing invoice with same idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_invoice
    FROM invoices
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_invoice IS NOT NULL THEN
      -- Return existing invoice (idempotent)
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'invoice_id', v_existing_invoice.id,
        'invoice_number', v_existing_invoice.invoice_number,
        'total_cents', v_existing_invoice.total_cents,
        'discount_applied', 0
      );
    END IF;
  END IF;

  -- Generate invoice number
  v_invoice_number := generate_invoice_number();
  v_total_cents := p_amount_cents + p_tax_cents;

  -- Apply promotion if provided
  IF p_promotion_id IS NOT NULL THEN
    SELECT COALESCE(
      CASE 
        WHEN discount_type = 'percentage' THEN (p_amount_cents * discount_value / 100)::integer
        ELSE discount_value::integer
      END, 0
    ) INTO v_discount_cents
    FROM promotions WHERE id = p_promotion_id AND is_active = true;
    
    v_total_cents := GREATEST(0, v_total_cents - v_discount_cents);
  END IF;

  -- Create invoice with idempotency key
  INSERT INTO invoices (
    organization_id, subscription_id, invoice_number,
    period_start, period_end, amount_cents, tax_cents, total_cents,
    line_items, due_date, status, notes, applied_promotion_id, idempotency_key
  )
  VALUES (
    p_organization_id, p_subscription_id, v_invoice_number,
    p_period_start, p_period_end, p_amount_cents, p_tax_cents, v_total_cents,
    p_line_items, p_period_end + interval '30 days', 'pending', p_notes, p_promotion_id, p_idempotency_key
  )
  RETURNING id INTO v_invoice_id;

  -- Record promotion usage if applied
  IF p_promotion_id IS NOT NULL AND v_discount_cents > 0 THEN
    INSERT INTO promotion_usages (
      promotion_id, organization_id, subscription_id,
      discount_applied_cents, original_amount_cents, final_amount_cents
    )
    VALUES (
      p_promotion_id, p_organization_id, p_subscription_id,
      v_discount_cents, p_amount_cents + p_tax_cents, v_total_cents
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total_cents', v_total_cents,
    'discount_applied', v_discount_cents
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Invoice generation failed: %', SQLERRM;
END;
$$;


--
-- Name: generate_session_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_session_token() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$;


--
-- Name: generate_share_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_share_token() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random token (12 characters)
    token := encode(gen_random_bytes(9), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := substring(token, 1, 12);
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM interview_invitations WHERE share_token = token) INTO exists;
    
    -- If it doesn't exist, return it
    IF NOT exists THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: generate_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_slug(input_text text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  base_slug TEXT;
  random_suffix TEXT;
BEGIN
  base_slug := lower(regexp_replace(input_text, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 50);
  random_suffix := lower(substring(md5(random()::text) from 1 for 4));
  RETURN base_slug || '-' || random_suffix;
END;
$$;


--
-- Name: generate_verification_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_verification_code() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
END;
$$;


--
-- Name: get_active_learning_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_learning_subscription(p_user_id uuid) RETURNS TABLE(subscription_id uuid, plan_type text, is_unlimited boolean, amount_spent_cents integer, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.id,
    ls.plan_type,
    ls.is_unlimited,
    ls.amount_spent_cents,
    ls.expires_at
  FROM learning_subscriptions ls
  WHERE ls.user_id = p_user_id
    AND ls.status = 'active'
    AND ls.expires_at > now()
  ORDER BY ls.created_at DESC
  LIMIT 1;
END;
$$;


--
-- Name: get_assessment_questions_for_attempt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_assessment_questions_for_attempt(p_attempt_id uuid) RETURNS TABLE(id uuid, assessment_id uuid, question_text text, question_type text, topic text, difficulty text, options jsonb, hints text, order_index integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.learning_assessment_attempts
    WHERE learning_assessment_attempts.id = p_attempt_id
    AND learning_assessment_attempts.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to assessment questions';
  END IF;

  RETURN QUERY
  SELECT 
    q.id,
    q.assessment_id,
    q.question_text,
    q.question_type,
    q.topic,
    q.difficulty,
    q.options,
    q.hints,
    q.order_index
  FROM public.learning_assessment_questions q
  WHERE q.assessment_id = (
    SELECT assessment_id FROM public.learning_assessment_attempts
    WHERE id = p_attempt_id
  )
  ORDER BY q.order_index;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: interview_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    candidate_name text NOT NULL,
    candidate_email text NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    time_taken integer,
    status text DEFAULT 'in_progress'::text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    session_token text,
    invitation_id uuid,
    CONSTRAINT interview_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'pending_upload'::text, 'submitted'::text, 'evaluated'::text])))
);


--
-- Name: get_attempt_by_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_attempt_by_session(token text) RETURNS SETOF public.interview_attempts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.interview_attempts
  WHERE session_token = token
  AND session_token IS NOT NULL
  AND LENGTH(session_token) > 0;
END;
$$;


--
-- Name: get_custom_role_permissions(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_custom_role_permissions(_user_id uuid, _org_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE result JSONB := '{}'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(cr.permissions), '[]'::jsonb) INTO result
  FROM public.user_custom_roles ucr JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id
  WHERE ucr.user_id = _user_id AND cr.is_active = true AND (_org_id IS NULL OR ucr.organization_id = _org_id);
  RETURN result;
END; $$;


--
-- Name: get_failed_job_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_failed_job_stats() RETURNS TABLE(job_type text, total_count bigint, failed_count bigint, retrying_count bigint, recovered_count bigint, abandoned_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    job_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'retrying') as retrying_count,
    COUNT(*) FILTER (WHERE status = 'recovered') as recovered_count,
    COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_count
  FROM failed_jobs
  GROUP BY job_type
  ORDER BY total_count DESC;
$$;


--
-- Name: get_interview_for_candidate(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_interview_for_candidate(share_link_param text) RETURNS TABLE(id uuid, title text, question_count integer, time_limit integer, status text, share_link text, job_description_preview text, proctoring_enabled boolean, proctoring_settings jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.title,
    i.question_count,
    i.time_limit,
    i.status,
    i.share_link,
    SUBSTRING(i.job_description, 1, 300) || '...' AS job_description_preview,
    i.proctoring_enabled,
    i.proctoring_settings
  FROM public.interviews i
  WHERE i.share_link = share_link_param
  AND i.status = 'active'
  LIMIT 1;
END;
$$;


--
-- Name: get_questions_for_attempt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_questions_for_attempt(p_attempt_id uuid) RETURNS TABLE(id uuid, interview_id uuid, question_text text, topic text, difficulty text, question_type text, options jsonb, order_index integer, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_interview_id uuid;
  v_interview_status text;
  v_question_count integer;
  v_attempt_status text;
BEGIN
  -- Get attempt info
  SELECT 
    ia.interview_id,
    ia.status
  INTO 
    v_interview_id,
    v_attempt_status
  FROM public.interview_attempts ia
  WHERE ia.id = p_attempt_id;

  IF v_interview_id IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;

  IF v_attempt_status != 'in_progress' AND v_attempt_status != 'completed' THEN
    RAISE EXCEPTION 'Invalid attempt status';
  END IF;

  -- Get interview info
  SELECT 
    i.status,
    i.question_count
  INTO 
    v_interview_status,
    v_question_count
  FROM public.interviews i
  WHERE i.id = v_interview_id;

  IF v_interview_status IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF v_interview_status != 'active' THEN
    RAISE EXCEPTION 'Interview is not active';
  END IF;

  -- Check if questions already assigned to this attempt
  IF EXISTS (
    SELECT 1 FROM public.attempt_questions 
    WHERE attempt_id = p_attempt_id
  ) THEN
    -- Return existing questions sorted by type then display_order
    RETURN QUERY
    SELECT 
      q.id,
      q.interview_id,
      q.question_text,
      q.topic,
      q.difficulty,
      q.question_type,
      q.options,
      aq.display_order as order_index,
      q.created_at
    FROM public.questions q
    INNER JOIN public.attempt_questions aq ON q.id = aq.question_id
    WHERE aq.attempt_id = p_attempt_id
    ORDER BY 
      CASE q.question_type
        WHEN 'mcq' THEN 1
        WHEN 'descriptive' THEN 2
        WHEN 'scenario' THEN 3
        WHEN 'coding' THEN 4
        ELSE 5
      END,
      aq.display_order;
  ELSE
    -- Select random questions and assign them with type-based ordering
    WITH selected_questions AS (
      SELECT 
        q.id,
        q.question_type,
        ROW_NUMBER() OVER (
          ORDER BY 
            CASE q.question_type
              WHEN 'mcq' THEN 1
              WHEN 'descriptive' THEN 2
              WHEN 'scenario' THEN 3
              WHEN 'coding' THEN 4
              ELSE 5
            END,
            RANDOM()
        ) as display_order
      FROM public.questions q
      WHERE q.interview_id = v_interview_id
      ORDER BY RANDOM()
      LIMIT v_question_count
    ),
    -- Re-order the selected questions by type
    ordered_questions AS (
      SELECT 
        sq.id,
        ROW_NUMBER() OVER (
          ORDER BY 
            CASE sq.question_type
              WHEN 'mcq' THEN 1
              WHEN 'descriptive' THEN 2
              WHEN 'scenario' THEN 3
              WHEN 'coding' THEN 4
              ELSE 5
            END
        ) as display_order
      FROM selected_questions sq
    )
    INSERT INTO public.attempt_questions (attempt_id, question_id, display_order)
    SELECT 
      p_attempt_id,
      oq.id,
      oq.display_order
    FROM ordered_questions oq;

    -- Return questions sorted by type
    RETURN QUERY
    SELECT 
      q.id,
      q.interview_id,
      q.question_text,
      q.topic,
      q.difficulty,
      q.question_type,
      q.options,
      aq.display_order as order_index,
      q.created_at
    FROM public.questions q
    INNER JOIN public.attempt_questions aq ON q.id = aq.question_id
    WHERE aq.attempt_id = p_attempt_id
    ORDER BY 
      CASE q.question_type
        WHEN 'mcq' THEN 1
        WHEN 'descriptive' THEN 2
        WHEN 'scenario' THEN 3
        WHEN 'coding' THEN 4
        ELSE 5
      END,
      aq.display_order;
  END IF;
END;
$$;


--
-- Name: get_random_questions_for_attempt(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_random_questions_for_attempt(interview_uuid uuid, attempt_uuid uuid, num_questions integer) RETURNS TABLE(id uuid, interview_id uuid, question_text text, topic text, difficulty text, options jsonb, order_index integer, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Verify interview exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.interviews 
    WHERE interviews.id = interview_uuid 
    AND interviews.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Interview not found or not active';
  END IF;

  -- Verify attempt exists
  IF NOT EXISTS (
    SELECT 1 FROM public.interview_attempts
    WHERE interview_attempts.id = attempt_uuid
    AND interview_attempts.interview_id = interview_uuid
  ) THEN
    RAISE EXCEPTION 'Interview attempt not found';
  END IF;

  -- Return random questions WITHOUT correct_answer field
  -- Randomly select the requested number from the question bank
  RETURN QUERY
  SELECT 
    q.id,
    q.interview_id,
    q.question_text,
    q.topic,
    q.difficulty,
    q.options,
    q.order_index,
    q.created_at
  FROM public.questions q
  WHERE q.interview_id = interview_uuid
  ORDER BY RANDOM()
  LIMIT num_questions;
END;
$$;


--
-- Name: get_retryable_jobs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_retryable_jobs(p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, job_type text, job_id text, payload jsonb, attempt_count integer, max_attempts integer, source_function text, correlation_id text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fj.id,
    fj.job_type,
    fj.job_id,
    fj.payload,
    fj.attempt_count,
    fj.max_attempts,
    fj.source_function,
    fj.correlation_id
  FROM failed_jobs fj
  WHERE fj.status = 'failed'
    AND fj.attempt_count < fj.max_attempts
    AND fj.next_retry_at <= now()
  ORDER BY fj.next_retry_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$;


--
-- Name: get_tech_spocs_for_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tech_spocs_for_org(_org_id uuid) RETURNS TABLE(user_id uuid, full_name text, email text, is_global boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT
    ur.user_id,
    p.full_name,
    p.email,
    (ur.organization_id IS NULL) as is_global
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'tech_spoc'
    AND (ur.organization_id IS NULL OR ur.organization_id = _org_id)
  ORDER BY is_global DESC, p.full_name;
$$;


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_roles(_user_id uuid) RETURNS SETOF public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = COALESCE(
      EXCLUDED.full_name,
      profiles.full_name,
      split_part(new.email, '@', 1)
    ),
    email = COALESCE(EXCLUDED.email, profiles.email);
  RETURN new;
END;
$$;


--
-- Name: has_action_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_action_permission(_user_id uuid, _action_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    CROSS JOIN unnest(rp.allowed_roles) AS allowed_role
    WHERE rp.action_name = _action_name
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role = allowed_role
      )
  )
$$;


--
-- Name: has_any_role(uuid, public.app_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;


--
-- Name: has_any_role_with_hierarchy(uuid, public.app_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_any_role_with_hierarchy(_user_id uuid, _roles public.app_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND (
      role = ANY(_roles)
      OR role = 'platform_admin'  -- Platform admin has access to everything
    )
  );
$$;


--
-- Name: has_custom_role(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_custom_role(_user_id uuid, _role_name text, _org_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id
    WHERE ucr.user_id = _user_id
      AND cr.name = _role_name
      AND cr.is_active = true
      AND (
        _org_id IS NULL 
        OR ucr.organization_id = _org_id
        OR cr.organization_id IS NULL
      )
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;


--
-- Name: has_role_in_org(uuid, public.app_role, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role_in_org(_user_id uuid, _role public.app_role, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (organization_id IS NULL OR organization_id = _org_id)
  );
$$;


--
-- Name: increment_interview_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_interview_usage(org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE organization_subscriptions
  SET interviews_used = interviews_used + 1
  WHERE organization_id = org_id
  AND status = 'active';
END;
$$;


--
-- Name: increment_interviews_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_interviews_used() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (NEW.status IN ('submitted', 'evaluated') AND 
      (OLD.status IS NULL OR OLD.status NOT IN ('submitted', 'evaluated'))) THEN
    UPDATE organization_subscriptions os
    SET 
      interviews_used = interviews_used + 1,
      updated_at = NOW()
    FROM interviews i
    WHERE os.organization_id = i.organization_id
      AND i.id = NEW.interview_id
      AND os.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: increment_question_selection_counts(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_question_selection_counts(question_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.questions
  SET selection_count = COALESCE(selection_count, 0) + 1
  WHERE id = ANY(question_ids);
END;
$$;


--
-- Name: initialize_onboarding_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_onboarding_progress() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.onboarding_progress (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: is_global_tech_spoc(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_global_tech_spoc(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'tech_spoc'
      AND organization_id IS NULL
  );
$$;


--
-- Name: is_payment_enabled(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_payment_enabled(p_gateway_name text DEFAULT NULL::text) RETURNS TABLE(enabled boolean, gateway_name text, is_test_mode boolean, has_keys boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_gateway_name IS NOT NULL THEN
    -- Check specific gateway
    RETURN QUERY
    SELECT 
      pg.is_enabled,
      pg.gateway_name,
      pg.is_test_mode,
      CASE 
        WHEN pg.is_test_mode THEN 
          (pg.test_secret_key_encrypted IS NOT NULL AND pg.test_secret_key_encrypted != '')
        ELSE 
          (pg.live_secret_key_encrypted IS NOT NULL AND pg.live_secret_key_encrypted != '')
      END AS has_keys
    FROM public.payment_gateways pg
    WHERE pg.gateway_name = p_gateway_name;
  ELSE
    -- Check any enabled gateway
    RETURN QUERY
    SELECT 
      pg.is_enabled,
      pg.gateway_name,
      pg.is_test_mode,
      CASE 
        WHEN pg.is_test_mode THEN 
          (pg.test_secret_key_encrypted IS NOT NULL AND pg.test_secret_key_encrypted != '')
        ELSE 
          (pg.live_secret_key_encrypted IS NOT NULL AND pg.live_secret_key_encrypted != '')
      END AS has_keys
    FROM public.payment_gateways pg
    WHERE pg.is_enabled = true
    LIMIT 1;
  END IF;
END;
$$;


--
-- Name: is_role_org_scoped(public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_role_org_scoped(check_role public.app_role) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT check_role IN ('partner_admin', 'hr_recruiter', 'billing_contact');
$$;


--
-- Name: log_assessment_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_assessment_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, metadata
    ) VALUES (
      auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id,
      jsonb_build_object('old_data', row_to_json(OLD))
    );
    RETURN OLD;
  ELSE
    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, metadata
    ) VALUES (
      auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id,
      jsonb_build_object(
        'new_data', row_to_json(NEW),
        'old_data', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
      )
    );
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: mark_architecture_docs_outdated(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_architecture_docs_outdated(file_patterns text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE architecture_documents
  SET needs_refresh = true
  WHERE analyzed_files && file_patterns;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


--
-- Name: mark_job_recovered(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_job_recovered(p_job_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE failed_jobs
  SET 
    status = 'recovered',
    recovered_at = now()
  WHERE id = p_job_id;
END;
$$;


--
-- Name: mark_job_retry_failed(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_job_retry_failed(p_job_id uuid, p_error_message text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_job RECORD;
  v_next_retry TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_job FROM failed_jobs WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if max attempts reached
  IF v_job.attempt_count >= v_job.max_attempts THEN
    UPDATE failed_jobs
    SET 
      status = 'abandoned',
      error_message = p_error_message
    WHERE id = p_job_id;
  ELSE
    -- Calculate next retry with exponential backoff
    v_next_retry := now() + (interval '5 minutes' * power(3, v_job.attempt_count));
    
    UPDATE failed_jobs
    SET 
      status = 'failed',
      error_message = p_error_message,
      next_retry_at = v_next_retry
    WHERE id = p_job_id;
  END IF;
END;
$$;


--
-- Name: mark_job_retrying(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_job_retrying(p_job_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE failed_jobs
  SET 
    status = 'retrying',
    attempt_count = attempt_count + 1,
    last_attempted_at = now()
  WHERE id = p_job_id;
END;
$$;


--
-- Name: optimistic_update(text, uuid, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.optimistic_update(p_table_name text, p_id uuid, p_expected_version integer, p_updates jsonb) RETURNS TABLE(success boolean, new_version integer, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_current_version INTEGER;
  v_new_version INTEGER;
  v_sql TEXT;
  v_update_parts TEXT[];
  v_key TEXT;
  v_value JSONB;
BEGIN
  -- Get current version
  EXECUTE format('SELECT version FROM %I WHERE id = $1', p_table_name)
  INTO v_current_version
  USING p_id;
  
  IF v_current_version IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Record not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_current_version != p_expected_version THEN
    RETURN QUERY SELECT FALSE, v_current_version, 'Version conflict - record was modified by another user'::TEXT;
    RETURN;
  END IF;
  
  v_new_version := v_current_version + 1;
  
  -- Build update statement
  v_update_parts := ARRAY['version = ' || v_new_version::TEXT];
  
  FOR v_key, v_value IN SELECT * FROM jsonb_each(p_updates)
  LOOP
    IF v_key NOT IN ('id', 'version', 'created_at') THEN
      v_update_parts := array_append(v_update_parts, format('%I = %L', v_key, v_value #>> '{}'));
    END IF;
  END LOOP;
  
  v_sql := format(
    'UPDATE %I SET %s, updated_at = now() WHERE id = $1 AND version = $2',
    p_table_name,
    array_to_string(v_update_parts, ', ')
  );
  
  EXECUTE v_sql USING p_id, p_expected_version;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Update failed - version mismatch'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, v_new_version, NULL::TEXT;
END;
$_$;


--
-- Name: prepare_question_regeneration_tx(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_question_regeneration_tx(p_interview_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_interview RECORD;
  v_deleted_count integer;
BEGIN
  -- Verify interview exists
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id;
  IF v_interview IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  -- Delete attempt_questions that reference these questions
  DELETE FROM attempt_questions 
  WHERE question_id IN (SELECT id FROM questions WHERE interview_id = p_interview_id);

  -- Delete existing questions
  DELETE FROM questions WHERE interview_id = p_interview_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Update interview status
  UPDATE interviews 
  SET 
    generation_status = 'generating',
    generation_error = NULL
  WHERE id = p_interview_id;

  RETURN jsonb_build_object(
    'success', true,
    'interview_id', p_interview_id,
    'questions_deleted', v_deleted_count
  );

EXCEPTION WHEN OTHERS THEN
  -- Mark as failed
  UPDATE interviews SET generation_status = 'failed', generation_error = SQLERRM WHERE id = p_interview_id;
  RAISE EXCEPTION 'Question regeneration preparation failed: %', SQLERRM;
END;
$$;


--
-- Name: record_circuit_failure(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_circuit_failure(p_service_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_state RECORD;
BEGIN
  SELECT * INTO v_state
  FROM circuit_breaker_state
  WHERE service_name = p_service_name;
  
  IF v_state IS NULL THEN
    INSERT INTO circuit_breaker_state (service_name, state, failure_count, last_failure_at)
    VALUES (p_service_name, 'closed', 1, now());
    RETURN;
  END IF;
  
  IF v_state.state = 'half_open' THEN
    -- In half-open, single failure opens the circuit again
    UPDATE circuit_breaker_state
    SET state = 'open', opened_at = now(), success_count = 0, failure_count = failure_count + 1, last_failure_at = now()
    WHERE service_name = p_service_name;
  ELSE
    -- In closed state, count failures
    IF v_state.failure_count + 1 >= v_state.failure_threshold THEN
      -- Open the circuit
      UPDATE circuit_breaker_state
      SET state = 'open', opened_at = now(), failure_count = failure_count + 1, last_failure_at = now()
      WHERE service_name = p_service_name;
    ELSE
      UPDATE circuit_breaker_state
      SET failure_count = failure_count + 1, last_failure_at = now()
      WHERE service_name = p_service_name;
    END IF;
  END IF;
END;
$$;


--
-- Name: record_circuit_success(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_circuit_success(p_service_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_state RECORD;
BEGIN
  SELECT * INTO v_state
  FROM circuit_breaker_state
  WHERE service_name = p_service_name;
  
  IF v_state IS NULL THEN
    RETURN;
  END IF;
  
  IF v_state.state = 'half_open' THEN
    -- In half-open, count successes toward closing
    IF v_state.success_count + 1 >= v_state.success_threshold THEN
      -- Close the circuit
      UPDATE circuit_breaker_state
      SET state = 'closed', failure_count = 0, success_count = 0, last_success_at = now()
      WHERE service_name = p_service_name;
    ELSE
      UPDATE circuit_breaker_state
      SET success_count = success_count + 1, last_success_at = now()
      WHERE service_name = p_service_name;
    END IF;
  ELSE
    -- In closed state, just record success
    UPDATE circuit_breaker_state
    SET failure_count = 0, success_count = success_count + 1, last_success_at = now()
    WHERE service_name = p_service_name;
  END IF;
END;
$$;


--
-- Name: save_certification_evaluation_tx(uuid, integer, integer, boolean, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_certification_evaluation_tx(p_attempt_id uuid, p_score integer, p_integrity_score integer, p_passed boolean, p_time_taken integer, p_violation_summary jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt RECORD;
  v_topic RECORD;
  v_certificate_id uuid;
  v_cert_number text;
  v_verification_code text;
BEGIN
  -- Verify attempt exists
  SELECT ca.*, cas.certification_topic_id, cas.passing_score, cas.min_integrity_score
  INTO v_attempt
  FROM certification_attempts ca
  JOIN certification_assessments cas ON cas.id = ca.certification_assessment_id
  WHERE ca.id = p_attempt_id;

  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'Certification attempt not found';
  END IF;

  -- Update attempt
  UPDATE certification_attempts
  SET 
    score = p_score,
    integrity_score = p_integrity_score,
    passed = p_passed,
    time_taken = p_time_taken,
    violation_summary = p_violation_summary,
    status = 'evaluated',
    submitted_at = NOW()
  WHERE id = p_attempt_id;

  -- If passed, create certificate
  IF p_passed AND p_score >= v_attempt.passing_score AND p_integrity_score >= v_attempt.min_integrity_score THEN
    -- Get topic info
    SELECT * INTO v_topic FROM certification_topics WHERE id = v_attempt.certification_topic_id;
    
    -- Generate certificate number and verification code
    v_cert_number := generate_certificate_number();
    v_verification_code := generate_verification_code();

    INSERT INTO certificates (
      user_id, attempt_id, certification_topic_id, score, integrity_score,
      certificate_number, verification_code, expires_at
    )
    VALUES (
      v_attempt.user_id, p_attempt_id, v_attempt.certification_topic_id,
      p_score, p_integrity_score, v_cert_number, v_verification_code,
      NOW() + (v_topic.certificate_validity_days || ' days')::interval
    )
    RETURNING id INTO v_certificate_id;

    -- Award badges
    PERFORM check_and_award_badges(v_attempt.user_id);

    RETURN jsonb_build_object(
      'success', true,
      'passed', true,
      'certificate_id', v_certificate_id,
      'certificate_number', v_cert_number,
      'verification_code', v_verification_code
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'passed', false,
    'score', p_score,
    'required_score', v_attempt.passing_score
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Certification evaluation failed: %', SQLERRM;
END;
$$;


--
-- Name: save_interview_evaluation_tx(uuid, integer, text, text[], text[], jsonb, text, numeric, numeric, numeric, text, text, text[], text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_interview_evaluation_tx(p_attempt_id uuid, p_overall_score integer, p_hiring_decision text, p_strengths text[], p_weaknesses text[], p_topic_scores jsonb, p_detailed_analysis text, p_technical_score numeric, p_problem_solving_score numeric, p_integrity_score numeric, p_candidate_name text, p_candidate_email text, p_top_skills text[], p_weak_skills text[], p_violations_detected integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt RECORD;
  v_cpi numeric;
  v_assessment_id uuid;
BEGIN
  -- Verify attempt exists
  SELECT * INTO v_attempt FROM interview_attempts WHERE id = p_attempt_id;
  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'Interview attempt not found';
  END IF;

  -- Create or update assessment
  INSERT INTO assessments (attempt_id, overall_score, hiring_decision, strengths, weaknesses, topic_scores, detailed_analysis)
  VALUES (p_attempt_id, p_overall_score, p_hiring_decision, p_strengths, p_weaknesses, p_topic_scores, p_detailed_analysis)
  ON CONFLICT (attempt_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    hiring_decision = EXCLUDED.hiring_decision,
    strengths = EXCLUDED.strengths,
    weaknesses = EXCLUDED.weaknesses,
    topic_scores = EXCLUDED.topic_scores,
    detailed_analysis = EXCLUDED.detailed_analysis
  RETURNING id INTO v_assessment_id;

  -- Calculate CPI
  v_cpi := calculate_cpi_score(p_technical_score, p_problem_solving_score, p_integrity_score);

  -- Create or update CPI
  INSERT INTO candidate_performance_index (
    attempt_id, interview_id, candidate_name, candidate_email,
    technical_score, problem_solving_score, integrity_score, overall_cpi,
    hiring_recommendation, top_skills, weak_skills, topic_scores, violations_detected
  )
  VALUES (
    p_attempt_id, v_attempt.interview_id, p_candidate_name, p_candidate_email,
    p_technical_score, p_problem_solving_score, p_integrity_score, v_cpi,
    p_hiring_decision, p_top_skills, p_weak_skills, p_topic_scores, p_violations_detected
  )
  ON CONFLICT (attempt_id) DO UPDATE SET
    technical_score = EXCLUDED.technical_score,
    problem_solving_score = EXCLUDED.problem_solving_score,
    integrity_score = EXCLUDED.integrity_score,
    overall_cpi = EXCLUDED.overall_cpi,
    hiring_recommendation = EXCLUDED.hiring_recommendation,
    top_skills = EXCLUDED.top_skills,
    weak_skills = EXCLUDED.weak_skills,
    topic_scores = EXCLUDED.topic_scores,
    violations_detected = EXCLUDED.violations_detected,
    updated_at = NOW();

  -- Update attempt status
  UPDATE interview_attempts 
  SET status = 'evaluated'
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', p_attempt_id,
    'assessment_id', v_assessment_id,
    'cpi_score', v_cpi
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Interview evaluation failed: %', SQLERRM;
END;
$$;


--
-- Name: set_interview_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_interview_slug() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_organization_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_organization_slug() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_session_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_session_token() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.session_token IS NULL THEN
    NEW.session_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: setup_user_tx(uuid, text, text, public.app_role, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.setup_user_tx(p_user_id uuid, p_email text, p_full_name text, p_role public.app_role, p_organization_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Create profile if not exists
  INSERT INTO profiles (id, email, full_name)
  VALUES (p_user_id, p_email, p_full_name)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  -- Remove any existing guest role
  DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'guest';

  -- Add role if not exists
  INSERT INTO user_roles (user_id, role, organization_id)
  VALUES (p_user_id, p_role, p_organization_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Add as org member if organization specified
  IF p_organization_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, status)
    VALUES (p_organization_id, p_user_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'role', p_role,
    'organization_id', p_organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'User setup failed: %', SQLERRM;
END;
$$;


--
-- Name: soft_delete(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete(p_table_name text, p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    p_table_name
  ) USING p_id;
  
  RETURN FOUND;
END;
$_$;


--
-- Name: soft_restore(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_restore(p_table_name text, p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
    p_table_name
  ) USING p_id;
  
  RETURN FOUND;
END;
$_$;


--
-- Name: terminate_attempt_with_session(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.terminate_attempt_with_session(token text, attempt_answers text, seconds_taken integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  -- Find the attempt by session token
  SELECT id INTO v_attempt_id
  FROM interview_attempts
  WHERE session_token = token
    AND status = 'in_progress';
  
  IF v_attempt_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the attempt with terminated status
  UPDATE interview_attempts
  SET 
    answers = attempt_answers::jsonb,
    time_taken = seconds_taken,
    status = 'terminated',
    submitted_at = NOW()
  WHERE id = v_attempt_id;
  
  RETURN TRUE;
END;
$$;


--
-- Name: toggle_violation_ignored(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_violation_ignored(p_session_id uuid, p_violation_id text, p_ignore boolean) RETURNS TABLE(success boolean, new_integrity_score integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_ignored JSONB;
  v_detailed_violations JSONB;
  v_new_integrity_score INTEGER;
  v_violation JSONB;
  v_deduction INTEGER;
  v_violation_type TEXT;
BEGIN
  -- Get current ignored list and violations
  SELECT ignored_violations, detailed_violations 
  INTO v_current_ignored, v_detailed_violations
  FROM proctoring_sessions
  WHERE id = p_session_id;
  
  IF v_current_ignored IS NULL THEN
    v_current_ignored := '[]'::jsonb;
  END IF;
  
  -- Update ignored list
  IF p_ignore THEN
    IF NOT v_current_ignored @> to_jsonb(p_violation_id) THEN
      v_current_ignored := v_current_ignored || to_jsonb(p_violation_id);
    END IF;
  ELSE
    SELECT jsonb_agg(elem)
    INTO v_current_ignored
    FROM jsonb_array_elements(v_current_ignored) AS elem
    WHERE elem::text != ('"' || p_violation_id || '"');
    
    IF v_current_ignored IS NULL THEN
      v_current_ignored := '[]'::jsonb;
    END IF;
  END IF;
  
  -- Recalculate integrity score
  v_new_integrity_score := 100;
  
  IF v_detailed_violations IS NOT NULL AND jsonb_array_length(v_detailed_violations) > 0 THEN
    FOR v_violation IN SELECT * FROM jsonb_array_elements(v_detailed_violations)
    LOOP
      v_violation_type := v_violation->>'type';
      
      IF v_current_ignored @> to_jsonb(v_violation_type) THEN
        CONTINUE;
      END IF;
      
      v_deduction := CASE v_violation->>'severity'
        WHEN 'high' THEN 15
        WHEN 'medium' THEN 8
        WHEN 'low' THEN 3
        ELSE 5
      END;
      
      v_new_integrity_score := GREATEST(0, v_new_integrity_score - v_deduction);
    END LOOP;
  END IF;
  
  -- Update session
  UPDATE proctoring_sessions
  SET 
    ignored_violations = v_current_ignored,
    integrity_score = v_new_integrity_score,
    updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN QUERY SELECT TRUE, v_new_integrity_score;
END;
$$;


--
-- Name: track_ai_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_ai_usage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_period_start timestamp with time zone;
  v_period_end timestamp with time zone;
  v_tokens integer;
BEGIN
  v_tokens := COALESCE(NEW.request_tokens, 0) + COALESCE(NEW.response_tokens, 0);
  
  IF v_tokens = 0 THEN
    RETURN NEW;
  END IF;
  
  v_period_start := date_trunc('month', NEW.created_at);
  v_period_end := v_period_start + interval '1 month';
  
  SELECT organization_id INTO v_org_id
  FROM interviews
  WHERE id = (NEW.metadata->>'interview_id')::uuid
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO usage_tracking (
    organization_id, period_start, period_end,
    interviews_conducted, ai_tokens_used, created_at, updated_at
  )
  VALUES (v_org_id, v_period_start, v_period_end, 0, v_tokens, now(), now())
  ON CONFLICT (organization_id, period_start)
  DO UPDATE SET
    ai_tokens_used = usage_tracking.ai_tokens_used + v_tokens,
    updated_at = now();
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_auto_evaluate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_auto_evaluate() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Only trigger on status change to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- Get configuration from environment
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);
    
    -- Fallback to hardcoded values if settings not available
    IF v_supabase_url IS NULL THEN
      v_supabase_url := 'https://aiwekrfwhdwvbnrkuurh.supabase.co';
    END IF;
    
    IF v_service_key IS NULL THEN
      v_service_key := current_setting('supabase.service_role_key', true);
    END IF;
    
    -- Call evaluate-interview edge function with service role privileges
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/evaluate-interview',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := jsonb_build_object('attemptId', NEW.id)
    );
    
    -- Log the evaluation trigger
    INSERT INTO public.audit_logs (
      action,
      table_name,
      record_id,
      metadata
    ) VALUES (
      'AUTO_EVALUATE',
      'interview_attempts',
      NEW.id,
      jsonb_build_object(
        'attempt_id', NEW.id,
        'triggered_at', NOW(),
        'trigger_method', 'database_trigger'
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  RAISE WARNING 'Error in trigger_auto_evaluate: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: update_ai_config_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ai_config_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_ai_health_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ai_health_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_ai_model_config_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ai_model_config_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_attempt_with_session(text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_attempt_with_session(token text, attempt_answers jsonb, seconds_taken integer) RETURNS TABLE(success boolean, attempt_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt_id UUID;
  v_status TEXT;
  v_interview_id UUID;
  v_proctoring_enabled BOOLEAN;
  v_new_status TEXT;
BEGIN
  IF token IS NULL OR LENGTH(token) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF attempt_answers IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- Get attempt info and check proctoring status
  SELECT ia.id, ia.status, ia.interview_id, i.proctoring_enabled 
  INTO v_attempt_id, v_status, v_interview_id, v_proctoring_enabled
  FROM public.interview_attempts ia
  JOIN public.interviews i ON i.id = ia.interview_id
  WHERE ia.session_token = token
  AND ia.session_token IS NOT NULL
  AND LENGTH(ia.session_token) > 0;

  IF v_attempt_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF v_status != 'in_progress' THEN
    RETURN QUERY SELECT FALSE, v_attempt_id;
    RETURN;
  END IF;

  -- For proctored interviews, set to pending_upload (evaluation happens after video upload)
  -- For non-proctored interviews, set to submitted (trigger evaluation immediately)
  v_new_status := CASE WHEN v_proctoring_enabled THEN 'pending_upload' ELSE 'submitted' END;

  UPDATE public.interview_attempts
  SET 
    answers = attempt_answers,
    time_taken = seconds_taken,
    status = v_new_status,
    submitted_at = NOW()
  WHERE id = v_attempt_id;

  RETURN QUERY SELECT TRUE, v_attempt_id;
END;
$$;


--
-- Name: update_certification_topics_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_certification_topics_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_chatbot_knowledge_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chatbot_knowledge_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_invoice_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_invoice_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_platform_config_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_platform_config_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_proctoring_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_proctoring_sessions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_role_permissions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_role_permissions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_subscription_interview_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_subscription_interview_usage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  org_id UUID;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('evaluated', 'submitted') 
      AND OLD.status NOT IN ('evaluated', 'submitted')) THEN
    SELECT i.organization_id INTO org_id
    FROM interviews i
    WHERE i.id = NEW.interview_id;
    
    IF org_id IS NOT NULL THEN
      UPDATE organization_subscriptions
      SET 
        interviews_used = interviews_used + 1,
        updated_at = now()
      WHERE organization_id = org_id 
        AND status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_test_suites_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_test_suites_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_usage_tracking(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_usage_tracking() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_period_start timestamp with time zone;
  v_period_end timestamp with time zone;
BEGIN
  -- Get organization_id
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  
  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get current period (monthly)
  v_period_start := date_trunc('month', now());
  v_period_end := v_period_start + interval '1 month';
  
  -- Insert or update usage tracking
  INSERT INTO usage_tracking (
    organization_id,
    period_start,
    period_end,
    interviews_conducted,
    ai_tokens_used,
    created_at
  )
  VALUES (
    v_org_id,
    v_period_start,
    v_period_end,
    CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE 0 END,
    0,
    now()
  )
  ON CONFLICT (organization_id, period_start)
  DO UPDATE SET
    interviews_conducted = CASE 
      WHEN TG_OP = 'INSERT' THEN usage_tracking.interviews_conducted + 1
      WHEN TG_OP = 'DELETE' THEN GREATEST(0, usage_tracking.interviews_conducted - 1)
      ELSE usage_tracking.interviews_conducted
    END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: user_is_org_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'platform_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    JOIN public.user_roles ur ON ur.user_id = om.user_id
    WHERE om.user_id = _user_id 
      AND om.organization_id = _org_id
      AND om.status = 'active'
      AND ur.role = 'partner_admin'
  );
$$;


--
-- Name: user_is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_org_member(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  );
$$;


--
-- Name: verify_certificate_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_certificate_by_code(p_verification_code text) RETURNS TABLE(certificate_number text, verification_code text, score integer, integrity_score integer, issued_at timestamp with time zone, expires_at timestamp with time zone, is_revoked boolean, revoked_reason text, certification_name text, category text, difficulty_level text, candidate_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Validate input
  IF p_verification_code IS NULL OR LENGTH(TRIM(p_verification_code)) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.certificate_number,
    c.verification_code,
    c.score::INTEGER,
    c.integrity_score::INTEGER,
    c.issued_at,
    c.expires_at,
    c.is_revoked,
    c.revoked_reason,
    ct.name AS certification_name,
    ct.category,
    ct.difficulty_level,
    p.full_name AS candidate_name
  FROM certificates c
  JOIN certification_topics ct ON c.certification_topic_id = ct.id
  JOIN profiles p ON c.user_id = p.id
  WHERE c.verification_code = UPPER(TRIM(p_verification_code))
  LIMIT 1;
END;
$$;


--
-- Name: activity_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    actor_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_coach_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_coach_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_email text NOT NULL,
    interview_id uuid,
    attempt_id uuid,
    hints_provided jsonb DEFAULT '[]'::jsonb,
    questions_asked integer DEFAULT 0,
    hints_used integer DEFAULT 0,
    total_interaction_time integer,
    improvement_score numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_feature_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feature_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_name text NOT NULL,
    alert_type text NOT NULL,
    severity text NOT NULL,
    message text NOT NULL,
    notified_admins uuid[] DEFAULT ARRAY[]::uuid[],
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_feature_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['failure'::text, 'degraded_performance'::text, 'recovery'::text]))),
    CONSTRAINT ai_feature_alerts_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text])))
);


--
-- Name: ai_feature_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feature_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_name text NOT NULL,
    display_name text NOT NULL,
    description text,
    primary_provider_id uuid,
    fallback_provider_id uuid,
    fallback_enabled boolean DEFAULT true,
    retry_attempts integer DEFAULT 3,
    timeout_seconds integer DEFAULT 60,
    usage_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_feature_configurations_feature_name_check CHECK ((feature_name = ANY (ARRAY['skill_extraction'::text, 'question_generation'::text, 'interview_evaluation'::text, 'proctoring_analysis'::text, 'resume_parsing'::text, 'bias_detection'::text, 'learning_assessment_generation'::text, 'learning_assessment_evaluation'::text, 'code_execution'::text])))
);


--
-- Name: ai_feature_health; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feature_health (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_id text NOT NULL,
    feature_name text NOT NULL,
    edge_function text NOT NULL,
    current_model text DEFAULT 'google/gemini-2.5-flash'::text NOT NULL,
    status text DEFAULT 'unknown'::text NOT NULL,
    last_check_at timestamp with time zone DEFAULT now(),
    last_success_at timestamp with time zone,
    last_error_at timestamp with time zone,
    last_error_message text,
    consecutive_failures integer DEFAULT 0,
    total_requests integer DEFAULT 0,
    successful_requests integer DEFAULT 0,
    failed_requests integer DEFAULT 0,
    average_latency_ms integer,
    is_enabled boolean DEFAULT true,
    auto_retry_enabled boolean DEFAULT true,
    max_retry_attempts integer DEFAULT 3,
    fallback_model text,
    fallback_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_feature_health_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'failed'::text, 'unknown'::text])))
);


--
-- Name: ai_health_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_health_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_id text NOT NULL,
    alert_type text NOT NULL,
    severity text NOT NULL,
    message text NOT NULL,
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_health_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['feature_down'::text, 'high_failure_rate'::text, 'slow_response'::text, 'recovered'::text]))),
    CONSTRAINT ai_health_alerts_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: ai_health_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_health_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_id text NOT NULL,
    check_type text NOT NULL,
    status text NOT NULL,
    response_time_ms integer,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_health_checks_check_type_check CHECK ((check_type = ANY (ARRAY['scheduled'::text, 'manual'::text, 'alert'::text])))
);


--
-- Name: ai_health_monitoring; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_health_monitoring (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_name text NOT NULL,
    edge_function text NOT NULL,
    status text NOT NULL,
    response_time_ms integer,
    error_message text,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_health_monitoring_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'failed'::text])))
);


--
-- Name: ai_model_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_model_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_name text NOT NULL,
    edge_function text NOT NULL,
    primary_model text NOT NULL,
    fallback_model text,
    is_ab_testing boolean DEFAULT false,
    ab_test_split_percentage integer DEFAULT 50,
    ab_test_model text,
    max_retries integer DEFAULT 3,
    retry_delay_ms integer DEFAULT 1000,
    timeout_ms integer DEFAULT 30000,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_model_configurations_ab_test_split_percentage_check CHECK (((ab_test_split_percentage >= 0) AND (ab_test_split_percentage <= 100)))
);


--
-- Name: ai_model_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_model_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_id text NOT NULL,
    model_name text NOT NULL,
    test_period_start timestamp with time zone NOT NULL,
    test_period_end timestamp with time zone,
    total_requests integer DEFAULT 0,
    successful_requests integer DEFAULT 0,
    average_latency_ms integer,
    average_quality_score numeric(3,2),
    cost_per_request_cents numeric(10,4),
    is_active_test boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_provider_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    api_key_encrypted text NOT NULL,
    model_preference text,
    rate_limit_per_minute integer DEFAULT 60,
    is_active boolean DEFAULT true,
    last_tested_at timestamp with time zone,
    test_status text,
    test_error text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_provider_credentials_test_status_check CHECK ((test_status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text])))
);


--
-- Name: ai_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    provider_type text NOT NULL,
    base_url text NOT NULL,
    supported_models jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['openai'::text, 'anthropic'::text, 'google'::text, 'perplexity'::text, 'lovable'::text])))
);


--
-- Name: ai_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_name text NOT NULL,
    provider_id uuid,
    model_used text,
    request_tokens integer,
    response_tokens integer,
    total_cost_cents integer,
    latency_ms integer,
    success boolean NOT NULL,
    error_message text,
    fallback_used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    organization_id uuid,
    user_id uuid,
    interview_id uuid
);


--
-- Name: analytics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    snapshot_date date NOT NULL,
    total_interviews integer DEFAULT 0,
    total_candidates integer DEFAULT 0,
    avg_cpi_score numeric,
    hiring_rate numeric,
    avg_time_to_hire integer,
    top_performing_roles text[],
    metrics jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    workflow_stage text NOT NULL,
    current_approver uuid,
    approval_chain jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text,
    deadline timestamp with time zone,
    comments text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: architecture_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.architecture_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section text NOT NULL,
    diagram_type text NOT NULL,
    title text NOT NULL,
    description text,
    mermaid_code text NOT NULL,
    analyzed_files text[] DEFAULT '{}'::text[],
    file_hashes jsonb DEFAULT '{}'::jsonb,
    last_generated_at timestamp with time zone DEFAULT now(),
    needs_refresh boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    overall_score numeric(5,2) NOT NULL,
    hiring_decision text NOT NULL,
    strengths text[],
    weaknesses text[],
    topic_scores jsonb DEFAULT '{}'::jsonb,
    detailed_analysis text,
    created_at timestamp with time zone DEFAULT now(),
    organization_id uuid,
    CONSTRAINT assessments_hiring_decision_check CHECK ((hiring_decision = ANY (ARRAY['strong_hire'::text, 'hire'::text, 'consider'::text, 'reject'::text]))),
    CONSTRAINT assessments_score_range CHECK (((overall_score >= (0)::numeric) AND (overall_score <= (100)::numeric)))
);


--
-- Name: ats_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ats_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    external_id text NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    resume_url text,
    resume_parsed jsonb,
    skills jsonb DEFAULT '[]'::jsonb,
    experience_years integer,
    current_position text,
    current_company text,
    education jsonb DEFAULT '[]'::jsonb,
    source text,
    applied_position text,
    ats_status text,
    interview_id uuid,
    attempt_id uuid,
    synced_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ats_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ats_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    ats_provider text NOT NULL,
    api_key_encrypted text,
    webhook_url text,
    webhook_secret text,
    sync_enabled boolean DEFAULT false,
    last_sync_at timestamp with time zone,
    sync_frequency integer DEFAULT 3600,
    config jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'inactive'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ats_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ats_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    sync_type text NOT NULL,
    candidates_synced integer DEFAULT 0,
    candidates_failed integer DEFAULT 0,
    status text NOT NULL,
    error_message text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    details jsonb DEFAULT '{}'::jsonb
);


--
-- Name: attempt_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    display_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    metadata jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bias_detection_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bias_detection_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assessment_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    bias_score numeric DEFAULT 0 NOT NULL,
    bias_indicators jsonb DEFAULT '[]'::jsonb,
    language_bias jsonb,
    cultural_bias jsonb,
    technical_bias jsonb,
    recommendations text[],
    analysis_model text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: candidate_performance_index; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_performance_index (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    candidate_email text NOT NULL,
    candidate_name text NOT NULL,
    interview_id uuid NOT NULL,
    technical_score numeric(5,2) DEFAULT 0 NOT NULL,
    problem_solving_score numeric(5,2) DEFAULT 0 NOT NULL,
    topic_scores jsonb DEFAULT '{}'::jsonb,
    easy_correct integer DEFAULT 0,
    easy_total integer DEFAULT 0,
    medium_correct integer DEFAULT 0,
    medium_total integer DEFAULT 0,
    hard_correct integer DEFAULT 0,
    hard_total integer DEFAULT 0,
    integrity_score numeric(5,2) DEFAULT 100 NOT NULL,
    violations_detected integer DEFAULT 0,
    overall_cpi numeric(5,2) DEFAULT 0 NOT NULL,
    top_skills text[] DEFAULT ARRAY[]::text[],
    weak_skills text[] DEFAULT ARRAY[]::text[],
    hiring_recommendation text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT candidate_performance_index_hiring_recommendation_check CHECK ((hiring_recommendation = ANY (ARRAY['strongly_recommend'::text, 'recommend'::text, 'consider'::text, 'not_recommended'::text, 'strong_hire'::text, 'hire'::text, 'reject'::text])))
);


--
-- Name: certificate_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    badge_type text NOT NULL,
    category text,
    requirements jsonb NOT NULL,
    icon_name text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    certification_topic_id uuid NOT NULL,
    certificate_number text NOT NULL,
    verification_code text NOT NULL,
    score integer NOT NULL,
    integrity_score integer NOT NULL,
    issued_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    pdf_url text,
    is_revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: certification_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certification_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certification_topic_id uuid,
    title text NOT NULL,
    time_limit integer NOT NULL,
    passing_score integer NOT NULL,
    min_integrity_score integer DEFAULT 70 NOT NULL,
    proctoring_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'published'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT certification_assessments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: certification_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certification_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certification_assessment_id uuid,
    user_id uuid,
    proctoring_session_id uuid,
    generated_questions jsonb DEFAULT '[]'::jsonb,
    answers jsonb DEFAULT '{}'::jsonb,
    score integer,
    integrity_score integer,
    time_taken integer,
    submitted_at timestamp with time zone,
    passed boolean DEFAULT false,
    violation_summary jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'in_progress'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT certification_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'evaluated'::text])))
);


--
-- Name: certification_global_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certification_global_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config jsonb DEFAULT '{"ai_settings": {"model": "google/gemini-2.5-flash", "temperature": 0.7}, "exam_settings": {"time_limit_minutes": 90, "min_integrity_score": 70, "passing_score_percentage": 70}, "retake_settings": {"max_retakes": 3, "allow_retake": true, "retake_cooldown_days": 30}, "proctoring_settings": {"max_look_aways": 5, "require_camera": true, "max_tab_switches": 0, "require_microphone": true, "detect_copy_attempts": true, "allow_multiple_persons": false}, "question_generation": {"total_questions": 50, "difficulty_distribution": {"advanced": 30, "beginner": 20, "intermediate": 50}, "question_type_distribution": {"mcq": 70, "coding": 15, "descriptive": 15}}, "certificate_validity_days": 365}'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: certification_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certification_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    difficulty_level text NOT NULL,
    required_questions integer DEFAULT 50 NOT NULL,
    passing_score integer DEFAULT 70 NOT NULL,
    certificate_validity_days integer DEFAULT 365 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    provider text DEFAULT 'general'::text NOT NULL,
    display_name text NOT NULL,
    recommended_experience text,
    syllabus_topics jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT certification_topics_difficulty_level_check CHECK ((difficulty_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text])))
);


--
-- Name: chatbot_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_knowledge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    category text NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[],
    role_specific text[] DEFAULT ARRAY[]::text[],
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: circuit_breaker_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circuit_breaker_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_name text NOT NULL,
    state text DEFAULT 'closed'::text NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    last_failure_at timestamp with time zone,
    last_success_at timestamp with time zone,
    opened_at timestamp with time zone,
    half_open_at timestamp with time zone,
    failure_threshold integer DEFAULT 5 NOT NULL,
    success_threshold integer DEFAULT 2 NOT NULL,
    timeout_seconds integer DEFAULT 60 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collaboration_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaboration_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    parent_id uuid,
    author_id uuid,
    content text NOT NULL,
    mentions uuid[],
    is_resolved boolean DEFAULT false,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: comparative_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comparative_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    comparison_type text NOT NULL,
    entities jsonb NOT NULL,
    metrics jsonb NOT NULL,
    insights jsonb NOT NULL,
    visualization_data jsonb,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_email text NOT NULL,
    candidate_name text NOT NULL,
    interview_id uuid,
    consent_type text NOT NULL,
    consent_given boolean NOT NULL,
    consent_text text NOT NULL,
    ip_address text,
    user_agent text,
    recorded_at timestamp with time zone DEFAULT now()
);


--
-- Name: custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    organization_id uuid,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: data_deletion_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_email text NOT NULL,
    candidate_name text,
    request_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    processed_by uuid,
    data_export_url text,
    notes text
);


--
-- Name: data_retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    data_type text NOT NULL,
    retention_days integer NOT NULL,
    auto_delete_enabled boolean DEFAULT true,
    last_cleanup_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: documentation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    file_path text NOT NULL,
    version text DEFAULT '1.0'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template text NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text,
    subject text,
    sent boolean DEFAULT false NOT NULL,
    sent_at timestamp with time zone,
    error_message text,
    message_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    organization_id uuid,
    user_id uuid,
    resend_count integer DEFAULT 0 NOT NULL,
    last_resend_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'resend'::text
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_key text NOT NULL,
    organization_id uuid,
    subject text NOT NULL,
    html_content text NOT NULL,
    description text,
    available_variables text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type text NOT NULL,
    job_id text,
    payload jsonb NOT NULL,
    error_message text NOT NULL,
    error_stack text,
    error_code text,
    attempt_count integer DEFAULT 1 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    status text DEFAULT 'failed'::text NOT NULL,
    next_retry_at timestamp with time zone,
    last_attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    recovered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid,
    user_id uuid,
    source_function text,
    correlation_id text
);


--
-- Name: generated_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    organization_id uuid,
    report_data jsonb NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    generated_by uuid,
    file_url text,
    format text,
    status text DEFAULT 'completed'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    operation_type text NOT NULL,
    resource_id uuid,
    request_hash text,
    response jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: interview_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    candidate_email text NOT NULL,
    candidate_name text,
    share_token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    accessed_at timestamp with time zone,
    completed_at timestamp with time zone,
    email_sent boolean DEFAULT false,
    email_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    deleted_at timestamp with time zone,
    CONSTRAINT interview_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accessed'::text, 'completed'::text, 'expired'::text])))
);


--
-- Name: interview_operation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_operation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid,
    attempt_id uuid,
    invitation_id uuid,
    session_id uuid,
    operation text NOT NULL,
    status text DEFAULT 'started'::text NOT NULL,
    candidate_email text,
    user_id uuid,
    error_code text,
    error_message text,
    error_details jsonb,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: interview_panel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_panel_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'reviewer'::text NOT NULL,
    added_by uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now()
);


--
-- Name: interview_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    candidate_email text NOT NULL,
    candidate_name text NOT NULL,
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    reminder_sent boolean DEFAULT false,
    reminder_sent_at timestamp with time zone,
    meeting_link text,
    calendar_event_id text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: interview_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    role_type text NOT NULL,
    seniority_level text NOT NULL,
    question_distribution jsonb NOT NULL,
    difficulty_distribution jsonb NOT NULL,
    recommended_time_limit integer NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[],
    is_public boolean DEFAULT false,
    created_by uuid,
    organization_id uuid,
    usage_count integer DEFAULT 0,
    avg_rating numeric(3,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    title text NOT NULL,
    job_description text NOT NULL,
    question_count integer DEFAULT 10 NOT NULL,
    difficulty_distribution jsonb DEFAULT '{"easy": 30, "hard": 20, "medium": 50}'::jsonb,
    topic_distribution jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'draft'::text,
    share_link text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    time_limit integer,
    proctoring_enabled boolean DEFAULT false,
    proctoring_settings jsonb DEFAULT '{"require_camera": true, "detect_tab_switches": true, "minimum_light_level": 0.3, "require_screen_share": true, "detect_multiple_voices": true, "detect_multiple_persons": true, "detect_multiple_monitors": true}'::jsonb,
    question_bank_size integer,
    coding_schema jsonb,
    generation_status text DEFAULT 'pending'::text,
    generation_error text,
    organization_id uuid,
    proctoring_settings_id uuid,
    skill_domain text,
    slug text,
    questions_status text DEFAULT 'draft'::text,
    tech_spoc_reviewer_id uuid,
    review_requested_at timestamp with time zone,
    questions_approved_at timestamp with time zone,
    review_notes text,
    category_difficulty_distribution jsonb,
    question_type_distribution jsonb,
    required_question_rules jsonb DEFAULT '[]'::jsonb,
    version integer DEFAULT 1 NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT interviews_generation_status_check CHECK ((generation_status = ANY (ARRAY['pending'::text, 'generating'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT interviews_questions_status_check CHECK ((questions_status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text]))),
    CONSTRAINT interviews_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    invoice_number text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    amount_cents integer DEFAULT 0 NOT NULL,
    tax_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    usage_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    due_date timestamp with time zone NOT NULL,
    paid_at timestamp with time zone,
    payment_method text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_promotion_id uuid,
    idempotency_key text,
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])))
);


--
-- Name: learning_assessment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_assessment_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assessment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    time_taken integer,
    status text DEFAULT 'in_progress'::text NOT NULL,
    score integer,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learning_assessment_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_assessment_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    overall_score integer NOT NULL,
    percentage numeric NOT NULL,
    topic_scores jsonb,
    difficulty_scores jsonb,
    strengths text[],
    weaknesses text[],
    improvement_areas text[],
    detailed_analysis text,
    question_feedback jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learning_assessment_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_assessment_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assessment_id uuid NOT NULL,
    question_text text NOT NULL,
    question_type text NOT NULL,
    topic text NOT NULL,
    difficulty text NOT NULL,
    options jsonb,
    correct_answer text,
    explanation text,
    hints text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learning_assessment_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_assessment_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    assessment_id uuid NOT NULL,
    usage_date date DEFAULT CURRENT_DATE NOT NULL,
    was_free boolean DEFAULT false NOT NULL,
    was_paid boolean DEFAULT false NOT NULL,
    subscription_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learning_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    training_topic_id uuid,
    title text NOT NULL,
    topic_description text NOT NULL,
    question_count integer DEFAULT 10 NOT NULL,
    difficulty_distribution jsonb DEFAULT '{"easy": 40, "hard": 20, "medium": 40}'::jsonb NOT NULL,
    question_type_distribution jsonb DEFAULT '{"mcq": 60, "coding": 10, "descriptive": 30}'::jsonb NOT NULL,
    time_limit integer,
    mode text DEFAULT 'practice'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    proctoring_enabled boolean DEFAULT false,
    proctoring_settings jsonb DEFAULT '{"require_camera": true, "detect_tab_switches": true, "minimum_light_level": 0.3, "require_screen_share": true, "detect_multiple_voices": true, "detect_multiple_persons": true, "detect_multiple_monitors": true}'::jsonb,
    is_certification boolean DEFAULT false,
    certification_topic_id uuid,
    min_integrity_score integer DEFAULT 75,
    max_tab_switches integer DEFAULT 0,
    max_look_aways integer DEFAULT 5,
    allow_multiple_persons boolean DEFAULT false
);


--
-- Name: learning_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_topic_id uuid NOT NULL,
    material_type text NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    description text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learning_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subscription_id uuid,
    assessment_id uuid,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    payment_method text NOT NULL,
    stripe_payment_id text,
    paypal_transaction_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learning_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['stripe'::text, 'paypal'::text]))),
    CONSTRAINT learning_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])))
);


--
-- Name: learning_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    billing_period text DEFAULT 'monthly'::text NOT NULL,
    max_assessments integer DEFAULT 10 NOT NULL,
    max_certifications integer DEFAULT 5 NOT NULL,
    max_ai_usage integer DEFAULT 100 NOT NULL,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: learning_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_type text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    amount_spent_cents integer DEFAULT 0 NOT NULL,
    is_unlimited boolean DEFAULT false NOT NULL,
    stripe_subscription_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_id uuid,
    CONSTRAINT learning_subscriptions_plan_type_check CHECK ((plan_type = ANY (ARRAY['daily'::text, 'monthly'::text]))),
    CONSTRAINT learning_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['interview_status'::text, 'candidate_submission'::text, 'system_alert'::text, 'proctoring_alert'::text, 'report_ready'::text])))
);


--
-- Name: onboarding_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    viewed_dashboard boolean DEFAULT false,
    created_interview boolean DEFAULT false,
    shared_interview boolean DEFAULT false,
    viewed_report boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organization_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text])))
);


--
-- Name: organization_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    interviews_used integer DEFAULT 0,
    ai_usage_used integer DEFAULT 0,
    current_period_start timestamp with time zone DEFAULT now(),
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organization_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'cancelled'::text, 'trialing'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    website text,
    industry text,
    size text,
    country text,
    description text,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    verification_status text DEFAULT 'unverified'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contact_email text,
    slug text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT organizations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'pending_approval'::text]))),
    CONSTRAINT organizations_verification_status_check CHECK ((verification_status = ANY (ARRAY['verified'::text, 'unverified'::text, 'pending'::text])))
);


--
-- Name: panel_consensus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.panel_consensus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    final_decision text NOT NULL,
    consensus_score numeric NOT NULL,
    total_reviewers integer NOT NULL,
    agreement_level text,
    discussion_summary text,
    decided_by uuid,
    decided_at timestamp with time zone DEFAULT now()
);


--
-- Name: panel_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.panel_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    overall_score numeric NOT NULL,
    hiring_recommendation text NOT NULL,
    technical_feedback text,
    cultural_feedback text,
    strengths text[],
    concerns text[],
    detailed_notes text,
    evaluation_date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'draft'::text
);


--
-- Name: partner_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    applicant_user_id uuid NOT NULL,
    organization_name text NOT NULL,
    website text,
    industry text,
    organization_size text,
    country text,
    use_case text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    contact_name text,
    contact_email text,
    contact_phone text,
    company_size text,
    selected_plan_id uuid,
    review_notes text,
    CONSTRAINT partner_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revision_requested'::text])))
);


--
-- Name: password_setup_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_setup_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    organization_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: payment_gateways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_gateways (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gateway_name text NOT NULL,
    display_name text NOT NULL,
    description text,
    is_enabled boolean DEFAULT false,
    is_test_mode boolean DEFAULT true,
    test_public_key_encrypted text,
    test_secret_key_encrypted text,
    live_public_key_encrypted text,
    live_secret_key_encrypted text,
    webhook_secret_encrypted text,
    config jsonb DEFAULT '{}'::jsonb,
    supported_currencies text[] DEFAULT ARRAY['USD'::text, 'INR'::text],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_payment_method_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    card_brand text,
    card_last4 text,
    card_exp_month integer,
    card_exp_year integer,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    invoice_id uuid,
    stripe_charge_id text,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'USD'::text,
    status text NOT NULL,
    payment_method_id uuid,
    failure_reason text,
    receipt_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    idempotency_key text
);


--
-- Name: platform_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    data_type text DEFAULT 'string'::text NOT NULL,
    category text NOT NULL,
    description text,
    is_sensitive boolean DEFAULT false,
    validation_rules jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT platform_configurations_data_type_check CHECK ((data_type = ANY (ARRAY['string'::text, 'number'::text, 'boolean'::text, 'json'::text])))
);


--
-- Name: platform_documentation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_documentation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    prompt_used text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version_number integer DEFAULT 1,
    source_files jsonb DEFAULT '[]'::jsonb,
    file_hashes jsonb DEFAULT '{}'::jsonb,
    generation_prompt text,
    needs_regeneration boolean DEFAULT false,
    last_generated_at timestamp with time zone,
    is_ai_generated boolean DEFAULT false,
    CONSTRAINT platform_documentation_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'published'::text])))
);


--
-- Name: platform_documentation_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_documentation_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    changes_summary text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: predictive_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.predictive_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    model_type text NOT NULL,
    analysis_period tstzrange NOT NULL,
    predictions jsonb NOT NULL,
    accuracy_metrics jsonb,
    feature_importance jsonb,
    recommendations jsonb,
    model_version text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: preinterview_check_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preinterview_check_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invitation_id uuid,
    candidate_email text NOT NULL,
    candidate_name text,
    interview_id uuid,
    network_status text DEFAULT 'pending'::text NOT NULL,
    network_error text,
    network_speed_mbps numeric(10,2),
    camera_status text DEFAULT 'pending'::text NOT NULL,
    camera_error text,
    microphone_status text DEFAULT 'pending'::text NOT NULL,
    microphone_error text,
    lighting_status text DEFAULT 'pending'::text NOT NULL,
    lighting_error text,
    person_visible_status text DEFAULT 'pending'::text NOT NULL,
    person_visible_error text,
    screen_share_attempted boolean DEFAULT false,
    screen_share_error text,
    user_agent text,
    browser_info jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: proctoring_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proctoring_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_attempt_id uuid,
    learning_attempt_id uuid,
    video_recording_url text,
    screen_recording_url text,
    consent_given boolean DEFAULT false,
    consent_timestamp timestamp with time zone,
    camera_check_passed boolean DEFAULT false,
    microphone_check_passed boolean DEFAULT false,
    screen_share_check_passed boolean DEFAULT false,
    lighting_check_passed boolean DEFAULT false,
    violations jsonb DEFAULT '[]'::jsonb,
    multiple_person_detections integer DEFAULT 0,
    multiple_voice_detections integer DEFAULT 0,
    tab_switch_count integer DEFAULT 0,
    look_away_count integer DEFAULT 0,
    copy_attempt_count integer DEFAULT 0,
    integrity_score numeric(5,2),
    flagged_for_review boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    reviewer_notes text,
    review_status text DEFAULT 'pending'::text,
    eye_movement_violations jsonb DEFAULT '[]'::jsonb,
    detailed_violations jsonb DEFAULT '[]'::jsonb,
    certification_attempt_id uuid,
    audio_transcription text,
    periodic_screenshots text[] DEFAULT '{}'::text[],
    facial_analysis_results jsonb DEFAULT '{}'::jsonb,
    upload_status text DEFAULT 'pending'::text,
    upload_error text,
    upload_started_at timestamp with time zone,
    upload_completed_at timestamp with time zone,
    periodic_screenshot_timestamps integer[] DEFAULT '{}'::integer[],
    ignored_violations jsonb DEFAULT '[]'::jsonb,
    screen_periodic_screenshots text[] DEFAULT '{}'::text[],
    screen_periodic_screenshot_timestamps integer[] DEFAULT '{}'::integer[],
    organization_id uuid,
    CONSTRAINT check_attempt_id CHECK ((((interview_attempt_id IS NOT NULL) AND (learning_attempt_id IS NULL)) OR ((interview_attempt_id IS NULL) AND (learning_attempt_id IS NOT NULL)))),
    CONSTRAINT proctoring_sessions_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'flagged'::text]))),
    CONSTRAINT upload_status_check CHECK ((upload_status = ANY (ARRAY['pending'::text, 'uploading'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
);

ALTER TABLE ONLY public.proctoring_sessions REPLICA IDENTITY FULL;


--
-- Name: proctoring_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proctoring_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    interview_type character varying(50) DEFAULT 'general'::character varying,
    enable_face_detection boolean DEFAULT true,
    enable_eye_tracking boolean DEFAULT true,
    enable_voice_analysis boolean DEFAULT true,
    enable_tab_switching boolean DEFAULT true,
    enable_screen_recording boolean DEFAULT true,
    multiple_persons_threshold integer DEFAULT 1,
    look_away_threshold_seconds integer DEFAULT 5,
    eye_movement_threshold_seconds integer DEFAULT 5,
    tab_switch_max_count integer DEFAULT 3,
    audio_anomaly_threshold numeric DEFAULT 0.7,
    background_noise_threshold numeric DEFAULT 0.6,
    violation_base_penalty integer DEFAULT 5,
    high_severity_penalty integer DEFAULT 10,
    medium_severity_penalty integer DEFAULT 5,
    low_severity_penalty integer DEFAULT 2,
    min_passing_score integer DEFAULT 70,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    score_different_person_detected integer DEFAULT 15,
    score_identity_verification_uncertain integer DEFAULT 8,
    score_phone_detected integer DEFAULT 15,
    score_headphones_detected integer DEFAULT 5,
    score_suspicious_background_objects integer DEFAULT 5,
    score_suspicious_screen_content integer DEFAULT 15,
    score_no_person_in_frame integer DEFAULT 10,
    score_face_at_edge integer DEFAULT 3,
    score_face_occluded integer DEFAULT 5,
    score_poor_lighting integer DEFAULT 2,
    score_looking_away integer DEFAULT 5,
    score_eye_gaze_off_screen integer DEFAULT 5,
    score_tab_switch integer DEFAULT 5,
    score_copy_attempt integer DEFAULT 3,
    score_print_screen integer DEFAULT 5,
    score_multiple_voices integer DEFAULT 8,
    score_audio_playback integer DEFAULT 5,
    score_external_conversation integer DEFAULT 10,
    score_multiple_monitors integer DEFAULT 5,
    score_virtual_machine integer DEFAULT 10,
    score_background_changed integer DEFAULT 3,
    score_clothing_changed integer DEFAULT 2,
    score_suspicious_typing integer DEFAULT 3,
    score_reading_pattern integer DEFAULT 5,
    score_multiple_speakers integer DEFAULT 8,
    enabled_different_person_detected boolean DEFAULT true,
    enabled_identity_verification_uncertain boolean DEFAULT true,
    enabled_phone_detected boolean DEFAULT true,
    enabled_headphones_detected boolean DEFAULT true,
    enabled_suspicious_background_objects boolean DEFAULT true,
    enabled_suspicious_screen_content boolean DEFAULT true,
    enabled_no_person_in_frame boolean DEFAULT true,
    enabled_face_at_edge boolean DEFAULT true,
    enabled_face_occluded boolean DEFAULT true,
    enabled_poor_lighting boolean DEFAULT true,
    enabled_looking_away boolean DEFAULT true,
    enabled_eye_gaze_off_screen boolean DEFAULT true,
    enabled_tab_switch boolean DEFAULT true,
    enabled_copy_attempt boolean DEFAULT true,
    enabled_print_screen boolean DEFAULT true,
    enabled_multiple_voices boolean DEFAULT true,
    enabled_audio_playback boolean DEFAULT true,
    enabled_external_conversation boolean DEFAULT true,
    enabled_multiple_monitors boolean DEFAULT true,
    enabled_virtual_machine boolean DEFAULT true,
    enabled_background_changed boolean DEFAULT true,
    enabled_clothing_changed boolean DEFAULT true,
    enabled_suspicious_typing boolean DEFAULT true,
    enabled_reading_pattern boolean DEFAULT true,
    enabled_multiple_speakers boolean DEFAULT true,
    enable_object_detection boolean DEFAULT true,
    enable_screen_content_analysis boolean DEFAULT true
);


--
-- Name: proctoring_violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proctoring_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    violation_type text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    description text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    screenshot_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_ignored boolean DEFAULT false,
    ignored_reason text,
    ignored_by uuid,
    ignored_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: promotion_applicable_orgs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_applicable_orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: promotion_applicable_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_applicable_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: promotion_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid,
    applied_at timestamp with time zone DEFAULT now(),
    discount_applied_cents integer NOT NULL,
    original_amount_cents integer NOT NULL,
    final_amount_cents integer NOT NULL
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    promotion_type text NOT NULL,
    code text,
    discount_percent integer DEFAULT 0 NOT NULL,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    first_period_type text,
    first_period_discount_percent integer DEFAULT 0,
    max_uses integer,
    current_uses integer DEFAULT 0,
    max_uses_per_org integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT promotions_discount_percent_check CHECK (((discount_percent >= 0) AND (discount_percent <= 100))),
    CONSTRAINT promotions_first_period_type_check CHECK ((first_period_type = ANY (ARRAY['month'::text, 'year'::text]))),
    CONSTRAINT promotions_promotion_type_check CHECK ((promotion_type = ANY (ARRAY['coupon_code'::text, 'time_limited'::text, 'first_period'::text, 'partner_specific'::text])))
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid NOT NULL,
    question_text text NOT NULL,
    topic text NOT NULL,
    difficulty text NOT NULL,
    correct_answer text,
    options jsonb,
    order_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    used_in_attempts jsonb DEFAULT '[]'::jsonb,
    question_type text DEFAULT 'descriptive'::text,
    coding_schema jsonb,
    allowed_languages text[],
    selection_count integer DEFAULT 0,
    version integer DEFAULT 1 NOT NULL,
    deleted_at timestamp with time zone,
    organization_id uuid,
    CONSTRAINT questions_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]))),
    CONSTRAINT questions_question_type_check CHECK ((question_type = ANY (ARRAY['mcq'::text, 'scenario'::text, 'coding'::text, 'descriptive'::text])))
);


--
-- Name: rate_limit_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_buckets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    endpoint text NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    request_count integer DEFAULT 1 NOT NULL,
    max_requests integer DEFAULT 60 NOT NULL,
    window_seconds integer DEFAULT 60 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: report_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    report_type text NOT NULL,
    metrics text[] NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    "grouping" text[],
    visualization_config jsonb,
    schedule text,
    recipients text[],
    is_public boolean DEFAULT false,
    created_by uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: resume_parsing_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_parsing_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_email text NOT NULL,
    candidate_name text NOT NULL,
    resume_text text,
    parsed_data jsonb NOT NULL,
    extracted_skills text[],
    experience_years integer,
    education_level text,
    suggested_questions jsonb DEFAULT '[]'::jsonb,
    parsing_model text NOT NULL,
    confidence_score numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_name text NOT NULL,
    action_description text,
    allowed_roles public.app_role[] DEFAULT '{}'::public.app_role[] NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    severity text NOT NULL,
    user_id uuid,
    ip_address text,
    user_agent text,
    resource_type text,
    resource_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    plan_type text NOT NULL,
    price_amount integer DEFAULT 0 NOT NULL,
    billing_period text DEFAULT 'monthly'::text NOT NULL,
    max_users integer DEFAULT 5 NOT NULL,
    max_interviews integer DEFAULT 100 NOT NULL,
    max_ai_usage integer DEFAULT 10000 NOT NULL,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    display_order integer DEFAULT 0 NOT NULL,
    pricing_model text DEFAULT 'fixed'::text NOT NULL,
    price_per_interview integer DEFAULT 0,
    price_per_invitation integer DEFAULT 0,
    price_per_completed_interview integer DEFAULT 0,
    included_interviews integer DEFAULT 0,
    included_invitations integer DEFAULT 0,
    overage_price_per_interview integer DEFAULT 0,
    overage_price_per_invitation integer DEFAULT 0,
    minimum_monthly integer DEFAULT 0,
    pricing_notes text,
    annual_discount_percent integer DEFAULT 20 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    CONSTRAINT subscription_plans_billing_period_check CHECK ((billing_period = ANY (ARRAY['monthly'::text, 'annual'::text]))),
    CONSTRAINT subscription_plans_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'INR'::text, 'GBP'::text]))),
    CONSTRAINT subscription_plans_plan_type_check CHECK ((plan_type = ANY (ARRAY['starter'::text, 'professional'::text, 'business'::text, 'enterprise'::text]))),
    CONSTRAINT subscription_plans_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['fixed'::text, 'usage_based'::text, 'hybrid'::text])))
);


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: test_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    test_name text NOT NULL,
    test_category text NOT NULL,
    status text NOT NULL,
    execution_time_ms integer,
    error_message text,
    details jsonb,
    fix_recommendation text,
    severity text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT test_results_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text, 'info'::text]))),
    CONSTRAINT test_results_status_check CHECK ((status = ANY (ARRAY['passed'::text, 'failed'::text, 'warning'::text, 'skipped'::text])))
);


--
-- Name: test_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    suite_id uuid,
    initiated_by uuid,
    status text DEFAULT 'running'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    total_tests integer DEFAULT 0,
    passed_tests integer DEFAULT 0,
    failed_tests integer DEFAULT 0,
    warnings integer DEFAULT 0,
    execution_time_ms integer,
    summary text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT test_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: test_suites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_suites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT test_suites_category_check CHECK ((category = ANY (ARRAY['security'::text, 'functionality'::text, 'performance'::text, 'integration'::text, 'all'::text])))
);


--
-- Name: training_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name text NOT NULL,
    role_description text,
    difficulty_level text DEFAULT 'beginner'::text NOT NULL,
    estimated_duration integer,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: training_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_plan_id uuid NOT NULL,
    topic_name text NOT NULL,
    subtopic text,
    difficulty_level text DEFAULT 'beginner'::text NOT NULL,
    estimated_duration integer,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    interviews_conducted integer DEFAULT 0,
    ai_tokens_used integer DEFAULT 0,
    active_users integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT now(),
    certificate_ids uuid[] DEFAULT ARRAY[]::uuid[]
);


--
-- Name: user_custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_custom_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    custom_role_id uuid NOT NULL,
    organization_id uuid,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    organization_id uuid,
    created_by_role text DEFAULT 'platform_admin'::text
);


--
-- Name: user_topic_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_topic_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    training_topic_id uuid NOT NULL,
    materials_completed integer DEFAULT 0 NOT NULL,
    total_materials integer DEFAULT 0 NOT NULL,
    assessments_completed integer DEFAULT 0 NOT NULL,
    best_score integer,
    status text DEFAULT 'not_started'::text NOT NULL,
    last_accessed_at timestamp with time zone,
    completed_at timestamp with time zone
);


--
-- Name: user_training_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_training_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    training_plan_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'assigned'::text NOT NULL,
    progress_percentage integer DEFAULT 0 NOT NULL
);


--
-- Name: activity_feed activity_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_feed
    ADD CONSTRAINT activity_feed_pkey PRIMARY KEY (id);


--
-- Name: ai_coach_sessions ai_coach_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_coach_sessions
    ADD CONSTRAINT ai_coach_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_alerts ai_feature_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_alerts
    ADD CONSTRAINT ai_feature_alerts_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_configurations ai_feature_configurations_feature_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_configurations
    ADD CONSTRAINT ai_feature_configurations_feature_name_key UNIQUE (feature_name);


--
-- Name: ai_feature_configurations ai_feature_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_configurations
    ADD CONSTRAINT ai_feature_configurations_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_health ai_feature_health_feature_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_health
    ADD CONSTRAINT ai_feature_health_feature_id_key UNIQUE (feature_id);


--
-- Name: ai_feature_health ai_feature_health_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_health
    ADD CONSTRAINT ai_feature_health_pkey PRIMARY KEY (id);


--
-- Name: ai_health_alerts ai_health_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_health_alerts
    ADD CONSTRAINT ai_health_alerts_pkey PRIMARY KEY (id);


--
-- Name: ai_health_checks ai_health_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_health_checks
    ADD CONSTRAINT ai_health_checks_pkey PRIMARY KEY (id);


--
-- Name: ai_health_monitoring ai_health_monitoring_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_health_monitoring
    ADD CONSTRAINT ai_health_monitoring_pkey PRIMARY KEY (id);


--
-- Name: ai_model_configurations ai_model_configurations_feature_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_configurations
    ADD CONSTRAINT ai_model_configurations_feature_name_key UNIQUE (feature_name);


--
-- Name: ai_model_configurations ai_model_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_configurations
    ADD CONSTRAINT ai_model_configurations_pkey PRIMARY KEY (id);


--
-- Name: ai_model_performance ai_model_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_performance
    ADD CONSTRAINT ai_model_performance_pkey PRIMARY KEY (id);


--
-- Name: ai_provider_credentials ai_provider_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_pkey PRIMARY KEY (id);


--
-- Name: ai_providers ai_providers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_name_key UNIQUE (name);


--
-- Name: ai_providers ai_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_providers
    ADD CONSTRAINT ai_providers_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: analytics_snapshots analytics_snapshots_organization_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_organization_id_snapshot_date_key UNIQUE (organization_id, snapshot_date);


--
-- Name: analytics_snapshots analytics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: architecture_documents architecture_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.architecture_documents
    ADD CONSTRAINT architecture_documents_pkey PRIMARY KEY (id);


--
-- Name: assessments assessments_attempt_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_attempt_id_key UNIQUE (attempt_id);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: ats_candidates ats_candidates_integration_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_candidates
    ADD CONSTRAINT ats_candidates_integration_id_external_id_key UNIQUE (integration_id, external_id);


--
-- Name: ats_candidates ats_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_candidates
    ADD CONSTRAINT ats_candidates_pkey PRIMARY KEY (id);


--
-- Name: ats_integrations ats_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_integrations
    ADD CONSTRAINT ats_integrations_pkey PRIMARY KEY (id);


--
-- Name: ats_sync_logs ats_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_sync_logs
    ADD CONSTRAINT ats_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: attempt_questions attempt_questions_attempt_id_display_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_attempt_id_display_order_key UNIQUE (attempt_id, display_order);


--
-- Name: attempt_questions attempt_questions_attempt_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_attempt_id_question_id_key UNIQUE (attempt_id, question_id);


--
-- Name: attempt_questions attempt_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bias_detection_results bias_detection_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bias_detection_results
    ADD CONSTRAINT bias_detection_results_pkey PRIMARY KEY (id);


--
-- Name: candidate_performance_index candidate_performance_index_attempt_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_performance_index
    ADD CONSTRAINT candidate_performance_index_attempt_id_key UNIQUE (attempt_id);


--
-- Name: candidate_performance_index candidate_performance_index_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_performance_index
    ADD CONSTRAINT candidate_performance_index_pkey PRIMARY KEY (id);


--
-- Name: certificate_badges certificate_badges_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_badges
    ADD CONSTRAINT certificate_badges_name_key UNIQUE (name);


--
-- Name: certificate_badges certificate_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_badges
    ADD CONSTRAINT certificate_badges_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_attempt_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_attempt_id_key UNIQUE (attempt_id);


--
-- Name: certificates certificates_certificate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_certificate_number_key UNIQUE (certificate_number);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_verification_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_verification_code_key UNIQUE (verification_code);


--
-- Name: certification_assessments certification_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_assessments
    ADD CONSTRAINT certification_assessments_pkey PRIMARY KEY (id);


--
-- Name: certification_attempts certification_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_pkey PRIMARY KEY (id);


--
-- Name: certification_global_config certification_global_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_global_config
    ADD CONSTRAINT certification_global_config_pkey PRIMARY KEY (id);


--
-- Name: certification_topics certification_topics_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_topics
    ADD CONSTRAINT certification_topics_name_key UNIQUE (name);


--
-- Name: certification_topics certification_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_topics
    ADD CONSTRAINT certification_topics_pkey PRIMARY KEY (id);


--
-- Name: chatbot_knowledge chatbot_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_knowledge
    ADD CONSTRAINT chatbot_knowledge_pkey PRIMARY KEY (id);


--
-- Name: circuit_breaker_state circuit_breaker_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_state
    ADD CONSTRAINT circuit_breaker_state_pkey PRIMARY KEY (id);


--
-- Name: circuit_breaker_state circuit_breaker_state_service_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_state
    ADD CONSTRAINT circuit_breaker_state_service_name_key UNIQUE (service_name);


--
-- Name: collaboration_threads collaboration_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_threads
    ADD CONSTRAINT collaboration_threads_pkey PRIMARY KEY (id);


--
-- Name: comparative_analytics comparative_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparative_analytics
    ADD CONSTRAINT comparative_analytics_pkey PRIMARY KEY (id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: custom_roles custom_roles_name_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_name_organization_id_key UNIQUE (name, organization_id);


--
-- Name: custom_roles custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_pkey PRIMARY KEY (id);


--
-- Name: data_deletion_requests data_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_pkey PRIMARY KEY (id);


--
-- Name: data_retention_policies data_retention_policies_organization_id_data_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_organization_id_data_type_key UNIQUE (organization_id, data_type);


--
-- Name: data_retention_policies data_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_pkey PRIMARY KEY (id);


--
-- Name: documentation documentation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentation
    ADD CONSTRAINT documentation_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_template_key_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_template_key_organization_id_key UNIQUE (template_key, organization_id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: generated_reports generated_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_key_key UNIQUE (key);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: interview_attempts interview_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_attempts
    ADD CONSTRAINT interview_attempts_pkey PRIMARY KEY (id);


--
-- Name: interview_attempts interview_attempts_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_attempts
    ADD CONSTRAINT interview_attempts_session_token_key UNIQUE (session_token);


--
-- Name: interview_invitations interview_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_invitations
    ADD CONSTRAINT interview_invitations_pkey PRIMARY KEY (id);


--
-- Name: interview_invitations interview_invitations_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_invitations
    ADD CONSTRAINT interview_invitations_share_token_key UNIQUE (share_token);


--
-- Name: interview_operation_logs interview_operation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_operation_logs
    ADD CONSTRAINT interview_operation_logs_pkey PRIMARY KEY (id);


--
-- Name: interview_panel_members interview_panel_members_interview_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_panel_members
    ADD CONSTRAINT interview_panel_members_interview_id_user_id_key UNIQUE (interview_id, user_id);


--
-- Name: interview_panel_members interview_panel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_panel_members
    ADD CONSTRAINT interview_panel_members_pkey PRIMARY KEY (id);


--
-- Name: interview_schedules interview_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_schedules
    ADD CONSTRAINT interview_schedules_pkey PRIMARY KEY (id);


--
-- Name: interview_templates interview_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_templates
    ADD CONSTRAINT interview_templates_pkey PRIMARY KEY (id);


--
-- Name: interviews interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);


--
-- Name: interviews interviews_share_link_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_share_link_key UNIQUE (share_link);


--
-- Name: invoices invoices_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: learning_assessment_attempts learning_assessment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_attempts
    ADD CONSTRAINT learning_assessment_attempts_pkey PRIMARY KEY (id);


--
-- Name: learning_assessment_feedback learning_assessment_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_feedback
    ADD CONSTRAINT learning_assessment_feedback_pkey PRIMARY KEY (id);


--
-- Name: learning_assessment_questions learning_assessment_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_questions
    ADD CONSTRAINT learning_assessment_questions_pkey PRIMARY KEY (id);


--
-- Name: learning_assessment_usage learning_assessment_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_usage
    ADD CONSTRAINT learning_assessment_usage_pkey PRIMARY KEY (id);


--
-- Name: learning_assessments learning_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessments
    ADD CONSTRAINT learning_assessments_pkey PRIMARY KEY (id);


--
-- Name: learning_materials learning_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_materials
    ADD CONSTRAINT learning_materials_pkey PRIMARY KEY (id);


--
-- Name: learning_payments learning_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_payments
    ADD CONSTRAINT learning_payments_pkey PRIMARY KEY (id);


--
-- Name: learning_plans learning_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_plans
    ADD CONSTRAINT learning_plans_pkey PRIMARY KEY (id);


--
-- Name: learning_subscriptions learning_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_subscriptions
    ADD CONSTRAINT learning_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_progress onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id);


--
-- Name: onboarding_progress onboarding_progress_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_user_id_key UNIQUE (user_id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organization_subscriptions organization_subscriptions_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_organization_id_key UNIQUE (organization_id);


--
-- Name: organization_subscriptions organization_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);


--
-- Name: panel_consensus panel_consensus_attempt_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.panel_consensus
    ADD CONSTRAINT panel_consensus_attempt_id_key UNIQUE (attempt_id);


--
-- Name: panel_consensus panel_consensus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.panel_consensus
    ADD CONSTRAINT panel_consensus_pkey PRIMARY KEY (id);


--
-- Name: panel_evaluations panel_evaluations_attempt_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.panel_evaluations
    ADD CONSTRAINT panel_evaluations_attempt_id_reviewer_id_key UNIQUE (attempt_id, reviewer_id);


--
-- Name: panel_evaluations panel_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.panel_evaluations
    ADD CONSTRAINT panel_evaluations_pkey PRIMARY KEY (id);


--
-- Name: partner_applications partner_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_applications
    ADD CONSTRAINT partner_applications_pkey PRIMARY KEY (id);


--
-- Name: password_setup_invitations password_setup_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_invitations
    ADD CONSTRAINT password_setup_invitations_pkey PRIMARY KEY (id);


--
-- Name: password_setup_invitations password_setup_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_invitations
    ADD CONSTRAINT password_setup_invitations_token_key UNIQUE (token);


--
-- Name: payment_gateways payment_gateways_gateway_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT payment_gateways_gateway_name_key UNIQUE (gateway_name);


--
-- Name: payment_gateways payment_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT payment_gateways_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: platform_configurations platform_configurations_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_configurations
    ADD CONSTRAINT platform_configurations_key_key UNIQUE (key);


--
-- Name: platform_configurations platform_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_configurations
    ADD CONSTRAINT platform_configurations_pkey PRIMARY KEY (id);


--
-- Name: platform_documentation platform_documentation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_documentation
    ADD CONSTRAINT platform_documentation_pkey PRIMARY KEY (id);


--
-- Name: platform_documentation_versions platform_documentation_versions_document_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_documentation_versions
    ADD CONSTRAINT platform_documentation_versions_document_id_version_number_key UNIQUE (document_id, version_number);


--
-- Name: platform_documentation_versions platform_documentation_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_documentation_versions
    ADD CONSTRAINT platform_documentation_versions_pkey PRIMARY KEY (id);


--
-- Name: predictive_analytics predictive_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predictive_analytics
    ADD CONSTRAINT predictive_analytics_pkey PRIMARY KEY (id);


--
-- Name: preinterview_check_logs preinterview_check_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preinterview_check_logs
    ADD CONSTRAINT preinterview_check_logs_pkey PRIMARY KEY (id);


--
-- Name: proctoring_sessions proctoring_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_sessions
    ADD CONSTRAINT proctoring_sessions_pkey PRIMARY KEY (id);


--
-- Name: proctoring_settings proctoring_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_settings
    ADD CONSTRAINT proctoring_settings_pkey PRIMARY KEY (id);


--
-- Name: proctoring_violations proctoring_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_violations
    ADD CONSTRAINT proctoring_violations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promotion_applicable_orgs promotion_applicable_orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_orgs
    ADD CONSTRAINT promotion_applicable_orgs_pkey PRIMARY KEY (id);


--
-- Name: promotion_applicable_orgs promotion_applicable_orgs_promotion_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_orgs
    ADD CONSTRAINT promotion_applicable_orgs_promotion_id_organization_id_key UNIQUE (promotion_id, organization_id);


--
-- Name: promotion_applicable_plans promotion_applicable_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_plans
    ADD CONSTRAINT promotion_applicable_plans_pkey PRIMARY KEY (id);


--
-- Name: promotion_applicable_plans promotion_applicable_plans_promotion_id_plan_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_plans
    ADD CONSTRAINT promotion_applicable_plans_promotion_id_plan_id_key UNIQUE (promotion_id, plan_id);


--
-- Name: promotion_usages promotion_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_pkey PRIMARY KEY (id);


--
-- Name: promotion_usages promotion_usages_promotion_id_organization_id_subscription__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_promotion_id_organization_id_subscription__key UNIQUE (promotion_id, organization_id, subscription_id);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_buckets rate_limit_buckets_identifier_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_identifier_endpoint_key UNIQUE (identifier, endpoint);


--
-- Name: rate_limit_buckets rate_limit_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (id);


--
-- Name: report_templates report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_pkey PRIMARY KEY (id);


--
-- Name: resume_parsing_results resume_parsing_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_parsing_results
    ADD CONSTRAINT resume_parsing_results_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_action_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_action_name_key UNIQUE (action_name);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (key);


--
-- Name: test_results test_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_pkey PRIMARY KEY (id);


--
-- Name: test_runs test_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_pkey PRIMARY KEY (id);


--
-- Name: test_suites test_suites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_suites
    ADD CONSTRAINT test_suites_pkey PRIMARY KEY (id);


--
-- Name: training_plans training_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_pkey PRIMARY KEY (id);


--
-- Name: training_topics training_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_topics
    ADD CONSTRAINT training_topics_pkey PRIMARY KEY (id);


--
-- Name: usage_tracking usage_tracking_org_period_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT usage_tracking_org_period_unique UNIQUE (organization_id, period_start);


--
-- Name: usage_tracking usage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT usage_tracking_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_user_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);


--
-- Name: user_custom_roles user_custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_pkey PRIMARY KEY (id);


--
-- Name: user_custom_roles user_custom_roles_user_id_custom_role_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_user_id_custom_role_id_organization_id_key UNIQUE (user_id, custom_role_id, organization_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_topic_progress user_topic_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_progress
    ADD CONSTRAINT user_topic_progress_pkey PRIMARY KEY (id);


--
-- Name: user_topic_progress user_topic_progress_user_id_training_topic_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_progress
    ADD CONSTRAINT user_topic_progress_user_id_training_topic_id_key UNIQUE (user_id, training_topic_id);


--
-- Name: user_training_assignments user_training_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_training_assignments
    ADD CONSTRAINT user_training_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_training_assignments user_training_assignments_user_id_training_plan_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_training_assignments
    ADD CONSTRAINT user_training_assignments_user_id_training_plan_id_key UNIQUE (user_id, training_plan_id);


--
-- Name: email_templates_platform_default_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_templates_platform_default_idx ON public.email_templates USING btree (template_key) WHERE (organization_id IS NULL);


--
-- Name: idx_activity_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_created ON public.activity_feed USING btree (created_at DESC);


--
-- Name: idx_activity_feed_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_feed_actor ON public.activity_feed USING btree (actor_id);


--
-- Name: idx_activity_feed_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_feed_created ON public.activity_feed USING btree (created_at DESC);


--
-- Name: idx_activity_feed_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_feed_entity ON public.activity_feed USING btree (entity_type, entity_id);


--
-- Name: idx_activity_feed_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_feed_org ON public.activity_feed USING btree (organization_id);


--
-- Name: idx_activity_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_org ON public.activity_feed USING btree (organization_id);


--
-- Name: idx_ai_coach_sessions_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_coach_sessions_attempt ON public.ai_coach_sessions USING btree (attempt_id);


--
-- Name: idx_ai_coach_sessions_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_coach_sessions_email ON public.ai_coach_sessions USING btree (candidate_email);


--
-- Name: idx_ai_coach_sessions_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_coach_sessions_interview ON public.ai_coach_sessions USING btree (interview_id);


--
-- Name: idx_ai_feature_alerts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_alerts_created ON public.ai_feature_alerts USING btree (created_at);


--
-- Name: idx_ai_feature_alerts_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_alerts_feature ON public.ai_feature_alerts USING btree (feature_name);


--
-- Name: idx_ai_feature_alerts_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_alerts_resolved ON public.ai_feature_alerts USING btree (resolved_at) WHERE (resolved_at IS NULL);


--
-- Name: idx_ai_feature_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_alerts_severity ON public.ai_feature_alerts USING btree (severity);


--
-- Name: idx_ai_feature_configs_fallback_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_configs_fallback_provider ON public.ai_feature_configurations USING btree (fallback_provider_id);


--
-- Name: idx_ai_feature_configs_primary_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_configs_primary_provider ON public.ai_feature_configurations USING btree (primary_provider_id);


--
-- Name: idx_ai_feature_health_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_health_status ON public.ai_feature_health USING btree (status);


--
-- Name: idx_ai_health_alerts_unacked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_alerts_unacked ON public.ai_health_alerts USING btree (is_acknowledged, created_at DESC) WHERE (NOT is_acknowledged);


--
-- Name: idx_ai_health_checks_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_checks_feature ON public.ai_health_checks USING btree (feature_id, created_at DESC);


--
-- Name: idx_ai_health_monitoring_checked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_monitoring_checked ON public.ai_health_monitoring USING btree (checked_at);


--
-- Name: idx_ai_health_monitoring_checked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_monitoring_checked_at ON public.ai_health_monitoring USING btree (checked_at DESC);


--
-- Name: idx_ai_health_monitoring_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_monitoring_feature ON public.ai_health_monitoring USING btree (feature_name);


--
-- Name: idx_ai_health_monitoring_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_monitoring_status ON public.ai_health_monitoring USING btree (status);


--
-- Name: idx_ai_model_configurations_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_model_configurations_enabled ON public.ai_model_configurations USING btree (enabled);


--
-- Name: idx_ai_model_configurations_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_model_configurations_feature ON public.ai_model_configurations USING btree (feature_name);


--
-- Name: idx_ai_model_performance_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_model_performance_feature ON public.ai_model_performance USING btree (feature_id, is_active_test);


--
-- Name: idx_ai_provider_credentials_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_provider_credentials_provider ON public.ai_provider_credentials USING btree (provider_id);


--
-- Name: idx_ai_usage_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_created ON public.ai_usage_logs USING btree (created_at DESC);


--
-- Name: idx_ai_usage_logs_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_feature ON public.ai_usage_logs USING btree (feature_name);


--
-- Name: idx_ai_usage_logs_interview_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_interview_id ON public.ai_usage_logs USING btree (interview_id);


--
-- Name: idx_ai_usage_logs_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_org_created ON public.ai_usage_logs USING btree (organization_id, created_at DESC);


--
-- Name: idx_ai_usage_logs_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_organization_id ON public.ai_usage_logs USING btree (organization_id);


--
-- Name: idx_ai_usage_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs USING btree (user_id);


--
-- Name: idx_analytics_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_org ON public.predictive_analytics USING btree (organization_id);


--
-- Name: idx_analytics_snapshots_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_snapshots_date ON public.analytics_snapshots USING btree (snapshot_date);


--
-- Name: idx_analytics_snapshots_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_snapshots_org ON public.analytics_snapshots USING btree (organization_id);


--
-- Name: idx_analytics_snapshots_org_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_snapshots_org_date ON public.analytics_snapshots USING btree (organization_id, snapshot_date);


--
-- Name: idx_architecture_documents_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_architecture_documents_section ON public.architecture_documents USING btree (section);


--
-- Name: idx_assessments_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_attempt ON public.assessments USING btree (attempt_id);


--
-- Name: idx_assessments_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_organization_id ON public.assessments USING btree (organization_id);


--
-- Name: idx_ats_candidates_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ats_candidates_email ON public.ats_candidates USING btree (email);


--
-- Name: idx_ats_candidates_integration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ats_candidates_integration ON public.ats_candidates USING btree (integration_id);


--
-- Name: idx_ats_candidates_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ats_candidates_interview ON public.ats_candidates USING btree (interview_id);


--
-- Name: idx_ats_integrations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ats_integrations_org ON public.ats_integrations USING btree (organization_id);


--
-- Name: idx_ats_sync_logs_integration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ats_sync_logs_integration ON public.ats_sync_logs USING btree (integration_id);


--
-- Name: idx_attempt_questions_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempt_questions_attempt_id ON public.attempt_questions USING btree (attempt_id);


--
-- Name: idx_attempt_questions_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempt_questions_question_id ON public.attempt_questions USING btree (question_id);


--
-- Name: idx_attempts_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_interview ON public.interview_attempts USING btree (interview_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_bias_results_assessment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bias_results_assessment ON public.bias_detection_results USING btree (assessment_id);


--
-- Name: idx_certificate_badges_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificate_badges_category ON public.certificate_badges USING btree (category);


--
-- Name: idx_certificate_badges_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificate_badges_type ON public.certificate_badges USING btree (badge_type);


--
-- Name: idx_certificates_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_expires ON public.certificates USING btree (expires_at);


--
-- Name: idx_certificates_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_expires_at ON public.certificates USING btree (expires_at);


--
-- Name: idx_certificates_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_number ON public.certificates USING btree (certificate_number);


--
-- Name: idx_certificates_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_topic ON public.certificates USING btree (certification_topic_id);


--
-- Name: idx_certificates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_user ON public.certificates USING btree (user_id);


--
-- Name: idx_certificates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_user_id ON public.certificates USING btree (user_id);


--
-- Name: idx_certificates_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_verification ON public.certificates USING btree (verification_code);


--
-- Name: idx_certificates_verification_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_verification_code ON public.certificates USING btree (verification_code);


--
-- Name: idx_certification_topics_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certification_topics_active ON public.certification_topics USING btree (is_active);


--
-- Name: idx_certification_topics_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certification_topics_category ON public.certification_topics USING btree (category);


--
-- Name: idx_certification_topics_difficulty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certification_topics_difficulty ON public.certification_topics USING btree (difficulty_level);


--
-- Name: idx_certification_topics_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certification_topics_provider ON public.certification_topics USING btree (provider);


--
-- Name: idx_chatbot_knowledge_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_knowledge_active ON public.chatbot_knowledge USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_chatbot_knowledge_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_knowledge_category ON public.chatbot_knowledge USING btree (category);


--
-- Name: idx_chatbot_knowledge_role_specific; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_knowledge_role_specific ON public.chatbot_knowledge USING gin (role_specific);


--
-- Name: idx_circuit_breaker_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circuit_breaker_service ON public.circuit_breaker_state USING btree (service_name);


--
-- Name: idx_comparative_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comparative_org ON public.comparative_analytics USING btree (organization_id);


--
-- Name: idx_consent_records_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_email ON public.consent_records USING btree (candidate_email);


--
-- Name: idx_consent_records_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_interview ON public.consent_records USING btree (interview_id);


--
-- Name: idx_consent_records_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_type ON public.consent_records USING btree (consent_type);


--
-- Name: idx_cpi_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpi_attempt_id ON public.candidate_performance_index USING btree (attempt_id);


--
-- Name: idx_cpi_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpi_created_at ON public.candidate_performance_index USING btree (created_at DESC);


--
-- Name: idx_cpi_interview_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpi_interview_id ON public.candidate_performance_index USING btree (interview_id);


--
-- Name: idx_cpi_overall_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpi_overall_score ON public.candidate_performance_index USING btree (overall_cpi DESC);


--
-- Name: idx_custom_roles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_roles_active ON public.custom_roles USING btree (is_active);


--
-- Name: idx_custom_roles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_roles_name ON public.custom_roles USING btree (name);


--
-- Name: idx_custom_roles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_roles_org ON public.custom_roles USING btree (organization_id);


--
-- Name: idx_data_deletion_requests_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_deletion_requests_email ON public.data_deletion_requests USING btree (candidate_email);


--
-- Name: idx_data_deletion_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_deletion_requests_status ON public.data_deletion_requests USING btree (status);


--
-- Name: idx_data_deletion_requests_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_deletion_requests_type ON public.data_deletion_requests USING btree (request_type);


--
-- Name: idx_data_retention_policies_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_retention_policies_org ON public.data_retention_policies USING btree (organization_id);


--
-- Name: idx_data_retention_policies_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_retention_policies_type ON public.data_retention_policies USING btree (data_type);


--
-- Name: idx_doc_versions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_versions_created_at ON public.platform_documentation_versions USING btree (created_at DESC);


--
-- Name: idx_doc_versions_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_versions_document_id ON public.platform_documentation_versions USING btree (document_id);


--
-- Name: idx_email_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_created_at ON public.email_logs USING btree (created_at DESC);


--
-- Name: idx_email_logs_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_organization_id ON public.email_logs USING btree (organization_id);


--
-- Name: idx_email_logs_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_provider ON public.email_logs USING btree (provider);


--
-- Name: idx_email_logs_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_recipient ON public.email_logs USING btree (recipient_email);


--
-- Name: idx_email_logs_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_sent ON public.email_logs USING btree (sent);


--
-- Name: idx_email_logs_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_template ON public.email_logs USING btree (template);


--
-- Name: idx_failed_jobs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_failed_jobs_created ON public.failed_jobs USING btree (created_at DESC);


--
-- Name: idx_failed_jobs_job_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_failed_jobs_job_type ON public.failed_jobs USING btree (job_type);


--
-- Name: idx_failed_jobs_next_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_failed_jobs_next_retry ON public.failed_jobs USING btree (next_retry_at) WHERE (status = 'failed'::text);


--
-- Name: idx_failed_jobs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_failed_jobs_org ON public.failed_jobs USING btree (organization_id);


--
-- Name: idx_failed_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_failed_jobs_status ON public.failed_jobs USING btree (status);


--
-- Name: idx_idempotency_keys_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_expires ON public.idempotency_keys USING btree (expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_idempotency_keys_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_key ON public.idempotency_keys USING btree (key);


--
-- Name: idx_idempotency_keys_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_operation ON public.idempotency_keys USING btree (operation_type, resource_id);


--
-- Name: idx_interview_attempts_invitation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_attempts_invitation_id ON public.interview_attempts USING btree (invitation_id);


--
-- Name: idx_interview_attempts_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_attempts_session_token ON public.interview_attempts USING btree (session_token);


--
-- Name: idx_interview_attempts_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_attempts_status_created ON public.interview_attempts USING btree (status, created_at);


--
-- Name: idx_interview_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_invitations_email ON public.interview_invitations USING btree (candidate_email);


--
-- Name: idx_interview_invitations_interview_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_invitations_interview_id ON public.interview_invitations USING btree (interview_id);


--
-- Name: idx_interview_invitations_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_invitations_metadata ON public.interview_invitations USING gin (metadata);


--
-- Name: idx_interview_invitations_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_invitations_share_token ON public.interview_invitations USING btree (share_token);


--
-- Name: idx_interview_panel_members_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_panel_members_added_by ON public.interview_panel_members USING btree (added_by);


--
-- Name: idx_interview_panel_members_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_panel_members_interview ON public.interview_panel_members USING btree (interview_id);


--
-- Name: idx_interview_panel_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_panel_members_user ON public.interview_panel_members USING btree (user_id);


--
-- Name: idx_interview_templates_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_templates_is_active ON public.interview_templates USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_interviews_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_creator ON public.interviews USING btree (creator_id);


--
-- Name: idx_interviews_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_deleted ON public.interviews USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_interviews_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_interviews_org_slug ON public.interviews USING btree (organization_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_interviews_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_organization_id ON public.interviews USING btree (organization_id);


--
-- Name: idx_interviews_questions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_questions_status ON public.interviews USING btree (questions_status);


--
-- Name: idx_interviews_tech_spoc_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_tech_spoc_reviewer ON public.interviews USING btree (tech_spoc_reviewer_id);


--
-- Name: idx_invoices_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_organization ON public.invoices USING btree (organization_id);


--
-- Name: idx_invoices_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_period ON public.invoices USING btree (period_start, period_end);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_learning_assessment_attempts_assessment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_attempts_assessment_id ON public.learning_assessment_attempts USING btree (assessment_id);


--
-- Name: idx_learning_assessment_attempts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_attempts_user_id ON public.learning_assessment_attempts USING btree (user_id);


--
-- Name: idx_learning_assessment_feedback_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_feedback_attempt_id ON public.learning_assessment_feedback USING btree (attempt_id);


--
-- Name: idx_learning_assessment_questions_assessment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_questions_assessment ON public.learning_assessment_questions USING btree (assessment_id);


--
-- Name: idx_learning_assessment_questions_assessment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_questions_assessment_id ON public.learning_assessment_questions USING btree (assessment_id);


--
-- Name: idx_learning_assessment_usage_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_usage_date ON public.learning_assessment_usage USING btree (usage_date);


--
-- Name: idx_learning_assessment_usage_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_usage_user ON public.learning_assessment_usage USING btree (user_id);


--
-- Name: idx_learning_assessment_usage_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessment_usage_user_date ON public.learning_assessment_usage USING btree (user_id, usage_date);


--
-- Name: idx_learning_assessments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessments_user ON public.learning_assessments USING btree (user_id);


--
-- Name: idx_learning_assessments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_assessments_user_id ON public.learning_assessments USING btree (user_id);


--
-- Name: idx_learning_attempts_assessment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_attempts_assessment ON public.learning_assessment_attempts USING btree (assessment_id);


--
-- Name: idx_learning_attempts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_attempts_user ON public.learning_assessment_attempts USING btree (user_id);


--
-- Name: idx_learning_materials_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_materials_topic ON public.learning_materials USING btree (training_topic_id);


--
-- Name: idx_learning_payments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_payments_user_id ON public.learning_payments USING btree (user_id);


--
-- Name: idx_learning_subscriptions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_subscriptions_expires_at ON public.learning_subscriptions USING btree (expires_at);


--
-- Name: idx_learning_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_subscriptions_user_id ON public.learning_subscriptions USING btree (user_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_operation_logs_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_attempt ON public.interview_operation_logs USING btree (attempt_id);


--
-- Name: idx_operation_logs_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_candidate ON public.interview_operation_logs USING btree (candidate_email);


--
-- Name: idx_operation_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_created ON public.interview_operation_logs USING btree (created_at DESC);


--
-- Name: idx_operation_logs_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_interview ON public.interview_operation_logs USING btree (interview_id);


--
-- Name: idx_operation_logs_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_operation ON public.interview_operation_logs USING btree (operation);


--
-- Name: idx_operation_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_status ON public.interview_operation_logs USING btree (status);


--
-- Name: idx_organizations_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_deleted ON public.organizations USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_panel_consensus_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_panel_consensus_attempt ON public.panel_consensus USING btree (attempt_id);


--
-- Name: idx_panel_consensus_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_panel_consensus_decision ON public.panel_consensus USING btree (final_decision);


--
-- Name: idx_panel_evaluations_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_panel_evaluations_attempt ON public.panel_evaluations USING btree (attempt_id);


--
-- Name: idx_panel_evaluations_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_panel_evaluations_reviewer ON public.panel_evaluations USING btree (reviewer_id);


--
-- Name: idx_panel_evaluations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_panel_evaluations_status ON public.panel_evaluations USING btree (status);


--
-- Name: idx_panel_members_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_panel_members_interview ON public.interview_panel_members USING btree (interview_id);


--
-- Name: idx_password_setup_invitations_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_setup_invitations_expires_at ON public.password_setup_invitations USING btree (expires_at);


--
-- Name: idx_password_setup_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_setup_invitations_token ON public.password_setup_invitations USING btree (token);


--
-- Name: idx_password_setup_invitations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_setup_invitations_user_id ON public.password_setup_invitations USING btree (user_id);


--
-- Name: idx_payment_methods_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_default ON public.payment_methods USING btree (is_default);


--
-- Name: idx_payment_methods_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_org ON public.payment_methods USING btree (organization_id);


--
-- Name: idx_payment_transactions_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_invoice ON public.payment_transactions USING btree (invoice_id);


--
-- Name: idx_payment_transactions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_org ON public.payment_transactions USING btree (organization_id);


--
-- Name: idx_payment_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_status ON public.payment_transactions USING btree (status);


--
-- Name: idx_platform_documentation_ai_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_documentation_ai_generated ON public.platform_documentation USING btree (is_ai_generated) WHERE (is_ai_generated = true);


--
-- Name: idx_platform_documentation_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_documentation_category ON public.platform_documentation USING btree (category);


--
-- Name: idx_platform_documentation_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_documentation_created_by ON public.platform_documentation USING btree (created_by);


--
-- Name: idx_platform_documentation_needs_regeneration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_documentation_needs_regeneration ON public.platform_documentation USING btree (needs_regeneration) WHERE (needs_regeneration = true);


--
-- Name: idx_platform_documentation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_documentation_status ON public.platform_documentation USING btree (status);


--
-- Name: idx_preinterview_logs_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_preinterview_logs_candidate ON public.preinterview_check_logs USING btree (candidate_email);


--
-- Name: idx_preinterview_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_preinterview_logs_created ON public.preinterview_check_logs USING btree (created_at DESC);


--
-- Name: idx_preinterview_logs_invitation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_preinterview_logs_invitation ON public.preinterview_check_logs USING btree (invitation_id);


--
-- Name: idx_proctoring_sessions_cert_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_sessions_cert_attempt ON public.proctoring_sessions USING btree (certification_attempt_id);


--
-- Name: idx_proctoring_sessions_ended_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_sessions_ended_at ON public.proctoring_sessions USING btree (ended_at);


--
-- Name: idx_proctoring_sessions_interview_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_sessions_interview_attempt ON public.proctoring_sessions USING btree (interview_attempt_id);


--
-- Name: idx_proctoring_sessions_learning_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_sessions_learning_attempt ON public.proctoring_sessions USING btree (learning_attempt_id);


--
-- Name: idx_proctoring_sessions_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_sessions_organization_id ON public.proctoring_sessions USING btree (organization_id);


--
-- Name: idx_proctoring_sessions_periodic_screenshots; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_sessions_periodic_screenshots ON public.proctoring_sessions USING gin (periodic_screenshots);


--
-- Name: idx_proctoring_sessions_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_sessions_review_status ON public.proctoring_sessions USING btree (review_status);


--
-- Name: idx_proctoring_settings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_settings_org ON public.proctoring_settings USING btree (organization_id);


--
-- Name: idx_proctoring_violations_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_violations_session ON public.proctoring_violations USING btree (session_id);


--
-- Name: idx_proctoring_violations_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_violations_severity ON public.proctoring_violations USING btree (severity);


--
-- Name: idx_proctoring_violations_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_violations_timestamp ON public.proctoring_violations USING btree ("timestamp");


--
-- Name: idx_proctoring_violations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proctoring_violations_type ON public.proctoring_violations USING btree (violation_type);


--
-- Name: idx_promotion_usages_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_usages_org ON public.promotion_usages USING btree (organization_id);


--
-- Name: idx_promotion_usages_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotion_usages_promotion ON public.promotion_usages USING btree (promotion_id);


--
-- Name: idx_promotions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotions_active ON public.promotions USING btree (is_active, valid_from, valid_until);


--
-- Name: idx_promotions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotions_code ON public.promotions USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: idx_questions_allowed_languages; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_allowed_languages ON public.questions USING gin (allowed_languages);


--
-- Name: idx_questions_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_deleted ON public.questions USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_questions_interview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_interview ON public.questions USING btree (interview_id);


--
-- Name: idx_questions_interview_id_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_interview_id_order ON public.questions USING btree (interview_id, order_index);


--
-- Name: idx_questions_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_organization_id ON public.questions USING btree (organization_id);


--
-- Name: idx_questions_selection_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_selection_count ON public.questions USING btree (interview_id, selection_count);


--
-- Name: idx_rate_limit_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_cleanup ON public.rate_limit_buckets USING btree (window_start);


--
-- Name: idx_rate_limit_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_lookup ON public.rate_limit_buckets USING btree (identifier, endpoint);


--
-- Name: idx_reports_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_org ON public.generated_reports USING btree (organization_id);


--
-- Name: idx_resume_parsing_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_parsing_email ON public.resume_parsing_results USING btree (candidate_email);


--
-- Name: idx_schedules_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_candidate ON public.interview_schedules USING btree (candidate_email);


--
-- Name: idx_schedules_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_date ON public.interview_schedules USING btree (scheduled_start);


--
-- Name: idx_security_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_created ON public.security_events USING btree (created_at);


--
-- Name: idx_security_events_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_severity ON public.security_events USING btree (severity);


--
-- Name: idx_security_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_user ON public.security_events USING btree (user_id);


--
-- Name: idx_subscription_plans_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plans_display_order ON public.subscription_plans USING btree (display_order);


--
-- Name: idx_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_category ON public.interview_templates USING btree (category);


--
-- Name: idx_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_org ON public.interview_templates USING btree (organization_id);


--
-- Name: idx_templates_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_role ON public.interview_templates USING btree (role_type);


--
-- Name: idx_test_results_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_results_run_id ON public.test_results USING btree (run_id);


--
-- Name: idx_test_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_results_status ON public.test_results USING btree (status);


--
-- Name: idx_test_runs_initiated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_runs_initiated_by ON public.test_runs USING btree (initiated_by);


--
-- Name: idx_test_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_runs_status ON public.test_runs USING btree (status);


--
-- Name: idx_threads_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_entity ON public.collaboration_threads USING btree (entity_type, entity_id);


--
-- Name: idx_training_topics_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_topics_plan ON public.training_topics USING btree (training_plan_id);


--
-- Name: idx_user_assignments_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_assignments_plan ON public.user_training_assignments USING btree (training_plan_id);


--
-- Name: idx_user_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_assignments_user ON public.user_training_assignments USING btree (user_id);


--
-- Name: idx_user_badges_badge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_badge ON public.user_badges USING btree (badge_id);


--
-- Name: idx_user_badges_badge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_badge_id ON public.user_badges USING btree (badge_id);


--
-- Name: idx_user_badges_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_user ON public.user_badges USING btree (user_id);


--
-- Name: idx_user_badges_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_user_id ON public.user_badges USING btree (user_id);


--
-- Name: idx_user_custom_roles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_custom_roles_org ON public.user_custom_roles USING btree (organization_id);


--
-- Name: idx_user_custom_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_custom_roles_role ON public.user_custom_roles USING btree (custom_role_id);


--
-- Name: idx_user_custom_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_custom_roles_user ON public.user_custom_roles USING btree (user_id);


--
-- Name: idx_user_progress_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_progress_topic ON public.user_topic_progress USING btree (training_topic_id);


--
-- Name: idx_user_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_progress_user ON public.user_topic_progress USING btree (user_id);


--
-- Name: idx_user_roles_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_organization_id ON public.user_roles USING btree (organization_id);


--
-- Name: idx_user_roles_user_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_org ON public.user_roles USING btree (user_id, organization_id);


--
-- Name: idx_workflows_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_entity ON public.approval_workflows USING btree (entity_type, entity_id);


--
-- Name: idx_workflows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_status ON public.approval_workflows USING btree (status);


--
-- Name: user_roles_user_role_org_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_roles_user_role_org_unique ON public.user_roles USING btree (user_id, role, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: learning_assessment_attempts audit_learning_assessment_attempts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_learning_assessment_attempts AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_attempts FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: learning_assessment_feedback audit_learning_assessment_feedback; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_learning_assessment_feedback AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_feedback FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: learning_assessments audit_learning_assessments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_learning_assessments AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessments FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: interview_attempts auto_evaluate_on_submit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_evaluate_on_submit AFTER UPDATE ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_evaluate();


--
-- Name: ai_provider_credentials encrypt_api_key_on_insert_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER encrypt_api_key_on_insert_update BEFORE INSERT OR UPDATE ON public.ai_provider_credentials FOR EACH ROW EXECUTE FUNCTION public.encrypt_api_key_trigger();


--
-- Name: organization_members enforce_single_org_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_single_org_membership BEFORE INSERT OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.check_multi_org_membership();


--
-- Name: assessments log_assessments_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_assessments_changes AFTER INSERT OR DELETE OR UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: interview_attempts log_interview_attempts_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_interview_attempts_changes AFTER INSERT OR DELETE OR UPDATE ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: learning_assessment_attempts log_learning_assessment_attempts_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_learning_assessment_attempts_changes AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_attempts FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: learning_assessment_feedback log_learning_assessment_feedback_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_learning_assessment_feedback_changes AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessment_feedback FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: learning_assessments log_learning_assessments_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_learning_assessments_changes AFTER INSERT OR DELETE OR UPDATE ON public.learning_assessments FOR EACH ROW EXECUTE FUNCTION public.log_assessment_changes();


--
-- Name: interviews set_interview_organization_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_interview_organization_trigger BEFORE INSERT ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.auto_set_interview_organization();


--
-- Name: interview_attempts set_session_token_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_session_token_trigger BEFORE INSERT ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.set_session_token();


--
-- Name: ai_usage_logs track_ai_tokens; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_ai_tokens AFTER INSERT ON public.ai_usage_logs FOR EACH ROW EXECUTE FUNCTION public.track_ai_usage();


--
-- Name: interviews track_interview_usage_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_interview_usage_delete AFTER DELETE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_usage_tracking();


--
-- Name: interviews track_interview_usage_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_interview_usage_insert AFTER INSERT ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_usage_tracking();


--
-- Name: interview_attempts trigger_auto_close_proctoring; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_close_proctoring AFTER UPDATE ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.auto_close_proctoring_on_submission();


--
-- Name: interview_attempts trigger_auto_evaluate_interview; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_evaluate_interview AFTER UPDATE OF status ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.auto_evaluate_interview();


--
-- Name: interview_attempts trigger_complete_invitation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_complete_invitation AFTER UPDATE ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.complete_invitation_on_submission();


--
-- Name: interview_attempts trigger_increment_interviews_used; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_increment_interviews_used AFTER INSERT OR UPDATE OF status ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.increment_interviews_used();


--
-- Name: interviews trigger_set_interview_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_interview_slug BEFORE INSERT ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.set_interview_slug();


--
-- Name: organizations trigger_set_organization_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_organization_slug BEFORE INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_organization_slug();


--
-- Name: role_permissions trigger_update_role_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_role_permissions_updated_at();


--
-- Name: interview_attempts trigger_update_subscription_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_subscription_usage AFTER UPDATE ON public.interview_attempts FOR EACH ROW EXECUTE FUNCTION public.update_subscription_interview_usage();


--
-- Name: ai_feature_configurations update_ai_feature_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_feature_configurations_updated_at BEFORE UPDATE ON public.ai_feature_configurations FOR EACH ROW EXECUTE FUNCTION public.update_ai_config_updated_at();


--
-- Name: ai_feature_health update_ai_feature_health_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_feature_health_updated_at BEFORE UPDATE ON public.ai_feature_health FOR EACH ROW EXECUTE FUNCTION public.update_ai_health_updated_at();


--
-- Name: ai_model_configurations update_ai_model_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_model_configurations_updated_at BEFORE UPDATE ON public.ai_model_configurations FOR EACH ROW EXECUTE FUNCTION public.update_ai_model_config_updated_at();


--
-- Name: ai_model_performance update_ai_model_performance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_model_performance_updated_at BEFORE UPDATE ON public.ai_model_performance FOR EACH ROW EXECUTE FUNCTION public.update_ai_health_updated_at();


--
-- Name: ai_provider_credentials update_ai_provider_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_provider_credentials_updated_at BEFORE UPDATE ON public.ai_provider_credentials FOR EACH ROW EXECUTE FUNCTION public.update_ai_config_updated_at();


--
-- Name: ai_providers update_ai_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_providers_updated_at BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION public.update_ai_config_updated_at();


--
-- Name: approval_workflows update_approval_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON public.approval_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: architecture_documents update_architecture_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_architecture_documents_updated_at BEFORE UPDATE ON public.architecture_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ats_integrations update_ats_integrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ats_integrations_updated_at BEFORE UPDATE ON public.ats_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: candidate_performance_index update_candidate_performance_index_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_candidate_performance_index_updated_at BEFORE UPDATE ON public.candidate_performance_index FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: certification_topics update_certification_topics_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_certification_topics_timestamp BEFORE UPDATE ON public.certification_topics FOR EACH ROW EXECUTE FUNCTION public.update_certification_topics_updated_at();


--
-- Name: certification_topics update_certification_topics_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_certification_topics_updated_at_trigger BEFORE UPDATE ON public.certification_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chatbot_knowledge update_chatbot_knowledge_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chatbot_knowledge_updated_at BEFORE UPDATE ON public.chatbot_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_chatbot_knowledge_updated_at();


--
-- Name: circuit_breaker_state update_circuit_breaker_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_circuit_breaker_updated_at BEFORE UPDATE ON public.circuit_breaker_state FOR EACH ROW EXECUTE FUNCTION public.update_ai_health_updated_at();


--
-- Name: collaboration_threads update_collaboration_threads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_collaboration_threads_updated_at BEFORE UPDATE ON public.collaboration_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custom_roles update_custom_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_custom_roles_updated_at BEFORE UPDATE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: data_retention_policies update_data_retention_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_data_retention_policies_updated_at BEFORE UPDATE ON public.data_retention_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: documentation update_documentation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_documentation_updated_at BEFORE UPDATE ON public.documentation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: failed_jobs update_failed_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_failed_jobs_updated_at BEFORE UPDATE ON public.failed_jobs FOR EACH ROW EXECUTE FUNCTION public.update_ai_health_updated_at();


--
-- Name: interview_schedules update_interview_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_interview_schedules_updated_at BEFORE UPDATE ON public.interview_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: interview_templates update_interview_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_interview_templates_updated_at BEFORE UPDATE ON public.interview_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: interviews update_interviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_invoice_updated_at();


--
-- Name: learning_assessments update_learning_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_learning_assessments_updated_at BEFORE UPDATE ON public.learning_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: learning_plans update_learning_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_learning_plans_updated_at BEFORE UPDATE ON public.learning_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_progress update_onboarding_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_gateways update_payment_gateways_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_transactions update_payment_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: platform_configurations update_platform_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_configurations_updated_at BEFORE UPDATE ON public.platform_configurations FOR EACH ROW EXECUTE FUNCTION public.update_platform_config_updated_at();


--
-- Name: platform_documentation update_platform_documentation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_documentation_updated_at BEFORE UPDATE ON public.platform_documentation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: preinterview_check_logs update_preinterview_check_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_preinterview_check_logs_updated_at BEFORE UPDATE ON public.preinterview_check_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: proctoring_sessions update_proctoring_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_proctoring_sessions_updated_at BEFORE UPDATE ON public.proctoring_sessions FOR EACH ROW EXECUTE FUNCTION public.update_proctoring_sessions_updated_at();


--
-- Name: proctoring_settings update_proctoring_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_proctoring_settings_updated_at BEFORE UPDATE ON public.proctoring_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: report_templates update_report_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: test_suites update_test_suites_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_test_suites_updated_at_trigger BEFORE UPDATE ON public.test_suites FOR EACH ROW EXECUTE FUNCTION public.update_test_suites_updated_at();


--
-- Name: training_plans update_training_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_training_plans_updated_at BEFORE UPDATE ON public.training_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_feed activity_feed_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_feed
    ADD CONSTRAINT activity_feed_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);


--
-- Name: activity_feed activity_feed_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_feed
    ADD CONSTRAINT activity_feed_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ai_coach_sessions ai_coach_sessions_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_coach_sessions
    ADD CONSTRAINT ai_coach_sessions_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: ai_coach_sessions ai_coach_sessions_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_coach_sessions
    ADD CONSTRAINT ai_coach_sessions_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: ai_feature_configurations ai_feature_configurations_fallback_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_configurations
    ADD CONSTRAINT ai_feature_configurations_fallback_provider_id_fkey FOREIGN KEY (fallback_provider_id) REFERENCES public.ai_providers(id);


--
-- Name: ai_feature_configurations ai_feature_configurations_primary_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_configurations
    ADD CONSTRAINT ai_feature_configurations_primary_provider_id_fkey FOREIGN KEY (primary_provider_id) REFERENCES public.ai_providers(id);


--
-- Name: ai_health_alerts ai_health_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_health_alerts
    ADD CONSTRAINT ai_health_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: ai_provider_credentials ai_provider_credentials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: ai_provider_credentials ai_provider_credentials_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_credentials
    ADD CONSTRAINT ai_provider_credentials_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id) ON DELETE CASCADE;


--
-- Name: ai_usage_logs ai_usage_logs_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE SET NULL;


--
-- Name: ai_usage_logs ai_usage_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: ai_usage_logs ai_usage_logs_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id);


--
-- Name: ai_usage_logs ai_usage_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: analytics_snapshots analytics_snapshots_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: approval_workflows approval_workflows_current_approver_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_current_approver_fkey FOREIGN KEY (current_approver) REFERENCES auth.users(id);


--
-- Name: assessments assessments_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: assessments assessments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: ats_candidates ats_candidates_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_candidates
    ADD CONSTRAINT ats_candidates_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE SET NULL;


--
-- Name: ats_candidates ats_candidates_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_candidates
    ADD CONSTRAINT ats_candidates_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.ats_integrations(id) ON DELETE CASCADE;


--
-- Name: ats_candidates ats_candidates_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_candidates
    ADD CONSTRAINT ats_candidates_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE SET NULL;


--
-- Name: ats_integrations ats_integrations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_integrations
    ADD CONSTRAINT ats_integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ats_sync_logs ats_sync_logs_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ats_sync_logs
    ADD CONSTRAINT ats_sync_logs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.ats_integrations(id) ON DELETE CASCADE;


--
-- Name: attempt_questions attempt_questions_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: attempt_questions attempt_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bias_detection_results bias_detection_results_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bias_detection_results
    ADD CONSTRAINT bias_detection_results_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON DELETE CASCADE;


--
-- Name: bias_detection_results bias_detection_results_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bias_detection_results
    ADD CONSTRAINT bias_detection_results_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: candidate_performance_index candidate_performance_index_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_performance_index
    ADD CONSTRAINT candidate_performance_index_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: candidate_performance_index candidate_performance_index_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_performance_index
    ADD CONSTRAINT candidate_performance_index_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: certificates certificates_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.learning_assessment_attempts(id);


--
-- Name: certificates certificates_certification_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_certification_topic_id_fkey FOREIGN KEY (certification_topic_id) REFERENCES public.certification_topics(id);


--
-- Name: certificates certificates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: certification_assessments certification_assessments_certification_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_assessments
    ADD CONSTRAINT certification_assessments_certification_topic_id_fkey FOREIGN KEY (certification_topic_id) REFERENCES public.certification_topics(id) ON DELETE CASCADE;


--
-- Name: certification_assessments certification_assessments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_assessments
    ADD CONSTRAINT certification_assessments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: certification_attempts certification_attempts_certification_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_certification_assessment_id_fkey FOREIGN KEY (certification_assessment_id) REFERENCES public.certification_assessments(id) ON DELETE CASCADE;


--
-- Name: certification_attempts certification_attempts_proctoring_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_proctoring_session_id_fkey FOREIGN KEY (proctoring_session_id) REFERENCES public.proctoring_sessions(id);


--
-- Name: certification_attempts certification_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: certification_global_config certification_global_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_global_config
    ADD CONSTRAINT certification_global_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: chatbot_knowledge chatbot_knowledge_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_knowledge
    ADD CONSTRAINT chatbot_knowledge_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: collaboration_threads collaboration_threads_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_threads
    ADD CONSTRAINT collaboration_threads_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);


--
-- Name: collaboration_threads collaboration_threads_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaboration_threads
    ADD CONSTRAINT collaboration_threads_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.collaboration_threads(id);


--
-- Name: comparative_analytics comparative_analytics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comparative_analytics
    ADD CONSTRAINT comparative_analytics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: consent_records consent_records_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: custom_roles custom_roles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: custom_roles custom_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_retention_policies data_retention_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: documentation documentation_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentation
    ADD CONSTRAINT documentation_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: email_logs email_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: email_templates email_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: failed_jobs failed_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: generated_reports generated_reports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id);


--
-- Name: generated_reports generated_reports_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: generated_reports generated_reports_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE CASCADE;


--
-- Name: interview_attempts interview_attempts_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_attempts
    ADD CONSTRAINT interview_attempts_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_attempts interview_attempts_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_attempts
    ADD CONSTRAINT interview_attempts_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.interview_invitations(id) ON DELETE SET NULL;


--
-- Name: interview_invitations interview_invitations_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_invitations
    ADD CONSTRAINT interview_invitations_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_operation_logs interview_operation_logs_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_operation_logs
    ADD CONSTRAINT interview_operation_logs_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: interview_operation_logs interview_operation_logs_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_operation_logs
    ADD CONSTRAINT interview_operation_logs_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_operation_logs interview_operation_logs_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_operation_logs
    ADD CONSTRAINT interview_operation_logs_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.interview_invitations(id) ON DELETE CASCADE;


--
-- Name: interview_operation_logs interview_operation_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_operation_logs
    ADD CONSTRAINT interview_operation_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.proctoring_sessions(id) ON DELETE SET NULL;


--
-- Name: interview_panel_members interview_panel_members_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_panel_members
    ADD CONSTRAINT interview_panel_members_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_schedules interview_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_schedules
    ADD CONSTRAINT interview_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: interview_schedules interview_schedules_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_schedules
    ADD CONSTRAINT interview_schedules_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interview_templates interview_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_templates
    ADD CONSTRAINT interview_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: interview_templates interview_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_templates
    ADD CONSTRAINT interview_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: interviews interviews_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: interviews interviews_proctoring_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_proctoring_settings_id_fkey FOREIGN KEY (proctoring_settings_id) REFERENCES public.proctoring_settings(id);


--
-- Name: interviews interviews_tech_spoc_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_tech_spoc_reviewer_id_fkey FOREIGN KEY (tech_spoc_reviewer_id) REFERENCES auth.users(id);


--
-- Name: invoices invoices_applied_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_applied_promotion_id_fkey FOREIGN KEY (applied_promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE;


--
-- Name: learning_assessment_attempts learning_assessment_attempts_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_attempts
    ADD CONSTRAINT learning_assessment_attempts_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.learning_assessments(id) ON DELETE CASCADE;


--
-- Name: learning_assessment_attempts learning_assessment_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_attempts
    ADD CONSTRAINT learning_assessment_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: learning_assessment_feedback learning_assessment_feedback_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_feedback
    ADD CONSTRAINT learning_assessment_feedback_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE;


--
-- Name: learning_assessment_questions learning_assessment_questions_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_questions
    ADD CONSTRAINT learning_assessment_questions_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.learning_assessments(id) ON DELETE CASCADE;


--
-- Name: learning_assessment_usage learning_assessment_usage_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_usage
    ADD CONSTRAINT learning_assessment_usage_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.learning_assessments(id) ON DELETE CASCADE;


--
-- Name: learning_assessment_usage learning_assessment_usage_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_usage
    ADD CONSTRAINT learning_assessment_usage_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.learning_subscriptions(id) ON DELETE SET NULL;


--
-- Name: learning_assessment_usage learning_assessment_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessment_usage
    ADD CONSTRAINT learning_assessment_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: learning_assessments learning_assessments_certification_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessments
    ADD CONSTRAINT learning_assessments_certification_topic_id_fkey FOREIGN KEY (certification_topic_id) REFERENCES public.certification_topics(id);


--
-- Name: learning_assessments learning_assessments_training_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessments
    ADD CONSTRAINT learning_assessments_training_topic_id_fkey FOREIGN KEY (training_topic_id) REFERENCES public.training_topics(id);


--
-- Name: learning_assessments learning_assessments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_assessments
    ADD CONSTRAINT learning_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: learning_materials learning_materials_training_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_materials
    ADD CONSTRAINT learning_materials_training_topic_id_fkey FOREIGN KEY (training_topic_id) REFERENCES public.training_topics(id) ON DELETE CASCADE;


--
-- Name: learning_payments learning_payments_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_payments
    ADD CONSTRAINT learning_payments_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.learning_assessments(id) ON DELETE SET NULL;


--
-- Name: learning_payments learning_payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_payments
    ADD CONSTRAINT learning_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.learning_subscriptions(id) ON DELETE SET NULL;


--
-- Name: learning_payments learning_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_payments
    ADD CONSTRAINT learning_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: learning_subscriptions learning_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_subscriptions
    ADD CONSTRAINT learning_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.learning_plans(id);


--
-- Name: learning_subscriptions learning_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_subscriptions
    ADD CONSTRAINT learning_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: onboarding_progress onboarding_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: organization_subscriptions organization_subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_subscriptions organization_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: panel_consensus panel_consensus_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.panel_consensus
    ADD CONSTRAINT panel_consensus_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: panel_evaluations panel_evaluations_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.panel_evaluations
    ADD CONSTRAINT panel_evaluations_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: partner_applications partner_applications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_applications
    ADD CONSTRAINT partner_applications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: partner_applications partner_applications_selected_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_applications
    ADD CONSTRAINT partner_applications_selected_plan_id_fkey FOREIGN KEY (selected_plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: password_setup_invitations password_setup_invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_invitations
    ADD CONSTRAINT password_setup_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: password_setup_invitations password_setup_invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_invitations
    ADD CONSTRAINT password_setup_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: password_setup_invitations password_setup_invitations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_invitations
    ADD CONSTRAINT password_setup_invitations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payment_gateways payment_gateways_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT payment_gateways_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: payment_methods payment_methods_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;


--
-- Name: platform_documentation platform_documentation_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_documentation
    ADD CONSTRAINT platform_documentation_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: platform_documentation_versions platform_documentation_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_documentation_versions
    ADD CONSTRAINT platform_documentation_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.platform_documentation(id) ON DELETE CASCADE;


--
-- Name: predictive_analytics predictive_analytics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predictive_analytics
    ADD CONSTRAINT predictive_analytics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: preinterview_check_logs preinterview_check_logs_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preinterview_check_logs
    ADD CONSTRAINT preinterview_check_logs_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: preinterview_check_logs preinterview_check_logs_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preinterview_check_logs
    ADD CONSTRAINT preinterview_check_logs_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.interview_invitations(id) ON DELETE CASCADE;


--
-- Name: proctoring_sessions proctoring_sessions_interview_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_sessions
    ADD CONSTRAINT proctoring_sessions_interview_attempt_id_fkey FOREIGN KEY (interview_attempt_id) REFERENCES public.interview_attempts(id) ON DELETE CASCADE;


--
-- Name: proctoring_sessions proctoring_sessions_learning_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_sessions
    ADD CONSTRAINT proctoring_sessions_learning_attempt_id_fkey FOREIGN KEY (learning_attempt_id) REFERENCES public.learning_assessment_attempts(id) ON DELETE CASCADE;


--
-- Name: proctoring_sessions proctoring_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_sessions
    ADD CONSTRAINT proctoring_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: proctoring_violations proctoring_violations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_violations
    ADD CONSTRAINT proctoring_violations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: promotion_applicable_orgs promotion_applicable_orgs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_orgs
    ADD CONSTRAINT promotion_applicable_orgs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: promotion_applicable_orgs promotion_applicable_orgs_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_orgs
    ADD CONSTRAINT promotion_applicable_orgs_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_applicable_plans promotion_applicable_plans_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_plans
    ADD CONSTRAINT promotion_applicable_plans_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE;


--
-- Name: promotion_applicable_plans promotion_applicable_plans_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_applicable_plans
    ADD CONSTRAINT promotion_applicable_plans_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_usages promotion_usages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: promotion_usages promotion_usages_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_usages promotion_usages_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.organization_subscriptions(id);


--
-- Name: promotions promotions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: questions questions_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: questions questions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: report_templates report_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: report_templates report_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: test_results test_results_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.test_runs(id) ON DELETE CASCADE;


--
-- Name: test_runs test_runs_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id);


--
-- Name: test_runs test_runs_suite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_runs
    ADD CONSTRAINT test_runs_suite_id_fkey FOREIGN KEY (suite_id) REFERENCES public.test_suites(id) ON DELETE CASCADE;


--
-- Name: training_plans training_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: training_topics training_topics_training_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_topics
    ADD CONSTRAINT training_topics_training_plan_id_fkey FOREIGN KEY (training_plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE;


--
-- Name: usage_tracking usage_tracking_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT usage_tracking_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.certificate_badges(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_custom_roles user_custom_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_custom_roles user_custom_roles_custom_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_custom_role_id_fkey FOREIGN KEY (custom_role_id) REFERENCES public.custom_roles(id) ON DELETE CASCADE;


--
-- Name: user_custom_roles user_custom_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_custom_roles user_custom_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_roles
    ADD CONSTRAINT user_custom_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_topic_progress user_topic_progress_training_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_progress
    ADD CONSTRAINT user_topic_progress_training_topic_id_fkey FOREIGN KEY (training_topic_id) REFERENCES public.training_topics(id) ON DELETE CASCADE;


--
-- Name: user_topic_progress user_topic_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_progress
    ADD CONSTRAINT user_topic_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_training_assignments user_training_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_training_assignments
    ADD CONSTRAINT user_training_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_training_assignments user_training_assignments_training_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_training_assignments
    ADD CONSTRAINT user_training_assignments_training_plan_id_fkey FOREIGN KEY (training_plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE;


--
-- Name: user_training_assignments user_training_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_training_assignments
    ADD CONSTRAINT user_training_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_topic_progress Admins and org admins can view progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and org admins can view progress" ON public.user_topic_progress FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['partner_admin'::public.app_role]) AND (user_id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text)))))));


--
-- Name: proctoring_sessions Admins and recruiters can view all proctoring sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and recruiters can view all proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role, 'interviewer'::public.app_role]))))));


--
-- Name: password_setup_invitations Admins can create password setup invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create password setup invitations" ON public.password_setup_invitations FOR INSERT TO authenticated WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]));


--
-- Name: attempt_questions Admins can delete attempt questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete attempt questions" ON public.attempt_questions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = attempt_questions.attempt_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]))))));


--
-- Name: proctoring_sessions Admins can delete proctoring sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete proctoring sessions" ON public.proctoring_sessions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: certificate_badges Admins can manage badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage badges" ON public.certificate_badges USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: certification_topics Admins can manage certification topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage certification topics" ON public.certification_topics TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: documentation Admins can manage documentation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage documentation" ON public.documentation TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: learning_materials Admins can manage materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage materials" ON public.learning_materials TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: organization_members Admins can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage members" ON public.organization_members TO authenticated USING (public.user_is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.user_is_org_admin(auth.uid(), organization_id));


--
-- Name: organizations Admins can manage organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage organizations" ON public.organizations TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: proctoring_settings Admins can manage their settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage their settings" ON public.proctoring_settings USING (((auth.uid() IS NOT NULL) AND ((organization_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))))));


--
-- Name: training_topics Admins can manage training topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage training topics" ON public.training_topics TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: user_badges Admins can view all badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all badges" ON public.user_badges FOR SELECT USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: learning_assessment_usage Admins can view assessment usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view assessment usage" ON public.learning_assessment_usage FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: audit_logs Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]));


--
-- Name: consent_records Admins can view consent records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view consent records" ON public.consent_records FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]));


--
-- Name: security_events Admins can view security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view security events" ON public.security_events FOR SELECT TO authenticated USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]) OR (user_id = auth.uid())));


--
-- Name: chatbot_knowledge All authenticated users can view active knowledge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view active knowledge" ON public.chatbot_knowledge FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: user_roles Allow system trigger to assign guest role on signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow system trigger to assign guest role on signup" ON public.user_roles FOR INSERT WITH CHECK (((auth.uid() IS NULL) AND (role = 'guest'::public.app_role)));


--
-- Name: questions Anonymous: Deny ALL question access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous: Deny ALL question access" ON public.questions TO anon USING (false);


--
-- Name: audit_logs Anonymous: Deny all audit log access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous: Deny all audit log access" ON public.audit_logs TO anon USING (false);


--
-- Name: documentation Anonymous: Deny all documentation access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous: Deny all documentation access" ON public.documentation TO anon USING (false);


--
-- Name: profiles Anonymous: Deny all profile access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous: Deny all profile access" ON public.profiles TO anon USING (false);


--
-- Name: interview_operation_logs Anyone can create operation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create operation logs" ON public.interview_operation_logs FOR INSERT WITH CHECK (true);


--
-- Name: preinterview_check_logs Anyone can create preinterview check logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create preinterview check logs" ON public.preinterview_check_logs FOR INSERT WITH CHECK (true);


--
-- Name: data_deletion_requests Anyone can submit data deletion requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit data deletion requests" ON public.data_deletion_requests FOR INSERT WITH CHECK (true);


--
-- Name: interview_operation_logs Anyone can update operation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update operation logs" ON public.interview_operation_logs FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: preinterview_check_logs Anyone can update their own preinterview check logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update their own preinterview check logs" ON public.preinterview_check_logs FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: certificate_badges Anyone can view badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view badges" ON public.certificate_badges FOR SELECT USING (true);


--
-- Name: promotion_applicable_plans Anyone can view promotion plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view promotion plans" ON public.promotion_applicable_plans FOR SELECT USING (true);


--
-- Name: interviews Authenticated users can create interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create interviews" ON public.interviews FOR INSERT WITH CHECK (((auth.uid() = creator_id) AND (auth.uid() IS NOT NULL)));


--
-- Name: proctoring_sessions Authenticated users can create proctoring sessions for learning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create proctoring sessions for learning" ON public.proctoring_sessions FOR INSERT TO authenticated WITH CHECK ((((learning_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.learning_assessment_attempts laa
  WHERE ((laa.id = proctoring_sessions.learning_attempt_id) AND (laa.user_id = auth.uid()))))) OR ((certification_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.certification_attempts ca
  WHERE ((ca.id = proctoring_sessions.certification_attempt_id) AND (ca.user_id = auth.uid()))))) OR (interview_attempt_id IS NOT NULL)));


--
-- Name: promotions Authenticated users can view active promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view active promotions" ON public.promotions FOR SELECT TO authenticated USING (((is_active = true) AND ((valid_until IS NULL) OR (valid_until > now()))));


--
-- Name: architecture_documents Authenticated users can view architecture docs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view architecture docs" ON public.architecture_documents FOR SELECT TO authenticated USING (true);


--
-- Name: interview_attempts Authenticated users can view their own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view their own attempts" ON public.interview_attempts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.email = interview_attempts.candidate_email)))));


--
-- Name: profiles Authenticated: Update own profile only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated: Update own profile only" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: resume_parsing_results Authorized staff can view resume parsing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authorized staff can view resume parsing" ON public.resume_parsing_results FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role, 'interviewer'::public.app_role]));


--
-- Name: bias_detection_results Authorized users can view bias results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authorized users can view bias results" ON public.bias_detection_results FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = bias_detection_results.attempt_id) AND ((i.creator_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))));


--
-- Name: proctoring_sessions Authorized users can view interview proctoring sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authorized users can view interview proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR ((learning_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.learning_assessment_attempts laa
  WHERE ((laa.id = proctoring_sessions.learning_attempt_id) AND (laa.user_id = auth.uid()))))) OR ((certification_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.certification_attempts ca
  WHERE ((ca.id = proctoring_sessions.certification_attempt_id) AND (ca.user_id = auth.uid()))))) OR ((interview_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = proctoring_sessions.interview_attempt_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id) OR (EXISTS ( SELECT 1
           FROM public.organization_members om
          WHERE ((om.organization_id = i.organization_id) AND (om.user_id = auth.uid()) AND (om.status = 'active'::text)))) OR public.has_any_role(auth.uid(), ARRAY['hr_recruiter'::public.app_role, 'partner_admin'::public.app_role, 'interviewer'::public.app_role]))))))));


--
-- Name: payment_methods Authorized users can view payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authorized users can view payment methods" ON public.payment_methods FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id) OR public.has_any_role(auth.uid(), ARRAY['billing_contact'::public.app_role])));


--
-- Name: interview_attempts Candidates can create attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can create attempts" ON public.interview_attempts FOR INSERT TO authenticated WITH CHECK (((invitation_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.interview_invitations inv
     JOIN public.profiles p ON ((p.email = inv.candidate_email)))
  WHERE ((inv.id = interview_attempts.invitation_id) AND (p.id = auth.uid()) AND (inv.status <> 'expired'::text) AND (inv.expires_at > now()))))));


--
-- Name: interview_attempts Candidates can update own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can update own attempts" ON public.interview_attempts FOR UPDATE TO authenticated USING (((session_token IS NOT NULL) AND (length(session_token) > 0) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.email = interview_attempts.candidate_email)))))) WITH CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text])));


--
-- Name: interview_attempts Candidates can update their own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can update their own attempts" ON public.interview_attempts FOR UPDATE TO authenticated USING ((candidate_email IN ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))) WITH CHECK ((candidate_email IN ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: interview_attempts Candidates can view own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view own attempts" ON public.interview_attempts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.email = interview_attempts.candidate_email)))));


--
-- Name: attempt_questions Candidates can view their own attempt questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view their own attempt questions" ON public.attempt_questions FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.profiles p ON ((p.email = ia.candidate_email)))
  WHERE ((ia.id = attempt_questions.attempt_id) AND (p.id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = attempt_questions.attempt_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id) OR public.user_is_org_member(auth.uid(), i.organization_id)))))));


--
-- Name: interview_attempts Candidates can view their own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view their own attempts" ON public.interview_attempts FOR SELECT TO authenticated USING (((candidate_email IN ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id)))))));


--
-- Name: ai_coach_sessions Candidates can view their own coach sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view their own coach sessions" ON public.ai_coach_sessions FOR SELECT USING ((candidate_email = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: interview_attempts Creators and admins can delete attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and admins can delete attempts" ON public.interview_attempts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: learning_assessments Creators and admins can update assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and admins can update assessments" ON public.learning_assessments FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]))) WITH CHECK (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role])));


--
-- Name: candidate_performance_index Creators and admins can view CPI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and admins can view CPI" ON public.candidate_performance_index FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = candidate_performance_index.interview_id) AND ((i.creator_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))));


--
-- Name: learning_assessments Creators and admins can view assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and admins can view assessments" ON public.learning_assessments FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role])));


--
-- Name: learning_assessment_feedback Creators and admins can view feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and admins can view feedback" ON public.learning_assessment_feedback FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.learning_assessment_attempts laa
     JOIN public.learning_assessments la ON ((la.id = laa.assessment_id)))
  WHERE ((laa.id = learning_assessment_feedback.attempt_id) AND ((laa.user_id = auth.uid()) OR (la.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: learning_assessment_questions Creators and admins can view questions with answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and admins can view questions with answers" ON public.learning_assessment_questions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.learning_assessments la
  WHERE ((la.id = learning_assessment_questions.assessment_id) AND ((la.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: learning_assessment_attempts Creators and platform admins can view assessment attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and platform admins can view assessment attempts" ON public.learning_assessment_attempts FOR SELECT USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.learning_assessments la
  WHERE ((la.id = learning_assessment_attempts.assessment_id) AND (la.user_id = auth.uid()))))));


--
-- Name: learning_assessments Creators can create assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can create assessments" ON public.learning_assessments FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: interview_invitations Creators can create invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can create invitations" ON public.interview_invitations FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_invitations.interview_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id))))));


--
-- Name: interviews Creators can delete interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can delete interviews" ON public.interviews FOR DELETE USING ((auth.uid() = creator_id));


--
-- Name: interview_invitations Creators can delete non-completed invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can delete non-completed invitations" ON public.interview_invitations FOR DELETE USING (((status <> 'completed'::text) AND (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_invitations.interview_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id)))))));


--
-- Name: interviews Creators can update interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can update interviews" ON public.interviews FOR UPDATE USING ((auth.uid() = creator_id));


--
-- Name: interview_invitations Creators can update invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can update invitations" ON public.interview_invitations FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_invitations.interview_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id))))));


--
-- Name: interview_invitations Creators can view invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can view invitations" ON public.interview_invitations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_invitations.interview_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id))))));


--
-- Name: questions Creators only: Delete own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators only: Delete own questions" ON public.questions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.interviews
  WHERE ((interviews.id = questions.interview_id) AND (interviews.creator_id = auth.uid())))));


--
-- Name: questions Creators only: Insert own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators only: Insert own questions" ON public.questions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.interviews
  WHERE ((interviews.id = questions.interview_id) AND (interviews.creator_id = auth.uid())))));


--
-- Name: questions Creators only: Update own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators only: Update own questions" ON public.questions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.interviews
  WHERE ((interviews.id = questions.interview_id) AND (interviews.creator_id = auth.uid())))));


--
-- Name: questions Creators only: View own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators only: View own questions" ON public.questions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.interviews
  WHERE ((interviews.id = questions.interview_id) AND (interviews.creator_id = auth.uid())))));


--
-- Name: interview_attempts Email-matched users can create attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Email-matched users can create attempts" ON public.interview_attempts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.interviews i
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((i.id = interview_attempts.interview_id) AND (i.status = 'active'::text) AND (p.email = interview_attempts.candidate_email)))));


--
-- Name: certification_topics Everyone can view active certification topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active certification topics" ON public.certification_topics FOR SELECT USING ((is_active = true));


--
-- Name: learning_plans Everyone can view active learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active learning plans" ON public.learning_plans FOR SELECT USING ((is_active = true));


--
-- Name: subscription_plans Everyone can view active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active plans" ON public.subscription_plans FOR SELECT USING ((is_active = true));


--
-- Name: training_plans Everyone can view active training plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active training plans" ON public.training_plans FOR SELECT USING ((is_active = true));


--
-- Name: learning_materials Everyone can view materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view materials" ON public.learning_materials FOR SELECT USING (true);


--
-- Name: certification_assessments Everyone can view published assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view published assessments" ON public.certification_assessments FOR SELECT USING ((status = 'published'::text));


--
-- Name: training_topics Everyone can view topics of active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view topics of active plans" ON public.training_topics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.training_plans
  WHERE ((training_plans.id = training_topics.training_plan_id) AND (training_plans.is_active = true)))));


--
-- Name: interview_panel_members Interview creators and admins can manage panel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Interview creators and admins can manage panel" ON public.interview_panel_members USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_panel_members.interview_id) AND ((i.creator_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: panel_evaluations Interview creators can view all panel evaluations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Interview creators can view all panel evaluations" ON public.panel_evaluations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = panel_evaluations.attempt_id) AND ((i.creator_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role]))))));


--
-- Name: usage_tracking Members can view their org usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their org usage" ON public.usage_tracking FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.organization_members
  WHERE ((organization_members.organization_id = usage_tracking.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: organizations Members can view their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their organization" ON public.organizations FOR SELECT TO authenticated USING (public.can_access_org_data(auth.uid(), id));


--
-- Name: proctoring_settings Only admins can view proctoring settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view proctoring settings" ON public.proctoring_settings FOR SELECT USING ((public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_any_role(auth.uid(), ARRAY['partner_admin'::public.app_role, 'hr_recruiter'::public.app_role])));


--
-- Name: ats_candidates Org admins can manage ATS candidates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage ATS candidates" ON public.ats_candidates TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ats_integrations ai
  WHERE ((ai.id = ats_candidates.integration_id) AND public.user_is_org_admin(auth.uid(), ai.organization_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ats_integrations ai
  WHERE ((ai.id = ats_candidates.integration_id) AND public.user_is_org_admin(auth.uid(), ai.organization_id)))));


--
-- Name: ats_integrations Org admins can manage ATS integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage ATS integrations" ON public.ats_integrations USING ((public.user_is_org_admin(auth.uid(), organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: user_custom_roles Org admins can manage custom role assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage custom role assignments" ON public.user_custom_roles TO authenticated USING (public.user_is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.user_is_org_admin(auth.uid(), organization_id));


--
-- Name: custom_roles Org admins can manage custom roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage custom roles" ON public.custom_roles TO authenticated USING ((((organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), organization_id)) OR ((organization_id IS NULL) AND public.has_any_role(auth.uid(), ARRAY['platform_admin'::public.app_role])))) WITH CHECK ((((organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), organization_id)) OR ((organization_id IS NULL) AND public.has_any_role(auth.uid(), ARRAY['platform_admin'::public.app_role]))));


--
-- Name: email_templates Org admins can manage org templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage org templates" ON public.email_templates USING (((organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_methods Org admins can manage payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage payment methods" ON public.payment_methods USING (public.user_is_org_admin(auth.uid(), organization_id));


--
-- Name: candidate_performance_index Org admins can view org CPI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view org CPI" ON public.candidate_performance_index FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = candidate_performance_index.interview_id) AND (public.user_is_org_admin(auth.uid(), i.organization_id) OR (i.creator_id = auth.uid()))))));


--
-- Name: interview_attempts Org admins can view org interview attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view org interview attempts" ON public.interview_attempts FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND public.user_is_org_admin(auth.uid(), i.organization_id)))) OR (candidate_email IN ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND (i.creator_id = auth.uid()))))));


--
-- Name: learning_assessment_attempts Org admins can view org member assessment attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view org member assessment attempts" ON public.learning_assessment_attempts FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (public.has_any_role(auth.uid(), ARRAY['partner_admin'::public.app_role]) AND (user_id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text)))))));


--
-- Name: certificates Org admins can view org member certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view org member certificates" ON public.certificates FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (public.has_any_role(auth.uid(), ARRAY['partner_admin'::public.app_role]) AND (user_id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text)))))));


--
-- Name: proctoring_sessions Org admins can view org proctoring sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view org proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR ((interview_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = proctoring_sessions.interview_attempt_id) AND (public.user_is_org_admin(auth.uid(), i.organization_id) OR (i.creator_id = auth.uid())))))) OR ((learning_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.learning_assessment_attempts laa
  WHERE ((laa.id = proctoring_sessions.learning_attempt_id) AND (laa.user_id = auth.uid())))))));


--
-- Name: ai_usage_logs Org admins can view their org AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view their org AI usage" ON public.ai_usage_logs FOR SELECT USING (((organization_id IS NOT NULL) AND (public.user_is_org_admin(auth.uid(), organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]))));


--
-- Name: ats_candidates Org members can view ATS candidates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view ATS candidates" ON public.ats_candidates FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ats_integrations ai
  WHERE ((ai.id = ats_candidates.integration_id) AND public.can_access_org_data(auth.uid(), ai.organization_id)))));


--
-- Name: ats_integrations Org members can view ATS integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view ATS integrations" ON public.ats_integrations FOR SELECT TO authenticated USING (public.can_access_org_data(auth.uid(), organization_id));


--
-- Name: analytics_snapshots Org members can view analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view analytics" ON public.analytics_snapshots FOR SELECT TO authenticated USING (((organization_id IS NULL) OR public.can_access_org_data(auth.uid(), organization_id)));


--
-- Name: proctoring_sessions Org members can view org proctoring sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view org proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING (((interview_attempt_id IN ( SELECT ia.id
   FROM ((public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
     JOIN public.organization_members om ON ((om.organization_id = i.organization_id)))
  WHERE ((om.user_id = auth.uid()) AND (om.status = 'active'::text)))) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: ats_sync_logs Org members can view sync logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view sync logs" ON public.ats_sync_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ats_integrations ai
  WHERE ((ai.id = ats_sync_logs.integration_id) AND (public.user_is_org_member(auth.uid(), ai.organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]))))));


--
-- Name: ats_integrations Org members can view their ATS integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view their ATS integrations" ON public.ats_integrations FOR SELECT USING ((public.user_is_org_member(auth.uid(), organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: custom_roles Org members can view their org custom roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view their org custom roles" ON public.custom_roles FOR SELECT USING (((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) OR (organization_id IS NULL) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: promotion_applicable_orgs Org members can view their promotion orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view their promotion orgs" ON public.promotion_applicable_orgs FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.can_access_org_data(auth.uid(), organization_id)));


--
-- Name: promotion_usages Org members can view their promotion usages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view their promotion usages" ON public.promotion_usages FOR SELECT TO authenticated USING (public.can_access_org_data(auth.uid(), organization_id));


--
-- Name: approval_workflows Organization can access workflows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organization can access workflows" ON public.approval_workflows USING (((entity_id IN ( SELECT i.id
   FROM (public.interviews i
     JOIN public.organization_members om ON ((om.organization_id = i.organization_id)))
  WHERE (om.user_id = auth.uid()))) OR (entity_id IN ( SELECT q.id
   FROM ((public.questions q
     JOIN public.interviews i ON ((i.id = q.interview_id)))
     JOIN public.organization_members om ON ((om.organization_id = i.organization_id)))
  WHERE (om.user_id = auth.uid())))));


--
-- Name: report_templates Organization can manage report templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organization can manage report templates" ON public.report_templates USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: interview_schedules Organization can manage schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organization can manage schedules" ON public.interview_schedules USING ((interview_id IN ( SELECT i.id
   FROM (public.interviews i
     JOIN public.organization_members om ON ((om.organization_id = i.organization_id)))
  WHERE (om.user_id = auth.uid()))));


--
-- Name: activity_feed Organization can view activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organization can view activity" ON public.activity_feed FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: predictive_analytics Organization can view analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organization can view analytics" ON public.predictive_analytics FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: comparative_analytics Organization can view comparative analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organization can view comparative analytics" ON public.comparative_analytics FOR SELECT TO authenticated USING (((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: generated_reports Organization can view generated reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organization can view generated reports" ON public.generated_reports FOR SELECT TO authenticated USING (((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: interview_panel_members Panel members can view their assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Panel members can view their assignments" ON public.interview_panel_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: custom_roles Partner admins can manage their org custom roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Partner admins can manage their org custom roles" ON public.custom_roles USING ((public.has_role(auth.uid(), 'partner_admin'::public.app_role) AND (organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))))) WITH CHECK ((public.has_role(auth.uid(), 'partner_admin'::public.app_role) AND (organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text))))));


--
-- Name: email_logs Partner admins can view org email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Partner admins can view org email logs" ON public.email_logs FOR SELECT USING (((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['partner_admin'::public.app_role, 'hr_recruiter'::public.app_role])))))));


--
-- Name: profiles Partner admins can view org member profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Partner admins can view org member profiles" ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'partner_admin'::public.app_role) AND (id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text))))));


--
-- Name: user_roles Partner admins can view org member roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Partner admins can view org member roles" ON public.user_roles FOR SELECT USING ((public.has_role(auth.uid(), 'partner_admin'::public.app_role) AND (user_id IN ( SELECT om.user_id
   FROM public.organization_members om
  WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text)))) AND (om.status = 'active'::text))))));


--
-- Name: panel_consensus Platform admins and authorized users can view consensus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins and authorized users can view consensus" ON public.panel_consensus FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = panel_consensus.attempt_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id)))))));


--
-- Name: collaboration_threads Platform admins and org members can collaborate; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins and org members can collaborate" ON public.collaboration_threads USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (entity_id IN ( SELECT i.id
   FROM (public.interviews i
     JOIN public.organization_members om ON ((om.organization_id = i.organization_id)))
  WHERE (om.user_id = auth.uid())))));


--
-- Name: interview_templates Platform admins and org members can manage templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins and org members can manage templates" ON public.interview_templates USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid())))));


--
-- Name: invoices Platform admins and org members can view invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins and org members can view invoices" ON public.invoices FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.can_access_org_data(auth.uid(), organization_id)));


--
-- Name: organization_subscriptions Platform admins and org members can view subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins and org members can view subscriptions" ON public.organization_subscriptions FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.can_access_org_data(auth.uid(), organization_id)));


--
-- Name: payment_transactions Platform admins and org members can view transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins and org members can view transactions" ON public.payment_transactions FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.can_access_org_data(auth.uid(), organization_id)));


--
-- Name: user_roles Platform admins can assign roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can assign roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: platform_documentation Platform admins can create documentation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can create documentation" ON public.platform_documentation FOR INSERT TO authenticated WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: platform_documentation_versions Platform admins can create versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can create versions" ON public.platform_documentation_versions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: learning_assessment_attempts Platform admins can delete assessment attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can delete assessment attempts" ON public.learning_assessment_attempts FOR DELETE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: learning_assessments Platform admins can delete assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can delete assessments" ON public.learning_assessments FOR DELETE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: platform_documentation Platform admins can delete documentation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can delete documentation" ON public.platform_documentation FOR DELETE TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: subscription_plans Platform admins can delete plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can delete plans" ON public.subscription_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: certification_global_config Platform admins can insert config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can insert config" ON public.certification_global_config FOR INSERT WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: platform_configurations Platform admins can insert configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can insert configurations" ON public.platform_configurations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: subscription_plans Platform admins can insert plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can insert plans" ON public.subscription_plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: ai_feature_health Platform admins can manage AI health; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage AI health" ON public.ai_feature_health TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_feature_configurations Platform admins can manage ai_feature_configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage ai_feature_configurations" ON public.ai_feature_configurations TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_provider_credentials Platform admins can manage ai_provider_credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage ai_provider_credentials" ON public.ai_provider_credentials TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_providers Platform admins can manage ai_providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage ai_providers" ON public.ai_providers TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_feature_alerts Platform admins can manage alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage alerts" ON public.ai_feature_alerts TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_health_alerts Platform admins can manage alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage alerts" ON public.ai_health_alerts TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: user_custom_roles Platform admins can manage all custom role assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage all custom role assignments" ON public.user_custom_roles USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: custom_roles Platform admins can manage all custom roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage all custom roles" ON public.custom_roles USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: user_roles Platform admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: proctoring_settings Platform admins can manage all settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage all settings" ON public.proctoring_settings USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: email_templates Platform admins can manage all templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage all templates" ON public.email_templates USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: partner_applications Platform admins can manage applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage applications" ON public.partner_applications USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: architecture_documents Platform admins can manage architecture docs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage architecture docs" ON public.architecture_documents USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: certification_assessments Platform admins can manage assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage assessments" ON public.certification_assessments USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: user_training_assignments Platform admins can manage assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage assignments" ON public.user_training_assignments USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: chatbot_knowledge Platform admins can manage chatbot knowledge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage chatbot knowledge" ON public.chatbot_knowledge TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: circuit_breaker_state Platform admins can manage circuit breaker state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage circuit breaker state" ON public.circuit_breaker_state USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: data_deletion_requests Platform admins can manage deletion requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage deletion requests" ON public.data_deletion_requests USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: failed_jobs Platform admins can manage failed jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage failed jobs" ON public.failed_jobs USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: idempotency_keys Platform admins can manage idempotency keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage idempotency keys" ON public.idempotency_keys USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: interview_invitations Platform admins can manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage invitations" ON public.interview_invitations TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: learning_plans Platform admins can manage learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage learning plans" ON public.learning_plans USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_model_configurations Platform admins can manage model configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage model configs" ON public.ai_model_configurations TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_model_performance Platform admins can manage model performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage model performance" ON public.ai_model_performance TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: payment_gateways Platform admins can manage payment gateways; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage payment gateways" ON public.payment_gateways USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: promotion_applicable_orgs Platform admins can manage promotion orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage promotion orgs" ON public.promotion_applicable_orgs USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: promotion_applicable_plans Platform admins can manage promotion plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage promotion plans" ON public.promotion_applicable_plans USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: promotion_usages Platform admins can manage promotion usages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage promotion usages" ON public.promotion_usages TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: promotions Platform admins can manage promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage promotions" ON public.promotions TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: role_permissions Platform admins can manage role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage role permissions" ON public.role_permissions USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: test_results Platform admins can manage test results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage test results" ON public.test_results USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: test_runs Platform admins can manage test runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage test runs" ON public.test_runs USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: test_suites Platform admins can manage test suites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage test suites" ON public.test_suites TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: training_topics Platform admins can manage topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage topics" ON public.training_topics USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: training_plans Platform admins can manage training plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can manage training plans" ON public.training_plans USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: platform_configurations Platform admins can read configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can read configurations" ON public.platform_configurations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: user_roles Platform admins can remove roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can remove roles" ON public.user_roles FOR DELETE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: certification_global_config Platform admins can update config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can update config" ON public.certification_global_config FOR UPDATE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: platform_configurations Platform admins can update configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can update configurations" ON public.platform_configurations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: platform_documentation Platform admins can update documentation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can update documentation" ON public.platform_documentation FOR UPDATE TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])) WITH CHECK (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: subscription_plans Platform admins can update plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can update plans" ON public.subscription_plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: ai_feature_health Platform admins can view AI health; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view AI health" ON public.ai_feature_health FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_usage_logs Platform admins can view ai_usage_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view ai_usage_logs" ON public.ai_usage_logs FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_feature_alerts Platform admins can view alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view alerts" ON public.ai_feature_alerts FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_health_alerts Platform admins can view alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view alerts" ON public.ai_health_alerts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: attempt_questions Platform admins can view all attempt questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all attempt questions" ON public.attempt_questions FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: certification_attempts Platform admins can view all attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all attempts" ON public.certification_attempts FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: certificates Platform admins can view all certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all certificates" ON public.certificates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: platform_documentation Platform admins can view all documentation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all documentation" ON public.platform_documentation FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: email_logs Platform admins can view all email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all email logs" ON public.email_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: learning_payments Platform admins can view all learning payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all learning payments" ON public.learning_payments FOR SELECT USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: learning_subscriptions Platform admins can view all learning subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all learning subscriptions" ON public.learning_subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: subscription_plans Platform admins can view all plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all plans" ON public.subscription_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: proctoring_sessions Platform admins can view all proctoring sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all proctoring sessions" ON public.proctoring_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: profiles Platform admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: user_roles Platform admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'platform_admin'::public.app_role));


--
-- Name: user_roles Platform admins can view all user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all user roles" ON public.user_roles FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: platform_documentation_versions Platform admins can view all versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all versions" ON public.platform_documentation_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: certification_global_config Platform admins can view config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view config" ON public.certification_global_config FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_health_checks Platform admins can view health checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view health checks" ON public.ai_health_checks FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_health_monitoring Platform admins can view health monitoring; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view health monitoring" ON public.ai_health_monitoring FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_model_configurations Platform admins can view model configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view model configs" ON public.ai_model_configurations FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ai_model_performance Platform admins can view model performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view model performance" ON public.ai_model_performance FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: password_setup_invitations Platform admins can view password setup invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view password setup invitations" ON public.password_setup_invitations FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: test_suites Platform admins can view test suites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view test suites" ON public.test_suites FOR SELECT TO authenticated USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: assessments Platform admins, org admins and creators can view assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins, org admins and creators can view assessments" ON public.assessments FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = assessments.attempt_id) AND (public.user_is_org_admin(auth.uid(), i.organization_id) OR (i.creator_id = auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['hr_recruiter'::public.app_role])))))));


--
-- Name: invoices Platform and org admins can manage invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform and org admins can manage invoices" ON public.invoices USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id))) WITH CHECK ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id)));


--
-- Name: data_retention_policies Platform and org admins can manage retention policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform and org admins can manage retention policies" ON public.data_retention_policies USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (organization_id IS NULL) OR public.user_is_org_admin(auth.uid(), organization_id))) WITH CHECK ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (organization_id IS NULL) OR public.user_is_org_admin(auth.uid(), organization_id)));


--
-- Name: organization_subscriptions Platform and org admins can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform and org admins can manage subscriptions" ON public.organization_subscriptions USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id))) WITH CHECK ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_transactions Platform and org admins can manage transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform and org admins can manage transactions" ON public.payment_transactions USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id))) WITH CHECK ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id)));


--
-- Name: interview_templates Public templates viewable by all authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public templates viewable by all authenticated" ON public.interview_templates FOR SELECT USING (((is_public = true) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid())))));


--
-- Name: panel_evaluations Reviewers can manage their own evaluations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers can manage their own evaluations" ON public.panel_evaluations USING ((reviewer_id = auth.uid()));


--
-- Name: ai_usage_logs Service role can insert ai_usage_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert ai_usage_logs" ON public.ai_usage_logs FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: assessments Service role can insert assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert assessments" ON public.assessments FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs Service role can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert audit logs" ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: bias_detection_results Service role can insert bias results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert bias results" ON public.bias_detection_results FOR INSERT WITH CHECK (true);


--
-- Name: learning_assessment_feedback Service role can insert feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert feedback" ON public.learning_assessment_feedback FOR INSERT WITH CHECK (true);


--
-- Name: promotion_usages Service role can insert promotion usages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert promotion usages" ON public.promotion_usages FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: learning_assessment_questions Service role can insert questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert questions" ON public.learning_assessment_questions FOR INSERT WITH CHECK (true);


--
-- Name: resume_parsing_results Service role can insert resume parsing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert resume parsing" ON public.resume_parsing_results FOR INSERT WITH CHECK (true);


--
-- Name: security_events Service role can insert security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert security events" ON public.security_events FOR INSERT WITH CHECK (true);


--
-- Name: ats_sync_logs Service role can insert sync logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert sync logs" ON public.ats_sync_logs FOR INSERT WITH CHECK (true);


--
-- Name: ats_candidates Service role can manage ATS candidates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage ATS candidates" ON public.ats_candidates USING (true) WITH CHECK (true);


--
-- Name: candidate_performance_index Service role can manage CPI; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage CPI" ON public.candidate_performance_index USING (true) WITH CHECK (true);


--
-- Name: analytics_snapshots Service role can manage analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage analytics" ON public.analytics_snapshots USING (true) WITH CHECK (true);


--
-- Name: learning_assessment_usage Service role can manage assessment usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage assessment usage" ON public.learning_assessment_usage USING (true) WITH CHECK (true);


--
-- Name: certification_attempts Service role can manage attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage attempts" ON public.certification_attempts USING (true) WITH CHECK (true);


--
-- Name: certificates Service role can manage certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage certificates" ON public.certificates USING (true) WITH CHECK (true);


--
-- Name: ai_coach_sessions Service role can manage coach sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage coach sessions" ON public.ai_coach_sessions USING (true) WITH CHECK (true);


--
-- Name: panel_consensus Service role can manage consensus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage consensus" ON public.panel_consensus USING (true) WITH CHECK (true);


--
-- Name: consent_records Service role can manage consent records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage consent records" ON public.consent_records USING (true) WITH CHECK (true);


--
-- Name: interview_invitations Service role can manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage invitations" ON public.interview_invitations TO service_role USING (true) WITH CHECK (true);


--
-- Name: learning_payments Service role can manage learning payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage learning payments" ON public.learning_payments USING (true) WITH CHECK (true);


--
-- Name: learning_subscriptions Service role can manage learning subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage learning subscriptions" ON public.learning_subscriptions USING (true) WITH CHECK (true);


--
-- Name: user_badges Service role can manage user badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage user badges" ON public.user_badges USING (true);


--
-- Name: email_templates Service role can read all templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read all templates" ON public.email_templates FOR SELECT USING (true);


--
-- Name: system_config Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.system_config USING ((auth.role() = 'service_role'::text));


--
-- Name: rate_limit_buckets Service role only for rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only for rate limits" ON public.rate_limit_buckets USING (false) WITH CHECK (false);


--
-- Name: interview_attempts Session-based: Update own attempt - protected PII; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session-based: Update own attempt - protected PII" ON public.interview_attempts FOR UPDATE USING (((session_token IS NOT NULL) AND (length(session_token) > 0) AND (status = 'in_progress'::text))) WITH CHECK (((status = ANY (ARRAY['in_progress'::text, 'submitted'::text])) AND (candidate_email = ( SELECT ia.candidate_email
   FROM public.interview_attempts ia
  WHERE (ia.id = interview_attempts.id))) AND (candidate_name = ( SELECT ia.candidate_name
   FROM public.interview_attempts ia
  WHERE (ia.id = interview_attempts.id)))));


--
-- Name: interview_attempts Staff and platform admins can view attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff and platform admins can view attempts" ON public.interview_attempts FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND (i.creator_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.interviews i
     JOIN public.user_roles ur ON ((ur.user_id = auth.uid())))
  WHERE ((i.id = interview_attempts.interview_id) AND (ur.role = 'hr_recruiter'::public.app_role) AND (ur.organization_id = i.organization_id))))));


--
-- Name: proctoring_sessions Staff can view all proctoring sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view all proctoring sessions" ON public.proctoring_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE (user_roles.user_id = auth.uid()))));


--
-- Name: interview_operation_logs Staff can view operation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view operation logs" ON public.interview_operation_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role, 'tech_spoc'::public.app_role]))))));


--
-- Name: preinterview_check_logs Staff can view preinterview check logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view preinterview check logs" ON public.preinterview_check_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))));


--
-- Name: attempt_questions System can insert attempt questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert attempt questions" ON public.attempt_questions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.interviews i
     JOIN public.questions q ON ((q.interview_id = i.id)))
  WHERE ((q.id = attempt_questions.question_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]))))));


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: usage_tracking System can track usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can track usage" ON public.usage_tracking FOR INSERT WITH CHECK (true);


--
-- Name: partner_applications Users can create applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create applications" ON public.partner_applications FOR INSERT WITH CHECK ((applicant_user_id = auth.uid()));


--
-- Name: learning_assessment_attempts Users can create their own assessment attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own assessment attempts" ON public.learning_assessment_attempts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: certification_attempts Users can create their own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own attempts" ON public.certification_attempts FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: onboarding_progress Users can insert their own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own onboarding progress" ON public.onboarding_progress FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_topic_progress Users can manage their own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own progress" ON public.user_topic_progress USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_roles Users can self-assign candidate or guest role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can self-assign candidate or guest role" ON public.user_roles FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (role = ANY (ARRAY['candidate'::public.app_role, 'guest'::public.app_role]))));


--
-- Name: proctoring_sessions Users can update their learning/certification proctoring sessio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their learning/certification proctoring sessio" ON public.proctoring_sessions FOR UPDATE TO authenticated USING ((((learning_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.learning_assessment_attempts laa
  WHERE ((laa.id = proctoring_sessions.learning_attempt_id) AND (laa.user_id = auth.uid()))))) OR ((certification_attempt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.certification_attempts ca
  WHERE ((ca.id = proctoring_sessions.certification_attempt_id) AND (ca.user_id = auth.uid()))))) OR (interview_attempt_id IS NOT NULL)));


--
-- Name: certification_attempts Users can update their own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own attempts" ON public.certification_attempts FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: learning_assessment_attempts Users can update their own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own attempts" ON public.learning_assessment_attempts FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'evaluated'::text]))));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: onboarding_progress Users can update their own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own onboarding progress" ON public.onboarding_progress FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: partner_applications Users can update their revision_requested applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their revision_requested applications" ON public.partner_applications FOR UPDATE USING (((applicant_user_id = auth.uid()) AND (status = 'revision_requested'::text))) WITH CHECK ((applicant_user_id = auth.uid()));


--
-- Name: organization_members Users can view members in their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view members in their organizations" ON public.organization_members FOR SELECT USING ((public.user_is_org_member(auth.uid(), organization_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: interviews Users can view own and org interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and org interviews" ON public.interviews FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (auth.uid() = creator_id) OR (organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.status = 'active'::text))))));


--
-- Name: test_results Users can view test results from their runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view test results from their runs" ON public.test_results FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.test_runs
  WHERE ((test_runs.id = test_results.run_id) AND ((test_runs.initiated_by = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]))))));


--
-- Name: partner_applications Users can view their own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own applications" ON public.partner_applications FOR SELECT USING (((applicant_user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: learning_assessment_attempts Users can view their own assessment attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own assessment attempts" ON public.learning_assessment_attempts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: learning_assessment_feedback Users can view their own assessment feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own assessment feedback" ON public.learning_assessment_feedback FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.learning_assessment_attempts laa
  WHERE ((laa.id = learning_assessment_feedback.attempt_id) AND (laa.user_id = auth.uid())))));


--
-- Name: learning_assessment_usage Users can view their own assessment usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own assessment usage" ON public.learning_assessment_usage FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_training_assignments Users can view their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own assignments" ON public.user_training_assignments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: certification_attempts Users can view their own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own attempts" ON public.certification_attempts FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_badges Users can view their own badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: certificates Users can view their own certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own certificates" ON public.certificates FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_custom_roles Users can view their own custom roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own custom roles" ON public.user_custom_roles FOR SELECT USING (((user_id = auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role])));


--
-- Name: learning_payments Users can view their own learning payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own learning payments" ON public.learning_payments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: learning_subscriptions Users can view their own learning subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own learning subscriptions" ON public.learning_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: organization_members Users can view their own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own membership" ON public.organization_members FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: onboarding_progress Users can view their own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own onboarding progress" ON public.onboarding_progress FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: test_runs Users can view their own test runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own test runs" ON public.test_runs FOR SELECT USING (((initiated_by = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: activity_feed; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_coach_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_coach_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_coach_sessions ai_coach_sessions_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_coach_sessions_insert_policy ON public.ai_coach_sessions FOR INSERT WITH CHECK (true);


--
-- Name: ai_coach_sessions ai_coach_sessions_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_coach_sessions_select_policy ON public.ai_coach_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))));


--
-- Name: ai_feature_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_feature_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_feature_alerts ai_feature_alerts_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_feature_alerts_admin_policy ON public.ai_feature_alerts USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: ai_feature_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_feature_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_feature_health; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_feature_health ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_health_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_health_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_health_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_health_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_health_monitoring; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_health_monitoring ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_health_monitoring ai_health_monitoring_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_health_monitoring_admin_policy ON public.ai_health_monitoring USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: ai_model_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_model_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_model_configurations ai_model_configurations_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_model_configurations_admin_policy ON public.ai_model_configurations USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: ai_model_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_model_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_provider_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_snapshots analytics_snapshots_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_snapshots_org_policy ON public.analytics_snapshots USING (public.can_access_org_data(auth.uid(), organization_id));


--
-- Name: approval_workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

--
-- Name: architecture_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.architecture_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: assessments assessments_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assessments_insert_policy ON public.assessments FOR INSERT WITH CHECK (true);


--
-- Name: assessments assessments_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assessments_select_policy ON public.assessments FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = assessments.attempt_id) AND ((i.creator_id = auth.uid()) OR ((i.organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), i.organization_id))))))));


--
-- Name: assessments assessments_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assessments_update_policy ON public.assessments FOR UPDATE USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: ats_candidates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ats_candidates ENABLE ROW LEVEL SECURITY;

--
-- Name: ats_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ats_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: ats_sync_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ats_sync_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: attempt_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attempt_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert_policy ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs audit_logs_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select_policy ON public.audit_logs FOR SELECT USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: bias_detection_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bias_detection_results ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_performance_index; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_performance_index ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_performance_index candidate_performance_index_manage_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_performance_index_manage_policy ON public.candidate_performance_index USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: candidate_performance_index candidate_performance_index_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY candidate_performance_index_select_policy ON public.candidate_performance_index FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = candidate_performance_index.interview_id) AND ((i.creator_id = auth.uid()) OR ((i.organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), i.organization_id))))))));


--
-- Name: certificate_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificate_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: certificate_badges certificate_badges_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificate_badges_admin_write ON public.certificate_badges USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: certificate_badges certificate_badges_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificate_badges_public_read ON public.certificate_badges FOR SELECT USING (true);


--
-- Name: certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: certificates certificates_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificates_admin_all ON public.certificates USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: certificates certificates_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificates_owner_select ON public.certificates FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: certificates certificates_public_verify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificates_public_verify ON public.certificates FOR SELECT USING (true);


--
-- Name: certification_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certification_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_global_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certification_global_config ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certification_topics ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_topics certification_topics_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certification_topics_admin_all ON public.certification_topics USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: certification_topics certification_topics_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certification_topics_public_read ON public.certification_topics FOR SELECT USING ((is_active = true));


--
-- Name: chatbot_knowledge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;

--
-- Name: circuit_breaker_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.circuit_breaker_state ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboration_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collaboration_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: comparative_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comparative_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_records consent_records_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consent_records_admin_policy ON public.consent_records USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role]))))));


--
-- Name: custom_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_roles custom_roles_org_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_roles_org_admin_policy ON public.custom_roles USING ((public.user_is_org_admin(auth.uid(), organization_id) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role))))));


--
-- Name: data_deletion_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: data_deletion_requests data_deletion_requests_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_deletion_requests_admin_policy ON public.data_deletion_requests USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: data_retention_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: data_retention_policies data_retention_policies_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_retention_policies_org_policy ON public.data_retention_policies USING ((public.user_is_org_admin(auth.uid(), organization_id) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role))))));


--
-- Name: documentation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: failed_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: generated_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_attempts interview_attempts_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interview_attempts_insert_policy ON public.interview_attempts FOR INSERT WITH CHECK (true);


--
-- Name: interview_attempts interview_attempts_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interview_attempts_select_policy ON public.interview_attempts FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND ((i.creator_id = auth.uid()) OR ((i.organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), i.organization_id)))))) OR public.has_any_role(auth.uid(), ARRAY['partner_admin'::public.app_role, 'hr_recruiter'::public.app_role])));


--
-- Name: interview_attempts interview_attempts_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interview_attempts_update_policy ON public.interview_attempts FOR UPDATE USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_attempts.interview_id) AND ((i.creator_id = auth.uid()) OR (i.status = 'active'::text)))))));


--
-- Name: interview_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_invitations interview_invitations_manage_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interview_invitations_manage_policy ON public.interview_invitations USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_invitations.interview_id) AND ((i.creator_id = auth.uid()) OR ((i.organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), i.organization_id))))))));


--
-- Name: interview_invitations interview_invitations_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interview_invitations_select_policy ON public.interview_invitations FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_invitations.interview_id) AND ((i.creator_id = auth.uid()) OR ((i.organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), i.organization_id))))))));


--
-- Name: interview_operation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_operation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_panel_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_panel_members ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_panel_members interview_panel_members_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interview_panel_members_policy ON public.interview_panel_members USING (((user_id = auth.uid()) OR (added_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = interview_panel_members.interview_id) AND (i.creator_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role])))))));


--
-- Name: interview_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: interviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

--
-- Name: interviews interviews_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interviews_delete_policy ON public.interviews FOR DELETE USING (((creator_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: interviews interviews_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interviews_insert_policy ON public.interviews FOR INSERT WITH CHECK (((auth.uid() = creator_id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: interviews interviews_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interviews_select_policy ON public.interviews FOR SELECT USING (((creator_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR ((organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), organization_id)) OR public.has_any_role(auth.uid(), ARRAY['partner_admin'::public.app_role, 'hr_recruiter'::public.app_role, 'ta_creator'::public.app_role])));


--
-- Name: interviews interviews_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interviews_update_policy ON public.interviews FOR UPDATE USING (((creator_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR ((organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), organization_id))));


--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_assessment_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_assessment_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_assessment_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_assessment_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_assessment_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_assessment_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_assessment_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_assessment_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_assessment_usage learning_assessment_usage_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_assessment_usage_admin ON public.learning_assessment_usage USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: learning_assessment_usage learning_assessment_usage_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_assessment_usage_owner ON public.learning_assessment_usage USING ((user_id = auth.uid()));


--
-- Name: learning_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_user_policy ON public.notifications USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: onboarding_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members organization_members_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_members_admin_manage ON public.organization_members USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id)));


--
-- Name: organization_members organization_members_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_members_select_policy ON public.organization_members FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (user_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), organization_id) OR public.user_is_org_member(auth.uid(), organization_id)));


--
-- Name: organization_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_admin_manage ON public.organizations USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), id)));


--
-- Name: organizations organizations_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_select_policy ON public.organizations FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_member(auth.uid(), id) OR public.user_is_org_admin(auth.uid(), id)));


--
-- Name: panel_consensus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.panel_consensus ENABLE ROW LEVEL SECURITY;

--
-- Name: panel_consensus panel_consensus_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY panel_consensus_policy ON public.panel_consensus USING (((EXISTS ( SELECT 1
   FROM (public.interview_panel_members ipm
     JOIN public.interview_attempts ia ON ((ia.interview_id = ipm.interview_id)))
  WHERE ((ia.id = panel_consensus.attempt_id) AND (ipm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role])))))));


--
-- Name: panel_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.panel_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: panel_evaluations panel_evaluations_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY panel_evaluations_policy ON public.panel_evaluations USING (((reviewer_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['platform_admin'::public.app_role, 'partner_admin'::public.app_role, 'hr_recruiter'::public.app_role])))))));


--
-- Name: partner_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: password_setup_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_setup_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_gateways; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods payment_methods_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_methods_org_policy ON public.payment_methods USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id) OR (public.has_any_role(auth.uid(), ARRAY['billing_contact'::public.app_role]) AND public.user_is_org_member(auth.uid(), organization_id))));


--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions payment_transactions_org_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_transactions_org_policy ON public.payment_transactions USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR public.user_is_org_admin(auth.uid(), organization_id) OR (public.has_any_role(auth.uid(), ARRAY['billing_contact'::public.app_role]) AND public.user_is_org_member(auth.uid(), organization_id))));


--
-- Name: platform_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_documentation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_documentation ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_documentation_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_documentation_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: predictive_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.predictive_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: preinterview_check_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preinterview_check_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: proctoring_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: proctoring_sessions proctoring_sessions_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proctoring_sessions_insert_policy ON public.proctoring_sessions FOR INSERT WITH CHECK (true);


--
-- Name: proctoring_sessions proctoring_sessions_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proctoring_sessions_select_policy ON public.proctoring_sessions FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM (public.interview_attempts ia
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ia.id = proctoring_sessions.interview_attempt_id) AND ((i.creator_id = auth.uid()) OR ((i.organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), i.organization_id))))))));


--
-- Name: proctoring_sessions proctoring_sessions_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proctoring_sessions_update_policy ON public.proctoring_sessions FOR UPDATE USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.interview_attempts ia
  WHERE (ia.id = proctoring_sessions.interview_attempt_id)))));


--
-- Name: proctoring_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proctoring_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: proctoring_violations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proctoring_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: proctoring_violations proctoring_violations_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proctoring_violations_insert_policy ON public.proctoring_violations FOR INSERT WITH CHECK (true);


--
-- Name: proctoring_violations proctoring_violations_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proctoring_violations_select_policy ON public.proctoring_violations FOR SELECT USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM ((public.proctoring_sessions ps
     JOIN public.interview_attempts ia ON ((ia.id = ps.interview_attempt_id)))
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ps.id = proctoring_violations.session_id) AND ((i.creator_id = auth.uid()) OR ((i.organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), i.organization_id))))))));


--
-- Name: proctoring_violations proctoring_violations_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proctoring_violations_update_policy ON public.proctoring_violations FOR UPDATE USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM ((public.proctoring_sessions ps
     JOIN public.interview_attempts ia ON ((ia.id = ps.interview_attempt_id)))
     JOIN public.interviews i ON ((i.id = ia.interview_id)))
  WHERE ((ps.id = proctoring_violations.session_id) AND ((i.creator_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), i.organization_id)))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_policy ON public.profiles FOR SELECT USING (((auth.uid() = id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.user_id = profiles.id) AND public.user_is_org_admin(auth.uid(), om.organization_id))))));


--
-- Name: profiles profiles_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_policy ON public.profiles FOR UPDATE USING (((auth.uid() = id) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role])));


--
-- Name: promotion_applicable_orgs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_applicable_orgs ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_applicable_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_applicable_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_usages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_usages ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: questions questions_active_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_active_select ON public.questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = questions.interview_id) AND (i.status = 'active'::text)))));


--
-- Name: questions questions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_admin_all ON public.questions USING (public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]));


--
-- Name: questions questions_creator_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_creator_select ON public.questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = questions.interview_id) AND (i.creator_id = auth.uid())))));


--
-- Name: questions questions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_org_select ON public.questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.interviews i
  WHERE ((i.id = questions.interview_id) AND (i.organization_id IS NOT NULL) AND public.can_access_org_data(auth.uid(), i.organization_id)))));


--
-- Name: rate_limit_buckets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: report_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: resume_parsing_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resume_parsing_results ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events security_events_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_events_admin_policy ON public.security_events USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: system_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

--
-- Name: test_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

--
-- Name: test_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: test_suites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;

--
-- Name: training_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: training_topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_topics ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges user_badges_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_admin_write ON public.user_badges USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role)))));


--
-- Name: user_badges user_badges_owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_owner_read ON public.user_badges FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_badges user_badges_public_verify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_public_verify ON public.user_badges FOR SELECT USING (true);


--
-- Name: user_custom_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_custom_roles user_custom_roles_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_custom_roles_policy ON public.user_custom_roles USING (((user_id = auth.uid()) OR public.user_is_org_admin(auth.uid(), organization_id) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::public.app_role))))));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_admin_manage ON public.user_roles USING ((public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR ((organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), organization_id))));


--
-- Name: user_roles user_roles_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_policy ON public.user_roles FOR SELECT USING (((user_id = auth.uid()) OR public.has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::public.app_role]) OR ((organization_id IS NOT NULL) AND public.user_is_org_admin(auth.uid(), organization_id))));


--
-- Name: user_topic_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_topic_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: user_training_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_training_assignments ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;