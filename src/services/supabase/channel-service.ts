import { createClient } from '@/lib/supabase/client';
import { Channel } from '@/types/group';

export const channelService = {
  async list(userId: string): Promise<Channel[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching channels:', error);
      throw error;
    }
    return data || [];
  },

  async upsert(channel: Partial<Channel> & { user_id: string }): Promise<Channel> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('channels')
      .upsert(channel)
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting channel:', error);
      throw error;
    }
    return data;
  },

  async delete(id: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting channel:', error);
      throw error;
    }
  }
};
