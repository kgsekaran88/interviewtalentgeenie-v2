import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// =============================================
// CHUNK UPLOAD LOGGING
// =============================================
export interface ChunkUploadLogParams {
  sessionId: string;
  attemptId?: string;
  chunkType: 'video' | 'screen';
  chunkIndex: number;
  chunkSizeBytes?: number;
  storagePath?: string;
}

export async function logChunkUploadStart(params: ChunkUploadLogParams): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from('chunk_upload_logs') as any)
      .insert({
        session_id: params.sessionId,
        attempt_id: params.attemptId || null,
        chunk_type: params.chunkType,
        chunk_index: params.chunkIndex,
        chunk_size_bytes: params.chunkSizeBytes || null,
        storage_path: params.storagePath || null,
        status: 'uploading',
        upload_started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[SystemLogger] Failed to log chunk upload start:', error);
      return null;
    }
    return data.id;
  } catch (err) {
    logger.error('[SystemLogger] Error logging chunk upload:', err);
    return null;
  }
}

export async function logChunkUploadComplete(
  logId: string,
  status: 'completed' | 'failed' | 'retrying',
  errorMessage?: string
): Promise<void> {
  if (!logId) return;
  try {
    const completedAt = new Date().toISOString();
    const { data: log } = await (supabase.from('chunk_upload_logs') as any)
      .select('upload_started_at, retry_count')
      .eq('id', logId)
      .single();

    const durationMs = log?.upload_started_at
      ? new Date(completedAt).getTime() - new Date(log.upload_started_at).getTime()
      : null;

    await (supabase.from('chunk_upload_logs') as any)
      .update({
        status,
        upload_completed_at: completedAt,
        duration_ms: durationMs,
        error_message: errorMessage || null,
        retry_count: status === 'retrying' ? (log?.retry_count || 0) + 1 : log?.retry_count || 0,
      })
      .eq('id', logId);
  } catch (err) {
    logger.error('[SystemLogger] Error completing chunk upload log:', err);
  }
}

// =============================================
// MERGE OPERATION LOGGING
// =============================================
export interface MergeOperationLogParams {
  sessionId: string;
  mergeType: 'video' | 'screen';
  chunksCount?: number;
  totalSizeBytes?: number;
}

export async function logMergeStart(params: MergeOperationLogParams): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from('merge_operation_logs') as any)
      .insert({
        session_id: params.sessionId,
        merge_type: params.mergeType,
        chunks_count: params.chunksCount || null,
        total_size_bytes: params.totalSizeBytes || null,
        status: 'started',
        merge_started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[SystemLogger] Failed to log merge start:', error);
      return null;
    }
    return data.id;
  } catch (err) {
    logger.error('[SystemLogger] Error logging merge start:', err);
    return null;
  }
}

export async function logMergeComplete(
  logId: string,
  status: 'completed' | 'failed',
  outputPath?: string,
  errorMessage?: string
): Promise<void> {
  if (!logId) return;
  try {
    const completedAt = new Date().toISOString();
    const { data: log } = await (supabase.from('merge_operation_logs') as any)
      .select('merge_started_at')
      .eq('id', logId)
      .single();

    const durationMs = log?.merge_started_at
      ? new Date(completedAt).getTime() - new Date(log.merge_started_at).getTime()
      : null;

    await (supabase.from('merge_operation_logs') as any)
      .update({
        status,
        merge_completed_at: completedAt,
        duration_ms: durationMs,
        output_path: outputPath || null,
        error_message: errorMessage || null,
      })
      .eq('id', logId);
  } catch (err) {
    logger.error('[SystemLogger] Error completing merge log:', err);
  }
}

// =============================================
// EVALUATION QUEUE LOGGING
// =============================================
export type EvaluationQueueAction = 'enqueued' | 'started' | 'completed' | 'failed' | 'retrying' | 'stuck_detected' | 'manually_requeued';

export async function logEvaluationQueueEvent(
  attemptId: string,
  action: EvaluationQueueAction,
  options?: {
    queueItemId?: string;
    queuePosition?: number;
    retryAttempt?: number;
    processingTimeMs?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await (supabase.from('evaluation_queue_logs') as any).insert({
      attempt_id: attemptId,
      queue_item_id: options?.queueItemId || null,
      action,
      queue_position: options?.queuePosition || null,
      retry_attempt: options?.retryAttempt || 0,
      processing_time_ms: options?.processingTimeMs || null,
      error_message: options?.errorMessage || null,
      metadata: options?.metadata || {},
    });
  } catch (err) {
    logger.error('[SystemLogger] Error logging evaluation queue event:', err);
  }
}

// =============================================
// QUESTION GENERATION LOGGING
// =============================================
export type QuestionGenerationType = 'bulk' | 'single' | 'regenerate' | 'from_template';

export interface QuestionGenerationLogParams {
  interviewId: string;
  userId?: string;
  generationType: QuestionGenerationType;
  questionsRequested?: number;
}

export async function logQuestionGenerationStart(params: QuestionGenerationLogParams): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from('question_generation_logs') as any)
      .insert({
        interview_id: params.interviewId,
        user_id: params.userId || null,
        generation_type: params.generationType,
        questions_requested: params.questionsRequested || null,
        status: 'started',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[SystemLogger] Failed to log question generation start:', error);
      return null;
    }
    return data.id;
  } catch (err) {
    logger.error('[SystemLogger] Error logging question generation:', err);
    return null;
  }
}

export async function logQuestionGenerationComplete(
  logId: string,
  status: 'completed' | 'partial' | 'failed',
  options?: {
    questionsGenerated?: number;
    promptTokens?: number;
    completionTokens?: number;
    modelUsed?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  if (!logId) return;
  try {
    const completedAt = new Date().toISOString();
    const { data: log } = await (supabase.from('question_generation_logs') as any)
      .select('started_at')
      .eq('id', logId)
      .single();

    const durationMs = log?.started_at
      ? new Date(completedAt).getTime() - new Date(log.started_at).getTime()
      : null;

    await (supabase.from('question_generation_logs') as any)
      .update({
        status,
        completed_at: completedAt,
        duration_ms: durationMs,
        questions_generated: options?.questionsGenerated || null,
        prompt_tokens: options?.promptTokens || null,
        completion_tokens: options?.completionTokens || null,
        model_used: options?.modelUsed || null,
        error_message: options?.errorMessage || null,
        metadata: options?.metadata || {},
      })
      .eq('id', logId);
  } catch (err) {
    logger.error('[SystemLogger] Error completing question generation log:', err);
  }
}

// =============================================
// EXPORT JOB LOGGING
// =============================================
export type ExportJobType = 'pdf_report' | 'excel_export' | 'certificate' | 'bulk_export' | 'analytics_report';

export async function logExportJobStart(
  jobType: ExportJobType,
  options?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    organizationId?: string;
    metadata?: Record<string, any>;
  }
): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from('export_job_logs') as any)
      .insert({
        job_type: jobType,
        entity_type: options?.entityType || null,
        entity_id: options?.entityId || null,
        user_id: options?.userId || null,
        organization_id: options?.organizationId || null,
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: options?.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[SystemLogger] Failed to log export job start:', error);
      return null;
    }
    return data.id;
  } catch (err) {
    logger.error('[SystemLogger] Error logging export job:', err);
    return null;
  }
}

export async function logExportJobComplete(
  logId: string,
  status: 'completed' | 'failed',
  options?: {
    fileSizeBytes?: number;
    outputUrl?: string;
    errorMessage?: string;
  }
): Promise<void> {
  if (!logId) return;
  try {
    const completedAt = new Date().toISOString();
    const { data: log } = await (supabase.from('export_job_logs') as any)
      .select('started_at')
      .eq('id', logId)
      .single();

    const durationMs = log?.started_at
      ? new Date(completedAt).getTime() - new Date(log.started_at).getTime()
      : null;

    await (supabase.from('export_job_logs') as any)
      .update({
        status,
        completed_at: completedAt,
        duration_ms: durationMs,
        file_size_bytes: options?.fileSizeBytes || null,
        output_url: options?.outputUrl || null,
        error_message: options?.errorMessage || null,
      })
      .eq('id', logId);
  } catch (err) {
    logger.error('[SystemLogger] Error completing export job log:', err);
  }
}

// =============================================
// STORAGE OPERATION LOGGING
// =============================================
export type StorageOperation = 'upload' | 'delete' | 'cleanup' | 'orphan_detected' | 'orphan_removed' | 'retention_applied';
export type StorageTrigger = 'user' | 'system' | 'cron' | 'retention_policy';

export async function logStorageOperation(
  operation: StorageOperation,
  bucketName: string,
  options?: {
    filePath?: string;
    fileSizeBytes?: number;
    filesAffected?: number;
    bytesFreed?: number;
    triggeredBy?: StorageTrigger;
    userId?: string;
    status?: 'started' | 'completed' | 'failed';
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await (supabase.from('storage_operation_logs') as any).insert({
      operation,
      bucket_name: bucketName,
      file_path: options?.filePath || null,
      file_size_bytes: options?.fileSizeBytes || null,
      files_affected: options?.filesAffected || 1,
      bytes_freed: options?.bytesFreed || null,
      triggered_by: options?.triggeredBy || 'system',
      user_id: options?.userId || null,
      status: options?.status || 'completed',
      error_message: options?.errorMessage || null,
      metadata: options?.metadata || {},
    });
  } catch (err) {
    logger.error('[SystemLogger] Error logging storage operation:', err);
  }
}

// =============================================
// USER SESSION LOGGING
// =============================================
export type UserSessionEvent = 'login' | 'logout' | 'session_refresh' | 'session_expired' | 'password_reset' | 'mfa_challenge' | 'mfa_verified';

export async function logUserSession(
  eventType: UserSessionEvent,
  options?: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: Record<string, any>;
    sessionDurationMs?: number;
    success?: boolean;
    failureReason?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await (supabase.from('user_session_logs') as any).insert({
      user_id: options?.userId || null,
      event_type: eventType,
      ip_address: options?.ipAddress || null,
      user_agent: options?.userAgent || navigator.userAgent,
      device_info: options?.deviceInfo || null,
      session_duration_ms: options?.sessionDurationMs || null,
      success: options?.success ?? true,
      failure_reason: options?.failureReason || null,
      metadata: options?.metadata || {},
    });
  } catch (err) {
    logger.error('[SystemLogger] Error logging user session:', err);
  }
}

// =============================================
// REALTIME CONNECTION LOGGING
// =============================================
export type RealtimeEventType = 'connected' | 'disconnected' | 'reconnecting' | 'reconnected' | 'error' | 'subscription_created' | 'subscription_removed';

export async function logRealtimeConnection(
  eventType: RealtimeEventType,
  options?: {
    userId?: string;
    sessionId?: string;
    channelName?: string;
    connectionDurationMs?: number;
    reconnectAttempt?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await (supabase.from('realtime_connection_logs') as any).insert({
      user_id: options?.userId || null,
      session_id: options?.sessionId || null,
      channel_name: options?.channelName || null,
      event_type: eventType,
      connection_duration_ms: options?.connectionDurationMs || null,
      reconnect_attempt: options?.reconnectAttempt || null,
      error_message: options?.errorMessage || null,
      metadata: options?.metadata || {},
    });
  } catch (err) {
    logger.error('[SystemLogger] Error logging realtime connection:', err);
  }
}

// =============================================
// CRON JOB LOGGING
// =============================================
export async function logCronJobStart(
  jobName: string,
  jobSchedule?: string,
  metadata?: Record<string, any>
): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from('cron_execution_logs') as any)
      .insert({
        job_name: jobName,
        job_schedule: jobSchedule || null,
        status: 'started',
        execution_started_at: new Date().toISOString(),
        metadata: metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[SystemLogger] Failed to log cron job start:', error);
      return null;
    }
    return data.id;
  } catch (err) {
    logger.error('[SystemLogger] Error logging cron job:', err);
    return null;
  }
}

export async function logCronJobComplete(
  logId: string,
  status: 'completed' | 'failed' | 'skipped',
  options?: {
    recordsProcessed?: number;
    recordsAffected?: number;
    errorMessage?: string;
    errorDetails?: Record<string, any>;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  if (!logId) return;
  try {
    const completedAt = new Date().toISOString();
    const { data: log } = await (supabase.from('cron_execution_logs') as any)
      .select('execution_started_at')
      .eq('id', logId)
      .single();

    const durationMs = log?.execution_started_at
      ? new Date(completedAt).getTime() - new Date(log.execution_started_at).getTime()
      : null;

    await (supabase.from('cron_execution_logs') as any)
      .update({
        status,
        execution_completed_at: completedAt,
        duration_ms: durationMs,
        records_processed: options?.recordsProcessed || null,
        records_affected: options?.recordsAffected || null,
        error_message: options?.errorMessage || null,
        error_details: options?.errorDetails || null,
        metadata: options?.metadata || {},
      })
      .eq('id', logId);
  } catch (err) {
    logger.error('[SystemLogger] Error completing cron job log:', err);
  }
}

// =============================================
// SECURITY EVENT LOGGING
// =============================================
export type SecurityEventType = 'rls_denial' | 'unauthorized_access' | 'rate_limit_exceeded' | 'suspicious_activity' | 'brute_force_detected' | 'token_expired' | 'invalid_token';
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export async function logSecurityEvent(
  eventType: SecurityEventType,
  severity: SecuritySeverity,
  options?: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    resourceType?: string;
    resourceId?: string;
    actionAttempted?: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  try {
    await (supabase.from('security_event_logs') as any).insert({
      event_type: eventType,
      severity,
      user_id: options?.userId || null,
      ip_address: options?.ipAddress || null,
      user_agent: options?.userAgent || navigator.userAgent,
      resource_type: options?.resourceType || null,
      resource_id: options?.resourceId || null,
      action_attempted: options?.actionAttempted || null,
      details: options?.details || {},
    });
  } catch (err) {
    logger.error('[SystemLogger] Error logging security event:', err);
  }
}
