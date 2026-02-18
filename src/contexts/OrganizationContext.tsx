import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { logger } from '@/lib/logger';

interface Organization {
  id: string;
  name: string;
  industry?: string;
  website?: string;
}

interface OrganizationContextType {
  selectedOrgId: string | null;
  selectedOrg: Organization | null;
  availableOrgs: Organization[];
  setSelectedOrgId: (orgId: string | null) => void;
  loading: boolean;
  userOrgId: string | null; // User's own organization (for partner admins)
  isImpersonating: boolean; // Platform admin viewing as partner
  enterImpersonationMode: (orgId: string) => void;
  exitImpersonationMode: () => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { isPlatformAdmin, isPartnerAdmin } = useUserRoles();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([]);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user's own organization from organization_members
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('organization_id, organizations(id, name, industry, website)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (memberData?.organization_id) {
          setUserOrgId(memberData.organization_id);
        }

        if (isPlatformAdmin) {
          // Platform admin can see all organizations regardless of membership
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name, industry, website')
            .order('name');

          if (orgs) {
            setAvailableOrgs(orgs);
            
            // If platform admin has an org membership, use that as their default
            if (memberData?.organizations) {
              const org = memberData.organizations as any;
              setUserOrgId(org.id);
              setSelectedOrgId(org.id);
              setSelectedOrg({
                id: org.id,
                name: org.name,
                industry: org.industry,
                website: org.website
              });
            } else {
              // Platform admin without org membership - use first available org as default
              if (orgs.length > 0) {
                const firstOrg = orgs[0];
                setSelectedOrgId(firstOrg.id);
                setSelectedOrg(firstOrg);
              }
            }
          }
        } else if (isPartnerAdmin && memberData?.organizations) {
          // Partner admin locked to their organization
          const org = memberData.organizations as any;
          setAvailableOrgs([{
            id: org.id,
            name: org.name,
            industry: org.industry,
            website: org.website
          }]);
          setSelectedOrgId(org.id);
          setSelectedOrg({
            id: org.id,
            name: org.name,
            industry: org.industry,
            website: org.website
          });
        }
      } catch (error) {
        logger.error('Error fetching organizations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [user, isPlatformAdmin, isPartnerAdmin]);

  // Update selectedOrg when selectedOrgId changes
  useEffect(() => {
    if (selectedOrgId) {
      const org = availableOrgs.find(o => o.id === selectedOrgId);
      setSelectedOrg(org || null);
    } else {
      setSelectedOrg(null);
    }
  }, [selectedOrgId, availableOrgs]);

  const enterImpersonationMode = (orgId: string) => {
    if (!isPlatformAdmin) return;
    setSelectedOrgId(orgId);
    setIsImpersonating(true);
  };

  const exitImpersonationMode = () => {
    setIsImpersonating(false);
    setSelectedOrgId(null);
  };

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrgId,
        selectedOrg,
        availableOrgs,
        setSelectedOrgId,
        loading,
        userOrgId,
        isImpersonating,
        enterImpersonationMode,
        exitImpersonationMode
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};
