import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


/**
 * Delete Interview - SOFT DELETE (reversible)
 * Uses soft_delete_interview_tx for safe deletion with 30-day restore window.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check permissions
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      return new Response(JSON.stringify({ error: 'Failed to verify permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requiredRoles = ['platform_admin', 'partner_admin'];
    const isAdmin = userRoles?.some((r: any) => requiredRoles.includes(r.role));

    const { interviewId, force = false } = await req.json();

    if (!interviewId) {
      return new Response(JSON.stringify({ error: 'Interview ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify ownership or admin
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('creator_id, title')
      .eq('id', interviewId)
      .single();

    if (fetchError || !interview) {
      return new Response(JSON.stringify({ error: 'Interview not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (interview.creator_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: 'You do not have permission to delete this interview' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── SOFT DELETE (default) ──
    if (!force) {
      console.log(`Soft-deleting interview ${interviewId}...`);

      const { data, error } = await supabase.rpc('soft_delete_interview_tx', {
        p_interview_id: interviewId
      });

      if (error) {
        console.error('Soft-delete transaction error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        method: 'soft_delete',
        message: `Interview "${interview.title}" soft-deleted. Can be restored.`,
        soft_deleted_counts: data?.soft_deleted_counts || {},
        can_restore: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── HARD DELETE (force=true, admin only) ──
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Hard delete requires admin privileges' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`HARD-deleting interview ${interviewId} [force=true]...`);

    const { data, error } = await supabase.rpc('delete_interview_tx', {
      p_interview_id: interviewId
    });

    if (error) {
      console.error('Hard-delete transaction error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      method: 'hard_delete',
      message: 'Interview and all related data permanently deleted.',
      deleted_counts: data?.deleted_counts || {}
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error deleting interview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
