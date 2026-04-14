import { createClient } from '@/lib/supabase/client';
import { Campaign, CreateCampaignDTO } from '@/types/campaign';
import { SupabaseClient } from '@supabase/supabase-js';

export const campaignService = {

  async list(userId: string): Promise<Campaign[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        items:campaign_items(*),
        destinations:campaign_destinations(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }

    return data as Campaign[];
  },

  async create(userId: string, dto: CreateCampaignDTO, client?: SupabaseClient): Promise<Campaign> {
    const supabase = client || createClient();

    // 1. Insert campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name: dto.name || `Envio ${new Date().toLocaleString()}`,
        status: dto.scheduled_at ? 'scheduled' : 'completed',
        scheduled_at: dto.scheduled_at
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      throw campaignError;
    }

    // 2. Insert items
    let insertedItems: any[] = [];
    if (dto.items && dto.items.length > 0) {
      const itemsToInsert = dto.items.map(item => ({
        campaign_id: campaign.id,
        product_id: item.product_id,
        product_name: item.product_name,
        custom_text: item.custom_text,
        affiliate_url: item.affiliate_url
      }));

      const { data: items, error: itemsError } = await supabase
        .from('campaign_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.error('Error inserting campaign items:', itemsError);
        throw itemsError;
      }
      insertedItems = items;
    }

    // 3. Insert destinations
    let insertedDestinations: any[] = [];
    if (dto.destinations && dto.destinations.length > 0) {
      const destinationsToInsert = dto.destinations.map(dest => ({
        campaign_id: campaign.id,
        destination_type: dest.type,
        destination_id: dest.id
      }));

      const { data: dests, error: destError } = await supabase
        .from('campaign_destinations')
        .insert(destinationsToInsert)
        .select();

      if (destError) {
        console.error('Error inserting campaign destinations:', destError);
        throw destError;
      }
      insertedDestinations = dests;
    }

    // 4. Transformar em Send Jobs (Geração Real da Fila)
    // Para cada canal de destino (group/list), e cada item de campanha, gerar um send_job
    if (insertedItems.length > 0 && insertedDestinations.length > 0) {
      // Buscar a config e os detalhes dos destinos (grupos) para pegar remote_id e session_id
      const groupIds = insertedDestinations.map(d => d.destination_id);
      const { data: groupsInfo } = await supabase
        .from('groups')
        .select('id, remote_id, name, channel_id, channels(config, type)')
        .in('id', groupIds);

      // Buscar outros canais ativos do usuário para fallback
      const { data: userChannels } = await supabase
        .from('channels')
        .select('id, type, config')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (groupsInfo && groupsInfo.length > 0) {
        const jobsToInsert: any[] = [];

        insertedItems.forEach(item => {
          groupsInfo.forEach(group => {
            const channelConfig = (group.channels as any)?.config || {};
            const channelType = (group.channels as any)?.type || 'whatsapp';
            const sessionId = channelConfig.sessionId || channelConfig.bot_id || null;

            // Aceitar canais Telegram (que usam bot_id) e WhatsApp (que usam sessionId)
            const isConnected = channelType === 'telegram' 
              ? channelConfig.status === 'connected'
              : !!sessionId;

            if (isConnected) {
              // Buscar canal de fallback (outro canal ativo do mesmo user, tipo diferente)
              const fallbackChannel = userChannels?.find(ch => 
                ch.id !== group.channel_id && 
                ch.config?.status === 'connected'
              );

              jobsToInsert.push({
                user_id: userId,
                campaign_id: campaign.id,
                campaign_item_id: item.id,
                channel_id: group.channel_id,
                session_id: sessionId,
                destination: group.remote_id,
                destination_name: group.name,
                message_body: item.custom_text || item.product_name,
                message_type: 'text',
                status: 'pending',
                try_count: 0,
                fallback_channel_id: fallbackChannel?.id || null,
              });
            }
          });
        });

        if (jobsToInsert.length > 0) {
          // On-conflict garante idempotência. A database ignora se a constraint única for violada
          const { error: jobsError } = await supabase
            .from('send_jobs')
            .upsert(jobsToInsert, { onConflict: 'campaign_id, campaign_item_id, destination', ignoreDuplicates: true });

          if (jobsError) {
             console.error('Falha ao gerar send_jobs:', jobsError);
             throw new Error(`Failed to generate send jobs: ${jobsError.message}`);
          }
        }
      }
    }

    return campaign as Campaign;
  },

  async getById(id: string, userId: string): Promise<Campaign | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        items:campaign_items(*),
        destinations:campaign_destinations(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching campaign by id:', error);
      throw error;
    }

    return data as Campaign;
  },

  async delete(id: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  },

  async getStats(campaignId: string) {
    const supabase = createClient();
    
    // Agregação eficiente agrupada por status usando rpc ou queries rápidas (count select)
    // Para simplificar no MVP e usar o PostgREST nativo com índices:
    const { data, error } = await supabase
      .from('send_jobs')
      .select('status')
      .eq('campaign_id', campaignId);

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter(j => j.status === 'pending').length,
      processing: data.filter(j => j.status === 'processing').length,
      completed: data.filter(j => j.status === 'sent' || j.status === 'completed').length,
      failed: data.filter(j => j.status === 'failed').length,
      cancelled: data.filter(j => j.status === 'cancelled').length,
    };

    return stats;
  },

  async getJobsPaginated(campaignId: string, page: number = 1, pageSize: number = 20) {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact' })
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      jobs: data,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    };
  }
};
