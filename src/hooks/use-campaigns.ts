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
    // Polling mais agressivo para ver novas campanhas
    refetchInterval: 5000,
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

export function useCampaignStats(campaignId?: string, createdAt?: string) {
  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    queryFn: () => campaignId ? campaignService.getStats(campaignId) : null,
    enabled: !!campaignId,
    staleTime: 0,
    refetchInterval: (query) => {
      const stats = query.state.data as any;
      const isActive = (stats?.pending > 0 || stats?.processing > 0);

      // Campanha nova (< 3 min) com stats zerados: poll agressivo para pegar o
      // estado real dos send_jobs assim que o worker os registrar.
      const isNew = createdAt
        ? (Date.now() - new Date(createdAt).getTime()) < 3 * 60 * 1000
        : false;
      const isZero = stats && stats.total === 0;

      if (isActive)           return 2000;  // enviando / na fila
      if (isNew && isZero)    return 2000;  // recém-criada, aguardando jobs
      return 10000;                          // estável
    }
  });
}

export function useCampaignDestinationStats(campaignId: string | undefined, isActive: boolean = false) {
  return useQuery({
    queryKey: ['campaign-destination-stats', campaignId],
    queryFn: () => campaignId ? campaignService.getDestinationStats(campaignId) : null,
    enabled: !!campaignId,
    staleTime: 0,
    refetchInterval: isActive ? 3000 : false,
  });
}

export function useCampaignJobs(campaignId: string | undefined, page: number = 1) {
  return useQuery({
    queryKey: ['campaign-jobs', campaignId, page],
    queryFn: () => campaignId ? campaignService.getJobsPaginated(campaignId, page) : null,
    enabled: !!campaignId,
    staleTime: 0,
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
    // Polling agressivo enquanto houver jobs ativos
    refetchInterval: hasPending ? 3000 : false,
    staleTime: 0,
  });
}

export function useDispatchQuickSend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, campaignData }: { userId: string; campaignData: any }) => {
      const res = await fetch('/api/quick-send/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, campaignData }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao despachar envio manual');
      }
      return res.json() as Promise<Campaign>;
    },
    onSuccess: (data: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Broadcasting [MANUAL] iniciado: ${data.id.slice(0, 8)}`);
    },
    onError: (error: any) => {
      console.error('Error in Quick Send dispatch:', error);
      toast.error('Erro no despacho manual: ' + error.message);
    }
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
