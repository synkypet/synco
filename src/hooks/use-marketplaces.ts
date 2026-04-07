import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { UserMarketplaceConnection } from '@/types/marketplace';
import { toast } from 'sonner';

export function useMarketplaceCatalog() {
  return useQuery({
    queryKey: ['marketplaces', 'catalog'],
    queryFn: () => marketplaceService.getCatalog(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useUserMarketplaceConnections(userId: string | undefined) {
  return useQuery({
    queryKey: ['marketplaces', 'connections', userId],
    queryFn: () => userId ? marketplaceService.getUserConnections(userId) : Promise.resolve([]),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpsertMarketplaceConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connection: Partial<UserMarketplaceConnection> & { user_id: string; marketplace_id: string }) => 
      marketplaceService.upsertConnection(connection),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['marketplaces', 'connections', variables.user_id] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Error upserting connection:', error);
      toast.error('Erro ao salvar configurações.');
    }
  });
}
