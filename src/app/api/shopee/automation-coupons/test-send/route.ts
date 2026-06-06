import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperationalAccess, requireSendLimit } from '@/lib/access/require-operational-access';
import { campaignService } from '@/services/supabase/campaign-service';
import { normalizeShopeeCouponForMessage } from '@/lib/marketplaces/shopee/coupon-extractor';
import { renderSmartTemplate, DEFAULT_TEMPLATES } from '@/lib/templates/universal-template-engine';

export async function POST(req: Request) {
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;

    const { user, access } = gate;
    const userId = user.id;

    const body = await req.json();
    const { groupId, template_config } = body;

    if (!groupId) {
      return NextResponse.json({ error: 'Grupo alvo (groupId) é obrigatório' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Validar limite de envio (1 envio, 1 destino)
    const limitError = await requireSendLimit(userId, 1, access.quotas);
    if (limitError) return limitError;

    // 2. Buscar 1 cupom real recente
    const { data: coupons, error: couponErr } = await supabase
      .from('discovered_coupons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (couponErr || !coupons || coupons.length === 0) {
      return NextResponse.json({ error: 'Nenhum cupom ativo encontrado no sistema para simular o teste.' }, { status: 404 });
    }

    const coupon = coupons[0];
    const norm = normalizeShopeeCouponForMessage(coupon);
    
    // Sem reafiliação complexa no teste rápido, apenas usa o link direto do resgate ou fake
    const testAffiliateLink = coupon.redemption_url || 'https://shopee.com.br/teste';

    // 3. Preparar o contexto de template (simulando capturado-coupon-dispatcher)
    const couponContext = {
      product_name: norm.discountLine.replace(/^💸\s*/, '') || 'Cupom Shopee',
      affiliate_link: testAffiliateLink,
      coupon_code: norm.code,
      coupon_code_line: norm.code ? `🎟️ *Código:* ${norm.code}` : '',
      coupon_discount_line: norm.discountLine,
      coupon_link: testAffiliateLink,
      coupon_link_line: testAffiliateLink ? `🔗 *Resgate aqui:*\n${testAffiliateLink}` : '',
      smart_price_block: '',
      original_price_line: '',
      current_price_line: '',
      coupon_block: '',
      disclaimer: '',
      marketplace: 'Shopee',
      offer_type: 'coupon_offer' as any
    };

    const templateBody = template_config?.body || DEFAULT_TEMPLATES.shopee_coupon;
    const messageText = renderSmartTemplate(templateBody, couponContext as any);

    if (!messageText) {
      return NextResponse.json({ error: 'O template resultou em uma mensagem vazia.' }, { status: 400 });
    }

    // 4. Montar Payload para o Envio
    const campaignData = {
      name: `TESTE AUTOMAÇÃO DE CUPOM`,
      origin: 'manual' as any,
      destinations: [{
        type: 'group' as const,
        id: groupId
      }],
      metadata: {
        manualCouponSend: true,
        confirmedByUser: true,
        dispatchOrigin: 'quick_send_manual_coupon',
        isTestSend: true
      },
      items: [{
        product_name: norm.code ? `[TESTE] Cupom ${norm.code}` : '[TESTE] Cupom Shopee',
        custom_text: messageText,
        image_url: template_config?.media_url || null,
        affiliate_url: testAffiliateLink,
        offer_type: 'coupon_offer' as const,
        eligibility_status: 'eligible' as const,
        eligibility_reasons: []
      }]
    };

    // 5. Despachar via Quick Send
    const campaign = await campaignService.createQuickSendCampaign(userId, campaignData, supabase);

    return NextResponse.json(campaign);
  } catch (error: any) {
    console.error('[COUPON-TEST-SEND-API] Erro no teste de envio:', error.message);
    return NextResponse.json(
      { error: 'internal_error', message: error.message || 'Erro interno no teste de envio' }, 
      { status: 500 }
    );
  }
}
