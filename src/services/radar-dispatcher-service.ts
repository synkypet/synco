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

    // 2. Buscar produtos recentes do Radar
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .ilike('category', '[RADAR]%')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!products || products.length === 0) {
      console.log(`${logPrefix} Nenhum produto Radar encontrado no banco para cruzamento.`);
      return { campaignsCreated: 0 };
    }

    console.log(`${logPrefix} Analisando ${products.length} produtos recentes para cruzamento.`);

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
          continue;
        }

        // B. Seleção de Candidato
        const candidates = products.filter(p => p.category.toLowerCase().includes(keyword.toLowerCase()));
        
        if (candidates.length === 0) {
          console.log(`${logPrefix} [NO-MATCH] Nenhum produto para keyword "${keyword}" na fonte "${source.name}".`);
          continue;
        }

        let dispatchedForRoute = false;
        let candidatesAnalyzed = 0;

        for (const product of candidates) {
          if (dispatchedForRoute) break; 
          candidatesAnalyzed++;

          // C. Deduplicação Atômica
          const hashKey = this.generateHash(`radar_v2:${source.id}:${product.id}:${route.id}`);
          const { error: dedupeError } = await supabase.from('automation_dedupe').insert({ hash_key: hashKey });

          if (dedupeError) {
            totalSkippedDedupe++;
            continue;
          }

          // D. Filtragem
          if (!this.applyRadarFilters(product, route.filters)) {
            totalSkippedFilter++;
            continue;
          }

          // E. Geração de Campanha
          try {
            console.log(`${logPrefix} [RADAR DISPATCH] Abastecendo rota ${route.id} com produto ${product.id} ("${product.name.substring(0,20)}...").`);
            
            const [snapshot] = await processLinks([product.original_url], connections || [], 'auto');
            const factual = snapshot.factual;

            if (!factual.eligibility.isEligible) {
              console.warn(`${logPrefix} [AUDIT-REJECT] Item ${product.id} rejeitado: ${factual.eligibility.reasons.join(', ')}`);
              continue;
            }

            const campaignData = {
              name: `RADAR: ${factual.title.substring(0, 30)}...`,
              items: [{
                product_name: factual.title,
                image_url: factual.image,
                affiliate_url: factual.finalLinkToSend,
                current_price: factual.price,
                original_price: factual.originalPrice,
                external_product_id: product.id,
                eligibility_status: 'eligible' as any,
                eligibility_reasons: []
              }],
              destinations: [{
                type: route.target_type,
                id: route.target_id
              }]
            };

            await campaignService.create(source.user_id, campaignData, supabase);
            
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
