/**
 * Role-Access Matrix — Single source of truth for which roles can access which routes.
 *
 * Used by access-control tests to systematically verify every role × route combination.
 *
 * Roles (6):
 *   platform_admin  — God mode, bypasses all role checks
 *   partner_admin   — Full org management
 *   hr_recruiter    — Recruiting + interview management
 *   tech_spoc       — Technical review only
 *   billing_contact — Billing only
 *   guest           — Learning hub only
 */
import type { TestUserKey } from './helpers';

export interface RouteAccessEntry {
  /** Route path (relative to baseURL) */
  path: string;
  /** Human-readable page name */
  name: string;
  /** Layout group for organizing tests */
  group: 'public' | 'auth-any' | 'admin' | 'partner' | 'recruiting' | 'learning' | 'billing';
  /** Roles that should be ALLOWED to access this page */
  allowedRoles: TestUserKey[];
  /** Roles that should be DENIED access (redirected to /auth or another page) */
  deniedRoles: TestUserKey[];
  /** Optional: regex to match on the page to confirm it loaded */
  expectHeading?: RegExp;
  /** If true, the page may redirect the user to a different valid route (not /auth) */
  mayRedirect?: boolean;
}

// ─── All 6 roles for convenience ─────────────────────────────────────────────
const ALL_ROLES: TestUserKey[] = ['platformAdmin', 'partnerAdmin', 'hrRecruiter', 'techSpoc', 'billingContact', 'guest'];
const ORG_ROLES: TestUserKey[] = ['platformAdmin', 'partnerAdmin', 'hrRecruiter', 'techSpoc', 'billingContact'];
const RECRUITING_ROLES: TestUserKey[] = ['platformAdmin', 'partnerAdmin', 'hrRecruiter', 'techSpoc'];
const PARTNER_ROLES: TestUserKey[] = ['platformAdmin', 'partnerAdmin', 'hrRecruiter', 'techSpoc', 'billingContact'];
// Roles that can access /partner/settings (require org membership + admin role)
const PARTNER_ADMIN_ROLES: TestUserKey[] = ['partnerAdmin'];
// Roles that can access /partner/users (platform_admin OR partner_admin — role check only)
const USER_MGMT_ROLES: TestUserKey[] = ['platformAdmin', 'partnerAdmin'];
// Roles that can access /partner/billing (platform_admin, partner_admin, billing_contact — role check only)
const BILLING_ROLES: TestUserKey[] = ['platformAdmin', 'partnerAdmin', 'billingContact'];
const ADMIN_ONLY: TestUserKey[] = ['platformAdmin'];

function except(base: TestUserKey[], ...exclude: TestUserKey[]): TestUserKey[] {
  return base.filter(r => !exclude.includes(r));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE ACCESS MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

export const PUBLIC_ROUTES: RouteAccessEntry[] = [
  { path: '/', name: 'Landing Page', group: 'public', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /talentgeenie|interview|hire/i },
  { path: '/auth', name: 'Auth Page', group: 'public', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /welcome|sign|login/i },
  { path: '/pricing', name: 'Pricing Page', group: 'public', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /pricing|plan|price/i },
  { path: '/learning', name: 'Learning Catalog', group: 'public', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /learning|course|training|catalog/i },
  { path: '/learning-pricing', name: 'Learning Pricing', group: 'public', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /pricing|plan|learning/i },
  { path: '/certifications', name: 'Certifications', group: 'public', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /certif|learning|course/i },
  { path: '/verify-certificate', name: 'Verify Certificate', group: 'public', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /verify|certificate/i },
];

export const AUTH_ANY_ROUTES: RouteAccessEntry[] = [
  { path: '/profile', name: 'Profile', group: 'auth-any', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /profile|account|setting/i },
  { path: '/settings', name: 'Settings', group: 'auth-any', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /setting|preference/i },
  { path: '/notifications', name: 'Notifications', group: 'auth-any', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /notification|alert/i },
  { path: '/my-applications', name: 'My Applications', group: 'auth-any', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /application|interview|applied/i },
  { path: '/learning-dashboard', name: 'Learning Dashboard', group: 'learning', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /learning|dashboard|progress/i },
  { path: '/learning-history', name: 'Learning History', group: 'learning', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /history|learning|completed/i },
  { path: '/my-learning-plan', name: 'My Learning Plan', group: 'learning', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /learning|plan|path/i },
  { path: '/my-certificates', name: 'My Certificates', group: 'learning', allowedRoles: ALL_ROLES, deniedRoles: [], expectHeading: /certif|badge|achievement/i },
];

export const ADMIN_ROUTES: RouteAccessEntry[] = [
  { path: '/admin', name: 'Admin Hub', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /admin|hub|platform/i },
  { path: '/admin/organizations', name: 'Organizations', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /organization|partner/i },
  { path: '/admin/user-management', name: 'User Management', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /user|management/i },
  { path: '/admin/role-assignment', name: 'Role Assignment', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /role|assign/i },
  { path: '/admin/role-permissions', name: 'Role Permissions', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /permission|role/i },
  { path: '/admin/analytics', name: 'Analytics', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /analytics|dashboard|report/i },
  { path: '/admin/billing', name: 'Admin Billing', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /billing|subscription|plan/i },
  { path: '/admin/plan-management', name: 'Plan Management', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /plan|subscription/i },
  { path: '/admin/promotions', name: 'Promotions', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /promotion|discount|coupon/i },
  { path: '/admin/email-configuration', name: 'Email Configuration', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /email|template|config/i },
  { path: '/admin/ai-configuration', name: 'AI Configuration', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /ai|model|config/i },
  { path: '/admin/chatbot-management', name: 'Chatbot Management', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /chatbot|assistant|ai/i },
  { path: '/admin/learning-management', name: 'Learning Management', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /learning|education|course/i },
  { path: '/admin/certification-admin', name: 'Certification Admin', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /certif|exam|admin/i },
  { path: '/admin/system-monitoring', name: 'System Monitoring', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /monitor|system|health/i },
  { path: '/admin/operation-logs', name: 'Operation Logs', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /log|operation|audit/i },
  { path: '/admin/ai-usage-monitoring', name: 'AI Usage Monitoring', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /ai|usage|monitor/i },
  { path: '/admin/cost-monitoring', name: 'Cost Monitoring', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /cost|expense|budget/i },
  { path: '/admin/settings', name: 'Admin Settings', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /setting|config|preference/i },
  { path: '/admin/documentation', name: 'Documentation', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /doc|guide|help/i },
  { path: '/admin/applications', name: 'Partner Applications', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /partner|application/i },
  { path: '/admin/payment-gateways', name: 'Payment Gateways', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /payment|gateway/i },
  { path: '/admin/testing-hub', name: 'Testing Hub', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /test|hub|quality/i },
  { path: '/admin/scheduled-jobs', name: 'Scheduled Jobs', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /schedule|job|cron/i },
  { path: '/admin/training', name: 'Training Management', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /training|manage/i },
  { path: '/admin/architecture', name: 'Architecture', group: 'admin', allowedRoles: ADMIN_ONLY, deniedRoles: except(ALL_ROLES, 'platformAdmin'), expectHeading: /architect|system|diagram/i },
];

export const PARTNER_ROUTES: RouteAccessEntry[] = [
  { path: '/partner/portal', name: 'Partner Portal', group: 'partner', allowedRoles: PARTNER_ROLES, deniedRoles: ['guest'], expectHeading: /partner|hub|portal|organization/i },
  { path: '/partner/dashboard', name: 'Partner Dashboard', group: 'partner', allowedRoles: PARTNER_ROLES, deniedRoles: ['guest'], expectHeading: /dashboard|overview|partner/i },
  { path: '/partner/manage', name: 'Manage Organization', group: 'partner', allowedRoles: PARTNER_ROLES, deniedRoles: ['guest'], expectHeading: /manage|organization|partner/i },
  { path: '/partner/settings', name: 'Partner Settings', group: 'partner', allowedRoles: PARTNER_ADMIN_ROLES, deniedRoles: except(ALL_ROLES, ...PARTNER_ADMIN_ROLES), expectHeading: /setting|config|partner|organization/i, mayRedirect: true },
  { path: '/partner/analytics', name: 'Partner Analytics', group: 'partner', allowedRoles: PARTNER_ROLES, deniedRoles: ['guest'], expectHeading: /analytics|report|insight/i },
  { path: '/partner/users', name: 'Partner Users', group: 'partner', allowedRoles: USER_MGMT_ROLES, deniedRoles: except(ALL_ROLES, ...USER_MGMT_ROLES), expectHeading: /user|team|member/i, mayRedirect: true },
  { path: '/partner/billing', name: 'Partner Billing', group: 'partner', allowedRoles: BILLING_ROLES, deniedRoles: except(ALL_ROLES, ...BILLING_ROLES), expectHeading: /billing|invoice|payment|subscription/i },
];

export const RECRUITING_ROUTES: RouteAccessEntry[] = [
  { path: '/partner/recruiting/jd-builder', name: 'JD Builder', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /job description|jd|position|builder/i },
  { path: '/partner/recruiting/create-interview', name: 'Create Interview', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /create|new|interview/i },
  { path: '/partner/recruiting/quick-create', name: 'Quick Create', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /quick|create|fast/i },
  { path: '/partner/recruiting/interviews', name: 'Interviews List', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /interview|assessment|position/i },
  { path: '/partner/recruiting/pending-reviews', name: 'Pending Reviews', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /pending|review|technical/i },
  { path: '/partner/recruiting/proctoring', name: 'Proctoring Dashboard', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /proctoring|monitor|session/i },
  { path: '/partner/recruiting/proctoring-settings', name: 'Proctoring Settings', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /proctoring|setting|config/i },
  { path: '/partner/recruiting/question-repository', name: 'Question Repository', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /question|repository|bank|library/i },
  { path: '/partner/recruiting/templates', name: 'Templates', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /template|library|saved/i },
  { path: '/partner/recruiting/report-builder', name: 'Report Builder', group: 'recruiting', allowedRoles: RECRUITING_ROLES, deniedRoles: ['billingContact', 'guest'], expectHeading: /report|builder|analytics/i },
];

// ─── Complete matrix ─────────────────────────────────────────────────────────
export const ALL_ROUTE_ENTRIES: RouteAccessEntry[] = [
  ...PUBLIC_ROUTES,
  ...AUTH_ANY_ROUTES,
  ...ADMIN_ROUTES,
  ...PARTNER_ROUTES,
  ...RECRUITING_ROUTES,
];
