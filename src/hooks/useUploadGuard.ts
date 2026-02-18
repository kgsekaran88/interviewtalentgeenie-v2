/**
 * useUploadGuard
 * 
 * Prevents users from accidentally leaving the page while uploads are in progress.
 * Uses the browser's beforeunload event to show a confirmation dialog.
 * 
 * RACE CONDITION FIXES:
 * - Uses state instead of refs for reactive blocking status
 * - Subscribes to progress store for real-time updates
 * - Properly cleans up listeners on unmount
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { getPendingUploadCount } from '@/lib/backgroundUploader';
import { subscribeToUploadProgress, UploadProgress } from '@/lib/uploadProgressStore';

interface UseUploadGuardOptions {
  /** Whether the guard is active */
  enabled: boolean;
  /** Custom message (browsers often override this with their own) */
  message?: string;
}

/**
 * Hook that prevents page navigation/close during active uploads
 * 
 * Usage:
 * const { isBlocking, forceAllow } = useUploadGuard({ enabled: isUploading });
 * 
 * @returns 
 * - isBlocking: Whether the guard is currently blocking navigation
 * - forceAllow: Function to temporarily disable the guard (for programmatic navigation)
 */
export function useUploadGuard({ 
  enabled, 
  message = 'Your interview recording is still uploading. If you leave now, your recording may be lost.' 
}: UseUploadGuardOptions) {
  const [isBlocking, setIsBlocking] = useState(false);
  const forceAllowRef = useRef(false);
  const currentProgressRef = useRef<UploadProgress | null>(null);

  // Subscribe to upload progress for real-time blocking status
  useEffect(() => {
    if (!enabled) {
      setIsBlocking(false);
      return;
    }

    const unsubscribe = subscribeToUploadProgress((progress) => {
      currentProgressRef.current = progress;
      // Block if we have uploads and they're not complete
      const shouldBlock = (progress.hasVideo || progress.hasScreen) && !progress.isComplete;
      setIsBlocking(shouldBlock);
    });

    // Also check IndexedDB for pending uploads (handles page refresh scenario)
    getPendingUploadCount().then(count => {
      if (count > 0 && !currentProgressRef.current?.isComplete) {
        setIsBlocking(true);
      }
    });

    return unsubscribe;
  }, [enabled]);

  // beforeunload handler - uses ref to get latest state without re-registering
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Skip if force allowed (for programmatic navigation)
      if (forceAllowRef.current) {
        logger.proctoring('[UploadGuard] Force allowed, skipping block');
        return;
      }
      
      // Check current progress directly from ref (avoids stale closure)
      const progress = currentProgressRef.current;
      const hasActiveUploads = progress && (progress.hasVideo || progress.hasScreen) && !progress.isComplete;
      
      if (!hasActiveUploads) {
        return;
      }

      logger.proctoring('[UploadGuard] Blocking navigation - uploads in progress');
      
      // Standard way to show confirmation
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = message;
      return message;
    };

    logger.proctoring('[UploadGuard] Adding beforeunload listener');
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      logger.proctoring('[UploadGuard] Removing beforeunload listener');
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, message]);

  // Function to force allow navigation (for programmatic navigation after cleanup)
  const forceAllow = useCallback(() => {
    logger.proctoring('[UploadGuard] Force allowing navigation');
    forceAllowRef.current = true;
    setIsBlocking(false);
  }, []);

  return {
    isBlocking,
    forceAllow,
  };
}

export default useUploadGuard;
