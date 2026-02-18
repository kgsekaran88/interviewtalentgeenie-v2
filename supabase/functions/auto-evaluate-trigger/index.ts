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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { attemptId, includeVideoAnalysis, priority } = await req.json();

    if (!attemptId) {
      return new Response(
        JSON.stringify({ error: 'attemptId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[AutoEvaluate] Adding to queue:', attemptId, 'includeVideoAnalysis:', includeVideoAnalysis);

    // Add to evaluation queue instead of calling directly
    const { data: queueItem, error: queueError } = await supabase
      .from('evaluation_queue')
      .upsert({
        attempt_id: attemptId,
        include_video_analysis: includeVideoAnalysis === true,
        priority: priority || 5, // Default priority
        status: 'pending',
        created_at: new Date().toISOString(),
        retry_count: 0
      }, {
        onConflict: 'attempt_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (queueError) {
      // Check if it's a unique constraint violation (already in queue)
      if (queueError.code === '23505') {
        console.log('[AutoEvaluate] Already in queue:', attemptId);
        
        // Get queue position
        const { data: position } = await supabase
          .from('evaluation_queue')
          .select('id, status, created_at')
          .eq('attempt_id', attemptId)
          .in('status', ['pending', 'processing'])
          .single();

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Already in evaluation queue',
            queueStatus: position?.status,
            alreadyQueued: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      throw queueError;
    }

    console.log('[AutoEvaluate] Added to queue:', queueItem?.id);

    // Get queue position
    const { count: queuePosition } = await supabase
      .from('evaluation_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('created_at', queueItem?.created_at || new Date().toISOString());

    // Trigger queue processor (fire and forget)
    const processorUrl = `${supabaseUrl}/functions/v1/process-evaluation-queue`;
    
    fetch(processorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({})
    }).then(response => {
      console.log('[AutoEvaluate] Queue processor triggered, status:', response.status);
    }).catch(err => {
      console.warn('[AutoEvaluate] Failed to trigger queue processor:', err);
      // Not critical - queue will be processed on next trigger
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Added to evaluation queue',
        queueId: queueItem?.id,
        queuePosition: queuePosition || 1,
        includeVideoAnalysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('[AutoEvaluate] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
