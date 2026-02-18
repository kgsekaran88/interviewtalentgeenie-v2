import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Runtime hook to detect duplicate layout wrappers during development
 * Guards against accidentally wrapping pages with multiple layouts
 */
export const useLayoutGuard = (layoutName: 'AppLayout' | 'AdminLayout' | 'PartnerLayout' | 'RecruiterLayout' | 'InterviewerLayout' | 'CandidateLayout') => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // Check for duplicate AppNavbar elements in the DOM
    const navbars = document.querySelectorAll('[data-component="app-navbar"]');
    
    if (navbars.length > 1) {
      logger.error(
        `[Layout Guard] Duplicate layout detected! Found ${navbars.length} AppNavbar instances.`,
        `\nCurrent layout: ${layoutName}`,
        '\nThis page should not use AppLayout wrapper.',
        '\nHierarchical layouts (AdminLayout, PartnerLayout, etc.) already include AppNavbar.'
      );
    }
  }, [layoutName]);
};
