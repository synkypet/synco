// src/hooks/use-send-preferences.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface UserSendPreferences {
  user_id: string;
  send_window_start: string | null;
  send_window_end: string | null;
  send_window_timezone: string;
  updated_at?: string;
}

export function useSendPreferences(userId?: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user_send_preferences', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_send_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching send preferences:', error);
        return null;
      }
      return data as UserSendPreferences | null;
    },
    enabled: !!userId
  });

  const upsertPreferences = useMutation({
    mutationFn: async (updates: Partial<UserSendPreferences>) => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_send_preferences')
        .upsert({
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_send_preferences', userId] });
      toast.success('Preferências de envio atualizadas!');
    },
    onError: (error: any) => {
      console.error('Error updating send preferences:', error);
      toast.error('Erro ao salvar preferências de envio.');
    }
  });

  return {
    preferences,
    isLoading,
    upsertPreferences: upsertPreferences.mutate,
    isUpdating: upsertPreferences.isPending
  };
}
