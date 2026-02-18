import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const logger = createLogger('schedule-interview');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Interview scheduling request started');
    
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter']);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, supabase } = authResult;
    logger.info('User authenticated for scheduling', { userId: user.id });

    const {
      interview_id,
      candidate_email,
      candidate_name,
      scheduled_start,
      scheduled_end,
      timezone,
      meeting_link,
      notes
    } = await req.json();

    logger.info('Scheduling interview', { interview_id, candidate_email, scheduled_start });

    // Validate interview exists
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('id, title, share_link')
      .eq('id', interview_id)
      .single();

    if (interviewError || !interview) {
      logger.error('Interview not found', interviewError, { interview_id });
      throw new Error('Interview not found');
    }

    // Create schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('interview_schedules')
      .insert({
        interview_id,
        candidate_email,
        candidate_name,
        scheduled_start,
        scheduled_end,
        timezone: timezone || 'UTC',
        meeting_link,
        notes,
        created_by: user.id,
        status: 'scheduled'
      })
      .select()
      .single();

    if (scheduleError) {
      logger.error('Failed to create schedule', scheduleError, { interview_id });
      throw scheduleError;
    }

    logger.info('Interview scheduled successfully', { scheduleId: schedule.id });

    // Send calendar invitation email (simulated)
    const emailContent = `
Dear ${candidate_name},

You have been scheduled for an interview: ${interview.title}

Details:
- Date & Time: ${new Date(scheduled_start).toLocaleString('en-US', { timeZone: timezone })}
- Duration: ${Math.round((new Date(scheduled_end).getTime() - new Date(scheduled_start).getTime()) / 60000)} minutes
- Timezone: ${timezone}
${meeting_link ? `- Meeting Link: ${meeting_link}` : ''}

Interview Link: ${interview.share_link}

${notes ? `\nAdditional Notes:\n${notes}` : ''}

Good luck!
`;

    logger.info('Email notification prepared', { candidate_email, subject: `Interview Scheduled: ${interview.title}` });

    // Log activity
    await supabase
      .from('activity_feed')
      .insert({
        organization_id: null, // Would need to fetch from interview
        actor_id: user.id,
        action: 'scheduled',
        entity_type: 'interview',
        entity_id: interview_id,
        metadata: {
          candidate_email,
          candidate_name,
          scheduled_start,
          schedule_id: schedule.id
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        schedule,
        message: 'Interview scheduled successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const logger = createLogger('schedule-interview');
    logger.error('Fatal error in schedule-interview', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});