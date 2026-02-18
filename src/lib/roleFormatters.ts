import { AppRole } from "@/hooks/useUserRoles";

/**
 * Format a role enum value to a human-readable display name
 */
export function formatRoleName(role: AppRole): string {
  const roleMap: Record<AppRole, string> = {
    platform_admin: "Platform Admin",
    partner_admin: "Partner Admin",
    hr_recruiter: "HR Recruiter",
    tech_spoc: "Tech SPOC",
    billing_contact: "Billing Contact",
    guest: "Guest"
  };
  
  return roleMap[role] || role;
}

/**
 * Format multiple roles into a comma-separated string
 */
export function formatRoles(roles: AppRole[]): string {
  if (!roles || roles.length === 0) return "No roles";
  return roles.map(formatRoleName).join(", ");
}

/**
 * Get a color variant for a role badge
 */
export function getRoleColor(role: AppRole): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "platform_admin":
      return "destructive";
    case "partner_admin":
      return "default";
    case "hr_recruiter":
    case "tech_spoc":
      return "secondary";
    default:
      return "outline";
  }
}
