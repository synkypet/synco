import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { shopeeCouponPersistenceService } from '@/services/supabase/shopee-coupon-persistence-service';

/**
 * POST /api/shopee/discovered-coupons/save
 * 
 * Persistência confirmada pelo usuário para cupons ou páginas promocionais.
 * - Se for cupom: gera link afiliado antes de salvar.
 * - Se for página: salva diretamente.
 * - Implementa deduplicação por user_id + dedupe_key.
 */
export async function POST(request: Request) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const adminClient = createAdminClient();

  try {
    const body = await request.json();
    const { item } = body;

    if (!item) {
      return NextResponse.json({ error: 'Nenhum item fornecido para salvar.' }, { status: 400 });
    }

    const { 
      content_type, 
      accepted_target, 
      coupon_code, 
      original_url, 
      resolved_url, 
      canonical_url,
      rawText,
      confidence
    } = item;

    // ─── Lógica para CUPONS ───────────────────────────────────────────────
    if (accepted_target === 'coupons') {
      const result = await shopeeCouponPersistenceService.saveVerifiedShopeeCouponForUser({
        userId: user.id,
        contentType: content_type,
        acceptedTarget: accepted_target,
        couponCode: coupon_code,
        couponType: item.coupon_type || item.type,
        couponLabel: item.couponLabel || item.label,
        originalUrl: original_url,
        resolvedUrl: resolved_url,
        canonicalUrl: canonical_url,
        rawText: rawText,
        confidence: confidence
      }, adminClient);

      return NextResponse.json({ 
        success: true, 
        id: result.id, 
        reaffiliated: result.reaffiliated 
      });
    }

    // ─── Lógica para PÁGINAS PROMOCIONAIS ─────────────────────────────────
    if (accepted_target === 'promo_pages') {
      const promoUrl = resolved_url || original_url;
      const dedupeKey = `manual:promo:${promoUrl}`;
      
      const { data: saved, error } = await adminClient
        .from('discovered_promo_pages')
        .upsert({
          user_id: user.id,
          marketplace: 'shopee',
          offer_type: 'promo_landing',
          landing_type: 'super_ofertas',
          title: 'Página Promocional Shopee (Confirmada)',
          raw_url: original_url || promoUrl,
          canonical_url: canonical_url || promoUrl,
          source_url: original_url || null,
          raw_text: rawText?.substring(0, 500) || '',
          confidence: (confidence || 0) / 100,
          status: 'candidate',
          dedupe_key: dedupeKey,
          dispatchable: false,
          auto_dispatch_blocked: true,
          block_reason: 'promo_landing_requires_manual_review',
          capture_count: 1,
          captured_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'user_id,dedupe_key' })
        .select('id')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, id: saved?.id });
    }

    return NextResponse.json({ error: 'Tipo de item não suportado para salvamento manual.' }, { status: 400 });

  } catch (error: any) {
    console.error('[SAVE-ENDPOINT] Erro crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
