import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { logger } from '@/lib/logger';

export type AppRole = 'platform_admin' | 'partner_admin' | 'hr_recruiter' | 'tech_spoc' | 'billing_contact' | 'guest';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  roles: [],
  hasRole: () => false,
  hasAnyRole: () => false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // IMPORTANT: keep this callback synchronous to avoid auth deadlocks.
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Defer any Supabase calls to the next tick.
        setTimeout(() => {
          // On SIGNED_IN event, ensure user setup is complete
          if (event === 'SIGNED_IN') {
            ensureUserSetup(nextSession.user!, nextSession.access_token);
          }
          fetchUserRoles(nextSession.user!.id);
        }, 0);
      } else {
        setRoles([]);
      }

      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        setTimeout(() => {
          fetchUserRoles(initialSession.user!.id);
        }, 0);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Ensure user profile and roles are set up (called on first sign-in after verification)
  const ensureUserSetup = async (user: User, accessToken: string) => {
    try {
      // Check if profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      // If no profile, call complete-user-signup to set up the user
      if (!profile) {
        logger.info('No profile found, completing user setup...');
        await invokeFunction('complete-user-signup', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        // Refresh roles after setup
        setTimeout(() => fetchUserRoles(user.id), 500);
      }
    } catch (error) {
      // PGRST116 = row not found, which means we need to set up the user
      if ((error as any)?.code === 'PGRST116') {
        logger.info('Profile not found, completing user setup...');
        try {
          await invokeFunction('complete-user-signup', {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          // Refresh roles after setup
          setTimeout(() => fetchUserRoles(user.id), 500);
        } catch (setupError) {
          logger.error('User setup failed:', setupError);
        }
      } else {
        logger.error('Error checking user profile:', error);
      }
    }
  };

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;
      setRoles(data?.map(r => r.role as AppRole) || []);
    } catch (error) {
      logger.error('Error fetching user roles:', error);
      setRoles([]);
    }
  };

  // Role checking with hierarchy: platform_admin bypasses all checks (god mode)
  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => 
    roles.includes('platform_admin') || checkRoles.some(r => roles.includes(r));

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
};
