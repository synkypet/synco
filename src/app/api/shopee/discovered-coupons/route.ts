import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyShopeeCapturedContent } from '@/lib/coupon-classifier';
import { isShopeeAffiliateUrl } from '@/lib/marketplaces/shopee/coupon-extractor';

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
    const validationStatus = searchParams.get('validation_status') || undefined;
    const isVerified = searchParams.get('is_verified') === 'true' ? true : 
                       searchParams.get('is_verified') === 'false' ? false : undefined;
    const couponType = searchParams.get('coupon_type') || undefined;
    const search = searchParams.get('search') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;
    
    // FILTRAGEM RÍGIDA: Se não pedir explicitamente tudo, filtramos apenas verificados
    const onlyVerified = searchParams.get('onlyVerified') === '1' || !searchParams.get('is_verified');
    const effectiveIsVerified = isVerified !== undefined ? isVerified : (onlyVerified ? true : undefined);

    // 3. Validações de domínio para os parâmetros
    if (status && !['candidate', 'unknown', 'valid', 'expired'].includes(status)) {
       return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    if (couponType && !['codigo', 'link_resgate', 'pagina_cupons'].includes(couponType)) {
       return NextResponse.json({ error: 'Tipo de cupom inválido' }, { status: 400 });
    }

    // 4. Executar listagem via serviço
    const supabaseAdmin = createAdminClient();
    let coupons = [];
    try {
      coupons = await shopeeCouponService.listDiscoveredCoupons(user.id, {
        status,
        validationStatus,
        isVerified: effectiveIsVerified,
        couponType,
        search,
        limit
      }, supabaseAdmin);
    } catch (err: any) {
      if (err.code === '42703') {
        console.warn('[API-DISCOVERED-COUPONS] Colunas de validação ausentes. Fallback para listagem simplificada.');
        coupons = await shopeeCouponService.listDiscoveredCoupons(user.id, {
          status,
          couponType,
          search,
          limit
        }, supabaseAdmin);
      } else {
        throw err;
      }
    }

    // 5. Enriquecimento com Classificação Local (Layer 1 - Modo Debug/Auditoria)
    // NOTA: Esta API agora é READ-ONLY. Não resolvemos links nem chamamos a Shopee aqui.
    const isDev = process.env.NODE_ENV === 'development';
    const isDebug = searchParams.get('debug') === '1';

    let verifiedCount = 0;
    let productCount = 0;
    let linkCount = 0;
    let candidateCount = 0;
    let landingCount = 0;
    let rejectedCount = 0;
    let unknownCount = 0;
    let missingLinkCount = 0;

    const classifiedCoupons = coupons.map(coupon => {
       // --- VALIDAÇÃO DA REGRA DE PRIORIDADE (PRODUTO/CUPOM PERSISTIDO) (Fase 2H.2) ---
       const isPersistedCouponOffer = coupon.offer_type === 'coupon_offer';
       const hasPersistedCouponType = ['codigo', 'link_resgate', 'pagina_cupons'].includes(coupon.coupon_type);
       const isPersistedVerified = coupon.is_verified_coupon === true || coupon.validation_status === 'verified';
       
       let result: {
         content_type: 'verified_coupon' | 'product_offer' | 'product_link' | 'promo_landing' | 'unknown' | 'rejected' | 'candidate';
         confidence: number;
         reasons: string[];
         coupon_code?: string | null;
         redemption_url?: string | null;
         has_valid_link: boolean;
       };
       let decisionReason = '';

       if (isPersistedCouponOffer && hasPersistedCouponType && isPersistedVerified) {
         const hasLink = !!coupon.redemption_url;
         
         if (coupon.coupon_type === 'codigo') {
           const hasValidCode = !!coupon.code && coupon.code.trim().length > 0;
           if (hasValidCode) {
             result = {
               content_type: 'verified_coupon',
               confidence: 100,
               reasons: ['Respeitado schema persistido: Cupom de Código verificado.'],
               coupon_code: coupon.code,
               redemption_url: coupon.redemption_url,
               has_valid_link: hasLink
             };
             decisionReason = 'Cupom de código verificado persistido no banco.';
           } else {
             // Fallback
             const heuristic = classifyShopeeCapturedContent({
               text: coupon.raw_text || '',
               title: coupon.coupon_label || undefined,
               code: coupon.code || undefined,
               redemption_url: coupon.redemption_url || undefined,
               price: coupon.price
             });
             result = {
               content_type: heuristic.content_type,
               confidence: heuristic.confidence,
               reasons: [...heuristic.reasons, 'Código ausente no cupom persistido. Rodando heurística.'],
               coupon_code: heuristic.coupon_code,
               redemption_url: heuristic.redemption_url,
               has_valid_link: heuristic.has_valid_link
             };
             decisionReason = 'Registro de código inválido/ausente. Aplicada heurística.';
           }
         } else if (coupon.coupon_type === 'link_resgate' || coupon.coupon_type === 'pagina_cupons') {
           if (hasLink) {
             result = {
               content_type: 'verified_coupon',
               confidence: 100,
               reasons: [`Respeitado schema persistido: Cupom de ${coupon.coupon_type} verificado.`],
               coupon_code: coupon.code || null,
               redemption_url: coupon.redemption_url,
               has_valid_link: true
             };
             decisionReason = `Cupom de ${coupon.coupon_type} verificado persistido no banco com link válido.`;
           } else {
             result = {
               content_type: 'rejected',
               confidence: 100,
               reasons: ['Cupom persistido sem link de resgate válido.'],
               coupon_code: coupon.code || null,
               redemption_url: null,
               has_valid_link: false
             };
             decisionReason = 'Link de resgate ausente no registro persistido.';
           }
         } else {
           const heuristic = classifyShopeeCapturedContent({
             text: coupon.raw_text || '',
             title: coupon.coupon_label || undefined,
             code: coupon.code || undefined,
             redemption_url: coupon.redemption_url || undefined,
             price: coupon.price
           });
           result = {
             content_type: heuristic.content_type,
             confidence: heuristic.confidence,
             reasons: heuristic.reasons,
             coupon_code: heuristic.coupon_code,
             redemption_url: heuristic.redemption_url,
             has_valid_link: heuristic.has_valid_link
           };
           decisionReason = 'Tipo persistido não catalogado. Aplicada heurística.';
         }
       } else {
         const heuristic = classifyShopeeCapturedContent({
           text: coupon.raw_text || '',
           title: coupon.coupon_label || undefined,
           code: coupon.code || undefined,
           redemption_url: coupon.redemption_url || undefined,
           price: coupon.price
         });
         result = {
           content_type: heuristic.content_type,
           confidence: heuristic.confidence,
           reasons: heuristic.reasons,
           coupon_code: heuristic.coupon_code,
           redemption_url: heuristic.redemption_url,
           has_valid_link: heuristic.has_valid_link
         };
         decisionReason = 'Registro sem metadados verificados persistidos. Aplicada heurística.';
       }

       const wouldShowAsCoupon = result.content_type === 'verified_coupon' && result.has_valid_link;

       // Coleta de estatísticas para o resumo
       if (result.content_type === 'verified_coupon') verifiedCount++;
       else if (result.content_type === 'product_offer') productCount++;
       else if (result.content_type === 'product_link') linkCount++;
       else if (result.content_type === 'candidate') candidateCount++;
       else if (result.content_type === 'promo_landing') landingCount++;
       else if (result.content_type === 'rejected') rejectedCount++;
       else unknownCount++;

       if (!result.has_valid_link) missingLinkCount++;

       // Log de auditoria detalhado (apenas em dev + debug=1)
       if (isDev && isDebug) {
         console.log(`\n[COUPON-DEBUG] item`);
         console.log(`id: ${coupon.id}`);
         console.log(`coupon_type persistido: ${coupon.coupon_type || 'none'}`);
         console.log(`offer_type persistido: ${coupon.offer_type || 'none'}`);
         console.log(`code: ${coupon.code || 'none'}`);
         console.log(`redemption_url existe?: ${!!coupon.redemption_url}`);
         console.log(`source_url: ${coupon.source_url || 'none'}`);
         console.log(`product_url: ${coupon.product_url || 'none'}`);
         console.log(`validation_status: ${coupon.validation_status || 'none'}`);
         console.log(`is_verified_coupon: ${coupon.is_verified_coupon}`);
         console.log(`classification calculada: ${result.content_type}`);
         console.log(`wouldShowAsCoupon final: ${wouldShowAsCoupon}`);
         console.log(`motivo da decisão: ${decisionReason}`);
         console.log(`reasons:`);
         result.reasons.forEach(r => console.log(`- ${r}`));
       }
       
        // Lógica de Re-afiliação Centralizada
        const isAffiliated = isShopeeAffiliateUrl(coupon.redemption_url || '');

        return {
          ...coupon,
          effective_redemption_url: coupon.redemption_url,
          reaffiliation_status: isAffiliated ? 'reaffiliated' : 'failed',
         classification: result.content_type,
         classification_reasons: result.reasons,
         classification_confidence: result.confidence,
         has_valid_link: result.has_valid_link,
         would_show_as_coupon: wouldShowAsCoupon
       };
    });

    // Log de Resumo Final
    if (isDev && isDebug) {
      console.log(`\n[COUPON-DEBUG] summary`);
      console.log(`total: ${classifiedCoupons.length}`);
      console.log(`verified_coupon: ${verifiedCount}`);
      console.log(`product_offer: ${productCount}`);
      console.log(`product_link: ${linkCount}`);
      console.log(`candidate: ${candidateCount}`);
      console.log(`promo_landing: ${landingCount}`);
      console.log(`rejected: ${rejectedCount}`);
      console.log(`unknown: ${unknownCount}`);
      console.log(`missing_link: ${missingLinkCount}`);
      console.log(`\n----------------------------------`);
    }

    // 5.1 Filtragem Opcional (Modo "Apenas Verificados")
    const finalData = onlyVerified 
      ? classifiedCoupons.filter(c => c.would_show_as_coupon)
      : classifiedCoupons;

    // 6. Retornar resposta formatada
    return NextResponse.json({
      status: 'SUCCESS',
      count: finalData.length,
      originalCount: classifiedCoupons.length,
      data: finalData
    });

  } catch (error: any) {
    console.error('[API-DISCOVERED-COUPONS] Erro crítico:', error.message);
    return NextResponse.json(
      { error: 'Falha interna ao processar listagem de cupons.' }, 
      { status: 500 }
    );
  }
}
