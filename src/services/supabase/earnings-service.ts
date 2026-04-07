// src/services/supabase/earnings-service.ts
import { createClient } from '@/lib/supabase/client';
import { EarningsImport, EarningsImportItem, EarningsSummary } from '@/types/earnings';



export const earningsService = {
  async getImportHistory(): Promise<EarningsImport[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('earnings_imports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getEarningsSummary(): Promise<EarningsSummary> {
    const supabase = createClient();
    const { data: imports, error: importError } = await supabase
      .from('earnings_imports')
      .select('total_commissions, total_orders');

    if (importError) throw importError;

    const { data: items, error: itemError } = await supabase
      .from('earnings_import_items')
      .select('product_name, commission_amount, occurred_at')
      .order('occurred_at', { ascending: true });

    if (itemError) throw itemError;

    const total_commissions = imports?.reduce((acc, curr) => acc + Number(curr.total_commissions), 0) || 0;
    const total_orders = imports?.reduce((acc, curr) => acc + Number(curr.total_orders), 0) || 0;
    
    // Monthly aggregation
    const monthlyMap: Record<string, number> = {};
    items?.forEach(item => {
      const date = new Date(item.occurred_at || '');
      const monthKey = date.toLocaleString('pt-BR', { month: 'short' });
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + Number(item.commission_amount);
    });

    const monthly_data = Object.entries(monthlyMap).map(([month, ganhos]) => ({
      month,
      ganhos
    }));

    // Top Products aggregation
    const productMap: Record<string, { orders: number; commission: number }> = {};
    items?.forEach(item => {
      const name = item.product_name || 'Desconhecido';
      if (!productMap[name]) productMap[name] = { orders: 0, commission: 0 };
      productMap[name].orders += 1;
      productMap[name].commission += Number(item.commission_amount);
    });

    const top_products = Object.entries(productMap)
      .map(([name, stats]) => ({
        name,
        marketplace: 'Shopee', // Scope limited to Shopee for now
        orders: stats.orders,
        commission_total: stats.commission
      }))
      .sort((a, b) => b.commission_total - a.commission_total)
      .slice(0, 5);

    return {
      total_commissions,
      total_orders,
      total_clicks: 0, // Not tracked yet
      avg_commission: total_orders > 0 ? total_commissions / total_orders : 0,
      monthly_data: monthly_data.length > 0 ? monthly_data : [
        { month: 'Jan', ganhos: 0 },
        { month: 'Fev', ganhos: 0 },
        { month: 'Mar', ganhos: 0 }
      ],
      top_products
    };
  },

  async importShopeeCSV(fileContent: string): Promise<EarningsImport> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) throw new Error('Arquivo CSV inválido ou vazio');

    // Simple CSV Parser (assuming Shopee standard format)
    // Header assumption: Order ID, Product Name, Order Price, Commission Fee, Status, Time
    const header = lines[0].split(',').map(h => h.toLowerCase().trim());
    
    // Attempt to find column indices
    const idxOrderId = header.findIndex(h => h.includes('id') || h.includes('pedido'));
    const idxProductName = header.findIndex(h => h.includes('produto') || h.includes('item') || h.includes('name'));
    const idxOrderAmount = header.findIndex(h => h.includes('valor') || h.includes('preço') || h.includes('price') || h.includes('amount'));
    const idxCommission = header.findIndex(h => h.includes('comissão') || h.includes('fee') || h.includes('earnings'));
    const idxStatus = header.findIndex(h => h.includes('status'));
    const idxTime = header.findIndex(h => h.includes('data') || h.includes('time') || h.includes('hora'));

    const dataRows = lines.slice(1);
    let totalCommissions = 0;
    let totalOrders = 0;

    // Create Import Record
    const { data: importRecord, error: importError } = await supabase
      .from('earnings_imports')
      .insert({
        user_id: user.id,
        marketplace: 'Shopee',
        status: 'processing',
        period: 'Importação Manual'
      })
      .select()
      .single();

    if (importError) throw importError;

    const itemsToInsert: any[] = [];

    for (const row of dataRows) {
      // Basic CSV split considering possible quotes (very simple version)
      const values = row.split(',').map(v => v.replace(/^"|"$/g, '').trim());
      
      const commission = parseFloat(values[idxCommission] || '0') || 0;
      const amount = parseFloat(values[idxOrderAmount] || '0') || 0;
      
      if (!isNaN(commission)) {
        totalCommissions += commission;
        totalOrders += 1;
        
        itemsToInsert.push({
          import_id: importRecord.id,
          user_id: user.id,
          product_name: values[idxProductName] || 'N/A',
          order_id: values[idxOrderId] || 'N/A',
          order_amount: amount,
          commission_amount: commission,
          status: values[idxStatus] || 'N/A',
          occurred_at: values[idxTime] ? new Date(values[idxTime]).toISOString() : new Date().toISOString()
        });
      }
    }

    // Insert Items
    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('earnings_import_items')
        .insert(itemsToInsert);
      
      if (itemsError) {
        await supabase.from('earnings_imports').update({ status: 'failed', error_message: itemsError.message }).eq('id', importRecord.id);
        throw itemsError;
      }
    }

    // Update Import Record
    const { data: finalRecord, error: updateError } = await supabase
      .from('earnings_imports')
      .update({
        status: 'completed',
        products_count: itemsToInsert.length,
        total_orders: totalOrders,
        total_commissions: totalCommissions
      })
      .eq('id', importRecord.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return finalRecord;
  }
};
