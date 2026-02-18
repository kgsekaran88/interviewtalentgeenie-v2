import { useEffect } from 'react';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { logger } from '@/lib/logger';

/**
 * Hook to automatically trigger cleanup of stuck interview generations
 * Runs every 2 minutes to check for and recover stuck generations
 */
export const useAutoRecovery = () => {
  useEffect(() => {
    const runCleanup = async () => {
      try {
        const { data, error } = await invokeFunction('cleanup-stuck-generations');
        
        if (error) {
          logger.error('Auto-recovery error:', error);
          return;
        }
        
        if (data?.recovered > 0) {
          logger.info(`Auto-recovery: Recovered ${data.recovered} stuck generation(s)`);
        }
      } catch (error) {
        logger.error('Auto-recovery failed:', error);
      }
    };

    // Run immediately on mount
    runCleanup();

    // Then run every 2 minutes
    const interval = setInterval(runCleanup, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};
