import { SupabaseClient } from '@supabase/supabase-js';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { productService } from '@/services/supabase/product-service';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { radarCacheService } from './supabase/radar-cache-service';
import { normalizeKeywords, calculateKeywordBudgets, getBudgetByPreset } from '@/lib/automation/keyword-utils';

export interface DiscoveryResult {
  totalInserted: number;
  tasksExecuted: number;
}

export const radarDiscoveryService = {
  /**
   * Executa a descoberta de produtos para uma fonte específica ou para todas as ativas.
   */
  async executeDiscovery(
    supabase: SupabaseClient,
    options: { sourceId?: string; userId?: string; force?: boolean } = {}
  ): Promise<DiscoveryResult> {
    const adapter = new ShopeeAdapter();
    const rid = Math.random().toString(36).substring(7);
    const logPrefix = `[RADAR-DISCOVERY] [${rid}]${options.force ? ' [FORCE]' : ''}`;

    const connectionCache = new Map<string, any>();

    // Limpeza de cache expirado no início do ciclo
    radarCacheService.prune();

    // 1. Buscar Automações para processar (Filtrando por locks expirados)
    const nowIso = new Date().toISOString();
    let query = supabase
      .from('automation_sources')
      .select(`
        id, name, config, user_id, 
        needs_restock, last_restock_at, discovery_page, discovery_locked_until,
        automation_routes(filters)
      `)
      .eq('source_type', 'radar_offers')
      .eq('is_active', true)
      .or(`discovery_locked_until.is.null,discovery_locked_until.lt.${nowIso}`);

    if (options.sourceId) {
      query = query.eq('id', options.sourceId);
    }
    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    const { data: sources, error: sourcesError } = await query;
    if (sourcesError) throw sourcesError;

    console.log(`${logPrefix} Processando ${sources?.length || 0} fontes de Radar.`);

    const NOW = Date.now();
    let globalInserted = 0;
    let tasksExecuted = 0;

    for (const s of (sources || [])) {
      const config = (s.config as any) || {};
      const preset = config.preset_type || 'balanced';

      // A. Mapeamento de Presets Operacionais (Utility Centralizada)
      let sortType = config.sortType || 1;
      let totalBudget = getBudgetByPreset(preset, config.batchLimit);
      let cooldownMinutes = config.cooldown_minutes || 60;

      if (preset === 'aggressive') {
        sortType = 2; cooldownMinutes = 20;
      } else if (preset === 'conservative') {
        sortType = 5; cooldownMinutes = 120;
      } else if (preset === 'balanced') {
        sortType = 1; cooldownMinutes = 60;
      }

      // B. Cooldown Check
      const lastRun = s.last_restock_at ? new Date(s.last_restock_at).getTime() : 0;
      const cooldownMs = (s.needs_restock ? 10 : cooldownMinutes) * 60 * 1000;
      
      if (NOW - lastRun < cooldownMs && !options.force) {
        continue;
      }

      // C. Lock Atômico via RPC
      const { data: locked } = await supabase.rpc('claim_source_lock', {
        p_source_id: s.id,
        p_worker_id: rid,
        p_timeout_mins: 5
      });

      if (!locked) continue;

      try {
        tasksExecuted++;
        
        // 1. Preparar Keywords (Utility Centralizada)
        let keywords = normalizeKeywords(config);

        // 2. Ordenação por Uso (Rotação)
        keywords = [...keywords].sort((a, b) => {
          const tA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
          const tB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
          return tA - tB;
        });

        // 3. Distribuição de Budget (Utility Centralizada)
        const budgets = calculateKeywordBudgets(totalBudget, keywords);

        // 4. Conexão Shopee (Cacheada por ciclo)
        let shopeeConnection = connectionCache.get(s.user_id);
        if (!shopeeConnection) {
          const connections = await marketplaceService.getEnrichedConnections(s.user_id, supabase);
          shopeeConnection = connections.find(c => c.marketplace_name === 'Shopee');
          if (shopeeConnection) connectionCache.set(s.user_id, shopeeConnection);
        }

        if (!shopeeConnection) {
          await supabase.from('automation_sources').update({ discovery_locked_until: null }).eq('id', s.id);
          continue;
        }

        // 5. Preparar Filtros e Anti-Fadiga
        const firstRouteFilters = s.automation_routes?.[0]?.filters || {};
        const minScoreRequired = firstRouteFilters.min_score || 40;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Contadores do Funil Consolidado
        let funnelTotalBudget = totalBudget;
        let funnelTotalNew = 0;
        let funnelCacheHits = 0;

        // Log do estado do cache antes do loop
        console.log(`${logPrefix} [RADAR-CACHE] size: ${radarCacheService.getSize()} entries`);

        // 6. Loop Sequencial de Keywords
        for (let i = 0; i < keywords.length; i++) {
          const kw = keywords[i];
          const budget = budgets[i];
          const listType = config.listType || 0;
          
          try {
            // --- ATUALIZAR ROTAÇÃO (INÍCIO DO PROCESSAMENTO) ---
            kw.last_used_at = new Date().toISOString();

            // --- CAMADA DE CACHE (RAW Data) ---
            let rawProducts = radarCacheService.get(kw.term, sortType, listType);
            if (rawProducts) {
              funnelCacheHits++;
              rawProducts = rawProducts.slice(0, budget);
            } else {
              rawProducts = await adapter.discoverProducts({
                sortType,
                listType,
                keyword: kw.term,
                limit: Math.max(budget, 30), 
                page: s.discovery_page || 1,
                connection: shopeeConnection
              });
              radarCacheService.set(kw.term, sortType, listType, rawProducts);
              rawProducts = rawProducts.slice(0, budget);
            }

            let kwNewLinks = 0;
            let kwDeduped = 0;

            // Pipeline por Item
            for (const p of rawProducts) {
              const url = p.productLink || p.offerLink;
              if (!p.name || !p.imageUrl || !p.currentPriceFactual || p.currentPriceFactual <= 0 || !p.commissionRate) continue;

              const stableKey = (p.shopId && p.itemId) ? `shopee:${p.shopId}:${p.itemId}` : null;
              if (!stableKey) continue;

              // Anti-Fadiga (Check individual)
              const { data: recent } = await supabase
                .from('radar_discovered_products')
                .select('id')
                .eq('source_id', s.id)
                .eq('stable_product_key', stableKey)
                .gte('dispatched_at', sevenDaysAgo)
                .maybeSingle();

              if (recent) {
                kwDeduped++; continue;
              }

              // Scoring
              const { score: finalScore, reason: scoreReason } = productService.calculateQualityScore({
                commissionRate: p.commissionRate || 0,
                discountPercent: p.discountPercent || 0,
                sales: p.sales || 0
              });

              if (finalScore < minScoreRequired) continue;

              // Ingestão
              const product = await productService.upsertFromAutomation({
                name: p.name,
                marketplace: 'Shopee',
                category: p.category || kw.term,
                current_price: p.currentPriceFactual,
                original_price: p.originalPrice,
                discount_percent: p.discountPercent ? Math.round(p.discountPercent) : undefined,
                commission_percent: Math.round((p.commissionRate || 0) * 100),
                commission_value: p.commissionValueFactual,
                image_url: p.imageUrl,
                original_url: url,
                opportunity_score: finalScore
              }, supabase);

              if (!product) continue;

              const { data: inserted } = await supabase
                .from('radar_discovered_products')
                .upsert({
                  product_id: product.id,
                  source_id: s.id,
                  user_id: s.user_id,
                  discovered_at: new Date().toISOString(),
                  score: finalScore,
                  reason: scoreReason,
                  stable_product_key: stableKey,
                  status: 'pending'
                }, { onConflict: 'product_id,source_id', ignoreDuplicates: true })
                .select('id')
                .maybeSingle();

              if (inserted) {
                funnelTotalNew++;
                kwNewLinks++;
              } else {
                kwDeduped++;
              }
            }

            // LOG POR KEYWORD
            console.log(`${logPrefix} [RADAR-KEYWORD] ${kw.term} → budget:${budget} fetched:${rawProducts.length} new_links:${kwNewLinks} deduped:${kwDeduped}`);
          } catch (kwErr: any) {
            console.error(`${logPrefix} [RADAR-FAIL] Erro na keyword "${kw.term}":`, kwErr.message);
            // Continua para a próxima keyword
          }
        }

        // LOG CONSOLIDADO
        console.log(`${logPrefix} [RADAR-FUNNEL] total_budget:${funnelTotalBudget} total_new:${funnelTotalNew} cache_hits:${funnelCacheHits}/${keywords.length}`);

        // 7. Persistir Estado
        await supabase
          .from('automation_sources')
          .update({ 
            config: { ...config, keywords },
            last_restock_at: new Date().toISOString(),
            discovery_locked_until: null,
            discovery_page: funnelTotalNew > 0 ? (s.discovery_page || 1) + 1 : (s.discovery_page || 1),
            needs_restock: funnelTotalNew > 0 ? false : s.needs_restock
          })
          .eq('id', s.id);

        globalInserted += funnelTotalNew;

      } catch (err: any) {
        console.error(`${logPrefix} Falha na fonte ${s.id}:`, err.message);
        await supabase.from('automation_sources').update({ discovery_locked_until: null }).eq('id', s.id);
      }
    }

    return {
      totalInserted: globalInserted,
      tasksExecuted
    };
  }
};
