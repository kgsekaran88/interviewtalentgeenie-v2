-- Update delete_user_cascade_tx to untag interviews instead of blocking
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
  v_untagged_interviews integer;
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

  -- UNTAG interviews instead of blocking deletion
  -- This ensures new accounts with same email don't see old interviews
  UPDATE interviews SET creator_id = NULL WHERE creator_id = p_user_id;
  GET DIAGNOSTICS v_untagged_interviews = ROW_COUNT;

  -- Still check for other data dependencies that should block deletion
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
    jsonb_build_object('elevations', v_elevations, 'untagged_interviews', v_untagged_interviews)
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'elevations', v_elevations,
    'untagged_interviews', v_untagged_interviews
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'User cascade deletion failed: %', SQLERRM;
END;
$function$;