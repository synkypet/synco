import { createClient } from '@/lib/supabase/client';
import { Marketplace, UserMarketplaceConnection } from '@/types/marketplace';
import { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';

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
  async getUserConnections(userId: string, client?: SupabaseClient): Promise<UserMarketplaceConnection[]> {
    const supabase = client || createClient();
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
   * Busca as conexões do usuário enriquecidas com os segredos descriptografados.
   * EXCLUSIVO PARA USO EM SERVER-SIDE/WORKER (Requer decrypter e MASTER_KEY).
   */
  async getEnrichedConnections(userId: string, supabaseAdmin: SupabaseClient): Promise<any[]> {
    // 1. Buscar conexões base (dados públicos + app_id)
    const { data: connections, error: connError } = await supabaseAdmin
      .from('user_marketplaces')
      .select('*, marketplaces(name)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (connError) {
      console.error('[MARKETPLACE-SERVICE] Error fetching connections:', connError);
      return [];
    }

    if (!connections || connections.length === 0) return [];

    // 2. Buscar segredos para essas conexões
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .select('*')
      .eq('user_id', userId);

    if (secretsError) {
       console.error('[MARKETPLACE-SERVICE] Error fetching secrets:', secretsError);
    }

    // 3. Mesclar e Descriptografar
    return connections.map(conn => {
      const secretRow = (secrets || []).find(s => s.marketplace_id === conn.marketplace_id);
      let appSecret = '';

      if (secretRow) {
        try {
          appSecret = decrypt({
            encryptedValue: secretRow.encrypted_secret,
            iv: secretRow.iv,
            authTag: secretRow.auth_tag
          });
        } catch (err) {
          console.error(`[MARKETPLACE-SERVICE] Falha ao descriptografar segredo para marketplace ${conn.marketplace_id}:`, err);
        }
      }

      return {
        ...conn,
        marketplace_name: conn.marketplaces?.name || '',
        shopee_app_secret: appSecret
      };
    });
  },

  /**
   * Cria ou atualiza uma conexão de marketplace para o usuário
   */
  async upsertConnection(connection: Partial<UserMarketplaceConnection> & { user_id: string; marketplace_id: string }): Promise<UserMarketplaceConnection> {
    const supabase = createClient();
    
    // Separa o secret do payload normal (ele é enviado paralelamente à rota de API encrypt)
    const { shopee_app_secret, ...safeConnection } = connection;

    const { data, error } = await supabase
      .from('user_marketplaces')
      .upsert(safeConnection, { onConflict: 'user_id, marketplace_id' })
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting marketplace connection:', error);
      throw error;
    }

    return data;
  }
};
