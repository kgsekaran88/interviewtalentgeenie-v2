import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { useUserRoles, AppRole } from "@/hooks/useUserRoles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Loader2, Shield, Trash2, Plus, X, Building2, Mail, CheckCircle } from "lucide-react";
import { EmailResendButton } from "@/components/EmailResendButton";
import { Checkbox } from "@/components/ui/checkbox";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
  org_status: 'active' | 'inactive';
  joined_at: string;
}

// Roles that can be assigned within an organization
const ASSIGNABLE_ROLES: AppRole[] = [
  'partner_admin',      // Can create other org admins
  'hr_recruiter',       // HR team members
  'tech_spoc',          // Technical points of contact
  'billing_contact'     // Billing and payment managers
];

export default function OrganizationUserManagement() {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { isPlatformAdmin, isPartnerAdmin } = useUserRoles();
  
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [allOrganizations, setAllOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  
  // Add User Dialog
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<AppRole[]>([]);
  const [adding, setAdding] = useState(false);
  const [existingUserFound, setExistingUserFound] = useState<{ id: string; full_name: string; email: string } | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  
  // Manage Roles Dialog
  const [manageRolesOpen, setManageRolesOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<AppRole[]>([]);
  const [updatingRoles, setUpdatingRoles] = useState(false);
  
  // Remove User Dialog
  const [removeUserOpen, setRemoveUserOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<UserWithRoles | null>(null);
  const [removing, setRemoving] = useState(false);

  // Password Setup Success Dialog
  const [passwordLinkOpen, setPasswordLinkOpen] = useState(false);
  const [newUserEmailForLink, setNewUserEmailForLink] = useState("");

  useEffect(() => {
    checkAccessAndFetchData();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchOrgUsers(selectedOrgId);
    }
  }, [selectedOrgId]);

  const checkAccessAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user is platform admin or partner admin
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = rolesData?.map(r => r.role) || [];
      const isPlatformAdmin = roles.includes('platform_admin');
      const isPartnerAdmin = roles.includes('partner_admin');

      if (!isPlatformAdmin && !isPartnerAdmin) {
        toast({
          title: "Access Denied",
          description: "Only platform admins and partner admins can manage users.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (isPlatformAdmin) {
        // Platform admin: Load all organizations
        const { data: orgsData } = await supabase
          .from("organizations")
          .select("*")
          .order("name");
        
        setAllOrganizations(orgsData || []);
        if (orgsData && orgsData.length > 0) {
          setSelectedOrgId(orgsData[0].id);
        }
      } else {
        // Partner admin: Load their organization only
        const { data: memberData } = await supabase
          .from("organization_members")
          .select("*, organizations(*)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (memberData) {
          const org = (memberData as any).organizations;
          setOrganization(org);
          setSelectedOrgId(org.id);
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
      
      // Get only ACTIVE members of the organization
      const { data: membersData } = await supabase
        .from("organization_members")
        .select("user_id, status, joined_at")
        .eq("organization_id", orgId)
        .eq("status", "active"); // Only show active members

      if (!membersData || membersData.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = membersData.map(m => m.user_id);

      // Get user profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      // Get user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      // Combine data - all members are active since we filtered above
      const usersWithRoles: UserWithRoles[] = (profilesData || []).map(profile => {
        const member = membersData.find(m => m.user_id === profile.id);
        const userRoles = rolesData?.filter(r => r.user_id === profile.id).map(r => r.role as AppRole) || [];
        
        return {
          id: profile.id,
          email: profile.email || '',
          full_name: profile.full_name || profile.email || 'Unknown',
          roles: userRoles,
          org_status: 'active' as 'active' | 'inactive', // All are active now
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

  // Check if email exists when user types
  const checkEmailExists = async (email: string) => {
    if (!email || !email.includes('@')) {
      setExistingUserFound(null);
      return;
    }
    
    setCheckingEmail(true);
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();
      
      if (existingProfile) {
        setExistingUserFound(existingProfile);
        setNewUserName(existingProfile.full_name || email.split('@')[0]);
      } else {
        setExistingUserFound(null);
      }
    } catch (error) {
      logger.error("Error checking email:", error);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleAddUser = async () => {
    if (!selectedOrgId || !newUserEmail) {
      toast({
        title: "Required Fields",
        description: "Please fill in email",
        variant: "destructive",
      });
      return;
    }

    // For new users, name is required
    if (!existingUserFound && !newUserName) {
      toast({
        title: "Required Fields",
        description: "Please enter a name for the new user",
        variant: "destructive",
      });
      return;
    }

    if (newUserRoles.length === 0) {
      toast({
        title: "Select Roles",
        description: "Please select at least one role for the user",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      if (existingUserFound) {
        // User exists - add to organization with selected roles
        const userId = existingUserFound.id;

        // Check if already in organization
        const { data: existingMember } = await supabase
          .from("organization_members")
          .select("id, status")
          .eq("user_id", userId)
          .eq("organization_id", selectedOrgId)
          .maybeSingle();

        if (existingMember && existingMember.status === 'active') {
          toast({
            title: "User Already Exists",
            description: "This user is already an active member of this organization",
            variant: "destructive",
          });
          setAdding(false);
          return;
        }

        // Reactivate if inactive, otherwise insert
        if (existingMember) {
          await supabase
            .from("organization_members")
            .update({ status: 'active' })
            .eq("id", existingMember.id);
        } else {
          const { error: memberError } = await supabase
            .from("organization_members")
            .insert({
              organization_id: selectedOrgId,
              user_id: userId,
              status: 'active'
            });
          if (memberError) throw memberError;
        }

        // Assign roles using upsert to avoid duplicates
        const roleInserts = newUserRoles.map(role => ({
          user_id: userId,
          role: role
        }));

        const { error: rolesError } = await supabase
          .from("user_roles")
          .upsert(roleInserts, { onConflict: 'user_id,role' });

        if (rolesError) throw rolesError;

        toast({
          title: "Success",
          description: `Existing user "${existingUserFound.full_name}" added to organization with selected roles`,
        });
      } else {
        // Create new user via edge function
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
        
        // Check if user already existed
        if (result.alreadyMember) {
          toast({
            title: "Info",
            description: "User is already a member of this organization",
          });
          setAddUserOpen(false);
          setNewUserEmail("");
          setNewUserName("");
          setNewUserRoles([]);
          fetchOrgUsers(selectedOrgId);
          return;
        }

        // Show success dialog if password setup email was sent
        if (result.passwordSetupLink) {
          setNewUserEmailForLink(newUserEmail);
          setPasswordLinkOpen(true);
        }
      }

      setAddUserOpen(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRoles([]);
      setExistingUserFound(null);
      
      // Force a fresh fetch with a small delay to ensure data is written
      setTimeout(() => {
        fetchOrgUsers(selectedOrgId);
      }, 500);
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

  const openManageRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedUserRoles(user.roles);
    setManageRolesOpen(true);
  };

  const handleUpdateRoles = async () => {
    if (!selectedUser) return;

    setUpdatingRoles(true);
    try {
      // Delete existing roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.id)
        .in("role", ASSIGNABLE_ROLES);

      // Insert new roles
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
      fetchOrgUsers(selectedOrgId);
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

  const openRemoveUser = (user: UserWithRoles) => {
    setUserToRemove(user);
    setRemoveUserOpen(true);
  };

  const handleRemoveUser = async () => {
    if (!userToRemove) return;

    setRemoving(true);
    try {
      // Update org member status to inactive
      const { error } = await supabase
        .from("organization_members")
        .update({ status: 'inactive' })
        .eq("user_id", userToRemove.id)
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

  const toggleNewUserRole = (role: AppRole) => {
    setNewUserRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const toggleSelectedUserRole = (role: AppRole) => {
    setSelectedUserRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-6 max-w-7xl space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold tracking-tight">Manage Team</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              {isPlatformAdmin ? "Manage users across all organizations" : "Manage your organization team members"}
            </p>
          </div>
          <Button onClick={() => setAddUserOpen(true)} className="shrink-0 min-h-[44px] w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Organization Selector (Platform Admin only) */}
        {isPlatformAdmin && allOrganizations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Organization</CardTitle>
              <CardDescription>Choose an organization to manage its users</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="w-full min-h-[44px]">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {allOrganizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span className="truncate">{org.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members
                </CardTitle>
                <CardDescription className="mt-1.5">
                  {users.length} {users.length === 1 ? 'member' : 'members'} • Manage access and roles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {users.length === 0 ? (
              <div className="text-center py-8 md:py-12 px-4">
                <Users className="w-10 h-10 md:w-12 md:h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No team members yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add users to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">User</TableHead>
                        <TableHead className="min-w-[150px] hidden sm:table-cell">Email</TableHead>
                        <TableHead className="min-w-[150px]">Roles</TableHead>
                        <TableHead className="min-w-[90px] hidden md:table-cell">Joined</TableHead>
                        <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{user.full_name}</div>
                            <div className="text-xs text-muted-foreground sm:hidden truncate max-w-[150px]">{user.email}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{user.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles.length === 0 ? (
                                <Badge variant="outline" className="text-xs">No roles</Badge>
                              ) : (
                                user.roles.slice(0, 2).map(role => (
                                  <Badge key={role} className={`${getRoleBadgeColor(role)} text-xs`}>
                                    {role.replace(/_/g, ' ').split(' ').map(w => w[0]).join('').toUpperCase()}
                                  </Badge>
                                ))
                              )}
                              {user.roles.length > 2 && (
                                <Badge variant="outline" className="text-xs">+{user.roles.length - 2}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                            {new Date(user.joined_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openManageRoles(user)}
                                className="min-h-[36px] px-2 sm:px-3"
                              >
                                <Shield className="w-4 h-4" />
                                <span className="hidden sm:inline ml-1">Roles</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRemoveUser(user)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[36px] px-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add a new user to your organization and assign their roles
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={newUserEmail}
                    onChange={(e) => {
                      setNewUserEmail(e.target.value);
                      // Debounce check
                      const email = e.target.value;
                      setTimeout(() => {
                        if (e.target.value === email) {
                          checkEmailExists(email);
                        }
                      }, 500);
                    }}
                  />
                  {checkingEmail && (
                    <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>
                {existingUserFound && (
                  <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-md text-sm text-blue-700 dark:text-blue-300">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>User already exists: <strong>{existingUserFound.full_name}</strong>. They will be added to this organization.</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name {existingUserFound && <span className="text-muted-foreground text-xs">(from existing user)</span>}</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  disabled={!!existingUserFound}
                  className={existingUserFound ? "bg-muted" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Assign Roles *</Label>
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  {ASSIGNABLE_ROLES.map(role => (
                    <div key={role} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`role-${role}`}
                        checked={newUserRoles.includes(role)}
                        onCheckedChange={() => toggleNewUserRole(role)}
                      />
                      <label
                        htmlFor={`role-${role}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select at least one role for this user
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setAddUserOpen(false);
                setExistingUserFound(null);
                setNewUserEmail("");
                setNewUserName("");
                setNewUserRoles([]);
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={adding || checkingEmail}>
                {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add User
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manage Roles Dialog */}
        <Dialog open={manageRolesOpen} onOpenChange={setManageRolesOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage User Roles</DialogTitle>
              <DialogDescription>
                Update roles for {selectedUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Available Roles</Label>
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  {ASSIGNABLE_ROLES.map(role => (
                    <div key={role} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`edit-role-${role}`}
                        checked={selectedUserRoles.includes(role)}
                        onCheckedChange={() => toggleSelectedUserRole(role)}
                      />
                      <label
                        htmlFor={`edit-role-${role}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManageRolesOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRoles} disabled={updatingRoles}>
                {updatingRoles && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Roles
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove User Dialog */}
        <AlertDialog open={removeUserOpen} onOpenChange={setRemoveUserOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove User from Organization?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {userToRemove?.full_name} from the organization. 
                They will lose access to all organization resources. This action can be reversed by re-adding them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveUser}
                disabled={removing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Remove User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Password Setup Success Dialog */}
        <Dialog open={passwordLinkOpen} onOpenChange={(open) => {
          setPasswordLinkOpen(open);
          if (!open) {
            fetchOrgUsers(selectedOrgId);
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
                fetchOrgUsers(selectedOrgId);
              }}>
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
