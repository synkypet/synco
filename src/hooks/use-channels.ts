import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelService } from '@/services/supabase/channel-service';
import { Channel } from '@/types/group';
import { toast } from 'sonner';

export function useChannels(userId: string | undefined) {
  return useQuery({
    queryKey: ['channels', userId],
    queryFn: () => fetch('/api/wasender/channels').then(res => res.ok ? res.json() : Promise.reject('Failed to fetch')) as Promise<Channel[]>,
    enabled: !!userId,
    refetchInterval: () => {
      // 30s base + jitter de ±5s
      const jitter = Math.floor(Math.random() * 10000) - 5000;
      return 30000 + jitter;
    }
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: Omit<Channel, 'id' | 'created_at' | 'updated_at'>) => 
      fetch('/api/wasender/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channel)
      }).then(res => res.json().then(data => res.ok ? data : Promise.reject(data))),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channels', variables.user_id] });
      toast.success('Canal e sessão criados com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error creating channel:', error);
      toast.error(error.message || 'Erro ao criar canal e sessão na Wasender.');
    }
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...channel }: Partial<Channel> & { id: string, user_id: string }) => 
      channelService.upsert({ id, ...channel }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channels', variables.user_id] });
      toast.success('Metadados do canal atualizados!');
    },
    onError: (error) => {
      console.error('Error updating channel:', error);
      toast.error('Erro ao editar canal.');
    }
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, user_id }: { id: string, user_id: string }) => 
      fetch(`/api/wasender/channels/${id}`, {
        method: 'DELETE'
      }).then(res => res.json().then(data => res.ok ? data : Promise.reject(data))),
    onSuccess: (_, variables) => {
      console.log(`[useDeleteChannel] Invalidação disparada para user: ${variables.user_id}`);
      queryClient.invalidateQueries({ queryKey: ['channels', variables.user_id] });
      // Fallback: invalidar prefixo também para garantir
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Canal e sessão excluídos com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error deleting channel:', error);
      toast.error(error.message || 'Erro ao excluir canal.');
    }
  });
}

export function useDisconnectChannel() {
    const queryClient = useQueryClient();
  
    return useMutation({
      mutationFn: ({ id, user_id }: { id: string, user_id: string }) => 
        fetch(`/api/wasender/channels/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disconnect' })
        }).then(res => res.json().then(data => res.ok ? data : Promise.reject(data))),
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['channels', variables.user_id] });
        toast.info('Sessão desconectada. Reutilize o QR para reconectar.');
      },
      onError: (error: any) => {
        toast.error(error.message || 'Falha ao desconectar.');
      }
    });
}

export function useRefreshChannelStatus() {
    const queryClient = useQueryClient();
  
    return useMutation({
      mutationFn: ({ id, user_id }: { id: string, user_id: string }) => 
        fetch(`/api/wasender/channels/${id}`, {
          method: 'GET'
        }).then(res => res.json().then(data => res.ok ? data : Promise.reject(data))),
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['channels', variables.user_id] });
        toast.success(`Status atualizado: ${data.status}`);
      },
      onError: (error: any) => {
        toast.error('Falha ao atualizar status remoto.');
      }
    });
}
