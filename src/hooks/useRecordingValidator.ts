/**
 * useRecordingValidator
 * 
 * Validates that MediaRecorder actually produces data before allowing interview to start.
 * Also tests upload connectivity by sending a small test chunk to storage.
 * 
 * This prevents scenarios where:
 * 1. MediaRecorder initializes but fails to produce data
 * 2. Storage is unreachable (network/auth issues)
 * 3. Browser doesn't support required codecs
 * 4. IndexedDB is unavailable (private browsing)
 */

import { useState, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { detectBrowserCapabilities, BrowserCapabilities } from '@/lib/recordingCapabilities';
import { checkNetworkAvailable } from '@/hooks/useNetworkStatus';
import { toBrowserStorageUrl, storageUploadHeaders } from '@/lib/publicStorageUrl';

export interface RecordingValidationResult {
  success: boolean;
  videoProducedData: boolean;
  screenProducedData: boolean;
  uploadTestPassed: boolean;
  browserCapabilities?: BrowserCapabilities;
  error?: string;
  warnings?: string[];
}

export interface RecordingValidationProgress {
  stage: 'idle' | 'capabilities' | 'recording' | 'validating' | 'upload-test' | 'complete' | 'failed';
  message: string;
}

interface UseRecordingValidatorOptions {
  testDurationMs?: number; // Default 3000ms (3 seconds)
  minBlobSizeBytes?: number; // Minimum blob size to consider valid (default 1000 bytes)
  skipCapabilityCheck?: boolean; // Skip browser capability check (default false)
}

export function useRecordingValidator(options: UseRecordingValidatorOptions = {}) {
  const { 
    testDurationMs = 3000, 
    minBlobSizeBytes = 1000,
    skipCapabilityCheck = false
  } = options;
  
  const [progress, setProgress] = useState<RecordingValidationProgress>({
    stage: 'idle',
    message: ''
  });
  const [isValidating, setIsValidating] = useState(false);
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Run a 3-second test recording to verify MediaRecorder produces data
   */
  const runTestRecording = useCallback(async (
    videoStream: MediaStream,
    screenStream: MediaStream
  ): Promise<{ videoBlob: Blob | null; screenBlob: Blob | null; error?: string }> => {
    logger.proctoring('[RecordingValidator] Starting test recording...');
    
    const videoChunks: Blob[] = [];
    const screenChunks: Blob[] = [];
    let videoError: string | undefined;
    let screenError: string | undefined;

    // Test video recorder
    let videoRecorder: MediaRecorder | null = null;
    try {
      videoRecorder = new MediaRecorder(videoStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      
      videoRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunks.push(event.data);
        }
      };
      
      videoRecorder.onerror = (e) => {
        logger.error('[RecordingValidator] Video recorder error:', e);
        videoError = 'Video recorder error';
      };
      
      videoRecorder.start(100); // Collect data every 100ms for quick feedback
    } catch (err: any) {
      logger.error('[RecordingValidator] Failed to start video recorder:', err);
      videoError = err.message || 'Failed to initialize video recorder';
    }

    // Test screen recorder
    let screenRecorder: MediaRecorder | null = null;
    try {
      screenRecorder = new MediaRecorder(screenStream, {
        mimeType: 'video/webm;codecs=vp8'
      });
      
      screenRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          screenChunks.push(event.data);
        }
      };
      
      screenRecorder.onerror = (e) => {
        logger.error('[RecordingValidator] Screen recorder error:', e);
        screenError = 'Screen recorder error';
      };
      
      screenRecorder.start(100);
    } catch (err: any) {
      logger.error('[RecordingValidator] Failed to start screen recorder:', err);
      screenError = err.message || 'Failed to initialize screen recorder';
    }

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDurationMs));

    // Stop recorders
    if (videoRecorder && videoRecorder.state === 'recording') {
      videoRecorder.stop();
    }
    if (screenRecorder && screenRecorder.state === 'recording') {
      screenRecorder.stop();
    }

    // Small delay to ensure final data is collected
    await new Promise(resolve => setTimeout(resolve, 200));

    // Create blobs from chunks
    const videoBlob = videoChunks.length > 0 
      ? new Blob(videoChunks, { type: 'video/webm' }) 
      : null;
    const screenBlob = screenChunks.length > 0 
      ? new Blob(screenChunks, { type: 'video/webm' }) 
      : null;

    logger.proctoring('[RecordingValidator] Test recording complete:', {
      videoChunks: videoChunks.length,
      videoSize: videoBlob?.size || 0,
      screenChunks: screenChunks.length,
      screenSize: screenBlob?.size || 0
    });

    const error = videoError || screenError;
    return { videoBlob, screenBlob, error };
  }, [testDurationMs]);

  /**
   * Test upload connectivity by requesting a signed URL and uploading a small test payload
   */
  const runUploadTest = useCallback(async (
    sessionToken?: string,
    attemptId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    logger.proctoring('[RecordingValidator] Testing upload connectivity...');
    
    try {
      // Create a small test payload (1KB of data)
      const testPayload = new Blob([new Uint8Array(1024).fill(0)], { type: 'application/octet-stream' });
      
      // Request a signed upload URL for a test chunk
      // We use chunk index -1 to indicate this is a test upload
      const { data, error } = await invokeFunction('get-chunk-upload-url', {
        body: {
          sessionId: 'test-validation',
          recordingType: 'video',
          chunkIndex: -1, // Special test index
          sessionToken,
          attemptId,
          isTest: true // Flag to skip database operations
        }
      });

      if (error) {
        logger.error('[RecordingValidator] Upload URL request failed:', error);
        return { success: false, error: 'Could not connect to upload server' };
      }

      if (!data?.signedUrl) {
        logger.error('[RecordingValidator] No signed URL returned');
        return { success: false, error: 'Upload server returned invalid response' };
      }

      // Test the upload with a small payload
      const uploadResponse = await fetch(toBrowserStorageUrl(data.signedUrl), {
        method: 'PUT',
        body: testPayload,
        headers: storageUploadHeaders('application/octet-stream'),
      });

      if (!uploadResponse.ok) {
        logger.error('[RecordingValidator] Test upload failed:', uploadResponse.status);
        return { success: false, error: `Upload test failed (status ${uploadResponse.status})` };
      }

      logger.proctoring('[RecordingValidator] Upload connectivity test passed');
      return { success: true };
    } catch (err: any) {
      logger.error('[RecordingValidator] Upload test error:', err);
      return { success: false, error: err.message || 'Upload connectivity test failed' };
    }
  }, []);

  /**
   * Main validation function - run before allowing interview to start
   */
  const validate = useCallback(async (
    videoStream: MediaStream,
    screenStream: MediaStream,
    sessionToken?: string,
    attemptId?: string
  ): Promise<RecordingValidationResult> => {
    setIsValidating(true);
    abortControllerRef.current = new AbortController();
    const warnings: string[] = [];

    try {
      // Stage 0: Check network connectivity
      if (!checkNetworkAvailable()) {
        const error = 'No internet connection. Please check your network and try again.';
        setProgress({ stage: 'failed', message: error });
        return {
          success: false,
          videoProducedData: false,
          screenProducedData: false,
          uploadTestPassed: false,
          error
        };
      }

      // Stage 1: Browser capabilities check (lightweight, ~50ms)
      let browserCapabilities: BrowserCapabilities | undefined;
      if (!skipCapabilityCheck) {
        setProgress({ stage: 'capabilities', message: 'Checking browser capabilities...' });
        browserCapabilities = await detectBrowserCapabilities();
        setCapabilities(browserCapabilities);
        
        // Collect warnings but don't fail on non-critical issues
        warnings.push(...browserCapabilities.warnings);
        
        // Fail on critical missing capabilities
        if (!browserCapabilities.hasMediaRecorder) {
          const error = 'Your browser does not support video recording. Please use Chrome, Firefox, or Edge.';
          setProgress({ stage: 'failed', message: error });
          return {
            success: false,
            videoProducedData: false,
            screenProducedData: false,
            uploadTestPassed: false,
            browserCapabilities,
            error,
            warnings
          };
        }
        
        // Warn about IndexedDB (non-blocking)
        if (!browserCapabilities.hasIndexedDB) {
          warnings.push('Offline backup storage unavailable (private browsing mode?)');
        }
        
        // Warn about low storage (non-blocking)
        if (browserCapabilities.estimatedStorageQuotaMB !== null && browserCapabilities.estimatedStorageQuotaMB < 200) {
          warnings.push(`Low storage available (${browserCapabilities.estimatedStorageQuotaMB}MB) - long recordings may fail`);
        }
      }

      // Stage 2: Test recording
      setProgress({ stage: 'recording', message: 'Testing recording capability...' });
      
      const recordingResult = await runTestRecording(videoStream, screenStream);
      
      if (recordingResult.error) {
        setProgress({ stage: 'failed', message: recordingResult.error });
        return {
          success: false,
          videoProducedData: false,
          screenProducedData: false,
          uploadTestPassed: false,
          browserCapabilities,
          error: recordingResult.error,
          warnings
        };
      }

      // Stage 3: Validate blob sizes
      setProgress({ stage: 'validating', message: 'Verifying recording data...' });
      
      const videoProducedData = (recordingResult.videoBlob?.size || 0) >= minBlobSizeBytes;
      const screenProducedData = (recordingResult.screenBlob?.size || 0) >= minBlobSizeBytes;

      if (!videoProducedData) {
        const error = 'Camera recording test failed - no video data produced. Please check your camera and refresh.';
        setProgress({ stage: 'failed', message: error });
        return {
          success: false,
          videoProducedData: false,
          screenProducedData,
          uploadTestPassed: false,
          browserCapabilities,
          error,
          warnings
        };
      }

      if (!screenProducedData) {
        const error = 'Screen recording test failed - no screen data produced. Please re-share your screen and try again.';
        setProgress({ stage: 'failed', message: error });
        return {
          success: false,
          videoProducedData,
          screenProducedData: false,
          uploadTestPassed: false,
          browserCapabilities,
          error,
          warnings
        };
      }

      // Stage 4: Test upload connectivity
      setProgress({ stage: 'upload-test', message: 'Testing upload connection...' });
      
      const uploadResult = await runUploadTest(sessionToken, attemptId);
      
      if (!uploadResult.success) {
        const error = uploadResult.error || 'Upload connectivity test failed. Please check your internet connection.';
        setProgress({ stage: 'failed', message: error });
        return {
          success: false,
          videoProducedData: true,
          screenProducedData: true,
          uploadTestPassed: false,
          browserCapabilities,
          error,
          warnings
        };
      }

      // All tests passed
      setProgress({ stage: 'complete', message: 'All checks passed!' });
      
      logger.proctoring('[RecordingValidator] All validation checks passed', { 
        warningCount: warnings.length,
        warnings 
      });
      
      return {
        success: true,
        videoProducedData: true,
        screenProducedData: true,
        uploadTestPassed: true,
        browserCapabilities,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (err: any) {
      const error = err.message || 'Validation failed unexpectedly';
      logger.error('[RecordingValidator] Validation error:', err);
      setProgress({ stage: 'failed', message: error });
      return {
        success: false,
        videoProducedData: false,
        screenProducedData: false,
        uploadTestPassed: false,
        error
      };
    } finally {
      setIsValidating(false);
      abortControllerRef.current = null;
    }
  }, [runTestRecording, runUploadTest, minBlobSizeBytes, skipCapabilityCheck]);

  /**
   * Cancel ongoing validation
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsValidating(false);
    setProgress({ stage: 'idle', message: '' });
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsValidating(false);
    setProgress({ stage: 'idle', message: '' });
    setCapabilities(null);
  }, []);

  return {
    validate,
    cancel,
    reset,
    isValidating,
    progress,
    capabilities
  };
}
