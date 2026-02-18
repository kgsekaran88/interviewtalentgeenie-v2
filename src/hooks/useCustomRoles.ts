import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
}

export function useCustomRoles(organizationId?: string) {
  const queryClient = useQueryClient();

  const { data: customRoles, isLoading } = useQuery<CustomRole[]>({
    queryKey: ['custom-roles', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('custom_roles' as any)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CustomRole[];
    },
  });

  const assignCustomRole = useMutation({
    mutationFn: async ({ userId, roleId, organizationId }: { userId: string; roleId: string; organizationId?: string }) => {
      const { data, error } = await supabase
        .from('user_custom_roles' as any)
        .insert([{ 
          user_id: userId, 
          custom_role_id: roleId,
          organization_id: organizationId 
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-custom-roles'] });
      toast.success('Custom role assigned successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign custom role');
    },
  });

  const removeCustomRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase
        .from('user_custom_roles' as any)
        .delete()
        .eq('user_id', userId)
        .eq('custom_role_id', roleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-custom-roles'] });
      toast.success('Custom role removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove custom role');
    },
  });

  return {
    customRoles,
    isLoading,
    assignCustomRole,
    removeCustomRole,
  };
}
