import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

export interface DiscoveredPromoPage {
  id: string;
  user_id: string;
  source_id?: string;
  marketplace: string;
  offer_type: string;
  landing_type: string;
  title?: string;
  description?: string;
  raw_url?: string;
  canonical_url?: string;
  source_url?: string;
  raw_text?: string;
  confidence: number;
  status: string;
  dedupe_key: string;
  dispatchable: boolean;
  auto_dispatch_blocked: boolean;
  block_reason: string;
  capture_count: number;
  captured_at: string;
  last_seen_at: string;
  updated_at: string;
}

export const shopeePromoPageService = {
  /**
   * Gera uma chave de deduplicação determinística para uma promo landing Shopee.
   */
  generateDedupeKey(landingType: string, canonicalUrl: string): string {
    if (!canonicalUrl) return `shopee:promo_landing:${landingType}:unknown:${Math.random().toString(36).substring(7)}`;
    
    // Normalização agressiva da URL para deduplicação
    let cleanUrl = canonicalUrl.split('?')[0].split('#')[0].trim().toLowerCase();
    
    // Remover trailing slash
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    return `shopee:promo_landing:${landingType}:${cleanUrl}`;
  },

  /**
   * Persiste uma promo landing candidata no banco de dados com lógica de deduplicação.
   */
  async persistCandidate(
    userId: string, 
    data: { 
      landingType: string;
      title?: string;
      description?: string;
      rawUrl?: string;
      canonicalUrl?: string;
      confidence?: number;
      sourceId?: string; 
      sourceUrl?: string; 
      rawText?: string;
    },
    client?: SupabaseClient
  ): Promise<any> {
    const supabase = client || createClient();
    const dedupeKey = this.generateDedupeKey(data.landingType, data.canonicalUrl || data.rawUrl || '');

    console.log(`[SHOPEE-PROMO-SERVICE] Persistindo promo landing candidate: ${dedupeKey}`);

    try {
      // 1. Tentar Upsert (Incremento de capture_count via query RAW não é suportado pelo Supabase JS facilmente)
      // Usaremos a estratégia: Se o conflito ocorrer, atualizamos last_seen_at e incrementamos capture_count se possível.
      // No Supabase, para incrementar, o ideal é usar um RPC ou fazer em duas etapas se não houver volume massivo.
      
      const payload = {
        user_id: userId,
        source_id: data.sourceId || null,
        marketplace: 'shopee',
        offer_type: 'promo_landing',
        landing_type: data.landingType,
        title: data.title || null,
        description: data.description || null,
        raw_url: data.rawUrl || null,
        canonical_url: data.canonicalUrl || null,
        source_url: data.sourceUrl || null,
        raw_text: data.rawText || null,
        confidence: data.confidence || 0,
        status: 'candidate',
        dedupe_key: dedupeKey,
        
        // FORÇAR TRAVAS DE SEGURANÇA
        dispatchable: false,
        auto_dispatch_blocked: true,
        block_reason: 'promo_landing_requires_manual_review',
        
        last_seen_at: new Date().toISOString()
      };

      // Tentar buscar se já existe para incrementar capture_count
      const { data: existing } = await supabase
        .from('discovered_promo_pages')
        .select('id, capture_count')
        .eq('user_id', userId)
        .eq('dedupe_key', dedupeKey)
        .maybeSingle();

      if (existing) {
        const { data: updated, error: updateError } = await supabase
          .from('discovered_promo_pages')
          .update({
            capture_count: (existing.capture_count || 1) + 1,
            last_seen_at: new Date().toISOString(),
            source_url: data.sourceUrl, // Atualiza para a última fonte vista
            raw_text: data.rawText
          })
          .eq('id', existing.id)
          .select()
          .single();
          
        if (updateError) throw updateError;
        return updated;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('discovered_promo_pages')
          .insert(payload)
          .select()
          .single();
          
        if (insertError) throw insertError;
        return inserted;
      }

    } catch (err) {
      console.error('[SHOPEE-PROMO-SERVICE] Erro crítico na persistência:', err);
      return null;
    }
  },
  
  /**
   * Lista promo landings detectadas pelo radar para um usuário específico.
   */
  async listDiscoveredPromoPages(
    userId: string,
    filters: {
      status?: string;
      landingType?: string;
      limit?: number;
    } = {},
    client?: SupabaseClient
  ): Promise<DiscoveredPromoPage[]> {
    const supabase = client || createClient();
    const { status, landingType, limit = 50 } = filters;

    let query = supabase
      .from('discovered_promo_pages')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (status) {
      query = query.eq('status', status);
    }

    if (landingType) {
      query = query.eq('landing_type', landingType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SHOPEE-PROMO-SERVICE] Erro ao listar promo pages:', error);
      throw error;
    }

    return data || [];
  }
};
