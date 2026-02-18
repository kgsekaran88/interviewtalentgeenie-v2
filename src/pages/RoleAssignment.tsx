import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";

import { Users, Shield, Plus, Trash2, CheckCircle } from "lucide-react";
import { AppRole } from "@/contexts/AuthContext";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: AppRole[];
}

const RoleAssignment = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { user, hasRole } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("hr_recruiter");
  const [showAddRole, setShowAddRole] = useState(false);
  const [showRemoveRoleDialog, setShowRemoveRoleDialog] = useState(false);
  const [pendingRoleToRemove, setPendingRoleToRemove] = useState<{ userId: string; role: string; userEmail: string } | null>(null);
  const [removeRoleConfirmText, setRemoveRoleConfirmText] = useState("");

  useEffect(() => {
    if (!user || !hasRole('platform_admin')) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, hasRole]);

  const fetchUsers = async () => {
    // Fetch all profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      toast({
        title: "Error Loading Users",
        description: profilesError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Fetch roles for all users
    const usersWithRoles = await Promise.all(
      (profilesData || []).map(async (profile) => {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id);

        return {
          ...profile,
          roles: rolesData?.map(r => r.role as AppRole) || []
        };
      })
    );

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const assignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select both user and role",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .insert([{
        user_id: selectedUser,
        role: selectedRole as any,
        assigned_by: user?.id
      }] as any);

    if (error) {
      if (error.code === '23505') {
        toast({
          title: "Error",
          description: "User already has this role",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      const selectedUserData = users.find(u => u.id === selectedUser);
      toast({
        title: "Success",
        description: `Role "${selectedRole}" assigned successfully to ${selectedUserData?.email}. User will be notified on next login.`,
      });
      setShowAddRole(false);
      setSelectedUser("");
      fetchUsers();
    }
  };

  const initiateRemoveRole = (userId: string, role: string) => {
    const userData = users.find(u => u.id === userId);
    setPendingRoleToRemove({ userId, role, userEmail: userData?.email || '' });
    setShowRemoveRoleDialog(true);
    setRemoveRoleConfirmText("");
  };

  const confirmRemoveRole = async () => {
    if (!pendingRoleToRemove) return;

    const { userId, role, userEmail } = pendingRoleToRemove;
    
    // Critical role protection - require exact role name
    if (role === 'platform_admin' && removeRoleConfirmText !== 'platform_admin') {
      toast({
        title: "Confirmation Required",
        description: "You must type 'platform_admin' exactly to remove this critical role",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role as any);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Role Removed",
        description: `Role "${role}" removed from ${userEmail}. User will be notified on next login.`,
      });
      fetchUsers();
    }

    setShowRemoveRoleDialog(false);
    setPendingRoleToRemove(null);
    setRemoveRoleConfirmText("");
  };

  const getRoleBadgeColor = (role: AppRole) => {
    switch (role) {
      case 'platform_admin': return 'bg-destructive text-destructive-foreground';
      case 'partner_admin': return 'bg-destructive/80 text-destructive-foreground';
      case 'hr_recruiter': return 'bg-primary text-primary-foreground';
      case 'tech_spoc': return 'bg-accent text-accent-foreground';
      case 'billing_contact': return 'bg-warning text-warning-foreground';
      case 'guest': return 'bg-muted/50 text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleDescription = (role: AppRole) => {
    switch (role) {
      case 'platform_admin': return 'Full platform access, manages all organizations and settings';
      case 'partner_admin': return 'Organization administrator with full control over org settings';
      case 'hr_recruiter': return 'Create and manage recruitment interviews, view all assessments';
      case 'tech_spoc': return 'Review and approve questions from HR Recruiters in their organization';
      case 'billing_contact': return 'Access to billing and payment information';
      case 'guest': return 'Limited read-only access';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">
        <Button
          variant="ghost"
          onClick={() => navigate('/platform-admin-dashboard')}
          className="mb-2 sm:mb-4 min-h-[44px]"
        >
          ← Back to Platform Admin
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 flex items-center gap-2">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              Role Assignment
            </h1>
            <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
          </div>
          <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 min-h-[44px] self-start sm:self-auto">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Assign Role</span>
                <span className="sm:hidden">Assign</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Role to User</DialogTitle>
                <DialogDescription>
                  Select a user and assign them a role. User will be notified in-app.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platform_admin">Platform Admin</SelectItem>
                      <SelectItem value="partner_admin">Partner Admin</SelectItem>
                      <SelectItem value="hr_recruiter">HR Recruiter</SelectItem>
                      <SelectItem value="tech_spoc">Tech SPOC</SelectItem>
                      <SelectItem value="interviewer">Interviewer</SelectItem>
                      <SelectItem value="billing_contact">Billing Contact</SelectItem>
                      <SelectItem value="candidate">Candidate</SelectItem>
                      <SelectItem value="guest">Guest</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getRoleDescription(selectedRole)}
                  </p>
                </div>
              </div>
              <Button onClick={assignRole} className="w-full">
                <CheckCircle className="w-4 h-4 mr-2" />
                Assign Role & Notify User
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Role Descriptions Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Role Descriptions</CardTitle>
            <CardDescription>Understanding each role's permissions</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            {[
              'platform_admin', 'partner_admin', 'hr_recruiter', 
              'tech_spoc', 'interviewer', 'billing_contact', 'candidate', 'guest'
            ].map((role) => (
              <div key={role} className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge className={getRoleBadgeColor(role as AppRole)}>
                  {role}
                </Badge>
                <p className="text-sm text-muted-foreground flex-1">
                  {getRoleDescription(role as AppRole)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Users & Roles
            </CardTitle>
            <CardDescription>
              {users.length} total users in the system
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3 p-4">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{user.full_name || 'No name'}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">{user.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] shrink-0"
                      onClick={() => {
                        setSelectedUser(user.id);
                        setShowAddRole(true);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <Badge 
                          key={role} 
                          className={`${getRoleBadgeColor(role)} cursor-pointer hover:opacity-80 text-xs`}
                          onClick={() => initiateRemoveRole(user.id, role)}
                        >
                          {role}
                          <Trash2 className="w-3 h-3 ml-1" />
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">No roles assigned</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Joined: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || 'No name'}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge 
                                key={role} 
                                className={`${getRoleBadgeColor(role)} cursor-pointer hover:opacity-80`}
                                onClick={() => initiateRemoveRole(user.id, role)}
                              >
                                {role}
                                <Trash2 className="w-3 h-3 ml-1" />
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">No roles assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px]"
                          onClick={() => {
                            setSelectedUser(user.id);
                            setShowAddRole(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Role
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>

      {/* Role Removal Confirmation Dialog */}
      <Dialog open={showRemoveRoleDialog} onOpenChange={setShowRemoveRoleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Shield className="w-5 h-5" />
              Confirm Role Removal
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-4">
              {pendingRoleToRemove && (
                <>
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="font-semibold text-foreground mb-2">
                      ⚠️ You are about to remove a role:
                    </p>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">User:</span> {pendingRoleToRemove.userEmail}</p>
                      <p><span className="font-medium">Role:</span> <Badge className="bg-destructive">{pendingRoleToRemove.role}</Badge></p>
                    </div>
                  </div>

                  {pendingRoleToRemove.role === 'platform_admin' && (
                    <div className="p-4 bg-destructive/5 border-2 border-destructive rounded-lg">
                      <p className="font-bold text-destructive mb-2">🚨 CRITICAL ROLE WARNING</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Removing platform_admin access will revoke ALL administrative privileges. This action requires explicit confirmation.
                      </p>
                      <Label className="text-sm font-medium">
                        Type <code className="px-2 py-0.5 bg-muted rounded">platform_admin</code> to confirm:
                      </Label>
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                        value={removeRoleConfirmText}
                        onChange={(e) => setRemoveRoleConfirmText(e.target.value)}
                        placeholder="platform_admin"
                      />
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    The user will lose all permissions associated with this role immediately upon confirmation.
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveRoleDialog(false);
                setPendingRoleToRemove(null);
                setRemoveRoleConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveRole}
              disabled={
                pendingRoleToRemove?.role === 'platform_admin' && 
                removeRoleConfirmText !== 'platform_admin'
              }
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleAssignment;
