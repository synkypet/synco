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
    }

    // Default sorting
    query = query.order('opportunity_score', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    return data as Product[];
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
