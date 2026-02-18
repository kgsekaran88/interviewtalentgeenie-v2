import { useProctoringContextSafe } from '@/contexts/ProctoringContext';
import { useProctoring } from './useProctoring';
import { logger } from '@/lib/logger';

/**
 * Enhanced proctoring hook that properly handles session finalization
 * and integrity score calculation.
 * 
 * This hook uses the ProctoringContext if available (recommended),
 * otherwise falls back to creating its own instance.
 */
export const useProctoringSession = (attemptId: string, attemptType: 'interview' | 'learning' | 'certification') => {
  // Try to get shared context first
  const contextProctoring = useProctoringContextSafe();
  
  // Fallback to own instance if not within a provider
  const ownProctoring = useProctoring(attemptId, attemptType);
  
  // Use context if available, otherwise use own instance
  const proctoring = contextProctoring || ownProctoring;

  /**
   * Properly finalizes the proctoring session with integrity score calculation
   * @param sessionToken - Optional session token for candidate authentication (unauthenticated uploads)
   */
  const finalizeSession = async (sessionToken?: string) => {
    if (!proctoring.sessionId) {
      logger.warn('No proctoring session to finalize');
      return;
    }

    try {
      // Pass explicit session ID and session token to ensure closure even if internal state is stale
      await proctoring.stopRecording(proctoring.sessionId, sessionToken);
      
      logger.proctoring('Proctoring session finalized successfully');
    } catch (error) {
      logger.error('Error finalizing proctoring session:', error);
      throw error;
    }
  };

  return {
    ...proctoring,
    finalizeSession,
    // Expose whether we're using context (for debugging)
    isUsingContext: !!contextProctoring,
  };
};
