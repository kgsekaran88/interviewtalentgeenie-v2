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

  // Verify user identity
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) {
    return {
      user: null,
      supabaseAuth,
      supabase: null,
      error: `Invalid authentication: ${userError?.message || 'No user found'}`
    };
  }

  // Client 2: Service role (bypasses RLS for privileged operations)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check roles if required - using SERVICE ROLE to bypass RLS
  if (requiredRoles && requiredRoles.length > 0) {
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('[auth-utils] Role fetch failed:', rolesError.message);
      return {
        user,
        supabaseAuth,
        supabase: null,
        error: 'Failed to verify permissions'
      };
    }

    const roles = userRoles?.map(r => r.role) || [];

    // Check if user has any of the required roles
    // platform_admin always has access (god mode)
    const hasRequiredRole = roles.includes('platform_admin') || 
                            roles.some(r => requiredRoles.includes(r));
    
    if (!hasRequiredRole) {
      console.error('[auth-utils] Access denied for user:', user.id, '- missing roles:', requiredRoles);
      return {
        user,
        supabaseAuth,
        supabase,
        error: `Access denied. Required roles: ${requiredRoles.join(', ')}`
      };
    }
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
    console.error('[auth-utils] Role fetch error:', error.message);
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

/**
 * Authorize cron/worker edge functions.
 * Accepts (in order):
 * 1. Bearer SERVICE_ROLE_KEY
 * 2. x-scheduled-secret matching SCHEDULED_CLEANUP_SECRET
 * 3. User JWT with one of requiredRoles (default: platform_admin)
 */
export async function authorizeWorkerRequest(
  req: Request,
  requiredRoles: string[] = ['platform_admin']
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');

  if (authHeader?.includes(supabaseServiceKey)) {
    return { authorized: true };
  }

  const scheduledSecret = req.headers.get('x-scheduled-secret');
  const expectedSecret = Deno.env.get('SCHEDULED_CLEANUP_SECRET');
  if (scheduledSecret && expectedSecret && scheduledSecret === expectedSecret) {
    return { authorized: true };
  }

  if (authHeader) {
    const auth = await authenticateRequest(authHeader, requiredRoles);
    if (!auth.error && auth.user) {
      return { authorized: true, userId: auth.user.id };
    }
    return { authorized: false, error: auth.error || 'Unauthorized' };
  }

  return {
    authorized: false,
    error: 'Unauthorized. Requires service role, scheduled secret, or admin JWT.',
  };
}
