import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { shopeePromoPageService } from '@/services/supabase/shopee-promo-page-service';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const landingType = searchParams.get('landingType') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const supabaseAdmin = createAdminClient();

    // 1. Buscar promo pages brutas
    const promoPages = await shopeePromoPageService.listDiscoveredPromoPages(user.id, {
      status,
      landingType,
      limit
    }, supabaseAdmin);

    // 2. Mapeamento Simples para Exibição (READ-ONLY)
    // NOTA: Esta API agora é READ-ONLY. Não resolvemos links nem chamamos a Shopee aqui.
    const enrichedPages = promoPages.map(page => ({
      ...page,
      effective_redemption_url: page.canonical_url || page.raw_url,
      reaffiliation_status: 'not_needed'
    }));

    return NextResponse.json({
      status: 'SUCCESS',
      data: enrichedPages
    });

  } catch (error: any) {
    console.error('[API-PROMO] Erro ao listar promo pages:', error);
    return NextResponse.json({ 
      status: 'ERROR', 
      error: error.message || 'Falha ao processar requisição' 
    }, { status: 500 });
  }
}
