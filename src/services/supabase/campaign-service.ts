import { createClient } from '@/lib/supabase/client';
import { Campaign, CreateCampaignDTO } from '@/types/campaign';
import { SupabaseClient } from '@supabase/supabase-js';
import { triggerWorker } from '@/lib/worker/trigger';

export const campaignService = {

  async list(userId: string, page: number = 1, pageSize: number = 20): Promise<{ campaigns: Campaign[], total: number, page: number, pageSize: number, totalPages: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('campaigns')
      .select(`
        *,
        items:campaign_items(*),
        destinations:campaign_destinations(*)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }

    const total = count || 0;

    return {
      campaigns: data as Campaign[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  },

  async create(userId: string, dto: CreateCampaignDTO, client?: SupabaseClient): Promise<Campaign> {
    const supabase = client || createClient();
    console.log(`[CAMPAIGN-SERVICE] Iniciando criação de campanha para user ${userId}...`);

    // ─── 0.1 Billing Enforcement (Fase 2 - Redundante) ────────────────────────
    // Esta trava garante que mesmo que uma API seja burlada, o núcleo do serviço recuse a criação.
    if (typeof window === 'undefined') {
      try {
        const { resolveUserAccessCore } = await import('@/services/supabase/access-resolver');
        const access = await resolveUserAccessCore(userId, supabase);
        
        if (!access.isOperative) {
          console.error(`[CAMPAIGN-SERVICE] [HARD-LOCK] Bloqueio de Billing para User ${userId}. Status: ${access.status}`);
          throw new Error(`BILLING_RESTRICTED:${access.status}`);
        }
      } catch (e: any) {
        // Se for o erro de billing, repassar. Se for erro de import/outro, logar e continuar (best effort)
        if (e.message?.startsWith('BILLING_RESTRICTED')) throw e;
        console.warn('[CAMPAIGN-SERVICE] Falha ao validar billing (Bypass de segurança):', e.message);
      }
    }

    // ─── 1. Validação Prévia ──────────────────────────────────────────────────
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
        status: dto.scheduled_at ? 'scheduled' : 'pending',
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
      // Se for um ID temporário do processamento (proc_*), enviamos null para evitar erro de UUID no banco
      product_id: (item.product_id && typeof item.product_id === 'string' && item.product_id.startsWith('proc_')) 
        ? null 
        : item.product_id,
      product_name: item.product_name,
      custom_text: item.custom_text,
      affiliate_url: item.affiliate_url,
      image_url: item.image_url,
      external_product_id: item.external_product_id,
      installments: item.installments,
      // Rastreabilidade (Fase 1)
      incoming_url: item.incoming_url,
      resolved_url: item.resolved_url,
      canonical_url: item.canonical_url,
      generated_affiliate_url: item.generated_affiliate_url,
      redirect_chain: item.redirect_chain || [],
      reaffiliation_status: item.reaffiliation_status,
      reaffiliation_error: item.reaffiliation_error,
      
      // Elegibilidade Operacional (Fase 2)
      eligibility_status: item.eligibility_status,
      eligibility_reasons: item.eligibility_reasons
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
        // Suporte tanto para objeto único quanto para array (formato padrão do Supabase em joins)
        const channelData = Array.isArray(group.channels) ? group.channels[0] : group.channels;
        const channelConfig = (channelData as any)?.config || {};
        const channelType = (channelData as any)?.type || 'whatsapp';
        const sessionId = channelConfig.sessionId || channelConfig.bot_id || null;

        const isConnected = channelType === 'telegram' 
          ? channelConfig.status === 'connected'
          : !!sessionId;

        // --- GUARDIÃO ESTRUTURAL DA FASE 2 ---
        // A geração de job agora depende EXCLUSIVAMENTE da elegibilidade gravada no item.
        const isEligible = item.eligibility_status === 'eligible' || item.eligibility_status === 'warning';

        if (isConnected && isEligible) {
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
        } else if (!isEligible) {
            console.warn(`[CAMPAIGN-SERVICE] Item ${item.id} pulado porque o status de elegibilidade é: ${item.eligibility_status}. Motivos: ${item.eligibility_reasons?.join(' | ') || 'Nenhum reportado'}`);
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
      console.warn(`[CAMPAIGN-SERVICE] Nenhum job elegível gerado para a campanha #${campaign.id}. Marcando como falha operacional.`);
      
      // Regra Oficial: Se não houver jobs e a campanha não for agendada, marcar como failed.
      if (!dto.scheduled_at) {
        await supabase
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id);
        
        // Atualizar o objeto local para o retorno
        campaign.status = 'failed';
      }
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

  /**
   * Wrapper especializado para o Envio Rápido (UI).
   * Garante isolamento de contexto e prefixo operacional.
   */
  async createQuickSendCampaign(userId: string, dto: CreateCampaignDTO, client?: SupabaseClient): Promise<Campaign> {
    console.log(`[CAMPAIGN-SERVICE] [QUICK-SEND] Iniciando criação de despacho manual para user ${userId}...`);
    
    const manualDto: CreateCampaignDTO = {
      ...dto,
      name: `🚀 [MANUAL] ${dto.name || new Date().toLocaleDateString()}`
    };

    return this.create(userId, manualDto, client);
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
      session_lost: data.filter(j => j.status === 'session_lost').length,
    };

    return stats;
  },

  async getDestinationStats(campaignId: string) {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('send_jobs')
      .select('status, destination, destination_name')
      .eq('campaign_id', campaignId);

    if (error) throw error;

    // Agregação em memória (eficiente para o volume do MVP)
    const grouped = new Map<string, any>();

    data.forEach(job => {
      const id = job.destination;
      if (!grouped.has(id)) {
        grouped.set(id, {
          id,
          name: job.destination_name || 'Desconhecido',
          total: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          processing: 0,
        });
      }

      const entry = grouped.get(id);
      entry.total++;
      
      if (job.status === 'sent' || job.status === 'completed') entry.completed++;
      else if (job.status === 'failed') entry.failed++;
      else if (job.status === 'processing') entry.processing++;
      else if (job.status === 'session_lost') entry.session_lost = (entry.session_lost || 0) + 1;
      else entry.pending++;
    });

    return Array.from(grouped.values()).map(dest => ({
      ...dest,
      progress: Math.round(( (dest.completed + dest.failed) / dest.total) * 100),
      status: dest.total === dest.completed + dest.failed 
        ? (dest.failed > 0 ? 'failed' : 'completed') 
        : (dest.processing > 0 ? 'processing' : 'pending')
    }));
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
