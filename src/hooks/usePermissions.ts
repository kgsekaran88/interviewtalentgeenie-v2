import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from './useUserRoles';
import { getSystemRolePermissions } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export function usePermissions() {
  const { roles, loading: rolesLoading } = useUserRoles();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [customRolePermissions, setCustomRolePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (rolesLoading) return;
      
      try {
        // Get system role permissions
        const systemPermissions = roles.flatMap(role => getSystemRolePermissions(role));
        
        // Get custom role permissions
        const { data: userCustomRoles } = await supabase
          .from('user_custom_roles' as any)
          .select(`
            custom_role_id,
            custom_roles:custom_role_id (
              id,
              permissions
            )
          `)
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        const customPerms = userCustomRoles?.flatMap((ucr: any) => 
          ucr.custom_roles?.permissions || []
        ) || [];

        // Combine and deduplicate
        const allPermissions = Array.from(new Set([...systemPermissions, ...customPerms]));
        
        setPermissions(allPermissions);
        setCustomRolePermissions(customPerms);
      } catch (error) {
        logger.error('Error fetching permissions:', error);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [roles, rolesLoading]);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (checkPermissions: string[]): boolean => {
    return checkPermissions.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (checkPermissions: string[]): boolean => {
    return checkPermissions.every(p => permissions.includes(p));
  };

  return {
    permissions,
    customRolePermissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
