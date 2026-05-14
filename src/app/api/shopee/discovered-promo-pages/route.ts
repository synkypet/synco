import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { shopeePromoPageService } from '@/services/supabase/shopee-promo-page-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';

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

    // 2. Buscar conexão Shopee do usuário para re-afiliação
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);
    const shopeeConnection = connections.find(c => c.marketplace_name.toLowerCase().includes('shopee'));
    
    const adapter = new ShopeeAdapter();

    // 3. Re-afiliar em tempo real para exibição (server-side)
    const enrichedPages = await Promise.all(promoPages.map(async (page) => {
      let effectiveUrl = page.canonical_url || page.raw_url;
      let reaffiliationStatus = 'not_needed';
      let reaffiliationWarning = undefined;
      let affiliateUrl = undefined;

      if (shopeeConnection && effectiveUrl) {
        try {
          const preResult = await adapter.preProcessIncomingLink(effectiveUrl, shopeeConnection);
          affiliateUrl = preResult.generated_affiliate_url;
          reaffiliationStatus = preResult.reaffiliation_status || 'failed';
          
          if (preResult.reaffiliation_status === 'reaffiliated') {
            effectiveUrl = preResult.generated_affiliate_url || effectiveUrl;
          } else if (preResult.reaffiliation_status === 'failed') {
            reaffiliationWarning = preResult.reaffiliation_error || 'Falha na re-afiliação';
          }
        } catch (err) {
          console.error(`[API-PROMO] Erro ao re-afiliar ${page.id}:`, err);
          reaffiliationStatus = 'failed';
          reaffiliationWarning = 'Erro interno no processador de links';
        }
      } else if (!shopeeConnection) {
        reaffiliationStatus = 'blocked';
        reaffiliationWarning = 'Credenciais de afiliado Shopee ausentes para este usuário.';
      }

      return {
        ...page,
        effective_redemption_url: effectiveUrl,
        affiliate_url: affiliateUrl,
        reaffiliation_status: reaffiliationStatus,
        reaffiliation_warning: reaffiliationWarning
      };
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
