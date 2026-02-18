// Permission categories and definitions
export const PERMISSION_CATEGORIES = {
  INTERVIEWS: 'Interviews',
  USERS: 'Users',
  REPORTS: 'Reports',
  ANALYTICS: 'Analytics',
  BILLING: 'Billing',
  ORGANIZATIONS: 'Organizations',
  SETTINGS: 'Settings',
  PROCTORING: 'Proctoring',
  LEARNING: 'Learning',
} as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES];

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: PermissionCategory;
}

// All available permissions
export const ALL_PERMISSIONS: Permission[] = [
  // Interview Management
  { id: 'create_interviews', name: 'Create Interviews', description: 'Create new interview assessments', category: PERMISSION_CATEGORIES.INTERVIEWS },
  { id: 'edit_interviews', name: 'Edit Interviews', description: 'Modify existing interviews', category: PERMISSION_CATEGORIES.INTERVIEWS },
  { id: 'delete_interviews', name: 'Delete Interviews', description: 'Delete interview assessments', category: PERMISSION_CATEGORIES.INTERVIEWS },
  { id: 'view_interviews', name: 'View Interviews', description: 'View interview details and configurations', category: PERMISSION_CATEGORIES.INTERVIEWS },
  { id: 'share_interviews', name: 'Share Interviews', description: 'Generate and share interview links', category: PERMISSION_CATEGORIES.INTERVIEWS },
  { id: 'manage_questions', name: 'Manage Questions', description: 'Add, edit, or remove interview questions', category: PERMISSION_CATEGORIES.INTERVIEWS },
  
  // User Management
  { id: 'create_users', name: 'Create Users', description: 'Add new users to the organization', category: PERMISSION_CATEGORIES.USERS },
  { id: 'edit_users', name: 'Edit Users', description: 'Modify user profiles and information', category: PERMISSION_CATEGORIES.USERS },
  { id: 'delete_users', name: 'Delete Users', description: 'Remove users from the organization', category: PERMISSION_CATEGORIES.USERS },
  { id: 'view_users', name: 'View Users', description: 'View user profiles and lists', category: PERMISSION_CATEGORIES.USERS },
  { id: 'assign_roles', name: 'Assign Roles', description: 'Assign or modify user roles', category: PERMISSION_CATEGORIES.USERS },
  { id: 'manage_teams', name: 'Manage Teams', description: 'Create and manage user teams', category: PERMISSION_CATEGORIES.USERS },
  
  // Reports
  { id: 'view_reports', name: 'View Reports', description: 'Access assessment and candidate reports', category: PERMISSION_CATEGORIES.REPORTS },
  { id: 'generate_reports', name: 'Generate Reports', description: 'Create custom reports', category: PERMISSION_CATEGORIES.REPORTS },
  { id: 'export_reports', name: 'Export Reports', description: 'Export reports to PDF or Excel', category: PERMISSION_CATEGORIES.REPORTS },
  { id: 'view_assessments', name: 'View Assessments', description: 'View detailed assessment results', category: PERMISSION_CATEGORIES.REPORTS },
  
  // Analytics
  { id: 'view_analytics', name: 'View Analytics', description: 'Access analytics dashboards', category: PERMISSION_CATEGORIES.ANALYTICS },
  { id: 'view_org_analytics', name: 'View Org Analytics', description: 'View organization-wide analytics', category: PERMISSION_CATEGORIES.ANALYTICS },
  { id: 'generate_analytics', name: 'Generate Analytics', description: 'Generate custom analytics reports', category: PERMISSION_CATEGORIES.ANALYTICS },
  { id: 'comparative_analytics', name: 'Comparative Analytics', description: 'Access comparative analytics features', category: PERMISSION_CATEGORIES.ANALYTICS },
  
  // Billing
  { id: 'view_billing', name: 'View Billing', description: 'View billing information and invoices', category: PERMISSION_CATEGORIES.BILLING },
  { id: 'manage_billing', name: 'Manage Billing', description: 'Update payment methods and billing details', category: PERMISSION_CATEGORIES.BILLING },
  { id: 'view_invoices', name: 'View Invoices', description: 'Access invoice history', category: PERMISSION_CATEGORIES.BILLING },
  { id: 'manage_subscription', name: 'Manage Subscription', description: 'Change subscription plans', category: PERMISSION_CATEGORIES.BILLING },
  
  // Organizations
  { id: 'view_organizations', name: 'View Organizations', description: 'View organization details', category: PERMISSION_CATEGORIES.ORGANIZATIONS },
  { id: 'manage_organizations', name: 'Manage Organizations', description: 'Create and modify organizations', category: PERMISSION_CATEGORIES.ORGANIZATIONS },
  { id: 'approve_organizations', name: 'Approve Organizations', description: 'Approve partner organization requests', category: PERMISSION_CATEGORIES.ORGANIZATIONS },
  { id: 'manage_org_members', name: 'Manage Org Members', description: 'Add or remove organization members', category: PERMISSION_CATEGORIES.ORGANIZATIONS },
  
  // Settings
  { id: 'view_settings', name: 'View Settings', description: 'View organization settings', category: PERMISSION_CATEGORIES.SETTINGS },
  { id: 'manage_settings', name: 'Manage Settings', description: 'Modify organization settings', category: PERMISSION_CATEGORIES.SETTINGS },
  { id: 'manage_integrations', name: 'Manage Integrations', description: 'Configure third-party integrations', category: PERMISSION_CATEGORIES.SETTINGS },
  { id: 'manage_custom_roles', name: 'Manage Custom Roles', description: 'Create and manage custom roles', category: PERMISSION_CATEGORIES.SETTINGS },
  
  // Proctoring
  { id: 'view_proctoring', name: 'View Proctoring', description: 'View proctoring sessions and recordings', category: PERMISSION_CATEGORIES.PROCTORING },
  { id: 'manage_proctoring', name: 'Manage Proctoring', description: 'Configure proctoring settings', category: PERMISSION_CATEGORIES.PROCTORING },
  { id: 'review_violations', name: 'Review Violations', description: 'Review and act on integrity violations', category: PERMISSION_CATEGORIES.PROCTORING },
  
  // Learning
  { id: 'view_learning', name: 'View Learning', description: 'Access learning materials and assessments', category: PERMISSION_CATEGORIES.LEARNING },
  { id: 'create_learning', name: 'Create Learning', description: 'Create learning assessments', category: PERMISSION_CATEGORIES.LEARNING },
  { id: 'manage_learning', name: 'Manage Learning', description: 'Manage learning content and progress', category: PERMISSION_CATEGORIES.LEARNING },
];

// System role default permissions
export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  platform_admin: ALL_PERMISSIONS.map(p => p.id),
  partner_admin: [
    'create_interviews', 'edit_interviews', 'delete_interviews', 'view_interviews', 'share_interviews', 'manage_questions',
    'create_users', 'edit_users', 'delete_users', 'view_users', 'assign_roles', 'manage_teams',
    'view_reports', 'generate_reports', 'export_reports', 'view_assessments',
    'view_analytics', 'view_org_analytics', 'generate_analytics', 'comparative_analytics',
    'view_billing', 'manage_billing', 'view_invoices', 'manage_subscription',
    'view_organizations', 'manage_org_members',
    'view_settings', 'manage_settings', 'manage_integrations', 'manage_custom_roles',
    'view_proctoring', 'manage_proctoring', 'review_violations',
    'view_learning', 'create_learning', 'manage_learning',
  ],
  hr_recruiter: [
    'create_interviews', 'edit_interviews', 'view_interviews', 'share_interviews', 'manage_questions',
    'view_users', 'manage_teams',
    'view_reports', 'generate_reports', 'export_reports', 'view_assessments',
    'view_analytics', 'view_org_analytics',
    'view_proctoring', 'review_violations',
  ],
  tech_spoc: [
    'create_interviews', 'edit_interviews', 'view_interviews', 'manage_questions',
    'view_users',
    'view_reports', 'view_assessments',
    'view_analytics',
    'view_proctoring',
    'view_learning', 'create_learning',
  ],
  billing_contact: [
    'view_billing', 'manage_billing', 'view_invoices', 'manage_subscription',
  ],
  candidate: [
    'view_learning',
  ],
  guest: [],
};

// Group permissions by category
export function getPermissionsByCategory(): Record<PermissionCategory, Permission[]> {
  const grouped: Record<string, Permission[]> = {};
  
  ALL_PERMISSIONS.forEach(permission => {
    if (!grouped[permission.category]) {
      grouped[permission.category] = [];
    }
    grouped[permission.category].push(permission);
  });
  
  return grouped as Record<PermissionCategory, Permission[]>;
}

// Get permissions for a role
export function getSystemRolePermissions(role: string): string[] {
  return SYSTEM_ROLE_PERMISSIONS[role] || [];
}

// Check if permission exists
export function isValidPermission(permissionId: string): boolean {
  return ALL_PERMISSIONS.some(p => p.id === permissionId);
}
