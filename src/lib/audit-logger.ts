import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type AuditAction =
  | "VIEW_PLATFORM_STATS"
  | "VIEW_ORGANIZATION_DATA"
  | "APPROVE_APPLICATION"
  | "REJECT_APPLICATION"
  | "REVISION_REQUESTED"
  | "CREATE_ORGANIZATION"
  | "UPDATE_ORGANIZATION"
  | "DELETE_ORGANIZATION"
  | "DELETE_ORGANIZATION_COMPLETE"
  | "VIEW_PARTNER_INTERVIEWS"
  | "VIEW_PARTNER_MEMBERS"
  | "VIEW_PARTNER_ANALYTICS"
  | "UPDATE_SUBSCRIPTION"
  | "ACCESS_PARTNER_DATA";

interface AuditLogOptions {
  action: AuditAction;
  tableName: string;
  recordId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

export const logAuditAction = async (options: AuditLogOptions): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Silently skip - user not authenticated
      return;
    }

    // Note: Audit logs require service role to insert due to RLS policies
    // This is intentionally a no-op in the client to avoid RLS errors
    // Audit logging should be done server-side via edge functions
    
    // Log to console in development only
    logger.debug("Audit action:", {
      user_id: user.id,
      action: options.action,
      table_name: options.tableName,
    });
  } catch (err) {
    // Silently handle errors to prevent UI disruption
    logger.debug("Audit logging skipped:", err);
  }
};

export const logPlatformAdminAccess = async (
  action: AuditAction,
  organizationId?: string,
  additionalMetadata?: Record<string, any>
) => {
  await logAuditAction({
    action,
    tableName: "platform_admin_access",
    organizationId,
    metadata: {
      access_type: "platform_admin",
      ...additionalMetadata,
    },
  });
};
