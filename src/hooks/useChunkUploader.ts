/**
 * useChunkUploader
 * 
 * Clean FIFO queue uploader for proctoring video chunks.
 * Uploads individual 10-second WebM chunks during the interview,
 * enabling near-instant submission when the candidate finishes.
 * 
 * ARCHITECTURE:
 * - MediaRecorder produces chunks every 10 seconds via ondataavailable
 * - Each chunk is queued immediately for background upload
 * - Chunks are uploaded as individual files: chunk_000.part, chunk_001.part, etc.
 * - On submission, remaining queue drains, then merge function combines chunks
 * 
 * RELIABILITY:
 * - 3x retry with exponential backoff per chunk
 * - Memory array kept as fallback if all chunk uploads fail
 * - beforeunload warning while queue is non-empty
 */

import { useRef, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

// Configuration
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_CONCURRENT_UPLOADS = 2;

interface ChunkQueueItem {
  blob: Blob;
  index: number;
  recordingType: 'video' | 'screen';
  retryCount: number;
  addedAt: number;
}

interface ChunkUploadState {
  isActive: boolean;
  sessionId: string | null;
  attemptId: string;
  sessionToken?: string;
  
  // Queue state
  videoQueue: ChunkQueueItem[];
  screenQueue: ChunkQueueItem[];
  
  // CRITICAL: Pending queues for chunks received BEFORE uploader is active
  // These prevent lost chunks during the race condition between recording start and uploader start
  pendingVideoChunks: Blob[];
  pendingScreenChunks: Blob[];
  
  // Progress tracking
  videoChunksUploaded: number;
  screenChunksUploaded: number;
  videoChunksTotal: number;
  screenChunksTotal: number;
  videoBytesUploaded: number;
  screenBytesUploaded: number;
  
  // Error tracking
  failedChunks: { type: 'video' | 'screen'; index: number; error: string }[];
}

interface UseChunkUploaderOptions {
  sessionId: string | null;
  attemptId: string;
  sessionToken?: string;
  enabled?: boolean;
  onProgress?: (progress: ChunkUploadProgress) => void;
}

export interface ChunkUploadProgress {
  video: { uploaded: number; total: number; bytes: number; percent: number };
  screen: { uploaded: number; total: number; bytes: number; percent: number };
  isUploading: boolean;
  queueLength: number;
  failedCount: number;
}

export function useChunkUploader({
  sessionId,
  attemptId,
  sessionToken,
  enabled = true,
  onProgress,
}: UseChunkUploaderOptions) {
  // State
  const stateRef = useRef<ChunkUploadState>({
    isActive: false,
    sessionId: null,
    attemptId,
    sessionToken,
    videoQueue: [],
    screenQueue: [],
    pendingVideoChunks: [],
    pendingScreenChunks: [],
    videoChunksUploaded: 0,
    screenChunksUploaded: 0,
    videoChunksTotal: 0,
    screenChunksTotal: 0,
    videoBytesUploaded: 0,
    screenBytesUploaded: 0,
    failedChunks: [],
  });

  // Processing lock
  const isProcessingRef = useRef(false);
  const processingPromiseRef = useRef<Promise<void> | null>(null);

  /**
   * Format chunk index with zero-padding for correct string sorting
   */
  const formatChunkIndex = useCallback((index: number): string => {
    return index.toString().padStart(3, '0');
  }, []);

  /**
   * Get current progress state
   */
  const getProgress = useCallback((): ChunkUploadProgress => {
    const state = stateRef.current;
    const queueLength = state.videoQueue.length + state.screenQueue.length;
    
    return {
      video: {
        uploaded: state.videoChunksUploaded,
        total: state.videoChunksTotal,
        bytes: state.videoBytesUploaded,
        percent: state.videoChunksTotal > 0 
          ? Math.round((state.videoChunksUploaded / state.videoChunksTotal) * 100) 
          : 0,
      },
      screen: {
        uploaded: state.screenChunksUploaded,
        total: state.screenChunksTotal,
        bytes: state.screenBytesUploaded,
        percent: state.screenChunksTotal > 0 
          ? Math.round((state.screenChunksUploaded / state.screenChunksTotal) * 100) 
          : 0,
      },
      isUploading: isProcessingRef.current,
      queueLength,
      failedCount: state.failedChunks.length,
    };
  }, []);

  /**
   * Notify progress listeners
   */
  const notifyProgress = useCallback(() => {
    if (onProgress) {
      onProgress(getProgress());
    }
  }, [onProgress, getProgress]);

  /**
   * Upload a single chunk with retry logic
   */
  const uploadChunk = useCallback(async (item: ChunkQueueItem): Promise<boolean> => {
    const state = stateRef.current;
    
    if (!state.sessionId) {
      logger.error('[ChunkUploader] No session ID available');
      return false;
    }

    const chunkName = `chunk_${formatChunkIndex(item.index)}.part`;
    logger.proctoring(`[ChunkUploader] Uploading ${item.recordingType}/${chunkName} (${(item.blob.size / 1024).toFixed(1)}KB)`);

    try {
      // Get signed URL for this specific chunk
      const { data: urlData, error: urlError } = await supabase.functions.invoke('get-chunk-upload-url', {
        body: {
          sessionId: state.sessionId,
          recordingType: item.recordingType,
          chunkIndex: item.index,
          sessionToken: state.sessionToken,
          attemptId: state.attemptId,
        }
      });

      if (urlError || !urlData?.signedUrl) {
        throw new Error(`Failed to get signed URL: ${urlError?.message || 'No URL returned'}`);
      }

      // Upload the chunk
      const response = await fetch(urlData.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/webm',
        },
        body: item.blob,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      // Update state
      if (item.recordingType === 'video') {
        state.videoChunksUploaded++;
        state.videoBytesUploaded += item.blob.size;
      } else {
        state.screenChunksUploaded++;
        state.screenBytesUploaded += item.blob.size;
      }

      logger.proctoring(`[ChunkUploader] ✅ ${item.recordingType}/${chunkName} uploaded`);
      notifyProgress();
      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`[ChunkUploader] Failed ${item.recordingType}/${chunkName}: ${errorMsg}`);

      // Retry with exponential backoff
      if (item.retryCount < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, item.retryCount);
        logger.proctoring(`[ChunkUploader] Retrying in ${delay}ms (attempt ${item.retryCount + 2}/${MAX_RETRY_ATTEMPTS + 1})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        item.retryCount++;
        return uploadChunk(item);
      }

      // Max retries exceeded - log failure
      state.failedChunks.push({
        type: item.recordingType,
        index: item.index,
        error: errorMsg,
      });
      
      logger.error(`[ChunkUploader] ❌ ${item.recordingType}/${chunkName} failed after ${MAX_RETRY_ATTEMPTS + 1} attempts`);
      notifyProgress();
      return false;
    }
  }, [formatChunkIndex, notifyProgress]);

  /**
   * Process the upload queue
   */
  const processQueue = useCallback(async (): Promise<void> => {
    if (isProcessingRef.current) {
      return processingPromiseRef.current || Promise.resolve();
    }

    isProcessingRef.current = true;
    
    processingPromiseRef.current = (async () => {
      const state = stateRef.current;
      
      while (state.isActive || state.videoQueue.length > 0 || state.screenQueue.length > 0) {
        // Get next items to upload (up to MAX_CONCURRENT_UPLOADS)
        const itemsToUpload: ChunkQueueItem[] = [];
        
        while (itemsToUpload.length < MAX_CONCURRENT_UPLOADS) {
          // Alternate between video and screen for fairness
          if (state.videoQueue.length > 0 && (state.screenQueue.length === 0 || itemsToUpload.length % 2 === 0)) {
            itemsToUpload.push(state.videoQueue.shift()!);
          } else if (state.screenQueue.length > 0) {
            itemsToUpload.push(state.screenQueue.shift()!);
          } else {
            break;
          }
        }

        if (itemsToUpload.length === 0) {
          // Queue is empty, wait a bit before checking again
          if (state.isActive) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          } else {
            break;
          }
        }

        // Upload items in parallel
        await Promise.all(itemsToUpload.map(item => uploadChunk(item)));
      }
    })();

    try {
      await processingPromiseRef.current;
    } finally {
      isProcessingRef.current = false;
      processingPromiseRef.current = null;
    }
  }, [uploadChunk]);

  /**
   * Queue a chunk for upload
   * CRITICAL: If uploader is not yet active, buffer the chunk for later processing
   * This prevents lost chunks during the race condition between recording start and uploader start
   */
  const queueChunk = useCallback((
    blob: Blob,
    recordingType: 'video' | 'screen',
  ) => {
    const state = stateRef.current;
    
    // CRITICAL FIX: Buffer chunks if uploader not yet active instead of dropping them
    if (!state.isActive) {
      if (recordingType === 'video') {
        state.pendingVideoChunks.push(blob);
        logger.proctoring(`[ChunkUploader] Buffered early video chunk #${state.pendingVideoChunks.length - 1} (${(blob.size / 1024).toFixed(1)}KB) - waiting for start`);
      } else {
        state.pendingScreenChunks.push(blob);
        logger.proctoring(`[ChunkUploader] Buffered early screen chunk #${state.pendingScreenChunks.length - 1} (${(blob.size / 1024).toFixed(1)}KB) - waiting for start`);
      }
      return;
    }

    // Determine index based on total chunks for this type
    const index = recordingType === 'video' 
      ? state.videoChunksTotal 
      : state.screenChunksTotal;

    const item: ChunkQueueItem = {
      blob,
      index,
      recordingType,
      retryCount: 0,
      addedAt: Date.now(),
    };

    // Update total count
    if (recordingType === 'video') {
      state.videoChunksTotal++;
      state.videoQueue.push(item);
    } else {
      state.screenChunksTotal++;
      state.screenQueue.push(item);
    }

    logger.proctoring(`[ChunkUploader] Queued ${recordingType} chunk #${index} (${(blob.size / 1024).toFixed(1)}KB)`);
    notifyProgress();

    // Start processing if not already running
    processQueue();
  }, [processQueue, notifyProgress]);

  /**
   * Start the chunk uploader
   * Can optionally pass a sessionId to override the hook's session (useful when React state hasn't updated yet)
   */
  const start = useCallback((overrideSessionId?: string) => {
    const activeSessionId = overrideSessionId || sessionId;
    
    if (!enabled) {
      logger.proctoring('[ChunkUploader] Not starting - disabled');
      return;
    }
    
    if (!activeSessionId) {
      logger.proctoring('[ChunkUploader] Not starting - no session ID');
      return;
    }

    logger.proctoring(`[ChunkUploader] Starting for session ${activeSessionId}`);

    const state = stateRef.current;
    
    // Save pending chunks before resetting state
    const pendingVideo = [...state.pendingVideoChunks];
    const pendingScreen = [...state.pendingScreenChunks];
    
    state.isActive = true;
    state.sessionId = activeSessionId;
    state.attemptId = attemptId;
    state.sessionToken = sessionToken;
    state.videoQueue = [];
    state.screenQueue = [];
    state.pendingVideoChunks = [];
    state.pendingScreenChunks = [];
    state.videoChunksUploaded = 0;
    state.screenChunksUploaded = 0;
    state.videoChunksTotal = 0;
    state.screenChunksTotal = 0;
    state.videoBytesUploaded = 0;
    state.screenBytesUploaded = 0;
    state.failedChunks = [];

    // CRITICAL: Flush any pending chunks that were buffered before start
    if (pendingVideo.length > 0) {
      logger.proctoring(`[ChunkUploader] Flushing ${pendingVideo.length} pending video chunks`);
      pendingVideo.forEach(blob => queueChunk(blob, 'video'));
    }
    if (pendingScreen.length > 0) {
      logger.proctoring(`[ChunkUploader] Flushing ${pendingScreen.length} pending screen chunks`);
      pendingScreen.forEach(blob => queueChunk(blob, 'screen'));
    }

    logger.proctoring('[ChunkUploader] ✅ Started');
  }, [enabled, sessionId, attemptId, sessionToken, queueChunk]);

  /**
   * Stop accepting new chunks
   */
  const stop = useCallback(() => {
    logger.proctoring('[ChunkUploader] Stopping (no new chunks will be accepted)');
    stateRef.current.isActive = false;
  }, []);

  /**
   * Wait for all queued chunks to finish uploading
   */
  const waitForQueueEmpty = useCallback(async (): Promise<{
    success: boolean;
    videoUploaded: number;
    screenUploaded: number;
    totalBytes: number;
    failedCount: number;
  }> => {
    logger.proctoring('[ChunkUploader] Waiting for queue to empty...');
    
    const state = stateRef.current;
    state.isActive = false; // Stop accepting new chunks

    // Process remaining queue
    await processQueue();

    const result = {
      success: state.failedChunks.length === 0,
      videoUploaded: state.videoChunksUploaded,
      screenUploaded: state.screenChunksUploaded,
      totalBytes: state.videoBytesUploaded + state.screenBytesUploaded,
      failedCount: state.failedChunks.length,
    };

    logger.proctoring(`[ChunkUploader] Queue empty. Video: ${result.videoUploaded}/${state.videoChunksTotal}, Screen: ${result.screenUploaded}/${state.screenChunksTotal}`);
    
    if (result.failedCount > 0) {
      logger.warn(`[ChunkUploader] ${result.failedCount} chunks failed to upload`);
    }

    return result;
  }, [processQueue]);

  /**
   * Get upload statistics
   */
  const getStats = useCallback(() => {
    const state = stateRef.current;
    return {
      isActive: state.isActive,
      videoChunksUploaded: state.videoChunksUploaded,
      videoChunksTotal: state.videoChunksTotal,
      screenChunksUploaded: state.screenChunksUploaded,
      screenChunksTotal: state.screenChunksTotal,
      videoBytesUploaded: state.videoBytesUploaded,
      screenBytesUploaded: state.screenBytesUploaded,
      queueLength: state.videoQueue.length + state.screenQueue.length,
      failedChunks: state.failedChunks,
    };
  }, []);

  /**
   * Check if there are pending uploads
   */
  const hasPendingUploads = useCallback(() => {
    const state = stateRef.current;
    return state.videoQueue.length > 0 || state.screenQueue.length > 0 || isProcessingRef.current;
  }, []);

  // Update session info when props change
  useEffect(() => {
    if (sessionId && stateRef.current.isActive) {
      stateRef.current.sessionId = sessionId;
    }
  }, [sessionId]);

  useEffect(() => {
    stateRef.current.sessionToken = sessionToken;
  }, [sessionToken]);

  // Warn user if they try to leave with pending uploads
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = stateRef.current;
      if (state.isActive || state.videoQueue.length > 0 || state.screenQueue.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have pending recording uploads. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stateRef.current.isActive = false;
    };
  }, []);

  return {
    start,
    stop,
    queueChunk,
    waitForQueueEmpty,
    getProgress,
    getStats,
    hasPendingUploads,
  };
}

export default useChunkUploader;
