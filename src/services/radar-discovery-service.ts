import { SupabaseClient } from '@supabase/supabase-js';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { productService } from '@/services/supabase/product-service';
import { automationService } from '@/services/supabase/automation-service';
import { marketplaceService } from '@/services/supabase/marketplace-service';

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
    const logPrefix = `[RADAR-DISCOVERY]${options.force ? ' [FORCE]' : ''}`;

    const connectionCache = new Map<string, any>();

    // 1. Buscar Automações para processar (Filtrando por locks expirados)
    const nowIso = new Date().toISOString();
    let query = supabase
      .from('automation_sources')
      .select(`
        id, name, config, user_id, 
        needs_restock, last_restock_at, discovery_page, discovery_locked_until
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

    // 3. Montar Tarefas
    const tasks: { label: string; keyword?: string; sortType: number; listType: number; limit: number; page?: number; sourceId?: string; userId: string; config: any; needsRestock?: boolean }[] = [];

    const NOW = Date.now();

    for (const s of (sources || [])) {
      const config = (s.config as any) || {};
      const keyword = config.searchTerm || s.name;
      
      // A. Cooldown Check (Discovery Pacing)
      const lastRun = s.last_restock_at ? new Date(s.last_restock_at).getTime() : 0;
      const cooldownMs = (config.cooldown_minutes || 60) * 60 * 1000;
      const needsRestock = s.needs_restock === true;
      
      // Modo Restock (10 min) vs Modo Periódico (60 min default)
      const effectiveCooldown = needsRestock ? 10 * 60 * 1000 : cooldownMs;
      
      if (NOW - lastRun < effectiveCooldown && !options.force) {
        console.log(`${logPrefix} [SKIP-COOLDOWN] Fonte "${s.name}" em cooldown (${needsRestock ? 'RESTOCK' : 'NORMAL'}).`);
        continue;
      }

      // B. Buffer Check (Supply/Demand)
      // Buscamos se já existem produtos com essa keyword que ainda não foram usados por essa fonte
      // Para simplificar no MVP, verificamos produtos recentes com a keyword
      const { count: existingCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .ilike('category', `%${keyword}%`);

      if (existingCount && existingCount > 15 && !options.force) {
        console.log(`${logPrefix} [SKIP-BUFFER] Fonte "${s.name}" já possui ${existingCount} candidatos no banco.`);
        // Não alteramos o config aqui para não interferir no fluxo de restock se ele estiver ativo
        continue;
      }

      // B. Determinar Página de Busca
      const pageToFetch = s.discovery_page || 1;

      tasks.push({ 
        label: `Radar Pro: ${s.name}${needsRestock ? ` [RESTOCK-P${pageToFetch}]` : ` [PERIODIC-P${pageToFetch}]`}`, 
        keyword, 
        sortType: config.sortType || 1,
        listType: config.listType || 0,
        limit: config.batchLimit || 20,
        page: pageToFetch,
        sourceId: s.id,
        userId: s.user_id,
        config,
        needsRestock
      });
    }

    // Se for um ciclo global (sem sourceId específico), podemos adicionar tarefas de sistema
    // No MVP, usamos o contexto do primeiro usuário que tiver uma conexão válida para alimentar o estoque global
    if (!options.sourceId && tasks.length > 0) {
      const firstValidUserId = tasks[0].userId;
      tasks.push({ label: 'System: Hot Products', sortType: 3, listType: 0, limit: 20, userId: firstValidUserId, config: {} });
      tasks.push({ label: 'System: Recommendations', sortType: 5, listType: 0, limit: 20, userId: firstValidUserId, config: {} });
    } else if (!options.sourceId && tasks.length === 0) {
      console.log(`${logPrefix} [SKIP-SYSTEM] Nenhuma automação ativa para herdar contexto de conexão.`);
    }

    let globalInserted = 0;
    const { data: existingProducts } = await supabase.from('products').select('original_url');
    const existingUrls = new Set((existingProducts || []).map(p => p.original_url));

    // 4. Executar tarefas
    for (const task of tasks) {
      try {
        console.log(`${logPrefix} Processando: ${task.label}...`);

        // 0. Adquirir Lock Atômico (Prevenção de concorrência)
        if (task.sourceId) {
          const { data: locked, error: lockError } = await supabase
            .from('automation_sources')
            .update({ 
              discovery_locked_until: new Date(Date.now() + 5 * 60 * 1000).toISOString() 
            })
            .eq('id', task.sourceId)
            .or(`discovery_locked_until.is.null,discovery_locked_until.lt.${new Date().toISOString()}`)
            .select('id')
            .maybeSingle();

          if (lockError || !locked) {
            console.log(`${logPrefix} [LOCKED] Falha ao adquirir lock para "${task.label}". Pulando.`);
            continue;
          }
        }

        // A. Resolver e Validar Conexão por Usuário (Cacheada)
        let shopeeConnection = connectionCache.get(task.userId);
        if (!shopeeConnection) {
          const connections = await marketplaceService.getEnrichedConnections(task.userId, supabase);
          const found = connections.find(c => c.marketplace_name === 'Shopee');
          if (found) {
            shopeeConnection = {
              ...found,
              shopee_app_id: found.shopee_app_id,
              shopee_app_secret: found.shopee_app_secret // Vem descriptografado do serviço
            };
            connectionCache.set(task.userId, shopeeConnection);
          }
        }

        if (!shopeeConnection?.shopee_app_id || !shopeeConnection?.shopee_app_secret) {
          console.warn(`${logPrefix} [SKIP-CREDENTIALS] Usuário ${task.userId} não possui App ID ou Secret válido.`);
          if (task.sourceId) {
            await automationService.logEvent({
              source_id: task.sourceId,
              user_id: task.userId,
              status: 'error',
              event_type: 'radar_discovery',
              details: { message: 'Erro: Credenciais Shopee (App ID/Secret) ausentes ou inválidas.' }
            }, supabase);
          }
          continue;
        }
        
        // Registrar início da busca para feedback imediato
        if (task.sourceId) {
          await automationService.logEvent({
            source_id: task.sourceId,
            user_id: task.userId,
            status: 'processed',
            event_type: 'radar_discovery',
            details: { message: `Iniciando busca na Shopee por "${task.keyword || 'Global'}"...`, url: `Busca: ${task.keyword || 'Global'}` }
          }, supabase);
        }

        let taskInserted = 0;
        const products = await adapter.discoverProducts({
          sortType: task.sortType,
          listType: task.listType,
          keyword: task.keyword,
          limit: task.limit,
          page: task.page, 
          connection: shopeeConnection
        });

        const capturedItemsMeta: any[] = [];
        // Contadores de tarefa
        let taskFromShopee = products.length;
        let taskSaved = 0;
        let taskExisting = 0;
        let taskLinked = 0;
        let taskUpdated = 0;
        let taskSkippedVisual = 0;
        let taskFailed = 0;

        // 4.B Buscar vínculos pendentes existentes para dedupe visual em memória
        const { data: existingLinks } = await supabase
          .from('radar_discovered_products')
          .select('title_fingerprint')
          .eq('source_id', task.sourceId)
          .eq('status', 'pending');
        
        const pendingFingerprints = new Set((existingLinks || []).map(l => l.title_fingerprint).filter(Boolean));

        for (const p of products) {
          const url = p.productLink || p.offerLink;
          
          // Etapa 3: Guardrail de Completude
          const hasRequiredFields = 
            p.name && 
            p.imageUrl && 
            p.currentPriceFactual && 
            p.currentPriceFactual > 0 &&
            p.commissionValueFactual && 
            p.commissionValueFactual > 0 &&
            p.commissionRate && 
            p.commissionRate > 0;

          if (!hasRequiredFields) {
            console.warn(`${logPrefix} Produto descartado por completude insuficiente: ${p.name || 'Sem nome'}`);
            taskFailed++;
            continue;
          }

          const finalScore = productService.calculateOpportunityScore(
            p.currentPriceFactual || 0,
            p.originalPrice || null,
            p.commissionValueFactual || 0
          );

          // 1. Calcular Identidade Estável e Fingerprint
          const stableKey = (p.shopId && p.itemId) 
            ? `shopee:${p.shopId}:${p.itemId}`
            : (url && (url.match(/\/product\/(\d+)\/(\d+)/) || url.match(/-i\.(\d+)\.(\d+)/))) 
              ? `shopee:${(url.match(/\/product\/(\d+)\/(\d+)/) || url.match(/-i\.(\d+)\.(\d+)/))![1]}:${(url.match(/\/product\/(\d+)\/(\d+)/) || url.match(/-i\.(\d+)\.(\d+)/))![2]}`
              : null;

          const fingerprint = p.name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .split(" ")
            .filter(w => w.length > 2)
            .filter((w, i, self) => self.indexOf(w) === i)
            .slice(0, 5)
            .join(":");

          // 2. Dedupe Visual (Apenas para novos itens pendentes da mesma fonte)
          if (fingerprint && pendingFingerprints.has(fingerprint)) {
            console.log(`${logPrefix} [SKIP-VISUAL] Similaridade detectada: "${p.name.substring(0, 30)}..."`);
            taskSkippedVisual++;
            continue;
          }

          capturedItemsMeta.push({
            name: p.name,
            url,
            price: p.currentPriceFactual,
            score: finalScore,
            fingerprint
          });

          // 3. Garantir que o produto existe no catálogo global (Upsert)
          const product = await productService.upsertFromAutomation({
            name: p.name,
            marketplace: 'Shopee',
            category: p.category || (task.keyword ? task.keyword : 'Geral'),
            current_price: p.currentPriceFactual,
            original_price: p.originalPrice,
            discount_percent: p.discountPercent ? Math.round(p.discountPercent) : undefined,
            commission_percent: Math.round((p.commissionRate || 0) * 100),
            commission_value: p.commissionValueFactual,
            image_url: p.imageUrl,
            original_url: url,
            opportunity_score: finalScore
          }, supabase);

          if (!product) {
            taskFailed++;
            continue;
          }

          // Incrementar contadores de catálogo
          if (existingUrls.has(url)) {
            taskExisting++;
          } else {
            taskSaved++;
            existingUrls.add(url);
          }

          // 4. Criar ou Atualizar Vínculo (Discovery Relation)
          if (task.sourceId) {
            // Verificar se já existe vínculo para evitar resetar o status 'dispatched'
            const { data: currentLink } = await supabase
              .from('radar_discovered_products')
              .select('id, status')
              .eq('source_id', task.sourceId)
              .eq('product_id', product.id)
              .maybeSingle();

            const rdpPayload: any = {
              product_id: product.id,
              source_id: task.sourceId,
              user_id: task.userId,
              discovered_at: new Date().toISOString(),
              score: products.indexOf(p) + 1,
              stable_product_key: stableKey || product.id,
              title_fingerprint: fingerprint
            };

            // Regra: Só seta 'pending' se o vínculo for novo
            if (!currentLink) {
              rdpPayload.status = 'pending';
            }

            const { error: rdpError } = await supabase
              .from('radar_discovered_products')
              .upsert(rdpPayload, { onConflict: 'product_id,source_id' });

            if (rdpError) {
              console.error(`${logPrefix} Erro ao vincular produto ${product.id} à fonte ${task.sourceId}:`, rdpError.message);
              taskFailed++;
            } else {
              if (currentLink) taskUpdated++;
              else taskLinked++;
              if (fingerprint) pendingFingerprints.add(fingerprint);
            }
          }

          globalInserted++;
        }

        // 5. Logar evento de finalização com relatório detalhado de itens
        const finalStatus = (taskLinked > 0) ? 'captured' : 'processed';
        const finalMsg = (taskLinked > 0 || taskUpdated > 0)
          ? `Radar Pro: ${taskLinked + taskUpdated} ofertas vinculadas (Novas: ${taskLinked}, Atualizadas: ${taskUpdated}, Puladas Visual: ${taskSkippedVisual}) para "${task.keyword || 'Global'}".` 
          : `Radar Pro: Busca finalizada para "${task.keyword || 'Global'}". ${products.length} analisados, nenhum novo vínculo relevante.`;

        await automationService.logEvent({
          source_id: task.sourceId || '',
          user_id: task.userId,
          status: finalStatus as any,
          event_type: 'radar_discovery',
          details: {
            keyword: task.keyword,
            found: taskFromShopee,
            saved_to_catalog: taskSaved,
            existing_in_catalog: taskExisting,
            links_created: taskLinked,
            links_updated: taskUpdated,
            links_skipped_visual: taskSkippedVisual,
            failed: taskFailed,
            capturedItems: capturedItemsMeta.slice(0, 10), // Limitar para evitar payload gigante (Erro 400)
            url: `Busca: ${task.keyword || 'Global'}`,
            message: finalMsg
          }
        }, supabase);

        // 6. Atualizar Estado Operacional e Liberar Lock
        if (task.sourceId) {
          const updatePayload: any = {
            last_restock_at: new Date().toISOString(),
            discovery_locked_until: null // Liberar lock
          };
          
          if (taskLinked > 0) {
            // Sucesso: Encontramos produtos novos
            updatePayload.needs_restock = false;
            updatePayload.restock_attempts = 0;
            updatePayload.discovery_page = (task.page || 1) + 1;
            updatePayload.discovery_exhausted_at = null;
          } else if (taskFromShopee > 0) {
            // Tentativa: Shopee trouxe produtos, mas todos eram duplicatas
            updatePayload.discovery_page = (task.page || 1) + 1;
            updatePayload.restock_attempts = (task.config.restock_attempts || 0) + 1;
          } else {
            // Exaustão: Shopee retornou 0 produtos (fim da paginação)
            updatePayload.discovery_page = 1; // Resetar
            updatePayload.discovery_exhausted_at = new Date().toISOString();
            updatePayload.restock_attempts = (task.config.restock_attempts || 0) + 1;
          }

          // Guardrail de página
          if (updatePayload.discovery_page && updatePayload.discovery_page > 10) {
            updatePayload.discovery_page = 1;
          }

          await supabase.from('automation_sources').update(updatePayload).eq('id', task.sourceId);
        }

      } catch (err) {
        console.error(`${logPrefix} Falha na tarefa ${task.label}:`, err);
      }
    }

    return {
      totalInserted: globalInserted,
      tasksExecuted: tasks.length
    };
  }
};
