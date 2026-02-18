/**
 * Recording Capabilities Detection
 * 
 * Lightweight utilities to detect browser recording capabilities
 * before starting the interview. Run once during pre-checks.
 */

import { logger } from '@/lib/logger';

export interface CodecSupport {
  preferredVideoCodec: string;
  preferredAudioCodec: string;
  mimeType: string;
  isOptimal: boolean;
  fallbackUsed: boolean;
  warnings: string[];
}

export interface BrowserCapabilities {
  hasMediaRecorder: boolean;
  hasGetUserMedia: boolean;
  hasGetDisplayMedia: boolean;
  hasIndexedDB: boolean;
  estimatedStorageQuotaMB: number | null;
  codecSupport: CodecSupport;
  warnings: string[];
}

// Preferred codecs in order of preference
const PREFERRED_VIDEO_CODECS = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4'
];

const PREFERRED_SCREEN_CODECS = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

/**
 * Detect the best supported codec for video recording
 */
export function detectBestCodec(includeAudio: boolean = true): CodecSupport {
  const warnings: string[] = [];
  const codecs = includeAudio ? PREFERRED_VIDEO_CODECS : PREFERRED_SCREEN_CODECS;
  
  if (typeof MediaRecorder === 'undefined') {
    return {
      preferredVideoCodec: '',
      preferredAudioCodec: '',
      mimeType: '',
      isOptimal: false,
      fallbackUsed: false,
      warnings: ['MediaRecorder not supported in this browser']
    };
  }

  let selectedMimeType = '';
  let fallbackUsed = false;

  for (let i = 0; i < codecs.length; i++) {
    if (MediaRecorder.isTypeSupported(codecs[i])) {
      selectedMimeType = codecs[i];
      if (i > 0) {
        fallbackUsed = true;
        warnings.push(`Using fallback codec: ${codecs[i]} (preferred: ${codecs[0]})`);
      }
      break;
    }
  }

  if (!selectedMimeType) {
    warnings.push('No supported video codec found - recording may fail');
  }

  // Check for VP9 (optimal) vs VP8 (acceptable)
  const isOptimal = selectedMimeType.includes('vp9');
  
  if (!isOptimal && selectedMimeType) {
    warnings.push('VP9 codec not available - using VP8 which has lower compression');
  }

  logger.proctoring('[CodecDetection] Selected codec:', selectedMimeType, { isOptimal, fallbackUsed });

  return {
    preferredVideoCodec: selectedMimeType.includes('vp9') ? 'vp9' : selectedMimeType.includes('vp8') ? 'vp8' : 'unknown',
    preferredAudioCodec: selectedMimeType.includes('opus') ? 'opus' : 'default',
    mimeType: selectedMimeType,
    isOptimal,
    fallbackUsed,
    warnings
  };
}

/**
 * Check IndexedDB availability
 */
export async function checkIndexedDBAvailability(): Promise<{ available: boolean; error?: string }> {
  try {
    if (!window.indexedDB) {
      return { available: false, error: 'IndexedDB not supported' };
    }

    // Try to open a test database
    return new Promise((resolve) => {
      const request = indexedDB.open('__capability_test__', 1);
      
      request.onerror = () => {
        resolve({ available: false, error: 'IndexedDB blocked (possibly private browsing)' });
      };
      
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase('__capability_test__');
        resolve({ available: true });
      };

      // Timeout after 2 seconds
      setTimeout(() => {
        resolve({ available: false, error: 'IndexedDB timeout' });
      }, 2000);
    });
  } catch (err: any) {
    return { available: false, error: err.message };
  }
}

/**
 * Check estimated storage quota
 */
export async function checkStorageQuota(): Promise<number | null> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const quotaMB = estimate.quota ? Math.floor(estimate.quota / (1024 * 1024)) : null;
      const usageMB = estimate.usage ? Math.floor(estimate.usage / (1024 * 1024)) : 0;
      const availableMB = quotaMB !== null ? quotaMB - usageMB : null;
      
      logger.proctoring('[StorageQuota] Estimated:', { quotaMB, usageMB, availableMB });
      return availableMB;
    }
  } catch (err) {
    logger.warn('[StorageQuota] Failed to estimate:', err);
  }
  return null;
}

/**
 * Comprehensive browser capabilities check (run once during pre-checks)
 */
export async function detectBrowserCapabilities(): Promise<BrowserCapabilities> {
  const warnings: string[] = [];

  // Check basic APIs
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasGetDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

  if (!hasMediaRecorder) warnings.push('MediaRecorder API not available');
  if (!hasGetUserMedia) warnings.push('Camera access API not available');
  if (!hasGetDisplayMedia) warnings.push('Screen sharing API not available');

  // Check IndexedDB
  const indexedDBResult = await checkIndexedDBAvailability();
  if (!indexedDBResult.available) {
    warnings.push(`IndexedDB unavailable: ${indexedDBResult.error}`);
  }

  // Check storage quota
  const estimatedStorageQuotaMB = await checkStorageQuota();
  if (estimatedStorageQuotaMB !== null && estimatedStorageQuotaMB < 500) {
    warnings.push(`Low storage available: ${estimatedStorageQuotaMB}MB`);
  }

  // Check codec support
  const codecSupport = detectBestCodec(true);
  warnings.push(...codecSupport.warnings);

  logger.proctoring('[BrowserCapabilities] Detected:', {
    hasMediaRecorder,
    hasGetUserMedia,
    hasGetDisplayMedia,
    hasIndexedDB: indexedDBResult.available,
    estimatedStorageQuotaMB,
    codec: codecSupport.mimeType,
    warningCount: warnings.length
  });

  return {
    hasMediaRecorder,
    hasGetUserMedia,
    hasGetDisplayMedia,
    hasIndexedDB: indexedDBResult.available,
    estimatedStorageQuotaMB,
    codecSupport,
    warnings
  };
}
