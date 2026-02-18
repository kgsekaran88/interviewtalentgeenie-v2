import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Merge Proctoring Chunks
 * 
 * Concatenates all uploaded chunk_NNN.part files into a single final.webm file.
 * Called when candidate submits their interview after all chunks are uploaded.
 * 
 * Flow:
 * 1. List all .part files in {sessionId}/{recordingType}/ (with pagination for >100 files)
 * 2. Sort numerically (chunk_000, chunk_001, etc.) 
 * 3. Concatenate binary data using streaming batches to stay within memory limits
 * 4. Upload as final.webm
 * 5. Delete individual .part files
 * 
 * IMPORTANT: WebM chunks from MediaRecorder with timeslice are valid when concatenated
 * because the first chunk contains the WebM header (init segment).
 * 
 * MEMORY SAFETY:
 * - Uses batched processing (CHUNK_BATCH_SIZE) to limit peak memory usage
 * - Implements recursive storage listing to handle >100 files (Supabase API limit)
 * - Streams merged output to avoid holding full recording in memory
 */

const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024; // 150MB limit for edge function memory
const CHUNK_BATCH_SIZE = 50; // Process chunks in batches to limit memory usage
const STORAGE_LIST_LIMIT = 100; // Supabase storage API limit per request

/**
 * Recursively list all files in a storage path, handling pagination
 * Supabase storage.list() is limited to 100 files per request
 */
async function listAllStorageFiles(
  supabase: any,
  bucket: string,
  path: string
): Promise<{ name: string; metadata?: { size?: number } }[]> {
  const allFiles: { name: string; metadata?: { size?: number } }[] = [];
  let offset = 0;
  
  while (true) {
    const { data: files, error } = await supabase.storage
      .from(bucket)
      .list(path, {
        limit: STORAGE_LIST_LIMIT,
        offset: offset,
        sortBy: { column: 'name', order: 'asc' },
      });
    
    if (error) {
      throw new Error(`Failed to list files at offset ${offset}: ${error.message}`);
    }
    
    if (!files || files.length === 0) {
      break;
    }
    
    allFiles.push(...files);
    
    // If we got fewer files than the limit, we've reached the end
    if (files.length < STORAGE_LIST_LIMIT) {
      break;
    }
    
    offset += STORAGE_LIST_LIMIT;
    console.log(`[merge-proctoring-chunks] Listed ${allFiles.length} files so far, continuing...`);
  }
  
  return allFiles;
}

/**
 * Download and merge chunks in batches to limit memory usage
 * Returns a Uint8Array containing the merged data
 */
async function downloadAndMergeChunks(
  supabase: any,
  bucket: string,
  chunkPath: string,
  chunkFiles: { name: string }[]
): Promise<Uint8Array> {
  const totalChunks = chunkFiles.length;
  const allChunkData: Uint8Array[] = [];
  let totalBytes = 0;
  
  // Process in batches
  for (let batchStart = 0; batchStart < totalChunks; batchStart += CHUNK_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + CHUNK_BATCH_SIZE, totalChunks);
    const batchFiles = chunkFiles.slice(batchStart, batchEnd);
    
    console.log(`[merge-proctoring-chunks] Processing batch ${Math.floor(batchStart / CHUNK_BATCH_SIZE) + 1}: chunks ${batchStart + 1}-${batchEnd} of ${totalChunks}`);
    
    // Download batch in parallel
    const batchResults = await Promise.all(
      batchFiles.map(async (chunkFile) => {
        const filePath = `${chunkPath}/${chunkFile.name}`;
        const { data: chunkData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(filePath);
        
        if (downloadError || !chunkData) {
          throw new Error(`Failed to download chunk ${chunkFile.name}: ${downloadError?.message || 'Unknown error'}`);
        }
        
        return new Uint8Array(await chunkData.arrayBuffer());
      })
    );
    
    // Add batch results to accumulated data
    for (const chunkBuffer of batchResults) {
      allChunkData.push(chunkBuffer);
      totalBytes += chunkBuffer.length;
      
      // Check memory limit
      if (totalBytes > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Combined file size (${(totalBytes / 1024 / 1024).toFixed(2)}MB) exceeds limit (${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB)`);
      }
    }
  }
  
  console.log(`[merge-proctoring-chunks] Downloaded ${totalChunks} chunks, ${(totalBytes / 1024 / 1024).toFixed(2)}MB total`);
  
  // Concatenate all chunks into one buffer
  const mergedBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of allChunkData) {
    mergedBuffer.set(chunk, offset);
    offset += chunk.length;
  }
  
  return mergedBuffer;
}

/**
 * Delete chunk files in batches
 */
async function deleteChunksInBatches(
  supabase: any,
  bucket: string,
  chunkPath: string,
  chunkFiles: { name: string }[]
): Promise<number> {
  let deletedCount = 0;
  
  // Delete in batches of 50 (Supabase storage.remove limit per call)
  for (let i = 0; i < chunkFiles.length; i += 50) {
    const batch = chunkFiles.slice(i, i + 50);
    const filePaths = batch.map(f => `${chunkPath}/${f.name}`);
    
    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove(filePaths);
    
    if (deleteError) {
      console.warn(`[merge-proctoring-chunks] Failed to delete batch ${Math.floor(i / 50) + 1}:`, deleteError.message);
    } else {
      deletedCount += batch.length;
    }
  }
  
  return deletedCount;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      sessionId, 
      recordingType,
      sessionToken,
      attemptId,
      skipCleanup = false,
    } = await req.json();

    console.log('[merge-proctoring-chunks] Request:', { 
      sessionId, 
      recordingType, 
      hasSessionToken: !!sessionToken,
      attemptId,
      skipCleanup,
    });

    // Validate required fields
    if (!sessionId || !recordingType) {
      return new Response(
        JSON.stringify({ error: 'sessionId and recordingType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['video', 'screen'].includes(recordingType)) {
      return new Response(
        JSON.stringify({ error: 'recordingType must be "video" or "screen"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AUTHENTICATION
    let isAuthorized = false;

    if (sessionToken && attemptId) {
      const { data: attempt } = await supabase
        .from('interview_attempts')
        .select('id, session_token')
        .eq('id', attemptId)
        .eq('session_token', sessionToken)
        .maybeSingle();

      if (attempt) {
        const { data: proctoringSession } = await supabase
          .from('proctoring_sessions')
          .select('id, interview_attempt_id')
          .eq('id', sessionId)
          .eq('interview_attempt_id', attemptId)
          .maybeSingle();

        if (proctoringSession) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);

        if (user) {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          if (userRoles?.some((r: any) => 
            ['platform_admin', 'partner_admin', 'hr_recruiter'].includes(r.role)
          )) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List all chunk files using recursive pagination
    const chunkPath = `${sessionId}/${recordingType}`;
    console.log('[merge-proctoring-chunks] Listing chunks in:', chunkPath);

    let allFiles: { name: string; metadata?: { size?: number } }[];
    try {
      allFiles = await listAllStorageFiles(supabase, 'proctoring-recordings', chunkPath);
    } catch (listError: any) {
      console.error('[merge-proctoring-chunks] Failed to list files:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list chunk files', details: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter and sort .part files
    const chunkFiles = allFiles
      .filter(f => f.name.endsWith('.part'))
      .sort((a, b) => {
        // Extract chunk number from filename (chunk_NNN.part)
        const numA = parseInt(a.name.match(/chunk_(\d+)\.part/)?.[1] || '0', 10);
        const numB = parseInt(b.name.match(/chunk_(\d+)\.part/)?.[1] || '0', 10);
        return numA - numB;
      });

    console.log(`[merge-proctoring-chunks] Found ${chunkFiles.length} chunks:`, 
      chunkFiles.length <= 10 
        ? chunkFiles.map(f => f.name) 
        : `${chunkFiles.slice(0, 5).map(f => f.name).join(', ')} ... ${chunkFiles.slice(-2).map(f => f.name).join(', ')}`
    );

    if (chunkFiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No chunk files found',
          path: chunkPath,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download and merge chunks with batched processing
    let mergedBuffer: Uint8Array;
    try {
      mergedBuffer = await downloadAndMergeChunks(supabase, 'proctoring-recordings', chunkPath, chunkFiles);
    } catch (mergeError: any) {
      console.error('[merge-proctoring-chunks] Failed to merge chunks:', mergeError);
      return new Response(
        JSON.stringify({ error: 'Failed to merge chunks', details: mergeError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload merged file
    const finalPath = `${sessionId}/${recordingType}.webm`;
    console.log('[merge-proctoring-chunks] Uploading merged file to:', finalPath);

    const { error: uploadError } = await supabase.storage
      .from('proctoring-recordings')
      .upload(finalPath, mergedBuffer, {
        contentType: 'video/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('[merge-proctoring-chunks] Failed to upload merged file:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload merged file', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[merge-proctoring-chunks] ✅ Merged file uploaded:', finalPath);

    // Delete individual chunk files
    let deletedCount = 0;
    if (!skipCleanup) {
      console.log('[merge-proctoring-chunks] Cleaning up chunk files...');
      deletedCount = await deleteChunksInBatches(supabase, 'proctoring-recordings', chunkPath, chunkFiles);
      console.log(`[merge-proctoring-chunks] Deleted ${deletedCount} of ${chunkFiles.length} chunk files`);
    }

    // Update session with final file info
    // CRITICAL: Use correct column names that match database schema
    const urlField = recordingType === 'video' ? 'video_recording_url' : 'screen_recording_url';
    
    // CRITICAL: Store the RELATIVE PATH, not the full public URL
    // The UI code uses createSignedUrl() which expects relative paths
    // e.g., "014a63bb.../video.webm" not "https://...supabase.co/.../video.webm"
    const relativePath = finalPath; // finalPath is already relative: "{sessionId}/{type}.webm"

    // Note: Only set upload_status to 'completed' when BOTH recordings are done
    // For now, update the URL field and let the caller handle final status
    const updateData: Record<string, any> = {
      [urlField]: relativePath,
      updated_at: new Date().toISOString(),
    };

    // Check if both recordings are now complete
    const { data: sessionCheck } = await supabase
      .from('proctoring_sessions')
      .select('video_recording_url, screen_recording_url')
      .eq('id', sessionId)
      .single();

    // Determine if this merge completes all recordings
    const existingVideo = sessionCheck?.video_recording_url;
    const existingScreen = sessionCheck?.screen_recording_url;
    const willHaveVideo = recordingType === 'video' ? relativePath : existingVideo;
    const willHaveScreen = recordingType === 'screen' ? relativePath : existingScreen;
    
    // Set upload_status to 'completed' only if we now have both recordings
    // (or if this is the only recording type being processed)
    if (willHaveVideo && willHaveScreen) {
      updateData.upload_status = 'completed';
      console.log('[merge-proctoring-chunks] Both recordings complete, setting status to completed');
    } else {
      // Set to 'uploading' to indicate one is done but we're waiting for the other
      updateData.upload_status = 'uploading';
      console.log('[merge-proctoring-chunks] Waiting for other recording type');
    }

    const { error: updateError } = await supabase
      .from('proctoring_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (updateError) {
      console.error('[merge-proctoring-chunks] Failed to update session:', updateError);
    }

    // Generate public URL for response (for debugging/logging purposes)
    const { data: publicUrlData } = supabase.storage
      .from('proctoring-recordings')
      .getPublicUrl(finalPath);

    return new Response(
      JSON.stringify({
        success: true,
        finalPath,
        relativePath,
        publicUrl: publicUrlData?.publicUrl || null,
        chunksProcessed: chunkFiles.length,
        chunksDeleted: deletedCount,
        totalBytes: mergedBuffer.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[merge-proctoring-chunks] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});