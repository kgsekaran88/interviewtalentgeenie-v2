/**
 * StreamHealthGuard
 * 
 * Monitors stream health between pre-interview checks completion and interview start.
 * If a stream dies during this window, shows a blocking overlay requiring re-share.
 * 
 * This prevents the scenario where streams pass initial checks but die before
 * the MediaRecorder starts, resulting in no recording.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Monitor, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface StreamHealthGuardProps {
  videoStream: MediaStream | null;
  screenStream: MediaStream | null;
  isActive: boolean; // Only monitor when active (between checks and interview start)
  onVideoStreamDied: () => void;
  onScreenStreamDied: () => void;
  onVideoStreamRestored: (stream: MediaStream) => void;
  onScreenStreamRestored: (stream: MediaStream) => void;
  children: React.ReactNode;
}

type StreamIssue = 'none' | 'video' | 'screen' | 'both';

export const StreamHealthGuard: React.FC<StreamHealthGuardProps> = ({
  videoStream,
  screenStream,
  isActive,
  onVideoStreamDied,
  onScreenStreamDied,
  onVideoStreamRestored,
  onScreenStreamRestored,
  children
}) => {
  const [streamIssue, setStreamIssue] = useState<StreamIssue>('none');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryType, setRecoveryType] = useState<'video' | 'screen' | null>(null);
  
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(videoStream);
  const screenStreamRef = useRef<MediaStream | null>(screenStream);

  // Update refs when props change
  useEffect(() => {
    videoStreamRef.current = videoStream;
    screenStreamRef.current = screenStream;
  }, [videoStream, screenStream]);

  /**
   * Check if a stream is healthy (active and has live tracks)
   */
  const isStreamHealthy = useCallback((stream: MediaStream | null, type: 'video' | 'screen'): boolean => {
    if (!stream) return false;
    if (!stream.active) return false;
    
    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getVideoTracks();
    if (tracks.length === 0) return false;
    
    // All tracks should be live
    return tracks.every(track => track.readyState === 'live');
  }, []);

  /**
   * Periodic health check
   */
  useEffect(() => {
    if (!isActive) {
      // Clear any existing interval when not active
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkHealth = () => {
      const videoHealthy = isStreamHealthy(videoStreamRef.current, 'video');
      const screenHealthy = isStreamHealthy(screenStreamRef.current, 'screen');

      logger.proctoring('[StreamHealthGuard] Health check:', { videoHealthy, screenHealthy });

      if (!videoHealthy && !screenHealthy) {
        setStreamIssue('both');
        onVideoStreamDied();
        onScreenStreamDied();
      } else if (!videoHealthy) {
        setStreamIssue('video');
        onVideoStreamDied();
      } else if (!screenHealthy) {
        setStreamIssue('screen');
        onScreenStreamDied();
      } else {
        setStreamIssue('none');
      }
    };

    // Initial check
    checkHealth();

    // Set up periodic checks every 2 seconds
    checkIntervalRef.current = setInterval(checkHealth, 2000);

    // Also set up track ended listeners for immediate detection
    const videoTrack = videoStream?.getVideoTracks()[0];
    const screenTrack = screenStream?.getVideoTracks()[0];

    const handleVideoEnded = () => {
      logger.warn('[StreamHealthGuard] Video track ended');
      setStreamIssue(prev => prev === 'screen' || prev === 'both' ? 'both' : 'video');
      onVideoStreamDied();
    };

    const handleScreenEnded = () => {
      logger.warn('[StreamHealthGuard] Screen track ended');
      setStreamIssue(prev => prev === 'video' || prev === 'both' ? 'both' : 'screen');
      onScreenStreamDied();
    };

    if (videoTrack) {
      videoTrack.addEventListener('ended', handleVideoEnded);
    }
    if (screenTrack) {
      screenTrack.addEventListener('ended', handleScreenEnded);
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (videoTrack) {
        videoTrack.removeEventListener('ended', handleVideoEnded);
      }
      if (screenTrack) {
        screenTrack.removeEventListener('ended', handleScreenEnded);
      }
    };
  }, [isActive, videoStream, screenStream, isStreamHealthy, onVideoStreamDied, onScreenStreamDied]);

  /**
   * Handle camera recovery
   */
  const handleRecoverCamera = async () => {
    setIsRecovering(true);
    setRecoveryType('video');

    try {
      logger.proctoring('[StreamHealthGuard] Attempting camera recovery...');
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });

      logger.proctoring('[StreamHealthGuard] Camera recovered successfully');
      onVideoStreamRestored(newStream);
      setStreamIssue(prev => prev === 'both' ? 'screen' : 'none');
    } catch (err) {
      logger.error('[StreamHealthGuard] Camera recovery failed:', err);
    } finally {
      setIsRecovering(false);
      setRecoveryType(null);
    }
  };

  /**
   * Handle screen share recovery
   */
  const handleRecoverScreen = async () => {
    setIsRecovering(true);
    setRecoveryType('screen');

    try {
      logger.proctoring('[StreamHealthGuard] Attempting screen share recovery...');
      
      const newStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 15, max: 15 },
          cursor: 'always'
        },
        audio: false
      } as DisplayMediaStreamOptions);

      // Validate it's entire screen
      const screenTrack = newStream.getVideoTracks()[0];
      if (screenTrack) {
        const settings = screenTrack.getSettings();
        const displaySurface = (settings as any).displaySurface;
        
        if (displaySurface && displaySurface !== 'monitor') {
          newStream.getTracks().forEach(track => track.stop());
          logger.warn('[StreamHealthGuard] User shared window/tab instead of monitor');
          return;
        }
      }

      logger.proctoring('[StreamHealthGuard] Screen share recovered successfully');
      onScreenStreamRestored(newStream);
      setStreamIssue(prev => prev === 'both' ? 'video' : 'none');
    } catch (err) {
      logger.error('[StreamHealthGuard] Screen share recovery failed:', err);
    } finally {
      setIsRecovering(false);
      setRecoveryType(null);
    }
  };

  // If no issue, render children normally
  if (streamIssue === 'none' || !isActive) {
    return <>{children}</>;
  }

  // Render blocking overlay for stream issues
  return (
    <>
      {children}
      
      {/* Blocking Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">
              {streamIssue === 'both' 
                ? 'Camera and Screen Share Disconnected'
                : streamIssue === 'video' 
                  ? 'Camera Disconnected' 
                  : 'Screen Share Stopped'
              }
            </CardTitle>
            <CardDescription>
              {streamIssue === 'both'
                ? 'Both your camera and screen share have stopped. Please restore them to continue.'
                : streamIssue === 'video'
                  ? 'Your camera has disconnected. Please click below to reconnect.'
                  : 'Your screen share has stopped. Please click below to share your screen again.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You cannot proceed with the interview until {streamIssue === 'both' ? 'both streams are' : 'this is'} restored.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-3">
              {(streamIssue === 'video' || streamIssue === 'both') && (
                <Button 
                  onClick={handleRecoverCamera}
                  disabled={isRecovering}
                  className="w-full"
                  variant={streamIssue === 'video' ? 'default' : 'outline'}
                >
                  {isRecovering && recoveryType === 'video' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reconnecting Camera...
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-4 w-4" />
                      Reconnect Camera
                    </>
                  )}
                </Button>
              )}

              {(streamIssue === 'screen' || streamIssue === 'both') && (
                <Button 
                  onClick={handleRecoverScreen}
                  disabled={isRecovering}
                  className="w-full"
                  variant={streamIssue === 'screen' ? 'default' : 'outline'}
                >
                  {isRecovering && recoveryType === 'screen' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Requesting Screen Share...
                    </>
                  ) : (
                    <>
                      <Monitor className="mr-2 h-4 w-4" />
                      Share Screen Again
                    </>
                  )}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              If this keeps happening, please refresh the page and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default StreamHealthGuard;
