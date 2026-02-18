import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

// Core roles after consolidation (5 main roles - interviewer role removed)
export type AppRole = 'platform_admin' | 'partner_admin' | 'hr_recruiter' | 'tech_spoc' | 'billing_contact' | 'guest';

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;
        
        setRoles(data?.map(r => r.role as AppRole) || []);
      } catch (error) {
        logger.error('Error fetching user roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  // Role checking with hierarchy: platform_admin bypasses all checks (god mode)
  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => 
    roles.includes('platform_admin') || checkRoles.some(r => roles.includes(r));
  const hasAllRoles = (checkRoles: AppRole[]) => 
    roles.includes('platform_admin') || checkRoles.every(r => roles.includes(r));

  return {
    roles,
    loading,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isPlatformAdmin: hasRole('platform_admin'),
    isPartnerAdmin: hasRole('partner_admin'),
    isHRRecruiter: hasRole('hr_recruiter'),
    isTechSPOC: hasRole('tech_spoc'),
    isBillingContact: hasRole('billing_contact'),
    isGuest: hasRole('guest'),
  };
};
