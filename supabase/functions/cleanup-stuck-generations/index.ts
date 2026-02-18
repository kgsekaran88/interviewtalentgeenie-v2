import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find interviews stuck in 'generating' status for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckInterviews, error: fetchError } = await supabase
      .from('interviews')
      .select('id, title, updated_at')
      .eq('generation_status', 'generating')
      .lt('updated_at', fiveMinutesAgo);

    if (fetchError) {
      throw fetchError;
    }

    if (!stuckInterviews || stuckInterviews.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No stuck generations found',
          recovered: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${stuckInterviews.length} stuck generations, marking as failed...`);

    // Mark all stuck interviews as failed
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        generation_status: 'failed',
        generation_error: 'Generation timed out after 5 minutes. Please try again with a smaller question bank size or retry later.'
      })
      .in('id', stuckInterviews.map(i => i.id));

    if (updateError) {
      throw updateError;
    }

    console.log(`Successfully recovered ${stuckInterviews.length} stuck generations`);

    return new Response(
      JSON.stringify({ 
        message: `Successfully recovered ${stuckInterviews.length} stuck generation(s)`,
        recovered: stuckInterviews.length,
        interviews: stuckInterviews.map(i => ({ id: i.id, title: i.title }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-stuck-generations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
