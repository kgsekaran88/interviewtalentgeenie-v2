import { createClient } from 'npm:@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Auto-close expired proctoring sessions
 * SECURITY: Requires platform_admin role
 * NOTE: Should ideally be triggered via database cron job instead of HTTP endpoint
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize - only platform admins
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ['platform_admin']);
    
    if (authResult.error) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { 
          status: authHeader ? 403 : 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { supabase } = authResult;

    // Call the database function to auto-close expired sessions
    const { data, error } = await supabase.rpc('auto_close_expired_proctoring_sessions');

    if (error) {
      console.error('Error closing expired sessions:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Successfully closed ${data} expired proctoring sessions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionsClosed: data,
        message: `Closed ${data} expired sessions`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
