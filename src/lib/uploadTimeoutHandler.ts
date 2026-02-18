/**
 * Upload Timeout Handler
 * 
 * Detects and handles stuck uploads by:
 * 1. Marking uploads as failed after a timeout
 * 2. Providing recovery mechanisms
 * 3. Notifying users of issues
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Upload timeout thresholds
const UPLOAD_STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes - if started but not completed

/**
 * Check for and handle stuck uploads for a specific session
 */
export async function checkAndHandleStuckUpload(sessionId: string): Promise<{
  wasStuck: boolean;
  action: 'none' | 'marked_failed' | 'still_uploading';
}> {
  try {
    const { data: session, error } = await supabase
      .from('proctoring_sessions')
      .select('upload_status, upload_started_at, upload_completed_at, video_recording_url, screen_recording_url')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      logger.error('[UploadTimeoutHandler] Could not fetch session:', error);
      return { wasStuck: false, action: 'none' };
    }

    // Check if upload is stuck
    if (session.upload_status === 'uploading' && session.upload_started_at) {
      const startedAt = new Date(session.upload_started_at).getTime();
      const now = Date.now();
      const elapsed = now - startedAt;

      if (elapsed > UPLOAD_STUCK_THRESHOLD_MS) {
        logger.warn(`[UploadTimeoutHandler] Upload stuck for ${Math.round(elapsed / 60000)} minutes, marking as failed`);
        
        // Mark as failed
        await supabase
          .from('proctoring_sessions')
          .update({
            upload_status: 'failed',
            upload_error: `Upload timed out after ${Math.round(elapsed / 60000)} minutes`,
            upload_completed_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        return { wasStuck: true, action: 'marked_failed' };
      }

      // Still within timeout window
      return { wasStuck: false, action: 'still_uploading' };
    }

    return { wasStuck: false, action: 'none' };
  } catch (error) {
    logger.error('[UploadTimeoutHandler] Error checking upload status:', error);
    return { wasStuck: false, action: 'none' };
  }
}

/**
 * Get all stuck uploads across the system (for admin dashboard)
 */
export async function getStuckUploads(): Promise<Array<{
  sessionId: string;
  attemptId: string;
  candidateEmail: string;
  stuckSince: Date;
  elapsedMinutes: number;
}>> {
  try {
    const thresholdTime = new Date(Date.now() - UPLOAD_STUCK_THRESHOLD_MS).toISOString();
    
    const { data, error } = await supabase
      .from('proctoring_sessions')
      .select(`
        id,
        interview_attempt_id,
        upload_started_at
      `)
      .eq('upload_status', 'uploading')
      .lt('upload_started_at', thresholdTime);

    if (error || !data) {
      logger.error('[UploadTimeoutHandler] Error fetching stuck uploads:', error);
      return [];
    }

    // Get attempt details for each stuck session
    const results = await Promise.all(
      data.map(async (session) => {
        const { data: attempt } = await supabase
          .from('interview_attempts')
          .select('candidate_email')
          .eq('id', session.interview_attempt_id)
          .single();

        const startedAt = new Date(session.upload_started_at);
        
        return {
          sessionId: session.id,
          attemptId: session.interview_attempt_id,
          candidateEmail: attempt?.candidate_email || 'Unknown',
          stuckSince: startedAt,
          elapsedMinutes: Math.round((Date.now() - startedAt.getTime()) / 60000)
        };
      })
    );

    return results;
  } catch (error) {
    logger.error('[UploadTimeoutHandler] Error getting stuck uploads:', error);
    return [];
  }
}

/**
 * Batch fix all stuck uploads (mark as failed)
 */
export async function fixAllStuckUploads(): Promise<number> {
  try {
    const thresholdTime = new Date(Date.now() - UPLOAD_STUCK_THRESHOLD_MS).toISOString();
    
    const { data, error } = await supabase
      .from('proctoring_sessions')
      .update({
        upload_status: 'failed',
        upload_error: 'Upload timed out - marked as failed by system',
        upload_completed_at: new Date().toISOString()
      })
      .eq('upload_status', 'uploading')
      .lt('upload_started_at', thresholdTime)
      .select('id');

    if (error) {
      logger.error('[UploadTimeoutHandler] Error fixing stuck uploads:', error);
      return 0;
    }

    const fixedCount = data?.length || 0;
    logger.proctoring(`[UploadTimeoutHandler] Fixed ${fixedCount} stuck uploads`);
    
    return fixedCount;
  } catch (error) {
    logger.error('[UploadTimeoutHandler] Error in batch fix:', error);
    return 0;
  }
}
