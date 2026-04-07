import { createClient } from '@/lib/supabase/client';
import { Marketplace, UserMarketplaceConnection } from '@/types/marketplace';

export const marketplaceService = {
  /**
   * Busca o catálogo global de marketplaces
   */
  async getCatalog(): Promise<Marketplace[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('marketplaces')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching marketplace catalog:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Busca as conexões do usuário logado
   */
  async getUserConnections(userId: string): Promise<UserMarketplaceConnection[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_marketplaces')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching user marketplace connections:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Cria ou atualiza uma conexão de marketplace para o usuário
   */
  async upsertConnection(connection: Partial<UserMarketplaceConnection> & { user_id: string; marketplace_id: string }): Promise<UserMarketplaceConnection> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_marketplaces')
      .upsert(connection)
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting marketplace connection:', error);
      throw error;
    }
    return data;
  }
};
