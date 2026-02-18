import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Save, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type AppRole = 
  | 'admin'
  | 'platform_admin'
  | 'partner_admin'
  | 'hr_recruiter'
  | 'tech_spoc'
  | 'candidate'
  | 'guest'
  | 'billing_contact'
  | 'contributor'
  | 'hr';

interface Permission {
  id: string;
  action_name: string;
  action_description: string;
  allowed_roles: AppRole[];
  updated_at: string;
}

const ALL_ROLES: { value: AppRole; label: string; color: string }[] = [
  { value: 'admin', label: 'Admin', color: 'bg-red-500' },
  { value: 'platform_admin', label: 'Platform Admin', color: 'bg-purple-500' },
  { value: 'partner_admin', label: 'Partner Admin', color: 'bg-blue-500' },
  { value: 'hr_recruiter', label: 'HR Recruiter', color: 'bg-green-500' },
  { value: 'tech_spoc', label: 'Tech SPOC', color: 'bg-yellow-500' },
  { value: 'candidate', label: 'Candidate', color: 'bg-gray-500' },
  { value: 'guest', label: 'Guest', color: 'bg-slate-500' },
];

const RolePermissionsManagement = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast, errorToast, successToast } = useUserFriendlyToast();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("role_permissions")
      .select("*")
      .order("action_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load permissions",
        variant: "destructive",
      });
    } else {
      // Filter out ta_creator from allowed_roles since we're using tech_spoc only
      const filteredData = data?.map(perm => ({
        ...perm,
        allowed_roles: perm.allowed_roles.filter((role: string) => role !== 'ta_creator')
      })) || [];
      setPermissions(filteredData as Permission[]);
    }
    setLoading(false);
  };

  const toggleRole = async (permissionId: string, role: AppRole) => {
    const permission = permissions.find(p => p.id === permissionId);
    if (!permission) return;

    const newRoles = permission.allowed_roles.includes(role)
      ? permission.allowed_roles.filter(r => r !== role)
      : [...permission.allowed_roles, role];

    // Optimistic update
    setPermissions(permissions.map(p => 
      p.id === permissionId ? { ...p, allowed_roles: newRoles } : p
    ));

    setSaving(permissionId);
    const { error } = await supabase
      .from("role_permissions")
      .update({ allowed_roles: newRoles })
      .eq("id", permissionId);

    setSaving(null);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
      // Revert on error
      fetchPermissions();
    } else {
      toast({
        title: "Success",
        description: "Permission updated successfully",
      });
    }
  };

  const getRoleColor = (roleName: string) => {
    return ALL_ROLES.find(r => r.value === roleName)?.color || 'bg-gray-500';
  };

  const getRoleLabel = (roleName: string) => {
    return ALL_ROLES.find(r => r.value === roleName)?.label || roleName;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
            <span className="hidden sm:inline">Role Permissions Management</span>
            <span className="sm:hidden">Permissions</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
            Configure role-based access control
          </p>
        </div>
        <Button onClick={fetchPermissions} variant="outline" className="min-h-[44px] self-start sm:self-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {permissions.map((permission) => (
          <Card key={permission.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {permission.action_name.replace(/_/g, ' ').toUpperCase()}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {permission.action_description}
                  </CardDescription>
                </div>
                {saving === permission.id && (
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Label className="text-sm font-medium w-full mb-2">
                    Currently allowed roles:
                  </Label>
                  {permission.allowed_roles.length === 0 ? (
                    <Badge variant="secondary">No roles assigned</Badge>
                  ) : (
                    permission.allowed_roles.map(role => (
                      <Badge 
                        key={role} 
                        className={`${getRoleColor(role)} text-white`}
                      >
                        {getRoleLabel(role)}
                      </Badge>
                    ))
                  )}
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-3 block">
                    Configure access:
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {ALL_ROLES.map((role) => (
                      <div key={role.value} className="flex items-center space-x-2 min-h-[44px]">
                        <Checkbox
                          id={`${permission.id}-${role.value}`}
                          checked={permission.allowed_roles.includes(role.value)}
                          onCheckedChange={() => toggleRole(permission.id, role.value)}
                          disabled={saving === permission.id}
                          className="h-5 w-5"
                        />
                        <label
                          htmlFor={`${permission.id}-${role.value}`}
                          className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {role.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Last updated: {new Date(permission.updated_at).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-warning/5 border-warning/20">
        <CardHeader>
          <CardTitle className="text-warning flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Notice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Important:</strong> Changes to permissions take effect immediately for all users.
          </p>
          <p>
            Removing critical permissions may prevent users from performing essential tasks. 
            Always ensure at least one administrative role has access to critical actions.
          </p>
          <p>
            <strong>Platform Admin</strong> role always has full access to this permissions management system.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolePermissionsManagement;
