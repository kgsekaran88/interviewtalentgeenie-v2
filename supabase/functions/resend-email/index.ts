import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { user, supabase, error: authError } = await authenticateRequest(
      authHeader,
      ['platform_admin', 'partner_admin', 'hr_recruiter']
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { emailLogId } = await req.json();

    if (!emailLogId) {
      return new Response(
        JSON.stringify({ error: 'emailLogId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the original email log
    const { data: emailLog, error: fetchError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', emailLogId)
      .single();

    if (fetchError || !emailLog) {
      return new Response(
        JSON.stringify({ error: 'Email log not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resending email: template=${emailLog.template}, to=${emailLog.recipient_email}`);

    // Import the send email function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Resend the email using the unified send-email function
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template: emailLog.template,
        to: emailLog.recipient_email,
        data: emailLog.metadata || {},
        organization_id: emailLog.organization_id,
      }),
    });

    const result = await response.json();

    if (result.sent) {
      // Update the original log with resend info
      await supabase
        .from('email_logs')
        .update({
          resend_count: (emailLog.resend_count || 0) + 1,
          last_resend_at: new Date().toISOString(),
        })
        .eq('id', emailLogId);

      console.log(`Email resent successfully to ${emailLog.recipient_email}`);
    }

    return new Response(
      JSON.stringify({
        success: result.sent,
        messageId: result.messageId,
        error: result.error,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in resend-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
