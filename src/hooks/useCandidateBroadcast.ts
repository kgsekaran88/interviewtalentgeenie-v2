/**
 * Hook to enable live streaming from candidate side.
 * Integrates with ProctoringMonitor to broadcast video to proctors.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { CandidateBroadcaster } from '@/lib/liveStreamWebRTC';
import { logger } from '@/lib/logger';

interface UseCandidateBroadcastOptions {
  sessionId: string | null;
  videoStream: MediaStream | null;
  enabled?: boolean;
}

export const useCandidateBroadcast = ({
  sessionId,
  videoStream,
  enabled = true,
}: UseCandidateBroadcastOptions) => {
  const broadcasterRef = useRef<CandidateBroadcaster | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Start broadcasting
  const startBroadcast = useCallback(async () => {
    if (!sessionId || !videoStream || !enabled) {
      logger.proctoring('[useCandidateBroadcast] Cannot start: missing sessionId, stream, or disabled');
      return;
    }

    // Don't restart if already broadcasting
    if (broadcasterRef.current) {
      logger.proctoring('[useCandidateBroadcast] Already broadcasting');
      return;
    }

    try {
      logger.proctoring(`[useCandidateBroadcast] Starting broadcast for session ${sessionId}`);
      broadcasterRef.current = new CandidateBroadcaster(sessionId);
      await broadcasterRef.current.startListening(videoStream);
      setIsBroadcasting(true);
      logger.proctoring('[useCandidateBroadcast] Broadcast started');
    } catch (error) {
      logger.error('[useCandidateBroadcast] Failed to start broadcast:', error);
      broadcasterRef.current = null;
    }
  }, [sessionId, videoStream, enabled]);

  // Stop broadcasting
  const stopBroadcast = useCallback(async () => {
    if (broadcasterRef.current) {
      try {
        await broadcasterRef.current.stop();
        logger.proctoring('[useCandidateBroadcast] Broadcast stopped');
      } catch (error) {
        logger.error('[useCandidateBroadcast] Error stopping broadcast:', error);
      }
      broadcasterRef.current = null;
      setIsBroadcasting(false);
    }
  }, []);

  // Auto-start when dependencies are ready
  useEffect(() => {
    if (sessionId && videoStream && enabled) {
      startBroadcast();
    }

    return () => {
      // Cleanup on unmount
      if (broadcasterRef.current) {
        broadcasterRef.current.stop().catch((err) => logger.error('broadcaster stop error', err));
        broadcasterRef.current = null;
      }
    };
  }, [sessionId, videoStream, enabled, startBroadcast]);

  return {
    isBroadcasting,
    startBroadcast,
    stopBroadcast,
  };
};
