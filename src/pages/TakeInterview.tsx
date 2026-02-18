import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Brain, Clock, CheckCircle, Video, Monitor, AlertCircle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getInterviewErrorMessage } from "@/lib/error-handler";
import { startOperation, completeOperation } from "@/lib/operationLogger";
import { getUserFriendlyError } from "@/lib/userFriendlyErrors";
import { CodeEditor } from "@/components/interview/CodeEditor";
import FormattedQuestionText from "@/components/interview/FormattedQuestionText";
import PreInterviewChecks from "@/components/proctoring/PreInterviewChecks";
import ProctoringMonitor from "@/components/proctoring/ProctoringMonitor";
import ScreenShareBlockingOverlay from "@/components/proctoring/ScreenShareBlockingOverlay";
import StreamHealthGuard from "@/components/proctoring/StreamHealthGuard";
import NetworkStatusBanner from "@/components/proctoring/NetworkStatusBanner";
import { candidateInfoSchema, interviewSubmissionSchema } from "@/lib/validations";
import { ProctoringProvider } from "@/contexts/ProctoringContext";
import UploadProgressOverlay from "@/components/interview/UploadProgressOverlay";
import TimesUpOverlay from "@/components/interview/TimesUpOverlay";
import { logger } from "@/lib/logger";
import type { UploadQueueResult } from "@/hooks/useProctoring";
import { withRetry, isRetryableError, getInvitationErrorMessage } from "@/lib/retryUtils";
const TakeInterview = () => {
  logger.proctoring('[TakeInterview] Component rendering');
  // Support both new readable URL format and legacy format
  const { shareLink: legacyToken, shareToken: newToken, orgSlug, interviewSlug } = useParams();
  const shareToken = newToken || legacyToken;
  logger.proctoring('[TakeInterview] URL params:', { shareToken, orgSlug, interviewSlug });
  const navigate = useNavigate();
  const { toast, errorToast } = useUserFriendlyToast();
  const [invitation, setInvitation] = useState<any>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isResumedSession, setIsResumedSession] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [isPreparingUpload, setIsPreparingUpload] = useState(false);
  const [isUploadingRecordings, setIsUploadingRecordings] = useState(false); // Tracks active upload during finalization
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false); // NEW: Tracks if time has expired
  const [candidateInfo, setCandidateInfo] = useState<{ name: string; email: string } | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(null);
  const [showProctoringSetup, setShowProctoringSetup] = useState(false);
  const [proctoringComplete, setProctoringComplete] = useState(false);
  const [proctoringSessionId, setProctoringSessionId] = useState<string | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // CRITICAL: Refs for immediate stream access (React state is async and can be stale)
  // These refs hold the streams synchronously, avoiding timing issues between
  // PreInterviewChecks completion and ProctoringMonitor rendering
  const videoStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Ref to hold the proctoring finalization function from the shared context
  // This is populated by ProctoringMonitor when it mounts inside the provider
  // Returns UploadQueueResult so we know what recordings were queued before showing completion
  const proctoringFinalizeRef = useRef<((sessionToken?: string) => Promise<UploadQueueResult | undefined>) | null>(null);
  
  const [videoQuality, setVideoQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [autoQualityEnabled, setAutoQualityEnabled] = useState(true);
  const [videoPerformance, setVideoPerformance] = useState({ droppedFrames: 0, totalFrames: 0 });
  const [proctoringChecksComplete, setProctoringChecksComplete] = useState(false);
  const [screenShareBlocked, setScreenShareBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefCallback = useRef<((el: HTMLVideoElement | null) => void) | null>(null);
  const bandwidthCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const performanceCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastFrameCheck = useRef({ droppedFrames: 0, totalFrames: 0, timestamp: 0 });

  useEffect(() => {
    logger.proctoring('[TakeInterview] useEffect triggered, shareToken:', shareToken);
    fetchInvitationAndInterview();
  }, [shareToken]);

  const fetchInvitationAndInterview = async () => {
    logger.proctoring('[TakeInterview] fetchInvitationAndInterview started');
    
    // Determine if this is an invitation-based URL (new format with org/interview slugs)
    // These URLs MUST have a valid invitation token - no fallback allowed
    const isInvitationUrl = !!(orgSlug && interviewSlug);
    
    try {
      // Resolve invitation via backend with retry logic for network resilience
      logger.proctoring('[TakeInterview] Calling resolve-invitation with token:', shareToken);
      // Detect candidate timezone for reminder scheduling
      const candidateTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Use retry wrapper for network resilience (3 attempts, ~5-8s total)
      const { data, error } = await withRetry(
        async () => {
          const result = await invokeFunction("resolve-invitation", {
            body: { share_token: shareToken, timezone: candidateTimezone },
          });
          // Throw on retryable errors to trigger retry
          if (result.error && isRetryableError(result.error)) {
            throw result.error;
          }
          return result;
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1500,
          maxDelayMs: 4000,
          backoffMultiplier: 1.5,
          onRetry: (attempt, err) => {
            logger.proctoring(`[TakeInterview] Retry attempt ${attempt} after error:`, err?.message);
          }
        }
      ).catch(async (retryError) => {
        // All retries failed - return the error in expected format
        logger.warn('[TakeInterview] All retry attempts failed:', retryError);
        return { data: null, error: retryError };
      });
      
      logger.proctoring('[TakeInterview] resolve-invitation response:', { data, error });

      if (error) {
        // For invitation-based URLs, require valid token - don't fall back
        if (isInvitationUrl) {
          logger.warn("Invalid invitation token for invitation URL", { shareToken, error });
          // Use user-friendly error message instead of hardcoded one
          setInvitationError(getInvitationErrorMessage(error));
          setLoading(false);
          return;
        }
        
        logger.warn("Invitation resolution failed, falling back to public interview flow", {
          shareToken,
          error,
        });
        await fetchInterview();
        return;
      }

      const invitationData = (data as any)?.invitation;

      if (!invitationData) {
        // For invitation-based URLs, require valid invitation data
        if (isInvitationUrl) {
          logger.warn("No invitation found for invitation URL token", { shareToken });
          setInvitationError("This invitation link is invalid. Please use the link from your invitation email.");
          setLoading(false);
          return;
        }
        
        logger.warn("No invitation returned for token, falling back to public interview flow", {
          shareToken,
        });
        await fetchInterview();
        return;
      }

      // Check if interview is archived
      if (invitationData.interview?.status === 'archived') {
        setInvitationError("This interview is no longer available. Please contact the recruiter at Support@talentgeenie.com for assistance.");
        setLoading(false);
        return;
      }

      // Expiry & status checks are also enforced in the backend, but we keep
      // them here to provide clearer UI messages.
      if (new Date(invitationData.expires_at) < new Date() || invitationData.status === "expired") {
        setInvitationError("This invitation has expired. Please contact the recruiter for a new invitation.");
        setLoading(false);
        return;
      }

      if (invitationData.status === "completed") {
        setInvitationError(
          "This interview has already been taken. Each candidate can only attempt once.",
        );
        setLoading(false);
        return;
      }

      setInvitation(invitationData);
      setInterview(invitationData.interview);

      // Pre-fill candidate email (read-only)
      setCandidateEmail(invitationData.candidate_email);
      if (invitationData.candidate_name) {
        setCandidateName(invitationData.candidate_name);
      }

      setLoading(false);
    } catch (error: any) {
      logger.error("Error resolving invitation:", error);
      
      // For invitation-based URLs, don't fall back on errors
      if (isInvitationUrl) {
        // Use user-friendly error message
        setInvitationError(getInvitationErrorMessage(error));
        setLoading(false);
        return;
      }
      
      // If invitation lookup fails for unexpected reasons, still try public flow
      await fetchInterview();
    }
  };

  // Track if stream has been attached to prevent re-attachment causing blinks
  const streamAttachedRef = useRef<string | null>(null);

  // Helper to check if stream is actually alive (active with live tracks)
  const isStreamAlive = (stream: MediaStream | null): boolean => {
    if (!stream || !stream.active) return false;
    const videoTracks = stream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks.some(t => t.readyState === 'live');
  };

  // Helper to attach stream to video element
  const attachStreamToVideo = (el: HTMLVideoElement, stream: MediaStream) => {
    logger.proctoring('[VIDEO DEBUG] Attaching stream to video element:', stream.id);
    el.srcObject = stream;
    el.muted = true;
    el.autoplay = true;
    el.playsInline = true;
    el.play().catch(err => logger.error('[VIDEO DEBUG] Play error:', err));
  };

  // Callback ref to attach video stream immediately when element mounts
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    // Use ref for stream as state may be stale in callback
    const currentStream = videoStreamRef.current;
    if (el && currentStream && isStreamAlive(currentStream) && streamAttachedRef.current !== currentStream.id) {
      logger.proctoring('[VIDEO DEBUG] Callback ref - attaching live stream:', currentStream.id);
      streamAttachedRef.current = currentStream.id;
      attachStreamToVideo(el, currentStream);
    }
  };

  // Attach stream when both video element AND stream are ready
  useEffect(() => {
    if (!videoRef.current || !started) return;
    
    // Use ref for most current stream value
    const currentStream = videoStreamRef.current;
    if (!currentStream) return;
    
    // Skip if same stream already attached
    if (streamAttachedRef.current === currentStream.id) return;
    
    // Validate stream is actually alive
    if (!isStreamAlive(currentStream)) {
      logger.error('[VIDEO DEBUG] Stream is not alive!', {
        active: currentStream.active,
        tracks: currentStream.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState }))
      });
      // Attempt reconnection via the proctoring hook
      return;
    }
    
    logger.proctoring('[VIDEO DEBUG] Attaching live stream in useEffect:', currentStream.id);
    streamAttachedRef.current = currentStream.id;
    attachStreamToVideo(videoRef.current, currentStream);
  }, [videoStream?.id, started]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      logger.proctoring('TakeInterview component unmounting - cleaning up media elements and refs only (streams owned by proctoring)');

      // Clear bandwidth and performance monitoring
      if (bandwidthCheckInterval.current) {
        clearInterval(bandwidthCheckInterval.current);
      }
      if (performanceCheckInterval.current) {
        clearInterval(performanceCheckInterval.current);
      }

      // Clear video element without stopping underlying tracks –
      // proctoring hook (useProctoring.stopRecording) owns stream lifecycle
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Do NOT stop media tracks here. This was killing the live stream
      // between pre-checks and main interview when React remounted
      // TakeInterview, causing black screen / OverconstrainedError.
      // Streams are now cleaned up exclusively by the proctoring flow.

      // Just clear refs so GC can reclaim if proctoring has already stopped them
      videoStreamRef.current = null;
      screenStreamRef.current = null;
    };
  }, []);

  // Fetch questions when attempt starts
  useEffect(() => {
    const loadQuestions = async () => {
      if (started && interview && attemptId && questions.length === 0) {
        setLoadingQuestions(true);
        try {
          logger.proctoring('Loading questions for attempt:', attemptId);
          logger.proctoring('Interview ID:', interview.id);
          logger.proctoring('Question count needed:', interview.question_count);
          
          const { data: questionsData, error: questionsError } = await supabase
            .rpc('get_questions_for_attempt', { 
              p_attempt_id: attemptId 
            });

          logger.proctoring('Questions response:', { questionsData, questionsError });

          if (questionsError) {
            logger.error('Error loading questions:', questionsError);
            const errorMsg = questionsError.message || "Failed to load interview questions.";
            setQuestionLoadError(errorMsg);
            errorToast(errorMsg, "Error Loading Questions");
            setLoadingQuestions(false);
            return;
          }

          if (!questionsData || questionsData.length === 0) {
            logger.error('No questions returned from database');
            const errorMsg = "No questions available for this interview. Please contact the interview creator or Support@talentgeenie.com.";
            setQuestionLoadError(errorMsg);
            errorToast(errorMsg, "No Questions Found");
            setLoadingQuestions(false);
            return;
          }

          logger.proctoring(`Successfully loaded ${questionsData.length} questions for interview`);
          setQuestions(questionsData);
          setLoadingQuestions(false);
        } catch (error) {
          logger.error('Unexpected error loading questions:', error);
          const errorMsg = "An unexpected error occurred while loading questions.";
          setQuestionLoadError(errorMsg);
          errorToast(errorMsg, "Error");
          setLoadingQuestions(false);
        }
      }
    };

    loadQuestions();
  }, [started, interview, attemptId]);

  // Use refs for stable callbacks to avoid stale closures
  const submittingRef = useRef(submitting);
  const submitInterviewRef = useRef<(() => void) | null>(null);
  const answersRef = useRef(answers);
  const timeElapsedRef = useRef(timeElapsed);
  
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timeElapsedRef.current = timeElapsed;
  }, [timeElapsed]);

  useEffect(() => {
    if (started && interview?.time_limit) {
      const totalSeconds = interview.time_limit * 60;
      
      // Track which warnings we've shown to avoid duplicates
      const warningsShown = { fiveMin: false, oneMin: false };
      
      const timer = setInterval(() => {
        setTimeElapsed(prev => {
          const newElapsed = prev + 1;
          const remaining = totalSeconds - newElapsed;
          setTimeRemaining(remaining);
          
          // Warning at 5 minutes remaining
          if (remaining === 300 && !warningsShown.fiveMin) {
            warningsShown.fiveMin = true;
            toast({
              title: "⏰ 5 Minutes Remaining",
              description: "You have 5 minutes left to complete your interview. Please review your answers.",
              variant: "default",
            });
          }
          
          // Warning at 1 minute remaining
          if (remaining === 60 && !warningsShown.oneMin) {
            warningsShown.oneMin = true;
            toast({
              title: "⚠️ 1 Minute Remaining!",
              description: "Your interview will be auto-submitted in 1 minute. Finish up now!",
              variant: "destructive",
            });
          }
          
          // Auto-submit when time expires
          if (remaining <= 0 && !submittingRef.current) {
            logger.proctoring('[TakeInterview] Time expired, showing blocking overlay and auto-submitting...');
            // IMMEDIATELY show blocking overlay to prevent further interaction
            setTimeExpired(true);
            // Use setTimeout to avoid state updates during render
            setTimeout(() => {
              if (submitInterviewRef.current && !submittingRef.current) {
                submitInterviewRef.current();
              }
            }, 0);
          }
          
          return newElapsed;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    } else if (started) {
      // No time limit - just track elapsed time
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [started, interview?.time_limit]);

  // Handle page close/refresh during actual interview - auto-submit with terminated status
  // IMPORTANT: Only auto-submit on actual page unload, NOT on tab switch (visibilitychange)
  useEffect(() => {
    if (!started || !attemptId || !sessionToken) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Show warning to user
      e.preventDefault();
      e.returnValue = 'Your interview is in progress. If you leave, your answers will be auto-submitted.';
      return e.returnValue;
    };

    // Only use pagehide for actual page close/navigation, NOT visibilitychange (which fires on tab switch)
    const handlePageHide = (e: PageTransitionEvent) => {
      // Only auto-submit if page is being unloaded (not persisted in bfcache)
      // This prevents auto-submit on simple tab switches
      if (e.persisted) return;
      
      logger.proctoring('[TakeInterview] Page hide detected, auto-submitting with terminated status...');
      
      try {
        // Use refs for current values to avoid stale closures
        const currentAnswers = answersRef.current;
        const currentTimeElapsed = timeElapsedRef.current;
        
        const answersJson = JSON.stringify(
          Object.fromEntries(
            Object.entries(currentAnswers).map(([questionId, answer]) => [
              questionId,
              { answer, timestamp: Date.now() }
            ])
          )
        );

        // Use fetch with keepalive for reliable submission - set status to terminated
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/terminate_attempt_with_session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            token: sessionToken,
            attempt_answers: answersJson,
            seconds_taken: currentTimeElapsed,
          }),
          keepalive: true,
        }).catch(err => logger.error('Auto-submit (terminated) failed:', err));
      } catch (error) {
        logger.error('Error preparing auto-submit:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [started, attemptId, sessionToken, answers, timeElapsed]);

  const fetchInterview = async () => {
    if (interview && questions.length > 0) return; // Already loaded
    
    try {
      logger.proctoring("Fetching interview with share token:", shareToken);
      
      // Use secure function that limits data exposure to candidates
      const { data: interviewData, error: interviewError } = await supabase
        .rpc('get_interview_for_candidate' as any, { share_link_param: shareToken });

      logger.proctoring("Interview data:", interviewData, "Error:", interviewError);

      if (interviewError || !interviewData || interviewData.length === 0) {
        toast({
          title: "Interview Not Found",
          description: getInterviewErrorMessage(interviewError || { message: 'interview not found' }),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const interviewRecord = interviewData[0];
      logger.proctoring("Interview found:", interviewRecord.id, interviewRecord.title);

      setInterview(interviewRecord);
      
      // Don't fetch questions yet - wait until attempt is created
      setLoading(false);
      logger.proctoring("Interview setup complete");
    } catch (error) {
      logger.error("Unexpected error in fetchInterview:", error);
      toast({
        title: "Error",
        description: getInterviewErrorMessage(error),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!interview) {
      toast({
        title: "Error",
        description: "No interview configuration found for this link",
        variant: "destructive",
      });
      return;
    }

    // If this came from an invitation link, ensure the email matches
    if (invitation) {
      if (candidateEmail.toLowerCase().trim() !== invitation.candidate_email.toLowerCase().trim()) {
        toast({
          title: "Email Mismatch",
          description: "The email you entered doesn't match the invitation. Please use the email address that received this invitation.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate candidate info with Zod
    const validationResult = candidateInfoSchema.safeParse({
      candidateName: candidateName.trim(),
      candidateEmail: candidateEmail.trim(),
    });

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => e.message).join(', ');
      toast({
        title: "Validation Error",
        description: errors,
        variant: "destructive",
      });
      return;
    }

    // Store candidate info - DO NOT create attempt yet (Option B)
    // Attempt will be created after screen sharing is confirmed
    setCandidateInfo({ name: candidateName, email: candidateEmail });
    
    // Check if proctoring is enabled for this interview
    if (interview.proctoring_enabled) {
      setShowProctoringSetup(true);
      setProctoringChecksComplete(false);
    } else {
      // For non-proctored interviews, create attempt immediately
      await createAttemptAndStart();
    }
  };

  // Create attempt and start interview (called after proctoring setup or for non-proctored)
  const createAttemptAndStart = async (): Promise<{ attemptId: string; sessionToken: string; isResumed?: boolean } | null> => {
    try {
      let rpcName: string;
      let rpcArgs: any;

      if (invitation) {
        rpcName = 'create_interview_attempt_with_invitation';
        rpcArgs = {
          p_invitation_id: invitation.id,
          p_candidate_name: candidateName,
          p_candidate_email: candidateEmail,
        };
      } else {
        rpcName = 'create_interview_attempt';
        rpcArgs = {
          p_interview_id: interview.id,
          p_candidate_name: candidateName,
          p_candidate_email: candidateEmail,
        };
      }

      const { data, error } = await supabase.rpc(rpcName as any, rpcArgs);

      if (error) throw error;

      const result = data[0];
      
      if (!result.success) {
        errorToast(result.error_message, "Cannot Start Interview");
        return null;
      }

      setAttemptId(result.attempt_id);
      setSessionToken(result.session_token);
      
      // Track if this is a resumed session (browser was closed and candidate came back)
      const isResumed = result.is_resumed === true;
      setIsResumedSession(isResumed);
      
      if (isResumed) {
        logger.proctoring('[TakeInterview] Session RESUMED - candidate returned to in_progress attempt');
      }
      
      // Log invitation accepted (attempt created successfully)
      startOperation({
        operation: isResumed ? 'session_resumed' : 'invitation_accepted',
        interviewId: interview.id,
        attemptId: result.attempt_id,
        invitationId: invitation?.id,
        candidateEmail: candidateEmail,
        metadata: { candidateName, isInvitationBased: !!invitation, isResumed }
      });
      
      // Initialize time remaining if time limit is set
      if (interview.time_limit) {
        setTimeRemaining(interview.time_limit * 60);
      }

      // For non-proctored interviews, start immediately
      if (!interview.proctoring_enabled) {
        setStarted(true);
        // Mark started_at for server-side deadline enforcement (fire and forget)
        markInterviewStarted(result.attempt_id, result.session_token);
      }

      return { attemptId: result.attempt_id, sessionToken: result.session_token, isResumed };
    } catch (error: any) {
      logger.error("Error creating attempt:", error);
      toast({
        title: "Error Starting Interview",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  // Mark interview as started (sets started_at for server-side deadline enforcement)
  const markInterviewStarted = async (attemptIdToMark: string, sessionTokenToUse: string) => {
    try {
      logger.proctoring('[TakeInterview] Marking interview as started for deadline tracking...');
      const { error } = await supabase
        .from('interview_attempts')
        .update({ 
          started_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', attemptIdToMark)
        .eq('session_token', sessionTokenToUse);
      
      if (error) {
        logger.warn('[TakeInterview] Failed to mark started_at (non-critical):', error);
      } else {
        logger.proctoring('[TakeInterview] Interview started_at marked successfully');
      }
    } catch (err) {
      logger.warn('[TakeInterview] Error marking started_at (non-critical):', err);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    // Use functional update to avoid stale closure issues
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitInterview = async () => {
    setSubmitting(true);
    
    // Start operation logging
    const logId = await startOperation({
      operation: 'submission',
      interviewId: interview?.id,
      attemptId: attemptId || undefined,
      candidateEmail: candidateEmail || candidateInfo?.email,
      metadata: { questionCount: Object.keys(answers).length, timeElapsed }
    });
    
    // IMMEDIATELY show preparing overlay to keep candidate engaged
    if (interview?.proctoring_enabled && proctoringComplete) {
      setShowUploadProgress(true);
      setIsPreparingUpload(true);
    }

    try {
      logger.proctoring("[SUBMIT] Starting submission", { attemptId, hasToken: !!sessionToken, answers: Object.keys(answers).length });
      
      // Validate required state
      if (!sessionToken || !attemptId) {
        throw new Error("Interview session not properly initialized. Please refresh and try again.");
      }

      // Prepare answers
      const answersJson = Object.entries(answers).reduce((acc, [qId, ans]) => {
        acc[qId] = ans;
        return acc;
      }, {} as Record<string, string>);

      // Submit via RPC
      const { data, error } = await supabase.rpc('update_attempt_with_session', {
        token: sessionToken,
        attempt_answers: answersJson,
        seconds_taken: timeElapsed,
      });

      if (error) {
        logger.error("[SUBMIT] RPC error:", error);
        // Even on RPC error, check if attempt was already submitted
        const { data: statusCheck } = await supabase
          .from('interview_attempts')
          .select('status')
          .eq('id', attemptId)
          .maybeSingle();
        
        // Check for any post-submission status (including pending_upload for proctored)
        if (statusCheck?.status === 'pending_upload' || statusCheck?.status === 'submitted' || statusCheck?.status === 'evaluated') {
          logger.proctoring("[SUBMIT] Already submitted/pending despite RPC error, redirecting");
          if (logId) completeOperation({ logId, status: 'completed', metadata: { alreadySubmitted: true } });
          await finalizeAndNavigate(attemptId);
          return;
        }
        throw new Error("Failed to submit interview. Please try again.");
      }

      const result = Array.isArray(data) ? data[0] : data;
      logger.proctoring("[SUBMIT] RPC result:", result);

      // Success case - RPC returned success=true
      if (result?.success) {
        // Log success
        if (logId) {
          completeOperation({ logId, status: 'completed' });
        }
        
        // Trigger auto-evaluation for non-proctored interviews (fire and forget)
        // For proctored interviews, evaluation is triggered after video upload completes
        if (!interview?.proctoring_enabled) {
          invokeFunction('auto-evaluate-trigger', {
            body: { attemptId: result.attempt_id }
          }).catch(err => {
            logger.error("[SUBMIT] Auto-evaluate trigger failed (non-critical):", err);
          });
        }
        
        await finalizeAndNavigate(result.attempt_id);
        return;
      }

      // RPC returned false - likely already submitted or completed
      // First check using attempt_id from result, fallback to local attemptId
      const checkAttemptId = result?.attempt_id || attemptId;
      
      const { data: statusCheck, error: statusError } = await supabase
        .from('interview_attempts')
        .select('status')
        .eq('id', checkAttemptId)
        .maybeSingle();

      logger.proctoring("[SUBMIT] Status check result:", { checkAttemptId, statusCheck, statusError });

      // If already submitted/evaluated/pending_upload, redirect to completion page
      if (statusCheck?.status === 'pending_upload' || statusCheck?.status === 'submitted' || statusCheck?.status === 'evaluated') {
        logger.proctoring("[SUBMIT] Already in post-submission state, redirecting");
        if (logId) completeOperation({ logId, status: 'completed', metadata: { alreadySubmitted: true } });
        await finalizeAndNavigate(checkAttemptId);
        return;
      }

      // If status check failed or status is unexpected, show appropriate error
      if (statusError) {
        logger.error("[SUBMIT] Status check failed:", statusError);
        throw new Error("Could not verify submission status. Please try again.");
      }

      // Status is still in_progress but RPC failed - this shouldn't happen
      if (statusCheck?.status === 'in_progress') {
        throw new Error("Submission failed. Please try again.");
      }

      throw new Error("Unable to submit interview. Please refresh and try again.");
      
    } catch (error: any) {
      logger.error("[SUBMIT] Error:", error);
      
      // Log failure with user-friendly error
      const friendlyError = getUserFriendlyError(error.message || 'SUBMISSION_FAILED');
      if (logId) {
        completeOperation({ 
          logId, 
          status: 'failed',
          errorCode: 'SUBMISSION_FAILED',
          errorMessage: friendlyError,
          errorDetails: { originalError: error.message }
        });
      }
      
      errorToast(friendlyError, "Submission Failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Assign submitInterview to ref for use in timer callback
  useEffect(() => {
    submitInterviewRef.current = submitInterview;
  }, [submitInterview]);

  // Helper to finalize proctoring and navigate
  // HYBRID FLOW: Queue uploads, then navigate immediately to Complete page
  // Upload continues in background with progress visible on Complete page
  const finalizeAndNavigate = async (navAttemptId: string) => {
    logger.proctoring('!!! FINALIZE AND NAVIGATE CALLED (HYBRID FLOW) !!!');
    logger.proctoring('[SUBMIT] Finalizing proctoring...', {
      proctoringComplete,
      proctoringEnabled: interview?.proctoring_enabled,
      hasFinalizeRef: !!proctoringFinalizeRef.current,
      sessionToken: sessionToken ? 'EXISTS' : 'NULL',
    });
    
    if (proctoringComplete && interview?.proctoring_enabled && proctoringFinalizeRef.current) {
      try {
        logger.proctoring('!!! CALLING proctoringFinalizeRef.current NOW !!!');
        
        // CRITICAL: Set uploading state so TimesUpOverlay shows progress
        setIsUploadingRecordings(true);
        
        // With chunked uploads, this now waits for merge to complete before returning
        // So recordings are available immediately for evaluation
        const uploadResult = await proctoringFinalizeRef.current(sessionToken || undefined);
        
        logger.proctoring('!!! PROCTORING FINALIZATION COMPLETE !!!', uploadResult);
        
        // Log what was queued for debugging
        if (uploadResult) {
          logger.proctoring('╔══════════════════════════════════════════════════════════════╗');
          logger.proctoring('║  UPLOAD QUEUE STATUS:                                        ║');
          logger.proctoring(`║  Video: ${uploadResult.videoQueued ? '✅ QUEUED' : '❌ NOT QUEUED'} (had chunks: ${uploadResult.videoHadChunks})          ║`);
          logger.proctoring(`║  Screen: ${uploadResult.screenQueued ? '✅ QUEUED' : '❌ NOT QUEUED'} (had chunks: ${uploadResult.screenHadChunks})         ║`);
          logger.proctoring('╚══════════════════════════════════════════════════════════════╝');
          
          // CRITICAL: With chunked uploads, recordings are already merged and available
          // Trigger evaluation immediately since we don't need to wait for background upload
          if (uploadResult.videoQueued || uploadResult.screenQueued) {
            logger.proctoring('[SUBMIT] Chunked upload complete - triggering evaluation immediately');
            invokeFunction('auto-evaluate-trigger', {
              body: { attemptId: navAttemptId, includeVideoAnalysis: true }
            }).catch(err => {
              logger.error("[SUBMIT] Auto-evaluate trigger failed (non-critical):", err);
            });
          }
        }
        
        // HYBRID FLOW: Hide overlay and navigate immediately
        // With chunked uploads, we no longer need to show upload progress on Complete page
        setShowUploadProgress(false);
        setIsPreparingUpload(false);
        setIsUploadingRecordings(false);
        
        // Navigate - set hasActiveUploads=false since chunked upload is already complete
        const hasQueuedUploads = false; // Chunked uploads are synchronous now
        cleanupAndNavigate(navAttemptId, hasQueuedUploads);
        
      } catch (err) {
        logger.error('!!! PROCTORING FINALIZATION ERROR !!!', err);
        // Still navigate on error
        setShowUploadProgress(false);
        setIsPreparingUpload(false);
        setIsUploadingRecordings(false);
        cleanupAndNavigate(navAttemptId, false);
      }
    } else {
      logger.proctoring('[SUBMIT] Non-proctored interview - navigating directly');
      // Non-proctored interviews navigate immediately
      cleanupAndNavigate(navAttemptId, false);
    }
  };

  // Handle upload completion - finalize submission to trigger evaluation with videos
  const handleUploadComplete = async () => {
    setShowUploadProgress(false);
    
    if (attemptId && sessionToken) {
      logger.proctoring('[UPLOAD COMPLETE] Finalizing proctored submission for attempt:', attemptId);
      
      try {
        // Finalize the submission - this moves status from pending_upload -> submitted
        const { data, error } = await supabase.rpc('finalize_proctored_submission', {
          p_session_token: sessionToken
        });
        
        if (error) {
          logger.error('[UPLOAD COMPLETE] Finalization RPC error:', error);
        } else {
          const result = Array.isArray(data) ? data[0] : data;
          logger.proctoring('[UPLOAD COMPLETE] Finalization result:', result);
          
          // Trigger auto-evaluation for proctored interviews with video analysis
          if (result?.success && attemptId) {
            invokeFunction('auto-evaluate-trigger', {
              body: { attemptId, includeVideoAnalysis: true }
            }).catch(err => {
              logger.error("[UPLOAD COMPLETE] Auto-evaluate trigger failed (non-critical):", err);
            });
          }
        }
      } catch (err) {
        logger.error('[UPLOAD COMPLETE] Error finalizing submission:', err);
      }
      
      cleanupAndNavigate(attemptId);
    } else {
      // Fallback if no sessionToken - just navigate
      if (attemptId) {
        cleanupAndNavigate(attemptId);
      }
    }
  };

  // Handle upload timeout - still finalize to trigger evaluation (uploads continue in background)
  const handleUploadTimeout = async () => {
    setShowUploadProgress(false);
    
    if (attemptId && sessionToken) {
      logger.proctoring('[UPLOAD TIMEOUT] Finalizing proctored submission despite timeout for attempt:', attemptId);
      
      try {
        // Still finalize - this moves to submitted and triggers evaluation
        // Videos may complete uploading later and can be used for re-evaluation
        const { data, error } = await supabase.rpc('finalize_proctored_submission', {
          p_session_token: sessionToken
        });
        
        if (error) {
          logger.error('[UPLOAD TIMEOUT] Finalization RPC error:', error);
        } else {
          const result = Array.isArray(data) ? data[0] : data;
          logger.proctoring('[UPLOAD TIMEOUT] Finalization result:', result);
          
          // Trigger auto-evaluation even on timeout (video analysis may not be available)
          if (result?.success && attemptId) {
            invokeFunction('auto-evaluate-trigger', {
              body: { attemptId, includeVideoAnalysis: false }
            }).catch(err => {
              logger.error("[UPLOAD TIMEOUT] Auto-evaluate trigger failed (non-critical):", err);
            });
          }
        }
      } catch (err) {
        logger.error('[UPLOAD TIMEOUT] Error finalizing submission:', err);
      }
      
      toast({
        title: "Interview Submitted",
        description: "Your recordings are still uploading. They will be processed once complete.",
      });
      
      cleanupAndNavigate(attemptId, true); // Has active uploads
    } else if (attemptId) {
      cleanupAndNavigate(attemptId, false);
    }
  };

  // Helper function to navigate (streams should already be stopped by stopRecording)
  // hasActiveUploads: If true, Complete page will show upload progress
  const cleanupAndNavigate = (navAttemptId: string, hasActiveUploads: boolean = false) => {
    // SAFETY NET: Stop any remaining active streams as a fallback
    // This handles edge cases where stopRecording may not have executed fully
    const streamsToCleanup = [
      videoStreamRef.current,
      screenStreamRef.current,
      videoStream,
      screenStream
    ].filter(Boolean);
    
    for (const stream of streamsToCleanup) {
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            logger.proctoring(`[cleanupAndNavigate] Safety cleanup - stopping track: ${track.kind}`);
            track.stop();
          }
        });
      }
    }
    
    // Clear both refs and state references
    videoStreamRef.current = null;
    screenStreamRef.current = null;
    setVideoStream(null);
    setScreenStream(null);

    toast({
      title: "Interview Submitted",
      description: hasActiveUploads 
        ? "Your responses have been submitted. Recording is being uploaded..." 
        : "Your responses are being evaluated.",
    });

    // Navigate with state including upload status
    navigate(`/interview-complete/${navAttemptId}`, {
      state: {
        sessionToken,
        attemptId: navAttemptId,
        hasActiveUploads, // Tell Complete page to show upload progress
      }
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get video constraints based on quality setting - adaptive bitrate with granular frame rates
  const getVideoConstraints = (quality: 'high' | 'medium' | 'low', adaptive = false) => {
    // Base constraints
    const constraints = {
      high: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
      medium: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 24 } },
      low: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 } }
    };
    
    // If adaptive and performance is poor, reduce frame rate further
    if (adaptive && videoPerformance.totalFrames > 0) {
      const dropRate = videoPerformance.droppedFrames / videoPerformance.totalFrames;
      if (dropRate > 0.1) { // If dropping more than 10% of frames
        const selectedConstraints = constraints[quality];
        const reducedFrameRate = Math.max(10, Math.floor(selectedConstraints.frameRate.ideal * 0.7));
        return {
          video: {
            ...selectedConstraints,
            frameRate: { ideal: reducedFrameRate, max: reducedFrameRate },
            facingMode: 'user'
          }
        };
      }
    }
    
    return {
      video: {
        ...constraints[quality],
        facingMode: 'user'
      }
    };
  };

  // Reconnect video stream
  const reconnectVideo = async () => {
    if (isReconnecting) return;
    
    setIsReconnecting(true);
    logger.proctoring('[VIDEO RECONNECT] Starting reconnection...');

    try {
      // Stop old stream FIRST to release camera - use ref for reliability
      const oldStream = videoStreamRef.current || videoStream;
      if (oldStream) {
        logger.proctoring('[VIDEO RECONNECT] Stopping old stream...');
        oldStream.getTracks().forEach(track => {
          track.stop();
          logger.proctoring('[VIDEO RECONNECT] Stopped old track:', track.label);
        });
        videoStreamRef.current = null;
        setVideoStream(null);
      }

      // Wait for camera to be fully released
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Now request new stream with current quality settings
      logger.proctoring('[VIDEO RECONNECT] Requesting new stream with quality:', videoQuality);
      const constraints = getVideoConstraints(videoQuality);
      const newVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      logger.proctoring('[VIDEO RECONNECT] New stream obtained:', {
        active: newVideoStream.active,
        tracks: newVideoStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
      });

      // CRITICAL: Update ref FIRST (synchronous), then state
      videoStreamRef.current = newVideoStream;
      setVideoStream(newVideoStream);
      
      // Update video element
      setTimeout(() => {
        if (videoRef.current) {
          logger.proctoring('[VIDEO RECONNECT] Updating video element');
          videoRef.current.srcObject = newVideoStream;
          videoRef.current.play()
            .then(() => logger.proctoring('[VIDEO RECONNECT] Video playing successfully'))
            .catch(err => logger.error('[VIDEO RECONNECT] Play error:', err));
        }
      }, 100);

      toast({
        title: "Camera Reconnected",
        description: "Video feed and proctoring have been restored.",
      });
    } catch (error) {
      logger.error('[VIDEO RECONNECT] Error:', error);
      toast({
        title: "Reconnection Failed",
        description: "Unable to restart camera. Please check your camera permissions.",
        variant: "destructive",
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  // Track if quality change is in progress to prevent health check conflicts
  const qualityChangeInProgressRef = useRef(false);

  // Change video quality using applyConstraints (keeps MediaRecorder attached)
  const changeVideoQuality = async (quality: 'high' | 'medium' | 'low', adaptive = false) => {
    logger.proctoring('[VIDEO QUALITY] Changing quality to:', quality, 'adaptive:', adaptive);
    setVideoQuality(quality);
    
    // Use applyConstraints to change quality WITHOUT destroying the stream
    // This keeps the MediaRecorder attached and recording
    if (videoStream && started) {
      qualityChangeInProgressRef.current = true;
      
      try {
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) {
          logger.warn('[VIDEO QUALITY] No video track found');
          return;
        }

        // Get new constraints for the quality level
        const constraints = getVideoConstraints(quality, adaptive);
        const videoConstraints = constraints.video as MediaTrackConstraints;
        
        logger.proctoring('[VIDEO QUALITY] Applying constraints:', videoConstraints);
        
        // Apply new constraints to existing track (keeps MediaRecorder attached)
        await videoTrack.applyConstraints(videoConstraints);
        
        logger.proctoring('[VIDEO QUALITY] Quality changed successfully via applyConstraints');
        
        // Update video element display (stream is the same, just quality changed)
        if (videoRef.current) {
          // Force video element to recognize the change
          videoRef.current.srcObject = videoStream;
        }
      } catch (error) {
        logger.error('[VIDEO QUALITY] Error applying constraints:', error);
        // If applyConstraints fails, the stream is still valid - just log the error
        // Don't destroy the stream as that would break recording
      } finally {
        qualityChangeInProgressRef.current = false;
      }
    }
  };

  // Monitor network quality and video performance, adjust quality automatically
  useEffect(() => {
    if (!started || !videoStream || !autoQualityEnabled) return;

    logger.proctoring('[MONITORING] Starting automatic quality monitoring');

    // Monitor actual video performance (dropped frames)
    const monitorVideoPerformance = () => {
      if (!videoRef.current) return;
      
      const video = videoRef.current as any;
      
      // Check if the browser supports quality stats
      if ('getVideoPlaybackQuality' in video) {
        const quality = video.getVideoPlaybackQuality();
        const currentDropped = quality.droppedVideoFrames || 0;
        const currentTotal = quality.totalVideoFrames || 0;
        
        // Calculate dropped frames since last check
        const droppedSinceLast = currentDropped - lastFrameCheck.current.droppedFrames;
        const totalSinceLast = currentTotal - lastFrameCheck.current.totalFrames;
        
        if (totalSinceLast > 0) {
          const dropRate = droppedSinceLast / totalSinceLast;
          logger.proctoring('[PERFORMANCE] Drop rate:', (dropRate * 100).toFixed(2) + '%', 
                      'Dropped:', droppedSinceLast, 'Total:', totalSinceLast);
          
          // Update performance state
          setVideoPerformance({ 
            droppedFrames: currentDropped, 
            totalFrames: currentTotal 
          });
          
          // If dropping too many frames, reduce quality
          if (dropRate > 0.15 && videoQuality !== 'low') {
            const newQuality = videoQuality === 'high' ? 'medium' : 'low';
            logger.proctoring('[PERFORMANCE] Too many dropped frames, reducing quality to:', newQuality);
            
            toast({
              title: "Optimizing Performance",
              description: `Reducing quality to ${newQuality} for smoother playback.`,
            });
            
            changeVideoQuality(newQuality, true); // Use adaptive mode
          }
        }
        
        // Update last check
        lastFrameCheck.current = {
          droppedFrames: currentDropped,
          totalFrames: currentTotal,
          timestamp: Date.now()
        };
      }
    };

    // Check network connection type if available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    const checkNetworkQuality = () => {
      let detectedQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
      let recommendedVideoQuality: 'high' | 'medium' | 'low' = videoQuality;

      // Use Network Information API if available
      if (connection) {
        const effectiveType = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
        const downlink = connection.downlink; // Mbps
        const rtt = connection.rtt; // Round trip time in ms

        logger.proctoring('[BANDWIDTH] Network info:', { effectiveType, downlink, rtt });

        // Determine network quality based on metrics
        if (effectiveType === '4g' && downlink > 5 && rtt < 100) {
          detectedQuality = 'excellent';
          recommendedVideoQuality = 'high';
        } else if (effectiveType === '4g' || (effectiveType === '3g' && downlink > 2)) {
          detectedQuality = 'good';
          recommendedVideoQuality = 'medium';
        } else if (effectiveType === '3g' || downlink > 0.5) {
          detectedQuality = 'fair';
          recommendedVideoQuality = 'low';
        } else {
          detectedQuality = 'poor';
          recommendedVideoQuality = 'low';
        }
      } else {
        // Fallback: Monitor video element performance
        if (videoRef.current) {
          const video = videoRef.current;
          
          // Check if video is lagging
          if (video.readyState < 3) { // HAVE_FUTURE_DATA
            detectedQuality = 'fair';
            recommendedVideoQuality = 'low';
          }
        }
      }

      // Update network quality display
      if (networkQuality !== detectedQuality) {
        logger.proctoring('[BANDWIDTH] Network quality changed:', networkQuality, '->', detectedQuality);
        setNetworkQuality(detectedQuality);
      }

      // Auto-adjust video quality if needed (but only if performance monitoring hasn't already adjusted)
      if (autoQualityEnabled && recommendedVideoQuality !== videoQuality) {
        const performanceDropRate = videoPerformance.totalFrames > 0 
          ? videoPerformance.droppedFrames / videoPerformance.totalFrames 
          : 0;
        
        // Only adjust based on network if performance is OK
        if (performanceDropRate < 0.1) {
          logger.proctoring('[BANDWIDTH] Auto-adjusting video quality:', videoQuality, '->', recommendedVideoQuality);
          // Silently adjust quality without showing toast to avoid distracting candidates
          changeVideoQuality(recommendedVideoQuality, true);
        }
      }
    };

    // Run network check every 10 seconds
    checkNetworkQuality();
    bandwidthCheckInterval.current = setInterval(checkNetworkQuality, 10000);
    
    // Run performance check every 5 seconds
    monitorVideoPerformance();
    performanceCheckInterval.current = setInterval(monitorVideoPerformance, 5000);

    return () => {
      if (bandwidthCheckInterval.current) {
        clearInterval(bandwidthCheckInterval.current);
      }
      if (performanceCheckInterval.current) {
        clearInterval(performanceCheckInterval.current);
      }
    };
  }, [started, videoStream, autoQualityEnabled, videoQuality, networkQuality, videoPerformance]);

  const detectCodeLanguage = (questionText: string, topic: string): "sql" | "python" | "javascript" | "java" | "typescript" | "go" => {
    const text = (questionText + " " + topic).toLowerCase();
    
    // Priority 1: Check for explicit programming language mentions first
    // Java-specific (before javascript check) - check for Java frameworks/keywords
    if ((text.includes('java') && !text.includes('javascript')) || 
        text.includes('spring') || text.includes('jpa') || text.includes('hibernate') ||
        text.includes('maven') || text.includes('gradle') || text.includes('junit')) {
      return 'java';
    }

    // Angular is TypeScript in practice
    if (text.includes('angular') || text.includes('rxjs') || text.includes('ngrx')) {
      return 'typescript';
    }

    // TypeScript-specific
    if (text.includes('typescript') || text.includes(' ts ')) {
      return 'typescript';
    }
    // Python-specific
    if (text.includes('python') || text.includes('pandas') || text.includes('numpy') || 
        text.includes('django') || text.includes('flask') || text.includes('fastapi')) {
      return 'python';
    }
    // Go-specific
    if (text.includes('golang') || text.includes(' go ') || text.includes('goroutine')) {
      return 'go';
    }
    // JavaScript-specific (React, Vue, Node, etc.)
    if (text.includes('javascript') || text.includes('js') || text.includes('node') ||
        text.includes('react') || text.includes('vue') ||
        text.includes('next.js') || text.includes('express')) {
      return 'javascript';
    }
    
    // Priority 2: SQL-specific - only if no other language detected and explicitly SQL-focused
    // Avoid matching just "database" or "query" as these can be in any language context
    if (text.includes('sql') || (text.includes('query') && text.includes('select') && !text.includes('repository'))) {
      return 'sql';
    }
    
    // Default to javascript for general coding questions
    return 'javascript';
  };

  logger.proctoring('[TakeInterview] Render state:', { loading, interview: !!interview, candidateInfo: !!candidateInfo, invitationError });
  
  if (loading) {
    logger.proctoring('[TakeInterview] Showing loading screen');
    return <div className="min-h-screen flex items-center justify-center">Loading interview...</div>;
  }

  if (!interview) {
    // Show the actual error message if available, otherwise generic message
    const errorMessage = invitationError || "This interview link is invalid or has expired.";
    const isNetworkError = invitationError?.toLowerCase().includes('connect') || 
                           invitationError?.toLowerCase().includes('server') ||
                           invitationError?.toLowerCase().includes('internet');
    
    const handleRetry = () => {
      setLoading(true);
      setInvitationError(null);
      fetchInvitationAndInterview();
    };
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-xl">
              {invitationError?.includes('expired') ? 'Invitation Expired' : 
               invitationError?.includes('already been taken') ? 'Interview Completed' :
               isNetworkError ? 'Connection Issue' : 'Interview Not Found'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isNetworkError && (
              <Button 
                onClick={handleRetry} 
                className="w-full"
                variant="default"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
            <p className="text-sm text-muted-foreground text-center">
              If you continue to experience issues, please contact{' '}
              <a href="mailto:Support@talentgeenie.com" className="text-primary hover:underline">
                Support@talentgeenie.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!candidateInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Brain className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">{interview.title}</CardTitle>
            <CardDescription className="text-base mt-4">
              Please provide your details to begin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{interview.question_count}</p>
                <p className="text-sm text-muted-foreground">Questions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">
                  {interview.time_limit ? `${interview.time_limit} min` : 'No Limit'}
                </p>
                <p className="text-sm text-muted-foreground">Time Limit</p>
              </div>
            </div>

            <form onSubmit={handleStartInterview} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Start Interview
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper components for different states
  const renderErrorScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <CardTitle className="text-destructive">Unable to Load Questions</CardTitle>
          <CardDescription>{questionLoadError}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => {
              setQuestionLoadError(null);
              setStarted(false);
              setAttemptId(null);
              setSessionToken(null);
            }}
            className="w-full"
          >
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderLoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto animate-pulse">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <p className="text-lg font-medium">Loading your questions...</p>
        <p className="text-sm text-muted-foreground">This should only take a moment</p>
      </div>
    </div>
  );

  // Proctoring setup phase
  const renderProctoringSetup = () => (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PreInterviewChecks
          attemptType="interview"
          invitationId={invitation?.id}
          interviewId={interview?.id}
          candidateEmail={candidateEmail || invitation?.candidate_email}
          candidateName={candidateName || invitation?.candidate_name}
          onCreateAttempt={createAttemptAndStart}
          onComplete={async (sessionId, video, screen, recommendedQuality, newAttemptId, newSessionToken) => {
            // ===== STREAM HANDOFF DIAGNOSTIC LOGGING =====
            logger.proctoring('==========================================');
            logger.proctoring('[STREAM HANDOFF] onComplete callback START');
            logger.proctoring('[STREAM HANDOFF] Received video stream:', video ? video.id : 'NULL');
            logger.proctoring('[STREAM HANDOFF] Received screen stream:', screen ? screen.id : 'NULL');
            
            if (video) {
              logger.proctoring('[STREAM HANDOFF] Video stream.active:', video.active);
              video.getTracks().forEach((track, i) => {
                logger.proctoring(`[STREAM HANDOFF] Video track[${i}]:`, {
                  kind: track.kind,
                  readyState: track.readyState,
                  muted: track.muted,
                  enabled: track.enabled,
                  label: track.label
                });
              });
            }
            
            if (screen) {
              logger.proctoring('[STREAM HANDOFF] Screen stream.active:', screen.active);
              screen.getTracks().forEach((track, i) => {
                logger.proctoring(`[STREAM HANDOFF] Screen track[${i}]:`, {
                  kind: track.kind,
                  readyState: track.readyState,
                  muted: track.muted,
                  enabled: track.enabled,
                  label: track.label
                });
              });
            }
            logger.proctoring('==========================================');
            
            // Helper to check stream liveness
            const checkStreamAlive = (stream: MediaStream | null, name: string): boolean => {
              if (!stream) {
                logger.error(`[STREAM CHECK] ${name} stream is null!`);
                return false;
              }
              if (!stream.active) {
                logger.error(`[STREAM CHECK] ${name} stream is not active!`);
                return false;
              }
              const tracks = stream.getVideoTracks();
              const liveTrack = tracks.find(t => t.readyState === 'live');
              if (!liveTrack) {
                logger.error(`[STREAM CHECK] ${name} has no live video tracks!`, tracks.map(t => t.readyState));
                return false;
              }
              logger.proctoring(`[STREAM CHECK] ${name} stream is ALIVE:`, stream.id);
              return true;
            };
            
            let activeVideoStream = video;
            let activeScreenStream = screen;
            
            // Validate video stream - if dead, try to get new camera
            if (!checkStreamAlive(video, 'Video')) {
              logger.proctoring('[STREAM RECOVERY] Attempting to get fresh camera stream...');
              try {
                activeVideoStream = await navigator.mediaDevices.getUserMedia({
                  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
                  audio: true
                });
                logger.proctoring('[STREAM RECOVERY] Got fresh camera stream:', activeVideoStream.id);
                logger.proctoring('[STREAM RECOVERY] Fresh stream active:', activeVideoStream.active);
                activeVideoStream.getTracks().forEach((track, i) => {
                  logger.proctoring(`[STREAM RECOVERY] Fresh track[${i}]:`, track.kind, track.readyState);
                });
              } catch (err) {
                logger.error('[STREAM RECOVERY] Failed to get fresh camera stream:', err);
              }
            }
            
            // Validate screen stream - if dead, continue without (less critical)
            if (!checkStreamAlive(screen, 'Screen')) {
              logger.warn('[STREAM CHECK] Screen stream is dead, will continue without');
            }
            
            if (newAttemptId) setAttemptId(newAttemptId);
            if (newSessionToken) setSessionToken(newSessionToken);
            if (recommendedQuality) setVideoQuality(recommendedQuality);
            
            // CRITICAL: Store streams in refs FIRST (synchronous, immediate access)
            logger.proctoring('[STREAM HANDOFF] Storing streams in refs...');
            videoStreamRef.current = activeVideoStream;
            screenStreamRef.current = activeScreenStream;
            logger.proctoring('[STREAM HANDOFF] Refs updated. videoStreamRef.current:', videoStreamRef.current?.id);
            
            setProctoringSessionId(sessionId);
            setVideoStream(activeVideoStream);
            setScreenStream(activeScreenStream);
            setProctoringComplete(true);
            setProctoringChecksComplete(true);
            setShowProctoringSetup(false);
            setStarted(true);
            
            // Mark started_at for server-side deadline enforcement (fire and forget)
            if (newAttemptId && newSessionToken) {
              markInterviewStarted(newAttemptId, newSessionToken);
            }
            
            // Log pre-interview check completion
            startOperation({
              operation: 'pre_interview_check',
              interviewId: interview?.id,
              attemptId: newAttemptId,
              sessionId: sessionId,
              candidateEmail: candidateEmail || candidateInfo?.email,
              metadata: { 
                videoQuality: recommendedQuality,
                hasVideoStream: !!activeVideoStream,
                hasScreenStream: !!activeScreenStream
              }
            });
            
            logger.proctoring('[STREAM HANDOFF] State updates dispatched, waiting for render...');
            
            // Force re-render cycle, then attach stream to video element
            setTimeout(() => {
              logger.proctoring('[VIDEO ATTACH] Timeout fired, attempting attachment...');
              const streamToAttach = videoStreamRef.current;
              logger.proctoring('[VIDEO ATTACH] streamToAttach:', streamToAttach ? streamToAttach.id : 'NULL');
              logger.proctoring('[VIDEO ATTACH] streamToAttach.active:', streamToAttach?.active);
              logger.proctoring('[VIDEO ATTACH] videoRef.current exists:', !!videoRef.current);
              
              if (videoRef.current && streamToAttach && streamToAttach.active) {
                logger.proctoring('[VIDEO ATTACH] All conditions met, attaching...');
                videoRef.current.srcObject = streamToAttach;
                videoRef.current.muted = true;
                
                // Add event listeners to track video element state
                videoRef.current.onloadedmetadata = () => logger.proctoring('[VIDEO ELEMENT] loadedmetadata fired');
                videoRef.current.onplay = () => logger.proctoring('[VIDEO ELEMENT] play event fired');
                videoRef.current.onplaying = () => logger.proctoring('[VIDEO ELEMENT] playing event fired');
                videoRef.current.onerror = (e) => logger.error('[VIDEO ELEMENT] error:', e);
                
                videoRef.current.play()
                  .then(() => logger.proctoring('[VIDEO ATTACH] play() resolved successfully'))
                  .catch(err => logger.error('[VIDEO ATTACH] play() rejected:', err));
              } else {
                logger.error('[VIDEO ATTACH] FAILED - Missing requirements:', {
                  hasVideoRef: !!videoRef.current,
                  hasStream: !!streamToAttach,
                  streamActive: streamToAttach?.active
                });
                
                // If stream exists but not active, log detailed track info
                if (streamToAttach) {
                  streamToAttach.getTracks().forEach((track, i) => {
                    logger.proctoring(`[VIDEO ATTACH] Dead stream track[${i}]:`, track.kind, track.readyState);
                  });
                }
              }
            }, 150);
          }}
        />
      </div>
    </div>
  );

  // Non-proctored error screen
  if (!interview.proctoring_enabled && questionLoadError && started && questions.length === 0) {
    return renderErrorScreen();
  }

  // Non-proctored loading screen
  if (!interview.proctoring_enabled && (loadingQuestions || (started && questions.length === 0))) {
    return renderLoadingScreen();
  }

  // For proctored interviews with setup/loading/error states, we'll handle them below
  // after interviewContent is defined, so we can use ONE ProctoringProvider for ALL states

  // Guard against empty questions array during loading
  const currentQuestion = questions.length > 0 ? questions[currentQuestionIndex] : null;
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  // CRITICAL: Handle proctored interview flow - show proctoring setup first
  // This MUST return before defining interviewContent to prevent crashes
  // NOTE: Verification phases (setup, loading, error) render WITHOUT ProctoringProvider
  // Recording only happens during the main interview phase (single provider instance below)
  if (interview.proctoring_enabled && candidateInfo) {
    if (showProctoringSetup && !proctoringComplete) {
      // Setup phase - no recording needed, render without provider
      return renderProctoringSetup();
    }
    
    // Show loading/error while questions are being fetched
    // These phases don't need recording either
    if (!currentQuestion && started) {
      return questionLoadError ? renderErrorScreen() : renderLoadingScreen();
    }
  }

  // For non-proctored: If no current question (still loading or error), show appropriate screen
  if (!currentQuestion && started && !showProctoringSetup) {
    return questionLoadError ? renderErrorScreen() : renderLoadingScreen();
  }

  // At this point, if we're going to render interviewContent, currentQuestion must exist
  // If it doesn't exist and we're not in a started state, we'll render the candidate info form
  // which doesn't need currentQuestion

  // Main interview content - only rendered when currentQuestion exists or not started yet
  const interviewContent = (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Time's Up Overlay - blocks all interaction when time expires */}
      {/* CRITICAL: Shows upload progress to prevent candidates from closing browser */}
      {timeExpired && (
        <TimesUpOverlay 
          isSubmitting={submitting} 
          isUploading={isUploadingRecordings}
        />
      )}

      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Mobile proctoring indicator */}
              {interview.proctoring_enabled && videoStream && (
                <div className="lg:hidden flex items-center gap-1.5 px-2 py-1 bg-success/10 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-success font-medium">Recording</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">{interview.title}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${
                timeRemaining !== null && timeRemaining < 300 ? 'text-destructive font-semibold' : ''
              }`}>
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {timeRemaining !== null ? (
                  <span className="font-mono">
                    {formatTime(timeRemaining)}
                  </span>
                ) : (
                  <span className="font-mono">{formatTime(timeElapsed)}</span>
                )}
              </div>
            </div>
          </div>
          <Progress value={progress} className="mt-3 sm:mt-4" />
        </div>
      </div>

      {/* Main Content - Split Layout with Video and Questions */}
      <div className="container mx-auto px-4 py-4 min-h-[calc(100vh-140px)] lg:h-[calc(100vh-140px)]">
        <div className="flex flex-col lg:flex-row gap-4 h-full">
          {/* Left Side - Video Feed (hidden on mobile, 1/3 width on desktop) */}
          {interview.proctoring_enabled && videoStream && (
            <div className="hidden lg:block lg:w-1/3 flex-shrink-0">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Proctoring Active
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reconnectVideo}
                      disabled={isReconnecting}
                      className="h-7 px-2 text-xs"
                      title="Reconnect camera"
                    >
                      {isReconnecting ? (
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Reconnecting...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Video className="w-3 h-3" />
                          Reconnect
                        </span>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-2 px-4 py-2 min-h-0">
                  {/* Candidate Video */}
                  <div className="relative bg-black rounded-lg overflow-hidden flex-1 min-h-0">
                     <video
                      ref={setVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{ 
                        objectFit: 'cover',
                        transform: 'scaleX(-1)'
                      }}
                      className="w-full h-full"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Your Camera
                    </div>
                    {!videoStream && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-sm">
                        <div className="text-center">
                          <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Initializing video...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Status Indicators and Quality Control */}
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="flex items-center gap-1 p-1.5 bg-success/10 rounded text-[10px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <span>Recording</span>
                      </div>
                      <div className="flex items-center gap-1 p-1.5 bg-primary/10 rounded text-[10px]">
                        <Monitor className="w-3 h-3" />
                        <span>Screen</span>
                      </div>
                    </div>
                    
                    {/* Network Quality Indicator */}
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                      networkQuality === 'excellent' ? 'bg-success/10 text-success' :
                      networkQuality === 'good' ? 'bg-primary/10 text-primary' :
                      networkQuality === 'fair' ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        networkQuality === 'excellent' ? 'bg-success' :
                        networkQuality === 'good' ? 'bg-primary' :
                        networkQuality === 'fair' ? 'bg-warning' :
                        'bg-destructive'
                      }`} />
                      <span className="capitalize">{networkQuality} connection</span>
                    </div>
                    
                    {/* Video Quality Selector */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-muted-foreground">Quality:</span>
                        <button
                          onClick={() => setAutoQualityEnabled(!autoQualityEnabled)}
                          className={`px-1 py-0.5 rounded text-[9px] transition-colors ${
                            autoQualityEnabled
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                          title={autoQualityEnabled ? 'Auto-adjust enabled' : 'Auto-adjust disabled'}
                        >
                          Auto
                        </button>
                      </div>
                      <div className="flex gap-0.5">
                        {(['low', 'medium', 'high'] as const).map((quality) => (
                          <button
                            key={quality}
                            onClick={() => {
                              setAutoQualityEnabled(false);
                              changeVideoQuality(quality);
                            }}
                            disabled={isReconnecting}
                            className={`px-1.5 py-0.5 rounded transition-colors ${
                              videoQuality === quality && !autoQualityEnabled
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            } disabled:opacity-50`}
                            title={`Switch to ${quality} quality (disables auto)`}
                          >
                            {quality === 'low' ? 'L' : quality === 'medium' ? 'M' : 'H'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Network Status Banner - Shows warning when offline */}
          {interview.proctoring_enabled && started && <NetworkStatusBanner />}

          {/* Proctoring Monitor - Hidden component that manages recording */}
          {/* Uses the shared ProctoringContext from the wrapper provider */}
          {/* Note: proctoringComplete indicates pre-checks done; ProctoringMonitor creates session on mount */}
          {/* IMPORTANT: No key prop to prevent remounts which cause duplicate sessions */}
          {/* CRITICAL: Use refs for streams to avoid stale state timing issues */}
          {/* Refs are synchronously updated, so they're always current when component renders */}
          {interview.proctoring_enabled && proctoringComplete && videoStreamRef.current && screenStreamRef.current && (() => {
            // Additional validation: ensure streams are still live before rendering ProctoringMonitor
            const videoLive = videoStreamRef.current?.active && videoStreamRef.current?.getVideoTracks()[0]?.readyState === 'live';
            const screenLive = screenStreamRef.current?.active && screenStreamRef.current?.getVideoTracks()[0]?.readyState === 'live';
            
            if (!videoLive) {
              logger.error('[ProctoringMonitor GATE] Video stream is NOT live!', {
                active: videoStreamRef.current?.active,
                trackState: videoStreamRef.current?.getVideoTracks()[0]?.readyState
              });
            }
            if (!screenLive) {
              logger.error('[ProctoringMonitor GATE] Screen stream is NOT live!', {
                active: screenStreamRef.current?.active,
                trackState: screenStreamRef.current?.getVideoTracks()[0]?.readyState
              });
            }
            
            // Still render ProctoringMonitor even if streams aren't perfect - it will handle errors
            return (
              <ProctoringMonitor
                attemptId={attemptId!}
                attemptType="interview"
                videoStream={videoStreamRef.current!}
                screenStream={screenStreamRef.current!}
                sessionId={proctoringSessionId || ''}
                sessionToken={sessionToken || undefined}
                isResumedSession={isResumedSession}
                onFinalizeReady={(fn) => { proctoringFinalizeRef.current = fn; }}
                qualityChangeInProgress={qualityChangeInProgressRef.current}
                onScreenShareStopped={() => {
                  logger.error('[TakeInterview] Screen share stopped - blocking interview');
                  setScreenShareBlocked(true);
                }}
              />
            );
          })()}
          
          {/* Screen Share Blocking Overlay - Forces re-share before continuing */}
          <ScreenShareBlockingOverlay
            isVisible={screenShareBlocked}
            onScreenShareRestored={(newStream) => {
              logger.proctoring('[TakeInterview] Screen share restored with new stream');
              // Update refs and state with new stream
              screenStreamRef.current = newStream;
              setScreenStream(newStream);
              setScreenShareBlocked(false);
              // Note: ProctoringMonitor will need to restart screen recording
              // This is handled by the component detecting the new stream
            }}
          />

          {/* Right Side - Question Card (full width on mobile, 2/3 on desktop) */}
          <div className={interview.proctoring_enabled && videoStream ? "w-full lg:w-2/3" : "w-full"}>
            <Card className="flex flex-col">
              <CardHeader className="pb-2 px-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">
                      {currentQuestion.topic}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full ${
                        currentQuestion.difficulty === 'easy' ? 'bg-success/10 text-success' :
                        currentQuestion.difficulty === 'medium' ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {currentQuestion.difficulty}
                    </span>
                  </div>
                </div>
                {currentQuestion.question_type && (
                  <div className="mt-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {currentQuestion.question_type === 'mcq' && 'Multiple Choice'}
                      {currentQuestion.question_type === 'scenario' && 'Scenario-Based'}
                      {currentQuestion.question_type === 'coding' && 'Coding Challenge'}
                      {currentQuestion.question_type === 'descriptive' && 'Descriptive'}
                    </span>
                  </div>
                )}
              </CardHeader>
              
              {/* Question Text Section - Fully Visible with Formatting */}
              <div className="px-4 pb-3 border-b border-border/50">
                <FormattedQuestionText 
                  text={currentQuestion.question_text} 
                  className="text-sm sm:text-base"
                />
              </div>
              <CardContent className="flex flex-col px-4 pb-4">
                <div className="mb-3 pr-1">
                  {currentQuestion.options && currentQuestion.options.length > 0 ? (
                    <RadioGroup
                      value={(() => {
                        const current = answers[currentQuestion.id];
                        if (!current) return "";
                        const idx = currentQuestion.options.findIndex((o: string) => o === current);
                        return idx >= 0 ? String(idx) : "";
                      })()}
                      onValueChange={(indexStr) => {
                        const idx = Number(indexStr);
                        const option = currentQuestion.options?.[idx];
                        handleAnswer(currentQuestion.id, option ?? "");
                      }}
                      className="space-y-2"
                    >
                      {currentQuestion.options.map((option: string, index: number) => {
                        const optionId = `${currentQuestion.id}-option-${index}`;
                        return (
                          <div key={`${index}-${option}`} className="flex items-start space-x-2 p-2.5 border rounded-lg hover:bg-accent/5">
                            <RadioGroupItem value={String(index)} id={optionId} className="mt-0.5 flex-shrink-0" />
                            <Label htmlFor={optionId} className="flex-1 cursor-pointer text-sm leading-relaxed">
                              {String.fromCharCode(65 + index)}. {option}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  ) : currentQuestion.question_type === 'coding' ? (
                    <div>
                      <CodeEditor
                        key={currentQuestion.id}
                        questionId={currentQuestion.id}
                        questionText={currentQuestion.question_text}
                        language={detectCodeLanguage(currentQuestion.question_text, currentQuestion.topic)}
                        initialCode={answers[currentQuestion.id] || ""}
                        onCodeChange={(code) => handleAnswer(currentQuestion.id, code)}
                        codingSchema={currentQuestion.coding_schema || interview?.coding_schema || null}
                        attemptId={attemptId || undefined}
                        sessionToken={sessionToken || undefined}
                        allowedLanguages={currentQuestion.allowed_languages}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="answer" className="text-sm font-medium">
                        Your Answer
                        <span className="text-xs text-muted-foreground ml-2">
                          (Provide a detailed response)
                        </span>
                      </Label>
                      <Textarea
                        id="answer"
                        placeholder="Type your detailed answer here...

Feel free to explain your thought process, provide examples, and elaborate on your understanding."
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                        rows={10}
                        className="resize-none min-h-[250px] text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tip: Be thorough and specific in your response. Quality matters more than quantity.
                      </p>
                    </div>
                  )}
                </div>{/* End scrollable area */}

                {/* Fixed buttons at bottom */}
                <div className="flex justify-between pt-3 border-t bg-card">
                  <Button
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  
                  {currentQuestionIndex === questions.length - 1 ? (
                    <Button
                      onClick={submitInterview}
                      disabled={submitting}
                      size="sm"
                      className="bg-gradient-to-r from-success to-success/80"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {submitting ? "Submitting..." : "Submit Interview"}
                    </Button>
                  ) : (
                    <Button onClick={nextQuestion} size="sm">
                      Next Question
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );

  // Wrap in ProctoringProvider if proctoring is enabled to share context with ProctoringMonitor
  // CRITICAL: Only render provider when attemptId exists to ensure proper session initialization
  // Note: Proctoring setup/loading/error cases are handled by early returns above
  if (interview.proctoring_enabled && candidateInfo && attemptId) {
    return (
      <ProctoringProvider 
        attemptId={attemptId} 
        attemptType="interview"
        sessionToken={sessionToken || undefined}
      >
        {interviewContent}
        <UploadProgressOverlay 
          isVisible={showUploadProgress} 
          isPreparing={isPreparingUpload}
          onComplete={handleUploadComplete}
          onTimeout={handleUploadTimeout}
        />
      </ProctoringProvider>
    );
  }

  return interviewContent;
};

export default TakeInterview;