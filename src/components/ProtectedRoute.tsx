import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, AppRole } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert } from 'lucide-react';
import { EmailVerificationRequired } from './EmailVerificationRequired';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: AppRole[];
  requireAuth?: boolean;
  requireEmailVerification?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requiredRoles = [],
  requireAuth = true,
  requireEmailVerification = true
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading, hasAnyRole, isPlatformAdmin } = useUserRoles();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name?: string } | null>(null);

  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!user) {
        setCheckingVerification(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('email_verified, full_name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking email verification:', error);
          // Default to verified if we can't check (to not block existing users)
          setEmailVerified(true);
        } else {
          setEmailVerified(profile?.email_verified ?? false);
          setUserProfile(profile);
        }
      } catch (err) {
        console.error('Exception checking email verification:', err);
        setEmailVerified(true);
      } finally {
        setCheckingVerification(false);
      }
    };

    if (user && requireEmailVerification) {
      checkEmailVerification();
    } else {
      setCheckingVerification(false);
      setEmailVerified(true);
    }
  }, [user, requireEmailVerification]);

  // Show loading state while checking auth
  if (authLoading || rolesLoading || checkingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to auth if user is not logged in and auth is required
  if (requireAuth && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Check email verification (platform_admin bypasses this check)
  if (requireEmailVerification && user && emailVerified === false && !isPlatformAdmin) {
    return (
      <EmailVerificationRequired 
        userEmail={user.email || ''} 
        userName={userProfile?.full_name}
      />
    );
  }

  // Check role requirements (platform_admin bypasses all checks - god mode)
  if (requiredRoles.length > 0 && !isPlatformAdmin && !hasAnyRole(requiredRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this page. Required role: {requiredRoles.join(', ')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};
