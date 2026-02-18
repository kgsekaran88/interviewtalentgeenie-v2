import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Loader2 } from 'lucide-react';

/**
 * Smart redirect component that routes users to their role-specific dashboard
 */
export const RoleBasedRedirect = () => {
  const { isPlatformAdmin, isPartnerAdmin, isHRRecruiter, isTechSPOC, isGuest, loading } = useUserRoles();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Priority order: Admin > Partner > Recruiter/TechSPOC > Guest
  // Platform admins now have their own organization portal
  if (isPlatformAdmin) {
    return <Navigate to="/partner/portal" replace />;
  }
  
  if (isPartnerAdmin) {
    return <Navigate to="/partner/portal" replace />;
  }
  
  if (isHRRecruiter) {
    return <Navigate to="/partner/recruiting/interviews" replace />;
  }
  
  // Tech SPOC only accesses pending reviews - redirect to interviews list
  if (isTechSPOC) {
    return <Navigate to="/partner/recruiting/pending-reviews" replace />;
  }
  
  if (isGuest) {
    return <Navigate to="/learning-dashboard" replace />;
  }

  // Fallback for users with no roles
  return <Navigate to="/profile" replace />;
};
