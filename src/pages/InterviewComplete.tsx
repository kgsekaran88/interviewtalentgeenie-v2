import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { logger } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, FileText, Upload, RefreshCw, AlertCircle } from "lucide-react";
import UploadProgressIndicator from "@/components/UploadProgressIndicator";
import { updateUploadProgress, subscribeToUploadProgress, getUploadProgress, UploadProgress } from "@/lib/uploadProgressStore";
import { useUploadGuard } from "@/hooks/useUploadGuard";
import { triggerBackgroundUpload, getPendingUploadCount } from "@/lib/backgroundUploader";
import { invokeFunction } from "@/lib/supabaseFunctions";

const InterviewComplete = () => {
  const { attemptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadProgress, setUploadProgressState] = useState<UploadProgress | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [stuckTime, setStuckTime] = useState(0);

  // Get state from navigation
  const sessionToken = location.state?.sessionToken;
  const hasActiveUploads = location.state?.hasActiveUploads ?? false;
  const attemptIdFromState = location.state?.attemptId;

  // Block browser close while uploads are active
  const { forceAllow } = useUploadGuard({ 
    enabled: hasActiveUploads && !uploadComplete,
    message: 'Your interview recording is still uploading. If you leave now, your recording may be lost.'
  });

  // Handle retry for stuck uploads
  const handleRetry = useCallback(async () => {
    logger.proctoring('[InterviewComplete] Manual retry triggered');
    setIsRetrying(true);
    setStuckTime(0);
    stuckCounterRef.current = 0; // Reset ref counter too
    
    try {
      await triggerBackgroundUpload();
    } catch (error) {
      logger.error('[InterviewComplete] Retry failed:', error);
    }
    
    setTimeout(() => setIsRetrying(false), 2000);
  }, []);

  // Track stuck detection with refs to avoid stale closure issues
  const lastProgressRef = useRef<number>(0);
  const stuckCounterRef = useRef<number>(0);
  const stuckCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uploadCompleteRef = useRef<boolean>(false);

  // CRITICAL: Stop any lingering media tracks on mount
  // This catches cases where TakeInterview cleanup didn't fully execute before navigation
  useEffect(() => {
    logger.proctoring('[InterviewComplete] Safety cleanup - stopping all media tracks');
    
    // Stop all active media tracks in the browser
    navigator.mediaDevices.enumerateDevices().then(() => {
      // Get all media streams and stop them
      // This is a belt-and-suspenders approach since we can't directly access MediaStream objects
      // but we can request new permissions which effectively tells the browser we're done
    }).catch(() => {});
    
    // More direct approach: Check if there are any getUserMedia tracks still active
    // and stop them by stopping all tracks on any streams we can find
    try {
      // Try to stop any video elements that might still be playing
      document.querySelectorAll('video').forEach((video) => {
        if (video.srcObject && video.srcObject instanceof MediaStream) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => {
            if (track.readyState === 'live') {
              logger.proctoring(`[InterviewComplete] Stopping orphaned track: ${track.kind}`);
              track.stop();
            }
          });
          video.srcObject = null;
        }
      });
    } catch (e) {
      logger.error('[InterviewComplete] Error during media cleanup:', e);
    }
    
    return () => {
      // Also cleanup on unmount
      document.querySelectorAll('video').forEach((video) => {
        if (video.srcObject && video.srcObject instanceof MediaStream) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
      });
    };
  }, []);

  // Subscribe to upload progress - fixed race conditions
  useEffect(() => {
    if (!hasActiveUploads) {
      setUploadComplete(true);
      uploadCompleteRef.current = true;
      return;
    }

    // Trigger upload on mount in case it wasn't started
    triggerBackgroundUpload().catch(err => {
      logger.error('[InterviewComplete] Error triggering upload:', err);
    });

    const unsubscribe = subscribeToUploadProgress((progress) => {
      setUploadProgressState(progress);
      
      // Track if progress is stuck - use refs to avoid closure issues
      if (progress.overallProgress === lastProgressRef.current && progress.overallProgress < 100) {
        // Don't increment here - let interval handle it
      } else {
        stuckCounterRef.current = 0;
        setStuckTime(0);
        lastProgressRef.current = progress.overallProgress;
      }
      
      // Check for completion
      if (progress.isComplete && !uploadCompleteRef.current) {
        logger.proctoring('[InterviewComplete] Uploads completed!');
        uploadCompleteRef.current = true;
        setUploadComplete(true);
        
        // Finalize submission after uploads complete
        finalizeAfterUpload();
      }
    });

    // Single interval for stuck detection - uses refs to track state
    stuckCheckIntervalRef.current = setInterval(() => {
      if (uploadCompleteRef.current) return;
      
      stuckCounterRef.current++;
      if (stuckCounterRef.current >= 15) { // 30 seconds (2s intervals)
        setStuckTime(stuckCounterRef.current * 2);
      }
    }, 2000);

    return () => {
      unsubscribe();
      if (stuckCheckIntervalRef.current) {
        clearInterval(stuckCheckIntervalRef.current);
        stuckCheckIntervalRef.current = null;
      }
    };
  }, [hasActiveUploads]); // Removed uploadComplete and lastProgress from deps

  // Finalize submission after upload completes - memoized to avoid recreation
  const finalizeAfterUpload = useCallback(async () => {
    const token = sessionToken || location.state?.sessionToken;
    const attId = attemptId || attemptIdFromState;
    
    if (token && attId) {
      logger.proctoring('[InterviewComplete] Finalizing submission after upload...');
      
      // Allow navigation now that upload is complete
      forceAllow();
      
      try {
        const { data, error } = await supabase.rpc('finalize_proctored_submission', {
          p_session_token: token
        });
        
        if (error) {
          logger.error('[InterviewComplete] Finalization error:', error);
        } else {
          const result = Array.isArray(data) ? data[0] : data;
          logger.proctoring('[InterviewComplete] Finalization result:', result);
          
          // Trigger auto-evaluation with video analysis
          if (result?.success) {
            invokeFunction('auto-evaluate-trigger', {
              body: { attemptId: attId, includeVideoAnalysis: true }
            }).catch(err => {
              logger.error("[InterviewComplete] Auto-evaluate trigger failed:", err);
            });
          }
        }
      } catch (err) {
        logger.error('[InterviewComplete] Error finalizing:', err);
      }
    }
  }, [sessionToken, attemptId, attemptIdFromState, forceAllow]);

  // Sync upload status from database to fix stale localStorage state
  useEffect(() => {
    const syncUploadStatusFromDB = async () => {
      const attemptIdToCheck = attemptId || attemptIdFromState;
      if (!attemptIdToCheck) return;

      try {
        // Query proctoring session to get actual upload status
        const { data: session } = await supabase
          .from('proctoring_sessions')
          .select('upload_status, video_recording_url, screen_recording_url')
          .eq('interview_attempt_id', attemptIdToCheck)
          .maybeSingle();

        if (session) {
          const hasVideo = !!session.video_recording_url;
          const hasScreen = !!session.screen_recording_url;
          
          // If database shows completed, update the progress store to match
          if (session.upload_status === 'completed') {
            logger.proctoring('[InterviewComplete] DB shows uploads completed, syncing to UI');
            setUploadComplete(true);
            updateUploadProgress({
              hasVideo,
              hasScreen,
              videoStatus: hasVideo ? 'completed' : 'pending',
              screenStatus: hasScreen ? 'completed' : 'pending',
              videoProgress: hasVideo ? 100 : 0,
              screenProgress: hasScreen ? 100 : 0,
            });
          } else if (hasVideo || hasScreen) {
            // Partial uploads - update what we have
            updateUploadProgress({
              hasVideo,
              hasScreen,
              videoStatus: hasVideo ? 'completed' : 'uploading',
              screenStatus: hasScreen ? 'completed' : 'uploading',
              videoProgress: hasVideo ? 100 : 50,
              screenProgress: hasScreen ? 100 : 50,
            });
          }
        }
      } catch (err) {
        logger.error('[InterviewComplete] Error syncing upload status:', err);
      }
    };

    // Sync after a short delay to let background uploads finish
    const timer = setTimeout(syncUploadStatusFromDB, 2000);
    // Also sync immediately for fast feedback
    syncUploadStatusFromDB();

    return () => clearTimeout(timer);
  }, [attemptId, attemptIdFromState]);

  useEffect(() => {
    fetchAttempt();
  }, [attemptId]);

  const fetchAttempt = async () => {
    // Get session token from location state (passed via navigate)
    const sessionToken = location.state?.sessionToken;
    const attemptIdFromState = location.state?.attemptId;
    
    if (!sessionToken && !attemptId && !attemptIdFromState) {
      setLoading(false);
      return;
    }

    try {
      // Use secure function to get attempt
      const { data, error } = await supabase
        .rpc('get_attempt_by_session' as any, { token: sessionToken });

      if (error) {
        logger.error("Error fetching attempt:", error);
      }

      if (data && data.length > 0) {
        // Fetch interview title separately
        const { data: interviewData } = await supabase
          .rpc('get_interview_for_candidate' as any, { 
            share_link_param: data[0].interview_id // This won't work, need to query directly
          });
        
        // Better approach - get interview directly
        const { data: interviewInfo } = await supabase
          .from("interviews")
          .select("title")
          .eq("id", data[0].interview_id)
          .maybeSingle();
        
        setAttempt({
          ...data[0],
          interview_title: interviewInfo?.title || "Interview"
        });
      }
    } catch (err) {
      logger.error("Unexpected error:", err);
    }
    
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} minutes ${secs} seconds`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-success/5">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-success border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Determine if we should show warning about not closing
  const showUploadWarning = hasActiveUploads && !uploadComplete;
  const showRetryButton = stuckTime >= 30 && !uploadComplete;

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-success/5 p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                uploadComplete ? 'bg-success/10' : 'bg-primary/10'
              }`}>
                {uploadComplete ? (
                  <CheckCircle className="w-10 h-10 text-success" />
                ) : (
                  <Upload className="w-10 h-10 text-primary animate-pulse" />
                )}
              </div>
            </div>
            <CardTitle className="text-3xl">
              {uploadComplete ? 'Thank You!' : 'Uploading Recording...'}
            </CardTitle>
            <CardDescription className="text-base mt-4">
              {uploadComplete 
                ? 'Your interview has been successfully submitted and is being evaluated.'
                : 'Your interview responses have been submitted. Recording is being uploaded...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Progress - More prominent when uploading */}
            {showUploadWarning && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-center">
                <AlertCircle className="w-5 h-5 text-warning mx-auto mb-2" />
                <p className="text-sm font-medium text-warning-foreground">
                  Please don't close this window
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your recording is still uploading. Closing now may result in lost recording.
                </p>
                {stuckTime > 0 && (
                  <p className="text-xs text-warning mt-2">
                    Upload seems slow ({stuckTime}s). {showRetryButton && 'Try the retry button below.'}
                  </p>
                )}
              </div>
            )}
            
            <UploadProgressIndicator className="mb-4" />
            
            {/* Retry button for stuck uploads */}
            {showRetryButton && (
              <div className="flex justify-center">
                <Button 
                  onClick={handleRetry} 
                  variant="outline" 
                  size="sm"
                  disabled={isRetrying}
                  className="gap-2"
                >
                  {isRetrying ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Retry Upload
                </Button>
              </div>
            )}
            
            <div className="p-6 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">What happens next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Your responses have been evaluated by our AI system</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>A detailed assessment report has been generated for the recruiter</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>The hiring team will review your results and contact you soon</span>
                </li>
              </ul>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              {uploadComplete ? (
                <>
                  <p>You can now close this window.</p>
                  <p className="mt-2">We appreciate your time and wish you the best!</p>
                </>
              ) : (
                <p>Please wait for the upload to complete before closing.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-success/5 p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              uploadComplete ? 'bg-success/10' : 'bg-primary/10'
            }`}>
              {uploadComplete ? (
                <CheckCircle className="w-10 h-10 text-success" />
              ) : (
                <Upload className="w-10 h-10 text-primary animate-pulse" />
              )}
            </div>
          </div>
          <CardTitle className="text-3xl">
            {uploadComplete ? 'Interview Completed!' : 'Uploading Recording...'}
          </CardTitle>
          <CardDescription className="text-base mt-4">
            {uploadComplete 
              ? 'Thank you for completing the interview. Your responses have been submitted and evaluated by our AI system.'
              : 'Your interview responses have been submitted. Recording is being uploaded...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Warning */}
          {showUploadWarning && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-center">
              <AlertCircle className="w-5 h-5 text-warning mx-auto mb-2" />
              <p className="text-sm font-medium text-warning-foreground">
                Please don't close this window
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your recording is still uploading. Closing now may result in lost recording.
              </p>
              {stuckTime > 0 && (
                <p className="text-xs text-warning mt-2">
                  Upload seems slow ({stuckTime}s). {showRetryButton && 'Try the retry button below.'}
                </p>
              )}
            </div>
          )}
          
          {/* Upload Progress */}
          <UploadProgressIndicator className="mb-4" />
          
          {/* Retry button */}
          {showRetryButton && (
            <div className="flex justify-center">
              <Button 
                onClick={handleRetry} 
                variant="outline" 
                size="sm"
                disabled={isRetrying}
                className="gap-2"
              >
                {isRetrying ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Retry Upload
              </Button>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="p-4 bg-primary/5 rounded-lg text-center">
              <FileText className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Interview</p>
              <p className="font-semibold">{attempt.interview_title}</p>
            </div>
            {attempt.time_taken && (
              <div className="p-4 bg-accent/5 rounded-lg text-center">
                <Clock className="w-6 h-6 mx-auto mb-2 text-accent" />
                <p className="text-sm text-muted-foreground">Time Taken</p>
                <p className="font-semibold">{formatTime(attempt.time_taken)}</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">What happens next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Your responses have been evaluated by our AI system</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>A detailed assessment report has been generated for the recruiter</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>The hiring team will review your results and contact you soon</span>
              </li>
            </ul>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {uploadComplete ? (
              <>
                <p>You can now close this window.</p>
                <p className="mt-2">We appreciate your time and wish you the best!</p>
              </>
            ) : (
              <p>Please wait for the upload to complete before closing.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InterviewComplete;