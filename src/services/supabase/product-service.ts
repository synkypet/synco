// src/services/supabase/product-service.ts
import { createClient } from '@/lib/supabase/client';
import { Product, ProductFilter } from '@/types/product';



export const productService = {
  async list(filters?: ProductFilter): Promise<Product[]> {
    const supabase = createClient();
    let query = supabase.from('products').select('*');

    if (filters) {
      if (filters.marketplace && filters.marketplace !== 'Todos') {
        query = query.eq('marketplace', filters.marketplace);
      }
      if (filters.category && filters.category !== 'Todas') {
        query = query.eq('category', filters.category);
      }
      if (filters.minPrice) {
        query = query.gte('current_price', filters.minPrice);
      }
      if (filters.maxPrice) {
        query = query.lte('current_price', filters.maxPrice);
      }
      if (filters.minDiscount) {
        query = query.gte('discount_percent', filters.minDiscount);
      }
      if (filters.minCommission) {
        query = query.gte('commission_percent', filters.minCommission);
      }
      if (filters.minScore) {
        query = query.gte('opportunity_score', filters.minScore);
      }
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      if (filters.has_coupon) {
        query = query.not('coupon', 'is', null);
      }
      if (filters.free_shipping) {
        query = query.eq('free_shipping', true);
      }
      if (filters.official_store) {
        query = query.eq('official_store', true);
      }
      if (filters.favorites_only) {
        query = query.eq('is_favorite', true);
      }
      /* 
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.exclude_dead) {
        query = query.neq('status', 'dead');
      }
      */
    }

    // Dynamic sorting
    if (filters?.sortBy) {
      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });
    } else {
      query = query.order('opportunity_score', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    return data as Product[];
  },

  /**
   * Calcula o score de oportunidade baseado em ROI e Desconto Real.
   * ROI = (Comissão / Preço) * 100
   * Bias = Log10(Original / Atual)
   */
  calculateOpportunityScore(price: number, originalPrice: number | null, commissionValue: number): number {
    const currentPrice = price || 0.01;
    const roi = (commissionValue / currentPrice) * 100;
    
    // Fator de escala baseado no desconto
    const discountRatio = (originalPrice && originalPrice > currentPrice) ? originalPrice / currentPrice : 1;
    const scaleBias = Math.log10(discountRatio * 10) || 1;
    
    // Requisito: Base 40 + ROI amplificado pelo viés de desconto
    const rawScore = 40 + (roi * scaleBias * 5);
    return Math.min(100, Math.round(rawScore));
  },

  /**
   * Insere ou atualiza um produto vindo de automação.
   * Diferente do insert normal, este garante que retornamos o produto mesmo que ele já exista.
   */
  async upsertFromAutomation(productData: Partial<Product>, client?: any): Promise<Product | null> {
    const supabase = client || createClient();
    
    if (!productData.original_url) return null;

    // 1. Verificar se já existe por URL
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('original_url', productData.original_url)
      .maybeSingle();

    if (existing) {
      // Opcional: Atualizar preço/comissão se mudou
      const { data: updated } = await supabase
        .from('products')
        .update({
          current_price: productData.current_price,
          commission_value: productData.commission_value,
          commission_percent: productData.commission_percent,
          opportunity_score: productData.opportunity_score,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      return updated as Product;
    }

    // 2. Inserir novo
    const { data: inserted, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      console.error('Error inserting product from automation:', error);
      return null;
    }

    return inserted as Product;
  },

  async getById(id: string): Promise<Product | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching product by id:', error);
      return null;
    }

    return data as Product;
  },

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('products')
      .update({ is_favorite: isFavorite })
      .eq('id', id);

    if (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }
};
