import { createClient } from '@/lib/supabase/client';
import { DestinationList } from '@/types/destination-list';

export const destinationService = {
  /**
   * Lista todas as listas de destino do usuário, incluindo os IDs dos grupos vinculados
   */
  async list(userId: string): Promise<DestinationList[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('destination_lists')
      .select(`
        *,
        destination_list_groups (
          group_id
        )
      `)
      .eq('user_id', userId)
      .order('name');
    
    if (error) {
      console.error('Error fetching destination lists:', error);
      throw error;
    }

    return (data || []).map(list => ({
      ...list,
      group_ids: list.destination_list_groups?.map((dlg: any) => dlg.group_id) || []
    })) as DestinationList[];
  },

  /**
   * Cria ou atualiza uma lista de destino
   */
  async upsert(list: Partial<DestinationList> & { user_id: string }): Promise<DestinationList> {
    const supabase = createClient();
    const { group_ids, ...payload } = list as any;
    
    const { data, error } = await supabase
      .from('destination_lists')
      .upsert(payload)
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting destination list:', error);
      throw error;
    }
    return data;
  },

  /**
   * Remove uma lista de destino
   */
  async delete(id: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('destination_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting destination list:', error);
      throw error;
    }
  },

  /**
   * Sincroniza os grupos vinculados a uma lista de destino
   */
  async syncGroups(listId: string, groupIds: string[]): Promise<void> {
    const supabase = createClient();
    // Primeiro remove os vínculos existentes
    const { error: deleteError } = await supabase
      .from('destination_list_groups')
      .delete()
      .eq('list_id', listId);
    
    if (deleteError) {
      console.error('Error deleting destination list groups:', deleteError);
      throw deleteError;
    }
    
    // Se houver grupos para vincular, insere os novos
    if (groupIds && groupIds.length > 0) {
      const inserts = groupIds.map(groupId => ({
        list_id: listId,
        group_id: groupId
      }));
      
      const { error: insertError } = await supabase
        .from('destination_list_groups')
        .insert(inserts);
      
      if (insertError) {
        console.error('Error inserting destination list groups:', insertError);
        throw insertError;
      }
    }
  }
};
