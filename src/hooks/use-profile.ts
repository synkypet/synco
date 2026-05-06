import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
  created_at: string;
}

export function useProfile(userId?: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!userId) throw new Error('User ID is required');
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
      
      // Também atualizar o metadata do Auth para manter sincronia
      if (updates.full_name) {
        await supabase.auth.updateUser({
          data: { full_name: updates.full_name }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar perfil:', error);
      toast.error(`Falha ao atualizar perfil: ${error.message}`);
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
