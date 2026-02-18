import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Shield } from 'lucide-react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { getPermissionsByCategory, SYSTEM_ROLE_PERMISSIONS, type Permission } from '@/lib/permissions';

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface CustomRoleManagerProps {
  organizationId?: string;
}

export function CustomRoleManager({ organizationId }: CustomRoleManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [viewSystemRoles, setViewSystemRoles] = useState(false);
  const queryClient = useQueryClient();
  const { isPlatformAdmin, isPartnerAdmin } = useUserRoles();
  
  const permissionsByCategory = getPermissionsByCategory();

  // Fetch custom roles
  const { data: customRoles, isLoading } = useQuery<CustomRole[]>({
    queryKey: ['custom-roles', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('custom_roles' as any)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (organizationId && !isPlatformAdmin) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CustomRole[];
    },
    enabled: isPlatformAdmin || isPartnerAdmin,
  });

  // Create custom role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: { name: string; description: string; permissions: string[]; organization_id?: string }) => {
      const { data, error } = await supabase
        .from('custom_roles' as any)
        .insert([roleData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Custom role created successfully');
      resetForm();
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create custom role');
    },
  });

  // Update custom role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomRole> & { id: string }) => {
      const { data, error } = await supabase
        .from('custom_roles' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Custom role updated successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update custom role');
    },
  });

  // Delete custom role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('custom_roles' as any)
        .update({ is_active: false })
        .eq('id', roleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Custom role deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete custom role');
    },
  });

  const resetForm = () => {
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions([]);
    setEditingRole(null);
    setViewSystemRoles(false);
  };
  
  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };
  
  const selectAllInCategory = (permissions: Permission[]) => {
    const permIds = permissions.map(p => p.id);
    const allSelected = permIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !permIds.includes(p)));
    } else {
      setSelectedPermissions(prev => Array.from(new Set([...prev, ...permIds])));
    }
  };
  
  const importFromSystemRole = (role: string) => {
    const rolePerms = SYSTEM_ROLE_PERMISSIONS[role] || [];
    setSelectedPermissions(Array.from(new Set([...selectedPermissions, ...rolePerms])));
    toast.success(`Imported permissions from ${role}`);
  };

  const handleSubmit = () => {
    if (!roleName.trim()) {
      toast.error('Role name is required');
      return;
    }

    if (selectedPermissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    if (editingRole) {
      updateRoleMutation.mutate({
        id: editingRole.id,
        name: roleName,
        description: roleDescription,
        permissions: selectedPermissions,
      });
    } else {
      const roleData: any = {
        name: roleName,
        description: roleDescription,
        permissions: selectedPermissions,
      };

      // Partner admins can only create org-scoped roles
      if (isPartnerAdmin && organizationId) {
        roleData.organization_id = organizationId;
      }

      // Platform admins can create global roles (organization_id = null) or org-scoped roles
      if (isPlatformAdmin && organizationId) {
        roleData.organization_id = organizationId;
      }

      createRoleMutation.mutate(roleData);
    }
  };

  const handleEdit = (role: CustomRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setSelectedPermissions(role.permissions);
    setIsCreateOpen(true);
  };

  if (!isPlatformAdmin && !isPartnerAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Custom Roles</CardTitle>
            <CardDescription>
              {isPlatformAdmin 
                ? 'Create custom roles for your organization or globally'
                : 'Create custom roles for your organization'}
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRole ? 'Edit Custom Role' : 'Create Custom Role'}</DialogTitle>
                <DialogDescription>
                  {isPlatformAdmin 
                    ? 'Create a custom role with specific permissions. Leave organization blank for global roles.'
                    : 'Create a custom role for your organization with specific permissions.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g., Content Manager"
                  />
                </div>
                <div>
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea
                    id="role-description"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="Describe what this role can do"
                    rows={2}
                  />
                </div>
                
                {/* System Role Import */}
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Quick Start: Import from System Roles</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewSystemRoles(!viewSystemRoles)}
                    >
                      {viewSystemRoles ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  {viewSystemRoles && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(SYSTEM_ROLE_PERMISSIONS).map(role => (
                        <Button
                          key={role}
                          variant="outline"
                          size="sm"
                          onClick={() => importFromSystemRole(role)}
                          className="justify-start"
                        >
                          <Shield className="h-3 w-3 mr-2" />
                          {role.replace(/_/g, ' ')}
                        </Button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Import permissions from system roles as a starting point, then customize.
                  </p>
                </div>

                {/* Permissions Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Permissions ({selectedPermissions.length} selected)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPermissions([])}
                      disabled={selectedPermissions.length === 0}
                    >
                      Clear All
                    </Button>
                  </div>
                  
                  <Accordion type="multiple" className="w-full">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => {
                      const categoryPerms = perms.map(p => p.id);
                      const allSelected = categoryPerms.every(id => selectedPermissions.includes(id));
                      const someSelected = categoryPerms.some(id => selectedPermissions.includes(id));
                      
                      return (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 w-full">
                              <Checkbox
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={() => selectAllInCategory(perms)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="font-medium">{category}</span>
                              <Badge variant="secondary" className="ml-auto">
                                {categoryPerms.filter(id => selectedPermissions.includes(id)).length}/{categoryPerms.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pl-6">
                              {perms.map(permission => (
                                <div key={permission.id} className="flex items-start space-x-2">
                                  <Checkbox
                                    id={permission.id}
                                    checked={selectedPermissions.includes(permission.id)}
                                    onCheckedChange={() => togglePermission(permission.id)}
                                  />
                                  <div className="flex-1">
                                    <label
                                      htmlFor={permission.id}
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {permission.name}
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                      {permission.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
                  {editingRole ? 'Update' : 'Create'} Role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading custom roles...</p>
        ) : !customRoles || customRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom roles created yet.</p>
        ) : (
          <div className="space-y-3">
            {customRoles.map((role) => (
              <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{role.name}</h4>
                    {role.organization_id ? (
                      <Badge variant="secondary">Organization</Badge>
                    ) : (
                      <Badge>Global</Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {role.permissions.map((perm, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(role)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRoleMutation.mutate(role.id)}
                    disabled={deleteRoleMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
