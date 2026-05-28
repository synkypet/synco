import { SupabaseClient } from '@supabase/supabase-js';
import { marketplaceService } from './marketplace-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';

export interface CouponPersistenceInput {
  userId: string;
  contentType: string;
  acceptedTarget: string;
  couponCode?: string;
  couponLabel?: string;
  originalUrl?: string;
  resolvedUrl?: string;
  canonicalUrl?: string;
  rawText?: string;
  confidence?: number;
  sourceId?: string;
  couponType?: 'codigo' | 'link_resgate' | 'pagina_cupons' | 'pagina_oferta' | 'monetary_discount';
  metadata?: any;
}

/**
 * Serviço centralizado para persistência de cupons Shopee.
 * Garante que TODO cupom verificado passe pela tentativa de afiliação antes de ser salvo.
 */
export const shopeeCouponPersistenceService = {
  
  /**
   * Salva um cupom já classificado, tentando afiliar o link para o usuário.
   */
  async saveVerifiedShopeeCouponForUser(
    input: CouponPersistenceInput,
    supabase: SupabaseClient
  ) {
    const { 
      userId, 
      contentType, 
      acceptedTarget, 
      couponCode, 
      couponLabel,
      originalUrl, 
      resolvedUrl, 
      canonicalUrl,
      rawText,
      confidence,
      sourceId
    } = input;

    if (acceptedTarget !== 'coupons') {
      throw new Error(`Target ${acceptedTarget} não suportado por este serviço.`);
    }

    const rawCouponType = input.couponType || (couponCode ? 'codigo' : 'link_resgate');
    const dbCouponType = (rawCouponType === 'pagina_oferta' || rawCouponType === 'monetary_discount') ? 'link_resgate' : rawCouponType;
    const dedupeValue = couponCode || resolvedUrl || originalUrl;
    const dedupeKey = `shopee:coupon:${dbCouponType === 'codigo' ? 'code' : 'url'}:${dedupeValue?.toString().trim().toUpperCase()}`;
    
    console.log(`[PERSISTENCE-SERVICE] Iniciando processamento para: ${couponCode || 'link'} (${dbCouponType})`);

    // 1. Buscar conexões Shopee do usuário (para credenciais)
    const connections = await marketplaceService.getEnrichedConnections(userId, supabase);
    const shopeeConn = connections.find(c => c.marketplace_name?.toLowerCase() === 'shopee');

    let finalRedemptionUrl = resolvedUrl || originalUrl || '';
    let reaffiliationStatus: 'not_needed' | 'resolved' | 'canonicalized' | 'reaffiliated' | 'blocked' | 'failed' | 'warning' | 'skipped' = 'failed';

    const isCodeOnly = dbCouponType === 'codigo' && couponCode && !finalRedemptionUrl;

    if (isCodeOnly) {
      console.log(`[SHOPEE-COUPON-SERVICE] code_without_redemption_url=true code=${couponCode} affiliate_skipped=true`);
      reaffiliationStatus = 'skipped';
    } else if (shopeeConn?.shopee_app_secret) {
      try {
        const adapter = new ShopeeAdapter();
        const affiliateUrl = await adapter.generateAffiliateLink(finalRedemptionUrl, {
          shopee_app_id: shopeeConn.shopee_app_id,
          shopee_app_secret: shopeeConn.shopee_app_secret
        } as any);

        if (affiliateUrl && affiliateUrl !== finalRedemptionUrl) {
          finalRedemptionUrl = affiliateUrl;
          reaffiliationStatus = 'reaffiliated';
          console.log(`[PERSISTENCE-SERVICE] Afiliação concluída: ${finalRedemptionUrl}`);
        } else {
          console.warn(`[PERSISTENCE-SERVICE] Afiliação retornou o mesmo link ou vazio.`);
        }
      } catch (affError: any) {
        console.error(`[PERSISTENCE-SERVICE] Erro na geração de link afiliado:`, affError.message);
        // Não jogamos erro aqui se for captura automática, mas marcamos como falha
        reaffiliationStatus = 'failed';
      }
    } else {
      console.warn(`[PERSISTENCE-SERVICE] Credenciais Shopee não encontradas para o usuário ${userId}.`);
      reaffiliationStatus = 'failed';
    }

    // 2. Persistir no banco
    const basePayload = {
      user_id: userId,
      source_id: sourceId || null,
      marketplace: 'shopee',
      offer_type: 'coupon_offer', // Rigoroso: CHECK (offer_type = 'coupon_offer')
      coupon_type: dbCouponType, // Rigoroso: CHECK (coupon_type IN ('codigo', 'link_resgate', 'pagina_cupons'))
      code: couponCode || null,
      coupon_label: couponLabel || (couponCode ? `Cupom manual: ${couponCode}` : 'Link de resgate manual'),
      redemption_url: finalRedemptionUrl,
      source_url: originalUrl || null,
      product_url: canonicalUrl || resolvedUrl || null,
      raw_text: rawText?.substring(0, 500) || '',
      confidence: (confidence || 0) / 100,
      status: reaffiliationStatus === 'reaffiliated' ? 'valid' : 'candidate', // CHECK (status IN ('candidate', 'unknown', 'valid', 'expired'))
      dedupe_key: dedupeKey,
      
      // TRAVAS DE SEGURANÇA (OBRIGATÓRIAS PELA CONSTRAINT DB)
      dispatchable: false,
      auto_dispatch_blocked: true,
      block_reason: 'coupon_requires_manual_review_or_phase_2c_dispatch', // Rigoroso: CHECK (block_reason = 'coupon_requires_manual_review_or_phase_2c_dispatch')
      
      capture_count: 1,
      captured_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };

    const dbStatusMap: Record<string, string> = {
      'verified_coupon': 'verified',
      'candidate': 'candidate',
      'rejected': 'rejected',
      'product_link': 'product_link'
    };
    const validationStatus = dbStatusMap[contentType] || 'candidate';

    const { data: saved, error } = await supabase
      .from('discovered_coupons')
      .upsert({
        ...basePayload,
        validation_status: validationStatus,
        is_verified_coupon: contentType === 'verified_coupon',
        resolved_at: new Date().toISOString()
      }, { onConflict: 'user_id,dedupe_key' })
      .select('id')
      .single();

    if (error) {
      // Fallback para se a migration de validation_status não existir
      if (error.code === '42703') {
         const { data: savedFallback, error: errorFallback } = await supabase
          .from('discovered_coupons')
          .upsert(basePayload, { onConflict: 'user_id,dedupe_key' })
          .select('id')
          .single();
         
         if (errorFallback) throw errorFallback;
         if (isCodeOnly) {
           return {
             id: savedFallback?.id,
             code: couponCode,
             couponLabel: couponLabel || null,
             redemptionUrl: null,
             affiliateUrl: null,
             skippedAffiliate: true,
             reason: 'code_without_redemption_url'
           };
         }
         return { id: savedFallback?.id, reaffiliated: reaffiliationStatus === 'reaffiliated', redemptionUrl: finalRedemptionUrl };
      }
      throw error;
    }

    if (isCodeOnly) {
      return {
        id: saved?.id,
        code: couponCode,
        couponLabel: couponLabel || null,
        redemptionUrl: null,
        affiliateUrl: null,
        skippedAffiliate: true,
        reason: 'code_without_redemption_url'
      };
    }

    return { id: saved?.id, reaffiliated: reaffiliationStatus === 'reaffiliated', redemptionUrl: finalRedemptionUrl };
  }
};
