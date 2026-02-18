import { createClient } from "npm:@supabase/supabase-js@2";

// =============================================
// EDGE FUNCTION SYSTEM LOGGER
// For use in Supabase Edge Functions
// Uses 'as any' to avoid type issues with new tables
// =============================================

type SupabaseClient = ReturnType<typeof createClient>;

// =============================================
// CHUNK UPLOAD LOGGING
// =============================================
export async function logChunkUpload(
  supabase: SupabaseClient,
  sessionId: string,
  chunkType: 'video' | 'screen',
  chunkIndex: number,
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'retrying',
  options?: {
    attemptId?: string;
    chunkSizeBytes?: number;
    storagePath?: string;
    retryCount?: number;
    errorMessage?: string;
    durationMs?: number;
  }
): Promise<void> {
  try {
    await (supabase.from('chunk_upload_logs') as any).insert({
      session_id: sessionId,
      attempt_id: options?.attemptId || null,
      chunk_type: chunkType,
      chunk_index: chunkIndex,
      chunk_size_bytes: options?.chunkSizeBytes || null,
      storage_path: options?.storagePath || null,
      status,
      retry_count: options?.retryCount || 0,
      error_message: options?.errorMessage || null,
      duration_ms: options?.durationMs || null,
      upload_started_at: new Date().toISOString(),
      upload_completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error('[SystemLogger] Error logging chunk upload:', err);
  }
}

// =============================================
// MERGE OPERATION LOGGING
// =============================================
export async function logMergeOperation(
  supabase: SupabaseClient,
  sessionId: string,
  mergeType: 'video' | 'screen',
  status: 'started' | 'completed' | 'failed',
  options?: {
    chunksCount?: number;
    totalSizeBytes?: number;
    outputPath?: string;
    durationMs?: number;
    errorMessage?: string;
  }
): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from('merge_operation_logs') as any)
      .insert({
        session_id: sessionId,
        merge_type: mergeType,
        chunks_count: options?.chunksCount || null,
        total_size_bytes: options?.totalSizeBytes || null,
        status,
        output_path: options?.outputPath || null,
        duration_ms: options?.durationMs || null,
        error_message: options?.errorMessage || null,
        merge_started_at: new Date().toISOString(),
        merge_completed_at: status !== 'started' ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    return data?.id || null;
  } catch (err) {
    console.error('[SystemLogger] Error logging merge operation:', err);
    return null;
  }
}

// =============================================
// EVALUATION QUEUE LOGGING
// =============================================
export type EvaluationQueueAction = 'enqueued' | 'started' | 'completed' | 'failed' | 'retrying' | 'stuck_detected' | 'manually_requeued';

export async function logEvaluationQueue(
  supabase: SupabaseClient,
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
    console.error('[SystemLogger] Error logging evaluation queue:', err);
  }
}

// =============================================
// QUESTION GENERATION LOGGING
// =============================================
export async function logQuestionGeneration(
  supabase: SupabaseClient,
  interviewId: string,
  generationType: 'bulk' | 'single' | 'regenerate' | 'from_template',
  status: 'started' | 'completed' | 'partial' | 'failed',
  options?: {
    userId?: string;
    questionsRequested?: number;
    questionsGenerated?: number;
    promptTokens?: number;
    completionTokens?: number;
    modelUsed?: string;
    durationMs?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<string | null> {
  try {
    const { data, error } = await (supabase.from('question_generation_logs') as any)
      .insert({
        interview_id: interviewId,
        user_id: options?.userId || null,
        generation_type: generationType,
        questions_requested: options?.questionsRequested || null,
        questions_generated: options?.questionsGenerated || null,
        prompt_tokens: options?.promptTokens || null,
        completion_tokens: options?.completionTokens || null,
        model_used: options?.modelUsed || null,
        status,
        started_at: new Date().toISOString(),
        completed_at: status !== 'started' ? new Date().toISOString() : null,
        duration_ms: options?.durationMs || null,
        error_message: options?.errorMessage || null,
        metadata: options?.metadata || {},
      })
      .select('id')
      .single();

    return data?.id || null;
  } catch (err) {
    console.error('[SystemLogger] Error logging question generation:', err);
    return null;
  }
}

// =============================================
// STORAGE OPERATION LOGGING
// =============================================
export async function logStorageOp(
  supabase: SupabaseClient,
  operation: 'upload' | 'delete' | 'cleanup' | 'orphan_detected' | 'orphan_removed' | 'retention_applied',
  bucketName: string,
  options?: {
    filePath?: string;
    fileSizeBytes?: number;
    filesAffected?: number;
    bytesFreed?: number;
    triggeredBy?: 'user' | 'system' | 'cron' | 'retention_policy';
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
    console.error('[SystemLogger] Error logging storage operation:', err);
  }
}

// =============================================
// CRON JOB LOGGING
// =============================================
export async function logCronStart(
  supabase: SupabaseClient,
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

    return data?.id || null;
  } catch (err) {
    console.error('[SystemLogger] Error logging cron start:', err);
    return null;
  }
}

export async function logCronComplete(
  supabase: SupabaseClient,
  logId: string,
  status: 'completed' | 'failed' | 'skipped',
  options?: {
    recordsProcessed?: number;
    recordsAffected?: number;
    durationMs?: number;
    errorMessage?: string;
    errorDetails?: Record<string, any>;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  if (!logId) return;
  try {
    await (supabase.from('cron_execution_logs') as any)
      .update({
        status,
        execution_completed_at: new Date().toISOString(),
        duration_ms: options?.durationMs || null,
        records_processed: options?.recordsProcessed || null,
        records_affected: options?.recordsAffected || null,
        error_message: options?.errorMessage || null,
        error_details: options?.errorDetails || null,
        metadata: options?.metadata || {},
      })
      .eq('id', logId);
  } catch (err) {
    console.error('[SystemLogger] Error completing cron log:', err);
  }
}

// =============================================
// SECURITY EVENT LOGGING
// =============================================
export async function logSecurityEvent(
  supabase: SupabaseClient,
  eventType: 'rls_denial' | 'unauthorized_access' | 'rate_limit_exceeded' | 'suspicious_activity' | 'brute_force_detected' | 'token_expired' | 'invalid_token',
  severity: 'low' | 'medium' | 'high' | 'critical',
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
      user_agent: options?.userAgent || null,
      resource_type: options?.resourceType || null,
      resource_id: options?.resourceId || null,
      action_attempted: options?.actionAttempted || null,
      details: options?.details || {},
    });
  } catch (err) {
    console.error('[SystemLogger] Error logging security event:', err);
  }
}

// =============================================
// USER SESSION LOGGING
// =============================================
export async function logUserSession(
  supabase: SupabaseClient,
  eventType: 'login' | 'logout' | 'session_refresh' | 'session_expired' | 'password_reset' | 'mfa_challenge' | 'mfa_verified',
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
      user_agent: options?.userAgent || null,
      device_info: options?.deviceInfo || null,
      session_duration_ms: options?.sessionDurationMs || null,
      success: options?.success ?? true,
      failure_reason: options?.failureReason || null,
      metadata: options?.metadata || {},
    });
  } catch (err) {
    console.error('[SystemLogger] Error logging user session:', err);
  }
}

// =============================================
// EXPORT JOB LOGGING
// =============================================
export async function logExportJob(
  supabase: SupabaseClient,
  jobType: 'pdf_report' | 'excel_export' | 'certificate' | 'bulk_export' | 'analytics_report',
  status: 'started' | 'completed' | 'failed',
  options?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    organizationId?: string;
    fileSizeBytes?: number;
    outputUrl?: string;
    durationMs?: number;
    errorMessage?: string;
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
        status,
        started_at: new Date().toISOString(),
        completed_at: status !== 'started' ? new Date().toISOString() : null,
        duration_ms: options?.durationMs || null,
        file_size_bytes: options?.fileSizeBytes || null,
        output_url: options?.outputUrl || null,
        error_message: options?.errorMessage || null,
        metadata: options?.metadata || {},
      })
      .select('id')
      .single();

    return data?.id || null;
  } catch (err) {
    console.error('[SystemLogger] Error logging export job:', err);
    return null;
  }
}
