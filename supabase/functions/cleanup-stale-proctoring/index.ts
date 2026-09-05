import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { authorizeWorkerRequest } from '../_shared/auth-utils.ts';


/**
 * Cleanup Stale Proctoring Sessions
 * 
 * This function runs on a schedule (every hour) to:
 * 1. Find proctoring sessions that are still active but their interview has ended
 * 2. Find proctoring sessions with no activity for > 30 minutes
 * 3. End these sessions and update integrity scores
 * 4. Mark corresponding interview_attempts as 'abandoned' when sessions are closed due to inactivity
 * 5. Fix orphaned attempts that are stuck in 'in_progress', 'pending_upload', or 'pending' status
 * 
 * This ensures proctoring sessions don't run indefinitely after interview completion
 * or abandonment.
 */

// Configurable timeouts (in milliseconds)
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes - no updates triggers cleanup
const MAX_SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours - absolute maximum session duration
const ORPHAN_ATTEMPT_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours - attempts stuck without proctoring session

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authorizeWorkerRequest(req, ['platform_admin']);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const startTime = Date.now();
  console.log('[cleanup-stale-proctoring] Starting stale proctoring session cleanup...');

  try {
    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      processed: 0,
      interviewEnded: 0,
      inactive: 0,
      orphanedAttempts: 0,
      failed: 0,
      details: [] as any[]
    };

    // =========================================================================
    // Case 1: Find proctoring sessions where the interview attempt has ended
    // but the proctoring session is still active (no ended_at)
    // =========================================================================
    console.log('[cleanup-stale-proctoring] Finding sessions with ended interviews...');
    
    const { data: sessionsWithEndedInterviews, error: endedError } = await supabase
      .from('proctoring_sessions')
      .select(`
        id,
        interview_attempt_id,
        learning_attempt_id,
        certification_attempt_id,
        created_at,
        updated_at
      `)
      .is('ended_at', null);

    if (endedError) {
      console.error('[cleanup-stale-proctoring] Error fetching sessions:', endedError);
    } else if (sessionsWithEndedInterviews && sessionsWithEndedInterviews.length > 0) {
      console.log(`[cleanup-stale-proctoring] Found ${sessionsWithEndedInterviews.length} active proctoring sessions to check`);
      
      for (const session of sessionsWithEndedInterviews) {
        try {
          let shouldEnd = false;
          let endReason = '';
          let isInactivity = false;

          // Check interview attempts
          if (session.interview_attempt_id) {
            const { data: attempt } = await supabase
              .from('interview_attempts')
              .select('status, submitted_at')
              .eq('id', session.interview_attempt_id)
              .single();

            if (attempt && ['submitted', 'auto_submitted', 'evaluated', 'completed', 'expired', 'terminated'].includes(attempt.status)) {
              shouldEnd = true;
              endReason = `Interview attempt ${attempt.status}`;
            }
          }

          // Check learning attempts
          if (session.learning_attempt_id && !shouldEnd) {
            const { data: attempt } = await supabase
              .from('learning_assessment_attempts')
              .select('status, submitted_at')
              .eq('id', session.learning_attempt_id)
              .single();

            if (attempt && ['submitted', 'completed', 'expired'].includes(attempt.status)) {
              shouldEnd = true;
              endReason = `Learning attempt ${attempt.status}`;
            }
          }

          // Check certification attempts
          if (session.certification_attempt_id && !shouldEnd) {
            const { data: attempt } = await supabase
              .from('certification_attempts')
              .select('status, submitted_at')
              .eq('id', session.certification_attempt_id)
              .single();

            if (attempt && ['submitted', 'completed', 'expired'].includes(attempt.status)) {
              shouldEnd = true;
              endReason = `Certification attempt ${attempt.status}`;
            }
          }

          // Check for inactivity (no updates for > 30 minutes)
          if (!shouldEnd && session.updated_at) {
            const lastUpdate = new Date(session.updated_at);
            const inactivityThreshold = new Date(Date.now() - INACTIVITY_TIMEOUT_MS);
            
            if (lastUpdate < inactivityThreshold) {
              shouldEnd = true;
              isInactivity = true;
              const inactiveMinutes = Math.round((Date.now() - lastUpdate.getTime()) / 60000);
              endReason = `Inactive for ${inactiveMinutes} minutes (last update: ${session.updated_at})`;
            }
          }

          if (shouldEnd) {
            console.log(`[cleanup-stale-proctoring] Ending session ${session.id}: ${endReason}`);
            
            // Update proctoring session
            const { error: updateError } = await supabase
              .from('proctoring_sessions')
              .update({
                ended_at: new Date().toISOString(),
                reviewer_notes: `Session auto-ended: ${endReason}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', session.id);

            if (updateError) {
              console.error(`[cleanup-stale-proctoring] Failed to end session ${session.id}:`, updateError);
              results.failed++;
            } else {
              // *** FIX: Also update interview_attempts status to 'abandoned' for inactive sessions ***
              if (isInactivity && session.interview_attempt_id) {
                const { error: attemptUpdateError } = await supabase
                  .from('interview_attempts')
                  .update({ 
                    status: 'abandoned',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', session.interview_attempt_id)
                  .in('status', ['in_progress', 'pending', 'pending_upload']); // Only update if still in these states

                if (attemptUpdateError) {
                  console.error(`[cleanup-stale-proctoring] Failed to mark attempt as abandoned:`, attemptUpdateError);
                } else {
                  console.log(`[cleanup-stale-proctoring] Marked interview attempt ${session.interview_attempt_id} as abandoned`);
                }
              }

              results.processed++;
              if (endReason.includes('attempt') && !isInactivity) {
                results.interviewEnded++;
              } else {
                results.inactive++;
              }
              results.details.push({
                session_id: session.id,
                attempt_id: session.interview_attempt_id,
                reason: endReason,
                marked_abandoned: isInactivity
              });
            }
          }
        } catch (sessionError: any) {
          console.error(`[cleanup-stale-proctoring] Error processing session ${session.id}:`, sessionError);
          results.failed++;
        }
      }
    }

    // =========================================================================
    // Case 2: Find sessions created > 4 hours ago that are still active
    // (safety net for edge cases)
    // =========================================================================
    const maxDurationThreshold = new Date(Date.now() - MAX_SESSION_DURATION_MS).toISOString();
    
    const { data: veryOldSessions, error: oldError } = await supabase
      .from('proctoring_sessions')
      .select('id, interview_attempt_id, created_at')
      .is('ended_at', null)
      .lt('created_at', maxDurationThreshold);

    if (oldError) {
      console.error('[cleanup-stale-proctoring] Error fetching old sessions:', oldError);
    } else if (veryOldSessions && veryOldSessions.length > 0) {
      const maxHours = MAX_SESSION_DURATION_MS / (60 * 60 * 1000);
      console.log(`[cleanup-stale-proctoring] Found ${veryOldSessions.length} very old sessions (>${maxHours} hours)`);
      
      for (const session of veryOldSessions) {
        try {
          const { error: updateError } = await supabase
            .from('proctoring_sessions')
            .update({
              ended_at: new Date().toISOString(),
              reviewer_notes: `Session auto-ended: Active for >${maxHours} hours (created: ${session.created_at})`,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`[cleanup-stale-proctoring] Failed to end old session ${session.id}:`, updateError);
            results.failed++;
          } else {
            // *** FIX: Also update interview_attempts status to 'abandoned' ***
            if (session.interview_attempt_id) {
              const { error: attemptUpdateError } = await supabase
                .from('interview_attempts')
                .update({ 
                  status: 'abandoned',
                  updated_at: new Date().toISOString()
                })
                .eq('id', session.interview_attempt_id)
                .in('status', ['in_progress', 'pending', 'pending_upload']);

              if (attemptUpdateError) {
                console.error(`[cleanup-stale-proctoring] Failed to mark old attempt as abandoned:`, attemptUpdateError);
              } else {
                console.log(`[cleanup-stale-proctoring] Marked old interview attempt ${session.interview_attempt_id} as abandoned`);
              }
            }

            results.processed++;
            results.inactive++;
            results.details.push({
              session_id: session.id,
              attempt_id: session.interview_attempt_id,
              reason: `Very old session (>${maxHours} hours)`,
              marked_abandoned: true
            });
          }
        } catch (sessionError: any) {
          console.error(`[cleanup-stale-proctoring] Error processing old session ${session.id}:`, sessionError);
          results.failed++;
        }
      }
    }

    // =========================================================================
    // Case 3: Find orphaned interview_attempts that are stuck
    // These are attempts with proctoring sessions that have ended but the attempt
    // status was never updated (fixing historical data and edge cases)
    // 
    // FIX: Use separate queries instead of complex PostgREST filter on joined table
    // =========================================================================
    console.log('[cleanup-stale-proctoring] Checking for orphaned interview attempts...');
    
    const orphanThreshold = new Date(Date.now() - ORPHAN_ATTEMPT_TIMEOUT_MS).toISOString();
    
    // Step 1: Get all in_progress/pending attempts older than threshold
    const { data: stuckAttempts, error: stuckError } = await supabase
      .from('interview_attempts')
      .select('id, status, started_at, created_at')
      .in('status', ['in_progress', 'pending', 'pending_upload'])
      .lt('created_at', orphanThreshold);

    if (stuckError) {
      console.error('[cleanup-stale-proctoring] Error fetching stuck attempts:', stuckError);
    } else if (stuckAttempts && stuckAttempts.length > 0) {
      console.log(`[cleanup-stale-proctoring] Found ${stuckAttempts.length} stuck attempts to check`);
      
      for (const attempt of stuckAttempts) {
        try {
          // Step 2: Check if this attempt has a proctoring session that has ended
          const { data: sessions } = await supabase
            .from('proctoring_sessions')
            .select('id, ended_at')
            .eq('interview_attempt_id', attempt.id);

          const hasEndedSession = sessions && sessions.some(s => s.ended_at !== null);
          const hasNoSession = !sessions || sessions.length === 0;
          
          // Mark as abandoned if: session ended OR no session exists (for very old attempts)
          if (hasEndedSession || hasNoSession) {
            const reason = hasEndedSession 
              ? 'Orphaned attempt - proctoring session ended but status not updated'
              : 'Orphaned attempt - no proctoring session found (never started)';
            
            const { error: updateError } = await supabase
              .from('interview_attempts')
              .update({ 
                status: 'abandoned',
                updated_at: new Date().toISOString()
              })
              .eq('id', attempt.id);

            if (updateError) {
              console.error(`[cleanup-stale-proctoring] Failed to fix orphaned attempt ${attempt.id}:`, updateError);
              results.failed++;
            } else {
              results.orphanedAttempts++;
              results.details.push({
                attempt_id: attempt.id,
                previous_status: attempt.status,
                reason,
                had_session: !hasNoSession
              });
              console.log(`[cleanup-stale-proctoring] Fixed orphaned attempt ${attempt.id} (was: ${attempt.status}) - ${reason}`);
            }
          }
        } catch (attemptError: any) {
          console.error(`[cleanup-stale-proctoring] Error processing stuck attempt ${attempt.id}:`, attemptError);
          results.failed++;
        }
      }
    }

    // =========================================================================
    // Case 4: Find attempts stuck in pending_upload with failed uploads
    // If upload_status is 'failed' and session ended > 2 hours ago, mark as abandoned
    // =========================================================================
    console.log('[cleanup-stale-proctoring] Checking for failed upload attempts...');
    
    const { data: failedUploadAttempts, error: failedUploadError } = await supabase
      .from('interview_attempts')
      .select(`
        id,
        status,
        proctoring_sessions!inner (
          id,
          ended_at,
          upload_status
        )
      `)
      .in('status', ['pending_upload', 'pending'])
      .eq('proctoring_sessions.upload_status', 'failed')
      .lt('proctoring_sessions.ended_at', orphanThreshold);

    if (failedUploadError) {
      console.error('[cleanup-stale-proctoring] Error fetching failed upload attempts:', failedUploadError);
    } else if (failedUploadAttempts && failedUploadAttempts.length > 0) {
      console.log(`[cleanup-stale-proctoring] Found ${failedUploadAttempts.length} failed upload attempts to fix`);
      
      for (const attempt of failedUploadAttempts) {
        try {
          const { error: updateError } = await supabase
            .from('interview_attempts')
            .update({ 
              status: 'abandoned',
              updated_at: new Date().toISOString()
            })
            .eq('id', attempt.id);

          if (updateError) {
            console.error(`[cleanup-stale-proctoring] Failed to fix failed upload attempt ${attempt.id}:`, updateError);
            results.failed++;
          } else {
            results.orphanedAttempts++;
            results.details.push({
              attempt_id: attempt.id,
              previous_status: attempt.status,
              reason: 'Upload failed and session ended - marked as abandoned'
            });
            console.log(`[cleanup-stale-proctoring] Fixed failed upload attempt ${attempt.id}`);
          }
        } catch (attemptError: any) {
          console.error(`[cleanup-stale-proctoring] Error fixing failed upload attempt ${attempt.id}:`, attemptError);
          results.failed++;
        }
      }
    }

    // =========================================================================
    // Case 5: PENDING MERGE RECOVERY
    // Find sessions stuck in 'uploading' or 'pending_merge' status where chunks
    // may exist in storage but the merge was never triggered (browser closed).
    // Attempt to automatically merge these recordings.
    // =========================================================================
    console.log('[cleanup-stale-proctoring] Checking for pending merge recovery...');
    
    const pendingMergeThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    
    const { data: pendingMergeSessions, error: pendingMergeError } = await supabase
      .from('proctoring_sessions')
      .select('id, interview_attempt_id, upload_status, video_recording_url, screen_recording_url, updated_at')
      .in('upload_status', ['uploading', 'pending_merge', 'pending'])
      .lt('updated_at', pendingMergeThreshold)
      .not('ended_at', 'is', null); // Only sessions that have ended
    
    if (pendingMergeError) {
      console.error('[cleanup-stale-proctoring] Error fetching pending merge sessions:', pendingMergeError);
    } else if (pendingMergeSessions && pendingMergeSessions.length > 0) {
      console.log(`[cleanup-stale-proctoring] Found ${pendingMergeSessions.length} sessions needing merge recovery`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      for (const session of pendingMergeSessions) {
        try {
          // Check if chunks exist in storage for this session
          const { data: videoChunks } = await supabase.storage
            .from('proctoring-recordings')
            .list(`${session.id}/video`);
          
          const { data: screenChunks } = await supabase.storage
            .from('proctoring-recordings')
            .list(`${session.id}/screen`);
          
          const videoPartFiles = (videoChunks || []).filter(f => f.name.endsWith('.part'));
          const screenPartFiles = (screenChunks || []).filter(f => f.name.endsWith('.part'));
          
          const hasVideoChunks = videoPartFiles.length > 0;
          const hasScreenChunks = screenPartFiles.length > 0;
          const needsVideoMerge = hasVideoChunks && !session.video_recording_url;
          const needsScreenMerge = hasScreenChunks && !session.screen_recording_url;
          
          if (!needsVideoMerge && !needsScreenMerge) {
            // No chunks to merge - mark as failed
            console.log(`[cleanup-stale-proctoring] Session ${session.id}: No chunks found, marking as failed`);
            await supabase
              .from('proctoring_sessions')
              .update({ 
                upload_status: 'failed',
                upload_error: 'No recording chunks found in storage',
                updated_at: new Date().toISOString()
              })
              .eq('id', session.id);
            results.failed++;
            continue;
          }
          
          console.log(`[cleanup-stale-proctoring] Session ${session.id}: Triggering merge recovery (video: ${videoPartFiles.length} chunks, screen: ${screenPartFiles.length} chunks)`);
          
          // Mark as pending_merge to prevent duplicate processing
          await supabase
            .from('proctoring_sessions')
            .update({ 
              upload_status: 'pending_merge',
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);
          
          // Trigger merge for each recording type
          const mergePromises: Promise<void>[] = [];
          
          if (needsVideoMerge) {
            mergePromises.push((async () => {
              const response = await fetch(`${supabaseUrl}/functions/v1/merge-proctoring-chunks`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  sessionId: session.id,
                  recordingType: 'video',
                  attemptId: session.interview_attempt_id,
                }),
              });
              if (!response.ok) {
                const error = await response.text();
                console.error(`[cleanup-stale-proctoring] Video merge failed for ${session.id}:`, error);
              } else {
                console.log(`[cleanup-stale-proctoring] Video merge succeeded for ${session.id}`);
              }
            })());
          }
          
          if (needsScreenMerge) {
            mergePromises.push((async () => {
              const response = await fetch(`${supabaseUrl}/functions/v1/merge-proctoring-chunks`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  sessionId: session.id,
                  recordingType: 'screen',
                  attemptId: session.interview_attempt_id,
                }),
              });
              if (!response.ok) {
                const error = await response.text();
                console.error(`[cleanup-stale-proctoring] Screen merge failed for ${session.id}:`, error);
              } else {
                console.log(`[cleanup-stale-proctoring] Screen merge succeeded for ${session.id}`);
              }
            })());
          }
          
          // Wait for merges (with timeout)
          await Promise.race([
            Promise.all(mergePromises),
            new Promise(resolve => setTimeout(resolve, 120000)) // 2 min timeout
          ]);
          
          results.processed++;
          results.details.push({
            session_id: session.id,
            reason: 'Pending merge recovery triggered',
            video_chunks: videoPartFiles.length,
            screen_chunks: screenPartFiles.length
          });
          
        } catch (mergeError: any) {
          console.error(`[cleanup-stale-proctoring] Error recovering session ${session.id}:`, mergeError);
          results.failed++;
          
          // Mark as failed so we don't retry indefinitely
          await supabase
            .from('proctoring_sessions')
            .update({ 
              upload_status: 'failed',
              upload_error: `Recovery failed: ${mergeError.message}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[cleanup-stale-proctoring] Completed. Processed: ${results.processed}, Interview-ended: ${results.interviewEnded}, Inactive: ${results.inactive}, Orphaned: ${results.orphanedAttempts}, Failed: ${results.failed}, Duration: ${totalDuration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        duration_ms: totalDuration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[cleanup-stale-proctoring] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
