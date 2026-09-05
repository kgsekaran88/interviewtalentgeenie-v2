import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type OperationType = 
  | 'submission'
  | 'evaluation' 
  | 'video_upload'
  | 'screen_upload'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'session_resumed'
  | 'proctoring_started'
  | 'proctoring_ended'
  | 'video_analysis'
  | 'question_generation'
  | 'question_regeneration'
  | 'pre_interview_check';

export type OperationStatus = 'started' | 'completed' | 'failed';

interface LogOperationParams {
  operation: OperationType;
  interviewId?: string;
  attemptId?: string;
  invitationId?: string;
  sessionId?: string;
  candidateEmail?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface UpdateOperationParams {
  logId: string;
  status: OperationStatus;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Start logging an operation - returns the log ID for later updates
 */
export async function startOperation(params: LogOperationParams): Promise<string | null> {
  try {
    // Client-generated id avoids INSERT...RETURNING failing under restrictive SELECT RLS.
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const { error } = await supabase
      .from('interview_operation_logs')
      .insert({
        id,
        operation: params.operation,
        status: 'started',
        interview_id: params.interviewId || null,
        attempt_id: params.attemptId || null,
        invitation_id: params.invitationId || null,
        session_id: params.sessionId || null,
        candidate_email: params.candidateEmail || null,
        user_id: params.userId || null,
        metadata: { ...(params.metadata || {}), _started_at_client: startedAt },
        started_at: startedAt,
      });

    if (error) {
      logger.error('[OperationLogger] Failed to start operation:', error);
      return null;
    }

    logger.debug(`[OperationLogger] Started ${params.operation}:`, id);
    return id;
  } catch (err) {
    logger.error('[OperationLogger] Error starting operation:', err);
    return null;
  }
}

/**
 * Complete an operation (success or failure)
 */
export async function completeOperation(params: UpdateOperationParams): Promise<void> {
  if (!params.logId) return;

  try {
    const completedAt = new Date().toISOString();
    
    // Calculate duration if we have the log
    const { data: logData } = await supabase
      .from('interview_operation_logs')
      .select('started_at')
      .eq('id', params.logId)
      .single();

    let durationMs: number | null = null;
    if (logData?.started_at) {
      durationMs = new Date(completedAt).getTime() - new Date(logData.started_at).getTime();
    }

    await supabase
      .from('interview_operation_logs')
      .update({
        status: params.status,
        completed_at: completedAt,
        duration_ms: durationMs,
        error_code: params.errorCode || null,
        error_message: params.errorMessage || null,
        error_details: params.errorDetails || null,
        metadata: params.metadata || undefined,
      })
      .eq('id', params.logId);

    logger.debug(`[OperationLogger] Completed operation ${params.logId}: ${params.status}`);
  } catch (err) {
    logger.error('[OperationLogger] Error completing operation:', err);
  }
}

/**
 * Quick helper to log a complete operation (for simple cases)
 */
export async function logOperation(
  params: LogOperationParams & { 
    status: OperationStatus;
    errorCode?: string;
    errorMessage?: string;
    errorDetails?: Record<string, any>;
    durationMs?: number;
  }
): Promise<void> {
  try {
    await supabase
      .from('interview_operation_logs')
      .insert({
        operation: params.operation,
        status: params.status,
        interview_id: params.interviewId || null,
        attempt_id: params.attemptId || null,
        invitation_id: params.invitationId || null,
        session_id: params.sessionId || null,
        candidate_email: params.candidateEmail || null,
        user_id: params.userId || null,
        metadata: params.metadata || {},
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: params.durationMs || null,
        error_code: params.errorCode || null,
        error_message: params.errorMessage || null,
        error_details: params.errorDetails || null,
      });

    logger.debug(`[OperationLogger] Logged ${params.operation}: ${params.status}`);
  } catch (err) {
    logger.error('[OperationLogger] Error logging operation:', err);
  }
}
