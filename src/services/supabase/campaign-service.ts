// src/services/supabase/campaign-service.ts
import { createClient } from '@/lib/supabase/client';
import { Campaign, CreateCampaignDTO } from '@/types/campaign';

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

  async create(userId: string, dto: CreateCampaignDTO): Promise<Campaign> {
    const supabase = createClient();

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
        affiliate_url: item.affiliate_url,
        image_url: item.image_url // Garantir que image_url possa passar se adicionado ao DTO
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
        .select('id, remote_id, name, channel_id, channels(config)')
        .in('id', groupIds);

      if (groupsInfo && groupsInfo.length > 0) {
        const jobsToInsert: any[] = [];

        insertedItems.forEach(item => {
          groupsInfo.forEach(group => {
            const channelConfig = (group.channels as any)?.config || {};
            const sessionId = channelConfig.sessionId;

            // Só insere se tiver session_id válida
            if (sessionId) {
              jobsToInsert.push({
                user_id: userId,
                campaign_id: campaign.id,
                campaign_item_id: item.id,
                channel_id: group.channel_id,
                session_id: sessionId,
                destination: group.remote_id,
                destination_name: group.name,
                message_body: item.custom_text || item.product_name,
                message_type: item.image_url ? 'image' : 'text',
                image_url: item.image_url,
                status: 'pending',
                try_count: 0
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
  }
};
