import { createClient } from '@/lib/supabase/client';
import { Group } from '@/types/group';

export const groupService = {
  /**
   * Lista todos os grupos do usuário, incluindo o nome do canal vinculado
   */
  async list(userId: string): Promise<Group[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        channels (name, config)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching groups:', error);
      throw error;
    }
    
    return (data || []).map(g => ({
      ...g,
      channel_name: (g as any).channels?.name || 'N/A',
      channel_config: (g as any).channels?.config || {}
    })) as Group[];
  },

  /**
   * Busca detalhes de um único grupo
   */
  async getById(id: string, userId: string): Promise<Group | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        channels (
          name, 
          config,
          channel_secrets (session_api_key)
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error) return null;

    const channel = (data as any).channels;
    const sessionKey = channel?.channel_secrets?.[0]?.session_api_key;
    
    // Uma chave é válida se existir e não parecer ser de Telegram (sem ':')
    const hasValidKey = !!sessionKey && !sessionKey.includes(':');

    return {
      ...data,
      channel_name: channel?.name || 'N/A',
      channel_config: channel?.config || {},
      has_valid_key: hasValidKey
    } as Group & { has_valid_key: boolean };
  },

  /**
   * Lista participantes de um grupo
   */
  async getParticipants(groupId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('group_participants')
      .select(`
        role,
        last_synced_at,
        contacts (*)
      `)
      .eq('group_id', groupId);
    
    if (error) throw error;
    return data.map(p => ({
       role: p.role,
       last_synced_at: p.last_synced_at,
       ...(p.contacts as any)
    }));
  },

  /**
   * Dispara a sincronização profunda via API
   */
  async triggerDeepSync(groupId: string) {
    const res = await fetch(`/api/wasender/groups/${groupId}/details`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha na sincronização profunda');
    return data;
  }
};
