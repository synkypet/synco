import { SupabaseClient } from '@supabase/supabase-js';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { productService } from '@/services/supabase/product-service';
import { automationService } from '@/services/supabase/automation-service';

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
    options: { sourceId?: string; userId?: string } = {}
  ): Promise<DiscoveryResult> {
    const adapter = new ShopeeAdapter();
    const logPrefix = `[RADAR-DISCOVERY]`;

    // 1. Resolver Conexão Shopee (Garantindo que tenha as chaves de API)
    const { data: connection } = await supabase
      .from('user_marketplaces')
      .select('*, marketplaces(name)')
      .eq('is_active', true)
      .not('shopee_app_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (!connection) {
      console.warn(`${logPrefix} Nenhuma conexão Shopee válida encontrada.`);
      
      // Registrar no log operacional para o usuário ver
      if (options.sourceId || options.userId) {
        await automationService.logEvent({
          source_id: options.sourceId || '',
          user_id: options.userId || '',
          status: 'error',
          event_type: 'radar_discovery',
          details: { message: 'Erro: Nenhuma conexão Shopee com Chaves de API (App ID) ativa foi encontrada.' }
        }, supabase);
      }
      
      return { totalInserted: 0, tasksExecuted: 0 };
    }

    const shopeeConnection = {
      ...connection,
      shopee_app_id: connection.shopee_app_id,
      shopee_app_secret: (connection as any).shopee_app_secret || process.env.SHOPEE_APP_SECRET
    };

    // 2. Buscar Automações para processar
    let query = supabase
      .from('automation_sources')
      .select('id, name, config, user_id')
      .eq('source_type', 'radar_offers')
      .eq('is_active', true);

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
    const tasks: { label: string; keyword?: string; sortType: number; listType: number; limit: number; sourceId?: string; userId: string; config: any }[] = [];

    const NOW = Date.now();

    for (const s of (sources || [])) {
      const config = (s.config as any) || {};
      const keyword = config.searchTerm || s.name;
      
      // A. Cooldown Check (Discovery Pacing)
      const lastRun = config.last_discovery_at ? new Date(config.last_discovery_at).getTime() : 0;
      const cooldownMs = (config.cooldown_minutes || 60) * 60 * 1000;
      
      if (NOW - lastRun < cooldownMs) {
        console.log(`${logPrefix} [SKIP-COOLDOWN] Fonte "${s.name}" ainda em cooldown.`);
        continue;
      }

      // B. Buffer Check (Supply/Demand)
      // Buscamos se já existem produtos com essa keyword que ainda não foram usados por essa fonte
      // Para simplificar no MVP, verificamos produtos recentes com a keyword
      const { count: existingCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .ilike('category', `%${keyword}%`);

      if (existingCount && existingCount > 15) {
        console.log(`${logPrefix} [SKIP-BUFFER] Fonte "${s.name}" já possui ${existingCount} candidatos no banco.`);
        // Atualiza o timestamp para não ficar tentando em todo ciclo de 1 min, mas um cooldown menor
        await supabase.from('automation_sources').update({
           config: { ...config, last_discovery_at: new Date().toISOString() }
        }).eq('id', s.id);
        continue;
      }

      tasks.push({ 
        label: `Radar Pro: ${s.name}`, 
        keyword, 
        sortType: config.sortType || 1,
        listType: config.listType || 0,
        limit: config.batchLimit || 20,
        sourceId: s.id,
        userId: s.user_id,
        config
      });
    }

    // Se for um ciclo global (sem sourceId específico), adicionamos as tarefas de sistema
    if (!options.sourceId) {
      tasks.push({ label: 'System: Hot Products', sortType: 3, listType: 0, limit: 20, userId: connection.user_id, config: {} });
      tasks.push({ label: 'System: Recommendations', sortType: 5, listType: 0, limit: 20, userId: connection.user_id, config: {} });
    }

    let globalInserted = 0;
    const { data: existingProducts } = await supabase.from('products').select('original_url');
    const existingUrls = new Set((existingProducts || []).map(p => p.original_url));

    // 4. Executar tarefas
    for (const task of tasks) {
      try {
        console.log(`${logPrefix} Iniciando: ${task.label}...`);
        
        // Registrar início da busca para feedback imediato
        if (task.sourceId) {
          await automationService.logEvent({
            source_id: task.sourceId,
            user_id: task.userId,
            status: 'processing' as any,
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
          connection: shopeeConnection as any
        });

        const capturedItemsMeta: any[] = [];

        for (const p of products) {
          const url = p.productLink || p.offerLink;
          
          // Etapa 3: Guardrail de Completude
          // Não processar produtos com dados obrigatórios ausentes ou comissão inválida
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
            continue;
          }

          capturedItemsMeta.push({
            name: p.name,
            url,
            price: p.currentPriceFactual,
            score: productService.calculateOpportunityScore(
              p.currentPriceFactual || 0,
              p.originalPrice || null,
              p.commissionValueFactual || 0
            )
          });

          if (!url || existingUrls.has(url)) continue;

          const finalScore = productService.calculateOpportunityScore(
            p.currentPriceFactual || 0,
            p.originalPrice || null,
            p.commissionValueFactual || 0
          );

          const { error: insError } = await supabase
            .from('products')
            .insert({
              name: p.name,
              marketplace: 'Shopee',
              category: task.keyword ? `[RADAR] [PRO] ${task.keyword}` : `[RADAR] ${p.category}`,
              current_price: p.currentPriceFactual,
              original_price: p.originalPrice,
              discount_percent: p.discountPercent,
              commission_percent: (p.commissionRate || 0) * 100,
              commission_value: p.commissionValueFactual,
              image_url: p.imageUrl,
              original_url: url,
              opportunity_score: finalScore
            });

          if (!insError) {
            taskInserted++;
            globalInserted++;
            existingUrls.add(url);
          }
        }

        // 5. Logar evento de finalização com relatório detalhado de itens
        const finalStatus = taskInserted > 0 ? 'captured' : 'finished';
        const finalMsg = taskInserted > 0 
          ? `Radar Pro: ${taskInserted} novas ofertas exclusivas injetadas para "${task.keyword || 'Global'}".` 
          : `Radar Pro: Busca finalizada para "${task.keyword || 'Global'}". ${products.length} itens analisados, mas todos já constavam no seu Radar.`;

        await automationService.logEvent({
          source_id: task.sourceId || '',
          user_id: task.userId,
          status: finalStatus as any,
          event_type: 'radar_discovery',
          details: {
            keyword: task.keyword,
            found: products.length,
            inserted: taskInserted,
            capturedItems: capturedItemsMeta,
            url: `Busca: ${task.keyword || 'Global'}`,
            message: finalMsg
          }
        }, supabase);

        // 6. Atualizar timestamp de última descoberta bem sucedida
        if (task.sourceId) {
          await supabase.from('automation_sources').update({
            config: { ...task.config, last_discovery_at: new Date().toISOString() }
          }).eq('id', task.sourceId);
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
