import { SupabaseClient } from '@supabase/supabase-js';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { productService } from '@/services/supabase/product-service';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { radarCacheService } from './supabase/radar-cache-service';
import { normalizeKeywords, calculateKeywordBudgets, getBudgetByPreset, hasKeywordMatch } from '@/lib/automation/keyword-utils';
import { isDebugEnabled } from '@/lib/debug';

export interface DiscoveryResult {
  totalInserted: number;
  tasksExecuted: number;
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
        consecutive_empty_cycles, discovery_exhausted_at,
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

    // ─── RETENÇÃO AUTOMÁTICA (Fase 1: 30 dias) ───────────────────────────────
    // Fire-and-forget: Não bloqueia o início do processamento
    (async () => {
      try {
        await supabase
          .from('radar_activity_log')
          .delete()
          .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      } catch (err) {
        console.warn('[RETENTION-FAIL]', err);
      }
    })();

    const { count: totalLogs } = await supabase
      .from('radar_activity_log')
      .select('*', { count: 'estimated', head: true });

    if (totalLogs && totalLogs > 15000000) {
      console.error(`${logPrefix} [ADMIN-ALERT] [CRITICAL] radar_activity_log capacity exceeded: ${totalLogs} records. Check retention job!`);
    }

    const NOW = Date.now();
    let globalInserted = 0;
    let tasksExecuted = 0;

      for (const s of (sources || [])) {
      const config = (s.config as any) || {};
      const preset = config.preset_type || 'balanced';

      // A. Mapeamento de Presets Operacionais (Prioridade para o Sort manual da UI)
      let sortType = config.sortType || 1;
      let cooldownMinutes = config.cooldown_minutes || 60;
      let totalBudget = getBudgetByPreset(preset, config.batchLimit);

      // Só sobrescreve se o usuário não tiver definido manualmente um sort ou se não for 'custom'
      if (preset !== 'custom') {
        if (preset === 'aggressive') {
          sortType = 2; cooldownMinutes = 20;
        } else if (preset === 'conservative') {
          sortType = 5; cooldownMinutes = 120;
        } else if (preset === 'balanced') {
          sortType = 1; cooldownMinutes = 60;
        }
      }

      // B. Ciclo Start & Cooldown Check
      console.log(`${logPrefix} [RADAR-CYCLE-START]`, {
        source_id: s.id,
        needs_restock: s.needs_restock,
        last_restock_at: s.last_restock_at,
        discovery_page: s.discovery_page
      });

      const lastRun = s.last_restock_at ? new Date(s.last_restock_at).getTime() : 0;
      // Se needs_restock estiver ativo, reduz o cooldown — mas com piso de 5min quando
      // há ciclos consecutivos vazios (previne loop de 1min sem resultado).
      const emptyCount = s.consecutive_empty_cycles ?? 0;

      let effectiveCooldownMin: number;
      if (s.needs_restock) {
        // REGRA 4: com 2+ ciclos vazios consecutivos, impor cooldown mínimo de 5 minutos
        effectiveCooldownMin = emptyCount >= 2 ? 5 : 1;
      } else {
        effectiveCooldownMin = cooldownMinutes;
      }
      const cooldownMs = effectiveCooldownMin * 60 * 1000;
      
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
        
        // 1. Preparar Keywords (Limitando a 5 para performance operacional)
        let keywords = normalizeKeywords(config).slice(0, 5);

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
        // Ajuste permanente conforme solicitação: Base 15 para Shopee Radar
        const minScoreRequired = firstRouteFilters.min_score || 15; 
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // 6. Função Utilitária para rodar a descoberta (permite re-execução imediata pós-reset)
        const runDiscoveryBatch = async (pageToUse: number) => {
          let batchNew = 0;
          let batchCacheHits = 0;
          let batchFetched = 0;

          // Loop Sequencial de Keywords
          for (let i = 0; i < keywords.length; i++) {
            const kw = keywords[i];
            const budget = budgets[i];
            const listType = config.listType || 0;
            
            try {
              // --- ATUALIZAR ROTAÇÃO (INÍCIO DO PROCESSAMENTO) ---
              kw.last_used_at = new Date().toISOString();

              // --- CAMADA DE CACHE (RAW Data) ---
              let rawProducts = radarCacheService.get(kw.term, sortType, listType, pageToUse || 1);
              if (rawProducts) {
                batchCacheHits++;
              } else {
                rawProducts = await adapter.discoverProducts({
                  sortType,
                  listType,
                  keyword: kw.term,
                  limit: 50, // Buscar batch maior para garantir profundidade de triagem
                  page: pageToUse || 1,
                  connection: shopeeConnection
                });
                radarCacheService.set(kw.term, sortType, listType, pageToUse || 1, rawProducts);
              }

              let kwNewLinks = 0;
              let kwDeduped = 0;
              let kwScoreSkipped = 0;
              let kwValidationSkipped = 0;
              let kwHardFilterSkipped = 0;

              batchFetched += rawProducts.length;

              if (isDebugEnabled('DEBUG_RADAR')) {
                console.log(`${logPrefix} [PRE-FILTER]`, { 
                  total_bruto: rawProducts.length, 
                  source_id: s.id,
                  keyword: kw.term,
                  budget_alocado: budget,
                  page_used: pageToUse
                });
              }

              // Contagem de descartes por keyword (Limites de cardinalidade)
              let skippedMatchCount = 0;
              let scannedNodes = 0;

              // Pipeline por Item (Trace Mode Ativado)
              for (const p of rawProducts) {
                // 0. CHECK BUDGET (NOVO): Se já atingiu o budget desta keyword, para de escanear o bruto
                if (kwNewLinks >= budget) break;
                
                scannedNodes++;
                const url = p.productLink || p.offerLink;
                
                // 1. PRE-FILTER (Validação básica e Filtros do Usuário)
                if (!p.name || !p.imageUrl || !p.currentPriceFactual || p.currentPriceFactual <= 0 || !p.commissionRate) {
                  kwValidationSkipped++;
                  logActivity(supabase, {
                    source_id: s.id,
                    user_id: s.user_id,
                    event_type: 'ineligible',
                    keyword: kw.term,
                    title: p.name,
                    discard_reason: 'Incomplete metadata',
                    page: pageToUse
                  });
                  continue;
                }

                // APLICAÇÃO DE FILTROS REAIS (NOVO)
                const commPercent = Math.round((p.commissionRate || 0) * 100);
                const discPercent = p.discountPercent || 0;
                const hasCoupon = !!(p.coupon || p.offerLink?.includes('coupon'));

                if (firstRouteFilters.min_price && p.currentPriceFactual < firstRouteFilters.min_price) {
                  kwValidationSkipped++;
                  continue;
                }
                if (firstRouteFilters.max_price && p.currentPriceFactual > firstRouteFilters.max_price) {
                  kwValidationSkipped++;
                  continue;
                }
                if (firstRouteFilters.min_commission_rate && commPercent < firstRouteFilters.min_commission_rate) {
                  kwValidationSkipped++;
                  continue;
                }
                if (firstRouteFilters.min_discount_percent && discPercent < firstRouteFilters.min_discount_percent) {
                  kwValidationSkipped++;
                  continue;
                }
                if (firstRouteFilters.only_official_stores && !p.officialStore) {
                  kwValidationSkipped++;
                  continue;
                }
                if (firstRouteFilters.only_coupons && !hasCoupon) {
                  kwValidationSkipped++;
                  continue;
                }

                // 2. KEYWORD HARD FILTER (NOVO)
                if (!hasKeywordMatch(p.name, kw.term, kw.aliases || [])) {
                  kwHardFilterSkipped++;
                  if (skippedMatchCount < 10) {
                    logActivity(supabase, {
                      source_id: s.id,
                      user_id: s.user_id,
                      event_type: 'skipped_match',
                      keyword: kw.term,
                      title: p.name,
                      page: pageToUse
                    });
                    skippedMatchCount++;
                  }
                  if (isDebugEnabled('DEBUG_RADAR')) {
                    console.log(`${logPrefix} [KEYWORD-FILTER-SKIP] "${p.name.slice(0, 30)}..." não deu match em "${kw.term}" (incluindo variantes e aliases)`);
                  }
                  continue;
                }

                const stableKey = (p.shopId && p.itemId) ? `shopee:${p.shopId}:${p.itemId}` : null;
                if (!stableKey) continue;

                if (isDebugEnabled('DEBUG_RADAR')) {
                  console.log('[STABLE-KEY-FINAL]', {
                    itemId: p.itemId,
                    shopId: p.shopId,
                    title: p.name?.slice(0, 30),
                    stableKey
                  });
                }

                // Anti-Fadiga (Check individual)
                const { data: recent } = await supabase
                  .from('radar_discovered_products')
                  .select('id')
                  .eq('source_id', s.id)
                  .eq('stable_product_key', stableKey)
                  .gte('dispatched_at', sevenDaysAgo)
                  .maybeSingle();

                if (isDebugEnabled('DEBUG_RADAR')) {
                  console.log('[DEDUPE-DECISION]', {
                    stable_key: stableKey,
                    exists: !!recent,
                    recent_record: recent,
                    source_id: s.id
                  });
                }

                if (recent) {
                  console.log('[DEDUPE-DETAIL]', { 
                    stable_key: stableKey, 
                    source_id: s.id,
                    existing_id: recent?.id 
                  });
                  kwDeduped++; 
                  continue; 
                }

                // Scoring
                const { score: finalScore, reason: scoreReason } = productService.calculateQualityScore({
                  commissionRate: p.commissionRate || 0,
                  discountPercent: p.discountPercent || 0,
                  sales: p.sales || 0
                });

                if (finalScore < minScoreRequired) {
                  console.log('[SCORE-DETAIL]', { 
                    score: finalScore, 
                    threshold: minScoreRequired, 
                    item_id: p.itemId,
                    reason: scoreReason
                  });
                  kwScoreSkipped++;
                  logActivity(supabase, {
                    source_id: s.id,
                    user_id: s.user_id,
                    event_type: 'skipped_score',
                    keyword: kw.term,
                    score: finalScore,
                    title: p.name,
                    discard_reason: scoreReason,
                    page: pageToUse
                  });
                  continue;
                }

                // Ingestão (Base de Produtos)
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

                if (!product || !product.id) {
                  console.error(`${logPrefix} [RADAR-FATAL] product.id é null/undefined para item:`, {
                    shopee_item_id: p.itemId,
                    shopee_shop_id: p.shopId,
                    product_name: p.name?.slice(0, 50)
                  });
                  continue;
                }

                // LOG DE DIAGNÓSTICO DE INTEGRIDADE
                if (isDebugEnabled('DEBUG_RADAR')) {
                  console.log(`${logPrefix} [RADAR-PRODUCT-DEBUG]`, {
                    product_id: product.id,
                    product_type: typeof product.id,
                    has_product: !!product
                  });
                }

                // Vínculo Operacional (Radar Discovered)
                const { data: inserted, error: insertedError } = await supabase
                  .from('radar_discovered_products')
                  .upsert({
                    product_id: product.id,
                    source_id: s.id,
                    user_id: s.user_id,
                    discovered_at: new Date().toISOString(),
                    score: finalScore,
                    skipped_reason: scoreReason,
                    stable_product_key: stableKey,
                    status: 'pending'
                  }, { onConflict: 'product_id,source_id', ignoreDuplicates: true })
                  .select('id')
                  .maybeSingle();

                if (insertedError) {
                  console.error(`${logPrefix} [RADAR-INSERT-ERROR] Erro ao inserir em radar_discovered_products:`, insertedError);
                }

                if (inserted) {
                  batchNew++;
                  kwNewLinks++;
                  logActivity(supabase, {
                    source_id: s.id,
                    user_id: s.user_id,
                    event_type: 'discovered',
                    product_id: product.id,
                    keyword: kw.term,
                    score: finalScore,
                    title: p.name,
                    page: pageToUse
                  });
                } else {
                  kwDeduped++;
                }
              }

              // LOG DE PROFUNDIDADE (NOVO)
              console.log(`${logPrefix} [RADAR-DISCOVERY-DEPTH]`, {
                source_id: s.id,
                keyword: kw.term,
                raw_nodes: rawProducts.length,
                scanned_nodes: scannedNodes,
                prefilter_candidates: rawProducts.length,
                dedupe_skip: kwDeduped,
                val_skip: kwValidationSkipped,
                hard_filter_skip: kwHardFilterSkipped,
                accepted: kwNewLinks,
                total_budget_remaining: Math.max(0, totalBudget - (batchNew + kwNewLinks))
              });

              // LOG POR KEYWORD (TRACE MODE)
              console.log(`${logPrefix} [RADAR-TRACE] ${kw.term} | fetch:${rawProducts.length} | scan:${scannedNodes}/${rawProducts.length} | hard_filter_skip:${kwHardFilterSkipped} | val_skip:${kwValidationSkipped} | dedupe_skip:${kwDeduped} | score_skip:${kwScoreSkipped} | ok:${kwNewLinks}`);
            } catch (kwErr: any) {
              console.error(`${logPrefix} [RADAR-FAIL] Erro na keyword "${kw.term}":`, kwErr.message);
              logActivity(supabase, {
                source_id: s.id,
                user_id: s.user_id,
                event_type: 'api_error',
                keyword: kw.term,
                discard_reason: kwErr.message,
                page: pageToUse
              });
              // Continua para a próxima keyword
            }
          }

          return { funnelTotalNew: batchNew, funnelTotalFetched: batchFetched, funnelCacheHits: batchCacheHits };
        };

        // Executar primeira tentativa de busca na página atual do radar
        let { funnelTotalNew, funnelTotalFetched, funnelCacheHits } = await runDiscoveryBatch(s.discovery_page || 1);

        // LOG CONSOLIDADO
        console.log(`${logPrefix} [RADAR-FUNNEL] total_budget:${totalBudget} total_new:${funnelTotalNew} cache_hits:${funnelCacheHits}/${keywords.length}`);

        // 7. Persistir Estado com Lógica de Exaustão e Auto-Reset Inteligente
        const EXHAUSTION_THRESHOLD = 3;
        const currentEmptyCount = s.consecutive_empty_cycles ?? 0;

        let nextDiscoveryPage: number;
        let nextNeedsRestock: boolean;
        let nextConsecutiveEmptyCycles: number;
        const prevExhaustedAt = s.discovery_exhausted_at ?? null;
        let nextDiscoveryExhaustedAt: string | null = prevExhaustedAt;

        if (funnelTotalNew > 0) {
          // REGRA 3: Ciclo produtivo — avança página, zera contador de ciclos vazios
          nextDiscoveryPage = funnelTotalFetched > 0 ? (s.discovery_page || 1) + 1 : (s.discovery_page || 1);
          nextNeedsRestock = false;
          nextConsecutiveEmptyCycles = 0;
          console.log(`${logPrefix} [RADAR-EXHAUSTION] Ciclo produtivo. ${funnelTotalNew} inseridos. Contador zerado.`);
        } else {
          // Ciclo vazio: incrementar contador
          nextConsecutiveEmptyCycles = currentEmptyCount + 1;

          if (nextConsecutiveEmptyCycles >= EXHAUSTION_THRESHOLD) {
            // REGRA 2: Exaustão detectada — reiniciar paginação com Auto-Reset completo e Cooldown
            const lastReset = prevExhaustedAt ? new Date(prevExhaustedAt).getTime() : 0;
            const cooldownMinutesForReset = Math.max(10, Number(config.send_interval_minutes ?? config.interval_minutes ?? cooldownMinutes));
            const cooldownMs = cooldownMinutesForReset * 60 * 1000;
            
            if (NOW - lastReset < cooldownMs) {
              // Cooldown ativo -> Bloquear o auto-reset para evitar loops de chamadas na API
              console.log(`${logPrefix} [RADAR-AUTO-RESET-BLOCKED] { reason: 'cooldown_active', sourceId: '${s.id}' }`);
              nextDiscoveryPage = s.discovery_page || 1;
              nextNeedsRestock = s.needs_restock ?? false;
              nextConsecutiveEmptyCycles = EXHAUSTION_THRESHOLD; // Clamp do contador
            } else {
              // Auto-reset permitido!
              nextDiscoveryPage = 1;
              nextNeedsRestock = false;
              nextConsecutiveEmptyCycles = 0;
              nextDiscoveryExhaustedAt = new Date().toISOString();
              
              console.log(`${logPrefix} [RADAR-AUTO-RESET] { radarId: '${s.id}', reason: 'consecutive_empty_cycles_limit', timestamp: '${nextDiscoveryExhaustedAt}' }`);
              
              // 1. Limpar produtos do banco associados a este radar para liberar rediscovery
              await supabase
                .from('radar_discovered_products')
                .delete()
                .eq('source_id', s.id);
                
              // 1.5 Limpar tabela de deduplicação para este radar
              await supabase
                .from('automation_dedupe')
                .delete()
                .eq('source_id', s.id);
                
              // 2. Limpar o cache de memória para os termos deste radar
              keywords.forEach(kw => {
                radarCacheService.clearKeyword(kw.term);
              });
              
              // 3. Rerodar a descoberta imediatamente a partir da página 1
              console.log(`${logPrefix} [RADAR-AUTO-RESET-IMMEDIATE-RUN] Iniciando rediscovery imediato na pagina 1...`);
              const immediateRes = await runDiscoveryBatch(1);
              funnelTotalNew = immediateRes.funnelTotalNew;
              funnelTotalFetched = immediateRes.funnelTotalFetched;
              funnelCacheHits = immediateRes.funnelCacheHits;
              
              // Ajustar próxima página após a rodada imediata
              nextDiscoveryPage = funnelTotalFetched > 0 ? 2 : 1;
            }
          } else {
            // REGRA 1: Ciclo vazio mas abaixo do threshold — pode avançar página se Shopee retornou algo
            nextDiscoveryPage = funnelTotalFetched > 0
              ? (s.discovery_page || 1) + 1
              : (s.discovery_page || 1); // se Shopee não retornou nada, não avança página
            nextNeedsRestock = s.needs_restock ?? false;
            console.log(
              `${logPrefix} [RADAR-EXHAUSTION] Ciclo vazio (${nextConsecutiveEmptyCycles}/${EXHAUSTION_THRESHOLD}). ` +
              `Fetched:${funnelTotalFetched} New:${funnelTotalNew} Pagina:${nextDiscoveryPage}`
            );
          }
        }

        const persistPayload: Record<string, unknown> = {
          config: { ...config, keywords },
          last_restock_at: new Date().toISOString(),
          discovery_locked_until: null,
          discovery_page: nextDiscoveryPage,
          needs_restock: nextNeedsRestock,
          consecutive_empty_cycles: nextConsecutiveEmptyCycles,
        };

        // Só atualiza discovery_exhausted_at se o valor mudou
        if (nextDiscoveryExhaustedAt !== prevExhaustedAt) {
          persistPayload.discovery_exhausted_at = nextDiscoveryExhaustedAt;
        }

        await supabase
          .from('automation_sources')
          .update(persistPayload)
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
