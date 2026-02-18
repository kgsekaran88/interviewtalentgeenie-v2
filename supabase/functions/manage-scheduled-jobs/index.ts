import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Manage Scheduled Jobs Edge Function
 * 
 * Provides admin interface to manage pg_cron scheduled jobs:
 * - list: List all jobs with metadata
 * - run: Trigger immediate execution of a job
 * - schedule: Update job schedule
 * - status: Enable/disable a job
 * 
 * SECURITY: Requires platform_admin role
 */

// Job descriptions for better UX
const JOB_DESCRIPTIONS: Record<string, { description: string; category: string }> = {
  'cleanup-stale-proctoring': {
    description: 'Closes orphaned interview attempts that are older than 2 hours with ended/missing proctoring sessions',
    category: 'Maintenance',
  },
  'scheduled-data-cleanup-daily': {
    description: 'Deletes old audit logs, email logs, notifications based on retention policies. Also cleans up orphaned chunk files.',
    category: 'Data Retention',
  },
  'enforce-interview-deadlines': {
    description: 'Automatically expires interviews past their deadline and notifies relevant parties',
    category: 'Interview Management',
  },
  'send-invitation-reminders-job': {
    description: 'Sends reminder emails to candidates who have pending interview invitations',
    category: 'Notifications',
  },
};

// Human-readable schedule descriptions
function describeSchedule(cron: string): string {
  const patterns: Record<string, string> = {
    '0 * * * *': 'Every hour (on the hour)',
    '*/30 * * * *': 'Every 30 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '0 3 * * *': 'Daily at 3:00 AM UTC',
    '0 0 * * *': 'Daily at midnight UTC',
    '0 0 * * 0': 'Weekly on Sunday at midnight',
    '0 0 1 * *': 'Monthly on the 1st at midnight',
  };
  return patterns[cron] || `Custom: ${cron}`;
}

// Calculate next run time from cron expression (simplified)
function getNextRun(cron: string): string {
  const now = new Date();
  const parts = cron.split(' ');
  
  if (parts.length !== 5) return 'Unknown';
  
  const [minute, hour] = parts;
  
  // Handle common patterns
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.substring(2), 10);
    const currentMinute = now.getUTCMinutes();
    const nextMinute = Math.ceil(currentMinute / interval) * interval;
    const next = new Date(now);
    next.setUTCMinutes(nextMinute % 60, 0, 0);
    if (nextMinute >= 60) next.setUTCHours(next.getUTCHours() + 1);
    return next.toISOString();
  }
  
  if (minute === '0' && hour !== '*') {
    const targetHour = parseInt(hour, 10);
    const next = new Date(now);
    next.setUTCHours(targetHour, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }
  
  if (minute === '0' && hour === '*') {
    const next = new Date(now);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next.toISOString();
  }
  
  return 'See cron expression';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[manage-scheduled-jobs] Request received:', req.method, req.url);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const jwt = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!jwt) {
      console.error('[manage-scheduled-jobs] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user with the JWT token
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('[manage-scheduled-jobs] Invalid authentication:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manage-scheduled-jobs] Authenticated user:', user.id);

    // Check platform_admin role
    const { data: roles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin')
      .maybeSingle();
    
    if (!roles) {
      console.error('[manage-scheduled-jobs] User is not platform_admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Requires platform_admin role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for action
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine for list action
    }

    const action = (body.action as string) || 'list';
    console.log('[manage-scheduled-jobs] Action:', action, 'User:', user.id);

    // LIST - List all jobs
    if (action === 'list') {
      const { data: jobs, error: jobsError } = await adminClient.rpc('get_cron_jobs');
      
      if (jobsError) {
        console.error('[manage-scheduled-jobs] Error fetching jobs via RPC:', jobsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch jobs', details: jobsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const enrichedJobs = (jobs || []).map((job: Record<string, unknown>) => ({
        ...job,
        description: JOB_DESCRIPTIONS[job.jobname as string]?.description || 'No description available',
        category: JOB_DESCRIPTIONS[job.jobname as string]?.category || 'Other',
        scheduleDescription: describeSchedule(job.schedule as string),
        nextRun: job.active ? getNextRun(job.schedule as string) : null,
      }));

      console.log('[manage-scheduled-jobs] Returning', enrichedJobs.length, 'jobs');

      return new Response(
        JSON.stringify({ jobs: enrichedJobs }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RUN - Run a job immediately
    if (action === 'run') {
      const jobname = body.jobname as string;

      if (!jobname) {
        return new Response(
          JSON.stringify({ error: 'jobname is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-scheduled-jobs] Running job immediately:', jobname);

      // Map job name to edge function
      const functionMap: Record<string, string> = {
        'cleanup-stale-proctoring': 'cleanup-stale-proctoring',
        'scheduled-data-cleanup-daily': 'scheduled-data-cleanup',
        'enforce-interview-deadlines': 'enforce-interview-deadlines',
        'send-invitation-reminders-job': 'send-invitation-reminders',
      };

      const functionName = functionMap[jobname];
      if (!functionName) {
        return new Response(
          JSON.stringify({ error: `Unknown job: ${jobname}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Call the edge function
      const startTime = Date.now();
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/${functionName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({}),
          }
        );

        const result = await response.json();
        const duration = Date.now() - startTime;

        // Log the manual run
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'manual_job_run',
          table_name: 'cron.job',
          record_id: jobname,
          metadata: {
            jobname,
            success: response.ok,
            duration_ms: duration,
            result: response.ok ? result : null,
          },
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: result.error || 'Job execution failed',
              duration_ms: duration,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            result,
            duration_ms: duration,
            message: `Job ${jobname} executed successfully`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('[manage-scheduled-jobs] Error running job:', err);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: err instanceof Error ? err.message : 'Failed to execute job',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // SCHEDULE - Update job schedule
    if (action === 'schedule') {
      const jobname = body.jobname as string;
      const schedule = body.schedule as string;

      if (!jobname || !schedule) {
        return new Response(
          JSON.stringify({ error: 'jobname and schedule are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate cron expression (basic check)
      const cronParts = schedule.split(' ');
      if (cronParts.length !== 5) {
        return new Response(
          JSON.stringify({ error: 'Invalid cron expression. Must have 5 parts: minute hour day month weekday' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-scheduled-jobs] Updating schedule for:', jobname, 'to', schedule);

      // Update the cron job schedule
      const { error: updateError } = await adminClient.rpc('update_cron_schedule', {
        p_jobname: jobname,
        p_schedule: schedule,
      });

      if (updateError) {
        console.error('[manage-scheduled-jobs] Error updating schedule:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update schedule', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the schedule change
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'update_job_schedule',
        table_name: 'cron.job',
        record_id: jobname,
        metadata: { jobname, new_schedule: schedule },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Schedule for ${jobname} updated to: ${schedule}`,
          scheduleDescription: describeSchedule(schedule),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STATUS - Enable/disable job
    if (action === 'status') {
      const jobname = body.jobname as string;
      const active = body.active as boolean;

      if (!jobname || typeof active !== 'boolean') {
        return new Response(
          JSON.stringify({ error: 'jobname and active (boolean) are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[manage-scheduled-jobs] Setting job status:', jobname, active ? 'active' : 'inactive');

      const { error: statusError } = await adminClient.rpc('set_cron_job_status', {
        p_jobname: jobname,
        p_active: active,
      });

      if (statusError) {
        console.error('[manage-scheduled-jobs] Error updating status:', statusError);
        return new Response(
          JSON.stringify({ error: 'Failed to update job status', details: statusError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the status change
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: active ? 'enable_job' : 'disable_job',
        table_name: 'cron.job',
        record_id: jobname,
        metadata: { jobname, active },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Job ${jobname} ${active ? 'enabled' : 'disabled'}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Invalid action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[manage-scheduled-jobs] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
