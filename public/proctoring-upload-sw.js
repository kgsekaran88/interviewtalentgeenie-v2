// Service Worker for Background Proctoring Recording Uploads
// This service worker handles uploads even after page navigation using Background Sync API
// Uses direct-to-storage uploads with signed URLs (no memory limits)

const DB_NAME = 'proctoring-uploads-db';
const STORE_NAME = 'pending-uploads';
const DB_VERSION = 2; // Match main app version

// Supabase config - set dynamically via CONFIG message from main app
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
  });
}

// Get all pending uploads
async function getPendingUploads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Delete a completed upload
async function deleteUpload(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get signed upload URL from edge function
async function getSignedUploadUrl(sessionId, recordingType, sessionToken, attemptId) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-proctoring-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ sessionId, recordingType, sessionToken, attemptId })
    });

    if (!response.ok) {
      console.error('[SW] Failed to get signed URL:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data.signedUrl) {
      console.error('[SW] No signed URL in response');
      return null;
    }

    return { signedUrl: data.signedUrl, filePath: data.filePath, token: data.token };
  } catch (error) {
    console.error('[SW] Error getting signed URL:', error);
    return null;
  }
}

// Confirm upload completion to backend
async function confirmUpload(sessionId, recordingType, filePath, fileSize, sessionToken, attemptId) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/confirm-proctoring-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ sessionId, recordingType, filePath, fileSize, sessionToken, attemptId })
    });

    if (!response.ok) {
      console.error('[SW] Failed to confirm upload:', response.status);
      return false;
    }

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[SW] Error confirming upload:', error);
    return false;
  }
}

// Upload directly to storage
async function uploadToStorage(signedUrl, fileData, mimeType) {
  try {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType
      },
      body: new Blob([fileData], { type: mimeType })
    });

    return response.ok;
  } catch (error) {
    console.error('[SW] Direct upload error:', error);
    return false;
  }
}

// Upload a single recording using direct-to-storage method
async function uploadRecording(upload) {
  console.log('[SW] Uploading recording:', upload.id, upload.recordingType, `(${(upload.fileSize / (1024 * 1024)).toFixed(2)}MB)`);
  
  if (!upload.fileData || upload.fileData.byteLength === 0) {
    console.error('[SW] Empty file data - removing from queue');
    await deleteUpload(upload.id);
    return { success: false, error: 'Empty file' };
  }

  try {
    // Step 1: Get signed URL
    console.log('[SW] Step 1: Getting signed URL...');
    const signedData = await getSignedUploadUrl(
      upload.sessionId,
      upload.recordingType,
      upload.sessionToken,
      upload.attemptId
    );
    
    if (!signedData) {
      return { success: false, error: 'Failed to get signed URL' };
    }

    // Step 2: Upload directly to storage
    console.log('[SW] Step 2: Uploading to storage...');
    const uploadSuccess = await uploadToStorage(
      signedData.signedUrl,
      upload.fileData,
      upload.mimeType || 'video/webm'
    );
    
    if (!uploadSuccess) {
      return { success: false, error: 'Storage upload failed' };
    }

    // Step 3: Confirm upload
    console.log('[SW] Step 3: Confirming upload...');
    await confirmUpload(
      upload.sessionId,
      upload.recordingType,
      signedData.filePath,
      upload.fileSize,
      upload.sessionToken,
      upload.attemptId
    );

    // Success - delete from queue
    await deleteUpload(upload.id);
    console.log('[SW] ✅ Successfully uploaded:', upload.recordingType);
    
    return { success: true };
  } catch (error) {
    console.error('[SW] Upload error:', error);
    return { success: false, error: error.message };
  }
}

// Process all pending uploads in PARALLEL for speed
async function processPendingUploads() {
  console.log('[SW] Processing pending uploads with PARALLEL direct-to-storage...');
  
  try {
    const uploads = await getPendingUploads();
    console.log('[SW] Found pending uploads:', uploads.length);
    
    if (uploads.length === 0) return;
    
    // Process uploads in PARALLEL for faster completion
    console.log('[SW] 🚀 Starting parallel uploads...');
    
    const results = await Promise.allSettled(
      uploads.map(upload => uploadRecording(upload))
    );
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    console.log(`[SW] Parallel uploads complete: ${succeeded} succeeded, ${failed} failed`);
    
    // Show notification if supported
    if (self.registration.showNotification) {
      self.registration.showNotification('Recording Upload Complete', {
        body: 'Your interview recordings have been uploaded successfully.',
        icon: '/favicon.ico',
        tag: 'upload-complete'
      });
    }
  } catch (error) {
    console.error('[SW] Error processing uploads:', error);
  }
}

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data.type);
  
  if (event.data.type === 'CONFIG') {
    SUPABASE_URL = event.data.supabaseUrl || SUPABASE_URL;
    SUPABASE_ANON_KEY = event.data.supabaseAnonKey || SUPABASE_ANON_KEY;
    console.log('[SW] Config updated, SUPABASE_URL:', SUPABASE_URL ? 'set' : 'empty');
  }
  
  if (event.data.type === 'PROCESS_UPLOADS') {
    event.waitUntil(processPendingUploads());
  }
  
  if (event.data.type === 'CHECK_STATUS') {
    event.waitUntil(
      getPendingUploads().then(uploads => {
        event.ports[0].postMessage({ pendingCount: uploads.length });
      })
    );
  }
});

// Handle fetch events - let all requests pass through normally
self.addEventListener('fetch', (event) => {
  // We handle uploads via IndexedDB, not fetch interception
});

// Background Sync - triggered when connectivity is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'proctoring-upload') {
    console.log('[SW] 🔄 Background Sync triggered - processing uploads');
    event.waitUntil(processPendingUploads());
  }
});

// Periodic Sync - for long-term background processing (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'proctoring-upload-sync') {
    console.log('[SW] 🔄 Periodic sync triggered');
    event.waitUntil(processPendingUploads());
  }
});