import { createClient } from '@/lib/supabase/client';
import { ShopeeCoupon } from '@/types/shopee-coupon';
import { SupabaseClient } from '@supabase/supabase-js';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { classifyShopeeContentForCoupon } from '@/lib/marketplaces/shopee/coupon-classifier';

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

    // --- VALIDAÇÕES DE INTEGRIDADE (FASE 2C.1.1) ---
    if (!coupon.type) return null;
    
    if (coupon.type === 'codigo' && (!coupon.code || coupon.code.trim().length === 0)) {
      console.warn('[SHOPEE-COUPON-SERVICE] Rejeitado: Cupom do tipo "codigo" sem código alfanumérico.');
      return null;
    }

    if ((coupon.type === 'link_resgate' || coupon.type === 'pagina_cupons') && 
        (!coupon.redemptionUrl || coupon.redemptionUrl.trim().length === 0)) {
      console.warn(`[SHOPEE-COUPON-SERVICE] Rejeitado: Cupom do tipo "${coupon.type}" sem URL de resgate.`);
      return null;
    }

    console.log(`[SHOPEE-COUPON-SERVICE] Persistindo cupom candidate: ${dedupeKey}`);

    try {
      // --- VALIDAÇÃO FACTUAL (RADAR-FACTUAL-V3) ---
      let validationStatus = 'candidate';
      let isVerified = false;
      let resolvedUrl = coupon.redemptionUrl;

      // 1. Resolver Link se necessário para auditoria factual precisa
      if (coupon.redemptionUrl && (coupon.redemptionUrl.includes('s.shopee') || coupon.redemptionUrl.includes('shp.ee'))) {
        try {
          const adapter = new ShopeeAdapter();
          const resolution = await adapter.preProcessIncomingLink(coupon.redemptionUrl);
          if (resolution.canonical_url) {
            resolvedUrl = resolution.canonical_url;
          }
        } catch (err) {
          console.error('[SHOPEE-COUPON-SERVICE] Erro ao resolver link para validação:', err);
        }
      }

      // 2. Classificação Rígida
      const classificationResult = classifyShopeeContentForCoupon(metadata.rawText || '', {
        title: coupon.couponLabel || undefined,
        canonical_url: (resolvedUrl || coupon.redemptionUrl) || undefined
      });

      if (classificationResult.classification === 'verified_coupon') {
        validationStatus = 'verified';
        isVerified = true;
      } else if (classificationResult.classification === 'product_offer' || classificationResult.classification === 'product_with_coupon') {
        validationStatus = 'product_link';
        isVerified = false;
        console.log(`[SHOPEE-COUPON-SERVICE] Classificado como PRODUTO/MISTO (${classificationResult.classification}). Rejeitando como cupom puro.`);
      } else if (classificationResult.classification === 'promo_landing') {
        validationStatus = 'candidate';
        isVerified = false;
      } else if (classificationResult.classification === 'rejected') {
        validationStatus = 'rejected';
        isVerified = false;
      } else {
        validationStatus = 'candidate';
        isVerified = false;
      }

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
        confidence: coupon.confidence || 0,
        status: 'candidate',
        dedupe_key: dedupeKey,
        
        // FORÇAR TRAVAS DE SEGURANÇA (SOBRESCREVE QUALQUER INPUT)
        dispatchable: false,
        auto_dispatch_blocked: true,
        block_reason: 'coupon_requires_manual_review_or_phase_2c_dispatch',
        
        last_seen_at: new Date().toISOString()
      };

      // --- COMPATIBILIDADE (OPÇÃO A) ---
      // Se as colunas de validação existirem, nós as incluímos no payload.
      // Caso contrário, omitimos para evitar quebra em produção antes da migration.
      try {
        const payloadWithValidation = {
          ...payload,
          validation_status: validationStatus,
          is_verified_coupon: isVerified,
          resolved_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('discovered_coupons')
          .upsert(payloadWithValidation, { 
            onConflict: 'user_id, dedupe_key',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (error) {
          // Se o erro for "coluna não existe" (42703), tentamos sem as colunas novas
          if (error.code === '42703') {
            console.warn('[SHOPEE-COUPON-SERVICE] Colunas de validação ausentes. Usando fallback legacy.');
            const { data: legacyData, error: legacyError } = await supabase
              .from('discovered_coupons')
              .upsert(payload, { 
                onConflict: 'user_id, dedupe_key',
                ignoreDuplicates: false 
              })
              .select()
              .single();
            if (legacyError) throw legacyError;
            return legacyData;
          }
          throw error;
        }
        return data;
      } catch (err: any) {
        if (err.code === '42703') {
           // Fallback final se o try falhar antes do erro ser retornado pelo Supabase
           const { data: legacyData } = await supabase
              .from('discovered_coupons')
              .upsert(payload, { onConflict: 'user_id, dedupe_key' })
              .select().single();
           return legacyData;
        }
        throw err;
      }
    } catch (err) {
      console.error('[SHOPEE-COUPON-SERVICE] Erro crítico na persistência:', err);
      return null;
    }
  },
  
  async listDiscoveredCoupons(
    userId: string,
    filters: {
      status?: string;
      validationStatus?: string;
      isVerified?: boolean;
      couponType?: string;
      search?: string;
      limit?: number;
    } = {},
    client?: SupabaseClient
  ): Promise<any[]> {
    const supabase = client || createClient();
    const { status, validationStatus, isVerified, couponType, search, limit = 50 } = filters;

    let query = supabase
      .from('discovered_coupons')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (status) {
      query = query.eq('status', status);
    }

    // Filtros de validação (Protegidos para backward compatibility)
    if (validationStatus) {
      if (validationStatus.includes(',')) {
        query = query.in('validation_status', validationStatus.split(','));
      } else {
        query = query.eq('validation_status', validationStatus);
      }
    }

    if (isVerified !== undefined) {
      query = query.eq('is_verified_coupon', isVerified);
    }

    if (couponType) {
      query = query.eq('coupon_type', couponType);
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,coupon_label.ilike.%${search}%,redemption_url.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SHOPEE-COUPON-SERVICE] Erro ao listar cupons:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Re-verifica todos os cupons candidatos para corrigir classificações errôneas.
   * Utilizado para backfill de dados antigos após a implementação da validação factual.
   */
  async reverifyAllCandidates(
    userId: string, 
    client?: SupabaseClient, 
    options: { dryRun?: boolean } = {}
  ): Promise<{ 
    total: number; 
    verified: number; 
    product_link: number; 
    rejected: number; 
    candidate: number;
    examples: {
      verified: any[];
      product_link: any[];
      rejected: any[];
    }
  }> {
    const supabase = client || createClient();
    const adapter = new ShopeeAdapter();
    const dryRun = options.dryRun ?? false;
    
    // 1. Buscar todos os candidatos do usuário
    // Filtramos em memória para suportar ambientes sem as colunas novas
    const { data: allItems, error: fetchError } = await supabase
      .from('discovered_coupons')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) throw fetchError;

    // 2. Filtrar apenas candidatos (itens sem validação ou com status 'candidate')
    const candidates = (allItems || []).filter((item: any) => {
      return !item.validation_status || item.validation_status === 'candidate';
    });
    
    const stats = {
      total: candidates.length,
      verified: 0,
      product_link: 0,
      rejected: 0,
      candidate: 0,
      examples: {
        verified: [] as any[],
        product_link: [] as any[],
        rejected: [] as any[]
      }
    };

    if (candidates.length === 0) return stats;

    console.log(`[SHOPEE-COUPON-SERVICE] Iniciando re-verificação de ${candidates.length} candidatos (DryRun: ${dryRun})...`);

    for (const c of candidates) {
      try {
        let validationStatus: 'candidate' | 'verified' | 'rejected' | 'product_link' = 'candidate';
        let isVerified = false;
        let resolvedUrl = c.redemption_url;

        // 1. Resolver Link se necessário para auditoria factual precisa
        if (c.redemption_url && (c.redemption_url.includes('s.shopee') || c.redemption_url.includes('shp.ee'))) {
          try {
            const res = await adapter.preProcessIncomingLink(c.redemption_url);
            if (res.canonical_url) {
              resolvedUrl = res.canonical_url;
            }
          } catch (resErr) {
            console.warn(`[SHOPEE-COUPON-SERVICE] Erro ao resolver link ${c.redemption_url}:`, resErr);
          }
        }

        // 2. Classificação Rígida (FASE 2H.1)
        const classificationResult = classifyShopeeContentForCoupon(c.raw_text || '', {
          title: c.coupon_label || undefined,
          canonical_url: (resolvedUrl || c.redemption_url) || undefined
        });

        if (classificationResult.classification === 'verified_coupon') {
          validationStatus = 'verified';
          isVerified = true;
        } else if (classificationResult.classification === 'product_offer' || classificationResult.classification === 'product_with_coupon') {
          validationStatus = 'product_link';
          isVerified = false;
        } else if (classificationResult.classification === 'rejected') {
          validationStatus = 'rejected';
          isVerified = false;
        } else {
          validationStatus = 'candidate';
          isVerified = false;
        }

        // Atualizar estatísticas
        if (validationStatus === 'verified') stats.verified++;
        else if (validationStatus === 'product_link') stats.product_link++;
        else if (validationStatus === 'rejected') stats.rejected++;
        else stats.candidate++;

        // Coletar exemplos
        if (validationStatus !== 'candidate' && stats.examples[validationStatus as keyof typeof stats.examples].length < 3) {
          stats.examples[validationStatus as keyof typeof stats.examples].push({
            id: c.id,
            type: c.coupon_type,
            label: c.coupon_label,
            url: c.redemption_url,
            code: c.code
          });
        }

        // Persistir se não for dryRun
        if (!dryRun && validationStatus !== 'candidate') {
          // Tentamos atualizar com as colunas novas
          try {
            const { error: updateError } = await supabase
              .from('discovered_coupons')
              .update({
                validation_status: validationStatus,
                is_verified_coupon: isVerified,
                resolved_at: new Date().toISOString()
              })
              .eq('id', c.id);
              
            if (updateError && updateError.code === '42703') {
              // Se as colunas não existem, não fazemos nada no backfill real
              console.warn('[SHOPEE-COUPON-SERVICE] Impossível persistir re-verificação: colunas ausentes.');
            }
          } catch (e) {
            // Ignorar erros de coluna ausente no loop
          }
        }

      } catch (err) {
        console.warn(`[SHOPEE-COUPON-SERVICE] Falha ao re-verificar item ${c.id}:`, err);
      }
    }

    return stats;
  },

  /**
   * Rejeita/Remove um ou mais cupons capturados.
   * Não realiza hard delete, apenas marca como 'rejected' e desativa automações.
   */
  async rejectCandidates(userId: string, ids: string[], client?: SupabaseClient): Promise<void> {
    const supabase = client || createClient();
    
    // 1. Marcar como rejeitado na tabela de descobertas
    const { error: updateError } = await supabase
      .from('discovered_coupons')
      .update({ 
        validation_status: 'rejected',
        is_verified_coupon: false,
        resolved_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .in('id', ids);

    if (updateError) {
      // Fallback para caso as colunas de validação não existam ainda (Retrocompatibilidade)
      if (updateError.code === '42703') {
        console.warn('[SHOPEE-COUPON-SERVICE] Colunas de validação ausentes ao rejeitar. Ignorando atualização de status.');
      } else {
        throw updateError;
      }
    }

    // 2. Desativar regras de automação relacionadas para que parem de ser disparadas
    const { error: ruleError } = await supabase
      .from('automation_coupon_rules')
      .update({ 
        is_active: false, 
        is_selected: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .in('coupon_id', ids);

    if (ruleError) {
      console.warn('[SHOPEE-COUPON-SERVICE] Falha ao desativar regras de automação para os itens rejeitados:', ruleError.message);
    }
  }
};
