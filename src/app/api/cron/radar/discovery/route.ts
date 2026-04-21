// src/app/api/cron/radar/discovery/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { productService } from '@/services/supabase/product-service';

export const dynamic = 'force-dynamic';

/**
 * Radar Discovery Engine (Ingestion)
 * Busca ofertas baseadas em Filtros de Usuário (Radar Pro) + Descoberta Global.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[RADAR-DISCOVERY] [${requestId}]`;
  console.log(`${logPrefix} Iniciando ciclo de descoberta autônoma...`);

  try {
    const supabase = createAdminClient();
    const adapter = new ShopeeAdapter();

    // 1. Buscar a conexão Shopee ativa principal
    const { data: connection } = await supabase
      .from('user_marketplaces')
      .select('*, marketplaces(name)')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!connection) {
      console.warn(`${logPrefix} Nenhuma conexão Shopee ativa encontrada.`);
      return NextResponse.json({ skipped: 'no_connections' });
    }

    const shopeeConnection = {
      ...connection,
      shopee_app_id: connection.shopee_app_id || process.env.SHOPEE_APP_ID,
      shopee_app_secret: (connection as any).shopee_app_secret || process.env.SHOPEE_APP_SECRET
    };

    // 2. Buscar Automações de Radar Pro Ativas
    const { data: activeRadars } = await supabase
      .from('automation_sources')
      .select('id, name, config, user_id')
      .eq('source_type', 'radar_offers')
      .eq('is_active', true);

    console.log(`${logPrefix} Encontradas ${activeRadars?.length || 0} automações de Radar Pro ativas.`);

    // 3. Definir Tarefas de Descoberta (Filtros do Usuário + Global)
    const discoveryTasks: { label: string; keyword?: string; sortType: number }[] = [];

    // Adicionar tarefas baseadas nos termos configurados (ou nomes)
    activeRadars?.forEach(radar => {
      const keyword = (radar.config as any)?.searchTerm || radar.name;
      discoveryTasks.push({ label: `Radar Pro: ${radar.name}`, keyword, sortType: 1 });
    });

    // Fallback: Estratégias Globais do Sistema
    discoveryTasks.push({ label: 'System: Hot Products', sortType: 3 });
    discoveryTasks.push({ label: 'System: Recommendations', sortType: 5 });

    let totalInserted = 0;
    const { data: existingProducts } = await supabase.from('products').select('original_url');
    const existingUrls = new Set((existingProducts || []).map(p => p.original_url));

    // 4. Executar Descoberta por Lote
    for (const task of discoveryTasks) {
      console.log(`${logPrefix} Executando: ${task.label}...`);
      
      try {
        const products = await adapter.discoverProducts({
          sortType: task.sortType,
          keyword: task.keyword,
          limit: 15,
          connection: shopeeConnection as any
        });

        for (const p of products) {
          const url = p.productLink || p.offerLink;
          if (!url || existingUrls.has(url)) continue;

          // Cálculo Unificado de Oportunidade (ROI Operacional)
          const finalScore = productService.calculateOpportunityScore(
            p.currentPriceFactual || 0,
            p.originalPrice || null,
            p.commissionValueFactual || 0
          );

          // Inserção com Deduplicação Layer 1
          const { error } = await supabase
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

          if (!error) {
            totalInserted++;
            existingUrls.add(url);
          }
        }
      } catch (err) {
        console.error(`${logPrefix} Erro na tarefa ${task.label}:`, err);
      }
    }

    console.log(`${logPrefix} Ciclo finalizado. Inseridos: ${totalInserted}`);
    
    return NextResponse.json({
      status: 'success',
      upserted: totalInserted,
      tasks: discoveryTasks.length
    });

  } catch (error: any) {
    console.error(`${logPrefix} ERRO NO MOTOR DE DESCOBERTA:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
