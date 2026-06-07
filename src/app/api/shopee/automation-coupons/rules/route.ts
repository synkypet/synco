import { NextResponse } from 'next/server';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';
import { automationService } from '@/services/supabase/automation-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';
import { classifyShopeeCapturedContent } from '@/lib/coupon-classifier';
import { isShopeeAffiliateUrl } from '@/lib/marketplaces/shopee/coupon-extractor';
import { shopeePromoPageService } from '@/services/supabase/shopee-promo-page-service';

export async function GET(request: Request) {
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const routeId = searchParams.get('routeId');

    if (!sourceId || !routeId) {
      return NextResponse.json({ rules: [], available_coupons: [], available_promo_pages: [], route: null, error: 'Parâmetros ausentes' });
    }

    const supabaseAdmin = createAdminClient();
    
    // 1. Regras atuais da automação (Selecionados)
    let rules: any[] = [];
    try {
      rules = await automationService.getCouponRules(sourceId, routeId, supabaseAdmin);
    } catch (ruleErr: any) {
      console.error('[GET-RULES-ERROR]', ruleErr);
      return NextResponse.json(
        { error: 'Erro ao buscar regras de cupom no banco de dados. Contate o suporte.', details: String(ruleErr) }, 
        { status: 500 }
      );
    }
    
    // 2. Dados da Rota
    const { data: routeData, error: routeError } = await supabaseAdmin
      .from('automation_routes')
      .select('coupon_interval_minutes, coupon_next_run_at, coupon_last_run_at, template_config')
      .eq('id', routeId)
      .single();

    if (routeError && routeError.code !== 'PGRST116') {
      console.error('[GET-ROUTE-ERROR]', routeError);
      return NextResponse.json(
        { error: 'Erro interno ao consultar dados da rota.', details: routeError }, 
        { status: 500 }
      );
    }

    // 3. Buscar Cupons Disponíveis (Idêntico ao Radar)
    let rawCoupons = [];
    try {
      rawCoupons = await shopeeCouponService.listDiscoveredCoupons(user.id, {
        isVerified: true,
        limit: 50
      }, supabaseAdmin);
    } catch (err: any) {
      if (err.code === '42703') {
        rawCoupons = await shopeeCouponService.listDiscoveredCoupons(user.id, {
          limit: 50
        }, supabaseAdmin);
      }
    }

    const classifiedCoupons = rawCoupons.map(coupon => {
       const isPersistedCouponOffer = coupon.offer_type === 'coupon_offer';
       const hasPersistedCouponType = ['codigo', 'link_resgate', 'pagina_cupons'].includes(coupon.coupon_type);
       const isPersistedVerified = coupon.is_verified_coupon === true || coupon.validation_status === 'verified';
       
       let result;
       if (isPersistedCouponOffer && hasPersistedCouponType && isPersistedVerified) {
         const hasLink = !!coupon.redemption_url;
         if (coupon.coupon_type === 'codigo') {
           const hasValidCode = !!coupon.code && coupon.code.trim().length > 0;
           if (hasValidCode) {
             result = { content_type: 'verified_coupon', has_valid_link: hasLink };
           } else {
             result = classifyShopeeCapturedContent({
               text: coupon.raw_text || '', title: coupon.coupon_label || undefined, code: coupon.code || undefined, redemption_url: coupon.redemption_url || undefined, price: coupon.price
             });
           }
         } else if (coupon.coupon_type === 'link_resgate' || coupon.coupon_type === 'pagina_cupons') {
           if (hasLink) {
             result = { content_type: 'verified_coupon', has_valid_link: true };
           } else {
             result = { content_type: 'rejected', has_valid_link: false };
           }
         } else {
           result = classifyShopeeCapturedContent({ text: coupon.raw_text || '', title: coupon.coupon_label || undefined, code: coupon.code || undefined, redemption_url: coupon.redemption_url || undefined, price: coupon.price });
         }
       } else {
         result = classifyShopeeCapturedContent({ text: coupon.raw_text || '', title: coupon.coupon_label || undefined, code: coupon.code || undefined, redemption_url: coupon.redemption_url || undefined, price: coupon.price });
       }

       const wouldShowAsCoupon = result.content_type === 'verified_coupon' && result.has_valid_link;
       const isAffiliated = isShopeeAffiliateUrl(coupon.redemption_url || '');

       return {
         ...coupon,
         effective_redemption_url: coupon.redemption_url,
         reaffiliation_status: isAffiliated ? 'reaffiliated' : 'failed',
         classification: result.content_type,
         has_valid_link: result.has_valid_link,
         would_show_as_coupon: wouldShowAsCoupon
       };
    });

    const finalCoupons = classifiedCoupons.filter(c => c.would_show_as_coupon);

    // 4. Buscar Promo Pages Disponíveis (Idêntico ao Radar)
    let rawPages: any[] = [];
    try {
      rawPages = await shopeePromoPageService.listDiscoveredPromoPages(user.id, { limit: 50 }, supabaseAdmin);
    } catch(e) {}
    
    const enrichedPages = rawPages.map(page => ({
      ...page,
      effective_redemption_url: page.canonical_url || page.raw_url,
      reaffiliation_status: 'not_needed'
    }));

    return NextResponse.json({ 
      rules: rules || [], 
      available_coupons: finalCoupons,
      available_promo_pages: enrichedPages,
      route: routeData || null 
    });
  } catch (error: any) {
    console.error('GET /api/shopee/automation-coupons/rules ERROR:', error);
    return NextResponse.json(
      { error: 'Erro não esperado no servidor.', details: String(error) }, 
      { status: 500 }
    );
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
      // Sincronização não é mais necessária, a interface usa available_coupons via GET.
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

    if (action === 'bulk_delete') {
      const { ids } = payload;
      if (!ids || !Array.isArray(ids)) {
        return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
      }
      
      const { error } = await supabaseAdmin
        .from('automation_coupon_rules')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id); // Segurança

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'update_route') {
      const { routeId, updates } = payload;
      
      if (updates && typeof updates.coupon_interval_minutes === 'number') {
        if (updates.coupon_interval_minutes < 5) {
          return NextResponse.json(
            { error: 'O intervalo mínimo de envio é de 5 minutos.' },
            { status: 400 }
          );
        }
      }
      
      const { error } = await supabaseAdmin
        .from('automation_routes')
        .update(updates)
        .eq('id', routeId);
        
      if (error) throw error;
      
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
