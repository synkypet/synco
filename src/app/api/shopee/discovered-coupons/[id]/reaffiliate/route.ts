import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';

/**
 * POST /api/shopee/discovered-coupons/[id]/reaffiliate
 * Tenta gerar um link afiliado para um cupom já existente.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const adminClient = createAdminClient();
  const { id } = params;

  try {
    // 1. Buscar o cupom
    const { data: coupon, error: fetchError } = await adminClient
      .from('discovered_coupons')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !coupon) {
      return NextResponse.json({ error: 'Cupom não encontrado.' }, { status: 404 });
    }

    // 2. Buscar credenciais Shopee
    const connections = await marketplaceService.getEnrichedConnections(user.id, adminClient);
    const shopeeConn = connections.find(c => c.marketplace_name?.toLowerCase() === 'shopee');

    if (!shopeeConn?.shopee_app_secret) {
      return NextResponse.json({ error: 'Credenciais Shopee não configuradas.' }, { status: 400 });
    }

    // 3. Tentar afiliar
    const targetUrl = coupon.product_url || coupon.source_url || coupon.redemption_url;
    if (!targetUrl) {
      return NextResponse.json({ error: 'URL alvo não disponível para afiliação.' }, { status: 400 });
    }

    const adapter = new ShopeeAdapter();
    const affiliateUrl = await adapter.generateAffiliateLink(targetUrl, {
      shopee_app_id: shopeeConn.shopee_app_id,
      shopee_app_secret: shopeeConn.shopee_app_secret
    } as any);

    if (!affiliateUrl || affiliateUrl === targetUrl) {
      return NextResponse.json({ error: 'Não foi possível gerar um novo link afiliado.' }, { status: 500 });
    }

    // 4. Atualizar o cupom
    const { error: updateError } = await adminClient
      .from('discovered_coupons')
      .update({
        redemption_url: affiliateUrl,
        status: 'valid',
        block_reason: 'coupon_requires_manual_review_or_phase_2c_dispatch',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true, 
      redemption_url: affiliateUrl,
      message: 'Cupom re-afiliado com sucesso.' 
    });

  } catch (error: any) {
    console.error('[REAFFILIATE-COUPON] Erro crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
