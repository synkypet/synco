// src/app/api/cron/radar/discovery/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';

export const dynamic = 'force-dynamic';

/**
 * Radar Discovery Engine (Ingestion)
 * Busca ofertas em alta na Shopee e injeta no banco para posterior processamento.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  // Proteção simples via Header ou allow-all se for interno
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[RADAR-DISCOVERY] [${requestId}]`;
  console.log(`${logPrefix} Iniciando ciclo de descoberta ativa...`);

  try {
    const supabase = createAdminClient();

    // 1. Buscar uma conexão Shopee válida para usar a API
    const { data: connection } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('marketplace', 'Shopee')
      .not('shopee_app_id', 'is', null)
      .not('shopee_app_secret', 'is', null)
      .limit(1)
      .maybeSingle();

    if (!connection) {
      console.warn(`${logPrefix} Nenhuma credencial Shopee encontrada no sistema para descoberta.`);
      return NextResponse.json({ skipped: 'no_credentials' });
    }

    const adapter = new ShopeeAdapter();
    const strategies = [
      { sortType: 1, label: 'Top Sales', limit: 20 },
      { sortType: 3, label: 'Hot Products', limit: 20 },
      { sortType: 4, label: 'Relevance', limit: 20 },
      { sortType: 5, label: 'Recommendations', limit: 20 }
    ];

    let totalDiscovered = 0;
    let totalInserted = 0;

    for (const strategy of strategies) {
      console.log(`${logPrefix} Executando estratégia: ${strategy.label}...`);
      
      const products = await adapter.discoverProducts({
        sortType: strategy.sortType,
        limit: strategy.limit,
        connection
      });

      totalDiscovered += products.length;

      for (const p of products) {
        // --- NOVO CÁLCULO DE INTELIGÊNCIA (ROI SCORING) ---
        // Referência: ROI = (Comissão / Preço) * 100
        // Bias: log10(Preço Original / Preço Atual) -> Premia descontos reais
        
        const currentPrice = p.currentPriceFactual || 0.01; // Evitar div/0
        const originalPrice = p.originalPrice || currentPrice;
        const commissionValue = p.commissionValueFactual || 0;
        
        const roi = (commissionValue / currentPrice) * 100;
        const discountRatio = originalPrice / currentPrice;
        const scaleBias = Math.log10(discountRatio * 10) || 1; // Bias positivo se houver desconto
        
        // Score Final: ROI balanceado pelo viés de escala e desconto
        // Valor base 40 + ROI amplificado
        const rawScore = 40 + (roi * scaleBias * 5);
        const finalScore = Math.min(100, Math.round(rawScore));

        // Inserir no banco
        const { error } = await supabase
          .from('products')
          .upsert({
            name: p.name,
            marketplace: 'Shopee',
            category: p.category,
            current_price: p.currentPriceFactual,
            original_price: p.originalPrice,
            discount_percent: p.discountPercent,
            commission_percent: (p.commissionRate || 0) * 100,
            commission_value: p.commissionValueFactual,
            image_url: p.imageUrl,
            original_url: p.productLink || p.offerLink,
            opportunity_score: finalScore,
            // Tags de controle Radar
            is_radar: true,
            external_id: `${p.shopId}_${p.itemId}`
          }, { 
            onConflict: 'marketplace,external_id' 
          });

        if (!error) totalInserted++;
      }
    }

    console.log(`${logPrefix} Ciclo finalizado. Descobertos: ${totalDiscovered} | Novos/Atualizados: ${totalInserted}`);
    
    return NextResponse.json({
      status: 'success',
      discovered: totalDiscovered,
      upserted: totalInserted,
      strategies: strategies.length
    });

  } catch (error: any) {
    console.error(`${logPrefix} ERRO CRÍTICO:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
