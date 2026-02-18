import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useOrganization } from "@/contexts/OrganizationContext";

/**
 * Route helper for legacy links and breadcrumb navigation.
 * - platform_admin: go to the partner org list in admin
 * - others: go to their own org management (if we know it)
 */
export default function PartnerManageIndexRedirect() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useUserRoles();
  const { userOrgId, selectedOrgId } = useOrganization();

  useEffect(() => {
    if (isPlatformAdmin) {
      navigate("/admin/organizations", { replace: true });
      return;
    }

    const orgId = selectedOrgId || userOrgId;
    if (orgId) {
      navigate(`/partner/manage/${orgId}`, { replace: true });
      return;
    }

    navigate("/partner", { replace: true });
  }, [isPlatformAdmin, navigate, selectedOrgId, userOrgId]);

  return null;
}
