import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface RouteMapping {
  platform_admin?: string;
  partner_admin?: string;
  hr_recruiter?: string;
  tech_spoc?: string;
  interviewer?: string;
  candidate?: string;
  default: string;
}

interface RoleAwareRedirectProps {
  routeMap: RouteMapping;
}

export const RoleAwareRedirect = ({ routeMap }: RoleAwareRedirectProps) => {
  const navigate = useNavigate();
  const params = useParams();
  const { roles, loading } = useAuth();

  useEffect(() => {
    // Wait for roles to load before redirecting
    if (loading) return;
    
    // Determine the highest priority role to use for routing
    const rolesPriority: (keyof RouteMapping)[] = [
      'platform_admin',
      'partner_admin',
      'hr_recruiter',
      'tech_spoc',
      'interviewer',
      'candidate'
    ];
    
    // Find the first matching role
    let targetRoute = routeMap.default;
    for (const role of rolesPriority) {
      if (roles.includes(role as any) && routeMap[role]) {
        targetRoute = routeMap[role]!;
        break;
      }
    }
    
    // Replace URL parameters (like :id) with actual values
    Object.entries(params).forEach(([key, value]) => {
      targetRoute = targetRoute.replace(`:${key}`, value || '');
    });

    navigate(targetRoute, { replace: true });
  }, [navigate, params, routeMap, roles, loading]);

  // Show loading state while waiting for roles
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return null;
};
