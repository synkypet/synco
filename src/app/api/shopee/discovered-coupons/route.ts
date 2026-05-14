import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';

/**
 * GET /api/shopee/discovered-coupons
 * Lista cupons Shopee detectados para o usuário autenticado.
 */
export async function GET(request: Request) {
  try {
    // 1. Validar usuário autenticado (Gate de Segurança)
    const gate = await requireAuthenticatedUser();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    // 2. Extrair parâmetros de busca da URL
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const couponType = searchParams.get('coupon_type') || undefined;
    const search = searchParams.get('search') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;

    // 3. Validações de domínio para os parâmetros
    if (status && !['candidate', 'unknown', 'valid', 'expired'].includes(status)) {
       return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    if (couponType && !['codigo', 'link_resgate', 'pagina_cupons'].includes(couponType)) {
       return NextResponse.json({ error: 'Tipo de cupom inválido' }, { status: 400 });
    }

    // 4. Executar listagem via serviço
    // O serviço utiliza createAdminClient para bypass de RLS se necessário, 
    // mas o filtro por user_id é injetado programaticamente e obrigatório.
    const supabaseAdmin = createAdminClient();
    const coupons = await shopeeCouponService.listDiscoveredCoupons(user.id, {
      status,
      couponType,
      search,
      limit
    }, supabaseAdmin);

    // 5. Enriquecer com Re-afiliação em tempo real
    // Buscamos a conexão Shopee do usuário para gerar links afiliados customizados
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);
    const shopeeConn = connections.find(c => c.marketplace_name?.toLowerCase() === 'shopee');
    
    const adapter = new ShopeeAdapter();
    
    const enrichedCoupons = await Promise.all(coupons.map(async (coupon) => {
      // Se não houver URL, não há o que re-afiliar
      if (!coupon.redemption_url) {
        return {
          ...coupon,
          effective_redemption_url: null,
          reaffiliation_status: 'not_needed'
        };
      }

      try {
        // Se não houver conexão, retornamos warning mas mantemos o link original como fallback
        // IMPORTANTE: De acordo com a regra 5, mostramos aviso claro na UI.
        if (!shopeeConn) {
          return {
            ...coupon,
            effective_redemption_url: coupon.redemption_url,
            reaffiliation_status: 'warning',
            reaffiliation_warning: 'Conexão Shopee necessária para re-afiliar este cupom.'
          };
        }

        // Processar link via adaptador (Canonicalize + Affiliate)
        const result = await adapter.preProcessIncomingLink(coupon.redemption_url, shopeeConn);
        
        return {
          ...coupon,
          effective_redemption_url: result.generated_affiliate_url || result.canonical_url || coupon.redemption_url,
          reaffiliation_status: result.reaffiliation_status,
          reaffiliation_warning: result.reaffiliation_error
        };
      } catch (err: any) {
        console.error(`[API-DISCOVERED-COUPONS] Erro ao re-afiliar cupom ${coupon.id}:`, err.message);
        return {
          ...coupon,
          effective_redemption_url: coupon.redemption_url,
          reaffiliation_status: 'failed',
          reaffiliation_warning: 'Erro técnico ao processar re-afiliação.'
        };
      }
    }));

    // 6. Retornar resposta formatada
    return NextResponse.json({
      status: 'SUCCESS',
      count: enrichedCoupons.length,
      data: enrichedCoupons
    });

  } catch (error: any) {
    console.error('[API-DISCOVERED-COUPONS] Erro crítico:', error.message);
    return NextResponse.json(
      { error: 'Falha interna ao processar listagem de cupons.' }, 
      { status: 500 }
    );
  }
}
