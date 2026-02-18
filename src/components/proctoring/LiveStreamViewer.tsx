import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Loader2, AlertCircle, User, Wifi, WifiOff } from 'lucide-react';
import { ProctorViewer } from '@/lib/liveStreamWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface LiveStreamViewerProps {
  sessionId: string;
  candidateName?: string;
  candidateEmail?: string;
  onClose?: () => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed' | 'unavailable';

const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({
  sessionId,
  candidateName,
  candidateEmail,
  onClose,
}) => {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStreamAvailable, setIsStreamAvailable] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<ProctorViewer | null>(null);
  const [proctorId] = useState(() => `proctor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Check if stream is available
  const checkStreamAvailability = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('proctoring_sessions')
        .select('live_stream_active, ended_at')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      // Stream is available if session is active (not ended) and live_stream_active is true
      const available = data.live_stream_active && !data.ended_at;
      setIsStreamAvailable(available);

      if (!available) {
        setStatus('unavailable');
        setErrorMessage(data.ended_at ? 'Interview has ended' : 'Candidate stream not active');
      }

      return available;
    } catch (error) {
      logger.error('[LiveStreamViewer] Error checking availability:', error);
      setIsStreamAvailable(false);
      setStatus('unavailable');
      setErrorMessage('Failed to check stream availability');
      return false;
    }
  }, [sessionId]);

  // Connect to live stream
  const connectToStream = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);

    // First check if stream is available
    const available = await checkStreamAvailability();
    if (!available) return;

    // Create and connect viewer
    viewerRef.current = new ProctorViewer(sessionId, proctorId, {
      onRemoteStream: (stream) => {
        logger.proctoring('[LiveStreamViewer] Received remote stream');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => {
            logger.error('[LiveStreamViewer] Error playing video:', err);
          });
        }
        setStatus('connected');
      },
      onConnectionStateChange: (state) => {
        logger.proctoring(`[LiveStreamViewer] Connection state: ${state}`);
        if (state === 'connected') {
          setStatus('connected');
        } else if (state === 'failed') {
          setStatus('failed');
          setErrorMessage('Connection failed. The candidate may have network issues.');
        }
      },
      onError: (error) => {
        logger.error('[LiveStreamViewer] Stream error:', error);
        setStatus('failed');
        setErrorMessage(error.message);
      },
      onDisconnect: () => {
        setStatus('idle');
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      },
    });

    try {
      await viewerRef.current.connect();
    } catch (error) {
      logger.error('[LiveStreamViewer] Failed to connect:', error);
      setStatus('failed');
      setErrorMessage('Failed to connect to stream');
    }
  }, [sessionId, proctorId, checkStreamAvailability]);

  // Disconnect from stream
  const disconnectFromStream = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.disconnect();
      viewerRef.current = null;
    }
    setStatus('idle');
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Check availability on mount and periodically
  useEffect(() => {
    checkStreamAvailability();

    const interval = setInterval(checkStreamAvailability, 10000); // Check every 10 seconds

    return () => {
      clearInterval(interval);
      disconnectFromStream();
    };
  }, [checkStreamAvailability, disconnectFromStream]);

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500 text-white"><Wifi className="w-3 h-3 mr-1" /> Live</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Connecting</Badge>;
      case 'failed':
        return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'unavailable':
        return <Badge variant="secondary"><VideoOff className="w-3 h-3 mr-1" /> Unavailable</Badge>;
      default:
        return <Badge variant="outline">Ready</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="w-5 h-5" />
            Live Stream
          </CardTitle>
          {getStatusBadge()}
        </div>
        {(candidateName || candidateEmail) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            {candidateName || candidateEmail}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video container */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {status === 'connected' ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
              {status === 'connecting' ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin mb-3" />
                  <p>Connecting to candidate...</p>
                </>
              ) : status === 'failed' || status === 'unavailable' ? (
                <>
                  <AlertCircle className="w-12 h-12 mb-3 text-red-400" />
                  <p className="text-red-400">{errorMessage}</p>
                </>
              ) : (
                <>
                  <Video className="w-12 h-12 mb-3" />
                  <p>Click Connect to view live stream</p>
                </>
              )}
            </div>
          )}

          {/* Live indicator */}
          {status === 'connected' && (
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-white text-sm font-medium bg-black/50 px-2 py-0.5 rounded">LIVE</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {status === 'connected' ? (
            <Button variant="destructive" onClick={disconnectFromStream} className="flex-1">
              <VideoOff className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          ) : (
            <Button 
              onClick={connectToStream} 
              disabled={status === 'connecting' || isStreamAvailable === false}
              className="flex-1"
            >
              {status === 'connecting' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Connect to Live Stream
                </>
              )}
            </Button>
          )}
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          View-only live stream. Recording continues separately.
        </p>
      </CardContent>
    </Card>
  );
};

export default LiveStreamViewer;
