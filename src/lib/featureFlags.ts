/**
 * Product feature flags — toggle unfinished / deferred modules without deleting code.
 * Flip these as modules are ready for release.
 */
export const FEATURE_FLAGS = {
  /** Learning hub, practice assessments, learning plans */
  learning: false,
  /** Certification exams, certificates, verify flow */
  certifications: false,
  /** ATS integrations, webhooks, sync UI/surfaces */
  ats: false,
  /** Online card checkout (Stripe/Razorpay). Offline invoice payment remains. */
  onlinePayments: false,
  /** In-app chatbot for user guidance / support */
  chatbot: true,
  /** Self-host deploy configurator / dashboard / history (launch uses Supabase Pro + CDN) */
  selfHostDeploy: false,
  /** Internal QA: testing hub, architecture diagrams */
  internalQa: false,
  /** Predictive / advanced analytics experiments on /admin/analytics */
  advancedAnalytics: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] === true;
}
