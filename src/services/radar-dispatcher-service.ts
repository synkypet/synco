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
      const routes = source.automation_routes || [];
      if (routes.length === 0) {
        console.log(`${logPrefix} [SKIP] Fonte "${source.name}" não possui rotas de destino.`);
        continue;
      }

      const keyword = (source.config as any)?.searchTerm || source.name;

      // ─── BILLING ENFORCEMENT ───────────────────────────────────────────────
      let access = userAccessCache.get(source.user_id);
      if (!access) {
        access = await resolveUserAccess(source.user_id, supabase);
        userAccessCache.set(source.user_id, access);
      }

      if (!access.isOperative) {
        console.warn(`${logPrefix} [SKIP-BILLING] User ${source.user_id} não está operativo.`);
        totalSkippedBilling++;
        continue;
      }

      // Buscar conexões do usuário para o processLinks
      let connections = userConnectionsCache.get(source.user_id);
      if (!connections) {
        connections = await marketplaceService.getEnrichedConnections(source.user_id, supabase);
        userConnectionsCache.set(source.user_id, connections);
      }

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
        console.error(`${logPrefix} [ERROR-QUERY] Falha ao buscar vínculos para fonte ${source.id}:`, candidateError);
      }

      const candidates = (rdpRelations || [])
        .map((rel: any) => ({
          ...rel.products,
          rdp_id: rel.id,
          stable_product_key: rel.stable_product_key
        }))
        .filter(p => p !== null);

      console.log(`${logPrefix} [QUERY-RELATION] Fonte: ${source.id} | Candidatos Pendentes: ${candidates.length}`);

      if (candidates.length === 0) {
        console.log(`${logPrefix} [NO-MATCH] Nenhum produto 'pending' vinculado à fonte "${source.name}".`);
        
        // Sinalizar necessidade de reposição (Restock) via colunas dedicadas
        if (!source.needs_restock) {
          await supabase
            .from('automation_sources')
            .update({ 
              needs_restock: true, 
              restock_requested_at: new Date().toISOString()
            })
            .eq('id', source.id);
          console.log(`${logPrefix} [RESTOCK-REQUESTED] Reposição sinalizada para "${source.name}".`);
        } else {
          console.log(`${logPrefix} [AWAITING-RESTOCK] Fonte "${source.name}" já está aguardando reposição.`);
        }
        
        continue;
      }

      for (const route of routes) {
        // A. Verificação de Profundidade de Fila (Pacing do Heartbeat)
        const { count: pendingJobs } = await supabase
          .from('send_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', source.user_id)
          .eq('destination', route.target_id)
          .eq('status', 'pending');

        if (pendingJobs && pendingJobs >= 2) {
          console.log(`${logPrefix} [RADAR QUEUE] Rota ${route.id} já possui ${pendingJobs} itens pendentes. Pulando.`);
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
          const { error: dedupeError } = await supabase.from('automation_dedupe').insert({ hash_key: hashKey });

          if (dedupeError) {
            routeSkippedDedupe++;
            totalSkippedDedupe++;
            logActivity(supabase, {
              source_id: source.id,
              user_id: source.user_id,
              event_type: 'skipped_dedupe',
              product_id: product.id,
              title: product.name,
              discard_reason: 'Already sent to this destination (last 7 days)'
            });
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
            console.log(`${logPrefix} [RADAR-SELECT] Rota ${route.id} escolheu produto ${product.id} após analisar ${routeSkippedDedupe + routeSkippedFilter + 1} candidatos.`);
            
            const [snapshot] = await processLinks([product.original_url], connections || [], 'auto');
            const factual = snapshot.factual;

            if (!factual.eligibility.isEligible) {
              console.warn(`${logPrefix} [AUDIT-REJECT] Item ${product.id} rejeitado na auditoria real: ${factual.eligibility.reasons.join(', ')}`);
              
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

            const campaignData = {
              name: `RADAR: ${factual.title.substring(0, 30)}...`,
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
              }]
            };

            const campaign = await campaignService.create(source.user_id, campaignData, supabase);
            
            // F. Marcar Vínculo como Despachado (Consumo)
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

            console.log(`${logPrefix} [MARKED-DISPATCHED] Vínculo ${product.rdp_id} consumido com sucesso.`);

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
            dispatchedForRoute = true;
          } catch (err: any) {
            console.error(`${logPrefix} Falha ao despachar produto ${product.id}:`, err.message);
            
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
          console.log(`${logPrefix} [NO-ELIGIBLE] Rota ${route.id} percorreu ${candidates.length} candidatos mas todos foram filtrados ou já enviados.`);
          if (routeSkippedDedupe === candidates.length) {
            console.log(`${logPrefix} [NEEDS-RESTOCK] Fonte "${source.name}" esgotou candidatos 'pending' para esta rota.`);
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
