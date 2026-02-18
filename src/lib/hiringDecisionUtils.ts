/**
 * Centralized hiring decision utilities
 * Standardized values: strongly_recommend, recommend, consider, not_recommended
 */

export type HiringDecision = 'strongly_recommend' | 'recommend' | 'consider' | 'not_recommended';

export interface HiringDecisionInfo {
  label: string;
  description: string;
  color: string;
  chartColor: string;
}

/**
 * Map any hiring decision value (old or new) to the standardized new format
 */
export function normalizeHiringDecision(decision: string | null | undefined): HiringDecision {
  if (!decision) return 'not_recommended';
  
  const normalized = decision.toLowerCase().trim().replace(/\s+/g, '_');
  
  const mapping: Record<string, HiringDecision> = {
    // New values (standard)
    'strongly_recommend': 'strongly_recommend',
    'recommend': 'recommend',
    'consider': 'consider',
    'not_recommended': 'not_recommended',
    
    // Old values (legacy)
    'strong_hire': 'strongly_recommend',
    'hire': 'recommend',
    'maybe': 'consider',
    'reject': 'not_recommended',
    'no_hire': 'not_recommended',
    'strong_no_hire': 'not_recommended',
    'do_not_hire': 'not_recommended',
    'not_recommend': 'not_recommended',
  };
  
  return mapping[normalized] || 'not_recommended';
}

/**
 * Get display info for a hiring decision
 */
export function getHiringDecisionInfo(decision: string | null | undefined): HiringDecisionInfo {
  const normalized = normalizeHiringDecision(decision);
  
  const info: Record<HiringDecision, HiringDecisionInfo> = {
    'strongly_recommend': {
      label: 'Strong Hire',
      description: 'Exceptional candidate - Highly recommended for immediate hire',
      color: 'bg-success text-success-foreground',
      chartColor: '#22c55e', // green-500
    },
    'recommend': {
      label: 'Hire',
      description: 'Good candidate - Recommended for hire',
      color: 'bg-primary text-primary-foreground',
      chartColor: '#3b82f6', // blue-500
    },
    'consider': {
      label: 'Consider',
      description: 'Average candidate - Requires further evaluation',
      color: 'bg-warning text-warning-foreground',
      chartColor: '#f59e0b', // amber-500
    },
    'not_recommended': {
      label: 'Reject',
      description: 'Not recommended for this position',
      color: 'bg-destructive text-destructive-foreground',
      chartColor: '#ef4444', // red-500
    },
  };
  
  return info[normalized];
}

/**
 * Check if a decision is considered a "hire" (for statistics)
 */
export function isHireDecision(decision: string | null | undefined): boolean {
  const normalized = normalizeHiringDecision(decision);
  return normalized === 'strongly_recommend' || normalized === 'recommend';
}

/**
 * Check if a decision is considered a "no hire" (for statistics)
 */
export function isNoHireDecision(decision: string | null | undefined): boolean {
  const normalized = normalizeHiringDecision(decision);
  return normalized === 'not_recommended';
}

/**
 * Check if a decision is "consider/maybe" (for statistics)
 */
export function isConsiderDecision(decision: string | null | undefined): boolean {
  const normalized = normalizeHiringDecision(decision);
  return normalized === 'consider';
}

/**
 * Get all possible display labels for charts
 */
export function getHiringDecisionChartData(data: Array<{ hiring_decision?: string | null }>): Array<{ name: string; value: number; color: string }> {
  const counts: Record<HiringDecision, number> = {
    'strongly_recommend': 0,
    'recommend': 0,
    'consider': 0,
    'not_recommended': 0,
  };
  
  data.forEach(d => {
    const normalized = normalizeHiringDecision(d.hiring_decision);
    counts[normalized]++;
  });
  
  return Object.entries(counts)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: getHiringDecisionInfo(key).label,
      value,
      color: getHiringDecisionInfo(key).chartColor,
    }));
}
