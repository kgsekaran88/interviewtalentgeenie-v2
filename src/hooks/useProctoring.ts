import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { detectFaces, startContinuousDetection, initializeFaceDetection } from '@/lib/faceDetection';
import { startContinuousGazeDetection, GazeResult, cleanupGazeDetection, isGazeDetectionAvailable } from '@/lib/gazeDetection';
import { VoiceAnalysisResult } from '@/lib/voiceAnalysis';
import { LivenessDetector, LivenessResult, createLivenessDetector } from '@/lib/livenessDetection';
import { FaceVerifier, FaceVerificationResult, createFaceVerifier } from '@/lib/faceVerification';
import { EnhancedVoiceAnalyzer, EnhancedVoiceResult, createEnhancedVoiceAnalyzer } from '@/lib/enhancedVoiceAnalysis';
import { queueRecordingUpload, triggerBackgroundUpload, registerUploadServiceWorker } from '@/lib/backgroundUploader';
import { logger } from '@/lib/logger';
import { useChunkUploader, ChunkUploadProgress } from '@/hooks/useChunkUploader';
import { toBrowserStorageUrl, storageUploadHeaders } from '@/lib/publicStorageUrl';

/** Kong requires apikey on Edge Function calls (candidates often have no user JWT). */
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
function edgeFunctionHeaders(json = true): HeadersInit {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

interface ProctoringViolation {
  timestamp: string;
  type: 'multiple_persons' | 'multiple_voices' | 'tab_switch' | 'look_away' | 'copy_attempt' | 'eye_movement' | 'liveness_fail' | 'person_swap' | 'silence_anomaly' | 'phone_detected' | 'prohibited_object' | 'multiple_monitors' | 'print_screen' | 'virtual_machine' | 'suspicious_typing' | 'audio_playback' | 'screen_share_stopped';
  severity: 'low' | 'medium' | 'high';
  details: string;
  videoTimestamp?: number;
  screenshotUrl?: string; // Camera screenshot URL
  screenScreenshotUrl?: string; // Screen recording screenshot URL
  metadata?: any;
}

// Phase 2 enhanced state
interface Phase2State {
  livenessResult?: LivenessResult;
  faceVerificationResult?: FaceVerificationResult;
  enhancedVoiceResult?: EnhancedVoiceResult;
}

interface ProctoringState {
  sessionId: string | null;
  isRecording: boolean;
  violations: ProctoringViolation[];
  videoStream: MediaStream | null;
  screenStream: MediaStream | null;
}

/**
 * Configuration for proctoring - controls which features run during interview vs post-interview
 * 
 * PERFORMANCE OPTIMIZATION:
 * Heavy AI analysis (face detection, object detection) is deferred to post-interview
 * to ensure smooth candidate experience. Only lightweight checks run during interview.
 */
export interface ProctoringConfig {
  /** If true, skip heavy AI analysis (face/object detection) during interview - analyze recorded video later */
  deferHeavyAnalysis: boolean;
}

/** Result of upload queuing - indicates what recordings were successfully queued for background upload */
export interface UploadQueueResult {
  videoQueued: boolean;
  screenQueued: boolean;
  videoHadChunks: boolean;
  screenHadChunks: boolean;
}

const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  deferHeavyAnalysis: true, // Default: defer heavy AI to post-interview for better candidate experience
};

export const useProctoring = (
  attemptId: string, 
  attemptType: 'interview' | 'learning' | 'certification',
  config: ProctoringConfig = DEFAULT_PROCTORING_CONFIG,
  sessionToken?: string // Optional session token for unauthenticated candidate uploads
) => {
  const [state, setState] = useState<ProctoringState & Phase2State & { eyeGaze?: any; voiceAnalysis?: VoiceAnalysisResult }>({
    sessionId: null,
    isRecording: false,
    violations: [],
    videoStream: null,
    screenStream: null,
  });
  
  // Store config in ref for access in callbacks
  const configRef = useRef(config);
  
  // Store session token in ref for access in async callbacks
  const sessionTokenRef = useRef<string | undefined>(sessionToken);
  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const screenChunksRef = useRef<Blob[]>([]);
  const lastActivityRef = useRef<number>(Date.now());
  const faceDetectionCleanupRef = useRef<(() => void) | null>(null);
  
  // Chunked upload control - enabled by default for progressive background uploads
  const useChunkedUploadRef = useRef<boolean>(true);
  // Track if chunk uploader has been started for this session
  const chunkUploaderStartedRef = useRef<boolean>(false);
  
  // Initialize chunk uploader hook - pass session info as props
  // Note: sessionId comes from state, so we pass null initially and update via start() when session is created
  const chunkUploader = useChunkUploader({
    sessionId: state.sessionId,
    attemptId,
    sessionToken,
    enabled: useChunkedUploadRef.current,
    onProgress: (progress) => {
      logger.proctoring(`[ChunkUploader] Progress - Video: ${progress.video.uploaded}/${progress.video.total}, Screen: ${progress.screen.uploaded}/${progress.screen.total}`);
    },
  });
  
  // Store chunk uploader in a ref for access in MediaRecorder callbacks
  const chunkUploaderRef = useRef(chunkUploader);
  chunkUploaderRef.current = chunkUploader;
  
  const gazeDetectionCleanupRef = useRef<(() => void) | null>(null);
  const lastPersonCountRef = useRef<number>(1);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const lookAwayStartRef = useRef<number | null>(null);
  const gazeViolationStartRef = useRef<number | null>(null); // For MediaPipe gaze tracking
  const lookAwayThreshold = 5000; // 5 seconds of looking away triggers violation
  const gazeThreshold = 3000; // 3 seconds for more accurate MediaPipe gaze tracking
  const multipleVoicesStartRef = useRef<number | null>(null);
  const lastProhibitedObjectTimeRef = useRef<number>(0); // Cooldown for prohibited object violations
  const lastGazeViolationTimeRef = useRef<number>(0); // Cooldown for gaze violations
  
  // Typing pattern analysis refs
  const typingTimestampsRef = useRef<number[]>([]);
  const lastTypingAnalysisRef = useRef<number>(0);
  
  // VM detection ref (only check once)
  const vmCheckDoneRef = useRef<boolean>(false);
  // CRITICAL: Track recording start time for accurate violation timestamps
  // This ensures violations show when in the recording they occurred, not just system time
  const recordingStartTimeRef = useRef<number | null>(null);
  
  // Phase 2: Advanced detection refs
  const livenessDetectorRef = useRef<LivenessDetector | null>(null);
  const faceVerifierRef = useRef<FaceVerifier | null>(null);
  const enhancedVoiceAnalyzerRef = useRef<EnhancedVoiceAnalyzer | null>(null);
  const livenessFailStartRef = useRef<number | null>(null);
  const referenceCapuredRef = useRef<boolean>(false);
  
  // Lock to prevent concurrent session initialization (race condition fix)
  const initSessionLockRef = useRef<boolean>(false);
  const initSessionPromiseRef = useRef<Promise<string | null> | null>(null);
  const createdSessionIdRef = useRef<string | null>(null);
  
  // CRITICAL: Track recording state with ref to avoid stale closure issues in logViolation
  const isRecordingRef = useRef<boolean>(false);
  
  // Track video stream ref for screenshot capture
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  // Track screen stream ref for screen screenshot capture
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Periodic screenshot capture interval (camera)
  const periodicScreenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const periodicScreenshotCountRef = useRef<number>(0);
  
  // Periodic SCREEN screenshot capture interval
  const periodicScreenScreenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const periodicScreenScreenshotCountRef = useRef<number>(0);
  
  // Fallback: Store last successful periodic screenshot URLs for violation fallback
  const lastCameraPeriodicUrlRef = useRef<string | null>(null);
  const lastScreenPeriodicUrlRef = useRef<string | null>(null);
  
  // Capture and upload periodic screenshot for post-interview AI analysis
  const capturePeriodicScreenshot = async () => {
    const sessionId = createdSessionIdRef.current;
    const stream = videoStreamRef.current;
    
    if (!sessionId || !stream || !stream.active) {
      logger.proctoring('[PeriodicScreenshot] Skipped - no session or stream');
      return;
    }
    
    try {
      const video = videoElementRef.current;
      if (!video || video.readyState < 2) {
        logger.proctoring('[PeriodicScreenshot] Video not ready');
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7);
      });
      
      if (!blob) return;
      
      // CRITICAL FIX: Calculate actual video timestamp (seconds since recording started)
      let capturedAtSeconds = 0;
      if (recordingStartTimeRef.current && recordingStartTimeRef.current > 0) {
        capturedAtSeconds = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      }
      
      const screenshotIndex = periodicScreenshotCountRef.current++;
      // Include capturedAt in filename for timestamp extraction during analysis
      const screenshotPath = `${sessionId}/periodic-${screenshotIndex}-t${capturedAtSeconds}.jpg`;
      
      logger.proctoring(`[PeriodicScreenshot] Capturing screenshot ${screenshotIndex} at video time ${capturedAtSeconds}s`);
      
      // Upload via edge function for unauthenticated access
      const formData = new FormData();
      formData.append('file', blob, 'screenshot.jpg');
      formData.append('sessionId', sessionId);
      formData.append('screenshotPath', screenshotPath);
      formData.append('screenshotType', 'periodic');
      formData.append('capturedAt', capturedAtSeconds.toString()); // Actual video timestamp
      
      // CRITICAL: Include attemptId for session token authentication
      if (sessionTokenRef.current && attemptId) {
        formData.append('sessionToken', sessionTokenRef.current);
        formData.append('attemptId', attemptId);
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-proctoring-screenshot`,
        {
          method: 'POST',
          headers: edgeFunctionHeaders(false),
          body: formData,
        }
      );
      
      if (response.ok) {
        // Store as fallback for violations when live capture fails
        lastCameraPeriodicUrlRef.current = screenshotPath;
        logger.proctoring(`[PeriodicScreenshot] Uploaded: ${screenshotPath} (video time: ${capturedAtSeconds}s)`);
      } else {
        const errorText = await response.text();
        logger.warn('[PeriodicScreenshot] Upload failed:', response.status, errorText);
      }
    } catch (error) {
      logger.error('[PeriodicScreenshot] Error:', error);
    }
  };
  
  // Start periodic screenshot capture (every 30 seconds for better violation detection)
  const startPeriodicScreenshots = () => {
    if (periodicScreenshotIntervalRef.current) return;
    
    logger.proctoring('[PeriodicScreenshot] Starting capture every 30 seconds');
    periodicScreenshotCountRef.current = 0;
    
    // Capture first screenshot immediately
    capturePeriodicScreenshot();
    
    // Then capture every 30 seconds for better violation coverage
    periodicScreenshotIntervalRef.current = setInterval(() => {
      capturePeriodicScreenshot();
    }, 30000); // 30 seconds
  };
  
  // Stop periodic screenshot capture
  const stopPeriodicScreenshots = () => {
    if (periodicScreenshotIntervalRef.current) {
      clearInterval(periodicScreenshotIntervalRef.current);
      periodicScreenshotIntervalRef.current = null;
      logger.proctoring(`[PeriodicScreenshot] Stopped after ${periodicScreenshotCountRef.current} captures`);
    }
  };

  // Capture and upload periodic SCREEN screenshot for post-interview AI analysis
  // These are used for screen content analysis (detecting AI tools, etc.)
  const capturePeriodicScreenScreenshot = async () => {
    const sessionId = createdSessionIdRef.current;
    const stream = screenStreamRef.current;
    
    if (!sessionId || !stream || !stream.active) {
      logger.proctoring('[PeriodicScreenScreenshot] Skipped - no session or stream');
      return;
    }
    
    try {
      // Create video element to capture frame from screen stream
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
        video.onloadedmetadata = async () => {
          clearTimeout(timeout);
          try {
            await video.play();
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video error'));
        };
      });
      
      // Wait a frame for video to render
      await new Promise(r => requestAnimationFrame(r));
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        video.pause();
        video.srcObject = null;
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.pause();
      video.srcObject = null;
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8);
      });
      
      if (!blob) return;
      
      await uploadScreenScreenshot(sessionId, blob);
    } catch (error) {
      logger.error('[PeriodicScreenScreenshot] Error:', error);
    }
  };
  
  // Helper to upload screen screenshot
  const uploadScreenScreenshot = async (sessionId: string, blob: Blob) => {
    // Calculate actual video timestamp
    let capturedAtSeconds = 0;
    if (recordingStartTimeRef.current && recordingStartTimeRef.current > 0) {
      capturedAtSeconds = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
    }
    
    const screenshotIndex = periodicScreenScreenshotCountRef.current++;
    const screenshotPath = `${sessionId}/screen-periodic-${screenshotIndex}-t${capturedAtSeconds}.jpg`;
    
    logger.proctoring(`[PeriodicScreenScreenshot] Capturing screenshot ${screenshotIndex} at video time ${capturedAtSeconds}s`);
    
    const formData = new FormData();
    formData.append('file', blob, 'screenshot.jpg');
    formData.append('sessionId', sessionId);
    formData.append('screenshotPath', screenshotPath);
    formData.append('screenshotType', 'screen_periodic'); // Different type for screen screenshots
    formData.append('capturedAt', capturedAtSeconds.toString());
    
    if (sessionTokenRef.current && attemptId) {
      formData.append('sessionToken', sessionTokenRef.current);
      formData.append('attemptId', attemptId);
    }
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-proctoring-screenshot`,
      {
        method: 'POST',
          headers: edgeFunctionHeaders(false),
          body: formData,
      }
    );
    
    if (response.ok) {
      // Store as fallback for violations when live capture fails
      lastScreenPeriodicUrlRef.current = screenshotPath;
      logger.proctoring(`[PeriodicScreenScreenshot] Uploaded: ${screenshotPath} (video time: ${capturedAtSeconds}s)`);
    } else {
      const errorText = await response.text();
      logger.warn('[PeriodicScreenScreenshot] Upload failed:', response.status, errorText);
    }
  };
  
  // Start periodic SCREEN screenshot capture (every 30 seconds)
  const startPeriodicScreenScreenshots = () => {
    if (periodicScreenScreenshotIntervalRef.current) return;
    
    logger.proctoring('[PeriodicScreenScreenshot] Starting capture every 30 seconds');
    periodicScreenScreenshotCountRef.current = 0;
    
    // Capture first screen screenshot immediately
    capturePeriodicScreenScreenshot();
    
    // Then capture every 30 seconds
    periodicScreenScreenshotIntervalRef.current = setInterval(() => {
      capturePeriodicScreenScreenshot();
    }, 30000);
  };
  
  // Stop periodic SCREEN screenshot capture
  const stopPeriodicScreenScreenshots = () => {
    if (periodicScreenScreenshotIntervalRef.current) {
      clearInterval(periodicScreenScreenshotIntervalRef.current);
      periodicScreenScreenshotIntervalRef.current = null;
      logger.proctoring(`[PeriodicScreenScreenshot] Stopped after ${periodicScreenScreenshotCountRef.current} captures`);
    }
  };

  // Initialize proctoring session - with proper locking to prevent duplicates
  // Uses edge function for secure session creation (no direct DB access)
  const initSession = async (overrideAttemptId?: string): Promise<string | null> => {
    const effectiveId = overrideAttemptId || attemptId;
    
    if (!effectiveId) {
      logger.error('[initSession] No attempt ID provided');
      return null;
    }

    // Check ref first (synchronous, catches rapid calls)
    if (createdSessionIdRef.current) {
      logger.proctoring('[initSession] Session already created (ref):', createdSessionIdRef.current);
      return createdSessionIdRef.current;
    }

    // If we already have a session ID in state, return it
    if (state.sessionId) {
      logger.proctoring('[initSession] Session in state:', state.sessionId);
      createdSessionIdRef.current = state.sessionId;
      return state.sessionId;
    }

    // If another call is in progress, wait for it
    if (initSessionLockRef.current && initSessionPromiseRef.current) {
      logger.proctoring('[initSession] Waiting for ongoing initialization...');
      return initSessionPromiseRef.current;
    }
    
    // Acquire lock
    initSessionLockRef.current = true;

    // Create the promise and store it
    initSessionPromiseRef.current = (async () => {
      try {
        // Double-check ref after acquiring lock
        if (createdSessionIdRef.current) {
          return createdSessionIdRef.current;
        }

        // Get session token for interview attempts
        const tokenToUse = attemptType === 'interview' ? sessionTokenRef.current : undefined;
        
        logger.proctoring('[initSession] Calling edge function for attempt:', effectiveId, 'type:', attemptType);
        
        // Call edge function instead of direct DB access
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/init-proctoring-session`,
          {
            method: 'POST',
            headers: edgeFunctionHeaders(true),
            body: JSON.stringify({
              attemptId: effectiveId,
              attemptType,
              sessionToken: tokenToUse,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          logger.error('[initSession] Edge function error:', response.status, errorData);
          return null;
        }

        const { sessionId, isNew } = await response.json();
        
        logger.proctoring('[initSession]', isNew ? 'Created new session:' : 'Found existing session:', sessionId);
        createdSessionIdRef.current = sessionId;
        setState(prev => ({ ...prev, sessionId }));
        
        // Start chunk uploader now that we have a session ID
        if (useChunkedUploadRef.current && !chunkUploaderStartedRef.current) {
          logger.proctoring('[initSession] Starting chunk uploader for session:', sessionId);
          // Need to update the uploader's sessionId via the state, then call start
          // The hook will pick up the new sessionId from state.sessionId on next render
          chunkUploaderStartedRef.current = true;
        }
        
        return sessionId;
      } finally {
        initSessionLockRef.current = false;
      }
    })();

    return initSessionPromiseRef.current;
  };

  // Check camera quality and lighting by analyzing actual brightness levels
  const checkCameraQuality = async (stream: MediaStream): Promise<{ passed: boolean; message: string }> => {
    return new Promise(async (resolve) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      
      video.onloadedmetadata = async () => {
        try {
          await video.play();
          
          // Wait a moment for video to stabilize
          await new Promise(r => setTimeout(r, 500));
          
          // Analyze actual brightness from video frame
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            video.pause();
            video.srcObject = null;
            resolve({ passed: true, message: 'Camera quality check completed' });
            return;
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Calculate average brightness
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            totalBrightness += (r + g + b) / 3;
          }
          const brightness = totalBrightness / (data.length / 4) / 255;
          
          video.pause();
          video.srcObject = null;
          
          logger.proctoring(`Lighting check: brightness = ${(brightness * 100).toFixed(1)}%`);
          
          // Determine quality based on brightness (25% - 95% is acceptable)
          if (brightness < 0.15) {
            resolve({ 
              passed: false, 
              message: 'Lighting is too dark. Please improve lighting conditions.' 
            });
          } else if (brightness > 0.95) {
            resolve({ 
              passed: false, 
              message: 'Video appears overexposed. Please reduce lighting or adjust camera.' 
            });
          } else {
            const quality = brightness < 0.25 ? 'fair' : brightness < 0.85 ? 'good' : 'excellent';
            resolve({ 
              passed: true, 
              message: `Lighting is ${quality} (${(brightness * 100).toFixed(0)}% brightness)` 
            });
          }
        } catch (error) {
          logger.error('Error checking camera quality:', error);
          video.pause();
          video.srcObject = null;
          resolve({ 
            passed: true, 
            message: 'Camera quality check completed (fallback mode)' 
          });
        }
      };
      
      video.onerror = () => {
        resolve({ 
          passed: true, 
          message: 'Camera quality check completed (fallback mode)' 
        });
      };
    });
  };

  // Start voice analysis with Phase 2 enhanced analyzer
  const startVoiceAnalysis = async (stream: MediaStream) => {
    try {
      // Phase 2: Use enhanced voice analyzer
      const enhancedAnalyzer = createEnhancedVoiceAnalyzer();
      await enhancedAnalyzer.initialize(stream);
      
      enhancedAnalyzer.startAnalysis((result) => {
        // Update enhanced voice analysis state
        setState(prev => ({ ...prev, enhancedVoiceResult: result, voiceAnalysis: {
          audioLevel: result.audioLevel,
          backgroundNoiseLevel: result.backgroundNoiseLevel,
          multipleVoicesDetected: result.multipleVoicesDetected,
          confidence: result.confidence,
          frequency: result.frequency,
          voiceCount: result.voiceCount || 1,
          spectralComplexity: result.spectralCentroid || 0, // Use spectralCentroid as complexity indicator
        }}));
        
        (window as any).__proctoringVoiceAnalysis = { 
          audioLevel: result.audioLevel, 
          multipleVoicesDetected: result.multipleVoicesDetected,
          voiceCount: result.voiceCount,
          noiseCategory: result.noiseCategory,
        };
        
        // Check for multiple voices (enhanced detection with voice count)
        if (result.multipleVoicesDetected && result.voiceCount > 1 && result.audioLevel > 0.2) {
          const now = Date.now();
          
          if (!multipleVoicesStartRef.current) {
            multipleVoicesStartRef.current = now;
          }
          
          // Log violation after 3 seconds of multiple voices
          if (now - multipleVoicesStartRef.current >= 3000) {
            logViolation({
              timestamp: new Date().toISOString(),
              type: 'multiple_voices',
              severity: 'high',
              details: `Multiple voices detected: ${result.voiceCount} speakers (confidence: ${Math.round(result.confidence * 100)}%)`,
              metadata: {
                audioLevel: result.audioLevel,
                voiceCount: result.voiceCount,
                backgroundNoise: result.backgroundNoiseLevel,
                noiseCategory: result.noiseCategory,
                spectralCentroid: result.spectralCentroid,
              },
            });
            
            multipleVoicesStartRef.current = now; // Reset to avoid spam
          }
        } else {
          multipleVoicesStartRef.current = null;
        }
        
        // Phase 2: Silence anomaly detection with enhanced details
        if (result.silenceAnomaly) {
          logViolation({
            timestamp: new Date().toISOString(),
            type: 'silence_anomaly',
            severity: 'medium',
            details: `Unusual silence detected. Candidate may have stepped away, muted their microphone, or stopped responding. Audio level: ${(result.audioLevel * 100).toFixed(1)}%.`,
            metadata: {
              noiseCategory: result.noiseCategory,
              audioLevel: result.audioLevel,
            },
          });
        }
        
        // Check for noise categorized as suspicious
        if (result.noiseCategory === 'noise' && result.audioLevel > 0.3) {
          logViolation({
            timestamp: new Date().toISOString(),
            type: 'multiple_voices',
            severity: 'low',
            details: `Suspicious background noise detected (${result.noiseCategory})`,
            metadata: {
              backgroundNoise: result.backgroundNoiseLevel,
              audioLevel: result.audioLevel,
              noiseCategory: result.noiseCategory,
            },
          });
        }
      });
      
      enhancedVoiceAnalyzerRef.current = enhancedAnalyzer;
      
      
      logger.proctoring('Enhanced voice analysis started successfully');
    } catch (error) {
      logger.error('Error starting voice analysis:', error);
    }
  };

  // Start video recording with AI-powered face detection
  // IMPORTANT: Recording is tightly integrated with proctoring - violations track recording time
  // preserveChunks: if true, keeps existing chunks (for camera reconnection scenarios)
  // RETURNS: boolean - true if recording started successfully, false otherwise
  const startVideoRecording = async (stream: MediaStream, preserveChunks: boolean = false): Promise<boolean> => {
    logger.proctoring('=== START VIDEO RECORDING ===');
    logger.proctoring('Stream active:', stream?.active);
    logger.proctoring('Video tracks:', stream?.getVideoTracks().length);
    logger.proctoring('Preserve chunks:', preserveChunks);
    
    // Validate stream is active before proceeding
    if (!stream || !stream.active) {
      logger.error('RECORDING FAILED: Stream is not active!');
      return false;
    }
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') {
      logger.error('RECORDING FAILED: Video track is not live!', videoTrack?.readyState);
      return false;
    }
    
    logger.proctoring('Video track state:', videoTrack.readyState);
    logger.proctoring('Video track enabled:', videoTrack.enabled);
    
    // Check supported mime types and use the best available
    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    } else if (!MediaRecorder.isTypeSupported('video/webm')) {
      logger.error('RECORDING FAILED: No supported mime type!');
      return false;
    }
    logger.proctoring('Using mime type:', mimeType);
    
    try {
      // Use lower bitrate for proctoring recordings - 500kbps is sufficient for face detection
      // This significantly reduces file size: ~3.75 MB/min vs ~15 MB/min at default
      const recorder = new MediaRecorder(stream, { 
        mimeType,
        videoBitsPerSecond: 500000 // 500 kbps - good enough for proctoring
      });
      
      // Only reset chunks on initial start, preserve on reconnection
      if (!preserveChunks) {
        videoChunksRef.current = [];
        // CRITICAL: Track recording start time for accurate violation timestamps (only on fresh start)
        recordingStartTimeRef.current = Date.now();
        logger.proctoring('Recording started at:', new Date(recordingStartTimeRef.current).toISOString());
        
        // Start chunk uploader if enabled and we have a session
        // Pass sessionId explicitly since React state may not have updated yet
        if (useChunkedUploadRef.current && createdSessionIdRef.current && chunkUploaderRef.current) {
          logger.proctoring('[VideoRecording] Starting chunk uploader with session:', createdSessionIdRef.current);
          chunkUploaderRef.current.start(createdSessionIdRef.current);
        }
      } else {
        logger.proctoring('Camera reconnected - preserving existing', videoChunksRef.current.length, 'chunks');
      }
      
      // CRITICAL: Set recording ref immediately so violations get proper timestamps
      isRecordingRef.current = true;
      
      // Store stream ref for screenshot capture during violations
      videoStreamRef.current = stream;
      
      // Start voice analysis on the same stream
      startVoiceAnalysis(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Always keep in memory for fallback
          videoChunksRef.current.push(event.data);
          logger.proctoring(`Video chunk collected: ${event.data.size} bytes, total chunks: ${videoChunksRef.current.length}`);
          
          // Queue for progressive background upload if enabled
          if (useChunkedUploadRef.current && chunkUploaderRef.current) {
            chunkUploaderRef.current.queueChunk(event.data, 'video');
          }
        }
      };
      
      recorder.onerror = (event: any) => {
        logger.error('MediaRecorder error:', event.error);
        isRecordingRef.current = false;
      };

      // Monitor stream health and attempt reconnection if needed
      videoTrack.onended = () => {
        logger.warn('Video track ended unexpectedly');
        // Notify about disconnection
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'look_away',
          severity: 'medium',
          details: 'Camera disconnected unexpectedly during interview. This could indicate the candidate unplugged, disabled, or lost access to their camera.',
          metadata: { reason: 'track_ended', event: 'camera_disconnection' }
        });
      };

      // CRITICAL: Wait for recorder to actually enter 'recording' state
      // recorder.start() is ASYNC - state doesn't change immediately!
      const recordingStarted = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          logger.error('RECORDING FAILED: Timeout waiting for recorder to start');
          resolve(false);
        }, 3000); // 3 second timeout
        
        recorder.onstart = () => {
          clearTimeout(timeout);
          logger.proctoring('✅ Video recorder onstart fired, state:', recorder.state);
          resolve(true);
        };
        
        recorder.onerror = (event: any) => {
          clearTimeout(timeout);
          logger.error('RECORDING FAILED: MediaRecorder error:', event.error);
          resolve(false);
        };
        
        // Collect data every 10 seconds for chunked uploads (was 1 second)
        // 10-second chunks are valid WebM fragments that can be uploaded progressively
        recorder.start(10000);
        videoRecorderRef.current = recorder;
      });
      
      if (!recordingStarted) {
        logger.error('RECORDING FAILED: Recorder did not enter recording state');
        isRecordingRef.current = false;
        return false;
      }
      
      logger.proctoring('✅ Video recorder VERIFIED started, state:', recorder.state);
      
      // CRITICAL: Initialize face detection AFTER recorder starts
      // startPeriodicScreenshots is now called inside initializeProctoringFaceDetection 
      // after video is fully loaded, fixing the issue where screenshots weren't captured
      await initializeProctoringFaceDetection(stream);
      
      return true;
    } catch (error) {
      logger.error('RECORDING FAILED: Error creating MediaRecorder:', error);
      isRecordingRef.current = false;
      return false;
    }
  };

  // Initialize face detection for proctoring monitoring
  // This detects multiple persons, eye gaze, look-aways, liveness, etc.
  const initializeProctoringFaceDetection = async (stream: MediaStream) => {
    // Set up video element for face detection
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    videoElementRef.current = video;

    // Wait for video to be ready
    video.onloadedmetadata = async () => {
      try {
        await video.play();
        
        // CRITICAL: Start periodic screenshots now that video is ready
        // This was previously called before video was loaded, causing screenshots to fail
        startPeriodicScreenshots();
        logger.proctoring('[PeriodicScreenshot] Video ready, periodic capture started');
        
        // Initialize face detection (imported function takes no args)
        await initializeFaceDetection();
        
        // Phase 2: Initialize liveness detector and face verifier
        livenessDetectorRef.current = createLivenessDetector();
        faceVerifierRef.current = createFaceVerifier();
        referenceCapuredRef.current = false;
        
        logger.proctoring('Starting continuous face detection with Phase 2 enhancements...');
        
        // Start continuous detection (every 3 seconds)
        const cleanup = startContinuousDetection(
          video,
          async (result) => {
            logger.proctoring('Face detection result:', result);
            
            // Update eye gaze state
            if (result.eyeGaze) {
              setState(prev => ({ ...prev, eyeGaze: result.eyeGaze }));
            }
            
            // Get face box for Phase 2 analysis
            const faceBox = result.detections[0]?.box;
            
            // Phase 2: Capture reference face on first detection
            if (!referenceCapuredRef.current && result.personCount === 1 && faceVerifierRef.current) {
              const captured = await faceVerifierRef.current.captureReference(video, faceBox);
              if (captured) {
                referenceCapuredRef.current = true;
                logger.proctoring('Reference face captured for verification');
              }
            }
            
            // Phase 2: Liveness detection
            if (livenessDetectorRef.current && result.personCount >= 1) {
              const livenessResult = await livenessDetectorRef.current.analyze(video, faceBox);
              setState(prev => ({ ...prev, livenessResult }));
              
              // Check for liveness failure
              if (!livenessResult.isLive && livenessResult.spoofingRisk === 'high') {
                const now = Date.now();
                if (!livenessFailStartRef.current) {
                  livenessFailStartRef.current = now;
                }
                
                // Trigger violation after 5 seconds of continuous failure
                const failDuration = now - livenessFailStartRef.current;
                if (failDuration >= 5000) {
                  logViolation({
                    timestamp: new Date().toISOString(),
                    type: 'liveness_fail',
                    severity: 'high',
                    details: `Potential spoofing detected: risk level ${livenessResult.spoofingRisk}`,
                    metadata: {
                      spoofingRisk: livenessResult.spoofingRisk,
                      confidence: livenessResult.confidence,
                    },
                  });
                  livenessFailStartRef.current = now; // Reset to avoid spam
                }
              } else {
                livenessFailStartRef.current = null;
              }
            }
            
            // Phase 2: Face verification (person swap detection)
            if (referenceCapuredRef.current && faceVerifierRef.current && result.personCount >= 1) {
              const verificationResult = await faceVerifierRef.current.verify(video, faceBox);
              setState(prev => ({ ...prev, faceVerificationResult: verificationResult }));
              
              if (!verificationResult.isMatch && verificationResult.confidence > 0.7) {
                logViolation({
                  timestamp: new Date().toISOString(),
                  type: 'person_swap',
                  severity: 'high',
                  details: 'Different person detected than initial candidate',
                  metadata: {
                    confidence: verificationResult.confidence,
                    similarity: verificationResult.similarity,
                  },
                });
              }
            }

            // Detect multiple persons
            if (result.personCount > 1 && lastPersonCountRef.current <= 1) {
              logger.proctoring('VIOLATION: Multiple persons detected!', result.personCount);
              const detectionConfidence = result.detections[0]?.score || 0;
              logViolation({
                timestamp: new Date().toISOString(),
                type: 'multiple_persons',
                severity: 'high',
                details: `${result.personCount} people detected in frame`,
                metadata: {
                  personCount: result.personCount,
                  confidence: detectionConfidence,
                },
              });
            }
            
            // Detect prohibited objects (phones, books, etc.) with cooldown to prevent spam
            if (result.prohibitedObjects && result.prohibitedObjects.length > 0) {
              const now = Date.now();
              const cooldownMs = 30000; // 30 second cooldown between same-type violations
              
              if (now - lastProhibitedObjectTimeRef.current > cooldownMs) {
                for (const obj of result.prohibitedObjects) {
                  const objLabel = obj.label.toLowerCase();
                  const isPhone = objLabel.includes('phone') || objLabel.includes('cell') || objLabel.includes('mobile');
                  
                  logViolation({
                    timestamp: new Date().toISOString(),
                    type: isPhone ? 'phone_detected' : 'prohibited_object',
                    severity: 'high',
                    details: isPhone 
                      ? `Mobile phone detected in frame (${(obj.score * 100).toFixed(0)}% confidence). Candidate may be receiving external assistance.`
                      : `Prohibited object detected: ${obj.label} (${(obj.score * 100).toFixed(0)}% confidence). This could indicate use of external resources.`,
                    metadata: {
                      objectType: obj.label,
                      confidence: obj.score,
                      box: obj.box,
                    },
                  });
                }
                lastProhibitedObjectTimeRef.current = now;
              }
            }
            // Track eye gaze and look-away (isLookingAway = true means NOT looking at screen)
            if (result.eyeGaze && result.eyeGaze.isLookingAway) {
              const now = Date.now();
              
              // Start tracking look away time
              if (!lookAwayStartRef.current) {
                lookAwayStartRef.current = now;
              }
              
              // Check if exceeded threshold
              const lookAwayDuration = now - lookAwayStartRef.current;
              if (lookAwayDuration >= lookAwayThreshold) {
                logViolation({
                  timestamp: new Date().toISOString(),
                  type: 'eye_movement',
                  severity: 'medium',
                  details: `Eye gaze detected looking ${result.eyeGaze.direction} for ${Math.round(lookAwayDuration / 1000)}s`,
                  metadata: {
                    direction: result.eyeGaze.direction,
                    confidence: result.eyeGaze.confidence,
                    duration: lookAwayDuration,
                  },
                });
                
                // Reset to avoid spam
                lookAwayStartRef.current = now;
              }
            } else {
              // Reset look away timer when looking at screen
              lookAwayStartRef.current = null;
            }
            
            lastPersonCountRef.current = result.personCount;
          },
          3000 // Check every 3 seconds
        );
        
        faceDetectionCleanupRef.current = cleanup;
        
        // Start MediaPipe gaze detection (runs alongside DETR, but with actual iris tracking)
        // This is more accurate for detecting eye movement while face stays centered
        try {
          const gazeCleanup = startContinuousGazeDetection(
            video,
            {
              onGazeChange: (gazeResult: GazeResult) => {
                // Skip if using fallback (DETR heuristic handles that)
                if (gazeResult.isFallback) return;
                
                const now = Date.now();
                
                if (gazeResult.isLookingAway && gazeResult.confidence > 0.6) {
                  // Start tracking gaze violation time
                  if (!gazeViolationStartRef.current) {
                    gazeViolationStartRef.current = now;
                    logger.proctoring(`[GazeDetection] Started tracking: looking ${gazeResult.direction}`);
                  }
                  
                  // Check if exceeded threshold (3 seconds for accurate tracking)
                  const gazeDuration = now - gazeViolationStartRef.current;
                  const cooldownMs = 15000; // 15 second cooldown between gaze violations
                  
                  if (gazeDuration >= gazeThreshold && (now - lastGazeViolationTimeRef.current > cooldownMs)) {
                    logger.proctoring(`[GazeDetection] VIOLATION: Looking ${gazeResult.direction} for ${Math.round(gazeDuration / 1000)}s`);
                    
                    // Log the violation with detailed gaze data
                    logViolation({
                      timestamp: new Date().toISOString(),
                      type: 'eye_movement',
                      severity: 'medium',
                      details: `Eye gaze detected looking ${gazeResult.direction} for ${Math.round(gazeDuration / 1000)}s (iris tracking). Possible second monitor use.`,
                      metadata: {
                        direction: gazeResult.direction,
                        confidence: gazeResult.confidence,
                        duration: gazeDuration,
                        horizontalGaze: gazeResult.horizontalGaze,
                        verticalGaze: gazeResult.verticalGaze,
                        headPose: gazeResult.headPose,
                        detectionMethod: 'mediapipe_iris',
                      },
                    });
                    
                    // Capture screenshot on violation for evidence
                    captureViolationScreenshot();
                    
                    lastGazeViolationTimeRef.current = now;
                    gazeViolationStartRef.current = now; // Reset to avoid spam
                  }
                } else {
                  // Reset gaze violation timer when looking at screen
                  gazeViolationStartRef.current = null;
                }
              },
              onLookAwayStart: () => {
                logger.proctoring('[GazeDetection] Look away started');
              },
              onLookAwayEnd: () => {
                logger.proctoring('[GazeDetection] Look away ended');
              },
              onError: (error) => {
                // Non-critical - DETR heuristic is still running as fallback
                logger.warn('[GazeDetection] Error (falling back to DETR):', error.message);
              },
            },
            200 // Check every 200ms for accurate tracking
          );
          
          gazeDetectionCleanupRef.current = gazeCleanup;
          logger.proctoring('[GazeDetection] MediaPipe iris tracking started');
        } catch (gazeError) {
          // Non-breaking - DETR face detection is still running
          logger.warn('[GazeDetection] Failed to start MediaPipe, using DETR fallback:', gazeError);
        }
      } catch (error) {
        logger.error('Error starting face detection:', error);
      }
    };
  };

  // Start screen recording
  // preserveChunks: if true, keeps existing chunks (for reconnection scenarios)
  // RETURNS: boolean - true if recording started successfully, false otherwise
  const startScreenRecording = async (stream: MediaStream, preserveChunks: boolean = false): Promise<boolean> => {
    logger.proctoring('=== START SCREEN RECORDING ===');
    
    if (!stream || !stream.active) {
      logger.error('SCREEN RECORDING FAILED: Stream is not active!');
      return false;
    }
    
    // CRITICAL: Store screen stream ref for periodic screenshot capture
    screenStreamRef.current = stream;
    
    try {
      // Check supported mime types and use VP9 for better compression
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      }
      
      // Use moderate bitrate for screen recordings - 1.5 Mbps provides good quality
      // while significantly reducing file size: ~11 MB/min vs ~50+ MB/min at default
      // This is still 3x the camera bitrate since screens have more detail
      const recorder = new MediaRecorder(stream, { 
        mimeType,
        videoBitsPerSecond: 1500000 // 1.5 Mbps - good quality, ~60% smaller files
      });
      
      // Only reset chunks on initial start, preserve on reconnection
      if (!preserveChunks) {
        screenChunksRef.current = [];
        logger.proctoring('Screen recording started fresh');
      } else {
        logger.proctoring('Screen reconnected - preserving existing', screenChunksRef.current.length, 'chunks');
      }

      // Track screen recording health
      let screenRecordingHealthy = true;
      let lastScreenChunkTime = Date.now();
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Always keep in memory for fallback
          screenChunksRef.current.push(event.data);
          lastScreenChunkTime = Date.now();
          logger.proctoring(`Screen chunk collected: ${event.data.size} bytes, total chunks: ${screenChunksRef.current.length}`);
          
          // Queue for progressive background upload if enabled
          if (useChunkedUploadRef.current && chunkUploaderRef.current) {
            chunkUploaderRef.current.queueChunk(event.data, 'screen');
          }
        } else {
          logger.warn('Screen chunk received with ZERO size - possible issue');
        }
      };
      
      // DIAGNOSTIC: Monitor screen recording health
      recorder.onerror = (event: any) => {
        screenRecordingHealthy = false;
        logger.error('🔴 SCREEN RECORDER ERROR:', event.error);
        logger.error('Screen recording has failed - chunks may be incomplete');
      };
      
      // Handle track ended (user clicked "Stop sharing")
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          logger.warn('🔴 SCREEN SHARE TRACK ENDED - User may have clicked "Stop sharing"');
          logger.warn(`Screen chunks collected before stop: ${screenChunksRef.current.length}`);
          screenRecordingHealthy = false;
        };
      });

      // CRITICAL: Wait for recorder to actually enter 'recording' state
      // recorder.start() is ASYNC - state doesn't change immediately!
      const recordingStarted = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          logger.error('SCREEN RECORDING FAILED: Timeout waiting for recorder to start');
          resolve(false);
        }, 3000); // 3 second timeout
        
        recorder.onstart = () => {
          clearTimeout(timeout);
          logger.proctoring('✅ Screen recorder onstart fired, state:', recorder.state);
          resolve(true);
        };
        
        recorder.onerror = (event: any) => {
          clearTimeout(timeout);
          logger.error('SCREEN RECORDING FAILED: MediaRecorder error:', event.error);
          resolve(false);
        };
        
        // Collect data every 10 seconds for chunked uploads (was 1 second)
        // 10-second chunks are valid WebM fragments that can be uploaded progressively
        recorder.start(10000);
        screenRecorderRef.current = recorder;
      });
      
      if (!recordingStarted) {
        logger.error('SCREEN RECORDING FAILED: Recorder did not enter recording state');
        return false;
      }
      
      logger.proctoring('✅ Screen recorder VERIFIED started, state:', recorder.state);
      
      // Start periodic screen screenshots for post-interview analysis
      startPeriodicScreenScreenshots();
      
      return true;
    } catch (error) {
      logger.error('SCREEN RECORDING FAILED: Error creating MediaRecorder:', error);
      return false;
    }
  };

  // Detect tab switches and window focus loss - CRITICAL: Capture from session start
  // FIX: Use BOTH visibilitychange AND blur/focus events with FALSE POSITIVE REDUCTION
  // - visibilitychange: detects tab switches within same browser window
  // - blur/focus: detects switching to another window/application (including another Chrome window)
  // 
  // FALSE POSITIVE REDUCTION:
  // 1. Extended debounce (500ms) to filter out quick popup interactions (clipboard, battery, etc.)
  // 2. Screen share correlation - ignore visibility changes that coincide with screen share stop
  // 3. Focus state verification - only log if focus remains lost after debounce period
  useEffect(() => {
    // Debounce to prevent double logging and filter quick popup interactions
    let lastViolationTime = 0;
    const debounceMs = 1000; // 1 second debounce between violations
    const popupFilterMs = 500; // 500ms filter for popup clicks (battery, clipboard, etc.)
    
    // Track screen share state changes for correlation
    let screenShareEndedAt = 0;
    const screenShareCorrelationWindowMs = 300; // If visibility changes within 300ms of screen share end, it's not a tab switch
    
    // Track pending violation checks for popup filtering
    let pendingViolationTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Listen for screen share track ending
    const handleScreenShareEnd = () => {
      screenShareEndedAt = Date.now();
      logger.proctoring('[TabSwitch] Screen share ended - will ignore visibility changes for 300ms');
    };
    
    // Check if current streams have screen share and attach listener
    if (screenStreamRef.current) {
      const tracks = screenStreamRef.current.getTracks();
      tracks.forEach(track => {
        track.onended = handleScreenShareEnd;
      });
    }
    
    const logTabSwitchViolation = (source: 'visibility' | 'blur', immediate = false) => {
      const now = Date.now();
      
      // Check if this correlates with screen share ending (FALSE POSITIVE)
      if (now - screenShareEndedAt < screenShareCorrelationWindowMs) {
        logger.proctoring(`[TabSwitch] FILTERED: Visibility change correlated with screen share stop (${now - screenShareEndedAt}ms)`);
        return;
      }
      
      // Check debounce
      if (now - lastViolationTime < debounceMs) {
        logger.proctoring(`[TabSwitch] Debounced duplicate violation from ${source}`);
        return;
      }
      
      // For non-immediate calls, verify focus is still lost (filters popup clicks)
      if (!immediate) {
        // If document is now visible again, this was a quick popup interaction
        if (!document.hidden && document.hasFocus()) {
          logger.proctoring(`[TabSwitch] FILTERED: Focus returned within ${popupFilterMs}ms - likely popup interaction`);
          return;
        }
      }
      
      lastViolationTime = now;
      
      const hasSession = !!createdSessionIdRef.current;
      const isRecording = isRecordingRef.current;
      
      if (hasSession || isRecording) {
        const timestamp = new Date();
        logger.proctoring(`[TabSwitch] LOGGING VIOLATION from ${source} - tab/window switched during proctoring`);
        logViolation({
          timestamp: timestamp.toISOString(),
          type: 'tab_switch',
          severity: 'medium',
          details: `Candidate switched away from interview ${source === 'blur' ? 'window' : 'tab'} at ${timestamp.toLocaleTimeString()}. This may indicate accessing external resources or attempting to search for answers.`,
          metadata: {
            source,
            visibilityState: document.visibilityState,
            hidden: document.hidden,
            hasFocus: document.hasFocus(),
            eventTime: timestamp.toISOString(),
            capturedDuringRecording: isRecording,
            sessionActive: hasSession,
            popupFiltered: !immediate, // Indicates this passed the popup filter
          }
        });
      } else {
        logger.proctoring(`[TabSwitch] ${source} event but no session yet - violation not logged`);
      }
    };
    
    const handleVisibilityChange = () => {
      logger.proctoring('[TabSwitch] Visibility changed:', {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        isRecordingRef: isRecordingRef.current,
        hasSessionId: !!createdSessionIdRef.current,
      });
      
      if (document.hidden) {
        // Clear any pending timeout
        if (pendingViolationTimeout) {
          clearTimeout(pendingViolationTimeout);
        }
        
        // Delay violation logging to filter popup interactions
        // If visibility returns within 500ms, it was likely a popup click
        pendingViolationTimeout = setTimeout(() => {
          logTabSwitchViolation('visibility', false);
          pendingViolationTimeout = null;
        }, popupFilterMs);
      } else {
        // Visibility restored - cancel pending violation if any
        if (pendingViolationTimeout) {
          clearTimeout(pendingViolationTimeout);
          pendingViolationTimeout = null;
          logger.proctoring('[TabSwitch] FILTERED: Visibility restored quickly - popup interaction detected');
        }
      }
    };
    
    // CRITICAL FIX: Also detect window blur (switching to another window/app)
    // This catches: Cmd+Tab, clicking another Chrome window, clicking another app
    const handleWindowBlur = () => {
      logger.proctoring('[TabSwitch] Window blur detected:', {
        hasFocus: document.hasFocus(),
        isRecordingRef: isRecordingRef.current,
        hasSessionId: !!createdSessionIdRef.current,
      });
      
      // Clear any pending timeout
      if (pendingViolationTimeout) {
        clearTimeout(pendingViolationTimeout);
      }
      
      // Delay violation logging to filter popup interactions
      pendingViolationTimeout = setTimeout(() => {
        // Only log if still unfocused after delay
        if (!document.hasFocus()) {
          logTabSwitchViolation('blur', false);
        } else {
          logger.proctoring('[TabSwitch] FILTERED: Focus restored within delay - popup interaction');
        }
        pendingViolationTimeout = null;
      }, popupFilterMs);
    };
    
    // Handle focus restoration
    const handleWindowFocus = () => {
      // Cancel pending violation if focus returns quickly
      if (pendingViolationTimeout) {
        clearTimeout(pendingViolationTimeout);
        pendingViolationTimeout = null;
        logger.proctoring('[TabSwitch] FILTERED: Focus restored quickly - likely system popup');
      }
    };
    
    // Listen for all events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    logger.proctoring('[TabSwitch] Visibility change + window blur/focus listeners attached (with popup filtering)');
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      if (pendingViolationTimeout) {
        clearTimeout(pendingViolationTimeout);
      }
      logger.proctoring('[TabSwitch] Visibility change + window blur/focus listeners removed');
    };
  }, []); // Empty deps - we use refs for current state

  // Detect user activity (for detecting look-away)
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    if (state.isRecording) {
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);

      const inactivityCheck = setInterval(() => {
        const inactiveTime = Date.now() - lastActivityRef.current;
        // Only flag after 90 seconds of inactivity - candidates need time to think
        if (inactiveTime > 90000) {
          const inactiveSeconds = Math.floor(inactiveTime / 1000);
          // This is informational only - thinking time is normal during interviews
          logViolation({
            timestamp: new Date().toISOString(),
            type: 'look_away',
            severity: 'low', // Low severity - thinking is normal
            details: `Extended period without activity (${inactiveSeconds}s). This may indicate thinking time or reviewing the problem.`,
            metadata: {
              inactiveTimeMs: inactiveTime,
              inactiveSeconds: inactiveSeconds,
              note: 'Thinking time is expected during problem-solving'
            }
          });
          lastActivityRef.current = Date.now(); // Reset to avoid repeated logs
        }
      }, 15000);

      return () => {
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        clearInterval(inactivityCheck);
      };
    }
  }, [state.isRecording]);

  // Detect copy/paste attempts and prevent clipboard operations
  // FIXED: Use refs instead of state to avoid stale closure issues
  // FIXED: ALLOW copy/paste/cut inside code editors (Monaco, textarea, input) for coding questions
  useEffect(() => {
    const isInsideCodeEditor = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      // Allow inside Monaco editor
      if (target.closest('.monaco-editor')) return true;
      // Allow inside textareas (basic editor fallback)
      if (target.tagName === 'TEXTAREA') return true;
      // Allow inside input fields
      if (target.tagName === 'INPUT') return true;
      // Allow inside contenteditable
      if ((target as HTMLElement).isContentEditable) return true;
      // Allow inside any element with data-code-editor attribute
      if (target.closest('[data-code-editor]')) return true;
      return false;
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (isRecordingRef.current || createdSessionIdRef.current) {
        // ALLOW copy inside code editors for coding questions
        if (isInsideCodeEditor(e.target)) {
          logger.proctoring('[Proctoring] Copy allowed inside code editor');
          return; // Don't block
        }
        e.preventDefault(); // Block the copy action
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'copy_attempt',
          severity: 'low',
          details: 'Candidate attempted to copy content - BLOCKED (action prevented)',
        });
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (isRecordingRef.current || createdSessionIdRef.current) {
        // ALLOW paste inside code editors for coding questions
        if (isInsideCodeEditor(e.target)) {
          logger.proctoring('[Proctoring] Paste allowed inside code editor');
          return; // Don't block
        }
        e.preventDefault(); // Block paste action
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'copy_attempt',
          severity: 'medium', // Medium - pasting from external source is more suspicious
          details: 'Candidate attempted to paste content - BLOCKED (action prevented)',
        });
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (isRecordingRef.current || createdSessionIdRef.current) {
        // ALLOW cut inside code editors for coding questions
        if (isInsideCodeEditor(e.target)) {
          logger.proctoring('[Proctoring] Cut allowed inside code editor');
          return; // Don't block
        }
        e.preventDefault();
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'copy_attempt',
          severity: 'low',
          details: 'Candidate attempted to cut content - BLOCKED (action prevented)',
        });
      }
    };

    // Always attach - refs handle state check
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
    };
  }, []); // Empty deps - use refs

  // Detect and block dev tools / keyboard shortcuts
  // FIXED: Allow keyboard input inside code editors
  useEffect(() => {
    const blockedKeys = [
      { key: 'F12', ctrl: false, shift: false, alt: false },
      { key: 'I', ctrl: true, shift: true, alt: false }, // Ctrl+Shift+I
      { key: 'J', ctrl: true, shift: true, alt: false }, // Ctrl+Shift+J
      { key: 'C', ctrl: true, shift: true, alt: false }, // Ctrl+Shift+C
      { key: 'U', ctrl: true, shift: false, alt: false }, // Ctrl+U (view source)
      { key: 'S', ctrl: true, shift: false, alt: false }, // Ctrl+S (save page)
      { key: 'P', ctrl: true, shift: false, alt: false }, // Ctrl+P (print)
    ];

    const isInsideCodeEditor = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      if (target.closest('.monaco-editor')) return true;
      if (target.tagName === 'TEXTAREA') return true;
      if (target.tagName === 'INPUT') return true;
      if ((target as HTMLElement).isContentEditable) return true;
      if (target.closest('[data-code-editor]')) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.isRecording) return;

      // ALLOW all keyboard input inside code editors (except dev tools shortcuts)
      const inEditor = isInsideCodeEditor(e.target);

      const isBlocked = blockedKeys.some(combo => 
        e.key.toUpperCase() === combo.key &&
        e.ctrlKey === combo.ctrl &&
        e.shiftKey === combo.shift &&
        e.altKey === combo.alt
      );

      if (isBlocked) {
        e.preventDefault();
        e.stopPropagation();
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'copy_attempt',
          severity: 'high',
          details: `Blocked keyboard shortcut: ${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`,
          metadata: { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey }
        });
        return false;
      }

      // If inside code editor, don't block any other keys
      if (inEditor) {
        return; // Let the event through
      }
    };

    if (state.isRecording) {
      document.addEventListener('keydown', handleKeyDown, true);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [state.isRecording]);

  // Right-click / context menu is ALLOWED for spellcheck functionality
  // Per user requirement: candidates should be able to right-click to correct spelling
  // This is NOT logged as a violation since it's legitimate behavior

  // Detect fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (state.isRecording && !document.fullscreenElement) {
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'tab_switch',
          severity: 'medium',
          details: 'Candidate exited fullscreen mode',
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [state.isRecording]);

  // Detect dev tools via window size heuristic
  useEffect(() => {
    let devToolsOpen = false;
    
    const checkDevTools = () => {
      if (!state.isRecording) return;
      
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      
      const isOpen = widthThreshold || heightThreshold;
      
      if (isOpen && !devToolsOpen) {
        devToolsOpen = true;
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'copy_attempt',
          severity: 'high',
          details: 'Developer tools may be open - suspicious window size detected',
          metadata: { 
            outerWidth: window.outerWidth, 
            innerWidth: window.innerWidth,
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight
          }
        });
      } else if (!isOpen) {
        devToolsOpen = false;
      }
    };

    const interval = state.isRecording ? setInterval(checkDevTools, 2000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isRecording]);

  // Detect multiple monitors
  useEffect(() => {
    const checkMultipleMonitors = () => {
      if (!state.isRecording) return;
      
      // Check if multiple screens are detected
      const screenCount = (window.screen as any).isExtended !== undefined 
        ? ((window.screen as any).isExtended ? 2 : 1) 
        : 1;
      
      // Alternative detection: check if window position suggests multiple monitors
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const availWidth = window.screen.availWidth;
      const availHeight = window.screen.availHeight;
      
      // Heuristic: if available dimensions are much larger than screen, multiple monitors likely
      const suspiciousWidth = availWidth > screenWidth * 1.5;
      const suspiciousPosition = window.screenX < 0 || window.screenX > screenWidth;
      
      if (screenCount > 1 || suspiciousWidth || suspiciousPosition) {
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'multiple_monitors',
          severity: 'high',
          details: `Multiple monitors detected. Candidate may be viewing content on secondary display.`,
          metadata: {
            screenCount,
            screenWidth,
            availWidth,
            windowX: window.screenX,
            suspiciousWidth,
            suspiciousPosition,
          }
        });
      }
    };

    // Check on mount and periodically
    if (state.isRecording) {
      checkMultipleMonitors();
      const interval = setInterval(checkMultipleMonitors, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [state.isRecording]);

  // Detect Print Screen key attempts and clipboard image detection
  // NOTE: Mac Cmd+Shift+3/4/5 are handled by OS before JavaScript - we can't block them
  // BUT we CAN detect when clipboard contains a screenshot image
  useEffect(() => {
    const handlePrintScreen = (e: KeyboardEvent) => {
      // Use ref to avoid stale closure
      if (!isRecordingRef.current) return;
      
      // Detect PrintScreen key (various browser implementations)
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'print_screen',
          severity: 'high',
          details: 'Candidate attempted to take a screenshot using Print Screen - BLOCKED',
          metadata: { key: e.key, code: e.code }
        });
        
        return false;
      }
      
      // Detect Windows screenshot shortcuts
      if (e.key === 's' && e.metaKey && e.shiftKey) { // Win+Shift+S
        e.preventDefault();
        e.stopPropagation();
        
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'print_screen',
          severity: 'high',
          details: 'Candidate attempted to take a screenshot using Win+Shift+S - BLOCKED',
          metadata: { key: e.key, meta: e.metaKey, shift: e.shiftKey }
        });
        
        return false;
      }
      
      // Detect Mac screenshot shortcuts (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5)
      // NOTE: These can't be blocked (OS handles them first), but we log the attempt
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        // Can't actually block these - OS handles before browser
        // But we can at least detect the keypress was made
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'print_screen',
          severity: 'high',
          details: `Candidate took a screenshot using Cmd+Shift+${e.key}`,
          metadata: { key: e.key, meta: e.metaKey, shift: e.shiftKey, note: 'OS-level screenshot - cannot be blocked' }
        });
        
        // Don't try to block - it won't work and may cause issues
        return;
      }
    };
    
    // ENHANCED: Detect clipboard image on window focus (catches screenshots from any method)
    const handleWindowFocus = async () => {
      if (!isRecordingRef.current || !createdSessionIdRef.current) return;
      
      try {
        // Check if clipboard contains an image (indicates recent screenshot)
        const clipboardItems = await navigator.clipboard.read().catch(() => null);
        if (clipboardItems) {
          for (const item of clipboardItems) {
            if (item.types.some(type => type.startsWith('image/'))) {
              logger.proctoring('[ScreenshotDetection] Clipboard contains an image - possible screenshot');
              logViolation({
                timestamp: new Date().toISOString(),
                type: 'print_screen',
                severity: 'high',
                details: 'Screenshot detected in clipboard. Candidate may have captured interview content.',
                metadata: { 
                  clipboardTypes: item.types,
                  detectionMethod: 'clipboard_image_check'
                }
              });
              break;
            }
          }
        }
      } catch (e) {
        // Clipboard API access may be denied - that's OK, we have other detection methods
        logger.proctoring('[ScreenshotDetection] Clipboard check failed (permission denied)');
      }
    };

    // Always attach listeners - use refs for state
    document.addEventListener('keydown', handlePrintScreen, true);
    document.addEventListener('keyup', handlePrintScreen, true);
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      document.removeEventListener('keydown', handlePrintScreen, true);
      document.removeEventListener('keyup', handlePrintScreen, true);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []); // Empty deps - use refs for current state

  // Virtual Machine Detection - check hardware/browser fingerprints
  useEffect(() => {
    const detectVirtualMachine = () => {
      if (vmCheckDoneRef.current || !state.isRecording) return;
      
      const indicators: string[] = [];
      
      // Check WebGL renderer for VM signatures
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            
            const vmRenderers = ['vmware', 'virtualbox', 'parallels', 'hyper-v', 'qemu', 'virtual', 'llvmpipe'];
            const rendererLower = renderer.toLowerCase();
            const vendorLower = vendor.toLowerCase();
            
            for (const vmName of vmRenderers) {
              if (rendererLower.includes(vmName) || vendorLower.includes(vmName)) {
                indicators.push(`VM graphics: ${renderer}`);
                break;
              }
            }
          }
        }
      } catch (e) {
        logger.proctoring('WebGL check failed:', e);
      }
      
      // Check for low hardware concurrency (VMs often have fewer cores)
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
        indicators.push(`Low CPU cores: ${navigator.hardwareConcurrency}`);
      }
      
      // Check for suspicious user agent
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('virtual') || ua.includes('vmware') || ua.includes('virtualbox')) {
        indicators.push('VM signature in user agent');
      }
      
      // Check device memory (VMs often have limited memory)
      if ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 2) {
        indicators.push(`Low memory: ${(navigator as any).deviceMemory}GB`);
      }
      
      // Check for missing/fake battery API (VMs often don't have batteries)
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          if (battery.charging && battery.chargingTime === 0 && battery.level === 1) {
            indicators.push('Suspicious battery status (always full, always charging)');
          }
        }).catch(() => {});
      }
      
      vmCheckDoneRef.current = true;
      
      // If multiple indicators, log violation
      if (indicators.length >= 2) {
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'virtual_machine',
          severity: 'high',
          details: `Possible virtual machine detected. Candidate may be hiding other windows or applications. Indicators: ${indicators.join(', ')}`,
          metadata: { indicators, indicatorCount: indicators.length }
        });
      } else if (indicators.length === 1) {
        logger.proctoring('VM detection: Single indicator found (not enough for violation):', indicators[0]);
      }
    };

    if (state.isRecording) {
      // Check after a short delay to allow page to fully load
      setTimeout(detectVirtualMachine, 3000);
    }
  }, [state.isRecording]);

  // Typing Pattern Analysis - detect suspicious typing patterns (copy-paste from external source)
  useEffect(() => {
    const analyzeTypingPattern = () => {
      const now = Date.now();
      const cooldown = 60000; // 1 minute cooldown
      
      if (now - lastTypingAnalysisRef.current < cooldown) return;
      
      const timestamps = typingTimestampsRef.current;
      if (timestamps.length < 10) return; // Need enough data
      
      // Get recent keystrokes (last 5 seconds)
      const recentWindow = 5000;
      const recentTimestamps = timestamps.filter(t => now - t < recentWindow);
      
      if (recentTimestamps.length < 5) return;
      
      // Calculate typing speed (keystrokes per second)
      const typingSpeed = recentTimestamps.length / (recentWindow / 1000);
      
      // Calculate inter-keystroke intervals
      const intervals: number[] = [];
      for (let i = 1; i < recentTimestamps.length; i++) {
        intervals.push(recentTimestamps[i] - recentTimestamps[i - 1]);
      }
      
      // Check for suspicious patterns:
      // 1. Very high typing speed (> 15 keys/sec is superhuman)
      // 2. Very consistent intervals (robotic typing)
      // 3. Sudden burst after period of inactivity
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / avgInterval;
      
      // Suspicious if typing is very fast AND very consistent (CV < 0.3)
      if (typingSpeed > 12 && coefficientOfVariation < 0.3) {
        lastTypingAnalysisRef.current = now;
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'suspicious_typing',
          severity: 'medium',
          details: `Suspicious typing pattern detected. Very fast (${typingSpeed.toFixed(1)} keys/sec) and consistent typing may indicate automated input or copy-paste from external source.`,
          metadata: {
            typingSpeed,
            avgInterval,
            coefficientOfVariation,
            keystrokeCount: recentTimestamps.length,
          }
        });
      }
      
      // NOTE: Removed "sudden burst" detection as it causes false positives when candidates
      // switch between MCQ (no typing) and descriptive questions (typing burst).
      // We only flag superhuman typing speed (>12 keys/sec) with robotic consistency (CV < 0.3).
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.isRecording) return;
      
      // Only track alphanumeric keys (actual typing)
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        typingTimestampsRef.current.push(Date.now());
        
        // Keep only last 100 keystrokes
        if (typingTimestampsRef.current.length > 100) {
          typingTimestampsRef.current = typingTimestampsRef.current.slice(-100);
        }
        
        // Analyze pattern periodically
        analyzeTypingPattern();
      }
    };

    if (state.isRecording) {
      document.addEventListener('keydown', handleKeyDown);
      typingTimestampsRef.current = []; // Reset on start
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isRecording]);

  // Audio Playback Detection - detect if system audio is playing (pre-recorded answers)
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let checkInterval: NodeJS.Timeout | null = null;
    let lastAudioDetectionTime = 0;
    
    const detectAudioPlayback = async () => {
      if (!state.isRecording) return;
      
      try {
        // Try to detect audio output using AudioContext
        // Note: This is limited by browser security - we can only detect
        // audio that's captured in our media stream or through specific APIs
        
        // Check for audio elements playing on the page
        const audioElements = document.querySelectorAll('audio, video');
        let externalAudioPlaying = false;
        
        audioElements.forEach((el: Element) => {
          const mediaEl = el as HTMLMediaElement;
          // Skip our own proctoring video
          if (!mediaEl.muted && !mediaEl.paused && mediaEl.currentTime > 0) {
            // Check if this is not our recording
            if (!mediaEl.closest('[data-proctoring]')) {
              externalAudioPlaying = true;
            }
          }
        });
        
        if (externalAudioPlaying) {
          const now = Date.now();
          if (now - lastAudioDetectionTime > 30000) { // 30 sec cooldown
            lastAudioDetectionTime = now;
            logViolation({
              timestamp: new Date().toISOString(),
              type: 'audio_playback',
              severity: 'medium',
              details: 'External audio/video playback detected on the page. Candidate may be listening to pre-recorded answers or receiving audio assistance.',
              metadata: { 
                source: 'page_media_elements',
                elementCount: audioElements.length 
              }
            });
          }
        }
        
        // Additional check: Analyze microphone for played-back audio characteristics
        // Played-back audio often has specific frequency signatures
        if (state.voiceAnalysis && state.enhancedVoiceResult) {
          const { spectralCentroid, zeroCrossingRate } = state.enhancedVoiceResult;
          
          // Played-back audio often has:
          // - Higher spectral centroid (more high frequencies)
          // - More consistent zero crossing rate
          // This is a heuristic and may have false positives
          if (spectralCentroid > 3000 && zeroCrossingRate > 0.3) {
            const now = Date.now();
            if (now - lastAudioDetectionTime > 60000) { // 1 min cooldown
              lastAudioDetectionTime = now;
              logViolation({
                timestamp: new Date().toISOString(),
                type: 'audio_playback',
                severity: 'low',
                details: 'Audio characteristics suggest possible playback of recorded content through speakers. High-frequency content and consistent patterns detected.',
                metadata: { 
                  source: 'spectral_analysis',
                  spectralCentroid,
                  zeroCrossingRate 
                }
              });
            }
          }
        }
      } catch (error) {
        logger.error('Audio playback detection error:', error);
      }
    };

    if (state.isRecording) {
      // Check periodically
      checkInterval = setInterval(detectAudioPlayback, 5000);
    }
    
    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (audioContext) audioContext.close();
    };
  }, [state.isRecording, state.voiceAnalysis, state.enhancedVoiceResult]);

  // Map violation types to actual DB column names
  const getDbColumnForViolationType = (type: string): string => {
    const columnMap: Record<string, string> = {
      'multiple_persons': 'multiple_person_detections',
      'multiple_voices': 'multiple_voice_detections',
      'tab_switch': 'tab_switch_count',
      'look_away': 'look_away_count',
      'copy_attempt': 'copy_attempt_count',
      'eye_movement': 'look_away_count', // Map eye_movement to look_away_count
      'liveness_fail': 'look_away_count', // Phase 2: Map to existing column
      'person_swap': 'multiple_person_detections', // Phase 2: Map to existing column
      'silence_anomaly': 'look_away_count', // Phase 2: Map to existing column
      'phone_detected': 'copy_attempt_count', // Map phone detection to copy_attempt
      'prohibited_object': 'copy_attempt_count', // Map prohibited objects to copy_attempt
      'multiple_monitors': 'tab_switch_count', // Map multiple monitors to tab_switch
      'print_screen': 'copy_attempt_count', // Map print screen to copy_attempt
      'virtual_machine': 'copy_attempt_count', // Map VM detection to copy_attempt
      'suspicious_typing': 'copy_attempt_count', // Map typing analysis to copy_attempt
      'audio_playback': 'multiple_voice_detections', // Map audio playback to voice detections
    };
    return columnMap[type] || `${type}_count`;
  };

  // Upload screenshot via edge function (works for unauthenticated candidates)
  const uploadScreenshotViaEdgeFunction = async (
    blob: Blob,
    screenshotType: 'violation' | 'periodic',
    timestamp: number
  ): Promise<string | null> => {
    const sessionId = createdSessionIdRef.current || state.sessionId;
    if (!sessionId) {
      logger.proctoring('No session ID for screenshot upload');
      return null;
    }

    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('screenshotType', screenshotType);
    formData.append('file', blob, `${screenshotType}-${timestamp}.jpg`);
    formData.append('timestamp', timestamp.toString());
    
    // Add session token for candidate authentication
    if (sessionTokenRef.current && attemptId) {
      formData.append('sessionToken', sessionTokenRef.current);
      formData.append('attemptId', attemptId);
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/upload-proctoring-screenshot`, {
        method: 'POST',
          headers: edgeFunctionHeaders(false),
          body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Screenshot upload failed:', error);
        return null;
      }

      const result = await response.json();
      logger.proctoring(`${screenshotType} screenshot uploaded:`, result.filePath);
      return result.filePath;
    } catch (error) {
      logger.error('Error uploading screenshot:', error);
      return null;
    }
  };

  // Capture screenshot from CAMERA stream for violation evidence
  const captureViolationScreenshot = async (): Promise<string | null> => {
    try {
      const stream = videoStreamRef.current || state.videoStream;
      if (!stream || !stream.active) {
        logger.proctoring('No active video stream for screenshot');
        return null;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        logger.proctoring('Video track not live for screenshot');
        return null;
      }

      // Create a video element to capture the current frame
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play().then(() => resolve()).catch(reject);
        };
        video.onerror = reject;
        setTimeout(reject, 2000); // 2 second timeout
      });

      // Wait a moment for the video to render
      await new Promise(r => setTimeout(r, 100));

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        video.pause();
        video.srcObject = null;
        return null;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.pause();
      video.srcObject = null;

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7);
      });

      if (!blob) {
        logger.proctoring('Failed to create screenshot blob');
        return null;
      }

      // Upload via edge function (works for unauthenticated candidates)
      const timestamp = Date.now();
      const filePath = await uploadScreenshotViaEdgeFunction(blob, 'violation', timestamp);
      
      if (filePath) {
        logger.proctoring('Camera violation screenshot captured:', filePath);
      }
      
      return filePath;
    } catch (error) {
      logger.error('Error capturing camera violation screenshot:', error);
      return null;
    }
  };

  // Capture screenshot from SCREEN stream for violation evidence
  const captureScreenViolationScreenshot = async (): Promise<string | null> => {
    try {
      const stream = screenStreamRef.current;
      if (!stream || !stream.active) {
        logger.proctoring('No active screen stream for screenshot');
        return null;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        logger.proctoring('Screen track not live for screenshot');
        return null;
      }

      // Create a video element to capture the current frame
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play().then(() => resolve()).catch(reject);
        };
        video.onerror = reject;
        setTimeout(reject, 2000); // 2 second timeout
      });

      // Wait a moment for the video to render
      await new Promise(r => setTimeout(r, 100));

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        video.pause();
        video.srcObject = null;
        return null;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.pause();
      video.srcObject = null;

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7);
      });

      if (!blob) {
        logger.proctoring('Failed to create screen screenshot blob');
        return null;
      }

      // Upload via edge function with screen-violation type
      const sessionId = createdSessionIdRef.current || state.sessionId;
      if (!sessionId) {
        logger.proctoring('No session ID for screen screenshot upload');
        return null;
      }

      const timestamp = Date.now();
      const screenshotPath = `${sessionId}/screen-violation-${timestamp}.jpg`;
      
      const formData = new FormData();
      formData.append('file', blob, 'screen-screenshot.jpg');
      formData.append('sessionId', sessionId);
      formData.append('screenshotPath', screenshotPath);
      formData.append('screenshotType', 'screen_violation');
      formData.append('timestamp', timestamp.toString());
      
      if (sessionTokenRef.current && attemptId) {
        formData.append('sessionToken', sessionTokenRef.current);
        formData.append('attemptId', attemptId);
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-proctoring-screenshot`,
        {
          method: 'POST',
          headers: edgeFunctionHeaders(false),
          body: formData,
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        logger.proctoring('Screen violation screenshot captured:', result.filePath);
        return result.filePath;
      } else {
        const errorText = await response.text();
        logger.warn('Screen violation screenshot upload failed:', response.status, errorText);
        return null;
      }
    } catch (error) {
      logger.error('Error capturing screen violation screenshot:', error);
      return null;
    }
  };

  // Log violation with enhanced tracking and screenshot capture
  // CRITICAL: videoTimestamp tracks elapsed time since recording started (in seconds)
  // This allows reviewers to jump to the exact point in the recording where violation occurred
  // Uses edge function for secure violation logging (no direct DB access for candidates)
  const logViolation = async (violation: ProctoringViolation) => {
    // Calculate video timestamp as elapsed time since recording started
    // Use ref instead of state.isRecording to avoid stale closure issues
    let calculatedTimestamp = 0;
    
    if (recordingStartTimeRef.current && recordingStartTimeRef.current > 0) {
      const elapsedMs = Date.now() - recordingStartTimeRef.current;
      calculatedTimestamp = Math.floor(elapsedMs / 1000); // Convert to seconds
      
      // CRITICAL FIX: Validate timestamp is reasonable (< 4 hours = 14400 seconds)
      // If timestamp is unreasonably large, it indicates recordingStartTimeRef was not properly set
      if (calculatedTimestamp > 14400 || calculatedTimestamp < 0) {
        logger.warn(`[logViolation] Unreasonable timestamp detected: ${calculatedTimestamp}s, resetting to 0`);
        calculatedTimestamp = 0;
      }
    }
    
    violation.videoTimestamp = calculatedTimestamp;
    logger.proctoring(`Violation at recording time: ${violation.videoTimestamp}s - ${violation.type}`);

    // Define violation types by their screenshot source
    // Camera-based violations (face/identity related): capture from camera stream
    const cameraViolations = ['multiple_persons', 'look_away', 'eye_movement', 'liveness_fail', 'person_swap', 'phone_detected', 'prohibited_object'];
    // Screen-based violations: capture from screen stream
    const screenViolations = ['tab_switch', 'copy_attempt', 'print_screen', 'suspicious_typing'];
    // Violations that need BOTH camera and screen screenshots
    const bothNeeded = ['tab_switch', 'copy_attempt', 'print_screen', 'multiple_voices'];
    
    if (isRecordingRef.current) {
      const needsCamera = cameraViolations.includes(violation.type) || bothNeeded.includes(violation.type);
      const needsScreen = screenViolations.includes(violation.type) || bothNeeded.includes(violation.type);
      
      // Capture both screenshots in PARALLEL to minimize latency
      const [cameraResult, screenResult] = await Promise.allSettled([
        needsCamera ? captureViolationScreenshot() : Promise.resolve(null),
        needsScreen ? captureScreenViolationScreenshot() : Promise.resolve(null),
      ]);
      
      // Use live capture if successful, otherwise fallback to last periodic screenshot
      if (cameraResult.status === 'fulfilled' && cameraResult.value) {
        violation.screenshotUrl = cameraResult.value;
        violation.metadata = { ...violation.metadata, hasCameraScreenshot: true, screenshotSource: 'live' };
      } else if (needsCamera && lastCameraPeriodicUrlRef.current) {
        // Fallback to last successful periodic camera screenshot
        violation.screenshotUrl = lastCameraPeriodicUrlRef.current;
        violation.metadata = { ...violation.metadata, hasCameraScreenshot: true, screenshotSource: 'periodic_fallback' };
        logger.proctoring('[logViolation] Using periodic fallback for camera screenshot');
      }
      
      if (screenResult.status === 'fulfilled' && screenResult.value) {
        violation.screenScreenshotUrl = screenResult.value;
        violation.metadata = { ...violation.metadata, hasScreenScreenshot: true, screenScreenshotSource: 'live' };
      } else if (needsScreen && lastScreenPeriodicUrlRef.current) {
        // Fallback to last successful periodic screen screenshot
        violation.screenScreenshotUrl = lastScreenPeriodicUrlRef.current;
        violation.metadata = { ...violation.metadata, hasScreenScreenshot: true, screenScreenshotSource: 'periodic_fallback' };
        logger.proctoring('[logViolation] Using periodic fallback for screen screenshot');
      }
    }

    const newViolations = [...state.violations, violation];
    const detailedViolations = [...(state as any).detailedViolations || [], violation];
    
    setState(prev => ({
      ...prev,
      violations: newViolations,
      detailedViolations,
    }));

    // CRITICAL: Use ref instead of state.sessionId to avoid stale closure issue
    // When violation handlers are created, state.sessionId may be empty
    // But createdSessionIdRef is always current
    const currentSessionId = createdSessionIdRef.current || state.sessionId;
    
    if (currentSessionId) {
      // Get session token for interview attempts
      const tokenToUse = attemptType === 'interview' ? sessionTokenRef.current : undefined;
      
      // Use correct column name mapping for counter updates
      const countField = getDbColumnForViolationType(violation.type);
      
      // Prepare violation with unique ID
      const violationWithId = {
        ...violation,
        id: `${violation.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      
      logger.proctoring('[logViolation] Calling edge function for session:', currentSessionId, 'type:', violation.type);
      
      try {
        // Call edge function instead of direct DB access
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-proctoring-violation`,
          {
            method: 'POST',
            headers: edgeFunctionHeaders(true),
            body: JSON.stringify({
              sessionId: currentSessionId,
              attemptId,
              sessionToken: tokenToUse,
              attemptType,
              violation: violationWithId,
              counterUpdates: { [countField]: 1 },
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          logger.error('[logViolation] Edge function error:', response.status, errorData);
        } else {
          logger.proctoring('Violation logged successfully via edge function:', violation.type);
        }

        // Send notification for high severity violations (this uses supabase.rpc which needs auth)
        // Note: For unauthenticated candidates, this will fail silently - that's OK
        // The violation is still logged, notifications are best-effort
        if (violation.severity === 'high') {
          try {
            // Get attempt info for notification - this needs to be done via edge function
            // For now, we skip notifications for unauthenticated users
            // Admin/staff will see violations in the proctoring dashboard
            logger.proctoring('High severity violation logged, notification would be sent to staff');
          } catch (notifError) {
            logger.error('Failed to send proctoring notification:', notifError);
            // Don't fail violation logging if notification fails
          }
        }
      } catch (error) {
        logger.error('[logViolation] Error calling edge function:', error);
      }
    }
  };


  // Upload recordings via secure edge function using direct fetch (FormData)
  // Accepts sessionToken for candidate authentication (unauthenticated users)
  // RETURNS: UploadQueueResult indicating what was successfully queued
  const uploadRecordings = async (explicitSessionId?: string, sessionToken?: string): Promise<UploadQueueResult> => {
    const sessionId = explicitSessionId || state.sessionId;
    
    const result: UploadQueueResult = {
      videoQueued: false,
      screenQueued: false,
      videoHadChunks: false,
      screenHadChunks: false,
    };
    
    logger.proctoring('╔══════════════════════════════════════════════════════════════╗');
    logger.proctoring('║            UPLOAD RECORDINGS - DEBUG START                   ║');
    logger.proctoring('╚══════════════════════════════════════════════════════════════╝');
    logger.proctoring('Session ID:', sessionId);
    logger.proctoring('Attempt ID:', attemptId);
    logger.proctoring('Session Token provided:', sessionToken ? 'YES' : 'NO');
    logger.proctoring('Video recorder ref:', videoRecorderRef.current ? 'EXISTS' : 'NULL');
    logger.proctoring('Video recorder state:', videoRecorderRef.current?.state || 'N/A');
    logger.proctoring('Screen recorder ref:', screenRecorderRef.current ? 'EXISTS' : 'NULL');
    logger.proctoring('Screen recorder state:', screenRecorderRef.current?.state || 'N/A');
    logger.proctoring('Video chunks array length:', videoChunksRef.current.length);
    logger.proctoring('Screen chunks array length:', screenChunksRef.current.length);
    
    // Log each chunk's size for debugging
    videoChunksRef.current.forEach((chunk, i) => {
      logger.proctoring(`  Video chunk[${i}]: ${chunk.size} bytes`);
    });
    screenChunksRef.current.forEach((chunk, i) => {
      logger.proctoring(`  Screen chunk[${i}]: ${chunk.size} bytes`);
    });
    
    // Calculate total sizes for debugging
    const videoTotalSize = videoChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
    const screenTotalSize = screenChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
    logger.proctoring('Video total size:', (videoTotalSize / (1024 * 1024)).toFixed(2), 'MB');
    logger.proctoring('Screen total size:', (screenTotalSize / (1024 * 1024)).toFixed(2), 'MB');
    
    // Track what chunks we have
    result.videoHadChunks = videoChunksRef.current.length > 0 && videoTotalSize > 0;
    result.screenHadChunks = screenChunksRef.current.length > 0 && screenTotalSize > 0;
    
    if (!sessionId) {
      logger.error('╔══════════════════════════════════════════════════════════════╗');
      logger.error('║  UPLOAD ABORTED: No session ID available                     ║');
      logger.error('╚══════════════════════════════════════════════════════════════╝');
      return result;
    }

    if (videoChunksRef.current.length === 0 && screenChunksRef.current.length === 0) {
      logger.error('╔══════════════════════════════════════════════════════════════╗');
      logger.error('║  UPLOAD ABORTED: NO CHUNKS AVAILABLE!                        ║');
      logger.error('╚══════════════════════════════════════════════════════════════╝');
      logger.error('Recording likely never started or failed. Possible causes:');
      logger.error('1. startVideoRecording returned false');
      logger.error('2. MediaRecorder never entered "recording" state');
      logger.error('3. ondataavailable handler never fired');
      logger.error('4. Interview completed before first 1-second interval');
      logger.error('5. Camera/screen access was denied');
      
      // Log this failure to the proctoring session for debugging
      try {
        await supabase
          .from('proctoring_sessions')
          .update({ 
            reviewer_notes: 'RECORDING FAILURE: No video or screen chunks were captured. Recording may have failed to start.',
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      } catch (e) {
        logger.error('Failed to log recording failure:', e);
      }
      return result;
    }

    // Get Supabase URL for background uploader
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      logger.error('UPLOAD ABORTED: VITE_SUPABASE_URL not configured');
      return result;
    }
    const uploadUrl = `${supabaseUrl}/functions/v1/upload-proctoring-recording`;
    logger.proctoring('Upload URL:', uploadUrl);
    
    logger.proctoring('=== QUEUEING UPLOADS TO INDEXEDDB FOR BACKGROUND PROCESSING ===');
    
    // Register service worker for background uploads (if not already registered)
    await registerUploadServiceWorker();
    
    // Helper function to process and upload recording
    // Duration is calculated by the video player during playback (no pre-processing needed)
    const processAndUpload = async (
      chunks: Blob[],
      recordingType: 'video' | 'screen'
    ): Promise<boolean> => {
      logger.proctoring(`=== PROCESSING ${recordingType.toUpperCase()} FOR UPLOAD ===`);
      logger.proctoring(`Chunks: ${chunks.length}`);
      
      const blob = new Blob(chunks, { type: 'video/webm' });
      logger.proctoring(`Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Use sessionToken parameter OR fallback to ref for reliability
      const tokenToUse = sessionToken || sessionTokenRef.current;
      logger.proctoring(`Using session token for ${recordingType} upload:`, tokenToUse ? 'YES' : 'NO');
      
      const queued = await queueRecordingUpload(
        sessionId,
        recordingType,
        blob,
        uploadUrl,
        tokenToUse,
        attemptId
      );
      
      if (queued) {
        logger.proctoring(`>>> ${recordingType.toUpperCase()} RECORDING QUEUED FOR BACKGROUND UPLOAD`);
      } else {
        logger.error(`>>> FAILED TO QUEUE ${recordingType.toUpperCase()} RECORDING`);
      }
      
      return queued;
    };
    
    // Queue video and screen recordings in PARALLEL for faster submission
    const uploadPromises: Promise<void>[] = [];
    
    // DIAGNOSTIC: Capture upload attempt diagnostics for debugging
    const uploadDiagnostics = {
      videoChunksCount: videoChunksRef.current.length,
      screenChunksCount: screenChunksRef.current.length,
      videoTotalBytes: videoTotalSize,
      screenTotalBytes: screenTotalSize,
      videoRecorderState: videoRecorderRef.current?.state || 'null',
      screenRecorderState: screenRecorderRef.current?.state || 'null',
      videoHadChunks: result.videoHadChunks,
      screenHadChunks: result.screenHadChunks,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      indexedDBAvailable: 'indexedDB' in window,
    };
    
    if (result.videoHadChunks) {
      uploadPromises.push(
        processAndUpload(videoChunksRef.current, 'video').then(queued => {
          result.videoQueued = queued;
          (uploadDiagnostics as any).videoQueued = queued;
        }).catch(err => {
          logger.error('>>> VIDEO QUEUE ERROR:', err);
          (uploadDiagnostics as any).videoQueueError = err?.message || String(err);
        })
      );
    } else {
      logger.warn('>>> SKIPPING VIDEO: No chunks or zero size');
      logger.warn('>>> Video recorder state:', videoRecorderRef.current?.state || 'NULL');
      (uploadDiagnostics as any).videoSkipReason = 'no_chunks_or_zero_size';
    }

    if (result.screenHadChunks) {
      uploadPromises.push(
        processAndUpload(screenChunksRef.current, 'screen').then(queued => {
          result.screenQueued = queued;
          (uploadDiagnostics as any).screenQueued = queued;
        }).catch(err => {
          logger.error('>>> SCREEN QUEUE ERROR:', err);
          (uploadDiagnostics as any).screenQueueError = err?.message || String(err);
        })
      );
    } else {
      logger.warn('>>> SKIPPING SCREEN: No chunks or zero size');
      logger.warn('>>> Screen recorder state:', screenRecorderRef.current?.state || 'NULL');
      logger.warn('>>> Possible causes:');
      logger.warn('    1. User clicked "Stop sharing" during interview');
      logger.warn('    2. Screen recording failed to start');
      logger.warn('    3. Browser tab memory cleared the chunks');
      logger.warn('    4. MediaRecorder error during recording');
      (uploadDiagnostics as any).screenSkipReason = 'no_chunks_or_zero_size';
    }
    
    // Wait for both uploads to complete queuing
    await Promise.all(uploadPromises);
    
    // DIAGNOSTIC: Save upload diagnostics to proctoring_sessions for debugging failed uploads
    try {
      await supabase
        .from('proctoring_sessions')
        .update({ 
          upload_diagnostics: uploadDiagnostics,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      logger.proctoring('Upload diagnostics saved to session');
    } catch (diagErr) {
      logger.warn('Failed to save upload diagnostics:', diagErr);
    }
    
    // Trigger background upload process (service worker or direct)
    // This continues even after page navigation
    logger.proctoring('=== TRIGGERING BACKGROUND UPLOAD PROCESS ===');
    await triggerBackgroundUpload();
    
    logger.proctoring('╔══════════════════════════════════════════════════════════════╗');
    logger.proctoring('║  UPLOAD QUEUE RESULT:                                        ║');
    logger.proctoring(`║  Video: ${result.videoQueued ? '✅ QUEUED' : '❌ NOT QUEUED'} (had chunks: ${result.videoHadChunks})          ║`);
    logger.proctoring(`║  Screen: ${result.screenQueued ? '✅ QUEUED' : '❌ NOT QUEUED'} (had chunks: ${result.screenHadChunks})         ║`);
    logger.proctoring('╚══════════════════════════════════════════════════════════════╝');
    
    // Log diagnostic summary if any upload was skipped
    if (!result.videoHadChunks || !result.screenHadChunks) {
      logger.error('╔══════════════════════════════════════════════════════════════╗');
      logger.error('║  ⚠️  UPLOAD DIAGNOSTICS - MISSING RECORDINGS                  ║');
      logger.error('╠══════════════════════════════════════════════════════════════╣');
      logger.error(`║  Video chunks: ${videoChunksRef.current.length} (${(videoTotalSize / (1024 * 1024)).toFixed(2)} MB)`);
      logger.error(`║  Screen chunks: ${screenChunksRef.current.length} (${(screenTotalSize / (1024 * 1024)).toFixed(2)} MB)`);
      logger.error(`║  Video recorder: ${videoRecorderRef.current?.state || 'NULL'}`);
      logger.error(`║  Screen recorder: ${screenRecorderRef.current?.state || 'NULL'}`);
      logger.error('╚══════════════════════════════════════════════════════════════╝');
    }

    // CRITICAL: Calculate integrity score from DB values (not potentially stale state)
    try {
      // Fetch actual violation counts from DB to avoid stale state issues
      const { data: sessionData, error: fetchError } = await supabase
        .from('proctoring_sessions')
        .select('multiple_person_detections, multiple_voice_detections, tab_switch_count, look_away_count, copy_attempt_count, violations, detailed_violations')
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchError) {
        logger.error('Error fetching session for integrity calculation:', fetchError);
        return result;
      }

      // Calculate from actual DB values
      const multiplePersons = sessionData?.multiple_person_detections || 0;
      const multipleVoices = sessionData?.multiple_voice_detections || 0;
      const tabSwitches = sessionData?.tab_switch_count || 0;
      const lookAways = sessionData?.look_away_count || 0;
      const copyAttempts = sessionData?.copy_attempt_count || 0;
      
      // Get severity from detailed_violations for more accurate scoring
      const violations = (sessionData?.detailed_violations as any[]) || [];
      const highSeverityCount = violations.filter(v => v?.severity === 'high').length;
      const mediumSeverityCount = violations.filter(v => v?.severity === 'medium').length;
      const lowSeverityCount = violations.filter(v => v?.severity === 'low').length;
      
      // Calculate integrity score based on ACTUAL violation severity from detailed_violations
      // This ensures phone_detected, prohibited_object, etc. are properly penalized
      let integrityScore = 100;
      
      if (violations.length > 0) {
        // Deduct based on severity: high -15, medium -8, low -3
        // Phone detection, prohibited objects, multiple persons are HIGH severity (-15 each)
        // Tab switches are MEDIUM severity (-8 each)
        // Look aways, inactivity are LOW severity (-3 each)
        integrityScore = Math.max(
          0, 
          100 
          - (highSeverityCount * 15)   // Phone, prohibited objects, multiple persons, copy attempts
          - (mediumSeverityCount * 8)  // Tab switches
          - (lowSeverityCount * 3)     // Look aways, minor violations
        );
      }
      
      const normalizedScore = Math.max(0, Math.min(100, integrityScore));
      
      // Flag for review if score is low OR any high severity violations
      const shouldFlag = normalizedScore < 70 || highSeverityCount > 0;

      logger.proctoring('Calculating integrity score from DB:', { 
        violationCount: violations.length,
        highSeverityCount,
        mediumSeverityCount,
        lowSeverityCount,
        integrityScore: normalizedScore,
        flagged: shouldFlag
      });

      const { error: updateError } = await supabase
        .from('proctoring_sessions')
        .update({
          integrity_score: normalizedScore,
          flagged_for_review: shouldFlag,
        })
        .eq('id', sessionId);

      if (updateError) {
        logger.error('Error updating integrity score:', updateError);
      } else {
        logger.proctoring('Integrity score saved successfully:', normalizedScore);
      }
    } catch (integrityError) {
      logger.error('Error calculating integrity score:', integrityError);
    }
    
    return result;
  };

  // Stop recording with explicit session ID parameter for reliability
  // sessionToken is optional - used for candidate uploads (unauthenticated users)
  // RETURNS: UploadQueueResult indicating what recordings were queued for upload
  const stopRecording = async (explicitSessionId?: string, sessionToken?: string): Promise<UploadQueueResult> => {
    const sessionIdToClose = explicitSessionId || state.sessionId;
    
    // Default result if something fails early
    let uploadResult: UploadQueueResult = {
      videoQueued: false,
      screenQueued: false,
      videoHadChunks: false,
      screenHadChunks: false,
    };
    
    // Stop periodic screenshot capture (both camera and screen)
    stopPeriodicScreenshots();
    stopPeriodicScreenScreenshots();
    
    
    // Phase 2: Stop enhanced voice analyzer
    if (enhancedVoiceAnalyzerRef.current) {
      enhancedVoiceAnalyzerRef.current.dispose();
      enhancedVoiceAnalyzerRef.current = null;
    }
    
    // Phase 2: Reset liveness detector and face verifier
    if (livenessDetectorRef.current) {
      livenessDetectorRef.current.reset();
      livenessDetectorRef.current = null;
    }
    if (faceVerifierRef.current) {
      faceVerifierRef.current.reset();
      faceVerifierRef.current = null;
    }
    referenceCapuredRef.current = false;
    
    // Stop face detection
    if (faceDetectionCleanupRef.current) {
      faceDetectionCleanupRef.current();
      faceDetectionCleanupRef.current = null;
    }
    
    // Stop gaze detection (MediaPipe)
    if (gazeDetectionCleanupRef.current) {
      gazeDetectionCleanupRef.current();
      gazeDetectionCleanupRef.current = null;
    }
    cleanupGazeDetection();
    
    // Clean up video element
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.srcObject = null;
      videoElementRef.current = null;
    }
    
    // Wait for recorders to stop and get final chunks
    const stopPromises: Promise<void>[] = [];
    
    logger.proctoring('╔══════════════════════════════════════════════════════════════╗');
    logger.proctoring('║               STOP RECORDING - DEBUG START                   ║');
    logger.proctoring('╚══════════════════════════════════════════════════════════════╝');
    logger.proctoring('Session ID to close:', sessionIdToClose);
    logger.proctoring('isRecordingRef.current:', isRecordingRef.current);
    logger.proctoring('recordingStartTimeRef.current:', recordingStartTimeRef.current);
    logger.proctoring('Video recorder ref:', videoRecorderRef.current ? 'EXISTS' : 'NULL');
    logger.proctoring('Video recorder state:', videoRecorderRef.current?.state || 'N/A');
    logger.proctoring('Screen recorder ref:', screenRecorderRef.current ? 'EXISTS' : 'NULL');
    logger.proctoring('Screen recorder state:', screenRecorderRef.current?.state || 'N/A');
    logger.proctoring('Current video chunks BEFORE stop:', videoChunksRef.current.length);
    logger.proctoring('Current screen chunks BEFORE stop:', screenChunksRef.current.length);
    
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      logger.proctoring('✓ Video recorder is active, will stop and flush...');
      stopPromises.push(new Promise<void>((resolve) => {
        const recorder = videoRecorderRef.current!;
        
        // CRITICAL: Force flush any pending data before stopping
        try {
          if (recorder.state === 'recording') {
            logger.proctoring('  Requesting final video data before stop...');
            recorder.requestData();
          }
        } catch (e) {
          logger.warn('  Could not request final video data:', e);
        }
        
        recorder.onstop = () => {
          logger.proctoring('  Video recorder stopped, final chunks:', videoChunksRef.current.length);
          resolve();
        };
        recorder.stop();
      }));
    } else {
      logger.error('✗ VIDEO RECORDER NOT ACTIVE OR NULL - THIS IS THE PROBLEM!');
      logger.error('  Recording was never started or already stopped');
    }
    
    if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
      logger.proctoring('✓ Screen recorder is active, will stop and flush...');
      stopPromises.push(new Promise<void>((resolve) => {
        const recorder = screenRecorderRef.current!;
        
        // CRITICAL: Force flush any pending data before stopping
        try {
          if (recorder.state === 'recording') {
            logger.proctoring('  Requesting final screen data before stop...');
            recorder.requestData();
          }
        } catch (e) {
          logger.warn('  Could not request final screen data:', e);
        }
        
        recorder.onstop = () => {
          logger.proctoring('  Screen recorder stopped, final chunks:', screenChunksRef.current.length);
          resolve();
        };
        recorder.stop();
      }));
    } else {
      logger.error('✗ Screen recorder not active or null');
    }
    
    // Wait for all recorders to finish (max 5 seconds to allow data flush)
    if (stopPromises.length > 0) {
      logger.proctoring(`Waiting for ${stopPromises.length} recorder(s) to stop...`);
      await Promise.race([
        Promise.all(stopPromises),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
      logger.proctoring('╔══════════════════════════════════════════════════════════════╗');
      logger.proctoring('║  Recorders stopped. FINAL chunk counts:                      ║');
      logger.proctoring(`║  Video chunks: ${videoChunksRef.current.length}                                              ║`);
      logger.proctoring(`║  Screen chunks: ${screenChunksRef.current.length}                                             ║`);
      logger.proctoring('╚══════════════════════════════════════════════════════════════╝');
    } else {
      logger.error('╔══════════════════════════════════════════════════════════════╗');
      logger.error('║  NO ACTIVE RECORDERS TO STOP!                                ║');
      logger.error('║  Recordings never started or already stopped.                ║');
      logger.error('║  uploadRecordings will have ZERO chunks!                     ║');
      logger.error('╚══════════════════════════════════════════════════════════════╝');
    }

    // =====================================================
    // CHUNKED UPLOAD PATH: Wait for queue to drain, then merge
    // =====================================================
    let useLegacyFallback = false;
    
    if (useChunkedUploadRef.current && chunkUploaderRef.current && sessionIdToClose) {
      logger.proctoring('╔══════════════════════════════════════════════════════════════╗');
      logger.proctoring('║  CHUNKED UPLOAD PATH - Waiting for queue to drain           ║');
      logger.proctoring('╚══════════════════════════════════════════════════════════════╝');
      
      try {
        // Stop accepting new chunks and wait for queue to empty
        const chunkResult = await chunkUploaderRef.current.waitForQueueEmpty();
        
        logger.proctoring(`[ChunkUpload] Queue drained. Video: ${chunkResult.videoUploaded} chunks, Screen: ${chunkResult.screenUploaded} chunks`);
        
        // CRITICAL: Check for missing chunks by comparing in-memory vs uploaded
        const videoChunksInMemory = videoChunksRef.current.length;
        const screenChunksInMemory = screenChunksRef.current.length;
        const missingVideoChunks = videoChunksInMemory - chunkResult.videoUploaded;
        const missingScreenChunks = screenChunksInMemory - chunkResult.screenUploaded;
        
        // Recovery: Upload missing chunks if browser still has them in memory
        if (missingVideoChunks > 0 || missingScreenChunks > 0) {
          logger.warn(`[ChunkUpload] MISSING CHUNKS DETECTED! Video: ${missingVideoChunks} missing, Screen: ${missingScreenChunks} missing`);
          logger.proctoring(`[ChunkUpload] Attempting recovery - uploading missing chunks from memory...`);
          
          const recoveryPromises: Promise<void>[] = [];
          
          // Upload missing video chunks (the first N chunks that were dropped)
          if (missingVideoChunks > 0 && videoChunksRef.current.length > 0) {
            const missingVideoBlobs = videoChunksRef.current.slice(0, missingVideoChunks);
            logger.proctoring(`[ChunkUpload] Recovering ${missingVideoBlobs.length} video chunks`);
            
            for (let i = 0; i < missingVideoBlobs.length; i++) {
              const blob = missingVideoBlobs[i];
              recoveryPromises.push((async () => {
                try {
                  // Get signed URL for this chunk
                  const signedUrlResponse = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-chunk-upload-url`,
                    {
                      method: 'POST',
                      headers: edgeFunctionHeaders(true),
                      body: JSON.stringify({
                        sessionId: sessionIdToClose,
                        attemptId,
                        chunkIndex: i,
                        recordingType: 'video',
                        sessionToken: sessionToken || sessionTokenRef.current,
                      }),
                    }
                  );
                  
                  if (signedUrlResponse.ok) {
                    const { signedUrl } = await signedUrlResponse.json();
                    const uploadResponse = await fetch(toBrowserStorageUrl(signedUrl), {
                      method: 'PUT',
                      body: blob,
                      headers: storageUploadHeaders('video/webm'),
                    });
                    if (uploadResponse.ok) {
                      logger.proctoring(`[ChunkUpload] Recovered video chunk #${i}`);
                    }
                  }
                } catch (err) {
                  logger.error(`[ChunkUpload] Failed to recover video chunk #${i}:`, err);
                }
              })());
            }
          }
          
          // Upload missing screen chunks
          if (missingScreenChunks > 0 && screenChunksRef.current.length > 0) {
            const missingScreenBlobs = screenChunksRef.current.slice(0, missingScreenChunks);
            logger.proctoring(`[ChunkUpload] Recovering ${missingScreenBlobs.length} screen chunks`);
            
            for (let i = 0; i < missingScreenBlobs.length; i++) {
              const blob = missingScreenBlobs[i];
              recoveryPromises.push((async () => {
                try {
                  const signedUrlResponse = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-chunk-upload-url`,
                    {
                      method: 'POST',
                      headers: edgeFunctionHeaders(true),
                      body: JSON.stringify({
                        sessionId: sessionIdToClose,
                        attemptId,
                        chunkIndex: i,
                        recordingType: 'screen',
                        sessionToken: sessionToken || sessionTokenRef.current,
                      }),
                    }
                  );
                  
                  if (signedUrlResponse.ok) {
                    const { signedUrl } = await signedUrlResponse.json();
                    const uploadResponse = await fetch(toBrowserStorageUrl(signedUrl), {
                      method: 'PUT',
                      body: blob,
                      headers: storageUploadHeaders('video/webm'),
                    });
                    if (uploadResponse.ok) {
                      logger.proctoring(`[ChunkUpload] Recovered screen chunk #${i}`);
                    }
                  }
                } catch (err) {
                  logger.error(`[ChunkUpload] Failed to recover screen chunk #${i}:`, err);
                }
              })());
            }
          }
          
          // Wait for recovery uploads to complete
          if (recoveryPromises.length > 0) {
            await Promise.all(recoveryPromises);
            logger.proctoring(`[ChunkUpload] Recovery complete - uploaded ${recoveryPromises.length} missing chunks`);
          }
        }
        
        // Check if no chunks were uploaded at all - fall back to legacy
        if (chunkResult.videoUploaded === 0 && chunkResult.screenUploaded === 0 && videoChunksInMemory === 0 && screenChunksInMemory === 0) {
          logger.warn('[ChunkUpload] No chunks available - falling back to legacy upload');
          useLegacyFallback = true;
        } else {
          // Now merge the chunks into final files (including any recovered chunks)
          const mergePromises: Promise<void>[] = [];
          
          const totalVideoChunks = Math.max(chunkResult.videoUploaded, videoChunksInMemory);
          const totalScreenChunks = Math.max(chunkResult.screenUploaded, screenChunksInMemory);
          
          if (totalVideoChunks > 0) {
            mergePromises.push((async () => {
              logger.proctoring('[ChunkUpload] Merging video chunks...');
              const mergeResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merge-proctoring-chunks`,
                {
                  method: 'POST',
                  headers: edgeFunctionHeaders(true),
                  body: JSON.stringify({
                    sessionId: sessionIdToClose,
                    recordingType: 'video',
                    sessionToken: sessionToken || sessionTokenRef.current,
                    attemptId,
                  }),
                }
              );
              
              if (mergeResponse.ok) {
                const mergeResult = await mergeResponse.json();
                logger.proctoring('[ChunkUpload] Video merge complete:', mergeResult.finalUrl);
                uploadResult.videoQueued = true;
                uploadResult.videoHadChunks = true;
              } else {
                const mergeError = await mergeResponse.text();
                logger.error('[ChunkUpload] Video merge failed:', mergeError);
              }
            })());
          }
          
          if (totalScreenChunks > 0) {
            mergePromises.push((async () => {
              logger.proctoring('[ChunkUpload] Merging screen chunks...');
              const mergeResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merge-proctoring-chunks`,
                {
                  method: 'POST',
                  headers: edgeFunctionHeaders(true),
                  body: JSON.stringify({
                    sessionId: sessionIdToClose,
                    recordingType: 'screen',
                    sessionToken: sessionToken || sessionTokenRef.current,
                    attemptId,
                  }),
                }
              );
              
              if (mergeResponse.ok) {
                const mergeResult = await mergeResponse.json();
                logger.proctoring('[ChunkUpload] Screen merge complete:', mergeResult.finalUrl);
                uploadResult.screenQueued = true;
                uploadResult.screenHadChunks = true;
              } else {
                const mergeError = await mergeResponse.text();
                logger.error('[ChunkUpload] Screen merge failed:', mergeError);
              }
            })());
          }
          
          // Wait for all merges to complete
          if (mergePromises.length > 0) {
            await Promise.all(mergePromises);
            logger.proctoring('[ChunkUpload] All merges completed');
          }
          
          // If chunks failed to upload, use legacy as fallback
          if (chunkResult.failedCount > 0) {
            logger.warn(`[ChunkUpload] ${chunkResult.failedCount} chunks failed - using legacy upload for remaining data`);
            useLegacyFallback = true;
          } else {
            // Success! Calculate integrity score
            logger.proctoring('[ChunkUpload] All chunks uploaded and merged successfully');
            
            // Calculate integrity score from DB values
            try {
              const { data: sessionData, error: fetchError } = await supabase
                .from('proctoring_sessions')
                .select('multiple_person_detections, multiple_voice_detections, tab_switch_count, look_away_count, copy_attempt_count, violations, detailed_violations')
                .eq('id', sessionIdToClose)
                .maybeSingle();

              if (!fetchError && sessionData) {
                const violations = (sessionData?.detailed_violations as any[]) || [];
                const highSeverityCount = violations.filter(v => v?.severity === 'high').length;
                const mediumSeverityCount = violations.filter(v => v?.severity === 'medium').length;
                const lowSeverityCount = violations.filter(v => v?.severity === 'low').length;
                
                let integrityScore = Math.max(
                  0, 
                  100 
                  - (highSeverityCount * 15)
                  - (mediumSeverityCount * 8)
                  - (lowSeverityCount * 3)
                );
                
                const normalizedScore = Math.max(0, Math.min(100, integrityScore));
                const shouldFlag = normalizedScore < 70 || highSeverityCount > 0;

                logger.proctoring('[ChunkUpload] Integrity score calculated:', { 
                  normalizedScore, highSeverityCount, mediumSeverityCount, lowSeverityCount 
                });

                await supabase
                  .from('proctoring_sessions')
                  .update({
                    integrity_score: normalizedScore,
                    flagged_for_review: shouldFlag,
                  })
                  .eq('id', sessionIdToClose);
              }
            } catch (integrityError) {
              logger.error('[ChunkUpload] Error calculating integrity score:', integrityError);
            }
          }
        }
      } catch (chunkUploadError) {
        logger.error('[ChunkUpload] Error in chunked upload flow:', chunkUploadError);
        useLegacyFallback = true;
      }
      
      // Reset chunk uploader state
      chunkUploaderStartedRef.current = false;
    } else {
      // No chunk uploader available, use legacy path
      useLegacyFallback = true;
    }
    
    // =====================================================
    // LEGACY UPLOAD PATH: Queue all chunks to IndexedDB (if needed)
    // =====================================================
    if (useLegacyFallback && sessionIdToClose && (videoChunksRef.current.length > 0 || screenChunksRef.current.length > 0)) {
      logger.proctoring('╔══════════════════════════════════════════════════════════════╗');
      logger.proctoring('║  LEGACY UPLOAD PATH - Queueing to IndexedDB                 ║');
      logger.proctoring('╚══════════════════════════════════════════════════════════════╝');
      logger.proctoring('Session ID for upload:', sessionIdToClose);
      logger.proctoring('Session Token for upload:', sessionToken ? 'PROVIDED' : 'MISSING');
      try {
        uploadResult = await uploadRecordings(sessionIdToClose, sessionToken);
        logger.proctoring('!!! uploadRecordings COMPLETED !!!');
      } catch (uploadErr) {
        logger.error('!!! uploadRecordings FAILED !!!', uploadErr);
      }
    }

    // Now safe to stop streams - chunks are already queued
    // CRITICAL: Stop streams from BOTH state AND refs to handle stale closures
    const streamsToStop = [
      state.videoStream,
      state.screenStream,
      videoStreamRef.current,
      screenStreamRef.current
    ].filter(Boolean);
    
    for (const stream of streamsToStop) {
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            logger.proctoring(`Stopping track: ${track.kind} (${track.label})`);
            track.stop();
          }
        });
      }
    }
    
    // Clear refs
    videoStreamRef.current = null;
    screenStreamRef.current = null;

    // Mark session as ended
    if (sessionIdToClose) {
      logger.proctoring('Closing proctoring session:', sessionIdToClose);
      const { error: closeError } = await supabase
        .from('proctoring_sessions')
        .update({ 
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionIdToClose);
      
      if (closeError) {
        logger.error('Error closing proctoring session:', closeError);
      } else {
        logger.proctoring('Proctoring session closed successfully');
      }
    } else {
      logger.warn('No session ID available to close proctoring session');
    }

    // Reset recording refs
    recordingStartTimeRef.current = null;
    isRecordingRef.current = false;

    setState(prev => ({
      ...prev,
      isRecording: false,
      videoStream: null,
      screenStream: null,
    }));
    
    return uploadResult;
  };

  // Check if camera stream is active
  const isCameraActive = () => {
    if (!state.videoStream) return false;
    const videoTrack = state.videoStream.getVideoTracks()[0];
    return videoTrack && videoTrack.readyState === 'live' && videoTrack.enabled;
  };

  // Reconnect camera if disconnected
  const reconnectCamera = async (): Promise<{ success: boolean; stream?: MediaStream; error?: string }> => {
    try {
      logger.proctoring('Attempting to reconnect camera...');
      // Use optimized quality for proctoring - 480p is sufficient for face detection
      // Lower resolution reduces file size significantly for faster uploads
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640, max: 854 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 15, max: 15 }
        }, 
        audio: true 
      });
      
      // Check quality of reconnected stream
      const quality = await checkCameraQuality(newStream);
      if (!quality.passed) {
        newStream.getTracks().forEach(track => track.stop());
        return { success: false, error: quality.message };
      }

      // Stop old stream if exists
      if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop());
      }

      // Update state with new stream
      setState(prev => ({ ...prev, videoStream: newStream }));
      
      // Restart recording with new stream - preserve existing chunks
      const recordingStarted = await startVideoRecording(newStream, true);
      if (!recordingStarted) {
        logger.error('Failed to restart recording after camera reconnect');
        return { success: false, error: 'Failed to restart recording' };
      }
      
      logger.proctoring('Camera reconnected successfully');
      return { success: true, stream: newStream };
    } catch (error) {
      logger.error('Failed to reconnect camera:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Camera access denied' 
      };
    }
  };

  return {
    ...state,
    initSession,
    checkCameraQuality,
    startVideoRecording,
    startScreenRecording,
    stopRecording,
    logViolation,
    setState,
    isCameraActive,
    reconnectCamera,
  };
};
