import { useState, useEffect, useCallback, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { getPendingUploadCount, triggerBackgroundUpload } from '@/lib/backgroundUploader';
import { getUploadProgress, subscribeToUploadProgress, UploadProgress as UploadProgressType } from '@/lib/uploadProgressStore';
import { logger } from '@/lib/logger';

interface UploadProgressOverlayProps {
  isVisible: boolean;
  isPreparing?: boolean;  // Shows "Preparing upload..." phase before actual upload tracking
  onComplete?: () => void;
  onTimeout?: () => void;  // Called when max time reached but uploads may still be pending
}

const UploadProgressOverlay = ({ isVisible, isPreparing = false, onComplete, onTimeout }: UploadProgressOverlayProps) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'preparing' | 'uploading' | 'processing' | 'complete' | 'partial' | 'error' | 'retrying'>('uploading');
  const [pendingCount, setPendingCount] = useState(0);
  const [initialCount, setInitialCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [stuckTime, setStuckTime] = useState(0);
  
  // Use refs to track progress for stuck detection (avoids stale closure issues)
  const lastProgressRef = useRef<number>(0);
  const stuckCounterRef = useRef<number>(0);

  const [isFirstCheck, setIsFirstCheck] = useState(true);

  // Retry handler for stuck uploads
  const handleRetry = useCallback(async () => {
    logger.proctoring('[UploadOverlay] Manual retry triggered');
    setStatus('retrying');
    setRetryCount(prev => prev + 1);
    setStuckTime(0);
    stuckCounterRef.current = 0; // Reset stuck counter
    lastProgressRef.current = 0;
    
    try {
      await triggerBackgroundUpload();
    } catch (error) {
      logger.error('[UploadOverlay] Retry failed:', error);
    }
    
    // Back to uploading status after triggering
    setTimeout(() => {
      setStatus('uploading');
    }, 1000);
  }, []);

  // When isPreparing changes, update status
  useEffect(() => {
    if (isPreparing) {
      setStatus('preparing');
      setProgress(0);
    } else if (status === 'preparing') {
      // Transition from preparing to uploading
      setStatus('uploading');
    }
  }, [isPreparing]);

  useEffect(() => {
    // Don't start polling if in preparing phase
    if (!isVisible || isPreparing) return;

    let cancelled = false;
    let checkCount = 0;
    let hasCalledComplete = false;

    // Subscribe to real-time progress updates from upload store
    const unsubscribe = subscribeToUploadProgress((uploadProgress: UploadProgressType) => {
      if (cancelled) return;
      
      // Track if progress is stuck using refs (avoids stale closure)
      if (uploadProgress.overallProgress === lastProgressRef.current && uploadProgress.overallProgress < 100) {
        stuckCounterRef.current++;
        if (stuckCounterRef.current >= 15) { // 30 seconds of no progress (2s intervals)
          setStuckTime(stuckCounterRef.current * 2);
        }
      } else {
        stuckCounterRef.current = 0;
        setStuckTime(0);
        lastProgressRef.current = uploadProgress.overallProgress;
      }
      
      // Use real progress from upload store
      setProgress(uploadProgress.overallProgress);
      
      // Check for completion (includes failed uploads - we still proceed)
      if (uploadProgress.isComplete && !hasCalledComplete) {
        hasCalledComplete = true;
        
        // Check if any uploads failed
        const hasFailed = 
          (uploadProgress.hasVideo && uploadProgress.videoStatus === 'failed') ||
          (uploadProgress.hasScreen && uploadProgress.screenStatus === 'failed');
        
        if (hasFailed) {
          // Partial success - some uploads failed but we still proceed
          logger.warn('[UploadOverlay] Some uploads failed but proceeding with navigation');
          setStatus('partial');
          setProgress(100);
          setTimeout(() => {
            onComplete?.();
          }, 2000); // Give user time to see the partial status
        } else {
          // Full success
          setProgress(100);
          setStatus('complete');
          setTimeout(() => {
            onComplete?.();
          }, 1500);
        }
      }
    });

    const checkProgress = async () => {
      try {
        const count = await getPendingUploadCount();
        checkCount++;
        
        if (!cancelled) {
          // Initialize on first check
          if (isFirstCheck && count > 0) {
            setInitialCount(count);
            setIsFirstCheck(false);
          }
          
          setPendingCount(count);
          
          // CRITICAL: If count is 0 on first check, recording may have failed
          // Give it 3 checks (6 seconds) to catch any delayed queuing
          if (count === 0 && !hasCalledComplete) {
            if (isFirstCheck && checkCount < 3) {
              logger.proctoring('[UploadOverlay] No pending uploads on check', checkCount, '- waiting for possible delayed queue');
              setIsFirstCheck(false);
              return; // Wait for next check
            }
            
            // Check the actual upload store for status
            const storeProgress = getUploadProgress();
            
            if (storeProgress.isComplete) {
              // Already handled by subscription
              return;
            }
            
            if (initialCount === 0 && checkCount >= 3) {
              // No recordings were ever queued - recording likely failed
              logger.warn('[UploadOverlay] No recordings were queued - recording may have failed!');
              setStatus('complete'); // Still show complete to avoid blocking
              setProgress(100);
              hasCalledComplete = true;
              setTimeout(() => {
                onComplete?.();
              }, 1500);
            }
          }
        }
      } catch (error) {
        logger.error('Error checking upload progress:', error);
        // Don't set error status for transient polling errors
      }
    };

    // Initial check
    checkProgress();
    
    // Poll every 2 seconds
    const interval = setInterval(checkProgress, 2000);

    // Auto-complete after 5 minutes max (uploads continue in background via Service Worker)
    // This gives enough time for most video uploads while not blocking indefinitely
    // Service Worker ensures uploads complete even after navigation
    const timeout = setTimeout(() => {
      if (!cancelled && status !== 'complete' && status !== 'partial' && !hasCalledComplete) {
        logger.proctoring('[UploadOverlay] Timeout reached (5 min) - calling onTimeout for finalization');
        hasCalledComplete = true;
        setStatus('processing');
        setProgress(100);
        setTimeout(() => {
          // Use onTimeout if provided (for finalization), otherwise fall back to onComplete
          (onTimeout || onComplete)?.();
        }, 1000);
      }
    }, 300000); // 5 minutes = 300,000ms

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isVisible, isPreparing, initialCount, onComplete, onTimeout, status]); // Removed lastProgress from deps

  if (!isVisible) return null;

  const showRetryButton = stuckTime >= 30 && (status === 'uploading' || status === 'error');

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-2">
        <CardContent className="pt-8 pb-6 px-6">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className={`p-4 rounded-full ${
              status === 'complete' ? 'bg-success/10' : 
              status === 'partial' ? 'bg-warning/10' :
              status === 'error' ? 'bg-destructive/10' : 
              status === 'preparing' || status === 'retrying' ? 'bg-secondary/10' :
              'bg-primary/10'
            }`}>
              {status === 'complete' ? (
                <CheckCircle className="h-12 w-12 text-success animate-in zoom-in-50" />
              ) : status === 'partial' ? (
                <CheckCircle className="h-12 w-12 text-warning animate-in zoom-in-50" />
              ) : status === 'error' ? (
                <AlertCircle className="h-12 w-12 text-destructive" />
              ) : status === 'preparing' || status === 'retrying' ? (
                <Loader2 className="h-12 w-12 text-secondary-foreground animate-spin" />
              ) : (
                <Upload className="h-12 w-12 text-primary animate-pulse" />
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {status === 'complete' ? 'Upload Complete!' : 
                 status === 'partial' ? 'Interview Submitted' :
                 status === 'error' ? 'Upload Issue' :
                 status === 'processing' ? 'Processing...' :
                 status === 'preparing' ? 'Preparing Your Recording...' :
                 status === 'retrying' ? 'Retrying Upload...' :
                 'Uploading Your Interview...'}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                {status === 'complete' ? 'Your interview recording has been saved successfully.' :
                 status === 'partial' ? 'Your answers have been submitted. Some recordings may still be uploading in the background.' :
                 status === 'error' ? 'Some recordings may still be uploading in the background.' :
                 status === 'processing' ? 'Finalizing your submission...' :
                 status === 'preparing' ? 'Please wait while we prepare your interview recording for upload. This only takes a moment.' :
                 status === 'retrying' ? `Attempting to resume upload... (Attempt ${retryCount + 1})` :
                 stuckTime > 0 ? `Upload seems slow. Please wait or try the retry button below.` :
                 'Please wait while we save your interview recording. This may take a few minutes for longer interviews.'}
              </p>
            </div>

            {/* Progress bar - show indeterminate for preparing phase */}
            {status !== 'complete' && status !== 'partial' && status !== 'error' && (
              <div className="w-full space-y-3">
                {status === 'preparing' || status === 'retrying' ? (
                  <div className="h-4 w-full bg-muted rounded-full overflow-hidden relative">
                    <div 
                      className="h-full w-1/3 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full absolute"
                      style={{ 
                        animation: 'indeterminate 1.5s ease-in-out infinite',
                      }} 
                    />
                    <style>{`
                      @keyframes indeterminate {
                        0% { left: -33%; }
                        100% { left: 100%; }
                      }
                    `}</style>
                  </div>
                ) : (
                  <Progress value={progress} className="h-4" />
                )}
                <div className="flex justify-between text-sm text-muted-foreground font-medium">
                  {status === 'preparing' ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Preparing recording...
                    </span>
                  ) : status === 'retrying' ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Retrying...
                    </span>
                  ) : (
                    <>
                      <span className="text-primary font-semibold">{progress}%</span>
                      {pendingCount > 0 && (
                        <span>{pendingCount} file{pendingCount > 1 ? 's' : ''} remaining</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Retry button for stuck uploads */}
            {showRetryButton && (
              <Button 
                onClick={handleRetry} 
                variant="outline" 
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Upload
              </Button>
            )}

            {/* Warning */}
            {(status === 'uploading' || status === 'preparing' || status === 'retrying') && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs text-warning-foreground">
                <strong>Please don't close this tab</strong> until the upload is complete.
                {stuckTime > 0 && (
                  <p className="mt-1 text-warning">
                    Upload has been slow for {stuckTime} seconds. If this continues, try the retry button.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadProgressOverlay;
