// src/hooks/use-campaigns.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignService } from '@/services/supabase/campaign-service';
import { CreateCampaignDTO, Campaign } from '@/types/campaign';
import { toast } from 'sonner';

export function useCampaigns(userId?: string) {
  return useQuery({
    queryKey: ['campaigns', userId],
    queryFn: () => userId ? campaignService.list(userId) : Promise.resolve([]),
    enabled: !!userId,
    // Polling a cada 10s para garantir visibilidade de novas campanhas sem refresh manual
    refetchInterval: 10000,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, dto }: { userId: string; dto: CreateCampaignDTO }) => 
      campaignService.create(userId, dto),
    onSuccess: (data: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Campanha ${data.id.slice(0, 8)} criada com sucesso!`);
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

export function useCampaignStats(campaignId?: string) {
  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    queryFn: () => campaignId ? campaignService.getStats(campaignId) : null,
    enabled: !!campaignId,
    refetchInterval: (query) => {
      const stats = query.state.data as any;
      // Se ainda houver jobs pendentes ou em processamento, continua o refresh a cada 3s
      return (stats?.pending > 0 || stats?.processing > 0) ? 3000 : false;
    }
  });
}

export function useCampaignJobs(campaignId: string | undefined, page: number = 1) {
  return useQuery({
    queryKey: ['campaign-jobs', campaignId, page],
    queryFn: () => campaignId ? campaignService.getJobsPaginated(campaignId, page) : null,
    enabled: !!campaignId,
  });
}

// ─── Queue Visibility ────────────────────────────────────────────────────────

export interface QueuePosition {
  position: number;
  pendingInCampaign: number;
  channelId: string | null;
  operationalStatus: 'queued' | 'cooldown' | 'sending' | 'completed';
  lastProcessedAt: string | null;
}

export function useQueuePosition(campaignId?: string, hasPending?: boolean) {
  return useQuery<QueuePosition>({
    queryKey: ['queue-position', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/send-jobs/queue-position?campaign_id=${campaignId}`);
      if (!res.ok) throw new Error('Failed to fetch queue position');
      return res.json();
    },
    enabled: !!campaignId && !!hasPending,
    // Polling a cada 4s enquanto houver jobs ativos
    refetchInterval: hasPending ? 4000 : false,
    staleTime: 2000,
  });
}

export function useCancelPending() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch('/api/send-jobs/cancel-pending', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      if (!res.ok) throw new Error('Failed to cancel pending jobs');
      return res.json();
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-stats', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-jobs', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['queue-position', campaignId] });
      toast.success(`${data.cancelled} job(s) cancelados.`);
    },
    onError: () => {
      toast.error('Erro ao cancelar jobs pendentes.');
    }
  });
}
