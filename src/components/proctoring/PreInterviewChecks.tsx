import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Camera, Monitor, Mic, CheckCircle2, AlertTriangle, Shield, BookOpen, Loader2, ArrowRight, Info, HelpCircle, RefreshCw, XCircle, Wifi, Sun, User, Video } from 'lucide-react';
import { checkCameraQuality } from '@/lib/cameraQuality';
import { initializeFaceDetection, detectFaces } from '@/lib/faceDetection';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { logger } from '@/lib/logger';
import { useRecordingValidator } from '@/hooks/useRecordingValidator';

// User-friendly error messages mapping
const USER_FRIENDLY_ERRORS = {
  // Network errors
  network_slow: 'Your internet connection is too slow for video streaming (below 0.5 Mbps upload). Please move closer to your WiFi router or try a different network.',
  network_slow_warning: 'Your internet connection is slow (0.5-1.0 Mbps). The assessment will work, but video upload after submission may take longer. For best experience, try moving closer to your WiFi router.',
  network_failed: 'We couldn\'t connect to our servers. Please check your internet connection and try again.',
  network_timeout: 'The connection test took too long. Please check your internet speed and try again.',
  
  // Camera errors
  camera_denied: 'Camera access was blocked. Please click the camera icon in your browser\'s address bar and allow access, then click Retry.',
  camera_not_found: 'No camera was detected. Please connect a camera or webcam and try again.',
  camera_in_use: 'Your camera is being used by another application. Please close other apps using the camera (like Zoom, Teams, etc.) and try again.',
  camera_general: 'We couldn\'t access your camera. Please check your browser settings and ensure camera permissions are allowed.',
  
  // Microphone errors
  microphone_denied: 'Microphone access was blocked. Please click the microphone icon in your browser\'s address bar and allow access, then click Retry.',
  microphone_not_found: 'No microphone was detected. Please connect a microphone or headset and try again.',
  microphone_in_use: 'Your microphone is being used by another application. Please close other apps and try again.',
  microphone_general: 'We couldn\'t access your microphone. Please check your browser settings and ensure microphone permissions are allowed.',
  
  // Lighting errors
  lighting_too_dark: 'The lighting in your room is too dim. Please turn on more lights or move to a brighter location, then click Retry.',
  lighting_too_bright: 'There\'s too much light behind you causing glare. Please adjust your position so the light source is in front of you.',
  lighting_general: 'We couldn\'t verify your lighting conditions. Please ensure you\'re in a well-lit room facing a light source.',
  
  // Person visibility errors
  person_not_visible: 'We couldn\'t detect your face in the camera. Please ensure you\'re centered in the frame and your face is clearly visible.',
  person_multiple: 'Multiple people were detected. Please ensure you\'re alone in the frame during the assessment.',
  person_general: 'We need to verify your presence. Please position yourself so your face is clearly visible in the camera.',
  
  // Screen sharing errors
  screen_denied: 'Screen sharing was cancelled. You need to share your entire screen to proceed with the assessment.',
  screen_not_full: 'You must share your entire screen, not just a window or browser tab. Please click "Start Assessment" and select "Entire Screen" when prompted.',
  screen_general: 'Screen sharing is required for this assessment. Please try again and select "Entire Screen" when the sharing dialog appears.',
  
  // General errors
  browser_unsupported: 'Your browser doesn\'t support all required features. Please use the latest version of Chrome, Firefox, or Edge.',
  general_error: 'Something went wrong. Please refresh the page and try again. If the problem persists, contact Support@talentgeenie.com.'
};

// Helper to get user-friendly error message
const getUserFriendlyError = (errorType: string, originalError?: string): string => {
  const friendlyMessage = USER_FRIENDLY_ERRORS[errorType as keyof typeof USER_FRIENDLY_ERRORS];
  if (friendlyMessage) return friendlyMessage;
  
  // Try to parse common error patterns
  if (originalError) {
    const lowerError = originalError.toLowerCase();
    if (lowerError.includes('permission denied') || lowerError.includes('notallowederror')) {
      if (lowerError.includes('camera') || lowerError.includes('video')) return USER_FRIENDLY_ERRORS.camera_denied;
      if (lowerError.includes('microphone') || lowerError.includes('audio')) return USER_FRIENDLY_ERRORS.microphone_denied;
    }
    if (lowerError.includes('not found') || lowerError.includes('notfounderror')) {
      if (lowerError.includes('camera') || lowerError.includes('video')) return USER_FRIENDLY_ERRORS.camera_not_found;
      if (lowerError.includes('microphone') || lowerError.includes('audio')) return USER_FRIENDLY_ERRORS.microphone_not_found;
    }
    if (lowerError.includes('in use') || lowerError.includes('notreadableerror')) {
      return USER_FRIENDLY_ERRORS.camera_in_use;
    }
  }
  
  return USER_FRIENDLY_ERRORS.general_error;
};

interface PreInterviewChecksProps {
  attemptId?: string; // Optional - for backward compatibility
  attemptType: 'interview' | 'learning' | 'certification';
  invitationId?: string; // For logging
  interviewId?: string; // For logging
  candidateEmail?: string; // For logging
  candidateName?: string; // For logging
  onCreateAttempt?: () => Promise<{ attemptId: string; sessionToken: string } | null>; // Called after screen sharing confirmed
  onComplete: (
    sessionId: string, 
    videoStream: MediaStream, 
    screenStream: MediaStream, 
    recommendedQuality?: 'high' | 'medium' | 'low',
    attemptId?: string,
    sessionToken?: string
  ) => void;
}

type Step = 'instructions' | 'consent' | 'setup' | 'ready';

interface CheckStatus {
  status: 'pending' | 'running' | 'passed' | 'failed';
  error?: string;
  warning?: string; // Optional warning message (check passes but with caution)
  value?: any;
}

const PreInterviewChecks: React.FC<PreInterviewChecksProps> = ({ 
  attemptId, 
  attemptType, 
  invitationId,
  interviewId,
  candidateEmail,
  candidateName,
  onCreateAttempt, 
  onComplete 
}) => {
  const { toast, errorToast } = useUserFriendlyToast();
  const [currentStep, setCurrentStep] = useState<Step>('instructions');
  const [checkLogId, setCheckLogId] = useState<string | null>(null);
  
  // Consent state
  const [consents, setConsents] = useState({
    proctoring: false,
    recording: false,
    dataUsage: false,
    aiAnalysis: false,
  });
  const [consentDeclined, setConsentDeclined] = useState(false);
  
  // Setup state
  const [checks, setChecks] = useState<{
    network: CheckStatus & { recommendedQuality?: 'high' | 'medium' | 'low' };
    camera: CheckStatus;
    microphone: CheckStatus;
    lighting: CheckStatus;
    personVisible: CheckStatus;
  }>({
    network: { status: 'pending' },
    camera: { status: 'pending' },
    microphone: { status: 'pending' },
    lighting: { status: 'pending' },
    personVisible: { status: 'pending' },
  });

  const [isStarting, setIsStarting] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [createdAttemptId, setCreatedAttemptId] = useState<string | null>(attemptId || null);
  const [createdSessionToken, setCreatedSessionToken] = useState<string | null>(null);
  
  // Recording validation state
  const [isValidatingRecording, setIsValidatingRecording] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { validate: validateRecording, progress: validationProgress, isValidating } = useRecordingValidator();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null); // Ref to avoid stale closure in async checks
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // Track if assessment started - prevents cleanup from stopping the stream
  // when ownership transfers to TakeInterview
  const assessmentStartedRef = useRef(false);

  const assessmentLabel = attemptType === 'certification' ? 'Certification Exam' : attemptType === 'learning' ? 'Learning Assessment' : 'Interview';

  const allConsentsGiven = consents.proctoring && consents.recording && consents.dataUsage && consents.aiAnalysis;
  const allChecksPassed = checks.network.status === 'passed' && 
                          checks.camera.status === 'passed' && 
                          checks.microphone.status === 'passed' && 
                          checks.lighting.status === 'passed' &&
                          checks.personVisible.status === 'passed';
  const hasAnyFailure = checks.network.status === 'failed' || 
                        checks.camera.status === 'failed' || 
                        checks.microphone.status === 'failed' || 
                        checks.lighting.status === 'failed' ||
                        checks.personVisible.status === 'failed';

  // Create initial check log entry when entering setup
  const createCheckLog = async () => {
    if (!candidateEmail || checkLogId) return;
    
    try {
      const browserInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        devicePixelRatio: window.devicePixelRatio,
      };
      
      const { data, error } = await supabase
        .from('preinterview_check_logs')
        .insert({
          invitation_id: invitationId || null,
          interview_id: interviewId || null,
          candidate_email: candidateEmail,
          candidate_name: candidateName || null,
          user_agent: navigator.userAgent,
          browser_info: browserInfo,
        })
        .select('id')
        .single();
      
      if (data && !error) {
        setCheckLogId(data.id);
        logger.proctoring('[PreInterviewChecks] Created check log:', data.id);
      }
    } catch (err) {
      logger.error('[PreInterviewChecks] Failed to create check log:', err);
    }
  };

  // Update check log with results
  const updateCheckLog = async (updates: Record<string, any>) => {
    if (!checkLogId) return;
    
    try {
      await supabase
        .from('preinterview_check_logs')
        .update(updates)
        .eq('id', checkLogId);
    } catch (err) {
      logger.error('[PreInterviewChecks] Failed to update check log:', err);
    }
  };

  // Auto-run setup when entering setup step
  useEffect(() => {
    logger.proctoring('[PreInterviewChecks] useEffect triggered - currentStep:', currentStep, 'network status:', checks.network.status);
    if (currentStep === 'setup' && checks.network.status === 'pending') {
      logger.proctoring('[PreInterviewChecks] Starting runAllChecks...');
      // Create log first, then run checks (non-blocking - checks don't wait for log creation)
      createCheckLog().then(() => {
        logger.proctoring('[PreInterviewChecks] Check log created, proceeding with checks');
      });
      runAllChecks();
    }
  }, [currentStep, checks.network.status]);

  // Re-attach video stream when switching steps (since video element is re-created)
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [currentStep, videoStream]);

  // Individual check functions
  const checkNetwork = async (): Promise<boolean> => {
    logger.proctoring('[Network Check] Starting network check...');
    setChecks(prev => ({ ...prev, network: { status: 'running' } }));
    try {
      // Step 1: Basic connectivity + latency test using our edge function (avoids CORS issues)
      logger.proctoring('[Network Check] Step 1: Testing basic connectivity...');
      const latencyStart = performance.now();
      const { error: latencyError } = await invokeFunction('test-configuration', {
        body: { testType: 'ai' } // Simple test to check connectivity
      });
      if (latencyError) {
        logger.error('[Network Check] Connectivity test failed:', latencyError);
        const errorMsg = getUserFriendlyError('network_failed');
        setChecks(prev => ({ ...prev, network: { status: 'failed', error: errorMsg } }));
        await updateCheckLog({ network_status: 'failed', network_error: errorMsg });
        return false;
      }
      const latency = performance.now() - latencyStart;
      logger.proctoring(`[Network Check] Latency test completed: ${latency.toFixed(0)}ms`);

      // Step 2: Upload bandwidth test with multiple samples for accuracy
      // Use 1MB payload (safe for edge function limits) and run 5 tests
      // At 5 Mbps, 1MB takes ~1.6 seconds - accurate timing with 5 samples
      // Total test: ~8 seconds at 5 Mbps, ~25 seconds at slow connections
      logger.proctoring('[Network Check] Step 2: Testing upload bandwidth (5 samples x 1MB)...');
      
      const testPayloadSize = 1000000; // 1MB per test - safe for edge function limits
      const testPayload = 'x'.repeat(testPayloadSize);
      const uploadSpeeds: number[] = [];
      const numSamples = 5; // 5 samples for reliable median calculation
      
      for (let i = 0; i < numSamples; i++) {
        logger.proctoring(`[Network Check] Running bandwidth sample ${i + 1}/${numSamples}...`);
        const uploadStart = performance.now();
        
        const { data, error } = await invokeFunction('test-configuration', {
          body: { testType: 'bandwidth', payload: testPayload, sample: i + 1 }
        });
        
        if (error) {
          logger.error(`[Network Check] Sample ${i + 1} failed:`, error);
          // Continue with other samples
          continue;
        }
        
        if (!data?.success) {
          logger.error(`[Network Check] Sample ${i + 1} returned failure:`, data);
          continue;
        }
        
        const uploadTime = performance.now() - uploadStart;
        const uploadSizeBytes = new Blob([JSON.stringify({ testType: 'bandwidth', payload: testPayload, sample: i + 1 })]).size;
        const sampleSpeedMbps = (uploadSizeBytes * 8) / (uploadTime * 1000); // Convert to Mbps
        uploadSpeeds.push(sampleSpeedMbps);
        logger.proctoring(`[Network Check] Sample ${i + 1}: ${sampleSpeedMbps.toFixed(2)} Mbps (${uploadTime.toFixed(0)}ms)`);
      }
      
      // Check if we got any successful samples
      if (uploadSpeeds.length === 0) {
        logger.error('[Network Check] All bandwidth samples failed');
        const errorMsg = getUserFriendlyError('network_failed');
        setChecks(prev => ({ ...prev, network: { status: 'failed', error: errorMsg } }));
        await updateCheckLog({ network_status: 'failed', network_error: errorMsg });
        return false;
      }
      
      // Calculate median speed (robust against outliers)
      let uploadSpeedMbps: number;
      if (uploadSpeeds.length >= 3) {
        // Use median for 3+ samples (more robust than average)
        uploadSpeeds.sort((a, b) => a - b);
        const midIndex = Math.floor(uploadSpeeds.length / 2);
        uploadSpeedMbps = uploadSpeeds.length % 2 === 0
          ? (uploadSpeeds[midIndex - 1] + uploadSpeeds[midIndex]) / 2
          : uploadSpeeds[midIndex];
        logger.proctoring(`[Network Check] Using median speed: ${uploadSpeedMbps.toFixed(2)} Mbps (samples: ${uploadSpeeds.map(s => s.toFixed(2)).join(', ')})`);
      } else {
        // Use average for fewer samples
        uploadSpeedMbps = uploadSpeeds.reduce((a, b) => a + b, 0) / uploadSpeeds.length;
        logger.proctoring(`[Network Check] Using average speed: ${uploadSpeedMbps.toFixed(2)} Mbps (${uploadSpeeds.length} samples)`);
      }

      // Step 3: Check Network Information API for additional context
      const connection = (navigator as any).connection;
      const effectiveType = connection?.effectiveType || 'unknown';
      const downlink = connection?.downlink || null;

      // Step 4: Determine quality based on measurements
      // High: Good for 720p video streaming (10+ Mbps)
      // Medium: Acceptable for 480p (5-10 Mbps)
      // Low: Minimum viable (< 5 Mbps - will show warning)
      let quality: 'high' | 'medium' | 'low';
      
      if (uploadSpeedMbps >= 10 && latency < 100 && (effectiveType === '4g' || downlink > 10 || !connection)) {
        quality = 'high';
      } else if (uploadSpeedMbps >= 5 && latency < 200) {
        quality = 'medium';
      } else {
        quality = 'low';
      }

      // Step 5: Determine pass/fail/warning based on bandwidth thresholds
      // UPDATED: Lower threshold to 1 Mbps minimum, show upload time estimate for slower connections
      // FAIL: < 1 Mbps - Not viable for reliable video uploads
      // WARNING: 1-5 Mbps - Works but show estimated upload time
      // PASS: >= 5 Mbps - Good for fast video uploads (~6 min for 60-min recording)
      if (uploadSpeedMbps < 1) {
        const errorMsg = `Your upload speed is ${uploadSpeedMbps.toFixed(1)} Mbps, which is too slow for video uploads. Please connect to a faster network (minimum 1 Mbps required).`;
        setChecks(prev => ({ 
          ...prev, 
          network: { 
            status: 'failed', 
            error: errorMsg
          } 
        }));
        await updateCheckLog({ network_status: 'failed', network_error: errorMsg, network_speed_mbps: uploadSpeedMbps });
        return false;
      }

      logger.proctoring(`[Bandwidth Check] Latency: ${latency.toFixed(0)}ms, Upload: ${uploadSpeedMbps.toFixed(2)} Mbps, Quality: ${quality}`);
      
      // Check for slow connection warning (1-5 Mbps) - calculate estimated upload time
      // Assume ~200MB recording for 30-min interview (video + screen)
      let warningMsg: string | undefined;
      if (uploadSpeedMbps < 5) {
        const estimatedFileSizeMB = 200; // Approximate recording size
        const uploadTimeMins = Math.ceil((estimatedFileSizeMB * 8) / (uploadSpeedMbps * 60)); // MB to Mbits, then divide by speed and convert to minutes
        warningMsg = `Your upload speed is ${uploadSpeedMbps.toFixed(1)} Mbps. After submission, recording upload may take approximately ${uploadTimeMins} minutes. You can close the browser during upload.`;
        logger.warn(`[Network Check] Slow connection warning: ${uploadSpeedMbps.toFixed(2)} Mbps, estimated upload: ${uploadTimeMins} mins`);
      }
      
      setChecks(prev => ({ 
        ...prev, 
        network: { 
          status: 'passed', 
          recommendedQuality: quality,
          warning: warningMsg
        } 
      }));
      await updateCheckLog({ network_status: 'passed', network_speed_mbps: uploadSpeedMbps, network_warning: warningMsg || null });
      return true;
    } catch (error: any) {
      logger.error('Network check failed:', error);
      const errorMsg = getUserFriendlyError('network_failed', error.message);
      setChecks(prev => ({ 
        ...prev, 
        network: { status: 'failed', error: errorMsg } 
      }));
      await updateCheckLog({ network_status: 'failed', network_error: errorMsg });
      return false;
    }
  };

  const checkCamera = async (): Promise<boolean> => {
    setChecks(prev => ({ ...prev, camera: { status: 'running' } }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });
      setVideoStream(stream);
      videoStreamRef.current = stream; // Store in ref for immediate access
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setChecks(prev => ({ ...prev, camera: { status: 'passed' } }));
      await updateCheckLog({ camera_status: 'passed' });
      return true;
    } catch (error: any) {
      logger.error('[Camera Check] Failed:', error.name, error.message);
      let errorMsg: string;
      
      // Map specific error types to user-friendly messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg = getUserFriendlyError('camera_denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMsg = getUserFriendlyError('camera_not_found');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMsg = getUserFriendlyError('camera_in_use');
      } else {
        errorMsg = getUserFriendlyError('camera_general', error.message);
      }
      
      setChecks(prev => ({ 
        ...prev, 
        camera: { status: 'failed', error: errorMsg } 
      }));
      await updateCheckLog({ camera_status: 'failed', camera_error: errorMsg });
      return false;
    }
  };

  const checkMicrophone = async (): Promise<boolean> => {
    setChecks(prev => ({ ...prev, microphone: { status: 'running' } }));
    try {
      // If we already have video stream with audio, mic is ready
      if (videoStream && videoStream.getAudioTracks().length > 0) {
        setChecks(prev => ({ ...prev, microphone: { status: 'passed' } }));
        await updateCheckLog({ microphone_status: 'passed' });
        return true;
      }
      // Otherwise try to get mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop as we just needed to test
      setChecks(prev => ({ ...prev, microphone: { status: 'passed' } }));
      await updateCheckLog({ microphone_status: 'passed' });
      return true;
    } catch (error: any) {
      logger.error('[Microphone Check] Failed:', error.name, error.message);
      let errorMsg: string;
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg = getUserFriendlyError('microphone_denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMsg = getUserFriendlyError('microphone_not_found');
      } else if (error.name === 'NotReadableError') {
        errorMsg = getUserFriendlyError('microphone_in_use');
      } else {
        errorMsg = getUserFriendlyError('microphone_general', error.message);
      }
      
      setChecks(prev => ({ 
        ...prev, 
        microphone: { status: 'failed', error: errorMsg } 
      }));
      await updateCheckLog({ microphone_status: 'failed', microphone_error: errorMsg });
      return false;
    }
  };

  const checkLighting = async (): Promise<boolean> => {
    setChecks(prev => ({ ...prev, lighting: { status: 'running' } }));
    try {
      const stream = videoStreamRef.current || videoStream;
      if (stream) {
        // Wait for video element to have frames ready (up to 2 seconds)
        let attempts = 0;
        const maxAttempts = 20;
        while (attempts < maxAttempts) {
          if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          logger.warn('[Lighting Check] Video not ready after waiting');
        }
        
        const result = await checkCameraQuality(stream);
        if (result.passed) {
          setChecks(prev => ({ ...prev, lighting: { status: 'passed' } }));
          await updateCheckLog({ lighting_status: 'passed' });
          return true;
        } else {
          // Determine if too dark or too bright based on the result
          const errorMsg = getUserFriendlyError('lighting_too_dark');
          setChecks(prev => ({ 
            ...prev, 
            lighting: { status: 'failed', error: errorMsg } 
          }));
          await updateCheckLog({ lighting_status: 'failed', lighting_error: errorMsg });
          return false;
        }
      }
      // If no video stream, can't check lighting
      const errorMsg = getUserFriendlyError('camera_general');
      setChecks(prev => ({ 
        ...prev, 
        lighting: { status: 'failed', error: errorMsg } 
      }));
      await updateCheckLog({ lighting_status: 'failed', lighting_error: 'No camera stream available' });
      return false;
    } catch (error: any) {
      logger.error('[Lighting Check] Failed:', error);
      const errorMsg = getUserFriendlyError('lighting_general', error.message);
      setChecks(prev => ({ 
        ...prev, 
        lighting: { status: 'failed', error: errorMsg } 
      }));
      await updateCheckLog({ lighting_status: 'failed', lighting_error: errorMsg });
      return false;
    }
  };

  // Check 5: Person visibility - lightweight check with camera stream validation
  // Heavy AI-based detection is deferred to post-interview analysis per architecture/proctoring-deferred-analysis
  const checkPersonVisible = async () => {
    setChecks(prev => ({ ...prev, personVisible: { status: 'running' } }));
    
    try {
      const stream = videoStreamRef.current || videoStream;
      if (!videoRef.current || !stream) {
        const errorMsg = getUserFriendlyError('person_general');
        setChecks(prev => ({ 
          ...prev, 
          personVisible: { status: 'failed', error: errorMsg } 
        }));
        await updateCheckLog({ person_visible_status: 'failed', person_visible_error: 'No camera stream' });
        return false;
      }

      // Wait for video to be ready with frame data
      let waitAttempts = 0;
      const maxWaitAttempts = 30; // 3 seconds
      while (waitAttempts < maxWaitAttempts) {
        if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        waitAttempts++;
      }

      // Verify camera is actually producing frames (basic validation)
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        const errorMsg = 'Your camera appears to be disconnected. Please reconnect your camera and click Retry.';
        setChecks(prev => ({ 
          ...prev, 
          personVisible: { status: 'failed', error: errorMsg } 
        }));
        await updateCheckLog({ person_visible_status: 'failed', person_visible_error: 'Camera track not live' });
        return false;
      }

      logger.proctoring('[PersonCheck] Camera active, attempting AI detection...');
      
      // Try AI-based detection with timeout - but don't block candidate if it fails
      // Real detection happens during interview and post-interview analysis
      try {
        const detectionTimeout = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 8000) // 8 second timeout
        );
        
        const detectionAttempt = (async () => {
          await initializeFaceDetection();
          // Try multiple detection attempts with very low threshold
          for (let attempt = 0; attempt < 3; attempt++) {
            const result = await detectFaces(videoRef.current!, 0.25); // Very low threshold
            logger.proctoring(`[PersonCheck] Detection attempt ${attempt + 1}:`, result);
            if (result.personCount >= 1) {
              return result;
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait between attempts
          }
          return { personCount: 0 };
        })();
        
        const result = await Promise.race([detectionAttempt, detectionTimeout]);
        
        if (result && result.personCount >= 1) {
          setChecks(prev => ({ ...prev, personVisible: { status: 'passed' } }));
          await updateCheckLog({ person_visible_status: 'passed' });
          return true;
        }
      } catch (detectionError) {
        logger.warn('[PersonCheck] AI detection error:', detectionError);
      }

      // If AI detection fails or times out, pass with camera validation only
      // Candidate experience is priority - actual proctoring happens during interview
      logger.proctoring('[PersonCheck] AI detection inconclusive, passing based on active camera');
      toast({
        title: "Camera verified",
        description: "Person detection will continue during the assessment.",
        variant: "default"
      });
      setChecks(prev => ({ ...prev, personVisible: { status: 'passed' } }));
      await updateCheckLog({ person_visible_status: 'passed' });
      return true;
      
    } catch (error: any) {
      logger.error('[PersonCheck] Error:', error);
      // Pass with warning - don't block candidates due to technical issues
      toast({
        title: "Camera check completed",
        description: "Proceeding with camera verification.",
        variant: "default"
      });
      setChecks(prev => ({ ...prev, personVisible: { status: 'passed' } }));
      await updateCheckLog({ person_visible_status: 'passed' });
      return true;
    }
  };

  // Run all checks sequentially
  const runAllChecks = async () => {
    logger.proctoring('[PreInterviewChecks] runAllChecks started');
    await checkNetwork();
    logger.proctoring('[PreInterviewChecks] checkNetwork completed');
    const cameraOk = await checkCamera();
    logger.proctoring('[PreInterviewChecks] checkCamera completed, result:', cameraOk);
    if (cameraOk) {
      await checkMicrophone();
      logger.proctoring('[PreInterviewChecks] checkMicrophone completed');
      await checkLighting();
      logger.proctoring('[PreInterviewChecks] checkLighting completed');
      await checkPersonVisible();
      logger.proctoring('[PreInterviewChecks] checkPersonVisible completed');
    } else {
      // If camera fails, mark dependent checks as failed too with clear message
      const dependentError = 'Please grant camera access first, then these checks will run automatically.';
      setChecks(prev => ({
        ...prev,
        microphone: { status: 'failed', error: dependentError },
        lighting: { status: 'failed', error: dependentError },
        personVisible: { status: 'failed', error: dependentError }
      }));
      await updateCheckLog({
        microphone_status: 'failed',
        microphone_error: 'Blocked by camera failure',
        lighting_status: 'failed',
        lighting_error: 'Blocked by camera failure',
        person_visible_status: 'failed',
        person_visible_error: 'Blocked by camera failure',
      });
    }
  };
  // Retry individual check
  const retryCheck = async (checkName: 'network' | 'camera' | 'microphone' | 'lighting' | 'personVisible') => {
    switch (checkName) {
      case 'network':
        await checkNetwork();
        break;
      case 'camera':
        const cameraOk = await checkCamera();
        if (cameraOk && checks.microphone.status === 'failed') {
          await checkMicrophone();
        }
        if (cameraOk && checks.lighting.status === 'failed') {
          await checkLighting();
        }
        if (cameraOk && checks.personVisible.status === 'failed') {
          await checkPersonVisible();
        }
        break;
      case 'microphone':
        await checkMicrophone();
        break;
      case 'lighting':
        await checkLighting();
        break;
      case 'personVisible':
        await checkPersonVisible();
        break;
    }
  };

  // Retry all failed checks
  const retryAllFailed = async () => {
    if (checks.network.status === 'failed') await checkNetwork();
    if (checks.camera.status === 'failed') {
      const cameraOk = await checkCamera();
      if (cameraOk) {
        if (checks.microphone.status === 'failed') await checkMicrophone();
        if (checks.lighting.status === 'failed') await checkLighting();
        if (checks.personVisible.status === 'failed') await checkPersonVisible();
      }
    } else {
      if (checks.microphone.status === 'failed') await checkMicrophone();
      if (checks.lighting.status === 'failed') await checkLighting();
      if (checks.personVisible.status === 'failed') await checkPersonVisible();
    }
  };

  const startAssessment = async () => {
    if (isStarting) return;
    setIsStarting(true);
    
    try {
      // Log screen share attempt
      await updateCheckLog({ screen_share_attempted: true });
      
      // Step 1: Request fullscreen
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      
      // Step 2: Request screen sharing FIRST - this is the "lock-in" point
      // Request entire screen only (monitor), not window or browser tab
      let screen: MediaStream;
      try {
        screen = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            displaySurface: 'monitor',
            // Limit frame rate to reduce file size - 15fps is smooth enough for proctoring review
            frameRate: { ideal: 15, max: 15 },
            // Prefer entire screen sharing
            cursor: 'always'
          },
          // Disable audio to simplify (we have separate mic)
          audio: false,
          // Chrome-specific: prefer monitor
          preferCurrentTab: false,
          selfBrowserSurface: 'exclude',
          systemAudio: 'exclude',
          surfaceSwitching: 'exclude',
          monitorTypeSurfaces: 'include'
        } as DisplayMediaStreamOptions);
      } catch (screenError: any) {
        logger.error('[PRE-CHECKS] Screen share request failed:', screenError.name, screenError.message);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        
        let errorMsg: string;
        if (screenError.name === 'NotAllowedError') {
          errorMsg = getUserFriendlyError('screen_denied');
        } else {
          errorMsg = getUserFriendlyError('screen_general', screenError.message);
        }
        
        await updateCheckLog({ screen_share_error: errorMsg });
        toast({
          title: 'Screen Sharing Required',
          description: errorMsg,
          variant: 'destructive',
        });
        setIsStarting(false);
        return;
      }
      
      // CRITICAL: Validate that user shared ENTIRE SCREEN, not just a window or tab
      const screenTrack = screen.getVideoTracks()[0];
      if (screenTrack) {
        const settings = screenTrack.getSettings();
        const displaySurface = (settings as any).displaySurface;
        
        logger.proctoring('[PRE-CHECKS] Screen share type:', displaySurface, settings);
        
        // Reject if user shared a window or browser tab instead of entire screen
        if (displaySurface && displaySurface !== 'monitor') {
          screen.getTracks().forEach(track => track.stop());
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          const errorMsg = getUserFriendlyError('screen_not_full');
          await updateCheckLog({ screen_share_error: errorMsg });
          toast({
            title: 'Entire Screen Required',
            description: errorMsg,
            variant: 'destructive',
          });
          setIsStarting(false);
          return;
        }
        
        // Add track listener to detect premature screen share termination
        screenTrack.onended = () => {
          logger.error('[PRE-CHECKS] CRITICAL: Screen share was stopped by user!');
          // If assessment hasn't started yet, this is a problem
          if (!assessmentStartedRef.current) {
            toast({
              title: 'Screen Sharing Stopped',
              description: 'You stopped sharing your screen. Please click "Start Assessment" and share your entire screen again.',
              variant: 'destructive',
            });
            setIsStarting(false);
          }
        };
      }
      
      setScreenStream(screen);
      
      // Step 3: NOW create the attempt (Option B - only after screen sharing confirmed)
      let finalAttemptId = createdAttemptId;
      let finalSessionToken = createdSessionToken;
      
      if (onCreateAttempt && !createdAttemptId) {
        logger.proctoring('[PRE-CHECKS] Creating attempt after screen sharing confirmed');
        const result = await onCreateAttempt();
        if (!result) {
          // Attempt creation failed - clean up and exit
          screen.getTracks().forEach(track => track.stop());
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          const errorMsg = 'We couldn\'t start your assessment. Please refresh the page and try again. If this continues, contact Support@talentgeenie.com.';
          await updateCheckLog({ screen_share_error: errorMsg });
          throw new Error(errorMsg);
        }
        finalAttemptId = result.attemptId;
        finalSessionToken = result.sessionToken;
        setCreatedAttemptId(result.attemptId);
        setCreatedSessionToken(result.sessionToken);
        logger.proctoring('[PRE-CHECKS] Attempt created:', result.attemptId);
      }
      
      // Mark check log as completed successfully
      await updateCheckLog({ completed_at: new Date().toISOString() });
      
      // Step 4: Validate attempt ID exists
      if (!finalAttemptId) {
        throw new Error('No attempt ID available for proctoring session');
      }
      
      // Step 5: Recording validation - test that MediaRecorder produces data and upload works
      logger.proctoring('[PRE-CHECKS] Starting recording validation...');
      setIsValidatingRecording(true);
      setValidationError(null);
      
      const currentVideoStream = videoStreamRef.current;
      if (!currentVideoStream) {
        throw new Error('Camera stream not available for validation');
      }
      
      const validationResult = await validateRecording(
        currentVideoStream,
        screen,
        finalSessionToken,
        finalAttemptId
      );
      
      setIsValidatingRecording(false);
      
      if (!validationResult.success) {
        logger.error('[PRE-CHECKS] Recording validation failed:', validationResult.error);
        setValidationError(validationResult.error || 'Recording test failed');
        
        // Clean up streams on failure
        screen.getTracks().forEach(track => track.stop());
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        
        toast({
          title: 'Recording Test Failed',
          description: validationResult.error || 'Please refresh and try again',
          variant: 'destructive',
        });
        setIsStarting(false);
        return;
      }
      
      logger.proctoring('[PRE-CHECKS] Recording validation passed!');
      
      // Note: initSession is now called by ProctoringMonitor inside ProctoringProvider
      // This ensures proper context sharing for recording uploads
      
      // Step 6: Start countdown and complete
      setShowCountdown(true);
      let count = 3;
      const interval = setInterval(() => {
        count--;
        setCountdown(count);
        if (count === 0) {
          clearInterval(interval);
          setShowCountdown(false);
          // Mark assessment as started - stream ownership transfers to TakeInterview
          assessmentStartedRef.current = true;
          // CRITICAL: Use videoStreamRef.current instead of state to avoid stale closure
          // The state variable may be stale, but the ref always has the current stream
          const currentVideoStream = videoStreamRef.current;
          
          // ===== STREAM DIAGNOSTIC LOGGING BEFORE HANDOFF =====
          logger.proctoring('==========================================');
          logger.proctoring('[PRE-CHECKS HANDOFF] About to call onComplete');
          logger.proctoring('[PRE-CHECKS HANDOFF] videoStreamRef.current:', currentVideoStream ? currentVideoStream.id : 'NULL');
          logger.proctoring('[PRE-CHECKS HANDOFF] screen stream:', screen ? screen.id : 'NULL');
          
          if (currentVideoStream) {
            logger.proctoring('[PRE-CHECKS HANDOFF] Video stream.active:', currentVideoStream.active);
            currentVideoStream.getTracks().forEach((track, i) => {
              logger.proctoring(`[PRE-CHECKS HANDOFF] Video track[${i}]:`, {
                kind: track.kind,
                readyState: track.readyState,
                muted: track.muted,
                enabled: track.enabled,
                label: track.label
              });
            });
          }
          
          if (screen) {
            logger.proctoring('[PRE-CHECKS HANDOFF] Screen stream.active:', screen.active);
            screen.getTracks().forEach((track, i) => {
              logger.proctoring(`[PRE-CHECKS HANDOFF] Screen track[${i}]:`, {
                kind: track.kind,
                readyState: track.readyState,
                muted: track.muted,
                enabled: track.enabled
              });
            });
          }
          logger.proctoring('==========================================');
          
          if (!currentVideoStream || !currentVideoStream.active) {
            logger.error('[PRE-CHECKS] CRITICAL: Video stream is not active at completion!', {
              hasStream: !!currentVideoStream,
              active: currentVideoStream?.active,
              tracks: currentVideoStream?.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState }))
            });
          }
          // Pass empty sessionId - ProctoringMonitor will create the session
          onComplete('', currentVideoStream!, screen, checks.network.recommendedQuality, finalAttemptId!, finalSessionToken!);
        }
      }, 1000);
      
    } catch (error: any) {
      logger.error('[PRE-CHECKS] startAssessment error:', error);
      setIsStarting(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      
      // Use the error message if it's already user-friendly, otherwise provide a generic one
      const errorMsg = error.message?.includes('Please') || error.message?.includes('try again') 
        ? error.message 
        : getUserFriendlyError('general_error');
      
      await updateCheckLog({ screen_share_error: errorMsg });
      toast({
        title: "Unable to Start Assessment",
        description: errorMsg,
        variant: "destructive"
      });
    }
  };

  // Cleanup - only stop stream if assessment hasn't started
  // When assessment starts, stream ownership transfers to TakeInterview
  useEffect(() => {
    return () => {
      if (videoStream && !assessmentStartedRef.current) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoStream]);

  const CheckItem = ({ 
    label, 
    icon: Icon, 
    check, 
    checkName,
    onRetry 
  }: { 
    label: string; 
    icon: React.ElementType;
    check: CheckStatus; 
    checkName: 'network' | 'camera' | 'microphone' | 'lighting' | 'personVisible';
    onRetry: () => void;
  }) => (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      check.status === 'passed' && check.warning ? 'bg-amber-500/10 border-amber-500/20' :
      check.status === 'passed' ? 'bg-green-500/10 border-green-500/20' :
      check.status === 'failed' ? 'bg-destructive/10 border-destructive/20' :
      check.status === 'running' ? 'bg-primary/10 border-primary/20' :
      'bg-muted/50 border-border'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${
          check.status === 'passed' && check.warning ? 'bg-amber-500/20' :
          check.status === 'passed' ? 'bg-green-500/20' :
          check.status === 'failed' ? 'bg-destructive/20' :
          check.status === 'running' ? 'bg-primary/20' :
          'bg-muted'
        }`}>
          <Icon className={`h-4 w-4 ${
            check.status === 'passed' && check.warning ? 'text-amber-500' :
            check.status === 'passed' ? 'text-green-500' :
            check.status === 'failed' ? 'text-destructive' :
            check.status === 'running' ? 'text-primary' :
            'text-muted-foreground'
          }`} />
        </div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          {check.error && (
            <p className="text-xs text-destructive">{check.error}</p>
          )}
          {check.warning && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{check.warning}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {check.status === 'passed' && check.warning && <AlertTriangle className="h-5 w-5 text-amber-500" />}
        {check.status === 'passed' && !check.warning && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {check.status === 'failed' && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRetry}
            className="h-8 px-2"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        )}
        {check.status === 'running' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
        {check.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Recording Validation Overlay */}
      {isValidatingRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center animate-scale-in max-w-md mx-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-6">
              <Video className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <p className="text-white text-xl font-semibold mb-3">Testing Recording...</p>
            <p className="text-white/70 text-base mb-6">
              {validationProgress.stage === 'recording' && 'Running 3-second test recording...'}
              {validationProgress.stage === 'validating' && 'Verifying recording data...'}
              {validationProgress.stage === 'upload-test' && 'Testing upload connection...'}
              {validationProgress.stage === 'idle' && 'Preparing validation...'}
            </p>
            <div className="flex justify-center gap-2">
              <div className={`h-2 w-2 rounded-full ${validationProgress.stage === 'recording' ? 'bg-primary' : 'bg-white/30'}`} />
              <div className={`h-2 w-2 rounded-full ${validationProgress.stage === 'validating' ? 'bg-primary' : 'bg-white/30'}`} />
              <div className={`h-2 w-2 rounded-full ${validationProgress.stage === 'upload-test' ? 'bg-primary' : 'bg-white/30'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center animate-scale-in">
            <p className="text-white text-2xl font-semibold mb-6">Get Ready!</p>
            <div className="w-40 h-40 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl">
              <span className="text-7xl font-bold text-white">{countdown}</span>
            </div>
            <p className="text-white/80 text-lg mt-6">Starting {assessmentLabel}...</p>
          </div>
        </div>
      )}
      
      <Card className="w-full max-w-2xl shadow-lg">
        {/* Step 1: Instructions */}
        {currentStep === 'instructions' && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to Your {assessmentLabel}</CardTitle>
              <CardDescription className="text-base">
                Please read these instructions carefully before we begin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* What to Expect */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  What to Expect
                </h3>
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Camera className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Camera & Microphone</p>
                      <p>We'll need access to verify your identity and ensure a fair assessment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Monitor className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Screen Sharing</p>
                      <p>Your screen will be recorded during the assessment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Fullscreen Mode</p>
                      <p>The assessment runs in fullscreen to minimize distractions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips for Success */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Tips for a Smooth Experience
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2 ml-6 list-disc">
                  <li>Find a quiet, well-lit room</li>
                  <li>Close other browser tabs and applications</li>
                  <li>Ensure stable internet connection</li>
                  <li>Keep your face visible throughout</li>
                  <li>Avoid looking away from the screen frequently</li>
                </ul>
              </div>

              <Button
                onClick={() => setCurrentStep('consent')}
                className="w-full h-12 text-base"
                size="lg"
              >
                I Understand, Continue
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 2: Legal Consent */}
        {currentStep === 'consent' && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Consent & Agreement</CardTitle>
              <CardDescription className="text-base">
                Please review and accept the following to proceed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {consentDeclined && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    You must accept all consent agreements to proceed with the assessment. 
                    If you have concerns, please contact Support@talentgeenie.com.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {/* Proctoring Consent */}
                <div className={`p-4 rounded-lg border ${consents.proctoring ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="proctoring-consent" 
                      checked={consents.proctoring}
                      onCheckedChange={(checked) => {
                        setConsents(prev => ({ ...prev, proctoring: checked as boolean }));
                        setConsentDeclined(false);
                      }}
                      className="mt-1"
                    />
                    <label htmlFor="proctoring-consent" className="cursor-pointer">
                      <p className="font-medium text-sm">Proctoring Consent</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        I understand that this assessment is proctored and my camera, microphone, and screen 
                        will be monitored throughout the session to ensure assessment integrity.
                      </p>
                    </label>
                  </div>
                </div>

                {/* Recording Consent */}
                <div className={`p-4 rounded-lg border ${consents.recording ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="recording-consent" 
                      checked={consents.recording}
                      onCheckedChange={(checked) => {
                        setConsents(prev => ({ ...prev, recording: checked as boolean }));
                        setConsentDeclined(false);
                      }}
                      className="mt-1"
                    />
                    <label htmlFor="recording-consent" className="cursor-pointer">
                      <p className="font-medium text-sm">Recording Consent</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        I consent to having my video, audio, and screen activity recorded during this assessment. 
                        I understand these recordings may be reviewed to verify the authenticity of my performance.
                      </p>
                    </label>
                  </div>
                </div>

                {/* Data Usage Consent */}
                <div className={`p-4 rounded-lg border ${consents.dataUsage ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="data-consent" 
                      checked={consents.dataUsage}
                      onCheckedChange={(checked) => {
                        setConsents(prev => ({ ...prev, dataUsage: checked as boolean }));
                        setConsentDeclined(false);
                      }}
                      className="mt-1"
                    />
                    <label htmlFor="data-consent" className="cursor-pointer">
                      <p className="font-medium text-sm">Data Processing Agreement</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        I agree that my assessment data, including answers and performance metrics, 
                        will be processed and stored securely. All data is encrypted and handled in 
                        accordance with applicable privacy regulations.
                      </p>
                    </label>
                  </div>
                </div>

                {/* AI Video Analysis Consent */}
                <div className={`p-4 rounded-lg border ${consents.aiAnalysis ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="ai-analysis-consent" 
                      checked={consents.aiAnalysis}
                      onCheckedChange={(checked) => {
                        setConsents(prev => ({ ...prev, aiAnalysis: checked as boolean }));
                        setConsentDeclined(false);
                      }}
                      className="mt-1"
                    />
                    <label htmlFor="ai-analysis-consent" className="cursor-pointer">
                      <p className="font-medium text-sm">AI Video Analysis Consent</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        I consent to my recorded video being analyzed by AI systems for integrity verification purposes. 
                        This analysis detects eye movement, gaze patterns, and potential violations. 
                        Video data is processed securely, is not retained after analysis, and is not used for AI training.
                      </p>
                    </label>
                  </div>
                </div>
              </div>

              <Alert className="bg-muted/50 border-muted">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Your privacy is important to us. All recordings and data are encrypted and stored securely. 
                  Data is retained only for the duration required for assessment review and compliance purposes.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('instructions')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (allConsentsGiven) {
                      setCurrentStep('setup');
                    } else {
                      setConsentDeclined(true);
                    }
                  }}
                  className="flex-1"
                  size="lg"
                >
                  {allConsentsGiven ? 'Continue to Setup' : 'Accept & Continue'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Verification Setup */}
        {currentStep === 'setup' && (
          <>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">System Verification</CardTitle>
              <CardDescription>
                Let's make sure everything is working properly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Video Preview */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {checks.camera.status !== 'passed' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    {checks.camera.status === 'running' ? (
                      <Loader2 className="h-10 w-10 text-white/50 animate-spin" />
                    ) : checks.camera.status === 'failed' ? (
                      <div className="text-center p-4">
                        <XCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                        <p className="text-white text-sm">Camera access required</p>
                      </div>
                    ) : (
                      <Camera className="h-10 w-10 text-white/30" />
                    )}
                  </div>
                )}
                {checks.camera.status === 'passed' && (
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between">
                    <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Camera Active
                    </div>
                    {checks.microphone.status === 'passed' && (
                      <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white flex items-center gap-1.5">
                        <Mic className="h-3 w-3" />
                        Mic Ready
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Check Items */}
              <div className="space-y-3">
                <CheckItem 
                  label="Internet Connection" 
                  icon={Wifi}
                  check={checks.network}
                  checkName="network"
                  onRetry={() => retryCheck('network')}
                />
                <CheckItem 
                  label="Camera Access" 
                  icon={Camera}
                  check={checks.camera}
                  checkName="camera"
                  onRetry={() => retryCheck('camera')}
                />
                <CheckItem 
                  label="Microphone Access" 
                  icon={Mic}
                  check={checks.microphone}
                  checkName="microphone"
                  onRetry={() => retryCheck('microphone')}
                />
                <CheckItem 
                  label="Lighting Conditions" 
                  icon={Sun}
                  check={checks.lighting}
                  checkName="lighting"
                  onRetry={() => retryCheck('lighting')}
                />
                <CheckItem 
                  label="Person Visible" 
                  icon={User}
                  check={checks.personVisible}
                  checkName="personVisible"
                  onRetry={() => retryCheck('personVisible')}
                />
              </div>

              {/* Action Buttons */}
              {hasAnyFailure && (
                <Button
                  onClick={retryAllFailed}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry All Failed Checks
                </Button>
              )}

              {allChecksPassed && (
                <Button
                  onClick={() => setCurrentStep('ready')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  All Checks Passed - Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}

              {!allChecksPassed && !hasAnyFailure && (
                <p className="text-center text-sm text-muted-foreground">
                  Running verification checks...
                </p>
              )}
            </CardContent>
          </>
        )}

        {/* Step 4: Ready to Start */}
        {currentStep === 'ready' && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl">You're All Set!</CardTitle>
              <CardDescription className="text-base">
                Everything looks good. Click below when you're ready to begin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Final Camera Preview */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video border-2 border-green-500/20">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white font-medium">
                  Ready
                </div>
              </div>

              {/* Quick Reminders */}
              <Alert className="bg-muted/50 border-muted">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Quick reminder:</strong> Once you start, you'll be asked to share your screen. 
                  Stay in fullscreen mode and keep your camera on throughout.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('setup')}
                  className="flex-1"
                >
                  Re-check Setup
                </Button>
                <Button
                  onClick={startAssessment}
                  disabled={isStarting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Start {assessmentLabel}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default PreInterviewChecks;
