import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum concurrent evaluations to process at once
const MAX_CONCURRENT_EVALUATIONS = 10;
// How long before a processing job is considered stuck (in minutes)
const STUCK_THRESHOLD_MINUTES = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('[QueueProcessor] Starting queue processing');

    // Step 1: Clean up stuck jobs (processing for too long)
    const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    const { data: stuckJobs } = await supabase
      .from('evaluation_queue')
      .select('id, attempt_id, retry_count, max_retries')
      .eq('status', 'processing')
      .lt('started_at', stuckThreshold);

    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`[QueueProcessor] Found ${stuckJobs.length} stuck jobs, resetting`);
      
      for (const job of stuckJobs) {
        if (job.retry_count >= job.max_retries) {
          // Max retries exceeded, mark as failed
          await supabase
            .from('evaluation_queue')
            .update({ 
              status: 'failed', 
              completed_at: new Date().toISOString(),
              error_message: 'Max retries exceeded - evaluation timed out'
            })
            .eq('id', job.id);
        } else {
          // Reset to pending for retry
          await supabase
            .from('evaluation_queue')
            .update({ 
              status: 'pending', 
              started_at: null,
              retry_count: job.retry_count + 1
            })
            .eq('id', job.id);
        }
      }
    }

    // Step 2: Check how many are currently processing
    const { count: processingCount } = await supabase
      .from('evaluation_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const availableSlots = MAX_CONCURRENT_EVALUATIONS - (processingCount || 0);
    console.log(`[QueueProcessor] Processing: ${processingCount}, Available slots: ${availableSlots}`);

    if (availableSlots <= 0) {
      return new Response(JSON.stringify({ 
        message: 'Queue at capacity', 
        processing: processingCount,
        maxConcurrent: MAX_CONCURRENT_EVALUATIONS 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Get pending jobs (ordered by priority and creation time)
    const { data: pendingJobs } = await supabase
      .from('evaluation_queue')
      .select('id, attempt_id, include_video_analysis, retry_count')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(availableSlots);

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('[QueueProcessor] No pending jobs');
      return new Response(JSON.stringify({ message: 'No pending jobs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[QueueProcessor] Processing ${pendingJobs.length} jobs`);

    // Step 4: Mark jobs as processing and trigger evaluations
    const results = [];
    
    for (const job of pendingJobs) {
      // Mark as processing
      const { error: updateError } = await supabase
        .from('evaluation_queue')
        .update({ 
          status: 'processing', 
          started_at: new Date().toISOString() 
        })
        .eq('id', job.id)
        .eq('status', 'pending'); // Only if still pending (race condition protection)

      if (updateError) {
        console.log(`[QueueProcessor] Job ${job.id} already picked up`);
        continue;
      }

      // Trigger evaluation (fire and forget - don't await)
      const evaluateUrl = `${supabaseUrl}/functions/v1/evaluate-interview`;
      
      fetch(evaluateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'x-queue-job-id': job.id // Pass job ID for completion tracking
        },
        body: JSON.stringify({ 
          attemptId: job.attempt_id,
          includeVideoAnalysis: job.include_video_analysis,
          queueJobId: job.id // Also in body for easier access
        })
      }).then(async (response) => {
        const status = response.status;
        console.log(`[QueueProcessor] Evaluation triggered for ${job.attempt_id}, status: ${status}`);
        
        // Update queue status based on response
        if (status === 200) {
          await supabase
            .from('evaluation_queue')
            .update({ 
              status: 'completed', 
              completed_at: new Date().toISOString() 
            })
            .eq('id', job.id);
        } else if (status === 409) {
          // Already in progress - mark as completed (duplicate)
          await supabase
            .from('evaluation_queue')
            .update({ 
              status: 'completed', 
              completed_at: new Date().toISOString(),
              error_message: 'Duplicate - evaluation already in progress'
            })
            .eq('id', job.id);
        } else {
          const text = await response.text();
          console.error(`[QueueProcessor] Evaluation failed: ${text}`);
          
          // Check if should retry
          if (job.retry_count < 3) {
            await supabase
              .from('evaluation_queue')
              .update({ 
                status: 'pending', 
                started_at: null,
                retry_count: job.retry_count + 1,
                error_message: `Attempt ${job.retry_count + 1} failed: ${text.substring(0, 200)}`
              })
              .eq('id', job.id);
          } else {
            await supabase
              .from('evaluation_queue')
              .update({ 
                status: 'failed', 
                completed_at: new Date().toISOString(),
                error_message: text.substring(0, 500)
              })
              .eq('id', job.id);
          }
        }
      }).catch(async (err) => {
        console.error(`[QueueProcessor] Failed to trigger evaluation:`, err);
        await supabase
          .from('evaluation_queue')
          .update({ 
            status: 'pending', 
            started_at: null,
            retry_count: job.retry_count + 1,
            error_message: `Network error: ${err.message}`
          })
          .eq('id', job.id);
      });

      results.push({ jobId: job.id, attemptId: job.attempt_id, status: 'triggered' });
    }

    return new Response(JSON.stringify({ 
      message: 'Queue processed',
      triggered: results.length,
      jobs: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[QueueProcessor] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
