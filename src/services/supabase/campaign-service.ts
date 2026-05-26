import { createClient } from '@/lib/supabase/client';
import { Campaign, CreateCampaignDTO } from '@/types/campaign';
import { SupabaseClient } from '@supabase/supabase-js';
import { triggerWorker } from '@/lib/worker/trigger';

export const campaignService = {

  async list(userId: string, page: number = 1, pageSize: number = 20): Promise<{ campaigns: Campaign[], total: number, page: number, pageSize: number, totalPages: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1. Buscar apenas as campanhas necessárias
    const { data: campaignsData, error, count } = await supabase
      .from('campaigns')
      .select('id, user_id, name, status, created_at, scheduled_at, origin, metadata', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }

    let campaigns = (campaignsData || []) as unknown as Campaign[];

    // 2. Se houver campanhas, buscar itens e destinos leve (apenas os necessários para a UI)
    if (campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);

      const [itemsRes, destsRes] = await Promise.all([
        supabase
          .from('campaign_items')
          .select('id, campaign_id, image_url')
          .in('campaign_id', campaignIds),
        supabase
          .from('campaign_destinations')
          .select('id, campaign_id')
          .in('campaign_id', campaignIds)
      ]);

      if (itemsRes.error) console.error('Error fetching campaign_items:', itemsRes.error);
      if (destsRes.error) console.error('Error fetching campaign_destinations:', destsRes.error);

      const items = itemsRes.data || [];
      const destinations = destsRes.data || [];

      // Montar os arrays na memória O(N) para evitar O(N^2)
      const itemsMap = new Map<string, any[]>();
      const destsMap = new Map<string, any[]>();

      for (const item of items) {
        if (!itemsMap.has(item.campaign_id)) itemsMap.set(item.campaign_id, []);
        itemsMap.get(item.campaign_id)!.push(item);
      }

      for (const dest of destinations) {
        if (!destsMap.has(dest.campaign_id)) destsMap.set(dest.campaign_id, []);
        destsMap.get(dest.campaign_id)!.push(dest);
      }

      campaigns = campaigns.map(c => ({
        ...c,
        items: itemsMap.get(c.id) || [],
        destinations: destsMap.get(c.id) || []
      })) as Campaign[];
    }

    const total = count || 0;

    return {
      campaigns,
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

    // ─── 0.2 Coupon Dispatch Guardrail (Fase 2E.1B) ───────────────────────────
    const hasCoupon = 
      dto.origin === 'coupon' || 
      dto.items.some(item => item.offer_type === 'coupon_offer');
    
    const hasPromoLanding = dto.items.some(item => item.offer_type === 'promo_landing');

    if (hasPromoLanding) {
      const isManualPromo = 
        dto.origin === 'manual' && 
        (dto.metadata?.dispatchOrigin === 'quick_send_manual_promo_landing' || dto.metadata?.dispatchOrigin === 'quick_send_manual_mixed') &&
        dto.metadata?.manualPromoLandingSend === true &&
        dto.metadata?.confirmedByUser === true &&
        dto.metadata?.source === 'quick_send';

      if (!isManualPromo) {
        console.warn(`[CAMPAIGN-SERVICE] [GUARDRAIL] Bloqueio de promo_landing: Tentativa de envio sem confirmação manual validada para user ${userId}. Origin: ${dto.origin}`);
        throw new Error('promo_landing_manual_confirmation_required');
      }
      
      console.log(`[CAMPAIGN-SERVICE] [GUARDRAIL] Promo Landing autorizada para envio manual (Envio Rápido) para user ${userId}.`);
    }

    if (hasCoupon) {
      const isManualCoupon = 
        dto.origin === 'manual' && 
        (dto.metadata?.dispatchOrigin === 'quick_send_manual_coupon' || dto.metadata?.dispatchOrigin === 'quick_send_manual_mixed') &&
        dto.metadata?.manualCouponSend === true &&
        dto.metadata?.confirmedByUser === true;

      const isAutomationCoupon = 
        dto.origin === 'automation_coupon' && 
        dto.metadata?.automationCouponSend === true &&
        dto.metadata?.confirmedAutomationRoute === true &&
        !!dto.metadata?.automationSourceId &&
        !!dto.metadata?.automationRouteId &&
        !!dto.metadata?.couponId;

      if (!isManualCoupon && !isAutomationCoupon) {
        console.warn(`[CAMPAIGN-SERVICE] [GUARDRAIL] Bloqueio de cupom: Tentativa de envio sem confirmação válida para user ${userId}. Origin: ${dto.origin}`);
        throw new Error('coupon_manual_confirmation_required');
      }
      
      if (isManualCoupon) {
        console.log(`[CAMPAIGN-SERVICE] [GUARDRAIL] Cupom autorizado para envio manual (Envio Rápido) para user ${userId}.`);
      } else {
        console.log(`[CAMPAIGN-SERVICE] [GUARDRAIL] Cupom autorizado via Automação de Cupons para user ${userId}. Source: ${dto.metadata?.automationSourceId}`);
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
        scheduled_at: dto.scheduled_at,
        metadata: dto.metadata || {},
        origin: dto.origin || 'manual'
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      throw campaignError;
    }

    // ─── 4. Fluxo de Persistência (Atômico Simulado) ──────────────────────────
    try {
      // 4.1 Inserir Itens
      const itemsToInsert = dto.items.map(item => ({
      campaign_id: campaign.id,
      // Se for um ID temporário (proc_* ou coupon_*) ou não for um UUID válido, enviamos null para evitar erro no banco
      product_id: (item.product_id && typeof item.product_id === 'string' && 
        (/^(proc_|coupon_)/.test(item.product_id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.product_id)))
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

    insertedItems.forEach((item, index) => {
      const originalItem = dto.items[index];
      const isCoupon = originalItem?.offer_type === 'coupon_offer';

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
        const isManualCouponConfirmed = 
          dto.origin === 'manual' && 
          (dto.metadata?.dispatchOrigin === 'quick_send_manual_coupon' || dto.metadata?.dispatchOrigin === 'quick_send_manual_mixed') &&
          dto.metadata?.manualCouponSend === true &&
          dto.metadata?.confirmedByUser === true;

        const isAutomationCouponConfirmed = 
          dto.origin === 'automation_coupon' && 
          dto.metadata?.automationCouponSend === true &&
          dto.metadata?.confirmedAutomationRoute === true;

        const isManualPromoConfirmed = 
          dto.origin === 'manual' && 
          (dto.metadata?.dispatchOrigin === 'quick_send_manual_promo_landing' || dto.metadata?.dispatchOrigin === 'quick_send_manual_mixed') &&
          dto.metadata?.manualPromoLandingSend === true &&
          dto.metadata?.confirmedByUser === true;

        const isEligible = (item.eligibility_status === 'eligible' || item.eligibility_status === 'warning') && 
          (!isCoupon || isManualCouponConfirmed || isAutomationCouponConfirmed) &&
          (originalItem?.offer_type !== 'promo_landing' || isManualPromoConfirmed);

        if (isConnected && isEligible) {
          const fallbackChannel = userChannels?.find(ch => 
            ch.id !== group.channel_id && 
            ch.config?.status === 'connected'
          );

        const messageBody = item.custom_text || item.product_name;

        // --- TRAVA DE SEGURANÇA DE CONTEÚDO (FASE 2I.2) ---
        // Bloqueio de padrões de erro comuns que indicam falha na captura de metadados
        const invalidPatterns = [
          /ITEM INVÁLIDO/i, 
          /Preço Shopee indisponível/i, 
          /\[PRODUCT_PRICE_UNAVAILABLE\]/i,
          /preço sob consulta/i, 
          /r\$ nan/i, 
          /undefined/i, 
          /"null"/i, 
          /🔥 \*Por: \*/i
        ];
        
        let isInvalidContent = invalidPatterns.some(p => p.test(messageBody || ''));
        
        // Bloqueio Adicional: Produto Shopee deve conter preço numérico válido no bloco "Por"
        if (!isInvalidContent && item.canonical_url?.includes('shopee.com.br') && !isCoupon && originalItem?.offer_type !== 'promo_landing') {
          const hasNumericPrice = /Por: R\$ \d+(?:[.,]\d+)?/i.test(messageBody || '');
          if (!hasNumericPrice) {
            console.warn(`[CAMPAIGN-SERVICE] [HARD-LOCK] Bloqueio: Produto Shopee sem preço numérico no corpo para item ${item.id}`);
            isInvalidContent = true;
          }
        }

        if (isInvalidContent) {
          console.warn(`[CAMPAIGN-SERVICE] [HARD-LOCK] Bloqueio de conteúdo inválido para item ${item.id}. Conteúdo: "${messageBody?.substring(0, 50)}..."`);
          return; // Skip this destination for this item
        }

        jobsToInsert.push({
          user_id: userId,
          campaign_id: campaign.id,
          campaign_item_id: item.id,
          channel_id: group.channel_id,
          session_id: sessionId,
          destination: group.remote_id,
          destination_name: group.name,
          message_body: messageBody,
          image_url: item.image_url,
          installments: item.installments,
          message_type: item.image_url ? 'image' : 'text',
          status: 'pending',
          try_count: 0,
          fallback_channel_id: fallbackChannel?.id || null,
          scheduled_at: dto.scheduled_at || null,
          origin: dto.origin || 'manual'
        });

        } else if (!isEligible) {
            const reason = isCoupon 
              ? 'Oferta do tipo "coupon_offer" bloqueada (Requer confirmação manual via Envio Rápido)' 
              : originalItem?.offer_type === 'promo_landing'
                ? 'Oferta do tipo "promo_landing" bloqueada (Requer confirmação manual via Envio Rápido)'
                : `Status de elegibilidade: ${item.eligibility_status}`;
            console.warn(`[CAMPAIGN-SERVICE] Item ${item.id} pulado. Motivo: ${reason}. Motivos originais: ${item.eligibility_reasons?.join(' | ') || 'Nenhum reportado'}`);
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

    } catch (err: any) {
      console.error(`[CAMPAIGN-SERVICE] Erro fatal na criação da infraestrutura da campanha ${campaign.id}:`, err);
      
      // Tentar marcar como falha no banco
      await supabase
        .from('campaigns')
        .update({ 
          status: 'failed',
          metadata: { ...campaign.metadata, error: err.message || 'Erro interno na geração de jobs' }
        })
        .eq('id', campaign.id);
      
      throw err;
    }

    return campaign as Campaign;
  },

  /**
   * Wrapper especializado para o Envio Rápido (UI).
   * Garante isolamento de contexto e prefixo operacional.
   */
  async createQuickSendCampaign(userId: string, dto: CreateCampaignDTO, client?: SupabaseClient): Promise<Campaign> {
    console.log(`[CAMPAIGN-SERVICE] [QUICK-SEND] Iniciando criação de despacho manual para user ${userId}...`);
    
    const hasCoupon = dto.items.some(item => item.offer_type === 'coupon_offer');
    const hasPromoLanding = dto.items.some(item => item.offer_type === 'promo_landing');
    
    const isCouponConfirmed = dto.metadata?.manualCouponSend === true && dto.metadata?.confirmedByUser === true;
    const isPromoConfirmed = dto.metadata?.manualPromoLandingSend === true && dto.metadata?.confirmedByUser === true;

    // Se houver cupom e promo_landing juntos, exige ambas as confirmações
    if (hasCoupon && hasPromoLanding && (!isCouponConfirmed || !isPromoConfirmed)) {
      console.warn(`[CAMPAIGN-SERVICE] [QUICK-SEND] Bloqueado: Envio misto sem flags completas de confirmação para user ${userId}.`);
      throw new Error('manual_confirmation_required_for_special_offers');
    }

    // Se houver cupom sozinho, exige confirmação explícita
    if (hasCoupon && !isCouponConfirmed) {
      console.warn(`[CAMPAIGN-SERVICE] [QUICK-SEND] Bloqueado: Envio de cupom sem flags de confirmação para user ${userId}.`);
      throw new Error('coupon_manual_confirmation_required');
    }

    // Se houver promo_landing sozinha, exige confirmação explícita
    if (hasPromoLanding && !isPromoConfirmed) {
      console.warn(`[CAMPAIGN-SERVICE] [QUICK-SEND] Bloqueado: Envio de landing page sem flags de confirmação para user ${userId}.`);
      throw new Error('promo_landing_manual_confirmation_required');
    }

    const manualDto: CreateCampaignDTO = {
      ...dto,
      name: `🚀 [MANUAL] ${dto.name || new Date().toLocaleDateString()}`,
      origin: 'manual',
      metadata: {
        ...dto.metadata,
        // Injetar selo de origem server-side para validação no core .create()
        dispatchOrigin: (hasPromoLanding && hasCoupon) 
          ? 'quick_send_manual_mixed' 
          : (hasPromoLanding ? 'quick_send_manual_promo_landing' : (hasCoupon ? 'quick_send_manual_coupon' : undefined))
      }
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
