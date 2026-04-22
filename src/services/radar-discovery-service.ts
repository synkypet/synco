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
    const tasks: { label: string; keyword?: string; sortType: number; sourceId?: string; userId: string }[] = [];

    sources?.forEach(s => {
      const keyword = (s.config as any)?.searchTerm || s.name;
      tasks.push({ 
        label: `Radar Pro: ${s.name}`, 
        keyword, 
        sortType: 1,
        sourceId: s.id,
        userId: s.user_id
      });
    });

    // Se for um ciclo global (sem sourceId específico), adicionamos as tarefas de sistema
    if (!options.sourceId) {
      tasks.push({ label: 'System: Hot Products', sortType: 3, userId: connection.user_id });
      tasks.push({ label: 'System: Recommendations', sortType: 5, userId: connection.user_id });
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
          keyword: task.keyword,
          limit: 15,
          connection: shopeeConnection as any
        });

        const capturedItemsMeta: any[] = [];

        for (const p of products) {
          const url = p.productLink || p.offerLink;
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
              category: task.keyword ? `[PRO] ${task.keyword}` : `[RADAR] ${p.category}`,
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
