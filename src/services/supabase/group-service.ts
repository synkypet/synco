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
        channels (name)
      `)
      .eq('user_id', userId)
      .order('name');
    
    if (error) {
      console.error('Error fetching groups:', error);
      throw error;
    }
    
    return (data || []).map(g => ({
      ...g,
      channel_name: (g as any).channels?.name || 'N/A'
    })) as Group[];
  },

  /**
   * Cria ou atualiza um grupo
   */
  async upsert(group: Partial<Group> & { user_id: string; channel_id: string }): Promise<Group> {
    const supabase = createClient();
    // Remove campos computados ou de visualização antes de salvar
    const { channel_name, sends_received, ...payload } = group as any;
    
    const { data, error } = await supabase
      .from('groups')
      .upsert(payload)
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting group:', error);
      throw error;
    }
    return data;
  },

  /**
   * Remove um grupo (respeitando RLS via user_id)
   */
  async delete(id: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }
};
