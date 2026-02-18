import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Upload, Loader2, AlertCircle, Video, Monitor } from 'lucide-react';
import { subscribeToUploadProgress, UploadProgress } from '@/lib/uploadProgressStore';
import { cn } from '@/lib/utils';

interface UploadProgressIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function UploadProgressIndicator({ className, showDetails = true }: UploadProgressIndicatorProps) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToUploadProgress(setProgress);
    return unsubscribe;
  }, []);

  if (!progress || (!progress.hasVideo && !progress.hasScreen)) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Upload className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (progress.isComplete) {
      return 'Recordings uploaded successfully!';
    }
    if (progress.videoStatus === 'uploading' || progress.screenStatus === 'uploading') {
      return 'Uploading recordings...';
    }
    if (progress.videoStatus === 'failed' || progress.screenStatus === 'failed') {
      return 'Some uploads failed. They will retry automatically.';
    }
    return 'Preparing uploads...';
  };

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardContent className="pt-4 pb-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            {progress.isComplete ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <Upload className="w-5 h-5 text-primary animate-pulse" />
            )}
            <span className="font-medium text-sm">{getStatusText()}</span>
          </div>

          {/* Overall Progress Bar */}
          <div className="space-y-1">
            <Progress 
              value={progress.overallProgress} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground text-right">
              {progress.overallProgress}% complete
            </p>
          </div>

          {/* Individual Progress Details */}
          {showDetails && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {progress.hasVideo && (
                <div className="flex items-center gap-2 text-xs">
                  <Video className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Camera:</span>
                  {getStatusIcon(progress.videoStatus)}
                  <span className={cn(
                    progress.videoStatus === 'completed' && 'text-success',
                    progress.videoStatus === 'failed' && 'text-destructive'
                  )}>
                    {progress.videoProgress}%
                  </span>
                </div>
              )}
              {progress.hasScreen && (
                <div className="flex items-center gap-2 text-xs">
                  <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Screen:</span>
                  {getStatusIcon(progress.screenStatus)}
                  <span className={cn(
                    progress.screenStatus === 'completed' && 'text-success',
                    progress.screenStatus === 'failed' && 'text-destructive'
                  )}>
                    {progress.screenProgress}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Upload continues message */}
          {!progress.isComplete && (
            <p className="text-xs text-muted-foreground mt-2">
              You can close this page. Upload will continue in the background.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default UploadProgressIndicator;
