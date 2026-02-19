import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  const logger = createLogger('send-notification');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Notification send request started');
    
    const authHeader = req.headers.get('Authorization');
    // Roles: partner_admin, hr_recruiter, tech_spoc can send notifications
    const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter', 'tech_spoc']);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, supabase } = authResult;
    logger.info('User authenticated for sending notification', { userId: user.id });

    const { 
      userId, 
      organizationId,
      type, 
      title, 
      message, 
      link,
      metadata = {}
    } = await req.json();

    if (!userId || !type || !title || !message) {
      logger.warn('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'userId, type, title, and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate notification type
    const validTypes = ['interview_status', 'candidate_submission', 'system_alert', 'proctoring_alert', 'report_ready'];
    if (!validTypes.includes(type)) {
      logger.warn('Invalid notification type', { type });
      return new Response(
        JSON.stringify({ error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Creating notification', { userId, type, title });

    // Create notification using database function
    const { data: notificationId, error: createError } = await supabase
      .rpc('create_notification', {
        p_user_id: userId,
        p_organization_id: organizationId || null,
        p_type: type,
        p_title: title,
        p_message: message,
        p_link: link || null,
        p_metadata: metadata
      });

    if (createError) {
      logger.error('Failed to create notification', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Notification created successfully', { notificationId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationId,
        message: 'Notification sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const logger = createLogger('send-notification');
    logger.error('Fatal error in send-notification', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});