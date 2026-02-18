/**
 * NetworkStatusBanner
 * 
 * Displays a non-blocking warning banner when network connection is lost.
 * Automatically hides when connection is restored.
 */

import React from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface NetworkStatusBannerProps {
  /** Show even when online (for testing) */
  forceShow?: boolean;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({ forceShow = false }) => {
  const { isOnline, offlineDurationSeconds } = useNetworkStatus();

  if (isOnline && !forceShow) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <Alert 
      variant="destructive" 
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-auto max-w-md shadow-lg animate-in slide-in-from-top-2"
    >
      <WifiOff className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-2">
        <span>
          Connection lost{offlineDurationSeconds > 0 && ` (${formatDuration(offlineDurationSeconds)})`}
        </span>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs opacity-75">Uploads paused, waiting to reconnect...</span>
      </AlertDescription>
    </Alert>
  );
};

export default NetworkStatusBanner;
