import { useEffect, useState, useCallback } from "react";
import { AlertCircle, Clock, Loader2, CheckCircle2, RefreshCw, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { subscribeToUploadProgress, UploadProgress, getUploadProgress } from "@/lib/uploadProgressStore";

interface TimesUpOverlayProps {
  isSubmitting: boolean;
  /** Whether uploads are actively in progress */
  isUploading?: boolean;
  /** Upload progress (0-100) */
  uploadProgress?: number;
  /** Callback when uploads are complete */
  onUploadComplete?: () => void;
}

type UploadStatus = 'submitting' | 'uploading' | 'completing' | 'complete' | 'stuck';

/**
 * Full-screen blocking overlay shown when interview time expires.
 * This prevents the candidate from continuing after the deadline.
 * 
 * CRITICAL: Shows real-time upload progress to keep candidates waiting
 * until all recordings are safely uploaded.
 */
const TimesUpOverlay = ({ 
  isSubmitting, 
  isUploading: propIsUploading,
  uploadProgress: propUploadProgress,
  onUploadComplete 
}: TimesUpOverlayProps) => {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [status, setStatus] = useState<UploadStatus>('submitting');
  const [stuckTime, setStuckTime] = useState(0);
  const [lastProgressValue, setLastProgressValue] = useState(0);
  
  // Subscribe to upload progress store
  useEffect(() => {
    // Get initial state
    const initialProgress = getUploadProgress();
    setProgress(initialProgress);
    
    const unsubscribe = subscribeToUploadProgress((newProgress) => {
      setProgress(newProgress);
      
      // Track if progress is stuck
      if (newProgress.overallProgress !== lastProgressValue) {
        setLastProgressValue(newProgress.overallProgress);
        setStuckTime(0);
      }
      
      // Check for completion
      if (newProgress.isComplete) {
        setStatus('complete');
        onUploadComplete?.();
      }
    });
    
    return unsubscribe;
  }, [lastProgressValue, onUploadComplete]);
  
  // Determine status based on state
  useEffect(() => {
    if (progress?.isComplete) {
      setStatus('complete');
    } else if (progress?.hasVideo || progress?.hasScreen) {
      const uploadPercent = progress.overallProgress;
      if (uploadPercent >= 95) {
        setStatus('completing');
      } else {
        setStatus('uploading');
      }
    } else if (isSubmitting) {
      setStatus('submitting');
    }
  }, [progress, isSubmitting]);
  
  // Track stuck uploads
  useEffect(() => {
    if (status !== 'uploading' && status !== 'completing') return;
    
    const interval = setInterval(() => {
      setStuckTime(prev => {
        const newTime = prev + 1;
        if (newTime > 60) {
          setStatus('stuck');
        }
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [status]);
  
  const handleRetry = useCallback(() => {
    // Import dynamically to avoid circular deps
    import('@/lib/backgroundUploader').then(({ triggerBackgroundUpload }) => {
      triggerBackgroundUpload();
      setStuckTime(0);
      setStatus('uploading');
    });
  }, []);
  
  const getDisplayProgress = () => {
    if (propUploadProgress !== undefined) return propUploadProgress;
    return progress?.overallProgress ?? 0;
  };

  const getStatusContent = () => {
    switch (status) {
      case 'submitting':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: "Time's Up!",
          titleColor: "text-destructive",
          description: "Auto-submitting your answers...",
          showProgress: false,
        };
      
      case 'uploading':
        return {
          icon: <Upload className="h-8 w-8 text-primary animate-pulse" />,
          title: "Uploading Recordings",
          titleColor: "text-primary",
          description: "Please wait while your interview recordings are uploaded. Do not close this tab.",
          showProgress: true,
        };
      
      case 'completing':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: "Almost Done",
          titleColor: "text-primary",
          description: "Finalizing your recordings...",
          showProgress: true,
        };
      
      case 'complete':
        return {
          icon: <CheckCircle2 className="h-8 w-8 text-primary" />,
          title: "Upload Complete",
          titleColor: "text-primary",
          description: "Your interview has been submitted successfully!",
          showProgress: false,
        };
      
      case 'stuck':
        return {
          icon: <AlertCircle className="h-8 w-8 text-destructive" />,
          title: "Upload Slow",
          titleColor: "text-destructive",
          description: "Your upload is taking longer than expected. Please don't close this tab.",
          showProgress: true,
        };
    }
  };
  
  const statusContent = getStatusContent();
  const displayProgress = getDisplayProgress();

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/30 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {statusContent.icon}
          </div>
          <CardTitle className={`text-2xl ${statusContent.titleColor}`}>
            {statusContent.title}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {statusContent.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {statusContent.showProgress && (
            <div className="space-y-2">
              <Progress value={displayProgress} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {progress?.hasVideo && `Video: ${progress.videoProgress}%`}
                  {progress?.hasVideo && progress?.hasScreen && ' | '}
                  {progress?.hasScreen && `Screen: ${progress.screenProgress}%`}
                </span>
                <span className="font-medium">{Math.round(displayProgress)}%</span>
              </div>
            </div>
          )}
          
          {status === 'stuck' && (
            <Button 
              variant="outline" 
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Upload
            </Button>
          )}
          
          {status !== 'complete' && (
            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Please do not close this tab or browser</span>
            </div>
          )}
          
          {status === 'complete' && (
            <p className="text-sm text-muted-foreground">
              You will be redirected to the completion page shortly.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimesUpOverlay;
