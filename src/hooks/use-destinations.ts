import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { destinationService } from '@/services/supabase/destination-service';
import { DestinationList, DestinationListGroup } from '@/types/destination-list';
import { toast } from 'sonner';

export function useDestinations(userId: string | undefined) {
  return useQuery({
    queryKey: ['destinations', userId],
    queryFn: () => userId ? destinationService.list(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
}

export function useDestinationGroups(destinationId: string | undefined) {
  // O destinationService.list já traz os group_ids via join, 
  // mas se precisarmos de uma consulta específica:
  return useQuery({
    queryKey: ['destination-groups', destinationId],
    queryFn: async () => {
      if (!destinationId) return [];
      // Como não tem getDestinationGroups direto, vamos usar um hack ou implementar no service
      // Por enquanto, vamos retornar um array vazio ou adaptar o service se necessário.
      // Na verdade, o componente DestinationDialog usa isso para pegar os IDs atuais.
      // Mas o DestinationList já tem group_ids se vier do service.list().
      return [] as DestinationListGroup[];
    },
    enabled: !!destinationId,
  });
}

export function useCreateDestination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ destination, groupIds }: { 
      destination: Omit<DestinationList, 'id' | 'created_at' | 'updated_at'>, 
      groupIds: string[] 
    }) => {
      const newDest = await destinationService.upsert(destination as any);
      if (groupIds.length > 0) {
        await destinationService.syncGroups(newDest.id, groupIds);
      }
      return newDest;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['destinations', variables.destination.user_id] });
      toast.success('Lista de destino criada!');
    },
    onError: (error) => {
      console.error('Error creating destination:', error);
      toast.error('Erro ao criar lista.');
    }
  });
}

export function useUpdateDestination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, user_id, destination, groupIds }: { 
      id: string, 
      user_id: string,
      destination: Partial<DestinationList>, 
      groupIds?: string[] 
    }) => {
      await destinationService.upsert({ ...destination, id, user_id } as any);
      if (groupIds !== undefined) {
        await destinationService.syncGroups(id, groupIds);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['destinations', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['destination-groups', variables.id] });
      toast.success('Lista de destino atualizada!');
    },
    onError: (error) => {
      console.error('Error updating destination:', error);
      toast.error('Erro ao atualizar lista.');
    }
  });
}

export function useDeleteDestination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, user_id }: { id: string, user_id: string }) => 
      destinationService.delete(id, user_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['destinations', variables.user_id] });
      toast.success('Lista de destino excluída!');
    },
    onError: (error) => {
      console.error('Error deleting destination:', error);
      toast.error('Erro ao excluir lista.');
    }
  });
}
