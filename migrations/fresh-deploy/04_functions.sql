-- ============================================================================
-- FRESH DEPLOYMENT: 04 - DATABASE FUNCTIONS
-- Run AFTER tables (03_tables.sql)
-- Total Functions: 109 (exact replica from Production Cloud)
-- Generated: 2024-12-27
-- ============================================================================

-- ============================================================================
-- SECTION 1: UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_slug(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  cert_number TEXT;
  year_suffix TEXT;
BEGIN
  year_suffix := TO_CHAR(NOW(), 'YY');
  cert_number := 'CERT-' || year_suffix || '-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  RETURN cert_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_verification_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_session_token()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_share_token()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN replace(gen_random_uuid()::text, '-', '');
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_rls_enabled(table_name text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT relrowsecurity
  FROM pg_class
  WHERE relname = table_name
  AND relnamespace = 'public'::regnamespace;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_cpi_score(p_technical_score numeric, p_problem_solving_score numeric, p_integrity_score numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ============================================================================
-- SECTION 2: ROLE AND PERMISSION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_any_role_with_hierarchy(_user_id uuid, _roles app_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND (
      role = ANY(_roles)
      OR role = 'platform_admin'  -- Platform admin has access to everything
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _role app_role, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (organization_id IS NULL OR organization_id = _org_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_custom_role(_user_id uuid, _role_name text, _org_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.has_action_permission(_user_id uuid, _action_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
 RETURNS SETOF app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_custom_role_permissions(_user_id uuid, _org_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result JSONB := '{}'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(cr.permissions), '[]'::jsonb) INTO result
  FROM public.user_custom_roles ucr JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id
  WHERE ucr.user_id = _user_id AND cr.is_active = true AND (_org_id IS NULL OR ucr.organization_id = _org_id);
  RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.is_role_org_scoped(check_role app_role)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT check_role IN ('partner_admin', 'hr_recruiter', 'billing_contact');
$function$;

CREATE OR REPLACE FUNCTION public.is_global_tech_spoc(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'tech_spoc'
      AND organization_id IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_tech_spocs_for_org(_org_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, email text, is_global boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ============================================================================
-- SECTION 3: ORGANIZATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.user_is_org_member(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_access_org_data(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.user_is_org_admin(_user_id, _org_id) OR public.user_is_org_member(_user_id, _org_id);
$function$;

CREATE OR REPLACE FUNCTION public.check_multi_org_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_organization_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- SECTION 4: USER MANAGEMENT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.assign_guest_role_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_onboarding_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.onboarding_progress (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_user_exists(user_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count
  FROM auth.users
  WHERE email = user_email;
  
  RETURN user_count > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.setup_user_tx(p_user_id uuid, p_email text, p_full_name text, p_role app_role, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (p_user_id, p_email, p_full_name)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'guest';

  INSERT INTO user_roles (user_id, role, organization_id)
  VALUES (p_user_id, p_role, p_organization_id)
  ON CONFLICT (user_id, role) DO NOTHING;

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
$function$;

-- delete_user_cascade_tx (version 1 - with p_elevate_admins)
CREATE OR REPLACE FUNCTION public.delete_user_cascade_tx(p_user_id uuid, p_elevate_admins boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_org RECORD;
  v_new_admin_id uuid;
  v_elevated_orgs text[] := '{}';
BEGIN
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_elevate_admins THEN
    FOR v_org IN 
      SELECT DISTINCT om.organization_id, o.name as org_name
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      JOIN user_roles ur ON ur.user_id = om.user_id AND ur.role = 'partner_admin'
      WHERE om.user_id = p_user_id AND om.status = 'active'
    LOOP
      IF (SELECT COUNT(*) FROM user_roles WHERE organization_id = v_org.organization_id AND role = 'partner_admin') = 1 THEN
        SELECT om.user_id INTO v_new_admin_id
        FROM organization_members om
        WHERE om.organization_id = v_org.organization_id
          AND om.user_id != p_user_id
          AND om.status = 'active'
        ORDER BY om.joined_at ASC
        LIMIT 1;

        IF v_new_admin_id IS NOT NULL THEN
          INSERT INTO user_roles (user_id, role, organization_id)
          VALUES (v_new_admin_id, 'partner_admin', v_org.organization_id)
          ON CONFLICT (user_id, role) DO NOTHING;
          
          v_elevated_orgs := array_append(v_elevated_orgs, v_org.org_name);
        END IF;
      END IF;
    END LOOP;
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM organization_members WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM onboarding_progress WHERE user_id = p_user_id;
  DELETE FROM learning_subscriptions WHERE user_id = p_user_id;
  DELETE FROM learning_assessment_usage WHERE user_id = p_user_id;
  DELETE FROM user_custom_roles WHERE user_id = p_user_id;
  DELETE FROM user_badges WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_email', v_user.email,
    'elevated_orgs', v_elevated_orgs
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'User deletion failed: %', SQLERRM;
END;
$function$;

-- delete_user_cascade_tx (version 2 - with p_admin_user_id)
CREATE OR REPLACE FUNCTION public.delete_user_cascade_tx(p_user_id uuid, p_admin_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_memberships RECORD;
  v_user_roles RECORD;
  v_is_partner_admin BOOLEAN := false;
  v_elevations jsonb := '[]'::jsonb;
  v_earliest_member RECORD;
  v_data_dependencies text[] := '{}';
  v_cleanup_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'partner_admin'
  ) INTO v_is_partner_admin;

  FOR v_memberships IN 
    SELECT om.organization_id, o.name as org_name
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id AND om.status = 'active'
  LOOP
    IF v_is_partner_admin THEN
      IF NOT EXISTS (
        SELECT 1 FROM organization_members om
        JOIN user_roles ur ON ur.user_id = om.user_id
        WHERE om.organization_id = v_memberships.organization_id
          AND om.status = 'active'
          AND om.user_id != p_user_id
          AND ur.role = 'partner_admin'
      ) THEN
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

    UPDATE organization_members
    SET status = 'inactive'
    WHERE user_id = p_user_id AND organization_id = v_memberships.organization_id;
  END LOOP;

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
  DELETE FROM organization_members WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;

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
$function$;

-- ============================================================================
-- SECTION 5: INTERVIEW FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_interview_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    NEW.slug := public.generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_interview(user_id uuid, interview_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.can_view_interview_attempts(attempt_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_interview_for_candidate(share_link_param text)
 RETURNS TABLE(id uuid, title text, question_count integer, time_limit integer, status text, share_link text, job_description_preview text, proctoring_enabled boolean, proctoring_settings jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_interview_attempt(p_interview_id uuid, p_candidate_name text, p_candidate_email text)
 RETURNS TABLE(attempt_id uuid, session_token text, success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

DROP FUNCTION IF EXISTS public.create_interview_attempt_with_invitation(uuid, text, text);
CREATE OR REPLACE FUNCTION public.create_interview_attempt_with_invitation(p_invitation_id uuid, p_candidate_name text, p_candidate_email text)
 RETURNS TABLE(attempt_id uuid, session_token text, success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
  v_invitation RECORD;
  v_question_ids uuid[];
BEGIN
  IF p_candidate_name IS NULL OR LENGTH(TRIM(p_candidate_name)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Name is required';
    RETURN;
  END IF;

  IF p_candidate_email IS NULL OR LENGTH(TRIM(p_candidate_email)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email is required';
    RETURN;
  END IF;

  SELECT * INTO v_invitation
  FROM public.interview_invitations
  WHERE id = p_invitation_id;

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Invalid invitation';
    RETURN;
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Invitation has expired';
    RETURN;
  END IF;

  IF LOWER(TRIM(p_candidate_email)) != LOWER(TRIM(v_invitation.candidate_email)) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email does not match invitation. Please use the email address that received this invitation.';
    RETURN;
  END IF;

  IF v_invitation.status = 'completed' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'This invitation has already been used. Each candidate can only attempt once.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.interviews 
    WHERE id = v_invitation.interview_id 
    AND status = 'active'
  ) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Interview is not active';
    RETURN;
  END IF;

  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

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

  UPDATE public.interview_invitations
  SET 
    status = 'accessed',
    accessed_at = NOW()
  WHERE id = p_invitation_id;

  v_question_ids := ARRAY(
    SELECT jsonb_array_elements_text(v_invitation.metadata->'selected_question_ids')::uuid
  );

  INSERT INTO public.attempt_questions (attempt_id, question_id, display_order)
  SELECT 
    v_attempt_id,
    unnest(v_question_ids),
    generate_series(0, array_length(v_question_ids, 1) - 1);

  RETURN QUERY SELECT v_attempt_id, v_session_token, TRUE, NULL::TEXT;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_questions_for_attempt(uuid);
CREATE OR REPLACE FUNCTION public.get_questions_for_attempt(p_attempt_id uuid)
 RETURNS TABLE(
   id uuid,
   interview_id uuid,
   question_text text,
   topic text,
   difficulty text,
   question_type text,
   options jsonb,
   order_index integer,
   created_at timestamp with time zone,
   coding_schema jsonb,
   allowed_languages text[]
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_interview_id uuid;
  v_interview_status text;
  v_question_count integer;
  v_attempt_status text;
BEGIN
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

  IF v_attempt_status NOT IN ('in_progress', 'completed', 'submitted', 'evaluated', 'pending_upload') THEN
    RAISE EXCEPTION 'Invalid attempt status';
  END IF;

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

  IF EXISTS (
    SELECT 1 FROM public.attempt_questions 
    WHERE attempt_id = p_attempt_id
  ) THEN
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
      q.created_at,
      q.coding_schema,
      q.allowed_languages
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
        AND q.deleted_at IS NULL
      ORDER BY RANDOM()
      LIMIT v_question_count
    ),
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
      q.created_at,
      q.coding_schema,
      q.allowed_languages
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_questions_for_attempt(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_random_questions_for_attempt(interview_uuid uuid, attempt_uuid uuid, num_questions integer)
 RETURNS TABLE(id uuid, interview_id uuid, question_text text, topic text, difficulty text, options jsonb, order_index integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.interviews 
    WHERE interviews.id = interview_uuid 
    AND interviews.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Interview not found or not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.interview_attempts
    WHERE interview_attempts.id = attempt_uuid
    AND interview_attempts.interview_id = interview_uuid
  ) THEN
    RAISE EXCEPTION 'Interview attempt not found';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.get_attempt_by_session(token text)
 RETURNS SETOF interview_attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.interview_attempts
  WHERE session_token = token
  AND session_token IS NOT NULL
  AND LENGTH(session_token) > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_attempt_with_session(token text, attempt_answers jsonb, seconds_taken integer)
 RETURNS TABLE(success boolean, attempt_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.finalize_proctored_submission(p_session_token text)
 RETURNS TABLE(success boolean, attempt_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt_id UUID;
  v_status TEXT;
BEGIN
  IF p_session_token IS NULL OR LENGTH(p_session_token) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  SELECT id, status INTO v_attempt_id, v_status
  FROM public.interview_attempts
  WHERE session_token = p_session_token
  AND session_token IS NOT NULL
  AND LENGTH(session_token) > 0;

  IF v_attempt_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF v_status != 'pending_upload' THEN
    IF v_status IN ('submitted', 'evaluated') THEN
      RETURN QUERY SELECT TRUE, v_attempt_id;
      RETURN;
    END IF;
    RETURN QUERY SELECT FALSE, v_attempt_id;
    RETURN;
  END IF;

  UPDATE public.interview_attempts
  SET status = 'submitted'
  WHERE id = v_attempt_id;

  RETURN QUERY SELECT TRUE, v_attempt_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.terminate_attempt_with_session(token text, attempt_answers text, seconds_taken integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt_id UUID;
BEGIN
  SELECT id INTO v_attempt_id
  FROM interview_attempts
  WHERE session_token = token
    AND status = 'in_progress';
  
  IF v_attempt_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  UPDATE interview_attempts
  SET 
    answers = attempt_answers::jsonb,
    time_taken = seconds_taken,
    status = 'terminated',
    submitted_at = NOW()
  WHERE id = v_attempt_id;
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_question_selection_counts(question_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.questions
  SET selection_count = COALESCE(selection_count, 0) + 1
  WHERE id = ANY(question_ids);
END;
$function$;

-- ============================================================================
-- SECTION 6: PROCTORING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_close_expired_proctoring_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE closed_count INTEGER;
BEGIN
  UPDATE public.proctoring_sessions SET ended_at = NOW(), updated_at = NOW()
  WHERE ended_at IS NULL AND created_at < NOW() - INTERVAL '4 hours';
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END; $function$;

CREATE OR REPLACE FUNCTION public.auto_close_proctoring_on_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.toggle_violation_ignored(p_session_id uuid, p_violation_id text, p_ignore boolean)
 RETURNS TABLE(success boolean, new_integrity_score integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_ignored JSONB;
  v_detailed_violations JSONB;
  v_new_integrity_score INTEGER;
  v_violation JSONB;
  v_deduction INTEGER;
  v_violation_type TEXT;
BEGIN
  SELECT ignored_violations, detailed_violations 
  INTO v_current_ignored, v_detailed_violations
  FROM proctoring_sessions
  WHERE id = p_session_id;
  
  IF v_current_ignored IS NULL THEN
    v_current_ignored := '[]'::jsonb;
  END IF;
  
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
  
  UPDATE proctoring_sessions
  SET 
    ignored_violations = v_current_ignored,
    integrity_score = v_new_integrity_score,
    updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN QUERY SELECT TRUE, v_new_integrity_score;
END;
$function$;

-- ============================================================================
-- SECTION 7: TIMESTAMP TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_proctoring_sessions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ai_health_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ai_model_config_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ai_config_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_platform_config_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_certification_topics_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_test_suites_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_chatbot_knowledge_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_invoice_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- SECTION 8: TRANSACTION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_partner_application_tx(p_application_id uuid, p_reviewer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_application RECORD;
  v_org_id uuid;
  v_slug text;
  v_counter integer := 1;
  v_base_slug text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_application
  FROM partner_applications
  WHERE id = p_application_id;

  IF v_application IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_application.status != 'pending' THEN
    RAISE EXCEPTION 'Application already processed';
  END IF;

  IF v_application.organization_id IS NOT NULL THEN
    v_org_id := v_application.organization_id;
  ELSE
    v_base_slug := lower(regexp_replace(v_application.organization_name, '[^a-z0-9]+', '-', 'gi'));
    v_slug := v_base_slug;
    
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
      v_slug := v_base_slug || '-' || v_counter;
      v_counter := v_counter + 1;
    END LOOP;

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

    UPDATE partner_applications SET organization_id = v_org_id WHERE id = p_application_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organization_subscriptions WHERE organization_id = v_org_id) THEN
    INSERT INTO organization_subscriptions (organization_id, plan_id, status)
    VALUES (v_org_id, v_application.selected_plan_id, 'active');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_application.applicant_user_id) THEN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
      v_application.applicant_user_id,
      v_application.contact_email,
      COALESCE(v_application.contact_name, split_part(v_application.contact_email, '@', 1))
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = v_application.applicant_user_id AND organization_id = v_org_id
  ) THEN
    INSERT INTO organization_members (organization_id, user_id, status)
    VALUES (v_org_id, v_application.applicant_user_id, 'active');
  END IF;

  DELETE FROM user_roles 
  WHERE user_id = v_application.applicant_user_id AND role = 'guest';

  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = v_application.applicant_user_id AND role = 'partner_admin'
  ) THEN
    INSERT INTO user_roles (user_id, role, organization_id)
    VALUES (v_application.applicant_user_id, 'partner_admin', v_org_id);
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.delete_organization_tx(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org RECORD;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_interview_ids uuid[];
  v_attempt_ids uuid[];
  v_session_ids uuid[];
  v_count integer;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_organization_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  SELECT array_agg(id) INTO v_interview_ids FROM interviews WHERE organization_id = p_organization_id;
  
  IF v_interview_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_attempt_ids FROM interview_attempts WHERE interview_id = ANY(v_interview_ids);
    
    IF v_attempt_ids IS NOT NULL THEN
      SELECT array_agg(id) INTO v_session_ids FROM proctoring_sessions WHERE interview_attempt_id = ANY(v_attempt_ids);
      
      IF v_session_ids IS NOT NULL THEN
        DELETE FROM proctoring_violations WHERE session_id = ANY(v_session_ids);
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('proctoring_violations', v_count);
      END IF;
      
      DELETE FROM proctoring_sessions WHERE interview_attempt_id = ANY(v_attempt_ids);
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_deleted_counts := v_deleted_counts || jsonb_build_object('proctoring_sessions', v_count);
      
      DELETE FROM bias_detection_results WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM candidate_performance_index WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM assessments WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM panel_evaluations WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM panel_consensus WHERE attempt_id = ANY(v_attempt_ids);
      DELETE FROM attempt_questions WHERE attempt_id = ANY(v_attempt_ids);
    END IF;
    
    DELETE FROM interview_attempts WHERE interview_id = ANY(v_interview_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('interview_attempts', v_count);
    
    DELETE FROM interview_invitations WHERE interview_id = ANY(v_interview_ids);
    DELETE FROM questions WHERE interview_id = ANY(v_interview_ids);
    
    DELETE FROM interviews WHERE id = ANY(v_interview_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('interviews', v_count);
  END IF;

  DELETE FROM ats_sync_logs WHERE integration_id IN (SELECT id FROM ats_integrations WHERE organization_id = p_organization_id);
  DELETE FROM ats_candidates WHERE integration_id IN (SELECT id FROM ats_integrations WHERE organization_id = p_organization_id);
  DELETE FROM ats_integrations WHERE organization_id = p_organization_id;

  DELETE FROM invoices WHERE organization_id = p_organization_id;
  DELETE FROM payment_transactions WHERE organization_id = p_organization_id;
  DELETE FROM promotion_usages WHERE organization_id = p_organization_id;
  DELETE FROM organization_subscriptions WHERE organization_id = p_organization_id;

  DELETE FROM user_roles WHERE organization_id = p_organization_id;
  DELETE FROM organization_members WHERE organization_id = p_organization_id;

  DELETE FROM analytics_snapshots WHERE organization_id = p_organization_id;
  DELETE FROM comparative_analytics WHERE organization_id = p_organization_id;
  DELETE FROM usage_tracking WHERE organization_id = p_organization_id;
  DELETE FROM data_retention_policies WHERE organization_id = p_organization_id;
  DELETE FROM activity_feed WHERE organization_id = p_organization_id;
  DELETE FROM notifications WHERE organization_id = p_organization_id;

  DELETE FROM organizations WHERE id = p_organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_name', v_org.name,
    'deleted_counts', v_deleted_counts
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Organization deletion failed: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_interview_tx(p_interview_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_interview RECORD;
  v_attempt_ids uuid[];
  v_session_ids uuid[];
  v_deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id;
  IF v_interview IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  SELECT array_agg(id) INTO v_attempt_ids FROM interview_attempts WHERE interview_id = p_interview_id;

  IF v_attempt_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_session_ids FROM proctoring_sessions WHERE interview_attempt_id = ANY(v_attempt_ids);

    IF v_session_ids IS NOT NULL THEN
      DELETE FROM proctoring_violations WHERE session_id = ANY(v_session_ids);
      DELETE FROM proctoring_sessions WHERE id = ANY(v_session_ids);
    END IF;

    DELETE FROM assessments WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM candidate_performance_index WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM bias_detection_results WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM panel_evaluations WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM panel_consensus WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM attempt_questions WHERE attempt_id = ANY(v_attempt_ids);
    DELETE FROM ai_coach_sessions WHERE attempt_id = ANY(v_attempt_ids);

    DELETE FROM interview_attempts WHERE interview_id = p_interview_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('attempts', v_count);
  END IF;

  DELETE FROM interview_invitations WHERE interview_id = p_interview_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('invitations', v_count);

  DELETE FROM questions WHERE interview_id = p_interview_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('questions', v_count);

  DELETE FROM interview_panel_members WHERE interview_id = p_interview_id;
  DELETE FROM interview_operation_logs WHERE interview_id = p_interview_id;
  DELETE FROM collaboration_threads WHERE entity_type = 'interview' AND entity_id = p_interview_id;

  DELETE FROM interviews WHERE id = p_interview_id;

  RETURN jsonb_build_object(
    'success', true,
    'interview_title', v_interview.title,
    'deleted_counts', v_deleted_counts
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Interview deletion failed: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_question_regeneration_tx(p_interview_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_interview RECORD;
  v_deleted_count integer;
BEGIN
  SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id;
  IF v_interview IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  DELETE FROM attempt_questions 
  WHERE question_id IN (SELECT id FROM questions WHERE interview_id = p_interview_id);

  DELETE FROM questions WHERE interview_id = p_interview_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

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
  UPDATE interviews SET generation_status = 'failed', generation_error = SQLERRM WHERE id = p_interview_id;
  RAISE EXCEPTION 'Question regeneration preparation failed: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_interview_evaluation_tx(p_attempt_id uuid, p_overall_score integer, p_hiring_decision text, p_strengths text[], p_weaknesses text[], p_topic_scores jsonb, p_detailed_analysis text, p_technical_score numeric, p_problem_solving_score numeric, p_integrity_score numeric, p_candidate_name text, p_candidate_email text, p_top_skills text[], p_weak_skills text[], p_violations_detected integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt RECORD;
  v_cpi numeric;
  v_assessment_id uuid;
BEGIN
  SELECT * INTO v_attempt FROM interview_attempts WHERE id = p_attempt_id;
  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'Interview attempt not found';
  END IF;

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

  v_cpi := calculate_cpi_score(p_technical_score, p_problem_solving_score, p_integrity_score);

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
$function$;

CREATE OR REPLACE FUNCTION public.save_certification_evaluation_tx(p_attempt_id uuid, p_score integer, p_integrity_score integer, p_passed boolean, p_time_taken integer, p_violation_summary jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt RECORD;
  v_topic RECORD;
  v_certificate_id uuid;
  v_cert_number text;
  v_verification_code text;
BEGIN
  SELECT ca.*, cas.certification_topic_id, cas.passing_score, cas.min_integrity_score
  INTO v_attempt
  FROM certification_attempts ca
  JOIN certification_assessments cas ON cas.id = ca.certification_assessment_id
  WHERE ca.id = p_attempt_id;

  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'Certification attempt not found';
  END IF;

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

  IF p_passed AND p_score >= v_attempt.passing_score AND p_integrity_score >= v_attempt.min_integrity_score THEN
    SELECT * INTO v_topic FROM certification_topics WHERE id = v_attempt.certification_topic_id;
    
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
$function$;

-- generate_invoice_tx (version 1)
CREATE OR REPLACE FUNCTION public.generate_invoice_tx(p_organization_id uuid, p_subscription_id uuid, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_line_items jsonb, p_amount_cents integer, p_tax_cents integer DEFAULT 0, p_notes text DEFAULT NULL::text, p_promotion_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_number text;
  v_invoice_id uuid;
  v_total_cents integer;
  v_discount_cents integer := 0;
BEGIN
  v_invoice_number := generate_invoice_number();
  v_total_cents := p_amount_cents + p_tax_cents;

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
$function$;

-- ============================================================================
-- SECTION 9: EVALUATION AND TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_evaluate_interview()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_include_video_analysis BOOLEAN;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- Read URL from system_config; fallback to PostgreSQL app setting (no hardcoded URL)
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_project_url';
    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
    END IF;
    v_anon_key := current_setting('app.settings.service_role_key', true);
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
$function$;

CREATE OR REPLACE FUNCTION public.auto_set_interview_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.complete_invitation_on_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.increment_interview_usage(org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE organization_subscriptions
  SET interviews_used = interviews_used + 1
  WHERE organization_id = org_id
  AND status = 'active';
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_interviews_used()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_subscription_interview_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_usage_tracking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_period_start timestamp with time zone;
  v_period_end timestamp with time zone;
BEGIN
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  
  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  v_period_start := date_trunc('month', now());
  v_period_end := v_period_start + interval '1 month';
  
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
$function$;

CREATE OR REPLACE FUNCTION public.trigger_auto_evaluate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);
    
    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
    END IF;
    
    IF v_service_key IS NULL THEN
      v_service_key := current_setting('supabase.service_role_key', true);
    END IF;
    
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/evaluate-interview',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := jsonb_build_object('attemptId', NEW.id)
    );
    
    INSERT INTO public.audit_logs (
      action, table_name, record_id, metadata
    ) VALUES (
      'AUTO_EVALUATE', 'interview_attempts', NEW.id,
      jsonb_build_object('attempt_id', NEW.id, 'triggered_at', NOW(), 'trigger_method', 'database_trigger')
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in trigger_auto_evaluate: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_assessment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_session_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.session_token IS NULL THEN
    NEW.session_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_ai_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ============================================================================
-- SECTION 10: DATA CLEANUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.execute_data_retention_cleanup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_proctoring_deleted integer := 0;
  v_audit_deleted integer := 0;
  v_email_deleted integer := 0;
  v_notifications_deleted integer := 0;
  v_policy RECORD;
  v_cutoff_date timestamptz;
BEGIN
  FOR v_policy IN 
    SELECT data_type, retention_days 
    FROM data_retention_policies 
    WHERE auto_delete_enabled = true 
      AND organization_id IS NULL
  LOOP
    v_cutoff_date := NOW() - (v_policy.retention_days || ' days')::interval;
    
    CASE v_policy.data_type
      WHEN 'proctoring_recordings' THEN
        DELETE FROM storage.objects
        WHERE bucket_id = 'proctoring-recordings'
          AND created_at < v_cutoff_date;
        GET DIAGNOSTICS v_proctoring_deleted = ROW_COUNT;
        
        UPDATE proctoring_sessions
        SET 
          video_recording_url = NULL,
          screen_recording_url = NULL
        WHERE created_at < v_cutoff_date
          AND (video_recording_url IS NOT NULL OR screen_recording_url IS NOT NULL);
      
      WHEN 'audit_logs' THEN
        DELETE FROM audit_logs
        WHERE created_at < v_cutoff_date;
        GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;
      
      WHEN 'email_logs' THEN
        DELETE FROM email_logs
        WHERE created_at < v_cutoff_date;
        GET DIAGNOSTICS v_email_deleted = ROW_COUNT;
      
      WHEN 'notifications' THEN
        DELETE FROM notifications
        WHERE created_at < v_cutoff_date
          AND is_read = true;
        GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;
      
      ELSE
        CONTINUE;
    END CASE;
    
    UPDATE data_retention_policies
    SET last_cleanup_at = NOW()
    WHERE data_type = v_policy.data_type
      AND organization_id IS NULL;
  END LOOP;
  
  v_result := jsonb_build_object(
    'executed_at', NOW(),
    'proctoring_recordings_deleted', v_proctoring_deleted,
    'audit_logs_deleted', v_audit_deleted,
    'email_logs_deleted', v_email_deleted,
    'notifications_deleted', v_notifications_deleted,
    'total_deleted', v_proctoring_deleted + v_audit_deleted + v_email_deleted + v_notifications_deleted
  );
  
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
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_proctoring_recordings()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
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
$function$;

-- ============================================================================
-- SECTION 11: BADGE AND CERTIFICATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.can_user_retake_certification(p_user_id uuid, p_certification_topic_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.verify_certificate_by_code(p_verification_code text)
 RETURNS TABLE(certificate_number text, verification_code text, score integer, integrity_score integer, issued_at timestamp with time zone, expires_at timestamp with time zone, is_revoked boolean, revoked_reason text, certification_name text, category text, difficulty_level text, candidate_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
$function$;

-- ============================================================================
-- SECTION 12: LEARNING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_assessment_questions_for_attempt(p_attempt_id uuid)
 RETURNS TABLE(id uuid, assessment_id uuid, question_text text, question_type text, topic text, difficulty text, options jsonb, hints text, order_index integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

DROP FUNCTION IF EXISTS public.get_active_learning_subscription(uuid);
CREATE OR REPLACE FUNCTION public.get_active_learning_subscription(p_user_id uuid)
 RETURNS TABLE(id uuid, plan_id uuid, status text, started_at timestamptz, expires_at timestamptz, plan_name text, features jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ls.id,
    ls.plan_id,
    ls.status,
    ls.started_at,
    ls.expires_at,
    lsp.name as plan_name,
    lsp.features
  FROM learning_subscriptions ls
  JOIN learning_subscription_plans lsp ON lsp.id = ls.plan_id
  WHERE ls.user_id = p_user_id
    AND ls.status = 'active'
    AND (ls.expires_at IS NULL OR ls.expires_at > now())
  ORDER BY ls.created_at DESC
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_daily_free_assessment_limit(p_user_id uuid)
 RETURNS TABLE(can_take_free boolean, free_count integer, free_limit integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ============================================================================
-- SECTION 13: NOTIFICATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_organization_id uuid, p_type text, p_title text, p_message text, p_link text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ============================================================================
-- SECTION 14: ENCRYPTION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.encrypt_api_key(api_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_api_key_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.api_key_encrypted IS NOT NULL 
     AND NEW.api_key_encrypted !~ '^[A-Za-z0-9+/]+=*$' THEN
    NEW.api_key_encrypted := public.encrypt_api_key(NEW.api_key_encrypted);
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- SECTION 15: IDEMPOTENCY AND RATE LIMITING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.acquire_idempotency_lock(p_key text, p_operation_type text, p_request_hash text DEFAULT NULL::text)
 RETURNS TABLE(acquired boolean, existing_response jsonb, existing_resource_id uuid, lock_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing RECORD;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_existing
  FROM idempotency_keys
  WHERE key = p_key;
  
  IF v_existing IS NOT NULL THEN
    IF v_existing.status = 'completed' THEN
      RETURN QUERY SELECT 
        FALSE::BOOLEAN,
        v_existing.response,
        v_existing.resource_id,
        v_existing.id;
      RETURN;
    ELSIF v_existing.status = 'pending' AND v_existing.created_at > (now() - interval '5 minutes') THEN
      RAISE EXCEPTION 'Operation in progress for key: %', p_key;
    ELSE
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
  
  INSERT INTO idempotency_keys (key, operation_type, request_hash, status)
  VALUES (p_key, p_operation_type, p_request_hash, 'pending')
  RETURNING id INTO v_new_id;
  
  RETURN QUERY SELECT TRUE::BOOLEAN, NULL::JSONB, NULL::UUID, v_new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_idempotency(p_lock_id uuid, p_resource_id uuid, p_response jsonb, p_success boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE idempotency_keys
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    resource_id = p_resource_id,
    response = p_response,
    completed_at = now()
  WHERE id = p_lock_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM idempotency_keys
  WHERE expires_at < now()
    AND status != 'pending';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier text, p_endpoint text, p_max_requests integer DEFAULT 60, p_window_seconds integer DEFAULT 60)
 RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bucket RECORD;
  v_window_end TIMESTAMPTZ;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_bucket
  FROM rate_limit_buckets
  WHERE identifier = p_identifier AND endpoint = p_endpoint
  FOR UPDATE;
  
  IF v_bucket IS NULL THEN
    INSERT INTO rate_limit_buckets (identifier, endpoint, max_requests, window_seconds)
    VALUES (p_identifier, p_endpoint, p_max_requests, p_window_seconds);
    
    v_remaining := p_max_requests - 1;
    RETURN QUERY SELECT TRUE, v_remaining, now() + (p_window_seconds || ' seconds')::interval;
    RETURN;
  END IF;
  
  v_window_end := v_bucket.window_start + (v_bucket.window_seconds || ' seconds')::interval;
  
  IF now() > v_window_end THEN
    UPDATE rate_limit_buckets
    SET window_start = now(), request_count = 1
    WHERE id = v_bucket.id;
    
    v_remaining := p_max_requests - 1;
    RETURN QUERY SELECT TRUE, v_remaining, now() + (p_window_seconds || ' seconds')::interval;
    RETURN;
  END IF;
  
  IF v_bucket.request_count >= v_bucket.max_requests THEN
    v_remaining := 0;
    RETURN QUERY SELECT FALSE, v_remaining, v_window_end;
    RETURN;
  END IF;
  
  UPDATE rate_limit_buckets
  SET request_count = request_count + 1
  WHERE id = v_bucket.id;
  
  v_remaining := v_bucket.max_requests - v_bucket.request_count - 1;
  RETURN QUERY SELECT TRUE, v_remaining, v_window_end;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_buckets()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_buckets
  WHERE window_start < now() - interval '1 hour';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

-- ============================================================================
-- SECTION 16: CIRCUIT BREAKER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_circuit_breaker(p_service_name text)
 RETURNS TABLE(is_open boolean, current_state text, can_attempt boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state RECORD;
  v_should_try_half_open BOOLEAN;
BEGIN
  SELECT * INTO v_state
  FROM circuit_breaker_state
  WHERE service_name = p_service_name;
  
  IF v_state IS NULL THEN
    INSERT INTO circuit_breaker_state (service_name, state)
    VALUES (p_service_name, 'closed')
    RETURNING * INTO v_state;
  END IF;
  
  IF v_state.state = 'open' THEN
    v_should_try_half_open := v_state.opened_at + (v_state.timeout_seconds || ' seconds')::interval < now();
    
    IF v_should_try_half_open THEN
      UPDATE circuit_breaker_state
      SET state = 'half_open', half_open_at = now()
      WHERE service_name = p_service_name;
      
      RETURN QUERY SELECT FALSE, 'half_open'::TEXT, TRUE;
      RETURN;
    ELSE
      RETURN QUERY SELECT TRUE, 'open'::TEXT, FALSE;
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT FALSE, v_state.state, TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_circuit_failure(p_service_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    UPDATE circuit_breaker_state
    SET state = 'open', opened_at = now(), success_count = 0, failure_count = failure_count + 1, last_failure_at = now()
    WHERE service_name = p_service_name;
  ELSE
    IF v_state.failure_count + 1 >= v_state.failure_threshold THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.record_circuit_success(p_service_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF v_state.success_count + 1 >= v_state.success_threshold THEN
      UPDATE circuit_breaker_state
      SET state = 'closed', failure_count = 0, success_count = 0, last_success_at = now()
      WHERE service_name = p_service_name;
    ELSE
      UPDATE circuit_breaker_state
      SET success_count = success_count + 1, last_success_at = now()
      WHERE service_name = p_service_name;
    END IF;
  ELSE
    UPDATE circuit_breaker_state
    SET failure_count = 0, success_count = success_count + 1, last_success_at = now()
    WHERE service_name = p_service_name;
  END IF;
END;
$function$;

-- ============================================================================
-- SECTION 17: FAILED JOB QUEUE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_failed_job(p_job_type text, p_job_id text, p_payload jsonb, p_error_message text, p_error_stack text DEFAULT NULL::text, p_source_function text DEFAULT NULL::text, p_organization_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_correlation_id text DEFAULT NULL::text, p_max_attempts integer DEFAULT 3)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id UUID;
  v_next_retry TIMESTAMPTZ;
BEGIN
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
$function$;

CREATE OR REPLACE FUNCTION public.get_retryable_jobs(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, job_type text, job_id text, payload jsonb, attempt_count integer, max_attempts integer, source_function text, correlation_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_failed_job_stats()
 RETURNS TABLE(job_type text, total_count bigint, failed_count bigint, retrying_count bigint, recovered_count bigint, abandoned_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_job_retrying(p_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE failed_jobs
  SET 
    status = 'retrying',
    attempt_count = attempt_count + 1,
    last_retry_at = now()
  WHERE id = p_job_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_job_recovered(p_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE failed_jobs
  SET 
    status = 'recovered',
    recovered_at = now()
  WHERE id = p_job_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_job_retry_failed(p_job_id uuid, p_error_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM failed_jobs WHERE id = p_job_id;
  
  IF v_job.attempt_count >= v_job.max_attempts THEN
    UPDATE failed_jobs
    SET 
      status = 'abandoned',
      error_message = p_error_message
    WHERE id = p_job_id;
  ELSE
    UPDATE failed_jobs
    SET 
      status = 'failed',
      error_message = p_error_message,
      next_retry_at = now() + (interval '5 minutes' * power(3, v_job.attempt_count))
    WHERE id = p_job_id;
  END IF;
END;
$function$;

-- ============================================================================
-- SECTION 18: ARCHITECTURE DOCUMENT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_architecture_docs_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_architecture_docs_outdated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE architecture_documents
  SET needs_refresh = true
  WHERE needs_refresh = false;
  
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- SECTION 19: PAYMENT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_payment_enabled(p_gateway_name text DEFAULT NULL::text)
 RETURNS TABLE(enabled boolean, gateway_name text, is_test_mode boolean, has_keys boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_gateway_name IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      pg.is_enabled,
      pg.gateway_name,
      pg.is_test_mode,
      CASE 
        WHEN pg.is_test_mode THEN 
          pg.test_public_key IS NOT NULL AND pg.test_secret_key IS NOT NULL
        ELSE 
          pg.live_public_key IS NOT NULL AND pg.live_secret_key IS NOT NULL
      END as has_keys
    FROM payment_gateways pg
    WHERE pg.gateway_name = p_gateway_name
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT 
      pg.is_enabled,
      pg.gateway_name,
      pg.is_test_mode,
      CASE 
        WHEN pg.is_test_mode THEN 
          pg.test_public_key IS NOT NULL AND pg.test_secret_key IS NOT NULL
        ELSE 
          pg.live_public_key IS NOT NULL AND pg.live_secret_key IS NOT NULL
      END as has_keys
    FROM payment_gateways pg
    WHERE pg.is_enabled = true
    ORDER BY pg.priority ASC
    LIMIT 1;
  END IF;
END;
$function$;

-- ============================================================================
-- SECTION 20: UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete(p_table_name text, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    p_table_name
  ) USING p_id;
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_restore(p_table_name text, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
    p_table_name
  ) USING p_id;
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.optimistic_update(p_table_name text, p_id uuid, p_expected_version integer, p_updates jsonb)
 RETURNS TABLE(success boolean, new_version integer, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_version INTEGER;
  v_new_version INTEGER;
  v_sql TEXT;
  v_update_parts TEXT[];
  v_key TEXT;
  v_value JSONB;
BEGIN
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
$function$;

-- ============================================================================
-- DONE - Total: 109 functions (exact replica from Production Cloud)
-- Run 05_rls_policies.sql next
-- ============================================================================
