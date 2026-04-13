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

export function useGroupDetail(groupId: string, userId: string | undefined) {
  const queryClient = useQueryClient();

  // 1. Query para os metadados Mínimos do grupo (Cache Rápido)
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => userId ? groupService.getById(groupId, userId) : Promise.resolve(null),
    enabled: !!userId && !!groupId,
  });

  // 2. Query para a Malha Profunda (On-Demand Fetch Direto na Wasender)
  const meshQuery = useQuery({
    queryKey: ['group-mesh', groupId],
    queryFn: () => groupService.getMeshDetails(groupId),
    enabled: !!groupId && !!groupQuery.data,
    staleTime: 5 * 60 * 1000, // TTL de 5 minutos
  });

  // 3. Função para forçar o Refresh manual
  const sync = async () => {
    await queryClient.invalidateQueries({ queryKey: ['group-mesh', groupId] });
    await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    await queryClient.invalidateQueries({ queryKey: ['groups', userId] });
    toast.success('Malha do grupo reconciliada com sucesso!');
  };

  return {
    group: groupQuery.data,
    meshData: meshQuery.data,
    participants: meshQuery.data?.participants || [],
    isLoading: groupQuery.isLoading || meshQuery.isLoading,
    isSyncing: meshQuery.isFetching,
    sync,
    isError: groupQuery.isError || meshQuery.isError
  };
}
