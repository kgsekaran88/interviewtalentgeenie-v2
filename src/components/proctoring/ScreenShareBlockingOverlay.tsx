import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Monitor, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ScreenShareBlockingOverlayProps {
  isVisible: boolean;
  onScreenShareRestored: (newStream: MediaStream) => void;
}

/**
 * Blocking overlay shown when candidate stops screen sharing.
 * Forces them to re-share their screen before continuing.
 */
export const ScreenShareBlockingOverlay: React.FC<ScreenShareBlockingOverlayProps> = ({
  isVisible,
  onScreenShareRestored,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReShareScreen = async () => {
    setIsRequesting(true);
    setError(null);
    
    try {
      logger.proctoring('[ScreenShareBlockingOverlay] Requesting new screen share...');
      
      const newScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor', // Prefer entire screen
          frameRate: { ideal: 5, max: 15 }, // Low framerate for screen recording
        },
        audio: false,
      });
      
      // Verify we got a valid stream
      const videoTrack = newScreenStream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') {
        throw new Error('Screen share track is not active');
      }
      
      // Check if they shared entire screen (not just a window/tab)
      const settings = videoTrack.getSettings();
      const isEntireScreen = settings.displaySurface === 'monitor';
      
      if (!isEntireScreen) {
        logger.warn('[ScreenShareBlockingOverlay] User shared window/tab instead of entire screen');
        // Still allow but log warning - could be stricter here
      }
      
      logger.proctoring('[ScreenShareBlockingOverlay] Screen share restored successfully');
      onScreenShareRestored(newScreenStream);
      
    } catch (err: any) {
      logger.error('[ScreenShareBlockingOverlay] Failed to re-share screen:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Screen sharing was denied. Please click "Share Screen" and select your entire screen.');
      } else if (err.name === 'NotFoundError') {
        setError('No screen available to share. Please try again.');
      } else {
        setError('Failed to share screen. Please try again.');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-destructive/50 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive animate-pulse" />
          </div>
          <CardTitle className="text-xl text-destructive">
            Screen Sharing Stopped
          </CardTitle>
          <CardDescription className="text-base">
            You must share your entire screen to continue the interview. 
            This is required for proctoring purposes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              ⚠️ This violation has been recorded
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Stopping screen share during an interview is flagged as a high-severity violation.
            </p>
          </div>
          
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          <Button 
            onClick={handleReShareScreen}
            className="w-full"
            size="lg"
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Requesting Screen Share...
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4 mr-2" />
                Share Your Entire Screen
              </>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Select "Entire Screen" when prompted, not a specific window or tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScreenShareBlockingOverlay;
