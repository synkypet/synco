// src/hooks/use-campaigns.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignService } from '@/services/supabase/campaign-service';
import { CreateCampaignDTO } from '@/types/campaign';
import { toast } from 'sonner';

export function useCampaigns(userId?: string) {
  return useQuery({
    queryKey: ['campaigns', userId],
    queryFn: () => userId ? campaignService.list(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, dto }: { userId: string; dto: CreateCampaignDTO }) => 
      campaignService.create(userId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error creating campaign:', error);
      toast.error('Erro ao criar campanha: ' + error.message);
    }
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => 
      campaignService.delete(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha excluída.');
    },
  });
}
