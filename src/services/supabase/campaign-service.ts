import { createClient } from '@/lib/supabase/client';
import { Campaign, CreateCampaignDTO } from '@/types/campaign';
import { SupabaseClient } from '@supabase/supabase-js';
import { triggerWorker } from '@/lib/worker/trigger';

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
    console.log(`[CAMPAIGN-SERVICE] Iniciando criação de campanha para user ${userId}...`);

    // ─── 0. Validação Prévia ──────────────────────────────────────────────────
    if (!dto.items || dto.items.length === 0) {
      console.warn('[CAMPAIGN-SERVICE] Abortando: Nenhun item fornecido.');
      throw new Error('Nenhum item fornecido para a campanha.');
    }

    if (!dto.destinations || dto.destinations.length === 0) {
      console.warn('[CAMPAIGN-SERVICE] Abortando: Nenhum destino fornecido.');
      throw new Error('Nenhum destino fornecido para a campanha.');
    }

    // ─── 1. Resolução de Destinos (Expansão de Listas) ─────────────────────────
    const finalGroupIds = new Set<string>();
    
    // Separar grupos diretos e listas
    const directGroupIds = dto.destinations.filter(d => d.type === 'group').map(d => d.id);
    const listIds = dto.destinations.filter(d => d.type === 'list').map(d => d.id);

    directGroupIds.forEach(id => finalGroupIds.add(id));

    if (listIds.length > 0) {
      console.log(`[CAMPAIGN-SERVICE] Expandindo ${listIds.length} listas de destino...`);
      const { data: listGroups } = await supabase
        .from('destination_list_groups')
        .select('group_id')
        .in('list_id', listIds);
      
      if (listGroups) {
        listGroups.forEach(lg => finalGroupIds.add(lg.group_id));
      }
    }

    if (finalGroupIds.size === 0) {
      console.warn('[CAMPAIGN-SERVICE] Abortando: Nenhun destino real (grupo) resolvido após expansão.');
      throw new Error('Nenhum destino válido encontrado após expansão das listas.');
    }

    // ─── 2. Buscar informações dos Grupos e Canais ────────────────────────────
    const { data: groupsInfo, error: groupsError } = await supabase
      .from('groups')
      .select('id, remote_id, name, channel_id, channels(config, type)')
      .in('id', Array.from(finalGroupIds));

    if (groupsError || !groupsInfo || groupsInfo.length === 0) {
      console.error('[CAMPAIGN-SERVICE] Erro ao buscar informações dos grupos:', groupsError);
      throw new Error('Falha ao processar destinos da campanha.');
    }

    // Deduplicação extra por remote_id (Prevenção de loop/spam no mesmo grupo via rotas redundantes)
    const uniqueGroups = new Map<string, any>();
    groupsInfo.forEach(g => {
      const key = `${g.channel_id}:${g.remote_id}`;
      if (!uniqueGroups.has(key)) {
        uniqueGroups.set(key, g);
      }
    });

    console.log(`[CAMPAIGN-SERVICE] Destinos resolvidos: ${groupsInfo.length} total, ${uniqueGroups.size} únicos por remote_id.`);

    // ─── 3. Persistência da Campanha (Finalmente!) ────────────────────────────
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

    // 4. Inserir Itens
    const itemsToInsert = dto.items.map(item => ({
      campaign_id: campaign.id,
      product_id: item.product_id,
      product_name: item.product_name,
      custom_text: item.custom_text,
      affiliate_url: item.affiliate_url,
      image_url: item.image_url,
      external_product_id: item.external_product_id,
      installments: item.installments
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('campaign_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      console.error('Error inserting campaign items:', itemsError);
      // Cleanup básico se falhar (opcional, já que estamos no mesmo processo)
      throw itemsError;
    }

    // 5. Inserir Destinos Originais (Manter rastreabilidade da rota/lista)
    const destinationsToInsert = dto.destinations.map(dest => ({
      campaign_id: campaign.id,
      destination_type: dest.type,
      destination_id: dest.id
    }));

    await supabase.from('campaign_destinations').insert(destinationsToInsert);

    // ─── 6. Geração Real dos Send Jobs ────────────────────────────────────────
    // Buscar canais para fallback
    const { data: userChannels } = await supabase
      .from('channels')
      .select('id, type, config')
      .eq('user_id', userId)
      .eq('is_active', true);

    const jobsToInsert: any[] = [];

    insertedItems.forEach(item => {
      uniqueGroups.forEach(group => {
        const channelConfig = (group.channels as any)?.config || {};
        const channelType = (group.channels as any)?.type || 'whatsapp';
        const sessionId = channelConfig.sessionId || channelConfig.bot_id || null;

        const isConnected = channelType === 'telegram' 
          ? channelConfig.status === 'connected'
          : !!sessionId;

        if (isConnected) {
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
            image_url: item.image_url,
            installments: item.installments,
            message_type: item.image_url ? 'image' : 'text',
            status: 'pending',
            try_count: 0,
            fallback_channel_id: fallbackChannel?.id || null,
          });
        }
      });
    });

    if (jobsToInsert.length > 0) {
      const { error: jobsError } = await supabase
        .from('send_jobs')
        .upsert(jobsToInsert, { onConflict: 'campaign_id, campaign_item_id, destination', ignoreDuplicates: true });

      if (jobsError) {
         console.error('Falha ao gerar send_jobs:', jobsError);
         throw new Error(`Failed to generate send jobs: ${jobsError.message}`);
      }
      console.log(`[CAMPAIGN-SERVICE] ✓ ${jobsToInsert.length} jobs gerados com sucesso.`);
    } else {
      console.warn(`[CAMPAIGN-SERVICE] Nenhum job elegível gerado para a campanha #${campaign.id}.`);
    }

    // 5. Kickstart the worker (Trigger)
    // Se estivermos no servidor, o CRON_SECRET estará disponível e o disparo será imediato.
    // Se estivermos no browser, o triggerWorker tentará disparar (pode falhar por falta de secret, 
    // mas o heartbeat/automação garantirá a drenagem redundante).
    // 5. Kickstart the worker (Trigger) - Best Effort
    // Não usamos await aqui deliberadamente para não atrasar a resposta ao usuário.
    // O utilitário triggerWorker já lida com erros internos de rede/secret.
    triggerWorker().then(success => {
      if (success) {
        console.log(`[CAMPAIGN-CREATE] [${campaign.id}] Worker acionado com sucesso.`);
      } else {
        console.warn(`[CAMPAIGN-CREATE] [${campaign.id}] Falha ao acionar worker (Heartbeat garantirá a drenagem).`);
      }
    }).catch(e => {
      console.error(`[CAMPAIGN-CREATE] [${campaign.id}] Erro inesperado no disparo do worker:`, e);
    });

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
  },

  /**
   * Busca múltiplas campanhas pelos seus IDs
   */
  async getByIds(ids: string[]): Promise<Campaign[]> {
    if (!ids || ids.length === 0) return [];
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        items:campaign_items(*),
        destinations:campaign_destinations(*)
      `)
      .in('id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns by ids:', error);
      throw error;
    }

    return data as Campaign[];
  }
};
