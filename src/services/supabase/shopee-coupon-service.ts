import { createClient } from '@/lib/supabase/client';
import { ShopeeCoupon } from '@/types/shopee-coupon';
import { SupabaseClient } from '@supabase/supabase-js';

export const shopeeCouponService = {
  /**
   * Gera uma chave de deduplicação determinística para um cupom Shopee.
   */
  generateDedupeKey(coupon: ShopeeCoupon): string {
    if (!coupon) return `shopee:coupon:unknown:${Math.random().toString(36).substring(7)}`;

    if (coupon.type === 'codigo' && coupon.code) {
      return `shopee:coupon:code:${coupon.code.trim().toUpperCase()}`;
    }
    
    // Para links de resgate ou páginas, usamos a URL como identificador
    const url = coupon.redemptionUrl;
    if (url) {
      // Normalização básica: remover query strings se não forem essenciais? 
      // Por enquanto, usamos a URL como fornecida (já que o extractor limpa pontuação)
      return `shopee:coupon:url:${url.trim().toLowerCase()}`;
    }

    // Fallback improvável
    return `shopee:coupon:raw:${Math.random().toString(36).substring(7)}`;
  },

  /**
   * Persiste um cupom candidato no banco de dados com lógica de deduplicação.
   */
  async persistCandidate(
    userId: string, 
    coupon: ShopeeCoupon, 
    metadata: { 
      sourceId?: string; 
      sourceUrl?: string; 
      productUrl?: string; 
      rawText?: string;
    },
    client?: SupabaseClient
  ): Promise<any> {
    const supabase = client || createClient();
    const dedupeKey = this.generateDedupeKey(coupon);

    console.log(`[SHOPEE-COUPON-SERVICE] Persistindo cupom candidate: ${dedupeKey}`);

    try {
      const payload = {
        user_id: userId,
        source_id: metadata.sourceId || null,
        marketplace: 'shopee',
        offer_type: 'coupon_offer',
        coupon_type: coupon.type,
        code: coupon.code || null,
        coupon_label: coupon.couponLabel || null,
        redemption_url: coupon.redemptionUrl || null,
        source_url: metadata.sourceUrl || null,
        product_url: metadata.productUrl || null,
        raw_text: metadata.rawText || null,
        confidence: 1.0,
        status: 'candidate',
        dedupe_key: dedupeKey,
        dispatchable: false,
        auto_dispatch_blocked: true,
        block_reason: 'coupon_requires_manual_review_or_phase_2c_dispatch',
        capture_count: 1,
        last_seen_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('discovered_coupons')
        .upsert(payload, { 
          onConflict: 'user_id, dedupe_key',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        // Se falhar por causa da constraint unique (ignoreDuplicates: false deveria lidar, mas se der erro 23505)
        if (error.code === '23505') {
           // Em caso de conflito, incrementamos o contador manualmente (já que upsert do Supabase não suporta SET count = count + 1 nativamente sem RPC)
           // Mas podemos tentar uma atualização simples se o upsert falhar
           console.log(`[SHOPEE-COUPON-SERVICE] Cupom já existente. Atualizando last_seen_at.`);
           await supabase
             .from('discovered_coupons')
             .update({ 
               last_seen_at: new Date().toISOString(),
               // Incremento simulado via RPC ou apenas atualização de campos se vazios
               source_url: metadata.sourceUrl,
               product_url: metadata.productUrl
             })
             .match({ user_id: userId, dedupe_key: dedupeKey });
           return null;
        }
        console.error('[SHOPEE-COUPON-SERVICE] Erro ao persistir cupom:', error);
        throw error;
      }

      // Se inseriu/atualizou com sucesso, incrementar contador (opcional: o count real pode exigir uma função no Postgres)
      // Para o MVP, o upsert resolve a maioria dos campos.
      
      return data;
    } catch (err) {
      console.error('[SHOPEE-COUPON-SERVICE] Erro crítico na persistência:', err);
      return null;
    }
  }
};
