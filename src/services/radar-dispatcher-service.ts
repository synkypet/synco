import { SupabaseClient } from '@supabase/supabase-js';
import { campaignService } from '@/services/supabase/campaign-service';
import { automationService } from '@/services/supabase/automation-service';
import { triggerWorker } from '@/lib/worker/trigger';
import { resolveUserAccess } from '@/services/supabase/access-service';
import { processLinks } from '@/lib/linkProcessor';
import { marketplaceService } from '@/services/supabase/marketplace-service';

export interface DispatchResult {
  campaignsCreated: number;
}

/**
 * Fire-and-forget helper for activity logging.
 * Ensuring zero impact on the main pipeline.
 */
const logActivity = (supabase: SupabaseClient, event: {
  source_id: string;
  user_id: string;
  event_type: string;
  product_id?: string;
  campaign_id?: string;
  keyword?: string;
  score?: number;
  commission_value?: number;
  discard_reason?: string;
  title?: string;
  page?: number;
}) => {
  // Fire-and-forget logic using async wrapper to avoid TS PromiseLike issues
  (async () => {
    try {
      await supabase
        .from('radar_activity_log')
        .insert({
          source_id: event.source_id,
          user_id: event.user_id,
          event_type: event.event_type,
          product_id: event.product_id,
          campaign_id: event.campaign_id,
          keyword: event.keyword,
          score: event.score,
          commission_value: event.commission_value,
          discard_reason: event.discard_reason,
          metadata: {
            title: (event.title ?? '').substring(0, 100),
            page: event.page ?? null,
            source_id: event.source_id
          }
        });
    } catch (err) {
      console.warn('[RADAR-LOG-FAIL]', err);
    }
  })();
};

export const radarDispatcherService = {
  /**
   * Cruza produtos descobertos com as regras de automação dos usuários.
   */
  async executeDispatch(
    supabase: SupabaseClient,
    options: { requestId?: string } = {}
  ): Promise<DispatchResult> {
    const rid = options.requestId || Math.random().toString(36).substring(7);
    const logPrefix = `[RADAR-DISPATCHER] [${rid}]`;
    
    console.log(`${logPrefix} Iniciando processamento de despacho...`);

    // 1. Buscar todas as fontes de Radar ativas
    const { data: sources } = await supabase
      .from('automation_sources')
      .select(`
        *,
        automation_routes (
          id,
          target_type,
          target_id,
          filters,
          template_config
        )
      `)
      .eq('source_type', 'radar_offers')
      .eq('is_active', true);

    if (!sources || sources.length === 0) {
      console.log(`${logPrefix} Nenhuma fonte Radar ativa encontrada.`);
      return { campaignsCreated: 0 };
    }

    console.log(`${logPrefix} Encontradas ${sources.length} fontes Radar ativas.`);

    // 2. Otimização: Não buscamos mais um bloco global fixo de 30 produtos.
    // Agora o despacho é feito sob demanda para cada fonte para garantir precisão.
    console.log(`${logPrefix} Iniciando análise de cruzamento para ${sources.length} fontes.`);

    let totalCreated = 0;
    let totalSkippedBilling = 0;
    let totalSkippedQueue = 0;
    let totalSkippedDedupe = 0;
    let totalSkippedFilter = 0;
    const userAccessCache = new Map<string, any>();
    const userConnectionsCache = new Map<string, any[]>();

    // 3. Cruzamento de Dados (Pipeline Operacional)
    for (const source of sources) {
      const userTag = `[USER:${source.user_id.substring(0,8)}]`;
      const sourceLogPrefix = `${logPrefix} ${userTag} [SOURCE:${source.id.substring(0,8)}]`;

      const routes = source.automation_routes || [];
      if (routes.length === 0) {
        console.log(`${sourceLogPrefix} [SKIP] Fonte "${source.name}" não possui rotas de destino.`);
        continue;
      }

      const keyword = (source.config as any)?.searchTerm || source.name;
      
      // Fix: Suportar ambas as chaves e garantir mínimo de 1 minuto
      const rawInterval = (source.config as any)?.interval_minutes;
      const rawSendInterval = (source.config as any)?.send_interval_minutes;
      const sendIntervalMinutes = Math.max(1, Number(rawSendInterval ?? rawInterval ?? 1));

      // Log de Observabilidade: Confirmação de Filtros e Configuração Efetiva
      const firstRouteFilters = routes[0]?.filters || {};
      console.log(`${sourceLogPrefix} [RADAR-CONFIG-EFFECTIVE]`, {
        source_id: source.id,
        keywords: (source.config as any)?.keywords?.map((k: any) => k.term) || [],
        sortType: (source.config as any)?.sortType,
        preset_type: (source.config as any)?.preset_type,
        min_discount_percent: firstRouteFilters.min_discount_percent,
        only_official_stores: firstRouteFilters.only_official_stores,
        min_price: firstRouteFilters.min_price,
        max_price: firstRouteFilters.max_price,
        send_interval_minutes_effective: sendIntervalMinutes,
        raw_interval_minutes: rawInterval,
        raw_send_interval_minutes: rawSendInterval
      });
      
      // Controla o tempo de agendamento em memória para esta fonte durante o loop
      let currentScheduleCursor = new Date();
      let hasExistingSchedule = false;

      if (source.channel_id) {
        const { data: lastScheduled } = await supabase
          .from('send_jobs')
          .select('scheduled_at')
          .eq('channel_id', source.channel_id)
          .eq('user_id', source.user_id)
          .not('scheduled_at', 'is', null)
          .order('scheduled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastScheduled?.scheduled_at) {
          const dbTime = new Date(lastScheduled.scheduled_at);
          if (dbTime > currentScheduleCursor) {
            currentScheduleCursor = dbTime;
            hasExistingSchedule = true;
          }
        }
      }

      // ─── BILLING ENFORCEMENT ───────────────────────────────────────────────
      let access = userAccessCache.get(source.user_id);
      if (!access) {
        access = await resolveUserAccess(source.user_id, supabase);
        userAccessCache.set(source.user_id, access);
      }

      if (!access.isOperative) {
        console.warn(`${sourceLogPrefix} [SKIP-BILLING] User ${source.user_id} não está operativo.`);
        totalSkippedBilling++;
        continue;
      }

      // Buscar conexões do usuário para o processLinks
      let connections = userConnectionsCache.get(source.user_id);
      if (!connections) {
        connections = await marketplaceService.getEnrichedConnections(source.user_id, supabase);
        userConnectionsCache.set(source.user_id, connections);
      }

      // ─── QUEUE DEPTH & BACKPRESSURE ENFORCEMENT (Híbrido Ready/Future) ─────
      // 1. Contagem de jobs PRONTOS para envio imediato
      const { count: readyPendingCount } = await supabase
        .from('send_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', source.user_id)
        .eq('status', 'pending')
        .eq('origin', 'radar')
        .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`);

      // 2. Contagem de jobs AGENDADOS para o futuro
      const { count: futurePendingCount } = await supabase
        .from('send_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', source.user_id)
        .eq('status', 'pending')
        .eq('origin', 'radar')
        .gt('scheduled_at', new Date().toISOString());

      // Configuração de Limites (Baseado em routeCount * fator)
      const routeCount = routes.length || 1;
      const MAX_READY_PENDING = Math.max(100, routeCount * 2);
      const MAX_FUTURE_SCHEDULED = Math.max(250, routeCount * 5);

      if (readyPendingCount !== null && readyPendingCount >= MAX_READY_PENDING) {
        console.log(`[RADAR-BACKPRESSURE-READY] ${sourceLogPrefix} Fila de envio imediato cheia (${readyPendingCount}/${MAX_READY_PENDING}).`);
        continue;
      }

      if (futurePendingCount !== null && futurePendingCount >= MAX_FUTURE_SCHEDULED) {
        console.log(`[RADAR-BACKPRESSURE-FUTURE] ${sourceLogPrefix} Backlog futuro atingido (${futurePendingCount}/${MAX_FUTURE_SCHEDULED}).`);
        continue;
      }
      
      console.log(`[RADAR-BACKPRESSURE-OK] ${sourceLogPrefix} Ready:${readyPendingCount || 0}/${MAX_READY_PENDING} | Future:${futurePendingCount || 0}/${MAX_FUTURE_SCHEDULED}`);
      
      let userQuota = MAX_READY_PENDING - (readyPendingCount || 0);
      console.log(`${sourceLogPrefix} Fila: ${readyPendingCount || 0}/${MAX_READY_PENDING}. Criando até ${userQuota} novos jobs.`);

      // ─── BUSCA DE CANDIDATOS PARA ESTA FONTE (Nova Arquitetura) ─────────
      // Buscamos via tabela de vínculo radar_discovered_products com JOIN em products
      // Importante: Consumimos apenas status 'pending'
      const { data: rdpRelations, error: candidateError } = await supabase
        .from('radar_discovered_products')
        .select(`
          id,
          product_id,
          discovered_at,
          stable_product_key,
          products (*)
        `)
        .eq('source_id', source.id)
        .eq('status', 'pending')
        .gte('discovered_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Janela de 48h
        .order('discovered_at', { ascending: false })
        .limit(30);

      if (candidateError) {
        console.error(`${sourceLogPrefix} [ERROR-QUERY] Falha ao buscar vínculos:`, candidateError);
      }

      const candidates = (rdpRelations || [])
        .map((rel: any) => ({
          ...rel.products,
          rdp_id: rel.id,
          stable_product_key: rel.stable_product_key
        }))
        .filter(p => p !== null);

      console.log(`${sourceLogPrefix} [QUERY-RELATION] Candidatos Pendentes: ${candidates.length}`);

      if (candidates.length === 0) {
        console.log(`${sourceLogPrefix} [NO-MATCH] Nenhum produto 'pending' vinculado.`);
        
        // Sinalizar necessidade de reposição (Restock) via colunas dedicadas
        if (!source.needs_restock) {
          await supabase
            .from('automation_sources')
            .update({ 
              needs_restock: true, 
              restock_requested_at: new Date().toISOString()
            })
            .eq('id', source.id);
          console.log(`${sourceLogPrefix} [RESTOCK-REQUESTED] Reposição sinalizada.`);
        } else {
          console.log(`${sourceLogPrefix} [AWAITING-RESTOCK] Já está aguardando reposição.`);
        }
        
        continue;
      }

      for (const route of routes) {
        if (userQuota <= 0) {
          console.log(`${sourceLogPrefix} Cota de jobs atingida para este ciclo.`);
          break;
        }
        // A. Verificação de Profundidade de Fila (Pacing do Heartbeat)
        const { count: pendingJobs } = await supabase
          .from('send_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', source.user_id)
          .eq('destination', route.target_id)
          .eq('status', 'pending');

        if (pendingJobs && pendingJobs >= 2) {
          console.log(`${sourceLogPrefix} [RADAR QUEUE] Rota ${route.id} já possui ${pendingJobs} itens pendentes. Pulando.`);
          totalSkippedQueue++;
          logActivity(supabase, {
            source_id: source.id,
            user_id: source.user_id,
            event_type: 'skipped_pacing',
            discard_reason: `Queue full: ${pendingJobs} pending`
          });
          continue;
        }

        let dispatchedForRoute = false;
        let routeSkippedDedupe = 0;
        let routeSkippedFilter = 0;

        for (const product of candidates) {
          if (dispatchedForRoute) break; 

          // C. Deduplicação Atômica (Dedupe por Destino)
          // Usamos a stable_product_key se disponível, caso contrário fallback para ID
          const productKey = product.stable_product_key || product.id;
          const hashKey = this.generateHash(`radar_v3:${source.id}:${productKey}:${route.id}`);
          const isDuplicate = await automationService.handleDedupeWithTTL(hashKey, 168, supabase);

          if (isDuplicate) {
            routeSkippedDedupe++;
            totalSkippedDedupe++;
            // IMPORTANTE: Se está dedupado para esta rota, apenas continuamos.
            // Não alteramos o status do vínculo RDP, pois ele pode ser útil para outras rotas.
            continue;
          }

          // D. Filtragem
          if (!this.applyRadarFilters(product, route.filters)) {
            routeSkippedFilter++;
            totalSkippedFilter++;
            continue;
          }

          // E. Geração de Campanha
          try {
            console.log(`${sourceLogPrefix} [RADAR-SELECT] Rota ${route.id} escolheu produto ${product.id} após analisar ${routeSkippedDedupe + routeSkippedFilter + 1} candidatos.`);
            
            const [snapshot] = await processLinks([product.original_url], connections || [], 'auto');
            const factual = snapshot.factual;

            if (!factual.eligibility.isEligible) {
              console.warn(`${sourceLogPrefix} [AUDIT-REJECT] Item ${product.id} rejeitado na auditoria real: ${factual.eligibility.reasons.join(', ')}`);
              
              // Se o link é definitivamente inválido, marcamos o vínculo como 'exhausted'
              await supabase
                .from('radar_discovered_products')
                .update({ 
                  status: 'exhausted', 
                  skipped_reason: `Ineligible: ${factual.eligibility.reasons.join(', ')}`,
                  attempts: 1
                })
                .eq('id', product.rdp_id);

              continue;
            }

            let campaignScheduledAt = new Date();
            if (hasExistingSchedule) {
                currentScheduleCursor = new Date(currentScheduleCursor.getTime() + sendIntervalMinutes * 60 * 1000);
                campaignScheduledAt = currentScheduleCursor;
            } else {
                campaignScheduledAt = new Date(); // primeira campanha vai agora
                currentScheduleCursor = campaignScheduledAt;
                hasExistingSchedule = true; // próximas campanhas nesta rodada sofrerão o delay
            }

            const campaignData = {
              name: `RADAR: ${factual.title.substring(0, 30)}...`,
              scheduled_at: campaignScheduledAt.toISOString(),
              items: [{
                product_id: product.id,
                product_name: factual.title,
                custom_text: snapshot.copy.messageText,
                image_url: factual.image,
                affiliate_url: factual.finalLinkToSend,
                current_price: factual.price,
                original_price: factual.originalPrice,
                external_product_id: product.id,
                
                // Rastreabilidade e Auditoria (Consistência com Envio Rápido)
                incoming_url: factual.incoming_url,
                resolved_url: factual.resolved_url,
                canonical_url: factual.canonical_url,
                generated_affiliate_url: factual.generated_affiliate_url,
                reaffiliation_status: factual.reaffiliation_status,
                
                eligibility_status: factual.eligibility.status as any,
                eligibility_reasons: factual.eligibility.reasons,
                installments: factual.installments
              }],
              destinations: [{
                type: route.target_type,
                id: route.target_id
              }],
              origin: 'radar' as any // Forçado para radar
            };

            const campaign = await campaignService.create(source.user_id, campaignData, supabase);
            
            await supabase
              .from('radar_discovered_products')
              .update({ 
                status: 'dispatched', 
                dispatched_at: new Date().toISOString(),
                campaign_id: campaign.id,
                attempts: 1
              })
              .eq('id', product.rdp_id);

            logActivity(supabase, {
              source_id: source.id,
              user_id: source.user_id,
              event_type: 'dispatched',
              product_id: product.id,
              campaign_id: campaign.id,
              keyword: product.category,
              score: product.opportunity_score,
              commission_value: product.commission_value,
              title: product.name
            });

            await automationService.logEvent({
              source_id: source.id,
              user_id: source.user_id,
              status: 'processed',
              event_type: 'radar_dispatch',
              details: { 
                productId: product.id, 
                routeId: route.id,
                factualPrice: factual.price,
                reaffiliated: factual.reaffiliation_status
              }
            }, supabase);

            totalCreated++;
            userQuota--; // Reduzir cota disponível
            dispatchedForRoute = true;
          } catch (err: any) {
            console.error(`${sourceLogPrefix} Falha ao despachar produto ${product.id}:`, err.message);
            
            // Marcar como skipped para evitar loop infinito de erro neste ciclo
            await supabase
              .from('radar_discovered_products')
              .update({ 
                status: 'skipped', 
                skipped_reason: err.message,
                attempts: 1
              })
              .eq('id', product.rdp_id);
          }
        }

        if (!dispatchedForRoute) {
          console.log(`${sourceLogPrefix} [NO-ELIGIBLE] Rota ${route.id} percorreu ${candidates.length} candidatos mas todos foram filtrados ou já enviados.`);
          if (routeSkippedDedupe === candidates.length) {
            console.log(`${sourceLogPrefix} [NEEDS-RESTOCK] Esgotou candidatos 'pending' para esta rota.`);
          }
        }
      }
    }

    // 4. Relatório Final de Observabilidade
    console.log(`${logPrefix} --- Relatório de Despacho Radar ---`);
    console.log(`  > Campanhas criadas: ${totalCreated}`);
    console.log(`  > Pulados (Billing): ${totalSkippedBilling}`);
    console.log(`  > Pulados (Fila):    ${totalSkippedQueue}`);
    console.log(`  > Pulados (Dedupe):  ${totalSkippedDedupe}`);
    console.log(`  > Pulados (Filtro):  ${totalSkippedFilter}`);
    console.log(`${logPrefix} -----------------------------------`);

    // 5. Acionamento do Worker
    if (totalCreated > 0) {
      await triggerWorker({ requestId: rid });
    }

    return { campaignsCreated: totalCreated };
  },

  applyRadarFilters(product: any, filters: any): boolean {
    if (!filters) return true;
    if (filters.min_price && product.current_price < filters.min_price) return false;
    if (filters.max_price && product.current_price > filters.max_price) return false;
    if (filters.min_commission_value && product.commission_value < filters.min_commission_value) return false;
    if (!filters.min_commission_value && filters.min_commission_rate && product.commission_percent < filters.min_commission_rate) return false;

    if (filters.keywords_blacklist?.length > 0) {
      const text = `${product.name} ${product.category}`.toLowerCase();
      const hasBlacklisted = filters.keywords_blacklist.some((word: string) => text.includes(word.toLowerCase().trim()));
      if (hasBlacklisted) return false;
    }

    if (filters.keywords_whitelist?.length > 0) {
      const text = `${product.name} ${product.category}`.toLowerCase();
      const hasWhitelisted = filters.keywords_whitelist.some((word: string) => text.includes(word.toLowerCase().trim()));
      if (!hasWhitelisted) return false;
    }

    return true;
  },

  generateHash(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
};
