
-- 1. Add missing platform admin to TalentGeenie org
INSERT INTO organization_members (user_id, organization_id, status)
SELECT 
  '33c58e33-fe11-4148-9414-531180e7eba5',
  '61604267-40ac-45e8-b791-af2164c779ef',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members 
  WHERE user_id = '33c58e33-fe11-4148-9414-531180e7eba5'
  AND organization_id = '61604267-40ac-45e8-b791-af2164c779ef'
);

-- 2. Create trigger to auto-add platform admins to TalentGeenie org
CREATE OR REPLACE FUNCTION public.add_platform_admin_to_talentgeenie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  talentgeenie_org_id uuid;
  member_exists boolean;
BEGIN
  -- Only proceed if the role being added is platform_admin
  IF NEW.role = 'platform_admin' THEN
    -- Get TalentGeenie org ID
    SELECT id INTO talentgeenie_org_id 
    FROM organizations 
    WHERE name = 'TalentGeenie'
    LIMIT 1;
    
    -- If TalentGeenie org exists, check if member already exists
    IF talentgeenie_org_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = NEW.user_id 
        AND organization_id = talentgeenie_org_id
      ) INTO member_exists;
      
      -- Only insert if not already a member
      IF NOT member_exists THEN
        INSERT INTO organization_members (user_id, organization_id, status)
        VALUES (NEW.user_id, talentgeenie_org_id, 'active');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS on_platform_admin_role_added ON user_roles;
CREATE TRIGGER on_platform_admin_role_added
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.add_platform_admin_to_talentgeenie();

-- 3. Queue the 3 submitted attempts for evaluation (check if they don't already exist)
INSERT INTO evaluation_queue (attempt_id, status, priority, requested_by)
SELECT 
  attempt_id,
  'pending',
  5,
  '33c58e33-fe11-4148-9414-531180e7eba5'
FROM (VALUES 
  ('d6b27821-3eef-4131-a2a8-c1d890d18767'::uuid),
  ('071b4e6f-efc4-4a4d-8c8f-1179c32646a9'::uuid),
  ('b695b36f-f98d-4204-9148-ec11c41042aa'::uuid)
) AS t(attempt_id)
WHERE NOT EXISTS (
  SELECT 1 FROM evaluation_queue eq WHERE eq.attempt_id = t.attempt_id
);
