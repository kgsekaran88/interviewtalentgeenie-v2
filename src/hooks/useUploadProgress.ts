import { useEffect, useState } from 'react';
import { 
  subscribeToUploadProgress, 
  UploadProgress, 
  resetUploadProgress,
  getUploadProgress 
} from '@/lib/uploadProgressStore';

/**
 * React hook for tracking upload progress
 * 
 * @returns Current upload progress state
 */
export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>(() => getUploadProgress());

  useEffect(() => {
    const unsubscribe = subscribeToUploadProgress(setProgress);
    return unsubscribe;
  }, []);

  return progress;
}

/**
 * Reset upload progress state
 * Call this when starting a new interview
 */
export { resetUploadProgress };
