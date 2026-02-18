import { createClient } from "npm:@supabase/supabase-js@2";

export interface AuthResult {
  user: any;
  supabaseAuth: any;
  supabase: any;
  error?: string;
}

/**
 * Dual-client authentication pattern for edge functions
 * Creates two clients:
 * 1. supabaseAuth - with user credentials for user identity verification
 * 2. supabase - with service role for database operations (bypasses RLS)
 * 
 * IMPORTANT: Role checking uses the service role client to bypass RLS,
 * preventing issues where users can't read their own roles due to policy complexity.
 */
export async function authenticateRequest(
  authHeader: string | null,
  requiredRoles?: string[]
): Promise<AuthResult> {
  if (!authHeader) {
    return {
      user: null,
      supabaseAuth: null,
      supabase: null,
      error: 'Authentication required'
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client 1: User authentication (for identity verification)
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  console.log('[auth-utils] Auth header present:', !!authHeader);
  console.log('[auth-utils] Auth header prefix:', authHeader?.substring(0, 20));

  // Verify user identity
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) {
    console.error('[auth-utils] User verification failed:', userError?.message, userError?.status);
    return {
      user: null,
      supabaseAuth,
      supabase: null,
      error: `Invalid authentication: ${userError?.message || 'No user found'}`
    };
  }

  console.log('[auth-utils] User verified:', user.id, user.email);

  // Client 2: Service role (bypasses RLS for privileged operations)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check roles if required - using SERVICE ROLE to bypass RLS
  if (requiredRoles && requiredRoles.length > 0) {
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[auth-utils] Error fetching roles:', rolesError.message);
      return {
        user,
        supabaseAuth,
        supabase: null,
        error: 'Failed to verify permissions'
      };
    }

    const roles = userRoles?.map(r => r.role) || [];
    console.log('[auth-utils] User roles:', roles);

    // Check if user has any of the required roles
    // platform_admin always has access (god mode)
    const hasRequiredRole = roles.includes('platform_admin') || 
                            roles.some(r => requiredRoles.includes(r));
    
    if (!hasRequiredRole) {
      console.error('[auth-utils] Access denied. Has:', roles, 'Needs one of:', requiredRoles);
      return {
        user,
        supabaseAuth,
        supabase,
        error: `Access denied. Required roles: ${requiredRoles.join(', ')}`
      };
    }

    console.log('[auth-utils] Authorization successful');
  }

  return {
    user,
    supabaseAuth,
    supabase
  };
}

/**
 * Get user roles using service role client (bypasses RLS)
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.error('[auth-utils] Error fetching roles for user:', userId, error.message);
    return [];
  }

  return userRoles?.map(r => r.role) || [];
}

/**
 * Check if user has specific role
 */
export async function hasRole(userId: string, role: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('platform_admin') || roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(userId: string, requiredRoles: string[]): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('platform_admin') || roles.some(r => requiredRoles.includes(r));
}
