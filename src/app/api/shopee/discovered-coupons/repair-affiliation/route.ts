import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { shopeeCouponPersistenceService } from '@/services/supabase/shopee-coupon-persistence-service';

/**
 * POST /api/shopee/discovered-coupons/repair-affiliation
 * 
 * Busca até 10 cupons do usuário que precisam de reafiliação 
 * e tenta processá-los automaticamente em background.
 */
export async function POST(request: Request) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const adminClient = createAdminClient();

  try {
    // 1. Buscar cupons que precisam de reparo
    // Critérios: block_reason = 'needs_reaffiliation' OU reaffiliation_status != 'reaffiliated'
    // Mas no banco a coluna é reaffiliation_status (se existir) ou verificamos block_reason.
    const { data: coupons, error: fetchError } = await adminClient
      .from('discovered_coupons')
      .select('*')
      .eq('user_id', user.id)
      .eq('marketplace', 'shopee')
      .or('block_reason.eq.needs_reaffiliation,block_reason.eq.needs_reaffiliation_or_review')
      .limit(10);

    if (fetchError) throw fetchError;

    if (!coupons || coupons.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Nenhum cupom pendente de reparo encontrado.',
        repairedCount: 0 
      });
    }

    console.log(`[REPAIR-AFFILIATION] Iniciando reparo para ${coupons.length} cupons...`);

    const results = [];
    for (const coupon of coupons) {
      try {
        const result = await shopeeCouponPersistenceService.saveVerifiedShopeeCouponForUser({
          userId: user.id,
          contentType: coupon.is_verified_coupon ? 'verified_coupon' : 'candidate',
          acceptedTarget: 'coupons',
          couponCode: coupon.code,
          couponType: coupon.coupon_type,
          couponLabel: coupon.coupon_label,
          originalUrl: coupon.source_url || coupon.redemption_url,
          resolvedUrl: coupon.product_url || coupon.redemption_url,
          canonicalUrl: coupon.product_url,
          rawText: coupon.raw_text,
          confidence: coupon.confidence * 100,
          sourceId: coupon.source_id
        }, adminClient);

        results.push({ id: coupon.id, success: true, reaffiliated: result.reaffiliated });
      } catch (err: any) {
        console.error(`[REPAIR-AFFILIATION] Falha ao reparar cupom ${coupon.id}:`, err.message);
        results.push({ id: coupon.id, success: false, error: err.message });
      }
    }

    const repairedCount = results.filter(r => (r as any).reaffiliated).length;

    return NextResponse.json({ 
      success: true, 
      message: `Reparo concluído. ${repairedCount} de ${coupons.length} cupons re-afiliados.`,
      results,
      repairedCount
    });

  } catch (error: any) {
    console.error('[REPAIR-AFFILIATION] Erro crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
