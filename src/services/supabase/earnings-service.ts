// src/services/supabase/earnings-service.ts

import { createClient } from '@/lib/supabase/client';
import { ImportBatch, ShopeeOrder } from '@/types/earnings';
import { SupabaseClient } from '@supabase/supabase-js';

export const earningsService = {
  /**
   * Inicia um novo lote de importação
   */
  async createBatch(batch: Partial<ImportBatch>, client?: SupabaseClient): Promise<ImportBatch> {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('import_batches')
      .insert(batch)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Salva os pedidos importados em massa (UPSERT)
   */
  async upsertOrders(batchId: string, orders: any[], client?: SupabaseClient) {
    const supabase = client || createClient();
    
    // Normalizar para o schema do banco
    const cleanedOrders = orders.map(o => ({
      user_id: o.user_id,
      batch_id: batchId,
      external_id: o.external_id,
      source_item_id: o.source_item_id || null,
      source_row_fingerprint: o.source_row_fingerprint,
      order_id: o.order_id,
      product_id: o.product_id || null,
      product_name: o.product_name || null,
      order_time: o.order_time,
      order_status: o.order_status,
      checkout_amount: o.checkout_amount,
      estimated_commission: o.estimated_commission,
      actual_commission: o.actual_commission,
      currency: o.currency || 'BRL',
      sub_id: o.sub_id || null,
      raw_row_json: o.raw_row_json,
      updated_at: new Date().toISOString()
    }));

    // Realizar UPSERT baseado na constraint unique_user_external_order
    const { data, error } = await supabase
      .from('shopee_orders')
      .upsert(cleanedOrders, { 
        onConflict: 'user_id, external_id' 
      });

    if (error) throw error;
    return data;
  },

  /**
   * Atualiza o status do lote
   */
  async updateBatchStatus(id: string, updates: Partial<ImportBatch>, client?: SupabaseClient) {
    const supabase = client || createClient();
    const { error } = await supabase
      .from('import_batches')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Busca resumo operacional consolidado do usuário
   */
  async getOperationalStats(userId: string, client?: SupabaseClient) {
    const supabase = client || createClient();
    
    const [campaigns, jobs] = await Promise.all([
      supabase.from('campaigns').select('id', { count: 'exact', head: true }),
      supabase.from('send_jobs').select('id', { count: 'exact', head: true })
    ]);

    return {
      totalCampaigns: campaigns.count || 0,
      totalJobs: jobs.count || 0
    };
  },

  /**
   * Busca desempenho real consolidado (Shopee)
   */
  async getRealStats(userId: string, client?: SupabaseClient) {
    const supabase = client || createClient();
    
    const { data, error } = await supabase
      .from('shopee_orders')
      .select('actual_commission, estimated_commission, order_status, checkout_amount')
      .eq('user_id', userId);

    if (error) return null;

    const confirmed = data.filter(o => {
      const s = String(o.order_status).toLowerCase();
      return s === 'completed' || s === 'concluído';
    });
    
    const pending = data.filter(o => {
      const s = String(o.order_status).toLowerCase();
      return s === 'pending' || s === 'aguardando';
    });

    return {
      totalConfirmed: confirmed.reduce((acc, curr) => acc + (Number(curr.actual_commission) || 0), 0),
      totalPending: pending.reduce((acc, curr) => acc + (Number(curr.estimated_commission) || 0), 0),
      totalOrders: data.length,
      totalSales: confirmed.reduce((acc, curr) => acc + (Number(curr.checkout_amount) || 0), 0)
    };
  },

  /**
   * Busca os pedidos mais recentes para a lista de atividade
   */
  async getRecentOrders(userId: string, limit: number = 10, client?: SupabaseClient): Promise<ShopeeOrder[]> {
    const supabase = client || createClient();
    
    const { data, error } = await supabase
      .from('shopee_orders')
      .select('*')
      .eq('user_id', userId)
      .order('order_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent orders:', error);
      return [];
    }
    return data || [];
  }
};
