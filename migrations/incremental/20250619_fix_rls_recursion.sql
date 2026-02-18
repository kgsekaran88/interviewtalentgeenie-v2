-- ============================================================================
-- Fix RLS Infinite Recursion on user_roles and organization_members
-- ============================================================================
-- Problem: RLS policies on user_roles called has_role()/has_any_role_with_hierarchy()
-- which read user_roles → infinite recursion. Similarly, organization_members had
-- a self-referential policy that queried itself.
-- 
-- Solution: 
--   1. Make helper functions SECURITY DEFINER (already done in original migration)
--   2. Create is_platform_admin() SECURITY DEFINER function
--   3. Create get_user_org_ids() SECURITY DEFINER function
--   4. Replace all user_roles policies with clean non-recursive versions
--   5. Replace all organization_members policies with clean non-recursive versions
-- ============================================================================

-- 1. Create is_platform_admin() — bypasses RLS to check platform_admin role
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'platform_admin'
  );
$$;

-- 2. Create get_user_org_ids() — bypasses RLS to get org memberships
CREATE OR REPLACE FUNCTION get_user_org_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = p_user_id AND status = 'active';
$$;

-- 3. Ensure core helper functions are SECURITY DEFINER
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION has_any_role_with_hierarchy(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND (
      role = ANY(_roles)
      OR role = 'platform_admin'
    )
  );
$$;

CREATE OR REPLACE FUNCTION user_is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION user_is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  );
$$;

-- ============================================================================
-- 4. Replace user_roles RLS policies
-- ============================================================================
-- Drop ALL existing policies on user_roles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_roles', pol.policyname);
  END LOOP;
END$$;

-- Create clean, non-recursive policies
-- Users can read their own roles
CREATE POLICY users_read_own_roles ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Platform admins can read all roles
CREATE POLICY admins_read_all_roles ON user_roles
  FOR SELECT USING (is_platform_admin());

-- Platform admins can insert/update/delete roles
CREATE POLICY admins_manage_roles ON user_roles
  FOR ALL USING (is_platform_admin());

-- Service role (used by backend) has full access via RLS bypass

-- ============================================================================
-- 5. Replace organization_members RLS policies
-- ============================================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'organization_members' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON organization_members', pol.policyname);
  END LOOP;
END$$;

-- Users can read their own memberships
CREATE POLICY users_read_own_memberships ON organization_members
  FOR SELECT USING (user_id = auth.uid());

-- Users can read other members in their org (uses SECURITY DEFINER function)
CREATE POLICY users_read_org_members ON organization_members
  FOR SELECT USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
  );

-- Platform admins can read all memberships
CREATE POLICY admins_read_all_members ON organization_members
  FOR SELECT USING (is_platform_admin());

-- Platform admins can manage all memberships
CREATE POLICY admins_manage_members ON organization_members
  FOR ALL USING (is_platform_admin());
