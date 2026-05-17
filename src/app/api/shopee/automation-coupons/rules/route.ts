import { NextResponse } from 'next/server';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';
import { automationService } from '@/services/supabase/automation-service';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const routeId = searchParams.get('routeId');

    if (!sourceId || !routeId) {
      return NextResponse.json({ error: 'sourceId e routeId são obrigatórios' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const rules = await automationService.getCouponRules(sourceId, routeId, supabaseAdmin);

    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const { action, payload } = await request.json();
    const supabaseAdmin = createAdminClient();

    if (action === 'sync') {
      const { sourceId, routeId } = payload;
      await automationService.syncRulesFromCandidates(sourceId, routeId, user.id, supabaseAdmin);
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const { ruleId, updates } = payload;
      
      if (updates && typeof updates.interval_minutes === 'number') {
        if (updates.interval_minutes < 1) {
          return NextResponse.json(
            { error: 'O intervalo mínimo de envio é de 1 minuto.' },
            { status: 400 }
          );
        }
      }
      
      // Validação básica de ownership (poderia ser mais rigorosa checando a rule antes)
      await automationService.updateCouponRule(ruleId, updates, supabaseAdmin);
      return NextResponse.json({ success: true });
    }

    if (action === 'upsert') {
      const { rule } = payload;
      
      // Se for entrada manual, precisamos primeiro processar o link e garantir que existe em discovered_coupons
      if (rule._manual_input) {
        const { processLinks } = await import('@/lib/linkProcessor');
        const { marketplaceService } = await import('@/services/supabase/marketplace-service');
        
        const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);
        const snapshots = await processLinks([rule._manual_input], connections, 'auto', user.id, supabaseAdmin, rule._manual_input);
        
        if (snapshots.length > 0 && snapshots[0].factual.eligibility.isEligible) {
          const snapshot = snapshots[0];
          const factual = snapshot.factual;
          
          // 1. Garantir que o cupom existe na tabela discovered_coupons
          const mainCoupon = factual.coupons?.[0];
          if (mainCoupon) {
            const { shopeeCouponPersistenceService } = await import('@/services/supabase/shopee-coupon-persistence-service');
            const result = await shopeeCouponPersistenceService.saveVerifiedShopeeCouponForUser({
              userId: user.id,
              contentType: 'verified_coupon',
              acceptedTarget: 'coupons',
              couponCode: mainCoupon.code || undefined,
              couponLabel: mainCoupon.couponLabel || undefined,
              originalUrl: rule._manual_input,
              resolvedUrl: mainCoupon.redemptionUrl || undefined,
              canonicalUrl: factual.canonical_url || undefined,
              rawText: (factual as any).rawText || (factual as any).raw_text,
              sourceId: rule.source_id,
              confidence: mainCoupon.confidence
            }, supabaseAdmin);
            
            rule.coupon_id = result.id;
            rule.item_type = 'coupon';
          } else if (factual.eligibility.offer_type === 'promo_landing') {
            // Tratar promo_landing via service dedicado se existir, ou manter upsert atual por enquanto
            const { data: discPromo, error: discPromoError } = await supabaseAdmin
              .from('discovered_promo_pages')
              .upsert({
                user_id: user.id,
                source_id: rule.source_id,
                marketplace: 'shopee',
                title: factual.title,
                url: factual.canonical_url || rule._manual_input,
                type: factual.landing_type || 'generic',
                status: 'valid',
                last_seen_at: new Date().toISOString(),
                dedupe_key: `shopee:promo:${factual.canonical_url || rule._manual_input}`
              }, { onConflict: 'dedupe_key' })
              .select()
              .single();
            
            if (discPromoError) throw discPromoError;
            rule.promo_page_id = discPromo.id;
            rule.item_type = 'promo_landing';
          }
        }
        delete rule._manual_input;
      }

      const newRule = await automationService.upsertCouponRule({ ...rule, user_id: user.id }, supabaseAdmin);
      return NextResponse.json({ success: true, rule: newRule });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
