import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


/**
 * Automatic Interview Invitation Reminder System
 * 
 * This function runs on a schedule to:
 * 1. Find pending invitations older than 24 hours with email_sent=true
 * 2. Check if it's ~6:00 PM in the candidate's timezone
 * 3. Send reminder emails (max 3 per candidate)
 * 4. After 3 reminders, mark as expired and notify recruiter
 * 
 * Runs every 30 minutes to catch 6 PM in different timezones
 */

const MAX_REMINDERS = 3;
const MIN_HOURS_SINCE_INVITE = 24; // Wait at least 24 hours before first reminder
const MIN_HOURS_BETWEEN_REMINDERS = 24; // Wait at least 24 hours between reminders

// Check if current time is within the 6 PM window (5:30 PM - 6:30 PM) for a given timezone
function isInReminderWindow(timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    // 6 PM window: 17:30 to 18:30
    const totalMinutes = hour * 60 + minute;
    return totalMinutes >= 17 * 60 + 30 && totalMinutes <= 18 * 60 + 30;
  } catch (error) {
    console.warn(`Invalid timezone ${timezone}, using UTC`);
    return false;
  }
}

// Get current hour in a timezone
function getCurrentHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    return parseInt(formatter.format(new Date()));
  } catch {
    return new Date().getUTCHours();
  }
}

async function getFrontendUrl(supabase: any): Promise<string> {
  const envUrl = Deno.env.get('FRONTEND_URL');
  if (envUrl) return envUrl;
  
  try {
    const { data } = await supabase
      .from('platform_configurations')
      .select('value')
      .eq('key', 'frontend_base_url')
      .single();
    
    if (data?.value) return data.value;
  } catch (error) {
    console.warn('Could not fetch frontend_base_url:', error);
  }
  
  return Deno.env.get('FRONTEND_URL') || 'https://app.interviewtalentgeenie.com';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[send-invitation-reminders] Starting reminder check...');

    const results = {
      checked: 0,
      reminders_sent: 0,
      expired: 0,
      hr_notified: 0,
      skipped_timezone: 0,
      errors: [] as string[]
    };

    // Calculate the cutoff time (24 hours ago)
    const cutoffTime = new Date(Date.now() - MIN_HOURS_SINCE_INVITE * 60 * 60 * 1000).toISOString();
    const reminderCutoffTime = new Date(Date.now() - MIN_HOURS_BETWEEN_REMINDERS * 60 * 60 * 1000).toISOString();

    // Find pending invitations that are eligible for reminders
    // IMPORTANT: Only send reminders for interviews that are still ACTIVE
    const { data: pendingInvitations, error: fetchError } = await supabase
      .from('interview_invitations')
      .select(`
        id,
        candidate_email,
        candidate_name,
        first_name,
        last_name,
        share_token,
        reminder_count,
        last_reminder_at,
        candidate_timezone,
        created_at,
        expires_at,
        email_sent_at,
        sent_by,
        metadata,
        interview:interviews!inner(
          id,
          title,
          slug,
          time_limit,
          question_count,
          status,
          organization:organizations(
            id,
            name,
            slug
          )
        )
      `)
      .eq('status', 'pending')
      .eq('email_sent', true)
      .eq('interviews.status', 'active') // Only for active interviews
      .is('deleted_at', null)
      .is('max_reminders_reached', false)
      .lt('reminder_count', MAX_REMINDERS)
      .lt('created_at', cutoffTime)
      .order('created_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('[send-invitation-reminders] Error fetching invitations:', fetchError);
      throw fetchError;
    }

    if (!pendingInvitations || pendingInvitations.length === 0) {
      console.log('[send-invitation-reminders] No pending invitations to process');
      return new Response(
        JSON.stringify({ 
          message: 'No pending invitations to process',
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-invitation-reminders] Found ${pendingInvitations.length} pending invitations`);
    results.checked = pendingInvitations.length;

    const frontendUrl = await getFrontendUrl(supabase);

    for (const invitation of pendingInvitations) {
      try {
        const interview = invitation.interview as any;
        
        // Double-check interview is still active (belt and suspenders)
        if (interview?.status !== 'active') {
          console.log(`[send-invitation-reminders] Skipping ${invitation.id} - interview not active (${interview?.status})`);
          continue;
        }

        // Check if invitation has expired
        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
          console.log(`[send-invitation-reminders] Skipping ${invitation.id} - invitation expired at ${invitation.expires_at}`);
          // Auto-expire the invitation
          await supabase
            .from('interview_invitations')
            .update({
              status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('id', invitation.id);
          results.expired++;
          continue;
        }

        // Skip if last reminder was less than 24 hours ago
        if (invitation.last_reminder_at && new Date(invitation.last_reminder_at) > new Date(reminderCutoffTime)) {
          console.log(`[send-invitation-reminders] Skipping ${invitation.id} - last reminder too recent`);
          continue;
        }

        // Check timezone window (default to UTC+5:30 for IST if not set)
        const timezone = invitation.candidate_timezone || 'Asia/Kolkata';
        
        // Check if it's in the 6 PM window for this timezone
        if (!isInReminderWindow(timezone)) {
          console.log(`[send-invitation-reminders] Skipping ${invitation.id} - not in 6 PM window for ${timezone}`);
          results.skipped_timezone++;
          continue;
        }

        const newReminderCount = (invitation.reminder_count || 0) + 1;
        const organization = interview?.organization as any;

        // Build share link
        const orgSlug = organization?.slug || 'interview';
        const interviewSlug = interview?.slug || interview?.id;
        const shareLink = `${frontendUrl}/i/${orgSlug}/${interviewSlug}/${invitation.share_token}`;

        // Get candidate display name
        const candidateName = invitation.first_name 
          ? `${invitation.first_name}${invitation.last_name ? ' ' + invitation.last_name : ''}`
          : invitation.candidate_name || invitation.candidate_email.split('@')[0];

        // Send reminder email using the same interview_invitation template with is_reminder flag
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            template: 'interview_reminder',
            to: invitation.candidate_email,
            cc: invitation.metadata?.cc_emails || undefined,
            data: {
              candidate_name: candidateName,
              interview_title: interview?.title || 'Interview',
              organization_name: organization?.name || 'TalentGeenie',
              question_count: interview?.question_count || 10,
              time_limit: interview?.time_limit || 60,
              share_link: shareLink,
              reminder_number: newReminderCount
            }
          }),
        });

        const emailResult = await emailResponse.json();

        if (emailResult.sent) {
          console.log(`[send-invitation-reminders] Sent reminder ${newReminderCount} to ${invitation.candidate_email}`);
          
          // Update invitation with new reminder count
          await supabase
            .from('interview_invitations')
            .update({
              reminder_count: newReminderCount,
              last_reminder_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', invitation.id);

          results.reminders_sent++;

          // Check if this was the last reminder
          if (newReminderCount >= MAX_REMINDERS) {
            console.log(`[send-invitation-reminders] Max reminders reached for ${invitation.id}`);
            
            // Mark as expired
            await supabase
              .from('interview_invitations')
              .update({
                status: 'expired',
                max_reminders_reached: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', invitation.id);

            results.expired++;

            // Notify the HR who sent invite + all partner admins
            const usersToNotify = new Set<string>();
            
            if (invitation.sent_by) {
              usersToNotify.add(invitation.sent_by);
            }

            // Get all partner admins for this organization
            if (organization?.id) {
              const { data: orgMembers } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', organization.id)
                .eq('role', 'partner_admin');
              
              orgMembers?.forEach((m: { user_id: string }) => usersToNotify.add(m.user_id));
            }

            if (usersToNotify.size > 0) {
              // Get profiles for all users to notify
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, full_name')
                .in('id', Array.from(usersToNotify));

              // Send emails to all relevant users
              for (const profile of (profiles || [])) {
                if (profile.email) {
                  await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      template: 'candidate_unresponsive',
                      to: profile.email,
                      data: {
                        recruiter_name: profile.full_name || 'there',
                        candidate_name: candidateName,
                        candidate_email: invitation.candidate_email,
                        interview_title: interview?.title || 'Interview',
                        invitation_date: new Date(invitation.created_at).toLocaleDateString(),
                        last_reminder_date: new Date().toLocaleDateString(),
                        dashboard_url: `${frontendUrl}/partner/recruiting/dashboard`
                      }
                    }),
                  });

                  console.log(`[send-invitation-reminders] Notified ${profile.email} about unresponsive candidate`);
                  results.hr_notified++;
                }
              }
            }
          }
        } else {
          console.error(`[send-invitation-reminders] Failed to send reminder to ${invitation.candidate_email}:`, emailResult.error);
          results.errors.push(`Failed to send to ${invitation.candidate_email}: ${emailResult.error}`);
        }
      } catch (invError: any) {
        console.error(`[send-invitation-reminders] Error processing invitation ${invitation.id}:`, invError);
        results.errors.push(`Error for ${invitation.id}: ${invError.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[send-invitation-reminders] Completed in ${duration}ms:`, results);

    return new Response(
      JSON.stringify({ 
        success: true,
        duration_ms: duration,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-invitation-reminders] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
