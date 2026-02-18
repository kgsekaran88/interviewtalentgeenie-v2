import React, { useEffect, useState, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, AlertTriangle, Users, Volume2, CheckCircle } from 'lucide-react';
import { useProctoringContext } from '@/contexts/ProctoringContext';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useCandidateBroadcast } from '@/hooks/useCandidateBroadcast';

import type { UploadQueueResult } from '@/hooks/useProctoring';

interface ProctoringMonitorProps {
  attemptId: string;
  attemptType: 'interview' | 'learning' | 'certification';
  videoStream: MediaStream;
  screenStream: MediaStream;
  sessionId: string;
  // Session token for authenticating proctoring updates
  sessionToken?: string;
  // Flag indicating this is a resumed session (candidate closed browser and returned)
  isResumedSession?: boolean;
  // Callback to register the finalize function with parent component
  // Now returns UploadQueueResult so parent knows what was queued
  onFinalizeReady?: (finalize: (sessionToken?: string) => Promise<UploadQueueResult | undefined>) => void;
  // Flag to indicate quality change is in progress (pause health checks)
  qualityChangeInProgress?: boolean;
  // Callback when screen share is stopped - parent should show re-share UI
  onScreenShareStopped?: () => void;
}

/**
 * ProctoringMonitor component that displays proctoring status and starts recordings.
 * 
 * IMPORTANT: This component uses the shared ProctoringContext to ensure recordings
 * are stored in the same instance that will be used for upload on submission.
 */
const ProctoringMonitor: React.FC<ProctoringMonitorProps> = ({
  attemptId,
  attemptType,
  videoStream,
  screenStream,
  sessionId,
  sessionToken: propSessionToken,
  isResumedSession = false,
  onFinalizeReady,
  qualityChangeInProgress = false,
  onScreenShareStopped,
}) => {
  // Use shared proctoring context - this ensures recordings go to the same instance
  // that TakeInterview uses for finalization
  const { startVideoRecording, startScreenRecording, setState, violations, logViolation, stopRecording, sessionId: contextSessionId, initSession } = useProctoringContext();
  
  const { toast, errorToast } = useUserFriendlyToast();
  const [isVisible, setIsVisible] = useState(true);
  const [personCount, setPersonCount] = useState<number>(1);
  const [detectionConfidence, setDetectionConfidence] = useState<number>(0);
  const [detectionStatus, setDetectionStatus] = useState<'initializing' | 'active' | 'error'>('initializing');
  const [eyeGaze, setEyeGaze] = useState<{ isLookingAway: boolean; confidence: number; direction: string } | null>(null);
  const [voiceAnalysis, setVoiceAnalysis] = useState<{ audioLevel: number; multipleVoicesDetected: boolean } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shownViolationTypesRef = useRef<Set<string>>(new Set());
  const recordingStartedRef = useRef<boolean>(false);
  const [cameraDisconnected, setCameraDisconnected] = useState(false);
  const [screenShareStopped, setScreenShareStopped] = useState(false);
  const reconnectAttemptRef = useRef<number>(0);
  const screenHealthCheckRef = useRef<NodeJS.Timeout | null>(null);
  // Track the previous screenStream to detect when it changes (re-share)
  const previousScreenStreamRef = useRef<MediaStream | null>(null);
  // Track when screen sharing started for duration calculation
  const screenShareStartTimeRef = useRef<Date | null>(null);
  // Track last user interaction time for context
  const lastInteractionTimeRef = useRef<Date>(new Date());

  // Track the actual session ID (may be created here if not provided)
  const [activeSessionId, setActiveSessionId] = useState<string>(sessionId || '');
  const activeSessionIdRef = useRef<string>(sessionId || '');

  // Enable live streaming broadcast for proctors to view
  const { isBroadcasting } = useCandidateBroadcast({
    sessionId: activeSessionId || null,
    videoStream,
    enabled: true, // Always enable for active proctoring
  });

  // CRITICAL: Register finalize function IMMEDIATELY on mount, before any async operations
  // This ensures the ref is available even if user submits quickly
  useEffect(() => {
    if (onFinalizeReady) {
      logger.proctoring('[ProctoringMonitor] Registering finalize function immediately');
      logger.proctoring('[ProctoringMonitor] Initial sessionId prop:', sessionId);
      logger.proctoring('[ProctoringMonitor] Initial contextSessionId:', contextSessionId);
      
      onFinalizeReady(async (sessionToken?: string): Promise<UploadQueueResult | undefined> => {
        logger.proctoring('!!! PROCTORING MONITOR FINALIZE FUNCTION CALLED !!!');
        // Use multiple fallbacks for session ID
        const sessionToClose = activeSessionIdRef.current || sessionId || contextSessionId;
        logger.proctoring('[ProctoringMonitor] Finalize called');
        logger.proctoring('[ProctoringMonitor] - activeSessionIdRef:', activeSessionIdRef.current);
        logger.proctoring('[ProctoringMonitor] - sessionId prop:', sessionId);
        logger.proctoring('[ProctoringMonitor] - contextSessionId:', contextSessionId);
        logger.proctoring('[ProctoringMonitor] - Using session:', sessionToClose);
        logger.proctoring('[ProctoringMonitor] - Recording started flag:', recordingStartedRef.current);
        logger.proctoring('[ProctoringMonitor] - Session token:', sessionToken ? 'PROVIDED' : 'MISSING');
        
        // CRITICAL: Check if recording was actually started
        if (!recordingStartedRef.current) {
          logger.error('[ProctoringMonitor] !!! RECORDING NEVER STARTED - CANNOT FINALIZE !!!');
          logger.error('[ProctoringMonitor] This usually means videoStream was inactive when ProctoringMonitor mounted');
          // Still try to close the session with a note about the failure
          if (sessionToClose) {
            try {
              // Use edge function for update (no direct DB access)
              await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-proctoring-session`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sessionId: sessionToClose,
                    attemptId,
                    sessionToken,
                    attemptType,
                    updates: {
                      reviewer_notes: 'RECORDING FAILURE: Recording never started. Streams may have been inactive when ProctoringMonitor mounted.',
                      ended_at: new Date().toISOString(),
                    },
                  }),
                }
              );
            } catch (e) {
              logger.error('[ProctoringMonitor] Failed to update session with failure note:', e);
            }
          }
          return undefined;
        }
        
        if (!sessionToClose) {
          logger.error('[ProctoringMonitor] !!! NO SESSION ID - CANNOT FINALIZE !!!');
          return undefined;
        }
        logger.proctoring('[ProctoringMonitor] !!! CALLING stopRecording NOW !!!');
        const uploadResult = await stopRecording(sessionToClose, sessionToken);
        logger.proctoring('[ProctoringMonitor] !!! stopRecording COMPLETED !!!', uploadResult);
        return uploadResult;
      });
    }
  }, [onFinalizeReady, stopRecording, sessionId, contextSessionId]);

  useEffect(() => {
    // Prevent starting recordings multiple times
    if (recordingStartedRef.current) {
      logger.proctoring('[ProctoringMonitor] Recordings already started, skipping');
      return;
    }
    
    const initializeProctoring = async () => {
      logger.proctoring('[ProctoringMonitor] Starting recordings with shared context');
      logger.proctoring('[ProctoringMonitor] videoStream active:', videoStream?.active);
      logger.proctoring('[ProctoringMonitor] screenStream active:', screenStream?.active);
      logger.proctoring('[ProctoringMonitor] screenStream tracks:', screenStream?.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState })));
      
      // Validate video stream before proceeding
      if (!videoStream || !videoStream.active) {
        logger.error('[ProctoringMonitor] ABORT: videoStream is not active!');
        toast({
          title: 'Recording Error',
          description: 'Camera stream became inactive. Please refresh the page and try again.',
          variant: 'destructive',
        });
        return;
      }
      
      const videoTracks = videoStream.getVideoTracks();
      if (videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        logger.error('[ProctoringMonitor] ABORT: No live video track!', videoTracks[0]?.readyState);
        toast({
          title: 'Recording Error',
          description: 'Camera is not ready. Please refresh the page and try again.',
          variant: 'destructive',
        });
        return;
      }
      
      // CRITICAL: Validate screen stream thoroughly
      const screenTrack = screenStream?.getVideoTracks()[0];
      if (!screenStream || !screenStream.active || !screenTrack || screenTrack.readyState !== 'live') {
        logger.error('[ProctoringMonitor] CRITICAL: screenStream is not active or track is not live!');
        logger.error('[ProctoringMonitor] screenStream:', screenStream ? 'exists' : 'null');
        logger.error('[ProctoringMonitor] screenStream.active:', screenStream?.active);
        logger.error('[ProctoringMonitor] screenTrack:', screenTrack ? 'exists' : 'null');
        logger.error('[ProctoringMonitor] screenTrack.readyState:', screenTrack?.readyState);
        // Show a DESTRUCTIVE toast since screen recording is important
        toast({
          title: 'Screen Recording Failed',
          description: 'Screen sharing was lost. The interview will continue but screen recording will not be available.',
          variant: 'destructive',
        });
      }
      
      recordingStartedRef.current = true;

      // Use context session ID first, then prop, then create new
      let finalSessionId = contextSessionId || sessionId;
      if (!finalSessionId && attemptId) {
        logger.proctoring('[ProctoringMonitor] No sessionId available, calling initSession');
        finalSessionId = await initSession(attemptId);
        if (!finalSessionId) {
          logger.error('[ProctoringMonitor] Failed to create proctoring session');
          recordingStartedRef.current = false; // Allow retry
          return;
        }
        logger.proctoring('[ProctoringMonitor] Proctoring session obtained:', finalSessionId);
      }
      
      // Store in both state and ref for reliability
      setActiveSessionId(finalSessionId || '');
      activeSessionIdRef.current = finalSessionId || '';
      logger.proctoring('[ProctoringMonitor] Session ID stored in ref:', finalSessionId);
      
      // Update session with check status (these checks passed if we got here)
      // Use edge function for update (no direct DB access for unauthenticated candidates)
      if (finalSessionId) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-proctoring-session`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: finalSessionId,
                attemptId,
                sessionToken: propSessionToken,
                attemptType,
                updates: {
                  camera_check_passed: videoStream?.active && videoStream.getVideoTracks().length > 0,
                  microphone_check_passed: videoStream?.active && videoStream.getAudioTracks().length > 0,
                  screen_share_check_passed: screenStream?.active && screenStream.getVideoTracks().length > 0,
                },
              }),
            }
          );
          
          if (!response.ok) {
            logger.error('[ProctoringMonitor] Failed to update check status:', await response.text());
          } else {
            logger.proctoring('[ProctoringMonitor] ✅ Check statuses saved via edge function');
          }
        } catch (updateError) {
          logger.error('[ProctoringMonitor] Failed to update check status:', updateError);
        }
      }

      // Set session ID and streams in shared context
      setState(prev => ({
        ...prev,
        sessionId: finalSessionId,
        videoStream,
        screenStream,
        isRecording: true,
      }));

      // Set up video element for monitoring
      if (videoRef.current && videoStream) {
        videoRef.current.srcObject = videoStream;
      }

      // Start recordings - AWAIT and VERIFY they started properly
      logger.proctoring('[ProctoringMonitor] Starting video recording...');
      const videoStarted = await startVideoRecording(videoStream);
      if (!videoStarted) {
        logger.error('[ProctoringMonitor] ❌ VIDEO RECORDING FAILED TO START!');
        toast({
          title: 'Recording Error',
          description: 'Failed to start video recording. Please refresh and try again.',
          variant: 'destructive',
        });
        recordingStartedRef.current = false;
        return;
      }
      logger.proctoring('[ProctoringMonitor] ✅ Video recording verified started');
      
      logger.proctoring('[ProctoringMonitor] Starting screen recording...');
      logger.proctoring('[ProctoringMonitor] Screen stream state before startScreenRecording:');
      logger.proctoring('[ProctoringMonitor]   - active:', screenStream?.active);
      logger.proctoring('[ProctoringMonitor]   - tracks:', screenStream?.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState, enabled: t.enabled })));
      
      const screenStarted = await startScreenRecording(screenStream);
      if (!screenStarted) {
        logger.error('[ProctoringMonitor] ❌ SCREEN RECORDING FAILED TO START!');
        logger.error('[ProctoringMonitor] Screen stream post-failure state:', screenStream?.active, screenStream?.getTracks().map(t => t.readyState));
        // Screen recording is IMPORTANT - show destructive toast
        toast({
          title: 'Screen Recording Failed',
          description: 'Screen recording could not be started. The interview will continue but screen recording will not be available for review.',
          variant: 'destructive',
        });
      } else {
        logger.proctoring('[ProctoringMonitor] ✅ Screen recording verified started');
        // Track when screen sharing started for duration calculation
        screenShareStartTimeRef.current = new Date();
      }

      // Helper function to handle screen share stopped with enhanced metadata
      const handleScreenShareStopped = (reason: string, trackLabel?: string) => {
        if (screenShareStopped) return; // Prevent duplicate handling
        
        const now = new Date();
        const screenShareDurationMs = screenShareStartTimeRef.current 
          ? now.getTime() - screenShareStartTimeRef.current.getTime() 
          : 0;
        const timeSinceLastInteractionMs = now.getTime() - lastInteractionTimeRef.current.getTime();
        
        logger.error(`[ProctoringMonitor] ⚠️ SCREEN SHARE STOPPED - ${reason}`);
        setScreenShareStopped(true);
        
        // Enhanced metadata to help reviewers judge intent
        const enhancedMetadata = {
          reason,
          trackLabel,
          // Duration helps reviewers see if it was a quick accidental stop or deliberate
          screenShareDurationSeconds: Math.round(screenShareDurationMs / 1000),
          screenShareDurationFormatted: formatDuration(screenShareDurationMs),
          // Time since last interaction - if long, might indicate system/browser issue
          timeSinceLastInteractionSeconds: Math.round(timeSinceLastInteractionMs / 1000),
          // Browser and system context
          browserInfo: navigator.userAgent,
          visibilityState: document.visibilityState,
          documentHasFocus: document.hasFocus(),
          // Timestamp details for cross-referencing with other events
          stoppedAt: now.toISOString(),
          startedAt: screenShareStartTimeRef.current?.toISOString() || 'unknown',
          // Reason explanation for reviewers
          reasonExplanation: getStopReasonExplanation(reason),
        };
        
        logViolation({
          timestamp: now.toISOString(),
          type: 'screen_share_stopped',
          severity: 'high',
          details: 'Screen sharing was stopped during the interview. This is a critical violation that requires immediate attention.',
          metadata: enhancedMetadata
        });
        
        toast({
          title: '⚠️ Screen Share Stopped',
          description: 'You must re-share your screen to continue the interview.',
          variant: 'destructive',
        });
        
        // Notify parent to show blocking overlay
        if (onScreenShareStopped) {
          onScreenShareStopped();
        }
      };
      
      // Helper to format duration for human readability
      const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
      };
      
      // Helper to explain stop reasons for reviewers
      const getStopReasonExplanation = (reason: string): string => {
        switch (reason) {
          case 'track_ended':
            return 'Browser reported the screen share track ended. This typically occurs when the user clicks "Stop sharing" in the browser UI.';
          case 'no_track_found':
            return 'Screen share track was not found during health check. This can indicate the stream was terminated or a browser issue occurred.';
          case 'track_not_live':
            return 'Screen share track state changed from "live" to ended. This usually means the user stopped sharing or switched windows.';
          case 'stream_inactive':
            return 'Screen share stream became inactive. This can happen when the user stops sharing or the browser terminates the stream.';
          default:
            return `Unknown reason: ${reason}`;
        }
      };

      // Set up screen track monitoring for early detection of screen share ending
      const screenTracks = screenStream?.getVideoTracks() || [];
      screenTracks.forEach(track => {
        track.onended = () => {
          handleScreenShareStopped('track_ended', track.label);
        };
      });
      
      // CRITICAL: Periodic screen track health check (every 5 seconds)
      // This catches cases where onended doesn't fire (browser bugs, Chrome behavior)
      screenHealthCheckRef.current = setInterval(() => {
        if (qualityChangeInProgress || screenShareStopped) return;
        
        const currentScreenTrack = screenStream?.getVideoTracks()[0];
        if (!currentScreenTrack) {
          handleScreenShareStopped('no_track_found');
          if (screenHealthCheckRef.current) clearInterval(screenHealthCheckRef.current);
          return;
        }
        
        if (currentScreenTrack.readyState !== 'live') {
          handleScreenShareStopped('track_not_live', currentScreenTrack.label);
          if (screenHealthCheckRef.current) clearInterval(screenHealthCheckRef.current);
          return;
        }
        
        // Also check if stream is inactive
        if (!screenStream?.active) {
          handleScreenShareStopped('stream_inactive');
          if (screenHealthCheckRef.current) clearInterval(screenHealthCheckRef.current);
        }
      }, 5000);

      // Start continuous monitoring
      startContinuousMonitoring(videoStream);

      // CRITICAL: Log violation if this is a resumed session (browser was closed and candidate returned)
      // This flags the attempt for reviewers to scrutinize
      if (isResumedSession) {
        logger.proctoring('[ProctoringMonitor] ⚠️ SESSION RESUMED - Logging violation');
        logViolation({
          timestamp: new Date().toISOString(),
          type: 'tab_switch', // Use tab_switch as closest existing type
          severity: 'high',
          details: 'Session was resumed after browser/tab was closed. Candidate may have viewed questions before returning.',
          metadata: { resumedSession: true, resumedAt: new Date().toISOString() }
        });
        toast({
          title: 'Session Resumed',
          description: 'Your session has been resumed. This has been logged.',
          variant: 'default',
        });
      }

      // Set up stream track listeners for auto-reconnection
      videoTracks.forEach(track => {
        track.onended = () => {
          logger.warn('[ProctoringMonitor] Video track ended unexpectedly');
          setCameraDisconnected(true);
          logViolation({
            timestamp: new Date().toISOString(),
            type: 'look_away',
            severity: 'medium',
            details: 'Camera stream was disconnected'
          });
          attemptCameraReconnect();
        };
        track.onmute = () => {
          logger.warn('[ProctoringMonitor] Video track muted - checking if reconnection needed');
          // Mute can happen during quality changes - check if track is actually dead
          setTimeout(() => {
            if (track.readyState === 'ended' || !track.enabled) {
              logger.warn('[ProctoringMonitor] Track not recovered from mute, reconnecting');
              setCameraDisconnected(true);
              attemptCameraReconnect();
            } else {
              logger.proctoring('[ProctoringMonitor] Track recovered from mute');
            }
          }, 2000);
        };
        // Watch for video constraints changes (quality changes)
        track.addEventListener('constraintchange', () => {
          logger.proctoring('[ProctoringMonitor] Video track constraints changed, checking health');
          if (track.readyState !== 'live') {
            logger.warn('[ProctoringMonitor] Track no longer live after constraint change');
            attemptCameraReconnect();
          }
        });
      });
      
      // Periodic track health check (catches edge cases)
      // CRITICAL: Skip health check if quality change is in progress to avoid race conditions
      healthCheckIntervalRef.current = setInterval(() => {
        if (qualityChangeInProgress) {
          logger.proctoring('[ProctoringMonitor] Skipping health check - quality change in progress');
          return;
        }
        const currentTrack = videoStream?.getVideoTracks()[0];
        if (currentTrack && currentTrack.readyState !== 'live') {
          logger.warn('[ProctoringMonitor] Health check: video track not live');
          setCameraDisconnected(true);
          attemptCameraReconnect();
          if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
        }
      }, 5000);

      // Auto-hide the monitor after 8 seconds
      setTimeout(() => setIsVisible(false), 8000);
    };

    initializeProctoring();

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      if (screenHealthCheckRef.current) {
        clearInterval(screenHealthCheckRef.current);
      }
    };
  }, []); // Only run once on mount

  // Track user interactions to provide context for screen share violations
  // If a long time passes since last interaction before screen share stops,
  // it may indicate a system/browser issue rather than intentional action
  useEffect(() => {
    const updateInteractionTime = () => {
      lastInteractionTimeRef.current = new Date();
    };
    
    // Track various user interactions
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateInteractionTime, { passive: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateInteractionTime);
      });
    };
  }, []);

  // CRITICAL: Detect when screenStream prop changes (after candidate re-shares)
  // This restarts screen recording and health checks with the new stream
  useEffect(() => {
    // Skip on initial mount (previousScreenStreamRef is null)
    if (previousScreenStreamRef.current === null) {
      previousScreenStreamRef.current = screenStream;
      return;
    }
    
    // Check if this is a NEW stream (different object reference = candidate re-shared)
    if (screenStream && screenStream !== previousScreenStreamRef.current && screenShareStopped) {
      logger.proctoring('[ProctoringMonitor] 🔄 Screen stream changed - candidate re-shared screen');
      logger.proctoring('[ProctoringMonitor] New stream active:', screenStream.active);
      logger.proctoring('[ProctoringMonitor] New stream tracks:', screenStream.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState })));
      
      // Reset the stopped state
      setScreenShareStopped(false);
      
      // Update context with new stream
      setState(prev => ({
        ...prev,
        screenStream,
      }));
      
      // Restart screen recording with new stream
      (async () => {
        logger.proctoring('[ProctoringMonitor] Restarting screen recording with new stream...');
        const screenStarted = await startScreenRecording(screenStream, true);
        if (screenStarted) {
          logger.proctoring('[ProctoringMonitor] ✅ Screen recording restarted successfully');
          // Reset start time for new session
          screenShareStartTimeRef.current = new Date();
          toast({
            title: 'Screen Recording Resumed',
            description: 'Screen recording has been restarted with your new screen share.',
          });
        } else {
          logger.error('[ProctoringMonitor] ❌ Failed to restart screen recording');
          toast({
            title: 'Recording Error',
            description: 'Failed to restart screen recording after re-share.',
            variant: 'destructive',
          });
        }
      })();
      
      // Restart health check interval for new stream
      if (screenHealthCheckRef.current) {
        clearInterval(screenHealthCheckRef.current);
      }
      
      // Helper to format duration for human readability
      const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
      };
      
      // Helper to explain stop reasons for reviewers
      const getStopReasonExplanation = (reason: string): string => {
        switch (reason) {
          case 'track_ended':
            return 'Browser reported the screen share track ended. This typically occurs when the user clicks "Stop sharing" in the browser UI.';
          case 'no_track_found':
            return 'Screen share track was not found during health check. This can indicate the stream was terminated or a browser issue occurred.';
          case 'track_not_live':
            return 'Screen share track state changed from "live" to ended. This usually means the user stopped sharing or switched windows.';
          case 'stream_inactive':
            return 'Screen share stream became inactive. This can happen when the user stops sharing or the browser terminates the stream.';
          default:
            return `Unknown reason: ${reason}`;
        }
      };
      
      // Helper function to handle screen share stopped with enhanced metadata (same as in main useEffect)
      const handleScreenShareStopped = (reason: string, trackLabel?: string) => {
        if (screenShareStopped) return;
        
        const now = new Date();
        const screenShareDurationMs = screenShareStartTimeRef.current 
          ? now.getTime() - screenShareStartTimeRef.current.getTime() 
          : 0;
        const timeSinceLastInteractionMs = now.getTime() - lastInteractionTimeRef.current.getTime();
        
        logger.error(`[ProctoringMonitor] ⚠️ SCREEN SHARE STOPPED AGAIN - ${reason}`);
        setScreenShareStopped(true);
        
        // Enhanced metadata to help reviewers judge intent
        const enhancedMetadata = {
          reason,
          trackLabel,
          isReShare: true, // Flag that this is after a previous re-share
          screenShareDurationSeconds: Math.round(screenShareDurationMs / 1000),
          screenShareDurationFormatted: formatDuration(screenShareDurationMs),
          timeSinceLastInteractionSeconds: Math.round(timeSinceLastInteractionMs / 1000),
          browserInfo: navigator.userAgent,
          visibilityState: document.visibilityState,
          documentHasFocus: document.hasFocus(),
          stoppedAt: now.toISOString(),
          startedAt: screenShareStartTimeRef.current?.toISOString() || 'unknown',
          reasonExplanation: getStopReasonExplanation(reason),
        };
        
        logViolation({
          timestamp: now.toISOString(),
          type: 'screen_share_stopped',
          severity: 'high',
          details: 'Screen sharing was stopped during the interview (after previous re-share).',
          metadata: enhancedMetadata
        });
        
        toast({
          title: '⚠️ Screen Share Stopped Again',
          description: 'You must re-share your screen to continue.',
          variant: 'destructive',
        });
        
        if (onScreenShareStopped) {
          onScreenShareStopped();
        }
      };
      
      // Set up track ended listener for new stream
      const screenTracks = screenStream.getVideoTracks();
      screenTracks.forEach(track => {
        track.onended = () => {
          handleScreenShareStopped('track_ended', track.label);
        };
      });
      
      // Restart periodic health check
      screenHealthCheckRef.current = setInterval(() => {
        if (qualityChangeInProgress || screenShareStopped) return;
        
        const currentScreenTrack = screenStream.getVideoTracks()[0];
        if (!currentScreenTrack) {
          handleScreenShareStopped('no_track_found');
          if (screenHealthCheckRef.current) clearInterval(screenHealthCheckRef.current);
          return;
        }
        
        if (currentScreenTrack.readyState !== 'live') {
          handleScreenShareStopped('track_not_live', currentScreenTrack.label);
          if (screenHealthCheckRef.current) clearInterval(screenHealthCheckRef.current);
          return;
        }
        
        if (!screenStream.active) {
          handleScreenShareStopped('stream_inactive');
          if (screenHealthCheckRef.current) clearInterval(screenHealthCheckRef.current);
        }
      }, 5000);
    }
    
    // Update ref to current stream
    previousScreenStreamRef.current = screenStream;
  }, [screenStream, screenShareStopped, qualityChangeInProgress, setState, startScreenRecording, logViolation, toast, onScreenShareStopped]);

  // Camera auto-reconnection logic
  const attemptCameraReconnect = async () => {
    if (reconnectAttemptRef.current >= 3) {
      logger.error('[ProctoringMonitor] Max reconnection attempts reached');
      toast({
        title: 'Camera Connection Lost',
        description: 'Unable to reconnect camera. Please refresh the page if issues persist.',
        variant: 'destructive',
      });
      return;
    }

    reconnectAttemptRef.current += 1;
    logger.proctoring(`[ProctoringMonitor] Attempting camera reconnect (attempt ${reconnectAttemptRef.current})`);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

      // Update video element
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Restart video recording with new stream - preserve existing chunks
      const recordingRestarted = await startVideoRecording(newStream, true);
      if (!recordingRestarted) {
        logger.error('[ProctoringMonitor] Failed to restart recording after reconnect');
      }

      // Restart monitoring with new stream
      startContinuousMonitoring(newStream);

      // Set up new track listeners
      const newVideoTracks = newStream.getVideoTracks();
      newVideoTracks.forEach(track => {
        track.onended = () => {
          logger.warn('[ProctoringMonitor] Reconnected video track ended');
          setCameraDisconnected(true);
          logViolation({
            timestamp: new Date().toISOString(),
            type: 'look_away',
            severity: 'medium',
            details: 'Camera stream disconnected again'
          });
          attemptCameraReconnect();
        };
      });

      setCameraDisconnected(false);
      reconnectAttemptRef.current = 0;
      
      toast({
        title: 'Camera Reconnected',
        description: 'Your camera has been successfully reconnected.',
      });

      logger.proctoring('[ProctoringMonitor] Camera reconnected successfully');
    } catch (error) {
      logger.error('[ProctoringMonitor] Failed to reconnect camera:', error);
      toast({
        title: 'Camera Reconnection Failed',
        description: 'Please check your camera permissions and try again.',
        variant: 'destructive',
      });
      
      // Retry after delay
      setTimeout(() => attemptCameraReconnect(), 2000);
    }
  };

  // AI-powered continuous environment monitoring
  // NOTE: When deferHeavyAnalysis is enabled (default), this skips heavy AI detection
  // and only updates status. The actual face/object detection happens post-interview.
  const startContinuousMonitoring = async (stream: MediaStream) => {
    // Skip heavy AI monitoring for performance - will be analyzed post-interview
    logger.proctoring('[ProctoringMonitor] Continuous monitoring mode: lightweight only');
    logger.proctoring('[ProctoringMonitor] Heavy AI analysis (face/object detection) deferred to post-interview');
    
    // Just mark detection as active without running the heavy AI model
    setDetectionStatus('active');
    
    // Note: The following are handled by useProctoring hooks (lightweight):
    // - Tab switches (event-based)
    // - Print screen blocking (event-based)
    // - Multi-monitor detection (one-time check)
    // - VM detection (one-time check)
    // - Typing pattern analysis (lightweight keystroke tracking)
    // - Copy/paste detection (event-based)
    // - Voice analysis (audio API, no heavy ML)
    
    // Face detection, object detection, look-away analysis will run on
    // the recorded video after the interview via analyze-proctoring-video edge function
  };

  // Hidden video element for continuous monitoring
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Update voice analysis state from proctoring hook
    const interval = setInterval(() => {
      const proctoringVoice = (window as any).__proctoringVoiceAnalysis;
      if (proctoringVoice) {
        setVoiceAnalysis(proctoringVoice);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <>
        {/* Hidden video for monitoring */}
        <video
          ref={hiddenVideoRef}
          autoPlay
          muted
          playsInline
          className="hidden"
        />
        <div className="fixed top-20 right-4 z-50 pointer-events-none">
          <button
            onClick={() => setIsVisible(true)}
            className="bg-background border rounded-full p-2 shadow-lg hover:bg-accent transition-colors pointer-events-auto"
            title="Show proctoring status"
          >
            <Eye className="h-5 w-5 text-primary animate-pulse" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Hidden video for monitoring */}
      <video
        ref={hiddenVideoRef}
        autoPlay
        muted
        playsInline
        className="hidden"
      />
      <div className="fixed top-20 right-4 z-50 max-w-sm space-y-2">
        {/* Main Proctoring Status */}
        <Alert className="bg-background/95 backdrop-blur border-primary/20">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-primary animate-pulse mt-0.5" />
            <div className="flex-1">
              <AlertDescription>
                <p className="font-semibold text-sm mb-2">Proctoring Active</p>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span>Video Recording</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span>Screen Recording</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>AI Face Detection: </span>
                    <span className="text-success">Post-interview analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3 w-3" />
                    <span>Audio Monitoring: </span>
                    {voiceAnalysis && (
                      <span className={voiceAnalysis.multipleVoicesDetected ? 'text-warning' : 'text-success'}>
                        {voiceAnalysis.multipleVoicesDetected ? 'Multiple voices' : 'Normal'}
                        {' '}({Math.round(voiceAnalysis.audioLevel * 100)}%)
                      </span>
                    )}
                  </div>
                  {cameraDisconnected && (
                    <div className="flex items-center gap-2 text-destructive mt-2 pt-2 border-t">
                      <AlertTriangle className="h-3 w-3 animate-pulse" />
                      <span className="font-semibold">Camera disconnected - reconnecting...</span>
                    </div>
                  )}
                  {violations.length > 0 && (
                    <div className="flex items-center gap-2 text-warning mt-2 pt-2 border-t">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="font-semibold">{violations.length} violation(s) logged</span>
                    </div>
                  )}
                  {eyeGaze && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <Eye className="h-3 w-3" />
                      <span className="text-xs">
                        Eye Gaze: <span className={eyeGaze.isLookingAway ? 'text-warning font-semibold' : 'text-success'}>
                          {eyeGaze.direction} ({Math.round(eyeGaze.confidence * 100)}%)
                        </span>
                      </span>
                    </div>
                  )}
                  {detectionStatus === 'active' && personCount === 1 && detectionConfidence >= 70 && (
                    <div className="flex items-center gap-2 text-success mt-2 pt-2 border-t">
                      <CheckCircle className="h-3 w-3" />
                      <span className="text-xs">Detection quality: Excellent</span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>
        </Alert>
      </div>
    </>
  );
};

export default ProctoringMonitor;
