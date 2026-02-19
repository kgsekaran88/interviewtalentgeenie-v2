import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';


/**
 * Cleanup Proctoring Chunks Edge Function
 * 
 * Deletes orphaned .part chunk files from the proctoring-recordings bucket.
 * These chunks are temporary upload fragments that should be deleted after merge.
 * 
 * Safe to delete when:
 * 1. Session has upload_status = 'completed' (merge succeeded)
 * 2. Session is older than 24 hours (abandoned/failed)
 * 
 * Preserves:
 * - Merged video files (video.webm, screen.webm)
 * - All screenshots (periodic-*.jpg, screen-periodic-*.jpg, violation-*.jpg)
 * 
 * SECURITY: Requires platform_admin role or service role key
 */

interface CleanupStats {
  sessionsProcessed: number;
  chunksDeleted: number;
  bytesFreed: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[cleanup-proctoring-chunks] Starting cleanup...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check authorization
    const authHeader = req.headers.get('Authorization');
    let isAuthorized = false;

    if (authHeader?.includes(supabaseServiceKey)) {
      isAuthorized = true;
      console.log('[cleanup-proctoring-chunks] Authorized via service role key');
    } else if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, authHeader.replace('Bearer ', ''));
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      
      if (!userError && user) {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: roles } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'platform_admin')
          .single();
        
        if (roles) {
          isAuthorized = true;
          console.log('[cleanup-proctoring-chunks] Authorized via platform_admin role');
        }
      }
    }

    // Check for scheduled secret
    const scheduledSecret = req.headers.get('x-scheduled-secret');
    const expectedSecret = Deno.env.get('SCHEDULED_CLEANUP_SECRET');
    if (scheduledSecret && expectedSecret && scheduledSecret === expectedSecret) {
      isAuthorized = true;
      console.log('[cleanup-proctoring-chunks] Authorized via scheduled secret');
    }

    if (!isAuthorized) {
      console.error('[cleanup-proctoring-chunks] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Requires platform_admin role.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for options
    let dryRun = false;
    let maxSessions = 100; // Process in batches to avoid timeout
    
    try {
      const body = await req.json();
      dryRun = body.dryRun === true;
      maxSessions = body.maxSessions || 100;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log('[cleanup-proctoring-chunks] Options:', { dryRun, maxSessions });

    const stats: CleanupStats = {
      sessionsProcessed: 0,
      chunksDeleted: 0,
      bytesFreed: 0,
      errors: [],
    };

    // Strategy 1: Clean up completed sessions (upload_status = 'completed')
    // These have merged videos, so .part files are redundant
    const { data: completedSessions, error: completedError } = await supabase
      .from('proctoring_sessions')
      .select('id')
      .eq('upload_status', 'completed')
      .limit(maxSessions);

    if (completedError) {
      console.error('[cleanup-proctoring-chunks] Error fetching completed sessions:', completedError);
      stats.errors.push(`Fetch completed sessions: ${completedError.message}`);
    }

    // Strategy 2: Clean up old abandoned sessions (> 24 hours, not completed)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: abandonedSessions, error: abandonedError } = await supabase
      .from('proctoring_sessions')
      .select('id')
      .lt('created_at', twentyFourHoursAgo)
      .neq('upload_status', 'completed')
      .limit(maxSessions);

    if (abandonedError) {
      console.error('[cleanup-proctoring-chunks] Error fetching abandoned sessions:', abandonedError);
      stats.errors.push(`Fetch abandoned sessions: ${abandonedError.message}`);
    }

    const allSessionIds = [
      ...(completedSessions || []).map(s => s.id),
      ...(abandonedSessions || []).map(s => s.id),
    ];

    // Deduplicate
    const uniqueSessionIds = [...new Set(allSessionIds)];
    console.log('[cleanup-proctoring-chunks] Found', uniqueSessionIds.length, 'sessions to process');

    // Process each session
    for (const sessionId of uniqueSessionIds) {
      try {
        // Check for .part files in video folder
        const videoChunks = await cleanupChunksInFolder(supabase, sessionId, 'video', dryRun);
        stats.chunksDeleted += videoChunks.deleted;
        stats.bytesFreed += videoChunks.bytes;
        if (videoChunks.error) stats.errors.push(videoChunks.error);

        // Check for .part files in screen folder
        const screenChunks = await cleanupChunksInFolder(supabase, sessionId, 'screen', dryRun);
        stats.chunksDeleted += screenChunks.deleted;
        stats.bytesFreed += screenChunks.bytes;
        if (screenChunks.error) stats.errors.push(screenChunks.error);

        stats.sessionsProcessed++;
      } catch (err) {
        const errorMsg = `Session ${sessionId}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error('[cleanup-proctoring-chunks]', errorMsg);
        stats.errors.push(errorMsg);
      }
    }

    // Strategy 3: Scan for orphaned session folders (sessions deleted from DB but files remain)
    // This is more expensive, so we do it separately with a limit
    const orphanedStats = await cleanupOrphanedFolders(supabase, dryRun, 50);
    stats.chunksDeleted += orphanedStats.deleted;
    stats.bytesFreed += orphanedStats.bytes;
    stats.sessionsProcessed += orphanedStats.sessions;
    if (orphanedStats.errors.length > 0) {
      stats.errors.push(...orphanedStats.errors);
    }

    const duration = Date.now() - startTime;
    
    console.log('[cleanup-proctoring-chunks] Cleanup completed:', {
      ...stats,
      bytesFreedMB: (stats.bytesFreed / 1024 / 1024).toFixed(2),
      duration_ms: duration,
      dryRun,
    });

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        stats: {
          ...stats,
          bytesFreedMB: (stats.bytesFreed / 1024 / 1024).toFixed(2),
        },
        duration_ms: duration,
        message: dryRun 
          ? `Dry run: Would delete ${stats.chunksDeleted} chunks (${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB)`
          : `Deleted ${stats.chunksDeleted} chunks, freed ${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('[cleanup-proctoring-chunks] Unexpected error:', err);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
        duration_ms: duration,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function cleanupChunksInFolder(
  supabase: any,
  sessionId: string,
  recordingType: 'video' | 'screen',
  dryRun: boolean
): Promise<{ deleted: number; bytes: number; error?: string }> {
  const folderPath = `${sessionId}/${recordingType}`;
  
  try {
    const { data: files, error: listError } = await supabase.storage
      .from('proctoring-recordings')
      .list(folderPath);

    if (listError) {
      // Folder doesn't exist or other error
      return { deleted: 0, bytes: 0 };
    }

    // Filter only .part files
    const partFiles = (files || []).filter((f: any) => f.name.endsWith('.part'));
    
    if (partFiles.length === 0) {
      return { deleted: 0, bytes: 0 };
    }

    const totalBytes = partFiles.reduce((sum: number, f: any) => sum + (f.metadata?.size || 0), 0);

    if (dryRun) {
      console.log(`[cleanup-proctoring-chunks] [DRY RUN] Would delete ${partFiles.length} chunks from ${folderPath}`);
      return { deleted: partFiles.length, bytes: totalBytes };
    }

    // Delete the .part files
    const filePaths = partFiles.map((f: any) => `${folderPath}/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from('proctoring-recordings')
      .remove(filePaths);

    if (deleteError) {
      console.error(`[cleanup-proctoring-chunks] Failed to delete chunks from ${folderPath}:`, deleteError);
      return { deleted: 0, bytes: 0, error: `Delete ${folderPath}: ${deleteError.message}` };
    }

    console.log(`[cleanup-proctoring-chunks] Deleted ${partFiles.length} chunks from ${folderPath}`);
    return { deleted: partFiles.length, bytes: totalBytes };

  } catch (err) {
    return { 
      deleted: 0, 
      bytes: 0, 
      error: `${folderPath}: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

async function cleanupOrphanedFolders(
  supabase: any,
  dryRun: boolean,
  limit: number
): Promise<{ deleted: number; bytes: number; sessions: number; errors: string[] }> {
  const result = { deleted: 0, bytes: 0, sessions: 0, errors: [] as string[] };
  
  try {
    // List root folders in the bucket (session IDs)
    const { data: folders, error: listError } = await supabase.storage
      .from('proctoring-recordings')
      .list('', { limit: 500 });

    if (listError) {
      result.errors.push(`List root folders: ${listError.message}`);
      return result;
    }

    // Filter to folders (they have null metadata or id property indicates folder)
    const sessionFolders = (folders || [])
      .filter((f: any) => f.id && !f.name.includes('.'))
      .slice(0, limit);

    console.log(`[cleanup-proctoring-chunks] Checking ${sessionFolders.length} session folders for orphans`);

    for (const folder of sessionFolders) {
      const sessionId = folder.name;
      
      // Check if this session exists in the database
      const { data: session, error: sessionError } = await supabase
        .from('proctoring_sessions')
        .select('id, upload_status')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) {
        continue; // Skip on error
      }

      // If session doesn't exist in DB or is completed, clean up chunks
      if (!session || session.upload_status === 'completed') {
        const videoResult = await cleanupChunksInFolder(supabase, sessionId, 'video', dryRun);
        const screenResult = await cleanupChunksInFolder(supabase, sessionId, 'screen', dryRun);
        
        result.deleted += videoResult.deleted + screenResult.deleted;
        result.bytes += videoResult.bytes + screenResult.bytes;
        
        if (videoResult.deleted > 0 || screenResult.deleted > 0) {
          result.sessions++;
        }
        
        if (videoResult.error) result.errors.push(videoResult.error);
        if (screenResult.error) result.errors.push(screenResult.error);
      }
    }

  } catch (err) {
    result.errors.push(`Orphan scan: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return result;
}
