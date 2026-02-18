/**
 * useNetworkStatus
 * 
 * Lightweight hook to monitor network connectivity.
 * Detects when user goes offline and provides status for UI warnings.
 * 
 * Zero overhead when online (passive event listeners only).
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

export interface NetworkStatus {
  isOnline: boolean;
  /** Timestamp when connection was lost (null if online) */
  offlineSince: number | null;
  /** Duration offline in seconds (0 if online) */
  offlineDurationSeconds: number;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    offlineSince: navigator.onLine ? null : Date.now(),
    offlineDurationSeconds: 0
  });

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const handleOnline = () => {
      logger.proctoring('[NetworkStatus] Connection restored');
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      setStatus({
        isOnline: true,
        offlineSince: null,
        offlineDurationSeconds: 0
      });
    };

    const handleOffline = () => {
      const offlineSince = Date.now();
      logger.warn('[NetworkStatus] Connection lost');
      setStatus({
        isOnline: false,
        offlineSince,
        offlineDurationSeconds: 0
      });

      // Update duration every second while offline
      intervalId = setInterval(() => {
        setStatus(prev => ({
          ...prev,
          offlineDurationSeconds: Math.floor((Date.now() - offlineSince) / 1000)
        }));
      }, 1000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize if already offline
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return status;
}

/**
 * Check if network is available (one-time check)
 */
export function checkNetworkAvailable(): boolean {
  return navigator.onLine;
}
