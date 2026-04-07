import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupService } from '@/services/supabase/group-service';
import { Group } from '@/types/group';
import { toast } from 'sonner';

export function useGroups(userId: string | undefined) {
  return useQuery({
    queryKey: ['groups', userId],
    queryFn: () => userId ? groupService.list(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (group: Omit<Group, 'id' | 'created_at' | 'updated_at'>) => 
      groupService.upsert(group as any),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.user_id] });
      toast.success('Grupo criado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      toast.error('Erro ao criar grupo.');
    }
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...group }: Partial<Group> & { id: string, user_id: string }) => 
      groupService.upsert({ id, ...group } as any),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.user_id] });
      toast.success('Grupo atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating group:', error);
      toast.error('Erro ao atualizar grupo.');
    }
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, user_id }: { id: string, user_id: string }) => 
      groupService.delete(id, user_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.user_id] });
      toast.success('Grupo excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting group:', error);
      toast.error('Erro ao excluir grupo.');
    }
  });
}
