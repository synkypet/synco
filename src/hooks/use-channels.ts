import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelService } from '@/services/supabase/channel-service';
import { Channel } from '@/types/group';
import { toast } from 'sonner';

export function useChannels(userId: string | undefined) {
  return useQuery({
    queryKey: ['channels', userId],
    queryFn: () => userId ? channelService.list(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: Omit<Channel, 'id' | 'created_at' | 'updated_at'>) => 
      channelService.upsert(channel),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channels', variables.user_id] });
      toast.success('Canal criado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating channel:', error);
      toast.error('Erro ao criar canal.');
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
      toast.success('Canal atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating channel:', error);
      toast.error('Erro ao atualizar canal.');
    }
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, user_id }: { id: string, user_id: string }) => 
      channelService.delete(id, user_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channels', variables.user_id] });
      toast.success('Canal excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting channel:', error);
      toast.error('Erro ao excluir canal.');
    }
  });
}
