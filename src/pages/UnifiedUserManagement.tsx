import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { logger } from "@/lib/logger";

import { Users, Shield, Plus, Trash2, UserPlus, Loader2, Building2, Edit2, Mail, CheckCircle } from "lucide-react";
import { EmailResendButton } from "@/components/EmailResendButton";
import { AppRole, useUserRoles } from "@/hooks/useUserRoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
  org_status?: 'active' | 'inactive';
  joined_at?: string;
}

// Roles that Partner Admins can assign within their organization
// Partner admins can create other partner admins for their org and manage billing contacts
const PARTNER_ASSIGNABLE_ROLES: AppRole[] = [
  'partner_admin',      // Can create other org admins
  'hr_recruiter',       // HR team members
  'tech_spoc',          // Technical points of contact (org-specific when created by partner admin)
  'billing_contact'     // Billing and payment managers
];

// Roles that Platform Admins can assign across the entire platform
const PLATFORM_ASSIGNABLE_ROLES: AppRole[] = [
  'platform_admin',     // Global platform administrators
  'partner_admin',      // Organization administrators
  'hr_recruiter',       // HR team members
  'tech_spoc',          // Technical points of contact
  'billing_contact',    // Billing and payment managers
  'guest'               // Platform users for learning/certifications
];

// Roles that are always global (no org required)
const GLOBAL_ONLY_ROLES: AppRole[] = ['platform_admin', 'guest'];

// Roles that always require an organization
const ORG_REQUIRED_ROLES: AppRole[] = ['partner_admin', 'hr_recruiter', 'billing_contact'];

// Roles that can be either global or org-specific
const FLEXIBLE_ROLES: AppRole[] = ['tech_spoc'];

export default function UnifiedUserManagement() {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { isPlatformAdmin, isPartnerAdmin, roles: currentUserRoles } = useUserRoles();
  
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [viewMode, setViewMode] = useState<'platform' | 'organization'>('organization');
  
  // Dialogs
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [manageRolesOpen, setManageRolesOpen] = useState(false);
  const [removeUserOpen, setRemoveUserOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [passwordLinkOpen, setPasswordLinkOpen] = useState(false);
  
  // User data
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<AppRole[]>([]);
  const [newUserOrgId, setNewUserOrgId] = useState<string>(""); // For org-specific roles in platform view
  const [newUserTechSpocScope, setNewUserTechSpocScope] = useState<'global' | 'organization'>('global');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<AppRole[]>([]);
  
  // Password Setup Success
  const [newUserEmailForLink, setNewUserEmailForLink] = useState("");
  
  // Loading states
  const [adding, setAdding] = useState(false);
  const [updatingRoles, setUpdatingRoles] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingUserOrgs, setLoadingUserOrgs] = useState(false);
  
  // User organization data for delete dialog
  const [selectedUserOrgs, setSelectedUserOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedUserIsPartnerAdmin, setSelectedUserIsPartnerAdmin] = useState(false);

  useEffect(() => {
    checkAccessAndFetchData();
  }, []);

  useEffect(() => {
    if (viewMode === 'organization' && selectedOrgId) {
      fetchOrgUsers(selectedOrgId);
    } else if (viewMode === 'platform') {
      fetchAllUsers();
    }
  }, [selectedOrgId, viewMode]);

  const checkAccessAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = rolesData?.map(r => r.role) || [];
      const isPlatform = userRoles.includes('platform_admin');
      const isPartner = userRoles.includes('partner_admin');

      if (!isPlatform && !isPartner) {
        toast({
          title: "Access Denied",
          description: "Only platform admins and partner admins can manage users.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Platform admin gets platform view by default, partner admin gets organization view
      if (isPlatform) {
        setViewMode('platform');
        const { data: orgsData } = await supabase
          .from("organizations")
          .select("*")
          .order("name");
        
        setOrganizations(orgsData || []);
      } else {
        // Partner admin - lock to organization view only
        setViewMode('organization');
        const { data: memberData } = await supabase
          .from("organization_members")
          .select("organization_id, organizations(*)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (memberData) {
          const org = (memberData as any).organizations;
          setSelectedOrgId(org.id);
          setOrganizations([org]);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgUsers = async (orgId: string) => {
    try {
      setLoading(true);
      
      const { data: membersData } = await supabase
        .from("organization_members")
        .select("user_id, status, joined_at")
        .eq("organization_id", orgId)
        .eq("status", "active");

      if (!membersData || membersData.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = membersData.map(m => m.user_id);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const usersWithRoles: UserWithRoles[] = (profilesData || []).map(profile => {
        const member = membersData.find(m => m.user_id === profile.id);
        const userRoles = rolesData?.filter(r => r.user_id === profile.id).map(r => r.role as AppRole) || [];
        
        return {
          id: profile.id,
          email: profile.email || '',
          full_name: profile.full_name || profile.email || 'Unknown',
          roles: userRoles,
          org_status: 'active',
          joined_at: member?.joined_at || new Date().toISOString()
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const usersWithRoles = await Promise.all(
        (profilesData || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          return {
            id: profile.id,
            email: profile.email || '',
            full_name: profile.full_name || profile.email || 'Unknown',
            roles: rolesData?.map(r => r.role as AppRole) || []
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (viewMode === 'organization') {
      await handleAddOrgUser();
    } else {
      await handleCreatePlatformUser();
    }
  };

  const handleAddOrgUser = async () => {
    if (!selectedOrgId || !newUserEmail || !newUserName) {
      toast({
        title: "Required Fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (newUserRoles.length === 0) {
      toast({
        title: "Select Roles",
        description: "Please select at least one role",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newUserEmail)
        .maybeSingle();

      if (existingProfile) {
        const userId = existingProfile.id;

        const { data: existingMember } = await supabase
          .from("organization_members")
          .select("id, status")
          .eq("user_id", userId)
          .eq("organization_id", selectedOrgId)
          .maybeSingle();

        if (existingMember) {
          if (existingMember.status === 'inactive') {
            await supabase
              .from("organization_members")
              .update({ status: 'active' })
              .eq("id", existingMember.id);
          } else {
            toast({
              title: "User Already Exists",
              description: "This user is already a member",
              variant: "destructive",
            });
            setAdding(false);
            return;
          }
        } else {
          await supabase
            .from("organization_members")
            .insert({
              organization_id: selectedOrgId,
              user_id: userId,
              status: 'active'
            });
        }

        const roleInserts = newUserRoles.map(role => ({
          user_id: userId,
          role: role
        }));

        await supabase
          .from("user_roles")
          .upsert(roleInserts, { onConflict: 'user_id,role' });
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-organization-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              action: "create",
              email: newUserEmail,
              fullName: newUserName,
              organizationId: selectedOrgId,
              roles: newUserRoles,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create user");
        }

        const result = await response.json();
        
        // Show success dialog if password setup email was sent
        if (result.passwordSetupLink) {
          setNewUserEmailForLink(newUserEmail);
          setPasswordLinkOpen(true);
        }
      }

      toast({
        title: "Success",
        description: "User added successfully",
      });

      resetAddUserForm();
      fetchOrgUsers(selectedOrgId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleCreatePlatformUser = async () => {
    if (!newUserEmail || !newUserName) {
      toast({
        title: "Required Fields",
        description: "Please fill in name and email",
        variant: "destructive",
      });
      return;
    }

    if (newUserRoles.length === 0) {
      toast({
        title: "Select Roles",
        description: "Please select at least one role",
        variant: "destructive",
      });
      return;
    }

    // Check if org is required but not selected
    if (requiresOrganization() && !newUserOrgId) {
      toast({
        title: "Organization Required",
        description: "Please select an organization for the selected role(s)",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Build role assignments with organization scope
      const roleAssignments = newUserRoles.map(role => {
        // Determine if this role should be scoped to an organization
        let orgId: string | null = null;
        
        if (ORG_REQUIRED_ROLES.includes(role)) {
          // These roles always require an org
          orgId = newUserOrgId || null;
        } else if (role === 'tech_spoc' && newUserTechSpocScope === 'organization') {
          // Tech SPOC with org scope
          orgId = newUserOrgId || null;
        }
        // Global roles (platform_admin, guest) and global tech_spoc have null orgId
        
        return {
          role,
          organization_id: orgId,
          created_by_role: 'platform_admin'
        };
      });
      
      const response = await invokeFunction('admin-user-management', {
        body: {
          action: 'create',
          email: newUserEmail,
          fullName: newUserName,
          roles: newUserRoles,
          roleAssignments,
          organizationId: requiresOrganization() ? newUserOrgId : null,
        },
      });

      // Handle both error types: network/invoke errors and API response errors
      if (response.error) {
        const errorMessage = response.data?.error || response.error.message || 'Failed to create user';
        throw new Error(errorMessage);
      }
      if (response.data?.error) throw new Error(response.data.error);
      
      const data = response.data;

      // Show success dialog with password setup email notification
      if (data.passwordSetupLink || data.emailSent) {
        setNewUserEmailForLink(newUserEmail);
        setPasswordLinkOpen(true);
      }

      successToast(
        "User Created",
        data.emailSent 
          ? `Password setup email sent to ${data.user.email}`
          : `User created: ${data.user.email}`
      );

      resetAddUserForm();
      fetchAllUsers();
    } catch (error: any) {
      errorToast("Failed to Create User", error.message);
    } finally {
      setAdding(false);
    }
  };

  const openManageRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedUserRoles(user.roles);
    setManageRolesOpen(true);
  };

  const handleUpdateRoles = async () => {
    if (!selectedUser) return;

    setUpdatingRoles(true);
    try {
      const rolesToManage = viewMode === 'platform' ? PLATFORM_ASSIGNABLE_ROLES : PARTNER_ASSIGNABLE_ROLES;

      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.id)
        .in("role", rolesToManage);

      if (selectedUserRoles.length > 0) {
        const roleInserts = selectedUserRoles.map(role => ({
          user_id: selectedUser.id,
          role: role
        }));

        const { error } = await supabase
          .from("user_roles")
          .insert(roleInserts);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Roles updated successfully",
      });

      setManageRolesOpen(false);
      if (viewMode === 'organization' && selectedOrgId) {
        fetchOrgUsers(selectedOrgId);
      } else {
        fetchAllUsers();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingRoles(false);
    }
  };

  const handleRemoveFromOrg = async () => {
    if (!selectedUser || !selectedOrgId) return;

    setRemoving(true);
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ status: 'inactive' })
        .eq("user_id", selectedUser.id)
        .eq("organization_id", selectedOrgId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from organization",
      });

      setRemoveUserOpen(false);
      fetchOrgUsers(selectedOrgId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  // Fetch user's organization memberships when delete dialog opens
  const fetchUserOrganizations = async (userId: string) => {
    setLoadingUserOrgs(true);
    try {
      const response = await invokeFunction('admin-user-management', {
        body: {
          action: 'get-user-orgs',
          userId,
        },
      });

      if (response.data?.success) {
        setSelectedUserOrgs(response.data.organizations || []);
        setSelectedUserIsPartnerAdmin(response.data.isPartnerAdmin || false);
      } else {
        setSelectedUserOrgs([]);
        setSelectedUserIsPartnerAdmin(false);
      }
    } catch (error) {
      logger.error('Failed to fetch user organizations:', error);
      setSelectedUserOrgs([]);
      setSelectedUserIsPartnerAdmin(false);
    } finally {
      setLoadingUserOrgs(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setDeleting(true);
    try {
      const response = await invokeFunction('admin-user-management', {
        body: {
          action: 'delete',
          userId: selectedUser.id,
        },
      });

      const responseData = response.data;
      
      if (response.error || responseData?.error || !responseData?.success) {
        let errorMessage = responseData?.error || response.error?.message || 'Failed to delete user';
        
        if (responseData?.organizations && responseData.organizations.length > 0) {
          const orgNames = responseData.organizations.map((org: any) => org.name).join(', ');
          errorMessage += `\n\nOrganizations: ${orgNames}`;
        }
        
        if (responseData?.dependencies && responseData.dependencies.length > 0) {
          errorMessage += `\n\nBlocking data: ${responseData.dependencies.join(', ')}`;
        }
        
        if (responseData?.suggestion) {
          errorMessage += `\n\n${responseData.suggestion}`;
        }
        
        if (responseData?.details) {
          errorMessage += `\n\nTechnical details: ${responseData.details}`;
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: "User Deleted",
        description: "User permanently removed from platform",
      });

      setDeleteUserOpen(false);
      setSelectedUserOrgs([]);
      fetchAllUsers();
    } catch (error: any) {
      toast({
        title: "Error Deleting User",
        description: error.message,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setDeleting(false);
    }
  };

  // Cascade delete: remove from all orgs first, then delete
  const handleCascadeDeleteUser = async () => {
    if (!selectedUser) return;

    setDeleting(true);
    try {
      const response = await invokeFunction('admin-user-management', {
        body: {
          action: 'delete-cascade',
          userId: selectedUser.id,
        },
      });

      const responseData = response.data;
      
      if (response.error || responseData?.error || !responseData?.success) {
        let errorMessage = responseData?.error || response.error?.message || 'Failed to delete user';
        
        // Check if org removal was successful but deletion failed
        if (responseData?.orgRemovalSuccess) {
          errorMessage = 'User was removed from organizations but ' + errorMessage;
          
          if (responseData?.elevations?.length > 0) {
            const elevationInfo = responseData.elevations.map((e: any) => 
              `${e.newAdminEmail} elevated to admin for ${e.orgName}`
            ).join('. ');
            errorMessage += `\n\nAdmin elevations: ${elevationInfo}`;
          }
        }
        
        if (responseData?.dependencies && responseData.dependencies.length > 0) {
          errorMessage += `\n\nBlocking data: ${responseData.dependencies.join(', ')}`;
        }
        
        if (responseData?.suggestion) {
          errorMessage += `\n\n${responseData.suggestion}`;
        }
        
        throw new Error(errorMessage);
      }

      // Success - show elevation info if any
      const message = responseData?.message || 'User deleted successfully';
      
      toast({
        title: "User Deleted",
        description: message,
      });

      setDeleteUserOpen(false);
      setSelectedUserOrgs([]);
      if (viewMode === 'organization' && selectedOrgId) {
        fetchOrgUsers(selectedOrgId);
      } else {
        fetchAllUsers();
      }
    } catch (error: any) {
      toast({
        title: "Error Deleting User",
        description: error.message,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setDeleting(false);
    }
  };

  const resetAddUserForm = () => {
    setAddUserOpen(false);
    setNewUserEmail("");
    setNewUserName("");
    setNewUserPassword("");
    setNewUserRoles([]);
    setNewUserOrgId("");
    setNewUserTechSpocScope('global');
  };

  const toggleRole = (role: AppRole, isNewUser: boolean = false) => {
    if (isNewUser) {
      setNewUserRoles(prev =>
        prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
      );
    } else {
      setSelectedUserRoles(prev =>
        prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
      );
    }
  };

  const getRoleBadgeColor = (role: AppRole) => {
    const colors: Record<AppRole, string> = {
      platform_admin: "bg-purple-500 text-white",
      partner_admin: "bg-blue-500 text-white",
      hr_recruiter: "bg-green-500 text-white",
      tech_spoc: "bg-yellow-500 text-white",
      billing_contact: "bg-pink-500 text-white",
      guest: "bg-gray-300 text-gray-700",
    };
    return colors[role] || "bg-gray-500 text-white";
  };

  const getRoleDescription = (role: AppRole) => {
    const descriptions: Record<AppRole, string> = {
      platform_admin: "Global admin with full platform access across all organizations",
      partner_admin: "Organization admin - manages team, interviews, and settings for their organization",
      hr_recruiter: "Create and manage interviews, view all assessment reports",
      tech_spoc: "Technical point of contact - reviews and approves questions",
      billing_contact: "Manage organization billing, invoices, and payment methods",
      guest: "Platform users who can access learning features and take certifications",
    };
    return descriptions[role] || '';
  };

  // Check if any selected role requires an organization
  const requiresOrganization = () => {
    // In organization view, org is already selected
    if (viewMode === 'organization') return false;
    
    // Check if any org-required role is selected
    const hasOrgRequiredRole = newUserRoles.some(r => ORG_REQUIRED_ROLES.includes(r));
    
    // Check if tech_spoc is selected with organization scope
    const hasTechSpocOrgScope = newUserRoles.includes('tech_spoc') && newUserTechSpocScope === 'organization';
    
    return hasOrgRequiredRole || hasTechSpocOrgScope;
  };

  // Check if only global roles are selected (no org selector needed)
  const hasOnlyGlobalRoles = () => {
    if (newUserRoles.length === 0) return true;
    return newUserRoles.every(r => GLOBAL_ONLY_ROLES.includes(r) || 
      (FLEXIBLE_ROLES.includes(r) && newUserTechSpocScope === 'global'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const availableRoles = viewMode === 'platform' ? PLATFORM_ASSIGNABLE_ROLES : PARTNER_ASSIGNABLE_ROLES;

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 px-2 sm:px-4 lg:px-0">
        <Button
          variant="ghost"
          onClick={() => navigate(isPlatformAdmin ? '/admin' : '/partner/portal')}
          className="mb-2 md:mb-4 min-h-[44px]"
        >
          ← Back to {isPlatformAdmin ? 'Platform Admin Hub' : 'Partner Portal'}
        </Button>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
              <Shield className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              <h1 className="text-xl md:text-3xl font-bold">User Management</h1>
              {viewMode === 'platform' ? (
                <Badge variant="outline" className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Platform
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  Organization
                </Badge>
              )}
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              {viewMode === 'platform' 
                ? 'Manage all platform users and global permissions.'
                : `Manage team members for ${organizations.find(o => o.id === selectedOrgId)?.name || 'your organization'}.`
              }
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {isPlatformAdmin && organizations.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground hidden sm:inline">View:</Label>
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                  <SelectTrigger className="w-[140px] sm:w-[180px] min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">Platform Wide</SelectItem>
                    <SelectItem value="organization">By Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {viewMode === 'organization' && isPlatformAdmin && organizations.length > 0 && (
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="w-full sm:w-[200px] lg:w-[250px] min-h-[44px]">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {org.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Button onClick={() => setAddUserOpen(true)} className="min-h-[44px] w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {viewMode === 'platform' ? 'All Users' : 'Team Members'} ({users.length})
            </CardTitle>
            <CardDescription>
              {viewMode === 'platform' 
                ? 'Complete list of platform users'
                : `Members of ${organizations.find(o => o.id === selectedOrgId)?.name || 'selected organization'}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Name</TableHead>
                    <TableHead className="min-w-[180px]">Email</TableHead>
                    <TableHead className="min-w-[150px]">Roles</TableHead>
                    {viewMode === 'organization' && <TableHead className="min-w-[100px]">Joined</TableHead>}
                    <TableHead className="text-right min-w-[140px]">Actions</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map(role => (
                          <Badge key={role} variant="outline" className={getRoleBadgeColor(role)}>
                            {role}
                          </Badge>
                        ))}
                        {user.roles.length === 0 && (
                          <span className="text-sm text-muted-foreground">No roles</span>
                        )}
                      </div>
                    </TableCell>
                    {viewMode === 'organization' && (
                      <TableCell>
                        {user.joined_at ? new Date(user.joined_at).toLocaleDateString() : '-'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <EmailResendButton 
                          email={user.email} 
                          userName={user.full_name}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManageRoles(user)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Roles
                        </Button>
                        {viewMode === 'organization' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setRemoveUserOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        )}
                        {viewMode === 'platform' && isPlatformAdmin && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedUser(user);
                              setSelectedUserOrgs([]);
                              setSelectedUserIsPartnerAdmin(false);
                              setDeleteUserOpen(true);
                              fetchUserOrganizations(user.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={addUserOpen} onOpenChange={(open) => !open && resetAddUserForm()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {viewMode === 'platform' ? 'Create Platform User' : 'Add Team Member'}
              </DialogTitle>
            <DialogDescription>
              {viewMode === 'platform' 
                ? 'Create a new user account with platform-wide access. You can assign Platform Admin role to create another global administrator.'
                : 'Add an existing user or create a new team member for your organization. You can assign Partner Admin role to create another organization administrator.'
              }
            </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 inline mr-1" />
                  A password setup link will be sent to the user's email. They will set their own password.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select one or more roles for this user
                </p>
                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto">
                  {availableRoles.map(role => (
                    <div key={role} className="space-y-1 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`new-${role}`}
                          checked={newUserRoles.includes(role)}
                          onCheckedChange={() => toggleRole(role, true)}
                        />
                        <label
                          htmlFor={`new-${role}`}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        <Badge variant="outline" className={getRoleBadgeColor(role)}>
                          {role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        {getRoleDescription(role)}
                      </p>
                      
                      {/* Tech SPOC scope selector - only show in platform view when tech_spoc is selected */}
                      {role === 'tech_spoc' && newUserRoles.includes('tech_spoc') && viewMode === 'platform' && (
                        <div className="ml-6 mt-2 p-2 bg-muted/50 rounded-md">
                          <Label className="text-xs font-medium">Tech SPOC Scope</Label>
                          <div className="flex gap-4 mt-1">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name="techSpocScope"
                                checked={newUserTechSpocScope === 'global'}
                                onChange={() => setNewUserTechSpocScope('global')}
                                className="w-3 h-3"
                              />
                              <span>Platform-wide (Internal)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name="techSpocScope"
                                checked={newUserTechSpocScope === 'organization'}
                                onChange={() => setNewUserTechSpocScope('organization')}
                                className="w-3 h-3"
                              />
                              <span>Organization-specific (External)</span>
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {newUserTechSpocScope === 'global' 
                              ? 'Available to all organizations as internal TA SPOC'
                              : 'Dedicated to a specific organization as external TA SPOC'
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Organization selector - shown when org-specific roles are selected in platform view */}
              {viewMode === 'platform' && requiresOrganization() && (
                <div className="space-y-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Label className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Select Organization
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    The selected role(s) require an organization assignment
                  </p>
                  <Select value={newUserOrgId} onValueChange={setNewUserOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            {org.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                onClick={handleAddUser} 
                disabled={adding}
                className="w-full"
              >
                {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {viewMode === 'platform' ? 'Create User' : 'Add to Organization'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Roles Dialog */}
        <Dialog open={manageRolesOpen} onOpenChange={setManageRolesOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Roles</DialogTitle>
              <DialogDescription>
                Update roles for {selectedUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {availableRoles.map(role => (
                <div key={role} className="space-y-2 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={role}
                      checked={selectedUserRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <label
                      htmlFor={role}
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <Badge variant="outline" className={getRoleBadgeColor(role)}>
                      {role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    {getRoleDescription(role)}
                  </p>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateRoles} disabled={updatingRoles}>
                {updatingRoles ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Update Roles
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove from Org Dialog */}
        <AlertDialog open={removeUserOpen} onOpenChange={setRemoveUserOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove User</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {selectedUser?.full_name} from this organization? They will no longer have access to organization resources.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveFromOrg} disabled={removing}>
                {removing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete User Dialog */}
        <AlertDialog open={deleteUserOpen} onOpenChange={(open) => {
          setDeleteUserOpen(open);
          if (!open) {
            setSelectedUserOrgs([]);
            setSelectedUserIsPartnerAdmin(false);
          }
        }}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="font-semibold text-destructive">This action cannot be undone!</p>
                  <p>Delete <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email}) permanently from the platform?</p>
                  
                  {loadingUserOrgs ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Checking organization memberships...</span>
                    </div>
                  ) : selectedUserOrgs.length > 0 ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium text-sm">Active Organization Memberships</span>
                      </div>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {selectedUserOrgs.map(org => (
                          <li key={org.id}>{org.name}</li>
                        ))}
                      </ul>
                      {selectedUserIsPartnerAdmin && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <strong>Note:</strong> This user is a Partner Admin. If they are the only admin in an organization, the earliest joined member will be automatically elevated to Partner Admin.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      User is not a member of any organizations.
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {selectedUserOrgs.length > 0 ? (
                <AlertDialogAction 
                  onClick={handleCascadeDeleteUser} 
                  disabled={deleting || loadingUserOrgs}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Remove from Orgs & Delete
                </AlertDialogAction>
              ) : (
                <AlertDialogAction 
                  onClick={handleDeleteUser} 
                  disabled={deleting || loadingUserOrgs}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Delete Permanently
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Password Setup Success Dialog */}
        <Dialog open={passwordLinkOpen} onOpenChange={(open) => {
          setPasswordLinkOpen(open);
          if (!open) {
            if (viewMode === 'organization') {
              fetchOrgUsers(selectedOrgId);
            } else {
              fetchAllUsers();
            }
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Invitation Sent
              </DialogTitle>
              <DialogDescription>
                A password setup email has been sent to <strong>{newUserEmailForLink}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-accent/10 rounded-lg text-center">
                <CheckCircle className="w-10 h-10 mx-auto text-accent mb-2" />
                <p className="text-sm text-muted-foreground">
                  The user will receive an email with instructions to set up their password and access the platform.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => {
                setPasswordLinkOpen(false);
                if (viewMode === 'organization') {
                  fetchOrgUsers(selectedOrgId);
                } else {
                  fetchAllUsers();
                }
              }}>
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}
