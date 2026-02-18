-- Drop and recreate the function with authorization check
CREATE OR REPLACE FUNCTION public.approve_partner_application_tx(p_application_id uuid, p_reviewer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_org_id uuid;
  v_slug text;
  v_counter integer := 1;
  v_base_slug text;
  v_result jsonb;
BEGIN
  -- AUTHORIZATION CHECK: Only platform admins can approve applications
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve partner applications';
  END IF;

  -- Validate reviewer_id matches authenticated user
  IF p_reviewer_id != auth.uid() THEN
    RAISE EXCEPTION 'Invalid reviewer: Reviewer ID must match authenticated user';
  END IF;

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