/**
 * Background Uploader for Proctoring Recordings
 * 
 * Uses DIRECT-TO-STORAGE uploads with signed URLs to bypass edge function memory limits.
 * This allows uploading large recordings (100MB+) without issues.
 * 
 * Flow:
 * 1. Request signed upload URL from edge function (tiny request)
 * 2. Upload directly to Supabase Storage (no memory limits)
 * 3. Confirm upload completion to update proctoring_sessions
 * 
 * Features:
 * - Progress tracking with real-time updates via XMLHttpRequest
 * - Background upload continuation via IndexedDB
 * - Notification on completion
 * 
 * RACE CONDITION HANDLING:
 * - Uses locks for IndexedDB operations
 * - Prevents concurrent upload processing
 * - Tracks operations for stuck detection
 */

import { logger } from '@/lib/logger';
import { updateUploadProgress, forceUpdateUploadProgress, getUploadProgress } from '@/lib/uploadProgressStore';
import { 
  withIndexedDBLock, 
  withUploadProcessingLock, 
  isUploadProcessingLocked,
  trackOperationStart,
  trackOperationEnd,
} from '@/lib/uploadLock';
import { supabase } from '@/integrations/supabase/client';
import { toBrowserStorageUrl, storageUploadHeaders } from '@/lib/publicStorageUrl';

const DB_NAME = 'proctoring-uploads-db';
const STORE_NAME = 'pending-uploads';
const DB_VERSION = 2; // Bumped version for new schema

// Track if processing is already happening (backup for lock)
let isProcessingUploads = false;

interface PendingUpload {
  id?: number;
  sessionId: string;
  recordingType: 'video' | 'screen';
  fileData: ArrayBuffer;
  mimeType: string;
  sessionToken?: string;
  attemptId?: string;
  createdAt: number;
  fileSize: number;
}

// Cached DB connection to avoid repeated opens
let cachedDB: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;
let indexedDBAvailable: boolean | null = null; // Cache availability check

// Check if IndexedDB is available (handles private browsing, etc.)
function checkIndexedDBAvailable(): boolean {
  if (indexedDBAvailable !== null) return indexedDBAvailable;
  
  try {
    if (!('indexedDB' in window) || !window.indexedDB) {
      logger.error('[BackgroundUploader] IndexedDB not available');
      indexedDBAvailable = false;
      return false;
    }
    indexedDBAvailable = true;
    return true;
  } catch (e) {
    logger.error('[BackgroundUploader] IndexedDB check failed:', e);
    indexedDBAvailable = false;
    return false;
  }
}

// Check if cached connection is still valid
function isDBConnectionValid(db: IDBDatabase | null): boolean {
  if (!db) return false;
  
  try {
    // Check if the connection is still open and has our store
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      return false;
    }
    // Try to create a transaction to verify connection is live
    const tx = db.transaction(STORE_NAME, 'readonly');
    tx.abort(); // Don't actually do anything
    return true;
  } catch (e) {
    // Connection is dead
    return false;
  }
}

// Initialize IndexedDB with connection caching and deduplication
function openDB(): Promise<IDBDatabase> {
  // Return cached connection if still valid
  if (isDBConnectionValid(cachedDB)) {
    return Promise.resolve(cachedDB!);
  }
  
  // If already opening, return the existing promise (prevents parallel opens)
  if (dbOpenPromise) {
    return dbOpenPromise;
  }
  
  // Clear stale cache
  cachedDB = null;
  
  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      logger.error('[BackgroundUploader] IndexedDB error:', request.error);
      cachedDB = null;
      dbOpenPromise = null;
      reject(request.error);
    };
    
    request.onsuccess = () => {
      cachedDB = request.result;
      dbOpenPromise = null;
      
      // Handle connection close/error - invalidate cache
      cachedDB.onclose = () => {
        logger.proctoring('[BackgroundUploader] IndexedDB connection closed');
        cachedDB = null;
      };
      cachedDB.onerror = (event) => {
        logger.error('[BackgroundUploader] IndexedDB connection error:', event);
        cachedDB = null;
      };
      cachedDB.onversionchange = () => {
        logger.proctoring('[BackgroundUploader] IndexedDB version change - closing');
        cachedDB?.close();
        cachedDB = null;
      };
      
      logger.proctoring('[BackgroundUploader] IndexedDB opened successfully');
      resolve(cachedDB);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Delete old store if exists (schema change)
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      logger.proctoring('[BackgroundUploader] Created object store (v2 - direct upload)');
    };
  });
  
  return dbOpenPromise;
}

// Show browser notification when uploads complete
async function showUploadCompleteNotification(): Promise<void> {
  try {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      new Notification('Recording Upload Complete', {
        body: 'Your interview recordings have been uploaded successfully.',
        icon: '/favicon.ico',
        tag: 'upload-complete',
      });
    }
  } catch (error) {
    logger.proctoring('[BackgroundUploader] Could not show notification:', error);
  }
}

// Register the service worker (kept for future background sync)
export async function registerUploadServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    logger.warn('[BackgroundUploader] Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/proctoring-upload-sw.js', {
      scope: '/'
    });
    logger.proctoring('[BackgroundUploader] Service Worker registered');
    return registration;
  } catch (error) {
    logger.error('[BackgroundUploader] Service Worker registration failed:', error);
    return null;
  }
}

// Queue a recording for upload - with IndexedDB lock
export async function queueRecordingUpload(
  sessionId: string,
  recordingType: 'video' | 'screen',
  blob: Blob,
  uploadUrl: string, // Kept for backward compatibility, but not used
  sessionToken?: string,
  attemptId?: string
): Promise<boolean> {
  const startTime = Date.now();
  logger.proctoring(`[BackgroundUploader] ═══════════════════════════════════════════════`);
  logger.proctoring(`[BackgroundUploader] Queueing ${recordingType.toUpperCase()} recording`);
  logger.proctoring(`[BackgroundUploader] Session: ${sessionId}`);
  logger.proctoring(`[BackgroundUploader] Size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB`);
  logger.proctoring(`[BackgroundUploader] Blob type: ${blob.type || 'unknown'}`);
  logger.proctoring(`[BackgroundUploader] ═══════════════════════════════════════════════`);
  
  // Check IndexedDB availability first
  if (!checkIndexedDBAvailable()) {
    logger.error('[BackgroundUploader] ❌ IndexedDB not available - cannot queue upload');
    logger.error('[BackgroundUploader] Possible causes:');
    logger.error('  1. Private/Incognito browsing mode');
    logger.error('  2. Browser storage disabled');
    logger.error('  3. Storage quota exceeded');
    // Still update progress to show failure
    if (recordingType === 'video') {
      forceUpdateUploadProgress({ hasVideo: true, videoStatus: 'failed', videoProgress: 0 });
    } else {
      forceUpdateUploadProgress({ hasScreen: true, screenStatus: 'failed', screenProgress: 0 });
    }
    return false;
  }
  
  if (blob.size === 0) {
    logger.error(`[BackgroundUploader] ❌ ${recordingType.toUpperCase()} Blob is EMPTY!`);
    logger.error('[BackgroundUploader] Recording was not captured or chunks were cleared');
    logger.error('[BackgroundUploader] Possible causes:');
    logger.error('  1. User stopped sharing screen during interview');
    logger.error('  2. MediaRecorder failed during recording');
    logger.error('  3. Browser tab memory pressure cleared chunks');
    logger.error('  4. Recording never started properly');
    return false;
  }
  
  // Initialize progress tracking - use force update for immediate feedback
  if (recordingType === 'video') {
    forceUpdateUploadProgress({ hasVideo: true, videoStatus: 'pending', videoProgress: 0 });
  } else {
    forceUpdateUploadProgress({ hasScreen: true, screenStatus: 'pending', screenProgress: 0 });
  }
  
  try {
    logger.proctoring(`[BackgroundUploader] Converting blob to ArrayBuffer...`);
    const arrayBuffer = await blob.arrayBuffer();
    const conversionTime = Date.now() - startTime;
    logger.proctoring(`[BackgroundUploader] ✅ Converted to ArrayBuffer: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB (${conversionTime}ms)`);
    
    if (arrayBuffer.byteLength === 0) {
      logger.error(`[BackgroundUploader] ❌ ArrayBuffer is empty after conversion!`);
      return false;
    }
    
    const upload: PendingUpload = {
      sessionId,
      recordingType,
      fileData: arrayBuffer,
      mimeType: blob.type || 'video/webm',
      sessionToken,
      attemptId,
      createdAt: Date.now(),
      fileSize: arrayBuffer.byteLength,
    };

    // Use lock for IndexedDB write operation
    logger.proctoring(`[BackgroundUploader] Acquiring IndexedDB lock...`);
    return await withIndexedDBLock(async () => {
      logger.proctoring(`[BackgroundUploader] Lock acquired, opening database...`);
      const db = await openDB();
      logger.proctoring(`[BackgroundUploader] Database opened, starting transaction...`);
      
      return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(upload);
        
        tx.onerror = () => {
          logger.error('[BackgroundUploader] ❌ Transaction error:', tx.error);
          logger.error('[BackgroundUploader] Possible causes:');
          logger.error('  1. Storage quota exceeded');
          logger.error('  2. Database corrupted');
          logger.error('  3. Concurrent access issue');
          reject(tx.error);
        };
        
        request.onerror = () => {
          logger.error('[BackgroundUploader] ❌ Failed to queue upload:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          const totalTime = Date.now() - startTime;
          logger.proctoring(`[BackgroundUploader] ✅ ${recordingType.toUpperCase()} queued successfully!`);
          logger.proctoring(`[BackgroundUploader] ID: ${request.result}, Total time: ${totalTime}ms`);
          resolve(true);
        };
        
        tx.oncomplete = async () => {
          // Register Background Sync after transaction completes
          logger.proctoring(`[BackgroundUploader] Transaction complete, registering background sync...`);
          await registerBackgroundSync();
        };
      });
    });
  } catch (error) {
    logger.error('[BackgroundUploader] ❌ Error queueing upload:', error);
    logger.error('[BackgroundUploader] Error type:', typeof error);
    logger.error('[BackgroundUploader] Error message:', error instanceof Error ? error.message : String(error));
    logger.error('[BackgroundUploader] This is likely why the upload shows 0%');
    return false;
  }
}

// Register Background Sync for reliable upload continuation
async function registerBackgroundSync(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) {
      logger.proctoring('[BackgroundUploader] Service Worker not supported - using direct upload only');
      return false;
    }
    
    const registration = await navigator.serviceWorker.ready;
    
    // Check if Background Sync is supported
    if (!('sync' in registration)) {
      logger.proctoring('[BackgroundUploader] Background Sync not supported - using direct upload only');
      return false;
    }
    
    // Register one-time sync
    await (registration as any).sync.register('proctoring-upload');
    logger.proctoring('[BackgroundUploader] ✅ Background Sync registered - uploads will continue even after browser closes');
    
    return true;
  } catch (error) {
    // Background Sync might fail due to permissions or browser restrictions
    // This is fine - direct upload will still work
    logger.proctoring('[BackgroundUploader] Background Sync registration failed (non-critical):', error);
    return false;
  }
}

// Trigger upload processing - with lock to prevent concurrent processing
export async function triggerBackgroundUpload(): Promise<void> {
  // Quick check before acquiring lock
  if (isProcessingUploads || isUploadProcessingLocked()) {
    logger.proctoring('[BackgroundUploader] Upload processing already in progress, skipping trigger');
    return;
  }
  
  logger.proctoring('[BackgroundUploader] Triggering background upload with direct-to-storage...');
  
  const result = await withUploadProcessingLock(async () => {
    isProcessingUploads = true;
    try {
      await processUploadsDirectly();
    } finally {
      isProcessingUploads = false;
    }
  });
  
  if (result === null) {
    logger.proctoring('[BackgroundUploader] Trigger skipped - another process is running');
  }
}

// Get count of pending uploads - with lock
export async function getPendingUploadCount(): Promise<number> {
  try {
    return await withIndexedDBLock(async () => {
      const db = await openDB();
      return new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    });
  } catch (error) {
    logger.error('[BackgroundUploader] Error getting pending count:', error);
    return 0;
  }
}

// Get Supabase URL for direct uploads
function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error('VITE_SUPABASE_URL environment variable is required');
  }
  return url;
}

// Request a signed upload URL from the edge function
async function getSignedUploadUrl(
  sessionId: string,
  recordingType: 'video' | 'screen',
  sessionToken?: string,
  attemptId?: string
): Promise<{ signedUrl: string; filePath: string; token: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-proctoring-upload-url', {
      body: { sessionId, recordingType, sessionToken, attemptId }
    });

    if (error) {
      logger.error('[BackgroundUploader] Failed to get signed URL:', error);
      return null;
    }

    if (!data?.signedUrl) {
      logger.error('[BackgroundUploader] No signed URL in response:', data);
      return null;
    }

    logger.proctoring('[BackgroundUploader] Got signed URL for:', data.filePath);
    return {
      signedUrl: toBrowserStorageUrl(data.signedUrl),
      filePath: data.filePath,
      token: data.token,
    };
  } catch (error) {
    logger.error('[BackgroundUploader] Error getting signed URL:', error);
    return null;
  }
}

// Confirm upload completion to backend
async function confirmUpload(
  sessionId: string,
  recordingType: 'video' | 'screen',
  filePath: string,
  fileSize: number,
  sessionToken?: string,
  attemptId?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('confirm-proctoring-upload', {
      body: { sessionId, recordingType, filePath, fileSize, sessionToken, attemptId }
    });

    if (error) {
      logger.error('[BackgroundUploader] Failed to confirm upload:', error);
      return false;
    }

    logger.proctoring('[BackgroundUploader] Upload confirmed:', data);
    return data?.success === true;
  } catch (error) {
    logger.error('[BackgroundUploader] Error confirming upload:', error);
    return false;
  }
}

// Upload directly to storage with real progress tracking
function uploadDirectToStorage(
  signedUrl: string,
  fileData: ArrayBuffer,
  mimeType: string,
  onProgress: (percent: number) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        logger.proctoring('[BackgroundUploader] Direct upload successful');
        resolve(true);
      } else {
        logger.error('[BackgroundUploader] Direct upload failed:', xhr.status, xhr.responseText);
        resolve(false);
      }
    });
    
    xhr.addEventListener('error', () => {
      logger.error('[BackgroundUploader] Direct upload network error');
      resolve(false);
    });
    
    xhr.addEventListener('timeout', () => {
      logger.error('[BackgroundUploader] Direct upload timeout');
      resolve(false);
    });
    
    // Set timeout based on file size (1 minute per 10MB, minimum 2 minutes)
    const fileSizeMB = fileData.byteLength / (1024 * 1024);
    xhr.timeout = Math.max(120000, Math.ceil(fileSizeMB / 10) * 60000);
    
    xhr.open('PUT', signedUrl);
    const headers = storageUploadHeaders(mimeType);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    
    // Send the file data directly
    xhr.send(new Blob([fileData], { type: mimeType }));
  });
}

// Maximum retry attempts for transient failures
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Process a single upload with direct-to-storage and retry logic
// Uses operation tracking for stuck detection
async function processSingleUpload(db: IDBDatabase, upload: PendingUpload, retryCount = 0): Promise<boolean> {
  const operationId = `upload-${upload.id}-${upload.recordingType}`;
  trackOperationStart(operationId, `upload-${upload.recordingType}`);
  
  logger.proctoring(`[BackgroundUploader] Processing upload ${upload.id}: ${upload.recordingType} (${(upload.fileSize / (1024 * 1024)).toFixed(2)}MB) - attempt ${retryCount + 1}/${MAX_RETRIES + 1}`);
  
  // Update progress to 'uploading' - use force update for status changes
  if (upload.recordingType === 'video') {
    forceUpdateUploadProgress({ videoStatus: 'uploading', videoProgress: 1 });
  } else {
    forceUpdateUploadProgress({ screenStatus: 'uploading', screenProgress: 1 });
  }
  
  // Validate upload data
  if (!upload.sessionId || !upload.recordingType || !upload.fileData) {
    logger.error(`[BackgroundUploader] Invalid upload data`);
    if (upload.recordingType === 'video') {
      forceUpdateUploadProgress({ videoStatus: 'failed', videoProgress: 0 });
    } else {
      forceUpdateUploadProgress({ screenStatus: 'failed', screenProgress: 0 });
    }
    trackOperationEnd(operationId);
    return false;
  }

  if (upload.fileData.byteLength === 0) {
    logger.error(`[BackgroundUploader] Upload ${upload.id} has empty file data - removing`);
    try {
      const deleteTx = db.transaction(STORE_NAME, 'readwrite');
      deleteTx.objectStore(STORE_NAME).delete(upload.id!);
    } catch (e) {
      logger.warn('[BackgroundUploader] Error deleting empty upload:', e);
    }
    trackOperationEnd(operationId);
    return false;
  }
  
  try {
    // Step 1: Get signed upload URL
    logger.proctoring('[BackgroundUploader] Step 1: Getting signed URL...');
    const signedData = await getSignedUploadUrl(
      upload.sessionId,
      upload.recordingType,
      upload.sessionToken,
      upload.attemptId
    );
    
    if (!signedData) {
      logger.error('[BackgroundUploader] Failed to get signed URL');
      
      // Retry for transient failures
      if (retryCount < MAX_RETRIES) {
        logger.proctoring(`[BackgroundUploader] Retrying in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        trackOperationEnd(operationId);
        return processSingleUpload(db, upload, retryCount + 1);
      }
      
      if (upload.recordingType === 'video') {
        forceUpdateUploadProgress({ videoStatus: 'failed' });
      } else {
        forceUpdateUploadProgress({ screenStatus: 'failed' });
      }
      trackOperationEnd(operationId);
      return false;
    }
    
    // Step 2: Upload directly to storage with progress
    logger.proctoring('[BackgroundUploader] Step 2: Uploading directly to storage...');
    const uploadSuccess = await uploadDirectToStorage(
      signedData.signedUrl,
      upload.fileData,
      upload.mimeType,
      (percent) => {
        // Progress updates can be batched (not force)
        if (upload.recordingType === 'video') {
          updateUploadProgress({ videoProgress: percent });
        } else {
          updateUploadProgress({ screenProgress: percent });
        }
      }
    );
    
    if (!uploadSuccess) {
      logger.error('[BackgroundUploader] Direct storage upload failed');
      
      // Retry for transient failures
      if (retryCount < MAX_RETRIES) {
        logger.proctoring(`[BackgroundUploader] Retrying in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        trackOperationEnd(operationId);
        return processSingleUpload(db, upload, retryCount + 1);
      }
      
      if (upload.recordingType === 'video') {
        forceUpdateUploadProgress({ videoStatus: 'failed' });
      } else {
        forceUpdateUploadProgress({ screenStatus: 'failed' });
      }
      trackOperationEnd(operationId);
      return false;
    }
    
    // Step 3: Confirm upload to backend
    logger.proctoring('[BackgroundUploader] Step 3: Confirming upload...');
    const confirmed = await confirmUpload(
      upload.sessionId,
      upload.recordingType,
      signedData.filePath,
      upload.fileSize,
      upload.sessionToken,
      upload.attemptId
    );
    
    if (!confirmed) {
      logger.warn('[BackgroundUploader] Upload confirmation failed, but file is in storage');
      // Still consider it a success since file is uploaded
    }
    
    // Success! Remove from queue with lock
    try {
      await withIndexedDBLock(async () => {
        const deleteTx = db.transaction(STORE_NAME, 'readwrite');
        return new Promise<void>((resolve, reject) => {
          const request = deleteTx.objectStore(STORE_NAME).delete(upload.id!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
    } catch (e) {
      logger.warn('[BackgroundUploader] Error removing completed upload from queue:', e);
    }
    
    logger.proctoring(`[BackgroundUploader] ✅ Successfully uploaded: ${upload.recordingType}`);
    
    // Update progress to complete - use force for status change
    if (upload.recordingType === 'video') {
      forceUpdateUploadProgress({ videoStatus: 'completed', videoProgress: 100 });
    } else {
      forceUpdateUploadProgress({ screenStatus: 'completed', screenProgress: 100 });
    }
    
    trackOperationEnd(operationId);
    return true;
    
  } catch (error) {
    logger.error(`[BackgroundUploader] Error processing upload ${upload.id}:`, error);
    
    // Retry for transient failures (network errors, etc.)
    if (retryCount < MAX_RETRIES) {
      logger.proctoring(`[BackgroundUploader] Retrying after error in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      trackOperationEnd(operationId);
      return processSingleUpload(db, upload, retryCount + 1);
    }
    
    if (upload.recordingType === 'video') {
      forceUpdateUploadProgress({ videoStatus: 'failed' });
    } else {
      forceUpdateUploadProgress({ screenStatus: 'failed' });
    }
    trackOperationEnd(operationId);
    return false;
  }
}

// Process all pending uploads - PARALLEL for speed but with proper coordination
async function processUploadsDirectly(): Promise<void> {
  logger.proctoring('[BackgroundUploader] Processing uploads with PARALLEL direct-to-storage...');
  
  try {
    // Get all uploads with lock to prevent concurrent reads
    const uploads = await withIndexedDBLock(async () => {
      const db = await openDB();
      return new Promise<PendingUpload[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    });

    logger.proctoring(`[BackgroundUploader] Found ${uploads.length} pending uploads`);

    if (!uploads || uploads.length === 0) return;

    // Get fresh DB connection for processing
    const db = await openDB();

    // Process uploads in PARALLEL for faster completion
    // Video and screen recordings upload simultaneously
    logger.proctoring('[BackgroundUploader] 🚀 Starting parallel uploads...');
    
    const results = await Promise.allSettled(
      uploads.map(upload => processSingleUpload(db, upload))
    );
    
    // Log results
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length;
    
    logger.proctoring(`[BackgroundUploader] Parallel uploads complete: ${succeeded} succeeded, ${failed} failed`);
    
    // Check if all uploads completed
    const progress = getUploadProgress();
    if (progress.isComplete) {
      logger.proctoring('[BackgroundUploader] ✅ All uploads completed successfully!');
      await showUploadCompleteNotification();
    }
  } catch (error) {
    logger.error('[BackgroundUploader] Error in direct processing:', error);
  }
}

// Clear all pending uploads - with lock
export async function clearPendingUploads(): Promise<void> {
  try {
    await withIndexedDBLock(async () => {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const request = tx.objectStore(STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    logger.proctoring('[BackgroundUploader] Cleared all pending uploads');
  } catch (error) {
    logger.error('[BackgroundUploader] Error clearing uploads:', error);
  }
}
