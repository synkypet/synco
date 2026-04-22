// src/app/api/cron/radar/dispatcher/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { campaignService } from '@/services/supabase/campaign-service';
import { automationService } from '@/services/supabase/automation-service';
import { triggerWorker } from '@/lib/worker/trigger';

export const dynamic = 'force-dynamic';

/**
 * Radar Dispatcher Engine (Automation)
 * Cruza produtos descobertos com as regras de automação dos usuários.
 */
export async function GET(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[RADAR-DISPATCHER] [${requestId}]`;
  console.log(`${logPrefix} Iniciando processamento de despacho...`);

  try {
    const supabase = createAdminClient();

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
      return NextResponse.json({ status: 'no_sources' });
    }

    // 2. Buscar produtos recentes do Radar
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .ilike('category', '[RADAR]%')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!products || products.length === 0) {
      return NextResponse.json({ status: 'no_products' });
    }

    let totalCreated = 0;

    // 3. Cruzamento de Dados (Pipeline Operacional)
    for (const source of sources) {
      const routes = source.automation_routes || [];
      if (routes.length === 0) continue;

      for (const product of products) {
        for (const route of routes) {
          // A. Deduplicação Atômica
          const hashKey = generateHash(`radar_v1:${route.id}:${product.id}`);
          const { error: dedupeError } = await supabase.from('automation_dedupe').insert({ hash_key: hashKey });

          if (dedupeError) {
            if (dedupeError.code === '23505') continue;
            console.error(`${logPrefix} Erro no dedupe:`, dedupeError.message);
            continue;
          }

          // B. Filtragem por Regras de Usuário
          if (!applyRadarFilters(product, route.filters)) continue;

          // C. Geração de Campanha
          try {
            // --- REGRA DE ELEGIBILIDADE FACTUAL (HARDENING) ---
            const reasons: string[] = [];
            if (!product.name) reasons.push('Ausência de título');
            if (!product.image_url) reasons.push('Ausência de imagem válida');
            if (!product.current_price || product.current_price <= 0) reasons.push('Ausência de preço factual');

            const isEligible = reasons.length === 0;

            const campaignData = {
              name: `RADAR: ${product.name.substring(0, 30)}...`,
              items: [{
                product_name: product.name,
                image_url: product.image_url,
                affiliate_url: product.original_url,
                current_price: product.current_price,
                original_price: product.original_price,
                external_product_id: product.id,
                // Requisitos de Elegibilidade (Fase 2)
                eligibility_status: (isEligible ? 'eligible' : 'ineligible') as any,
                eligibility_reasons: reasons
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
              details: { productId: product.id, routeId: route.id }
            }, supabase);

            totalCreated++;
          } catch (err: any) {
            console.error(`${logPrefix} Falha ao despachar produto ${product.id}:`, err.message);
          }
        }
      }
    }

    // 4. Acionamento do Worker de Envios
    if (totalCreated > 0) {
      await triggerWorker({ requestId });
    }

    return NextResponse.json({
      status: 'success',
      campaigns_created: totalCreated
    });

  } catch (error: any) {
    console.error(`${logPrefix} ERRO CRÍTICO NO DISPATCHER:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Filtros específicos para o Radar
 */
function applyRadarFilters(product: any, filters: any): boolean {
  if (!filters) return true;

  // 1. Preço Mínimo
  if (filters.min_price && product.current_price < filters.min_price) return false;

  // 2. Comissão Mínima
  if (filters.min_commission_rate && product.commission_percent < filters.min_commission_rate) return false;

  // 3. Blacklist
  if (filters.keywords_blacklist?.length > 0) {
    const text = `${product.name} ${product.category}`.toLowerCase();
    const hasBlacklisted = filters.keywords_blacklist.some((word: string) => text.includes(word.toLowerCase().trim()));
    if (hasBlacklisted) return false;
  }

  // 4. Whitelist
  if (filters.keywords_whitelist?.length > 0) {
    const text = `${product.name} ${product.category}`.toLowerCase();
    const hasWhitelisted = filters.keywords_whitelist.some((word: string) => text.includes(word.toLowerCase().trim()));
    if (!hasWhitelisted) return false;
  }

  return true;
}

/**
 * Helper para hash compatível com automation-service
 */
function generateHash(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
