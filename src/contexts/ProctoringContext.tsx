import React, { createContext, useContext, ReactNode } from 'react';
import { useProctoring, ProctoringConfig } from '@/hooks/useProctoring';

// Type for the proctoring hook return value
type ProctoringContextType = ReturnType<typeof useProctoring> | null;

const ProctoringContext = createContext<ProctoringContextType>(null);

interface ProctoringProviderProps {
  children: ReactNode;
  attemptId: string;
  attemptType: 'interview' | 'learning' | 'certification';
  /** 
   * Optional config to control proctoring behavior.
   * By default, heavy AI analysis is deferred to post-interview for better candidate experience.
   */
  config?: ProctoringConfig;
  /**
   * Session token for unauthenticated candidate uploads (screenshots, recordings).
   * Required for interview proctoring to work correctly.
   */
  sessionToken?: string;
}

/**
 * Provider component that creates a single proctoring instance
 * and shares it across all child components.
 * 
 * PERFORMANCE OPTIMIZATION:
 * By default, heavy AI analysis (face detection, object detection) is deferred
 * to post-interview analysis. Only lightweight checks run during the interview:
 * - Tab switch detection
 * - Print screen blocking
 * - Multi-monitor detection
 * - VM detection
 * - Typing pattern analysis
 * - Copy/paste detection
 * 
 * This ensures smooth candidate experience on any device.
 */
export const ProctoringProvider: React.FC<ProctoringProviderProps> = ({
  children,
  attemptId,
  attemptType,
  config = { deferHeavyAnalysis: true },
  sessionToken,
}) => {
  const proctoring = useProctoring(attemptId, attemptType, config, sessionToken);

  return (
    <ProctoringContext.Provider value={proctoring}>
      {children}
    </ProctoringContext.Provider>
  );
};

/**
 * Hook to access the shared proctoring instance.
 * Must be used within a ProctoringProvider.
 */
export const useProctoringContext = () => {
  const context = useContext(ProctoringContext);
  if (!context) {
    throw new Error('useProctoringContext must be used within a ProctoringProvider');
  }
  return context;
};

/**
 * Hook that safely returns proctoring context or null if not within provider.
 * Useful for components that may or may not be within the proctoring flow.
 */
export const useProctoringContextSafe = () => {
  return useContext(ProctoringContext);
};
